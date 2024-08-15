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
            var DisableContenthashGetParamOnFetchesCPDF = (function (_super) {
                __extends(DisableContenthashGetParamOnFetchesCPDF, _super);
                function DisableContenthashGetParamOnFetchesCPDF() {
                    var _this = _super !== null && _super.apply(this, arguments) || this;
                    _this.PatchIdName = "DisableContenthashGetParamOnFetches";
                    return _this;
                }
                DisableContenthashGetParamOnFetchesCPDF.prototype.CreatePatchDefinition = function () {
                    return new Patches.PatchDefinition(this.PatchIdName, function (context, sourceFile, node, detectionInfoData) {
                        if (detectionInfoData.Location == 1) {
                            var tnode = detectionInfoData.TypedNode;
                            var patched = context.factory.createStringLiteral(".js?_contenthash_=");
                            if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                                ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                            return patched;
                        }
                        else if (detectionInfoData.Location == 2) {
                            var tnode = detectionInfoData.TypedNode;
                            var patched = context.factory.createStringLiteral(".css?_contenthash_=");
                            if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                                ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                            return patched;
                        }
                    }, [
                        function (context, sourceFile, node) {
                            if (node.kind == ts.SyntaxKind.StringLiteral) {
                                var tnode = node;
                                if (tnode.text == ".js?contenthash=") {
                                    return new Patches.DetectionInfo(true, {
                                        "Location": 1,
                                        "TypedNode": tnode,
                                    });
                                }
                            }
                        },
                        function (context, sourceFile, node) {
                            if (node.kind == ts.SyntaxKind.StringLiteral) {
                                var tnode = node;
                                if (tnode.text == ".css?contenthash=") {
                                    return new Patches.DetectionInfo(true, {
                                        "Location": 2,
                                        "TypedNode": tnode,
                                    });
                                }
                            }
                        },
                    ]);
                };
                return DisableContenthashGetParamOnFetchesCPDF;
            }(Patches.ConfiguredPatchDefinitionFactory));
            Definitions.DisableContenthashGetParamOnFetchesCPDF = DisableContenthashGetParamOnFetchesCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
