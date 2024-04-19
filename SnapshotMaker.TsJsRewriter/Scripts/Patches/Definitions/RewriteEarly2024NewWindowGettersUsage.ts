// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Rewrite bare this.m_popup.SteamClient.Window.*() promise getters to old promise creator syntax
/*

    ----- Targets -----

    1.  (8811541: line 33706)
        return (0, v.w3)(this.m_popup, "Window.GetWindowRestoreDetails") && !this.m_popup.closed ? this.m_popup.SteamClient.Window.GetWindowRestoreDetails() : Promise.resolve("");
      =>
        return (0, v.w3)(this.m_popup, "Window.GetWindowRestoreDetails") && !this.m_popup.closed
			? new Promise((e, t) => {
					this.m_popup.SteamClient.Window.GetWindowRestoreDetails((t) => {
						e(t);
					});
				})
			: Promise.resolve("");

    2.  (8811541: line 33709)
        return (0, v.w3)(this.m_popup, "Window.IsWindowMinimized") && !this.m_popup.closed ? this.m_popup.SteamClient.Window.IsWindowMinimized() : Promise.resolve(!1);
      =>
        return (0, v.w3)(this.m_popup, "Window.IsWindowMinimized") && !this.m_popup.closed
			? new Promise((e, t) => {
					this.m_popup.SteamClient.Window.IsWindowMinimized((t) => {
						e(t);
					});
				})
			: Promise.resolve(!1);

    3.  (8811541: line 33712)
        return (0, v.w3)(this.m_popup, "Window.IsWindowMaximized") && !this.m_popup.closed ? this.m_popup.SteamClient.Window.IsWindowMaximized() : Promise.resolve(!1);
      =>
        return (0, v.w3)(this.m_popup, "Window.IsWindowMaximized") && !this.m_popup.closed
			? new Promise((e, t) => {
					this.m_popup.SteamClient.Window.IsWindowMaximized((t) => {
						e(t);
					});
				})
			: Promise.resolve(!1);

    
    ----- Notes -----
    
    Some time between 8601984 and 8811541, Valve released a Steam client update which changed how the SteamClient.Window.*() getter methods work.
    - In 8601984, these methods require a callback argument and return nothing
    - Circa 8811541, these methods now have zero arguments and return a promise
    
    Here we are patching a specific component of friends.js which uses these functions.

    Check the Targets list above. The original version of each item is the circa 8811541 version. The patched version of each item is its circa 8601984 equivalent.

    Since circa 8811541 blindly assumes these SteamClient.Window.* returns promises now despite the fact they don't do that in our target Steam clients, we have to reintroduce the old 8601984 logic. Our target Steam clients take a callback as an arg and return nothing. 8601984 understands this and uses it correctly, so we can simply copy+paste the 8601984 logic and everything works.

    This change to the Steam client and steam-chat.com seems very abrupt. 8811541 is ~4 months after 8601984. 8601984 is circa the December 2023 Steam client. And there is no dual logic in 8601984 to use both the old style and new style Window.* methods.
    From this information, we can infer that Valve very quickly rammed a Steam client down users' throats between Dec 2023 and Apr 2024 which changed the SteamClient.Window.* methods to return promises, and accordingly very quickly updated steam-chat.com to exclusively use the changed methods without any dual logic to continue supporting Steam clients yet to update.
    This is now part of a growing pile of evidence to Valve's disregard for users' who do not immediately take Steam client updates and thus get screwed by unconditional breaking changes in very small timeframes previously unheard of.

    >> Related: see patch RewriteSteamClientWindowNewGetterPromises.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export interface RewriteEarly2024NewWindowGettersUsageConfig
    {
        Targets: {
            NameOfMemberCallToRewrite: string; // e.g.  "IsWindowMaximized"
            OwningMethodName: string; // e.g.  "IsMaximized"
        }[]
    }

    export class RewriteEarly2024NewWindowGettersUsageCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "RewriteEarly2024NewWindowGettersUsage";

        CreatePatchDefinition(config: RewriteEarly2024NewWindowGettersUsageConfig): PatchDefinition
        {
            return new ConfiguredPatchDefinition(this.PatchIdName, config,

                // ____________________________________________________________________________________________________
                //
                //     Patch
                // ____________________________________________________________________________________________________
                //

                (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node, detectionInfoData: any) =>
                {
                    let tnode: ts.CallExpression = detectionInfoData.TypedNode; // e.g.  this.m_popup.SteamClient.Window.IsWindowMaximized()

                    /* Rewrite the target site like so:
                        new Promise((e, t) => {
							this.m_popup.SteamClient.Window.IsWindowMaximized((t) => {
								e(t);
							});
						})
                    */

                    let memberToCallAccessJs: string = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, tnode.expression, sourceFile);
                    let snippetJs = `
                        new Promise((e, t) => {
							${memberToCallAccessJs}((t) => {
								e(t);
							});
						})
                    `;
                    let snippetSourceFile = ts.createSourceFile("snippet.js", snippetJs, ts.ScriptTarget.ES2015, /*setParentNodes*/ true, ts.ScriptKind.JS);
                    // setParentNodes MUST be true, otherwise typescript fucks up and fails to associate the nodes with their SourceFile, which causes ts.addSyntheticLeadingComment() to always complain and throw due to the missing source file

                    let patchNode = (snippetSourceFile.statements[0] as ts.ExpressionStatement).expression; // Extract the node we want from the implicit statement wrapper it's inside of

                    if (IncludeOldJsCommentAtPatchSites)
                        ts.addSyntheticLeadingComment(patchNode, ts.SyntaxKind.MultiLineCommentTrivia, JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);

                    // Note: currently there is some screw up happening where typescript is duplicating the leading comment (i.e. valve copyright notice) of the sourceFile to the start of each emitted node using the node from this snippet file
                    // After hours of searching and tests, there is no clear fix to this, and the lack of quality information on the internet regarding the typescript compiler does not help at all
                    // It is obnoxious but does not break anything, so it gets to stay for now. I'd like to fix it eventually.

                    return patchNode;
                },


                // ____________________________________________________________________________________________________
                //
                //     Detections
                // ____________________________________________________________________________________________________
                //

                [
                    (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node) =>
                    {
                        if (node.kind == ts.SyntaxKind.CallExpression) // e.g.  this.m_popup.SteamClient.Window.IsWindowMaximized()
                        {
                            let tnode = node as ts.CallExpression;

                            // Validate call arguments
                            if (tnode.arguments.length == 0)
                            {
                                // Validate name of member to call
                                if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  this.m_popup.SteamClient.Window.IsWindowMaximized
                                {
                                    let memberToCall = tnode.expression as ts.PropertyAccessExpression;
                                    if (memberToCall.name.kind == ts.SyntaxKind.Identifier) // e.g.  IsWindowMaximized
                                    {
                                        let memberToCallName = memberToCall.name as ts.Identifier;
                                        let matchedTarget = config.Targets.find(item => item.NameOfMemberCallToRewrite == memberToCallName.escapedText);

                                        if (matchedTarget != null)
                                        {
                                            // Validate immediate qualification of member to call
                                            if (memberToCall.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  this.m_popup.SteamClient.Window
                                            {
                                                let memberToCallAccess = memberToCall.expression as ts.PropertyAccessExpression;
                                                if (memberToCallAccess.name.kind == ts.SyntaxKind.Identifier && (memberToCallAccess.name as ts.Identifier).escapedText == "Window")
                                                {
                                                    // Validate that the return value of the called member is not dereferenced
                                                    //   Yes: this.m_popup.SteamClient.Window.GetWindowRestoreDetails()
                                                    //   No:  this.m_popup.SteamClient.Window.GetWindowRestoreDetails().then(() => { ... })

                                                    let tnodeParent = tnode.parent;
                                                    if (tnodeParent != null && tnode.parent.kind != ts.SyntaxKind.PropertyAccessExpression) // this is not a comprehensive check and is only valid for this local target site
                                                    {
                                                        // Validate the location of this method call belonging to the matched target method definition
                                                        let method = AstFindFirstAncestor(tnode, ts.SyntaxKind.MethodDeclaration);
                                                        if (method != null)
                                                        {
                                                            let methodT = method as ts.MethodDeclaration;
                                                            if (methodT.name.kind == ts.SyntaxKind.Identifier)
                                                            {
                                                                let methodName = methodT.name as ts.Identifier;
                                                                if (methodName.escapedText == matchedTarget.OwningMethodName)
                                                                {
                                                                    // Highly likely match
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
							    }
                            }
                        }
                    }
                ],

            );
        }
    }
    
}
