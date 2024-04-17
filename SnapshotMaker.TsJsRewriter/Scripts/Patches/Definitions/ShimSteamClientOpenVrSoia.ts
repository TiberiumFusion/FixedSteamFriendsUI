// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Compat shim for SteamClient.OpenVR.SetOverlayInteractionAffordance()
/*    

    ----- Target Examples -----

    1.  o.OpenVR.SetOverlayInteractionAffordance(t, s)
      =>
        TFP.Compat.SteamClient_OpenVR_SetOverlayInteractionAffordance(o, t, s)

    
    ----- Notes -----
    
    First appeared in Valve javascript sometime between 8390683 and 8601984

    SetOverlayInteractionAffordance() and in fact the entire OpenVR subinterface are not present in the injected interface created by the May 2023 client's friendsui.dll. It's unknown which client introduces this method, though it is likely to be the first pure-shit steam client or one of the updates between then and Dec 2023.

    Appears to be related to vr junk and has nothing to do with actual steam chat functionality.

    
    ----- Range -----

    Since: Sometime between 8390683 and 8601984.

    Until: Sometime between 8601984 and 8811541.
           - Circa 8811541, Valve added a guard to accessing the OpenVR subinterface, and only for OpenVR. Zero guard for SetOverlayInteractionAffordance. It seems likely that SetOverlayInteractionAffordance is part of RTM OpenVR.

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
                    let tnode: ts.CallExpression = detectionInfoData.TypedNode; // e.g.  o.OpenVR.SetOverlayInteractionAffordance(t, s)

                    // Replace the call to the original method with a call to the shim function that receives the original arguments as well
                    let patched = context.factory.updateCallExpression(tnode,
                        context.factory.createIdentifier(config.ShimMethodIdentifierExpression),
                        tnode.typeArguments,
                        tnode.arguments
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
                                    return new DetectionInfo(true, {
                                        "TypedNode": tnode,
                                    });
                                }
							}
                        }
                    }
                ],

            );
        }
    }
    
}
