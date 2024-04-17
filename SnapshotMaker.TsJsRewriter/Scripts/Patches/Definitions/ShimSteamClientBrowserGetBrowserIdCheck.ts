// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Compat shim for hideous existence check of SteamClient.Browser.GetBrowserID
/*    

    ----- Target -----

    1.  (null === (r = null === (o = null == i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.Browser) || void 0 === r ? void 0 : r.GetBrowserID)
      =>
        TFP.Compat.SteamClient_HasGetBrowserID(i.SteamClient)

    
    ----- Notes -----
    
    This dereference chain existence check pattern appears in multiple locations in Valve's bastardized js. It is most likely the result of Valve's minifier, though the original code could be just as rancid since this is Valve after all.

    Dissecting and patching the individual property access expressions, to patch individually, is an enormous amount of work. We are not doing that.
    Instead, we are going to identify and replace the entire thing. The replacement is a shim method which will conduct the same check, using sane javascript instead.

    This patch is required by the Dec 2022 client and others for which GetBrowserID exists on SteamClient.Window, not on SteamClient.Browser. Without this patch, steam-chat.com logic which guards the use GetBrowserID() behind this existence check will fail to use GetBrowserID(), breaking certain things.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export interface ShimSteamClientBrowserGetBrowserIdCheckConfig
    {
        ShimMethodIdentifierExpression: string, // e.g.  "TFP.Compat.SteamClient_HasGetBrowserID"
    }

    export class ShimSteamClientBrowserGetBrowserIdCheckCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "ShimSteamClientBrowserGetBrowserIdCheck";

        CreatePatchDefinition(config: ShimSteamClientBrowserGetBrowserIdCheckConfig): PatchDefinition
        {
            return new ConfiguredPatchDefinition(this.PatchIdName, config,

                // ____________________________________________________________________________________________________
                //
                //     Patch
                // ____________________________________________________________________________________________________
                //

                (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node, detectionInfoData: any) =>
                {
                    let tnode: ts.ParenthesizedExpression = detectionInfoData.TypedNode; // e.g.  (null === (r = null === (o = null == i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.Browser) || void 0 === r ? void 0 : r.GetBrowserID)
                    let steamClientAccess: ts.Expression = detectionInfoData.SteamClientPropertyAccess // e.g.  i.SteamClient

                    // Replace entire expression with shim method call
                    // - Note that the original expression includes a check to make sure that i.SteamClient is not null. Since we pass i.SteamClient to the shim method without any check, .SteamClient may be null, if it doesn't exist or is explicitly set to null. This is now the responsibility of the shim method to validate.

                    // Replace the call to the original method with a call to the shim function that receives the original arguments as well
                    let patched = context.factory.createCallExpression(
                        context.factory.createIdentifier(config.ShimMethodIdentifierExpression),
                        null,
                        [
                            steamClientAccess,
                        ]
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
                        if (node.kind == ts.SyntaxKind.ParenthesizedExpression) // e.g.  (null === (r = null === (o = null == i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.Browser) || void 0 === r ? void 0 : r.GetBrowserID)
                        {
                            let tnode = node as ts.ParenthesizedExpression;

                            // There are hordes of ParenthesizedExpressions in Valve's bastardized js. Some are short; some are exceedingly long. Stringifying each one for "".includes() tests may significantly impact ast traverse speed.

                            // The expected ParenthesizedExpression will have a ConditionalExpression as its immediate child
                            if (tnode.expression.kind == ts.SyntaxKind.ConditionalExpression)
                            {
                                let rootConditional = tnode.expression as ts.ConditionalExpression;

                                // Validating every node type of this 14-layer ast chunk is not code I want to write
                                // We will validate the immediate children of the conditional, then defer to more sweeping checks for the rest
                                if (   rootConditional.condition.kind == ts.SyntaxKind.BinaryExpression
                                    && rootConditional.whenTrue.kind == ts.SyntaxKind.VoidExpression
                                    && rootConditional.whenFalse.kind == ts.SyntaxKind.PropertyAccessExpression)
                                {
                                    // Validate the  r.GetBrowserID)  at the very end of the root conditional, which will filter out the vast majority of non-matches
                                    let rootFalsePath = rootConditional.whenFalse as ts.PropertyAccessExpression;
                                    if (rootFalsePath.expression.kind == ts.SyntaxKind.Identifier && rootFalsePath.name.kind == ts.SyntaxKind.Identifier) // r.GetBrowserID
                                    {
                                        let rootFalsePathAccessMemberName = rootFalsePath.name as ts.Identifier;
                                        if (rootFalsePathAccessMemberName.escapedText == "GetBrowserID")
                                        {
                                            // Validate character length in the source javascript string. The expected javascript is not outrageously long, so this will filter out the outrageously long ParenthesizedExpressions.
                                            let nodeLength = tnode.end - tnode.pos;
                                            if (nodeLength < 200) // in 8811541, our expected js is 146 characters long, so 200 is plenty of wiggle room for changing member names while still eliminating the massive non-matches
                                            {
                                                // Everything from here could be SLOOOOOOW!! (i.e. on large non-matching node)
                                                // We want to filter as much as possible before and during what's next: collecting 14 levels of child codes, stringifying them, and scanning them
                                                //console.log("SLOW WARNING ON NODE", tnode, JsEmitPrinter.printNode(ts.EmitHint.Unspecified, tnode, sourceFile));

                                                // Gather all child nodes up to a maximum depth. We will look for expected properties and js strings in these nodes.
                                                let childNodes = AstGetAllChildNodes(node,
                                                    // Filter node inclusion callback (nodes that will not be included in the output, but their children will still be recursed)
                                                    (n: ts.Node): boolean =>
                                                    {
                                                        // We are only interested in the node types we are evaluating in the loop over childNodes
                                                        return (
                                                            n.kind == ts.SyntaxKind.ConditionalExpression ||
                                                            n.kind == ts.SyntaxKind.VoidExpression ||
                                                            n.kind == ts.SyntaxKind.PropertyAccessExpression ||
                                                            n.kind == ts.SyntaxKind.Identifier
                                                        );
                                                    },
                                                    // Cull recursion callback (nodes that are not included in output and are not recursed)
                                                    (n: ts.Node): boolean =>
                                                    {
                                                        return (ts.isToken(n) == false);
                                                    },
                                                    // Maximum depth
                                                    14, // the expected js is 14 ast nodes deep
                                                );

                                                //console.log("- Child node gather count: ", childNodes.length);
                                                //console.log("- Child nodes: ", childNodes);

                                                if (childNodes.length > 0)
                                                {
                                                    // Expectations in the child nodes
                                                    let matchedTernarySteamClientPaths: boolean = false; // the true & false paths in  ... ? void 0 : i.SteamClient
                                                    let matchedTernaryBrowserPaths: boolean = false; // the true & false paths in  ... ? void 0 : o.Browser
                                                    let matchedTernaryBrowserIdPaths: boolean = false; // the true & false paths in  ... ? void 0 : r.GetBrowserID

                                                    let steamClientPropertyAccess: ts.Expression; // Expression which accesses i.SteamClient, which is passed as an argument to the shim method

                                                    for (let childNode of childNodes)
                                                    {
                                                        if (childNode.kind == ts.SyntaxKind.ConditionalExpression)
                                                        {
                                                            let childNodeTyped = childNode as ts.ConditionalExpression;
                                                            // Any of:
                                                            //  null == i ? void 0 : i.SteamClient
                                                            //  null === (o = null == i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.Browser
                                                            //  null === (r = null === (o = null == i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.Browser) || void 0 === r ? void 0 : r.GetBrowserID
                                                            // Note how each is nested in the ast in the reverse order of how a sane person would write this if they had to

                                                            if (childNodeTyped.whenTrue.kind == ts.SyntaxKind.VoidExpression) // void 0
                                                            {
                                                                // All 3 ternaries have void 0 in their true path and a property access expression in their false path
                                                                if (childNodeTyped.whenFalse.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  i.SteamClient
                                                                {
                                                                    let falsePath = childNodeTyped.whenFalse;

                                                                    let falsePathJs: string = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, falsePath, sourceFile);
                                                                    if (falsePathJs.includes(".SteamClient"))
                                                                    {
                                                                        matchedTernarySteamClientPaths = true;
                                                                        steamClientPropertyAccess = falsePath;
                                                                    }
                                                                    else if (falsePathJs.includes(".Browser"))
                                                                    {
                                                                        matchedTernaryBrowserPaths = true;
                                                                    }
                                                                    else if (falsePathJs.includes(".GetBrowserID"))
                                                                    {
                                                                        matchedTernaryBrowserIdPaths = true;
                                                                    }

                                                                    if (matchedTernarySteamClientPaths && matchedTernaryBrowserPaths && matchedTernaryBrowserIdPaths)
                                                                    {
                                                                        // Highly likely match
                                                                        return new DetectionInfo(true, {
                                                                            "TypedNode": tnode,
                                                                            "SteamClientPropertyAccess": steamClientPropertyAccess,
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
                    }
                ],

            );
        }
    }
    
}
