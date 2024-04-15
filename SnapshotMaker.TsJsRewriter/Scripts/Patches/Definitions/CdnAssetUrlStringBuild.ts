// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    CDN asset fetch url rewriting
//
//    Examples:
//      1.  u.Ul.AudioPlaybackManager.PlayAudioURL( o.De.COMMUNITY_CDN_URL + "public/sounds/webui/steam_voice_channel_enter.m4a?v=1" )
//       -> u.Ul.AudioPlaybackManager.PlayAudioURL( TFP.Resources.SelectCdnResourceUrl(o.De.COMMUNITY_CDN_URL, "public/sounds/webui/steam_voice_channel_enter.m4a?v=1", "Root", "JsSounds") )
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration"
// https://stackoverflow.com/a/48189989/2489580


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export interface CdnAssetUrlStringBuildConfig
    {
        MethodIdentifierExpression: string, // e.g.  "TFP.Resources.SelectCdnResourceUrl"
        Targets: {
            ResourceUrl: string, // WITHOUT url vars! e.g.  "public/sounds/webui/steam_voice_channel_enter.m4a"
            UrlRootPathType: string, // e.g.  "Root"
            ResourceCategory: string, // e.g.  "JsSounds"
        }[] // syntax for defining arrays of implicit nested interface types without having to hoist them all as sibling individual interface { } blocks
    }

    export class CdnAssetUrlStringBuildCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "CdnAssetUrlStringBuild";

        CreatePatchDefinition(config: CdnAssetUrlStringBuildConfig): PatchDefinition
        {
            return new PatchDefinition(this.PatchIdName,

                // ____________________________________________________________________________________________________
                //
                //     Patch
                // ____________________________________________________________________________________________________
                //

                (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node, detectionInfoData: any) =>
                {
                    let tnode: ts.BinaryExpression = detectionInfoData.TypedNode; // e.g.  o.De.COMMUNITY_CDN_URL + "public/sounds/webui/steam_voice_channel_enter.m4a?v=1"
                    let matchedTarget: CdnAssetUrlStringBuildConfig["Targets"][0] = detectionInfoData.MatchedTarget; // e.g.  ["public/sounds/webui/steam_voice_channel_enter.m4a", "Root", "JsSounds"]
                    // syntax for retrieving implicit nested interface type ^--^

                    return context.factory.createCallExpression(
                        context.factory.createIdentifier(config.MethodIdentifierExpression),
                        null,
                        [ // arguments
                            tnode.left,
                            tnode.right,
                            context.factory.createStringLiteral(matchedTarget.UrlRootPathType),
                            context.factory.createStringLiteral(matchedTarget.ResourceCategory),
                        ]
                    ); // e.g.  TFP.Resources.SelectCdnResourceUrl(o.De.COMMUNITY_CDN_URL, "public/sounds/webui/steam_voice_channel_enter.m4a?v=1", "Root", "JsSounds")
                },


                // ____________________________________________________________________________________________________
                //
                //     Detections
                // ____________________________________________________________________________________________________
                //

                [
                    (node: ts.Node) =>
                    {
                        if (node.kind == ts.SyntaxKind.BinaryExpression) // e.g.  o.De.COMMUNITY_CDN_URL + "public/sounds/webui/steam_voice_channel_enter.m4a?v=1"
                        {
                            let tnode: ts.BinaryExpression = node as ts.BinaryExpression;
                            if (tnode.right.kind == ts.SyntaxKind.StringLiteral) // e.g.  "public/sounds/webui/steam_voice_channel_enter.m4a?v=1"
                            {
                                let rightTNode: ts.StringLiteral = tnode.right as ts.StringLiteral;

                                let matchedTarget = config.Targets.find(item => item.ResourceUrl == RemoveQueryTailFromUrl(rightTNode.text));
                                if (matchedTarget != null)
                                {
                                    return new DetectionInfo(true, {
                                        "TypedNode": tnode,
                                        "MatchedTarget": matchedTarget,
                                    });
                                }
                            }
                        }
                    }
                ],

            );
        }
    }
    
}
