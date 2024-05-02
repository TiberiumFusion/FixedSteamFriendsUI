// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Fix the friend invitations list having blank items for requests received before the invitations list was opened for the first time
/*

    ----- Target -----
    
    1.  (8825046: line 26825 :: in the render() method directly below a componentDidUpdate() method and a ToggleOfflineSortMethod() method)
        render() {
			var e, t, n, i, r, a, l;
			let m = this.props.searchString && this.props.searchString.length > 0,
				u = m,
            ...
      =>
        render() {
            try
			{
				if (this.IsInviteGroup())
				{
					// Run this every 0.5 seconds as long as the invite list is open
					let now = Date.now()
					let forceUpdateInterval = 500;
					if (this.__TFP_BrokenValveCodeWorkaround_TimeOfLastSetTimeout == null || now > this.__TFP_BrokenValveCodeWorkaround_TimeOfLastSetTimeout + forceUpdateInterval)
					{
						this.__TFP_BrokenValveCodeWorkaround_TimeOfLastSetTimeout = now;
						let localThis = this;
						setTimeout(function () {
							localThis.forceUpdate();
						}, forceUpdateInterval);
					}
				}
			}
			catch (e) { }
			var e, t, n, i, r, a, l;
			let m = this.props.searchString && this.props.searchString.length > 0,
				u = m,
            ...

    
    ----- Notes -----
    
    See notes in FixBrokenInviteListAutoCloseOnDone first.
    Valve broke multiple things in the friend invitations list with their 8791341 update. This is another one of their fuckups in the same vein.

    Because Valve no longer invokes the 10-method deep react getter methods for parts of FriendStore, their lack of properly signalling to redraw the associated visuals means some are no longer being redrawn at all.
    One of the affected things are the items in the friends requests/invitations list.

    When steam-chat.com launches, it finds all invitations sent before it was launched. It then dislays them in the invitiations list if the user clicks on the waving avatar icon.
    In 8782155 and earlier, this worked.

    8791341 broke this. Now these invitiation items are never redrawn from the initial empty state and thus appear invisible - until the user clicks on something which triggers a property access which triggers a refresh and thus redraw of the affected items.

    Unlike FixBrokenInviteListAutoCloseOnDone, the fix for this is not obvious. It's not clear which piece of altered/removed Valve bastardized js is the key to the puzzle.
    So I've come up with my own simply fix for now.

    react provides some "forceUpdate" method, which causes the object to tag itself for redrawing. If we call this at some point after the user opens the invitations list, it will force the invisible items to redraw themselves and become visible.

    The top of the target site render() method is a serviceable choice. This render() method is called upon the user clicking the waving avatar icon to open the invitations list.

    However, care must be taken NEVER to call forceUpdate() within a call stack that originated from a react update, or else react shits the bed and goes into an infinite loop.
    As such, we set an ugly timeout and call forceUpdate() in there.
    And so the next iteration of the react message loop causes a redraw of the invitations list, making the invisible items become visible again.

    Related: see FixBrokenInviteListAutoCloseOnDone.

    
    ----- Range -----

    Unneeded: 8782155 and earlier.
              - Everything worked before Valve fucked it up in this update

    Since: 8791341.

    Until: At least 8825046.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export class FixBrokenInviteListInviteItemsCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "FixBrokenInviteListInviteItems";

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
                    let tnode: ts.Block = detectionInfoData.TypedNode; // body of the render() method
                    
                    // Insert required statements at the very start of the method

                    let snippetJs = `
						try
						{
							if (this.IsInviteGroup())
							{
								// Run this every 0.5 seconds as long as the invite list is open
								let now = Date.now()
								let forceUpdateInterval = 500;
								if (this.__TFP_BrokenValveCodeWorkaround_TimeOfLastSetTimeout == null || now > this.__TFP_BrokenValveCodeWorkaround_TimeOfLastSetTimeout + forceUpdateInterval)
								{
									this.__TFP_BrokenValveCodeWorkaround_TimeOfLastSetTimeout = now;
									let localThis = this;
									setTimeout(function () {
										localThis.forceUpdate();
									}, forceUpdateInterval);
								}
							}
						}
						catch (e) { }
                    `;

                    let snippetSourceFile = ts.createSourceFile("snippet.js", snippetJs, ts.ScriptTarget.ES2015, /*setParentNodes*/ false, ts.ScriptKind.JS)
                    // Keep setParentNodes=false to avoid garbage in emit from printer.PrintFile()

                    let newStatements = snippetSourceFile.statements.concat(tnode.statements);
                    return context.factory.updateBlock(tnode, newStatements);
                },


                // ____________________________________________________________________________________________________
                //
                //     Detections
                // ____________________________________________________________________________________________________
                //

                [
                    (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node) =>
                    {
                        if (node.kind == ts.SyntaxKind.Block) // e.g. body of  render()
                        {
                            let tnode = node as ts.Block;

                            if (tnode.parent != null && tnode.parent.kind == ts.SyntaxKind.MethodDeclaration) // e.g.  render()
                            {
                                let method = tnode.parent as ts.MethodDeclaration;
                                if (method.name.kind == ts.SyntaxKind.Identifier && (method.name as ts.Identifier).escapedText == "render")
                                {
                                    // There are over 300 render() methods in friends.js

                                    if (method.body.statements.length >= 2)
                                    {
                                        let statement1 = method.body.statements[1];
                                        if (statement1.kind == ts.SyntaxKind.VariableStatement)
                                        {
                                            /* e.g.
                                                let m = this.props.searchString && this.props.searchString.length > 0,
							                        u = m,
							                        p = this.IsCollapsed() && !m && !this.state.friendDrag,
							                        _ = [],
							                        g = this.IsInviteGroup(),
							                        C = this.props.group.m_eDisplayType == c.h1.eOfflineOnly,
							                        f = !1;
                                            */
                                            let varDecList = (statement1 as ts.VariableStatement).declarationList;

                                            let matchedVarDec = false;
                                            if (varDecList.declarations.length >= 2)
                                            {
                                                for (let varDec of varDecList.declarations)
                                                {
                                                    if (varDec.initializer != null)
                                                    {
                                                        // Validate declaration:  p = this.IsCollapsed() && !m && !this.state.friendDrag,
                                                        // The  this.IsCollapsed  call and  this.state.friendDrag  access in a var dec is unique to this render() method among all other render() methods
                                                        if (varDec.initializer.kind == ts.SyntaxKind.BinaryExpression) // e.g.  this.IsCollapsed() && !m && !this.state.friendDrag
                                                        {
                                                            let initializer = varDec.initializer as ts.BinaryExpression;
                                                            let initializerJs = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, initializer, sourceFile);
                                                            if (initializerJs.includes(".IsCollapsed()") && initializerJs.includes(".state.friendDrag"))
                                                            {
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
                ],

            );
        }
    }
    
}
