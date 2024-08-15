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
            var FixBrokenIsMaximizedCopypastaCPDF = (function (_super) {
                __extends(FixBrokenIsMaximizedCopypastaCPDF, _super);
                function FixBrokenIsMaximizedCopypastaCPDF() {
                    var _this = _super !== null && _super.apply(this, arguments) || this;
                    _this.PatchIdName = "FixBrokenIsMaximizedCopypasta";
                    return _this;
                }
                FixBrokenIsMaximizedCopypastaCPDF.prototype.CreatePatchDefinition = function () {
                    return new Patches.PatchDefinition(this.PatchIdName, function (context, sourceFile, node, detectionInfoData) {
                        var tnode = detectionInfoData.TypedNode;
                        var patched = context.factory.updatePropertyAccessExpression(tnode, tnode.expression, context.factory.createIdentifier("IsWindowMaximized"));
                        if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                            ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                        return patched;
                    }, [
                        function (context, sourceFile, node) {
                            if (node.kind == ts.SyntaxKind.PropertyAccessExpression) {
                                var tnode = node;
                                if (tnode.parent != null && tnode.parent.kind == ts.SyntaxKind.BinaryExpression) {
                                    var andChainLast = tnode.parent;
                                    if (andChainLast.operatorToken.kind == ts.SyntaxKind.AmpersandAmpersandToken) {
                                        var methodNode = Patches.AstFindFirstAncestor(tnode, ts.SyntaxKind.MethodDeclaration);
                                        if (methodNode != null) {
                                            var methodTNode = methodNode;
                                            if (methodTNode.name.kind == ts.SyntaxKind.Identifier) {
                                                var methodTNodeName = methodTNode.name;
                                                if (methodTNodeName.escapedText == "IsMaximized") {
                                                    var js = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, tnode, sourceFile);
                                                    if (js == "this.m_popup.SteamClient.Window.IsWindowMinimized") {
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
                        }
                    ]);
                };
                return FixBrokenIsMaximizedCopypastaCPDF;
            }(Patches.ConfiguredPatchDefinitionFactory));
            Definitions.FixBrokenIsMaximizedCopypastaCPDF = FixBrokenIsMaximizedCopypastaCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
