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
            var RewriteScRpBCanCreateInviteForGameCallCPDF = (function (_super) {
                __extends(RewriteScRpBCanCreateInviteForGameCallCPDF, _super);
                function RewriteScRpBCanCreateInviteForGameCallCPDF() {
                    var _this = _super !== null && _super.apply(this, arguments) || this;
                    _this.PatchIdName = "RewriteScRpBCanCreateInviteForGameCall";
                    return _this;
                }
                RewriteScRpBCanCreateInviteForGameCallCPDF.prototype.CreatePatchDefinition = function () {
                    return new Patches.PatchDefinition(this.PatchIdName, function (context, sourceFile, node, detectionInfoData) {
                        var tnode = detectionInfoData.TypedNode;
                        var patched = context.factory.createCallExpression(tnode.expression, tnode.typeArguments, [tnode.arguments[0]]);
                        if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                            ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                        return patched;
                    }, [
                        function (context, sourceFile, node) {
                            if (node.kind == ts.SyntaxKind.CallExpression) {
                                var tnode = node;
                                if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
                                    var methodAccess = tnode.expression;
                                    if (methodAccess.name.kind == ts.SyntaxKind.Identifier && methodAccess.name.escapedText == "BCanCreateInviteForGame") {
                                        if (methodAccess.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
                                            var methodOwnerAccess = methodAccess.expression;
                                            if (methodOwnerAccess.name.kind == ts.SyntaxKind.Identifier && methodOwnerAccess.name.escapedText == "RemotePlay") {
                                                if (tnode.arguments.length == 2) {
                                                    return new Patches.DetectionInfo(true, {
                                                        "TypedNode": tnode,
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    ]);
                };
                return RewriteScRpBCanCreateInviteForGameCallCPDF;
            }(Patches.ConfiguredPatchDefinitionFactory));
            Definitions.RewriteScRpBCanCreateInviteForGameCallCPDF = RewriteScRpBCanCreateInviteForGameCallCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
