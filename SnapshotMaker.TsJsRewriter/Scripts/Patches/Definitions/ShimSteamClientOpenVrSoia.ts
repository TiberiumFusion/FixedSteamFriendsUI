// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Compat shim for SteamClient.OpenVR.SetOverlayInteractionAffordance()
/*    

    ----- Targets -----

    1.  (8601984: line 47615)
        o.OpenVR.SetOverlayInteractionAffordance(t, s)
      =>
        TFP.Compat.SteamClient_OpenVR_SetOverlayInteractionAffordance(o, t, s)
        
    2.  (8811541: line 46841)
        (null === (r = null === (o = null === (i = e.ownerDocument.defaultView) || void 0 === i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.OpenVR) || void 0 === r || r.SetOverlayInteractionAffordance(t, l))
      =>
        (null === (r = null === (o = null === (i = e.ownerDocument.defaultView) || void 0 === i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.OpenVR) || void 0 === r || TFP.Compat.SteamClient_OpenVR_SetOverlayInteractionAffordance(i.SteamClient, t, s))

    3.  (9097133: line 48039)
        r != o && e.ownerDocument.defaultView?.SteamClient?.OpenVR?.SetOverlayInteractionAffordance(t, r);
      =>
        r != o && TFP.Compat.SteamClient_OpenVR_SetOverlayInteractionAffordance(e.ownerDocument.defaultView?.SteamClient, t, r);

    
    ----- Notes -----
    
    First appeared in Valve javascript sometime between 8390683 and 8601984

    SetOverlayInteractionAffordance() is not present in the SteamClient.OpenVR subinterface created by the May 2023 client's friendsui.dll. It's unknown which client introduces this method, though it is likely to be the first pure-shit steam client or one of the updates between then and Dec 2023.

    Appears to be related to vr junk and has nothing to do with actual steam chat functionality.
    

    ----- Range -----

    Since: Sometime between 8390683 and 8601984.

    Until: At least 9097133.
            - Circa 8811541, Valve added a guard to accessing the OpenVR subinterface, and only for OpenVR. Zero guard for SetOverlayInteractionAffordance. This changed the call site from Target #1 to Target #2.
            - Circa 9097133, Valve stopped translating their ?. into rancid syntax and now simply keep the almost-as-rancid ?. operator. Still zero guard for SetOverlayInteractionAffordance. Call site is now changed to Target #3.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export interface ShimSteamClientOpenVrSoiaConfig
    {
        ShimMethodIdentifierExpression: string, // e.g.  "TFP.Compat.SteamClient_OpenVR_SetOverlayInteractionAffordance"
    }

    export class ShimSteamClientOpenVrSoiaCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "ShimSteamClientOpenVrSoia";

        CreatePatchDefinition(config: ShimSteamClientOpenVrSoiaConfig): PatchDefinition
        {
            return new ConfiguredPatchDefinition(this.PatchIdName, config,

                // ____________________________________________________________________________________________________
                //
                //     Patch
                // ____________________________________________________________________________________________________
                //

                (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node, detectionInfoData: any) =>
                {
                    // Common patch logic valid for all target sites

                    let tnode: ts.CallExpression = detectionInfoData.TypedNode;
                    // e.g.
                    // - Site 1:  o.OpenVR.SetOverlayInteractionAffordance(t, s)
                    // - Site 2:  r.SetOverlayInteractionAffordance(t, l)
                    // - Site 3:  e.ownerDocument.defaultView?.SteamClient?.OpenVR?.SetOverlayInteractionAffordance(t, r)

                    // Replace the call to the original method with a call to the shim function that receives the original arguments as well
                    let newArgs = tnode.arguments.slice();
                    newArgs.splice(0, 0, detectionInfoData.SteamClientPropertyAccess)

                    let patched = context.factory.updateCallExpression(tnode,
                        context.factory.createIdentifier(config.ShimMethodIdentifierExpression),
                        null,
                        newArgs,
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
                    //
                    // Target site 1
                    //
                    
                    (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node) =>
                    {
                        if (node.kind == ts.SyntaxKind.CallExpression) // e.g.  o.OpenVR.SetOverlayInteractionAffordance(t, s)
                        {
                            let tnode = node as ts.CallExpression;
                            // This is a chain of PropertyAccessExpressions, each nested in the reverse order of how it's typed in the js

                            if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  o.OpenVR.SetOverlayInteractionAffordance
                            {
                                let memberToCall = tnode.expression as ts.PropertyAccessExpression;
                                let memberToCallJs = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, memberToCall, sourceFile);
                                if (memberToCallJs.endsWith(".OpenVR.SetOverlayInteractionAffordance"))
                                {
                                    // Highly likely match
                                    let steamClientPropertyAccess = (memberToCall.expression as ts.PropertyAccessExpression).expression;
                                    return new DetectionInfo(true, {
                                        "Location": 1,
                                        "TypedNode": tnode,
                                        "SteamClientPropertyAccess": steamClientPropertyAccess,
                                    });
                                }
							}
                        }
                    },

                    //
                    // Target site 2
                    //

                    (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node) =>
                    {
                        // Adapted from ShimSteamClientBrowserGetBrowserIdCheck

                        if (node.kind == ts.SyntaxKind.CallExpression) // e.g. r.SetOverlayInteractionAffordance(t, l)
                        {
                            let tnode = node as ts.CallExpression;

                            // Validate name of function call
                            if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g. r.SetOverlayInteractionAffordance
                            {
                                let memberToCallAccess = tnode.expression as ts.PropertyAccessExpression;
                                if (memberToCallAccess.name.kind == ts.SyntaxKind.Identifier && (memberToCallAccess.name as ts.Identifier).escapedText == "SetOverlayInteractionAffordance")
                                {
                                    // Validate hideous conditional chain this call is at the very end of
                                    let paren = AstFindFirstAncestor(tnode, ts.SyntaxKind.ParenthesizedExpression, 20);// I didn't bother counting but it looks like ~20 layers from here to the root
                                    if (paren != null) // e.g.  (null === (r = null === (o = null === (i = e.ownerDocument.defaultView) || void 0 === i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.OpenVR) || void 0 === r || r.SetOverlayInteractionAffordance(t, l))
                                    {
                                        // Validate character length in the parenthesized expression
                                        let parenNodeLength = paren.end - paren.pos;
                                        if (parenNodeLength < 250) // in 8811541, our expected js is 208 characters long, so we use 250 for wiggle room
                                        {
                                            // Everything from here could be SLOOOOOOW!! (i.e. on large non-matching node)
                                            //console.log("SLOW WARNING ON NODE", tnode, JsEmitPrinter.printNode(ts.EmitHint.Unspecified, tnode, sourceFile));

                                            // Gather all child nodes up to a maximum depth. We will look for expected properties and js strings in these nodes.
                                            let childNodes = AstGetAllChildNodes(paren,
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
                                                20,
                                            );

                                            //console.log("- Child node gather count: ", childNodes.length);
                                            //console.log("- Child nodes: ", childNodes);

                                            if (childNodes.length > 0)
                                            {
                                                // Expectations in the child nodes
                                                let matchedTernarySteamClientPaths: boolean = false; // the true & false paths in  ... ? void 0 : i.SteamClient
                                                let matchedTernaryOpenVrPaths: boolean = false; // the true & false paths in  ... ? void 0 : o.OpenVR

                                                let steamClientPropertyAccess: ts.Expression; // Expression which accesses i.SteamClient, which is passed as an argument to the shim method

                                                for (let childNode of childNodes)
                                                {
                                                    if (childNode.kind == ts.SyntaxKind.ConditionalExpression)
                                                    {
                                                        let childNodeTyped = childNode as ts.ConditionalExpression;
                                                        // Any of:
                                                        //  null === (i = e.ownerDocument.defaultView) || void 0 === i ? void 0 : i.SteamClient
                                                        //  null === (o = null === (i = e.ownerDocument.defaultView) || void 0 === i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.OpenVR

                                                        if (childNodeTyped.whenTrue.kind == ts.SyntaxKind.VoidExpression) // void 0
                                                        {
                                                            // All relevant ternaries have void 0 in their true path and a property access expression in their false path
                                                            if (childNodeTyped.whenFalse.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  i.SteamClient
                                                            {
                                                                let falsePath = childNodeTyped.whenFalse;

                                                                let falsePathJs: string = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, falsePath, sourceFile);
                                                                if (falsePathJs.includes(".SteamClient"))
                                                                {
                                                                    matchedTernarySteamClientPaths = true;
                                                                    steamClientPropertyAccess = falsePath;
                                                                }
                                                                else if (falsePathJs.includes(".OpenVR"))
                                                                {
                                                                    matchedTernaryOpenVrPaths = true;
                                                                }

                                                                if (matchedTernarySteamClientPaths && matchedTernaryOpenVrPaths)
                                                                {
                                                                    // Highly likely match
                                                                    return new DetectionInfo(true, {
                                                                        "Location": 2,
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
                    },
                    
                    //
                    // Target site 3
                    //
                    
                    (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node) =>
                    {
                        if (node.kind == ts.SyntaxKind.CallExpression) // e.g.  e.ownerDocument.defaultView?.SteamClient?.OpenVR?.SetOverlayInteractionAffordance(t, r)
                        {
                            let tnode = node as ts.CallExpression;
                            // This is a chain of PropertyAccessExpressions, each nested in the reverse order of how it's typed in the js

                            if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  e.ownerDocument.defaultView?.SteamClient?.OpenVR?.SetOverlayInteractionAffordance
                            {
                                let memberToCall = tnode.expression as ts.PropertyAccessExpression;
                                let memberToCallJs = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, memberToCall, sourceFile);
                                if (memberToCallJs.endsWith(".OpenVR?.SetOverlayInteractionAffordance"))
                                {
                                    // Highly likely match
                                    let steamClientPropertyAccess = (memberToCall.expression as ts.PropertyAccessExpression).expression;
                                    return new DetectionInfo(true, {
                                        "Location": 3,
                                        "TypedNode": tnode,
                                        "SteamClientPropertyAccess": steamClientPropertyAccess,
                                    });
                                }
							}
                        }
                    },

                ],

            );
        }
    }
    
}
