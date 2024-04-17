// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Hook site immediately after friends.js has loaded webui_config from html
/*    

    ----- Target -----

    1.  (8601984: line 57645)
        function d(e = a) {
			const t = {},
				n = m("config", e);
			n && (delete n.SESSIONID, Object.assign(r.De, n), (t.config = !0));
            // << INSERT HERE >>
			const i = m("userinfo", e);
            i && (Object.assign(r.L7, i), (t.userConfig = !0), r.L7.is_support && _() && (r.L7.is_support = !1));
      =>
        TFP.Hooks.OnWebuiConfigLoaded(r.De);

    
    ----- Notes -----
    
    We need a way to modify the json config object that is baked into the html document which is running friends.js.
    This is required for things like localized display strings and nation-specific behavior.

    A good place for planting the hook is immediately after the deserialized json is assigned to the globalish object that all of friends.js references.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export interface AddHtmlWebuiConfigOnLoadHookConfig
    {
        HookMethodIdentifierExpression: string, // e.g.  "TFP.Hooks.OnWebuiConfigLoaded"
    }

    export class AddHtmlWebuiConfigOnLoadHookCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "AddHtmlWebuiConfigOnLoadHook";

        CreatePatchDefinition(config: AddHtmlWebuiConfigOnLoadHookConfig): ConfiguredPatchDefinition
        {
            return new ConfiguredPatchDefinition(this.PatchIdName, config,

                // ____________________________________________________________________________________________________
                //
                //     Patch
                // ____________________________________________________________________________________________________
                //

                (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node, detectionInfoData: any) =>
                {
                    let tnode: ts.Block = detectionInfoData.TypedNode; // the function body block where we will insert the hook function call
                    let statementToInsertAfter: ts.Statement = detectionInfoData.StatementToInsertAfter; // e.g.  n && (delete n.SESSIONID, Object.assign(r.De, n), (t.config = !0));
                    let configObjectAccess: ts.Expression = detectionInfoData.ConfigObjectAccess; // e.g.  r.De

                    let insertIndex = tnode.statements.indexOf(statementToInsertAfter) + 1;

                    let hookCall: ts.Statement = context.factory.createExpressionStatement(
                        context.factory.createCallExpression(
                            context.factory.createIdentifier(config.HookMethodIdentifierExpression),
                            null,
                            [ // arguments to hook function
                                configObjectAccess,
                            ]
                        )
                    )

                    let newStatements: ts.Statement[] = tnode.statements.slice();
                    newStatements.splice(insertIndex, 0, hookCall);

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
                        if (node.kind == ts.SyntaxKind.Block) // expected function's block of body statements
                        {
                            /* e.g. (8601984)
                                function d(e = a) {
					                const t = {},
						                n = m("config", e);
					                n && (delete n.SESSIONID, Object.assign(r.De, n), (t.config = !0));
					                const i = m("userinfo", e);
					                i && (Object.assign(r.L7, i), (t.userConfig = !0), r.L7.is_support && _() && (r.L7.is_support = !1));
					                const o = m("broadcast", e);
					                o && (Object.assign(r.dk, o), (t.broadcastConfig = !0));
					                const s = m("community", e);
					                s && (Object.assign(r.JA, s), (t.communityConfig = !0));
					                const l = m("event", e);
					                return l && (Object.assign(r.Wj, l), (t.eventConfig = !0)), t;
				                }
                            */
                            let tnode = node as ts.Block;

                            if (tnode.statements.length <= 15) // 10 statements in 8601984, +5 for wiggle room
                            {
                                if (tnode.end - tnode.pos < 700) // entire body is 548 characters long in 8601984, +extra for wiggle room
                                {
                                    let js = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, tnode, sourceFile);

                                    // Gather expected child nodes to verify of limited criteria
                                    let validateNodes = AstGetAllChildNodes(tnode,
                                        // Node filter callback
                                        (n: ts.Node): boolean =>
                                        {
                                            return ( // only gather the expected nodes we want to validate
                                                n.kind == ts.SyntaxKind.CallExpression ||
                                                n.kind == ts.SyntaxKind.StringLiteral ||
                                                n.kind == ts.SyntaxKind.Identifier
                                            )
                                        },
                                        // Recursion cull callback
                                        null,
                                        // Maximum depth
                                        10, // The expected nodes we will try to validate are only up to 8 layers deep; +10 for wiggle room
                                    );

                                    if (validateNodes.length > 0)
                                    {
                                        // Expectations in the gathered nodes
                                        let matchConfigStringLiteral: boolean = false; // "config"  from  const t = {}, n = m("config", e);
                                        let matchSessionidIdentifier: boolean = false; // n.SESSIONID  from  n && (delete n.SESSIONID, Object.assign(r.De, n), (t.config = !0));
                                        let statementToInsertAfter: ts.Statement;
                                        let propertyAccessToConfigObject: ts.Expression; // r.De

                                        for (let checkNode of validateNodes)
                                        {
                                            if (checkNode.kind == ts.SyntaxKind.StringLiteral && (checkNode as ts.StringLiteral).text == "config")
                                            {
                                                matchConfigStringLiteral = true;
                                            }
                                            else if (checkNode.kind == ts.SyntaxKind.Identifier && (checkNode as ts.Identifier).escapedText == "SESSIONID")
                                            {
                                                matchSessionidIdentifier = true;
                                                statementToInsertAfter = AstFindFirstAncestor(checkNode, ts.SyntaxKind.ExpressionStatement) as ts.Statement; // get the statement this node is from
                                            }
                                            else if (checkNode.kind == ts.SyntaxKind.CallExpression) // e.g.  Object.assign(r.De, n)
                                            {
                                                let methodCall = checkNode as ts.CallExpression;
                                                if (methodCall.expression.kind == ts.SyntaxKind.PropertyAccessExpression)
                                                {
                                                    let methodAccess = methodCall.expression as ts.PropertyAccessExpression;
                                                    if (   methodAccess.expression.kind == ts.SyntaxKind.Identifier && (methodAccess.expression as ts.Identifier).escapedText == "Object"
                                                        && methodAccess.name.kind == ts.SyntaxKind.Identifier && (methodAccess.name as ts.Identifier).escapedText == "assign") // Object.assign
                                                    {
                                                        propertyAccessToConfigObject = methodCall.arguments[0]; // first argument to Object.assign is r.De which is the parsed json object
                                                    }
                                                }
                                            }

                                            if (matchSessionidIdentifier && matchSessionidIdentifier && propertyAccessToConfigObject != null)
                                            {
                                                // Highly likely match
                                                return new DetectionInfo(true, {
                                                    "TypedNode": tnode,
                                                    "StatementToInsertAfter": statementToInsertAfter,
                                                    "ConfigObjectAccess": propertyAccessToConfigObject,
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
