// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Disable broken cross-site scripting attack code in page initialization logic
/*

    ----- Targets -----

    1.  (8601984: line 37944)
        try {
            if (window.parent != window) {
                const t = window.parent;
                if (t.__SHARED_FRIENDSUI_GLOBALS && t.__SHARED_FRIENDSUI_GLOBALS[e]) return t.__SHARED_FRIENDSUI_GLOBALS[e];
                (0, o.X)(!1, `SharedFriendsUIGlobal "${e}" not initialized by parent, proceeding with local copy`);
            }
        } catch (e) {}
     =>
        // all code removed

    
    ----- Notes -----

    The offending code only works correctly when friends is running in the sharedjscontext created by a pure cef desktopui Steam client (June 2023 and later)
    On half-vgui half-cef Steam clients (Oct 30 2019 - May 31 2023), the commented out block is cross-domain scripting violation
    
    Because of the xss attack attempt (steam-chat.com's window accessing steamloopback.host's window), CEF aborts the function early, which prevents the 2 lines below the try-catch from running and clobbering existing valid required data with uninitialized garbage
    
    In other words, this code:
        const n = window;
        return n.__SHARED_FRIENDSUI_GLOBALS || (n.__SHARED_FRIENDSUI_GLOBALS = {}), (0, o.X)(!n.__SHARED_FRIENDSUI_GLOBALS[e], `Unexpected second call to SharedFriendsUIGlobal for "${e}"`), n.__SHARED_FRIENDSUI_GLOBALS[e] || (n.__SHARED_FRIENDSUI_GLOBALS[e] = t()), n.__SHARED_FRIENDSUI_GLOBALS[e];
    fails to run in the half-cef Steam clients. It must fail to run, or else steam-chat.com shits the bed.
    
    Valve has been relying on this invalid behavior induced by their fuck-up since early 2023 at least.

    We, however, get screwed by it. Because the steam-chat.com snapshot is served from steamloopback.host, this code is *not* an xss attack, and thus it runs, and thus is clobbers the valid data with garbage.
    So we have to disable it.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export class DisableBrokenXssAttackValveRelianceCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "DisableBrokenXssAttackValveReliance";

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
                    let tnode: ts.TryStatement = detectionInfoData.TypedNode;
                    /* e.g.
                        try {
	                        if (window.parent != window) {
		                        const t = window.parent;
		                        if (t.__SHARED_FRIENDSUI_GLOBALS && t.__SHARED_FRIENDSUI_GLOBALS[e]) return t.__SHARED_FRIENDSUI_GLOBALS[e];
		                        (0, o.X)(!1, `SharedFriendsUIGlobal "${e}" not initialized by parent, proceeding with local copy`);
	                        }
                        } catch (e) {}
                    */

                    // Remove entirely
                    let oldJs = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile);
                    let stub = context.factory.createEmptyStatement();

                    if (IncludeOldJsCommentAtPatchSites)
                        ts.addSyntheticLeadingComment(stub, ts.SyntaxKind.MultiLineCommentTrivia, oldJs, false);

                    return stub;
                },


                // ____________________________________________________________________________________________________
                //
                //     Detections
                // ____________________________________________________________________________________________________
                //

                [
                    (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node) =>
                    {
                        if (node.kind == ts.SyntaxKind.TryStatement)
                        {
                            /* e.g.
                                try {
	                                if (window.parent != window) {
		                                const t = window.parent;
		                                if (t.__SHARED_FRIENDSUI_GLOBALS && t.__SHARED_FRIENDSUI_GLOBALS[e]) return t.__SHARED_FRIENDSUI_GLOBALS[e];
		                                (0, o.X)(!1, `SharedFriendsUIGlobal "${e}" not initialized by parent, proceeding with local copy`);
	                                }
                                } catch (e) {}
                            */
                            let tnode = node as ts.TryStatement;

                            // Validate root try node and immediate inner if statement
                            let tryBlock = tnode.tryBlock;
                            if (tryBlock.statements.length == 1 && tryBlock.statements[0].kind == ts.SyntaxKind.IfStatement) // e.g.  if (window.parent != window)
                            {
                                let tryBlockRootStatement = tryBlock.statements[0] as ts.IfStatement;
                                if (tryBlockRootStatement.expression.kind == ts.SyntaxKind.BinaryExpression)
                                {
                                    let ifCondition = tryBlockRootStatement.expression as ts.BinaryExpression; // e.g.  window.parent != window
                                    if (ifCondition.operatorToken.kind == ts.SyntaxKind.ExclamationEqualsToken) // !=
                                    {
                                        let ifConditionJs = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, ifCondition, sourceFile);
                                        if (ifConditionJs.includes("window.parent"))
                                        {
                                            // Validate specific contents inside if block
                                            if (tryBlockRootStatement.thenStatement != null && tryBlockRootStatement.thenStatement.kind == ts.SyntaxKind.Block)
                                            {
                                                let ifBlock = tryBlockRootStatement.thenStatement as ts.Block;
                                                let ifBlockJs = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, ifBlock, sourceFile);
                                                if (ifBlockJs.includes("SharedFriendsUIGlobal") && ifBlockJs.includes("not initialized by parent, proceeding with local copy"))
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
