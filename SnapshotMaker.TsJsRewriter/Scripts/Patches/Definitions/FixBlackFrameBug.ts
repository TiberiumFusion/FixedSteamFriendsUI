// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Fix black frame bug when steam-chat.com is running under Steam clients that don't create "popup-created" signals
//
//    Target examples:
//      1.  Within the Show(e = d.IF.k_EWindowBringToFrontAndForceOS) method:
//          r && (this.OnCreateInternal(), t != d.IF.k_EWindowBringToFrontInvalid && this.Focus(t))
//       -> r ? (this.OnCreateInternal(), t != d.IF.k_EWindowBringToFrontInvalid && this.Focus(t)) : this.OnCreateInternal()
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*  -- Notes --
    
    The notable manifestation of this bug is the solid black Friends List under the Dec 2022 Steam client. Everything is loaded and running properly in the background, but the frame never renders itself and thus is solid black.

    When running under Steam clients that never raise the "popup-created" event, the inner frame will never render itself since m_bCreated will never be set to true
	The solution ternary is adapted from 8200419, where it is Valve's solution to that problem. Valve removed this by the time of 8601984 and replaced it with the "r &&" block isntead, so we are bringing it back (but with alterations)
	Verbatim, the 8200419 ternary includes a nasty call to some "SteamInitPopups" method. In the context provided by 8200419, this works without issue. In the context here of 8601984, this causes problems: all windows spawned by the inner frame steal focus upon creation. Despite the code here in Show() having zero functional changes between 8200419 and 8601984, that focus stealing problem was still somehow conceived, indicating that the context surrounding the use of this Show() function has changed (in some unknown way). Removing the use of SteamInitPopups appears to fix the problem, which is closer to vanilla 8601984 anyways.

    So the ultimate fix here is to ensure OnCreateInternal() is always called in the Show(e = d.IF.k_EWindowBringToFrontAndForceOS) method. And we want to do that without disrupting the logic of the disgusting javascript in this area.
	
    For more info see #9 and #10 on gh.

 */


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export class FixBlackFrameBugCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "FixBlackFrameBug";

        CreatePatchDefinition(): PatchDefinition
        {
            return new PatchDefinition(this.PatchIdName,

                // ____________________________________________________________________________________________________
                //
                //     Patch
                // ____________________________________________________________________________________________________
                //

                (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node, detectionInfoData: any) =>
                {
                    let tnode: ts.BinaryExpression = detectionInfoData.TypedNode; // e.g.  r && (this.OnCreateInternal(), t != d.IF.k_EWindowBringToFrontInvalid && this.Focus(t))

                    // Convert the && expression into a ternary
                    // The right side of the original && expr will be the true ternary path
                    // We will add the bugfix logic to the false ternary path

                    let falsePath = context.factory.createCallExpression( // this.OnCreateInternal()
                        context.factory.createPropertyAccessExpression( // this.OnCreateInternal
                            context.factory.createThis(),
                            context.factory.createIdentifier("OnCreateInternal")
                        ),
                        null,
                        []
                    )

                    let patched = context.factory.createConditionalExpression( // e.g.  r ? (this.OnCreateInternal(), t != d.IF.k_EWindowBringToFrontInvalid && this.Focus(t)) : this.OnCreateInternal()
                        tnode.left, // e.g.  r
                        context.factory.createToken(ts.SyntaxKind.QuestionToken),
                        tnode.right,
                        context.factory.createToken(ts.SyntaxKind.ColonToken),
                        falsePath
                    );
                    
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
                        if (node.kind == ts.SyntaxKind.BinaryExpression) // e.g.  r && (this.OnCreateInternal(), t != d.IF.k_EWindowBringToFrontInvalid && this.Focus(t))
                        {
                            let tnode = node as ts.BinaryExpression;
                            if (tnode.operatorToken.kind == ts.SyntaxKind.AmpersandAmpersandToken) // && operator
                            {
                                // Validate the expected show method that we are inside
                                // This will save execution time wasted on stringifying a lot of unnecessary ast in the next validation stage
                                let methodNode = AstFindFirstAncestor(tnode, ts.SyntaxKind.MethodDeclaration); // e.g.  the expected Show(e = d.IF.k_EWindowBringToFrontAndForceOS) method that contains the expression we're looking for
                                if (methodNode != null)
                                {
                                    let methodTNode = methodNode as ts.MethodDeclaration;
                                    if (methodTNode.name.kind == ts.SyntaxKind.Identifier) // e.g.  Show
                                    {
                                        let methodTNodeName = methodTNode.name as ts.Identifier;
                                        if (methodTNodeName.escapedText == "Show")
                                        {
                                            // Validate the right half of the r && expression
                                            let right = tnode.right; // e.g.  (this.OnCreateInternal(), t != d.IF.k_EWindowBringToFrontInvalid && this.Focus(t))
                                            // Currently, this is a ParenthesizedExpression, but this could change
                                            // We are simply going to check if it's a match by stringifying it and looking for (semi-)constant keywords in the js
                                            let rightJs = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, right, sourceFile);

                                            if (rightJs.includes("OnCreateInternal") && rightJs.includes("WindowBringToFrontInvalid") && rightJs.includes("Focus"))
                                            {
                                                // All but guaranteed match
                                                return new DetectionInfo(true, {
                                                    "TypedNode": tnode,
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                ],

            );
        }
    }
    
}
