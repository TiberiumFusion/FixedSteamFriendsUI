// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Compat shim for SettingsStore.IsSteamInTournamentMode()
//
//    Examples:
//      1.  let e = I.Ul.ParentalStore.BIsFriendsBlocked() || I.Ul.SettingsStore.IsSteamInTournamentMode();
//       -> let e = I.Ul.ParentalStore.BIsFriendsBlocked() || TFP.Compat.SettingsStore_IsSteamInTournamentMode(I.Ul.SettingsStore);
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/*  -- Notes --
    
    Valve inability to call SettingsStore.IsSteamInTournamentMode() properly is the specific fuckup that required the creation of the entire FixedSteamFriendsUI project.
    Valve tries to call IsSteamInTournamentMode() on two objects (sometimes incorrectly), neither of which exist outside of the sharedjscontext abomination in the pure-shit steam clients.
    
    This is resolved by shimming each call site with a wrapper that ensures a valid return without exceptions.

*/


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export interface ShimSettingsStoreIsSteamInTournamentModeConfig
    {
        ShimMethodIdentifierExpression: string, // e.g.  "TFP.Compat.SettingsStore_IsSteamInTournamentMode"
        TargetFinalQualifier: string, // e.g.  "SettingsStore"
        TargetFinalIdentifier: string, // e.g.  "IsSteamInTournamentMode"
    }

    export class ShimSettingsStoreIsSteamInTournamentModeCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "ShimSettingsStoreIsSteamInTournamentMode";

        CreatePatchDefinition(config: ShimSettingsStoreIsSteamInTournamentModeConfig): PatchDefinition
        {
            return new PatchDefinition(this.PatchIdName,

                // ____________________________________________________________________________________________________
                //
                //     Patch
                // ____________________________________________________________________________________________________
                //

                (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node, detectionInfoData: any) =>
                {
                    let tnode: ts.CallExpression = detectionInfoData.TypedNode; // e.g.  b.Ul.SettingsStore.IsSteamInTournamentMode()
                    let nameOfMemberToCall: string = detectionInfoData.NameOfMemberToCallAccessNode; // e.g.  "IsSteamInTournamentMode"
                    let ownerOfMemberToCall: ts.CallExpression = detectionInfoData.OwnerOfMemberToCallAccessNode; // e.g.  b.Ul.SettingsStore

                    // Replace the original call expression with a new call expression to a shim site that takes 1) the name of original member to call and 2) its owner as arguments
                    let patched = context.factory.createCallExpression(
                        context.factory.createIdentifier(config.ShimMethodIdentifierExpression),
                        null,
                        [ // arguments
                            ownerOfMemberToCall,
                            context.factory.createStringLiteral(nameOfMemberToCall),
                        ]
                    ); // e.g.  TFP.Compat.SettingsStore_IsSteamInTournamentMode(b.Ul.SettingsStore, "IsSteamInTournamentMode")

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
                        if (node.kind == ts.SyntaxKind.CallExpression) // e.g.  b.Ul.SettingsStore.IsSteamInTournamentMode()
                        {
                            let tnode = node as ts.CallExpression;
                            // This is chain of PropertyAccessExpressions, each nested in the reverse order of how it's typed in the js

                            // Validate the .IsSteamInTournamentMode() call at the end of the expression
                            if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  b.Ul.SettingsStore.IsSteamInTournamentMode
                            {
                                let memberToCall = tnode.expression as ts.PropertyAccessExpression;
                                if (memberToCall.name.kind == ts.SyntaxKind.Identifier) // e.g.  IsSteamInTournamentMode
                                {
                                    let memberToCallName = memberToCall.name as ts.Identifier;
                                    if (memberToCallName.escapedText == config.TargetFinalIdentifier)
                                    {
                                        // Validate the SettingsStore object upon which .IsSteamInTournamentMode is accessed and called
                                        if (memberToCall.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  b.Ul.SettingsStore
                                        {
                                            let memberOwner = memberToCall.expression as ts.PropertyAccessExpression;
                                            if (memberOwner.name.kind == ts.SyntaxKind.Identifier) // e.g.  SettingsStore
                                            {
                                                let memberOwnerName = memberOwner.name as ts.Identifier;
                                                if (memberOwnerName.escapedText == config.TargetFinalQualifier)
                                                {
                                                    // Match: the end of the root (tnode) expression is: .SettingsStore.IsSteamInTournamentMode() (or whatever config.TargetFinalQualifier/Identifier are configured to)
                                                    return new DetectionInfo(true, {
                                                        "TypedNode": tnode,
                                                        "NameOfMemberToCallAccessNode": memberToCallName.escapedText, // "IsSteamInTournamentMode"
                                                        "OwnerOfMemberToCallAccessNode": memberOwner, // b.Ul.SettingsStore
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
