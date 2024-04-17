// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    CDN asset fetch url rewriting
/*

    ----- Generic Target Examples -----

    1.  u.Ul.AudioPlaybackManager.PlayAudioURL( o.De.COMMUNITY_CDN_URL + "public/sounds/webui/steam_voice_channel_enter.m4a?v=1" )
      =>
        u.Ul.AudioPlaybackManager.PlayAudioURL( TFP.Resources.SelectCdnResourceUrl(o.De.COMMUNITY_CDN_URL, "public/sounds/webui/steam_voice_channel_enter.m4a?v=1", "Root", "JsSounds") )

    
    ----- Specific Targets -----

    1. (8601984: line 58917 :: css file loader)
        if ("undefined" != typeof document) {
			var e = (e) =>
					new Promise((t, n) => {
						var i = s.miniCssF(e),
							o = s.p + i;
						if (
							((e, t) => {
								for (var n = document.getElementsByTagName("link"), i = 0; i < n.length; i++) { ...
      =>
        if ("undefined" != typeof document) {
			var e = (e) =>
					new Promise((t, n) => {
						var i = s.miniCssF(e),
							o = TFP.Resources.SelectCdnResourceUrl(s.p, i, "Root_Public", "JsCss");
						if (
							((e, t) => {
								for (var n = document.getElementsByTagName("link"), i = 0; i < n.length; i++) {
    
    
    ----- Notes -----
    
    In order for the snapshot to be 100% local, all resource fetches must go to steamloopback.host instead of the remote Valve servers.
    We achieve that by inserting a shim method in all locations where Valve's js builds url path strings. The shim method will return a different url that originates from the steamloopback.host.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export interface RewriteCdnAssetUrlStringBuildConfig
    {
        ShimMethodIdentifierExpression: string, // e.g.  "TFP.Resources.SelectCdnResourceUrl"
        Targets: {
            ResourceUrl: string, // WITHOUT url vars! (e.g. "public/sounds/webui/steam_voice_channel_enter.m4a"). For generic detection only.
            SpecialCase: string, // For specific patch detections only.
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
                    // Common patch logic works for both Location 0 and Location 1

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
                    //
                    // Generic patch location
                    //
                    
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
                                        "Location": 1,
                                        "TypedNode": tnode,
                                        "MatchedTarget": matchedTarget,
                                    });
                                }
                            }
                        }
                    },

                    //
                    // Specific patch location 1: css loader
                    //
                    
                    (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node) =>
                    {
                        if (node.kind == ts.SyntaxKind.BinaryExpression) // e.g.  s.p + i
                        {
                            let tnode = node as ts.BinaryExpression;

                            // Validate url string build binary expression being part of the expected variable definition list
                            if (tnode.parent != null && tnode.parent.kind == ts.SyntaxKind.VariableDeclaration) // e.g.  [var] o = s.p + i
                            {
                                let parentVarDec = tnode.parent as ts.VariableDeclaration;
                                if (parentVarDec.parent != null) // e.g.  var i = s.miniCssF(e), o = s.p + i;
                                {
                                    let parentVarDecList = parentVarDec.parent as ts.VariableDeclarationList;

                                    // Validate our expected location in the var dec list
                                    if (parentVarDecList.declarations.indexOf(parentVarDec) == 1) // 2nd declaration
                                    {
                                        // Validate the first item in the variable declaration list
                                        // This has the unique identifier miniCssF ("miniCssF" only appears in friends.js once)
                                        let dec0 = parentVarDecList.declarations[0];
                                        if (dec0.initializer != null && dec0.initializer.kind == ts.SyntaxKind.CallExpression) // e.g.  s.miniCssF(e)
                                        {
                                            let dec0InitCall = dec0.initializer as ts.CallExpression;
                                            if (dec0InitCall.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  s.miniCssF
                                            {
                                                let dec0InitCallAccessExpression = dec0InitCall.expression as ts.PropertyAccessExpression;
                                                if (dec0InitCallAccessExpression.name.kind == ts.SyntaxKind.Identifier && (dec0InitCallAccessExpression.name as ts.Identifier).escapedText == "miniCssF")
                                                {
                                                    // Get config for this target
                                                    let matchedTarget = config.Targets.find(item => item.SpecialCase == "CssLoader");
                                                    if (matchedTarget != null)
                                                    {
                                                        return new DetectionInfo(true, {
                                                            "Locaton": 2,
                                                            "TypedNode": tnode,
                                                            "MatchedTarget": matchedTarget,
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    
                                }
                            }
                        }
                    },
                ],

            );
        }
    }
    
}
