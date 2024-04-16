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
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export interface RewriteCdnAssetUrlStringBuildConfig
    {
        ShimMethodIdentifierExpression: string, // e.g.  "TFP.Resources.SelectCdnResourceUrl"
        Targets: {
            ResourceUrl: string, // WITHOUT url vars! e.g.  "public/sounds/webui/steam_voice_channel_enter.m4a"
            UrlRootPathType: string, // e.g.  "Root"
            ResourceCategory: string, // e.g.  "JsSounds"
        }[] // syntax for defining arrays of implicit nested interface types without having to hoist them all as sibling individual interface { } blocks
    }

    export class RewriteCdnAssetUrlStringBuildCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "RewriteCdnAssetUrlStringBuild";

        CreatePatchDefinition(config: RewriteCdnAssetUrlStringBuildConfig): PatchDefinition
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
                    let matchedTarget: RewriteCdnAssetUrlStringBuildConfig["Targets"][0] = detectionInfoData.MatchedTarget; // e.g.  ["public/sounds/webui/steam_voice_channel_enter.m4a", "Root", "JsSounds"]
                    // syntax for retrieving implicit nested interface type ^--^

                    // Replace the binary expression with a method call that takes the original halves of the binary expr as arguments
                    let patched = context.factory.createCallExpression(
                        context.factory.createIdentifier(config.ShimMethodIdentifierExpression),
                        null,
                        [ // arguments
                            tnode.left,
                            tnode.right,
                            context.factory.createStringLiteral(matchedTarget.UrlRootPathType),
                            context.factory.createStringLiteral(matchedTarget.ResourceCategory),
                        ]
                    ); // e.g.  TFP.Resources.SelectCdnResourceUrl(o.De.COMMUNITY_CDN_URL, "public/sounds/webui/steam_voice_channel_enter.m4a?v=1", "Root", "JsSounds")

                    if (IncludeOldJsCommentAtPatchSites)
                        ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);

                    return patched;
                },


                // ____________________________________________________________________________________________________
                //
                //     Detections
                // ____________________________________________________________________________________________________
                //

                [
                    (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node) =>
                    {
                        if (node.kind == ts.SyntaxKind.BinaryExpression) // e.g.  o.De.COMMUNITY_CDN_URL + "public/sounds/webui/steam_voice_channel_enter.m4a?v=1"
                        {
                            let tnode = node as ts.BinaryExpression;
                            if (tnode.right.kind == ts.SyntaxKind.StringLiteral) // e.g.  "public/sounds/webui/steam_voice_channel_enter.m4a?v=1"
                            {
                                let rightTNode = tnode.right as ts.StringLiteral;

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
