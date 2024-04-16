// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Compat shim for SteamClient.Browser.GetBrowserID()
//
//    Examples:
//      1.  n.SteamClient.Browser.GetBrowserID()
//       -> TFP.Compat.SteamClient_Browser_GetBrowserID(n.SteamClient)
//      2.  n.SteamClient.Window.GetBrowserID()
//       -> TFP.Compat.SteamClient_Browser_GetBrowserID(n.SteamClient)
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*  -- Notes --
    
    SteamClient.Window.GetBrowserID() and SteamClient.Browser.GetBrowserID() both do (presumably) the same thing.
    The Window version was used by steam-chat.com until May 2023 or earlier, when it was replaced by the Browser version.

    This reflects a change in the Steam client.
    - The Dec 2022 steam client includes the Window version on its injected SteamClient object.
    - The May 2023 steam client includes the Browser version on its injected SteamClient object.

    To support the Dec 2022 client and others like it, we insert a shim in place of the original call, which will defer to calling GetBrowserID() on the appropriate SteamClient.* interface.

*/


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export interface ShimSteamClientBrowserGetBrowserIdConfig
    {
        ShimMethodIdentifierExpression: string, // e.g.  "TFP.Compat.SteamClient_Browser_GetBrowserID"
    }

    export class ShimSteamClientBrowserGetBrowserIdCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "ShimSteamClientBrowserGetBrowserId";

        CreatePatchDefinition(config: ShimSteamClientBrowserGetBrowserIdConfig): PatchDefinition
        {
            return new PatchDefinition(this.PatchIdName,

                // ____________________________________________________________________________________________________
                //
                //     Patch
                // ____________________________________________________________________________________________________
                //

                (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node, detectionInfoData: any) =>
                {
                    let tnode: ts.CallExpression = detectionInfoData.TypedNode; // e.g.  SteamClient.Browser.GetBrowserID()

                    let steamClientAccessExpression: ts.Expression = detectionInfoData.SteamClientAccessExpression; // e.g.  SteamClient  or  n.SteamClient

                    // Replace the original call expression with a new call expression to a shim site that takes the SteamClient access node
                    let patched = context.factory.createCallExpression(
                        context.factory.createIdentifier(config.ShimMethodIdentifierExpression),
                        null,
                        [ // arguments
                            steamClientAccessExpression,
                        ]
                    ); // e.g.  TFP.Compat.SteamClient_Browser_GetBrowserID(SteamClient)  or  TFP.Compat.SteamClient_Browser_GetBrowserID(n.SteamClient)
                    
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
                        if (node.kind == ts.SyntaxKind.CallExpression) // e.g.  n.SteamClient.Browser.GetBrowserID()
                        {
                            let tnode = node as ts.CallExpression;
                            // This is a chain of PropertyAccessExpressions, each nested in the reverse order of how it's typed in the js

                            if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  n.SteamClient.Browser.GetBrowserID
                            {
                                let methodToCall = tnode.expression as ts.PropertyAccessExpression;
                                if (methodToCall.name.kind == ts.SyntaxKind.Identifier) // e.g.  GetBrowserID
                                {
                                    let memberToCallName = methodToCall.name as ts.Identifier;
                                    if (memberToCallName.escapedText == "GetBrowserID")
                                    {
                                        if (methodToCall.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  n.SteamClient.Browser
                                        {
                                            let methodOwner = methodToCall.expression as ts.PropertyAccessExpression;

                                            if (methodOwner.name.kind == ts.SyntaxKind.Identifier) // e.g.  Browser
                                            {
                                                // Valve likes accessing SteamClients on other objects, so there is a mix of code accessing the window-bound SteamClient and code accessing another window's SteamClient
                                                // This produces differing AST, since the front-most object in the js (leaf-most node in the AST) will be either an Identifier (SteamClient) or a PropertyAccessExpression (n.SteamClient)
                                                let steamClientAccess: ts.Expression;

                                                if (methodOwner.expression.kind == ts.SyntaxKind.Identifier) // e.g.  SteamClient
                                                {
                                                    let identifier = methodOwner.expression as ts.Identifier;
                                                    if (identifier.escapedText == "SteamClient")
                                                        steamClientAccess = identifier;
                                                }

                                                else if (methodOwner.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  n.SteamClient
                                                {
                                                    let methodOwnerOwner = methodOwner.expression as ts.PropertyAccessExpression;
                                                    if (methodOwnerOwner.name.kind == ts.SyntaxKind.Identifier)
                                                    {
                                                        let identifier = methodOwnerOwner.name as ts.Identifier;
                                                        if (identifier.escapedText == "SteamClient")
                                                            steamClientAccess = methodOwnerOwner;
                                                    }
                                                }

                                                if (steamClientAccess != null)
                                                {
                                                    return new DetectionInfo(true, {
                                                        "TypedNode": tnode,
                                                        "SteamClientAccessExpression": steamClientAccess, // SteamClient or n.SteamClient
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
