// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Fix the friend invitations list not closing & returning to the main friends list after accepting or ignoring all incoming invitations
/*

    ----- Target -----
    
    1.  (8601984: line 26141 :: in the render() method directly below a componentDidUpdate() and SignIn() method)
        render() {
			let e = this.props.friends.self,
				t = this.GetNormalizedSearchString(),
				n = this.state.bFriendTabSearch,
				i = "friendTab socialListTab activeTab";
			n && (i += " TabSearchActive");
			let r = {};
            ...
      =>
        render() {
			let zzz1 = d.Ul.FriendStore.FriendGroupStore.incoming_invites_group.member_count > 0,
				zzz2 = d.Ul.FriendStore.ClanStore.clan_invites.length > 0,
				zzz3 = d.Ul.FriendStore.FriendGroupStore.outgoing_invites_group.member_count > 0,
				zzz4 = d.Ul.FriendStore.FriendGroupStore.incoming_invites_group.member_count + d.Ul.FriendStore.ClanStore.clan_invites.length;
			let e = this.props.friends.self,
				t = this.GetNormalizedSearchString(),
				n = this.state.bFriendTabSearch,
				i = "friendTab socialListTab activeTab";
			n && (i += " TabSearchActive");
			let r = {};

    
    ----- Notes -----
    
    Yet Valve fuckup along the lines of "we make billions of dollars hand of over fist but we cannot be fucked to test our code even once to make sure it runs correctly"
    In this case, it's Valve dependency on their shit usage of a shit library causing something to work correctly by accident. Valve later changed their shit code and thus broke the thing that was depending on their shit code.

    The shit library is react. Evidently, it manifests some form of property update notification system that does not handle edge cases. Given that react comes from the retards "programming" facebook's website, who use identifier names like "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED" (<-- this is real btw), honestly it's not that surprising.

    The shit Valve code is their triggering of this system, which may or may not be performed incorrectly, and their depedency fucking it up.

    In 8782155, the start of the target render() method looks like this:
        let e = this.props.friends.self,
		    t = this.GetNormalizedSearchString(),
		    n = d.Ul.FriendStore.FriendGroupStore.incoming_invites_group.member_count > 0,
		    i = d.Ul.FriendStore.ClanStore.clan_invites.length > 0,
		    r = d.Ul.FriendStore.FriendGroupStore.outgoing_invites_group.member_count > 0,
		    a = d.Ul.FriendStore.FriendGroupStore.incoming_invites_group.member_count + d.Ul.FriendStore.ClanStore.clan_invites.length,
		    s = "friendRequestButton";
	    this.state.bViewingIncomingInvites && (s += " friendRequestViewActive"), r && 0 == a && (s += " friendRequestOutgoingOnly");
		let l = this.state.bFriendTabSearch,
			c = "friendTab socialListTab activeTab";
		l && (c += " TabSearchActive");

    In 8791341, it looks like this:
	    let e = this.props.friends.self,
		    t = this.GetNormalizedSearchString(),
		    n = this.state.bFriendTabSearch,
		    i = "friendTab socialListTab activeTab";
		n && (i += " TabSearchActive");

    If this was a sane world created by sane people, there would be no problem here. Ha. Ha.

    These four property accessors are the crux of the problem:
		n = d.Ul.FriendStore.FriendGroupStore.incoming_invites_group.member_count > 0,
		i = d.Ul.FriendStore.ClanStore.clan_invites.length > 0,
		r = d.Ul.FriendStore.FriendGroupStore.outgoing_invites_group.member_count > 0,
		a = d.Ul.FriendStore.FriendGroupStore.incoming_invites_group.member_count + d.Ul.FriendStore.ClanStore.clan_invites.length,

    1. In the relevant render() method, Valve accesses each property and does absolutely nothing with the return value. Already a sign of good, quality programming.

    2. These properties are getters that spiral down into a rabbit hole of react callbacks and triggers. One of those triggers is setting some "componentDidUpdate" flag on the object.

    3. Valve uses the react callback for "componentDidUpdate" to close the invitations list when the user accepts or ignores all invitations.

    4. Starting in 8791341, Valve removed the "pointless" property accesses that did nothing with the return value.
       As a result, the the react callback for "componentDidUpdate" will now never fire in this scenario, because render() is no longer making react run its 10-function deep getter methods on the properties which trigger componentDidUpdate.

    5. The invitations list remains open and requires the user to manually close & reopen the friends list or start searching for a friend name in order to unfuck it back to displaying all friends


    And, as of 8825046, the bug still exists. There is a full month worth of Valve updates between 8791341 and 8825046, but evidently 10,000,000,000 dollars is still not enough to test 4 fucking lines of code.

    This bug can be observed right now by anyone in any browser, by going to steamcommunity.com/chat and getting a friends request. It's not specific to running in FriendsUI.


    The fix is to reintroduce the "pointless" property access statemetns.

    
    To prevent users from incorrectly attributing this Valve fuck up to being the fault of FixedSteamFriendsUI, I have spent 5 hours diagnosing and fixing Valve's retard code. Fuck you Valve.

    
    ----- Range -----

    Since: 8791341.

    Until: At least 8825046.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export class FixBrokenInviteListAutoCloseOnDoneCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "FixBrokenInviteListAutoCloseOnDone";

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
                    let friendStoreAccess: ts.PropertyAccessExpression = detectionInfoData.FriendStoreAccess; // e.g.  d.Ul.FriendStore

                    let friendStoreAccessJs = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, friendStoreAccess, sourceFile);

                    // Insert required statements at the very start of the method

                    let newStatements = tnode.statements.slice();

                    let snippetJs = `
						let zzz1 = ${friendStoreAccessJs}.FriendGroupStore.incoming_invites_group.member_count > 0,
							zzz2 = ${friendStoreAccessJs}.ClanStore.clan_invites.length > 0,
							zzz3 = ${friendStoreAccessJs}.FriendGroupStore.outgoing_invites_group.member_count > 0,
							zzz4 = ${friendStoreAccessJs}.FriendGroupStore.incoming_invites_group.member_count + ${friendStoreAccessJs}.ClanStore.clan_invites.length;
                    `; // local names that unlikely to collide

                    let snippetSourceFile = ts.createSourceFile("snippet.js", snippetJs, ts.ScriptTarget.ES2015, /*setParentNodes*/ false, ts.ScriptKind.JS)
                    // Bizzarely, if setParentNodes=true, typescript fucks up and emits "> {" instead of "> 0" for zzz3, but only in printer.PrintFile, never in printer.PrintNode. Evidently it doesn't care to reevaluate parent nodes when transferring a node from one source file to another, which appear to use a simple incrementing integer as a unique identity only in the context of their origin source file. Which ends up pointing to garbage in other files.

                    let patchNode = (snippetSourceFile.statements[0] as ts.VariableStatement); // Extract the node we want from the implicit statement wrapper it's inside of

                    newStatements.splice(0, 0, patchNode);

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

                                // There are over 300 render() methods in friends.js

                                if (method.body.statements.length > 0)
                                {
                                    let statement0 = method.body.statements[0];
                                    if (statement0.kind == ts.SyntaxKind.VariableStatement) // e.g.  let e = this.props.friends.self ...
                                    {
                                        let varDecList = (statement0 as ts.VariableStatement).declarationList;

                                        let matchedVarDecA = false;
                                        let matchedVarDecB = false;
                                        if (varDecList.declarations.length >= 2)
                                        {
                                            for (let varDec of varDecList.declarations)
                                            {
                                                if (varDec.initializer != null)
                                                {
                                                    // Validate declaration:  e = this.props.friends.self
                                                    if (varDec.initializer.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  this.props.friends.self
                                                    {
                                                        let initializer = varDec.initializer as ts.PropertyAccessExpression;
                                                        if (initializer.name.kind == ts.SyntaxKind.Identifier && (initializer.name as ts.Identifier).escapedText == "self")
                                                        {
                                                            let initializerJs = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, initializer, sourceFile);
                                                            if (initializerJs.endsWith(".props.friends.self"))
                                                            {
                                                                // There only 2 render() methods with their first statement as a var declaration list and  let e = this.props.friends.self  as one of those vars
                                                                matchedVarDecA = true;
                                                            }
                                                        }
                                                    }
                                                    // Validate declaration:  t = this.GetNormalizedSearchString()
                                                    else if (varDec.initializer.kind == ts.SyntaxKind.CallExpression) // e.g.  this.GetNormalizedSearchString()
                                                    {
                                                        let initializer = varDec.initializer as ts.CallExpression;
                                                        if (initializer.expression.kind == ts.SyntaxKind.PropertyAccessExpression)
                                                        {
                                                            let thingToCall = initializer.expression as ts.PropertyAccessExpression;
                                                            if (thingToCall.name.kind == ts.SyntaxKind.Identifier && (thingToCall.name as ts.Identifier).escapedText == "GetNormalizedSearchString")
                                                            {
                                                                // The other render() method doesn't have this var dec
                                                                matchedVarDecB = true;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }


                                        if (matchedVarDecA && matchedVarDecB)
                                        {
                                            // The patch code needs to access d.Ul.FriendStore, so we need to find a property access node for that
                                            // There is one we can use from later in the method body:  const v = d.Ul.FriendStore.BIsOfflineMode(),
                                            let friendStoreAccess = null;

                                            for (let statement of tnode.statements)
                                            {
                                                if (statement.kind == ts.SyntaxKind.VariableStatement) // e.g.  const v = d.Ul.FriendStore.BIsOfflineMode(), S = a
                                                {
                                                    for (let varDec of (statement as ts.VariableStatement).declarationList.declarations)
                                                    {
                                                        if (varDec.initializer != null && varDec.initializer.kind == ts.SyntaxKind.CallExpression) // e.g.  d.Ul.FriendStore.BIsOfflineMode()
                                                        {
                                                            let call = varDec.initializer as ts.CallExpression;
                                                            if (call.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  d.Ul.FriendStore.BIsOfflineMode
                                                            {
                                                                let propertyAccess1 = call.expression as ts.PropertyAccessExpression;
                                                                if (propertyAccess1.name.kind == ts.SyntaxKind.Identifier && (propertyAccess1.name as ts.Identifier).escapedText == "BIsOfflineMode")
                                                                {
                                                                    if (propertyAccess1.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  d.Ul.FriendStore
                                                                    {
                                                                        let propertyAccess2 = propertyAccess1.expression as ts.PropertyAccessExpression;
                                                                        if (propertyAccess2.name.kind == ts.SyntaxKind.Identifier && (propertyAccess2.name as ts.Identifier).escapedText == "FriendStore")
                                                                        {
                                                                            friendStoreAccess = propertyAccess2;
                                                                            break;
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }


                                            if (friendStoreAccess != null)
                                            {
                                                return new DetectionInfo(true, {
                                                    "TypedNode": tnode,
                                                    "FriendStoreAccess": friendStoreAccess,
                                                })
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
