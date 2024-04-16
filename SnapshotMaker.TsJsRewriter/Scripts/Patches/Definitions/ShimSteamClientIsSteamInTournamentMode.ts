// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Compat shim for SteamClient.System.IsSteamInTournamentMode()
/*    

    ----- Target Examples -----

    1.  SteamClient.System.IsSteamInTournamentMode().then((e) => (this.m_bSteamIsInTournamentMode = e))
      =>
        TFP.Compat.SteamClient_System_IsSteamInTournamentMode(SteamClient, "System", "IsSteamInTournamentMode").then((e) => (this.m_bSteamIsInTournamentMode = e))

    
    ----- Notes -----
    
    Despite the identical name and usage pattern, this SteamClient.System.IsSteamInTournamentMode() is DIFFERENT from SettingsStore.IsSteamInTournamentMode().
    - The SettingsStore version is a normal function
    - The SteamClient.System version returns a promise

    Also, since the members of SteamClient (like .System) are not always real JS objects, it's safer to pass the SteamClient to the shim function (for it to make the .System deference itself) instead of passing SteamClient.System.
    Hence the need for two different IsSteamInTournamentMode patches.

    Refer to the other IsSteamInTournamentMode for more info.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export interface ShimSteamClientIsSteamInTournamentModeConfig
    {
        ShimMethodIdentifierExpression: string, // e.g.  "TFP.Compat.SteamClient_System_IsSteamInTournamentMode"
        SteamClientSubInterface: string, // e.g.  "System"
        SubInterfaceMemberToCall: string, // e.g.  "IsSteamInTournamentMode"
    }

    export class ShimSteamClientIsSteamInTournamentModeCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "ShimSteamClientIsSteamInTournamentMode";

        CreatePatchDefinition(config: ShimSteamClientIsSteamInTournamentModeConfig): PatchDefinition
        {
            return new PatchDefinition(this.PatchIdName,

                // ____________________________________________________________________________________________________
                //
                //     Patch
                // ____________________________________________________________________________________________________
                //

                (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node, detectionInfoData: any) =>
                {
                    let tnode: ts.CallExpression = detectionInfoData.TypedNode; // e.g.  SteamClient.System.IsSteamInTournamentMode()

                    let steamClientAccessExpression: ts.Expression = detectionInfoData.SteamClientAccessExpression; // e.g.  SteamClient
                    let subInterfaceName: string = detectionInfoData.SteamClientSubInterfaceName; // e.g.  "System"
                    let nameOfMemberToCall: string = detectionInfoData.SubInterfaceMemberToCall; // e.g.  "IsSteamInTournamentMode"

                    // Replace the original call expression with a new call expression to a shim site that takes the original member to call access expression exploded in parts
                    // The shim function must return a promise like the original
                    let patched = context.factory.createCallExpression(
                        context.factory.createIdentifier(config.ShimMethodIdentifierExpression),
                        null,
                        [ // arguments
                            steamClientAccessExpression,
                            context.factory.createStringLiteral(subInterfaceName),
                            context.factory.createStringLiteral(nameOfMemberToCall),
                        ]
                    ); // e.g.  TFP.Compat.SteamClient_System_IsSteamInTournamentMode(SteamClient, "System", "IsSteamInTournamentMode")
                    
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
                        if (node.kind == ts.SyntaxKind.CallExpression) // e.g.  SteamClient.System.IsSteamInTournamentMode()
                        {
                            let tnode = node as ts.CallExpression;
                            // This is a chain of PropertyAccessExpressions, each nested in the reverse order of how it's typed in the js

                            // Validate the .IsSteamInTournamentMode() call at the end of the expression
                            if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  SteamClient.System.IsSteamInTournamentMode
                            {
                                let memberToCall = tnode.expression as ts.PropertyAccessExpression;
                                if (memberToCall.name.kind == ts.SyntaxKind.Identifier) // e.g.  IsSteamInTournamentMode
                                {
                                    let memberToCallName = memberToCall.name as ts.Identifier;
                                    if (memberToCallName.escapedText == config.SubInterfaceMemberToCall)
                                    {
                                        // Validate "SteamClient.System" qualification to the .IsSteamInTournamentMode member is accessed and called
                                        if (memberToCall.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  SteamClient.System
                                        {
                                            let memberOwner = memberToCall.expression as ts.PropertyAccessExpression;
                                            if (   memberOwner.expression.kind == ts.SyntaxKind.Identifier // e.g.  SteamClient
                                                && memberOwner.name.kind == ts.SyntaxKind.Identifier) // e.g.  System
                                            {
                                                let memberOwnerOwnerName = memberOwner.expression as ts.Identifier;
                                                let memberOwnerName = memberOwner.name as ts.Identifier;
                                                if (memberOwnerOwnerName.escapedText == "SteamClient" && memberOwnerName.escapedText == config.SteamClientSubInterface)
                                                {
                                                    return new DetectionInfo(true, {
                                                        "TypedNode": tnode,
                                                        "SteamClientAccessExpression": memberOwnerOwnerName, // SteamClient
                                                        "SteamClientSubInterfaceName": memberOwnerName.escapedText, // "System"
                                                        "SubInterfaceMemberToCall": memberToCallName.escapedText, // "IsSteamInTournamentMode"
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
