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
            var ShimSteamClientBrowserGetBrowserIdCPDF = (function (_super) {
                __extends(ShimSteamClientBrowserGetBrowserIdCPDF, _super);
                function ShimSteamClientBrowserGetBrowserIdCPDF() {
                    var _this = _super !== null && _super.apply(this, arguments) || this;
                    _this.PatchIdName = "ShimSteamClientBrowserGetBrowserId";
                    return _this;
                }
                ShimSteamClientBrowserGetBrowserIdCPDF.prototype.CreatePatchDefinition = function (config) {
                    return new Patches.ConfiguredPatchDefinition(this.PatchIdName, config, function (context, sourceFile, node, detectionInfoData) {
                        var tnode = detectionInfoData.TypedNode;
                        var steamClientAccessExpression = detectionInfoData.SteamClientAccessExpression;
                        var patched = context.factory.createCallExpression(context.factory.createIdentifier(config.ShimMethodIdentifierExpression), null, [
                            steamClientAccessExpression,
                        ]);
                        if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                            ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                        return patched;
                    }, [
                        function (context, sourceFile, node) {
                            if (node.kind == ts.SyntaxKind.CallExpression) {
                                var tnode = node;
                                if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
                                    var methodToCall = tnode.expression;
                                    if (methodToCall.name.kind == ts.SyntaxKind.Identifier) {
                                        var memberToCallName = methodToCall.name;
                                        if (memberToCallName.escapedText == "GetBrowserID") {
                                            if (methodToCall.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
                                                var methodOwner = methodToCall.expression;
                                                if (methodOwner.name.kind == ts.SyntaxKind.Identifier) {
                                                    var steamClientAccess = void 0;
                                                    if (methodOwner.expression.kind == ts.SyntaxKind.Identifier) {
                                                        var identifier = methodOwner.expression;
                                                        if (identifier.escapedText == "SteamClient")
                                                            steamClientAccess = identifier;
                                                    }
                                                    else if (methodOwner.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
                                                        var methodOwnerOwner = methodOwner.expression;
                                                        if (methodOwnerOwner.name.kind == ts.SyntaxKind.Identifier) {
                                                            var identifier = methodOwnerOwner.name;
                                                            if (identifier.escapedText == "SteamClient")
                                                                steamClientAccess = methodOwnerOwner;
                                                        }
                                                    }
                                                    if (steamClientAccess != null) {
                                                        return new Patches.DetectionInfo(true, {
                                                            "TypedNode": tnode,
                                                            "SteamClientAccessExpression": steamClientAccess,
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
                return ShimSteamClientBrowserGetBrowserIdCPDF;
            }(Patches.ConfiguredPatchDefinitionFactory));
            Definitions.ShimSteamClientBrowserGetBrowserIdCPDF = ShimSteamClientBrowserGetBrowserIdCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
