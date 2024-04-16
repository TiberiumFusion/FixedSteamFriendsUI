// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Fix some IsMaximized() method calling this.m_popup.SteamClient.Window.IsWindowMinimized instead of this.m_popup.SteamClient.Window.IsWindowMaximized
/*

    ----- Targets -----
    
    1.  (8601984: line 34511 :: in the IsMaximized() method near Ctrl+F for "get focused() {")
        this.m_popup && !this.m_popup.closed && this.m_popup.SteamClient && this.m_popup.SteamClient.Window && this.m_popup.SteamClient.Window.IsWindowMinimized
      =>
        this.m_popup && !this.m_popup.closed && this.m_popup.SteamClient && this.m_popup.SteamClient.Window && this.m_popup.SteamClient.Window.IsWindowMaximized

    
    ----- Notes -----
    
    So this is yet another one of Valve's pathetic "we make billions of dollars hand of over fist but we cannot be fucked to spend 5 seconds testing or proofreading our copy & paste code" errors
    And it causes errors when running under the Dec 2022 client, where IsWindowMaximized does not exist for some reason

    Fixing Valve's idiot code doesn't make IsWindowMaximized always magically exist, but it falsey automatic null for this nonexistent property isn't causing problems, and since Valve likes abusing this (anti-)feature of javascript, it's very possible that some code downstream of this actually depends on that.

    
    ----- Range -----

    Since: 8200419 or earlier.

    Until: Sometime between 8601984 and 8811541.
           - Circa 8811541, Valve finally "fixed" this bug, by way of completely rewriting the IsMinimized() and IsMaximized() methods for this type. The rewrite involves a new guarded access paradigm to members of SteamClient, which is good and save me the work of writing a shim patch to do the same thing. Unfortunately, Valve's access guard only exists on this one type in question and is only used for its own access to SteamClient members.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export class FixBrokenIsMaximizedCopypastaCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "FixBrokenIsMaximizedCopypasta";

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
                    let tnode: ts.PropertyAccessExpression = detectionInfoData.TypedNode; // e.g.  this.m_popup.SteamClient.Window.IsWindowMinimized

                    // Change the "IsWindowMinimized" identifier to "IsWindowMaximized"
                    let patched = context.factory.updatePropertyAccessExpression(tnode, tnode.expression, context.factory.createIdentifier("IsWindowMaximized"));

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
                        if (node.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  this.m_popup.SteamClient.Window.IsWindowMinimized
                        {
                            let tnode = node as ts.PropertyAccessExpression; // e.g.  
                            if (tnode.parent != null && tnode.parent.kind == ts.SyntaxKind.BinaryExpression) // e.g.  this.m_popup.SteamClient.Window && this.m_popup.SteamClient.Window.IsWindowMinimized
                            {
                                // Last binary expression in the long && chain:  this.m_popup && !this.m_popup.closed && this.m_popup.SteamClient && this.m_popup.SteamClient.Window && this.m_popup.SteamClient.Window.IsWindowMinimized
                                let andChainLast = tnode.parent as ts.BinaryExpression;

                                if (andChainLast.operatorToken.kind == ts.SyntaxKind.AmpersandAmpersandToken) // && operator
                                {
                                    // Validate the expected method that we are inside
                                    // This will save execution time wasted on stringifying a lot of unnecessary ast in the next validation stage
                                    let methodNode = AstFindFirstAncestor(tnode, ts.SyntaxKind.MethodDeclaration); // e.g.  the expected IsMaximized() method that contains the expression we're looking for
                                    if (methodNode != null)
                                    {
                                        let methodTNode = methodNode as ts.MethodDeclaration;
                                        if (methodTNode.name.kind == ts.SyntaxKind.Identifier) // e.g.  IsMaximized
                                        {
                                            let methodTNodeName = methodTNode.name as ts.Identifier;
                                            if (methodTNodeName.escapedText == "IsMaximized")
                                            {
                                                // Validate the long && chain expression
                                                // We are simply going to check if it's a match by stringifying it and comparing that
                                                let js = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, tnode, sourceFile);
                                                if (js == "this.m_popup.SteamClient.Window.IsWindowMinimized")
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
                    }
                ],

            );
        }
    }
    
}
