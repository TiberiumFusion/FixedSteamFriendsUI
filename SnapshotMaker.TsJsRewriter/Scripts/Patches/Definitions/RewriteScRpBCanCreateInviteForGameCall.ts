// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Rewrite parameters on SteamClient.RemotePlay.BCanCreateInviteForGame(e, t) calls to old (e) single param
/*

    ----- Target Examples -----

    1.  (9097133: line 12946)
        return !!(0, E.Dp)("RemotePlay.BCanCreateInviteForGame") && SteamClient.RemotePlay.BCanCreateInviteForGame(e, t);
      =>
        return !!(0, E.Dp)("RemotePlay.BCanCreateInviteForGame") && SteamClient.RemotePlay.BCanCreateInviteForGame(e);

    
    ----- Notes -----
    
    Some time between prior to 9097133, Valve released a Steam client update which changed the signature of SteamClient.RemotePlay.BCanCreateInviteForGame() from one param to two params.
    Some time between 8825046 and 9097133, Valve updated steam-chat.com to always use this second parameter and never guard it.
    - Calling the bound BCanCreateInviteForGame interop function with the wrong number of arguments results in a message box to the user that is scary and blocks execution of FriendsUI until it is closed.
        - I've never that message box before. Presumably it is also used for invalid calls to other parts of the SteamClient interface.
    - This is the first clear-cut case of Valve invaliding their SteamClient API by breaking the signature & intent of an interop method.

    9097133 always passed a constant `true` to the new second parameter, which renders it meaningless and does not provide any clues to its purpose.

    Rewriting these calls to omit the superfluous parameter works fine, so that's what we're doing here.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export class RewriteScRpBCanCreateInviteForGameCallCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "RewriteScRpBCanCreateInviteForGameCall";

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
                    let tnode: ts.CallExpression = detectionInfoData.TypedNode; // e.g.  SteamClient.RemotePlay.BCanCreateInviteForGame(e, t)

                    // Strip all parameters after the first one
                    let patched = context.factory.createCallExpression(
                        tnode.expression,
                        tnode.typeArguments,
                        [ tnode.arguments[0] ]
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
                        if (node.kind == ts.SyntaxKind.CallExpression) // e.g.  SteamClient.RemotePlay.BCanCreateInviteForGame(e, t)
                        {
                            let tnode = node as ts.CallExpression;

                            // Validate method
                            if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  SteamClient.RemotePlay.BCanCreateInviteForGame
                            {
                                let methodAccess = tnode.expression as ts.PropertyAccessExpression;
                                if (methodAccess.name.kind == ts.SyntaxKind.Identifier && (methodAccess.name as ts.Identifier).escapedText == "BCanCreateInviteForGame")
                                {
                                    if (methodAccess.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  SteamClient.RemotePlay
                                    {
                                        let methodOwnerAccess = methodAccess.expression as ts.PropertyAccessExpression;
                                        if (methodOwnerAccess.name.kind == ts.SyntaxKind.Identifier && (methodOwnerAccess.name as ts.Identifier).escapedText == "RemotePlay")
                                        {
                                            // Validate params
                                            if (tnode.arguments.length == 2)
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
                ],

            );
        }
    }
    
}
