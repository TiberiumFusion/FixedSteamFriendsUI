var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            var ShimSteamClientIsSteamInTournamentModeCPDF = (function (_super) {
                __extends(ShimSteamClientIsSteamInTournamentModeCPDF, _super);
                function ShimSteamClientIsSteamInTournamentModeCPDF() {
                    var _this = _super !== null && _super.apply(this, arguments) || this;
                    _this.PatchIdName = "ShimSteamClientIsSteamInTournamentMode";
                    return _this;
                }
                ShimSteamClientIsSteamInTournamentModeCPDF.prototype.CreatePatchDefinition = function (config) {
                    return new Patches.ConfiguredPatchDefinition(this.PatchIdName, config, function (context, sourceFile, node, detectionInfoData) {
                        var tnode = detectionInfoData.TypedNode;
                        var steamClientAccessExpression = detectionInfoData.SteamClientAccessExpression;
                        var subInterfaceName = detectionInfoData.SteamClientSubInterfaceName;
                        var nameOfMemberToCall = detectionInfoData.SubInterfaceMemberToCall;
                        var patched = context.factory.createCallExpression(context.factory.createIdentifier(config.ShimMethodIdentifierExpression), null, [
                            steamClientAccessExpression,
                            context.factory.createStringLiteral(subInterfaceName),
                            context.factory.createStringLiteral(nameOfMemberToCall),
                        ]);
                        if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                            ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                        return patched;
                    }, [
                        function (context, sourceFile, node) {
                            if (node.kind == ts.SyntaxKind.CallExpression) {
                                var tnode = node;
                                if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
                                    var memberToCall = tnode.expression;
                                    if (memberToCall.name.kind == ts.SyntaxKind.Identifier) {
                                        var memberToCallName = memberToCall.name;
                                        if (memberToCallName.escapedText == config.SubInterfaceMemberToCall) {
                                            if (memberToCall.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
                                                var memberOwner = memberToCall.expression;
                                                if (memberOwner.expression.kind == ts.SyntaxKind.Identifier
                                                    && memberOwner.name.kind == ts.SyntaxKind.Identifier) {
                                                    var memberOwnerOwnerName = memberOwner.expression;
                                                    var memberOwnerName = memberOwner.name;
                                                    if (memberOwnerOwnerName.escapedText == "SteamClient" && memberOwnerName.escapedText == config.SteamClientSubInterface) {
                                                        return new Patches.DetectionInfo(true, {
                                                            "TypedNode": tnode,
                                                            "SteamClientAccessExpression": memberOwnerOwnerName,
                                                            "SteamClientSubInterfaceName": memberOwnerName.escapedText,
                                                            "SubInterfaceMemberToCall": memberToCallName.escapedText,
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    ]);
                };
                return ShimSteamClientIsSteamInTournamentModeCPDF;
            }(Patches.ConfiguredPatchDefinitionFactory));
            Definitions.ShimSteamClientIsSteamInTournamentModeCPDF = ShimSteamClientIsSteamInTournamentModeCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
