// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Compat shim for SteamClient.Browser.GetBrowserID()
/*

    ----- Target Examples -----

    1.  (8811541: line 56314)
        e.SteamClient.Window.IsWindowMaximized().then((e) => {
			n(e);
		})
      =>
        e.SteamClient.Window.IsWindowMaximized((e) => {
			n(e);
		});

    2. 

    
    ----- Notes -----
    
    Some time between 8601984 and 8811541, Valve released a Steam client update which changed how the SteamClient.Window.*() getter methods work.
    - In 8601984, these methods require a callback argument and return nothing
    - Circa 8811541, these methods now have zero arguments and return a promise
    
    Reconciling this change means rewriting all the  method().then(() => {})  call sites in 8811541+ to the old  method(then(() => {})  syntax which works on our target Steam clients.

    Related: see patch <todo>.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export class RewriteSteamClientWindowNewGetterPromisesCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "RewriteSteamClientWindowNewGetterPromises";

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
                    let tnode: ts.CallExpression = detectionInfoData.TypedNode;
                    /* e.g.
                        e.SteamClient.Window.IsWindowMaximized().then((e) => {
							n(e);
						})
                    */

                    let memberToCallRequiringThenFuncAsArgument: ts.PropertyAccessExpression = detectionInfoData.MemberToCallRequiringThenFuncAsArgument; // e.g. e.SteamClient.Window.IsWindowMaximized
                    let thenCallFunction: ts.ArrowFunction = detectionInfoData.ThenCallFunction; // e.g.  (e) => { ne(e); }

                    // Move the thenCallFunction out of then()'s args and into the arguments of the SteamClient.*.Function()
                    let patched = context.factory.createCallExpression(
                        memberToCallRequiringThenFuncAsArgument, // e.g.  e.SteamClient.Window.IsWindowMaximized
                        null,
                        [ // arguments
                            thenCallFunction,
                        ],
                    );
                    /* e.g.
                        e.SteamClient.Window.IsWindowMaximized((e) => {
							n(e);
						})
                    */
                    
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
                        if (node.kind == ts.SyntaxKind.CallExpression)
                        {
                            /* e.g.
                                e.SteamClient.Window.IsWindowMaximized().then((e) => {
									n(e);
								})
                            */

                            let tnode = node as ts.CallExpression;

                            // Validate call().then structure
                            if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  e.SteamClient.Window.IsWindowMaximized().then
                            {
                                let thenChainAccess = tnode.expression as ts.PropertyAccessExpression;
                                if (thenChainAccess.name.kind == ts.SyntaxKind.Identifier && (thenChainAccess.name as ts.Identifier).escapedText == "then")
                                {
                                    if (thenChainAccess.expression.kind == ts.SyntaxKind.CallExpression) // e.g.  e.SteamClient.Window.IsWindowMaximized()
                                    {
                                        let callBeforeChain = thenChainAccess.expression as ts.CallExpression;
                                        if (callBeforeChain.expression.kind == ts.SyntaxKind.PropertyAccessExpression)
                                        {
                                            let propertyAccessToCall = callBeforeChain.expression as ts.PropertyAccessExpression;
                                            // e.g.
                                            // - e.SteamClient.Window.GetWindowRestoreDetails
                                            // - e.SteamClient.Window.IsWindowMinimized
                                            // - e.SteamClient.Window.IsWindowMaximized

                                            if (propertyAccessToCall.name.kind == ts.SyntaxKind.Identifier)
                                            {
                                                // Validate property access of member to call before the then chain
                                                let memberNameToCall = propertyAccessToCall.name as ts.Identifier;

                                                let targets = ["GetWindowRestoreDetails", "IsWindowMinimized", "IsWindowMaximized"];
                                                if (targets.indexOf(memberNameToCall.escapedText.toString()) != -1)
                                                {
                                                    let propertyAccessJs: string = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, propertyAccessToCall, sourceFile);
                                                    if (propertyAccessJs.includes("SteamClient.Window."))
                                                    {
                                                        // Validate callback to then()
                                                        if (tnode.arguments.length > 0)
                                                        {
                                                            let thenCallFunction = tnode.arguments[0]; // e.g. (e) => { n(e); }
                                                            if (thenCallFunction.kind == ts.SyntaxKind.ArrowFunction)
                                                            {
                                                                // All but guaranteed match
                                                                return new DetectionInfo(true, {
                                                                    "TypedNode": tnode,
                                                                    "MemberToCallRequiringThenFuncAsArgument": propertyAccessToCall,
                                                                    "ThenCallFunction": thenCallFunction,
                                                                });
                                                            }
                                                        }
                                                    }
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
