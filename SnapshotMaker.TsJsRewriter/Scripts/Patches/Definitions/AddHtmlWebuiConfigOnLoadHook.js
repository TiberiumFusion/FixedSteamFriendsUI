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
            var AddHtmlWebuiConfigOnLoadHookCPDF = (function (_super) {
                __extends(AddHtmlWebuiConfigOnLoadHookCPDF, _super);
                function AddHtmlWebuiConfigOnLoadHookCPDF() {
                    var _this = _super !== null && _super.apply(this, arguments) || this;
                    _this.PatchIdName = "AddHtmlWebuiConfigOnLoadHook";
                    return _this;
                }
                AddHtmlWebuiConfigOnLoadHookCPDF.prototype.CreatePatchDefinition = function (config) {
                    return new Patches.ConfiguredPatchDefinition(this.PatchIdName, config, function (context, sourceFile, node, detectionInfoData) {
                        var tnode = detectionInfoData.TypedNode;
                        var statementToInsertAfter = detectionInfoData.StatementToInsertAfter;
                        var configObjectAccess = detectionInfoData.ConfigObjectAccess;
                        var insertIndex = tnode.statements.indexOf(statementToInsertAfter) + 1;
                        var hookCall = context.factory.createExpressionStatement(context.factory.createCallExpression(context.factory.createIdentifier(config.HookMethodIdentifierExpression), null, [
                            configObjectAccess,
                        ]));
                        var newStatements = tnode.statements.slice();
                        newStatements.splice(insertIndex, 0, hookCall);
                        return context.factory.updateBlock(tnode, newStatements);
                    }, [
                        function (context, sourceFile, node) {
                            if (node.kind == ts.SyntaxKind.Block) {
                                var tnode = node;
                                if (tnode.statements.length <= 15) {
                                    if (tnode.end - tnode.pos < 700) {
                                        var js = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, tnode, sourceFile);
                                        var validateNodes = Patches.AstGetAllChildNodes(tnode, function (n) {
                                            return (n.kind == ts.SyntaxKind.CallExpression ||
                                                n.kind == ts.SyntaxKind.StringLiteral ||
                                                n.kind == ts.SyntaxKind.Identifier);
                                        }, null, 10);
                                        if (validateNodes.length > 0) {
                                            var matchConfigStringLiteral = false;
                                            var matchSessionidIdentifier = false;
                                            var statementToInsertAfter = void 0;
                                            var propertyAccessToConfigObject = void 0;
                                            for (var _i = 0, validateNodes_1 = validateNodes; _i < validateNodes_1.length; _i++) {
                                                var checkNode = validateNodes_1[_i];
                                                if (checkNode.kind == ts.SyntaxKind.StringLiteral && checkNode.text == "config") {
                                                    matchConfigStringLiteral = true;
                                                }
                                                else if (checkNode.kind == ts.SyntaxKind.Identifier && checkNode.escapedText == "SESSIONID") {
                                                    matchSessionidIdentifier = true;
                                                    statementToInsertAfter = Patches.AstFindFirstAncestor(checkNode, ts.SyntaxKind.ExpressionStatement);
                                                }
                                                else if (checkNode.kind == ts.SyntaxKind.CallExpression) {
                                                    var methodCall = checkNode;
                                                    if (methodCall.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
                                                        var methodAccess = methodCall.expression;
                                                        if (methodAccess.expression.kind == ts.SyntaxKind.Identifier && methodAccess.expression.escapedText == "Object"
                                                            && methodAccess.name.kind == ts.SyntaxKind.Identifier && methodAccess.name.escapedText == "assign") {
                                                            propertyAccessToConfigObject = methodCall.arguments[0];
                                                        }
                                                    }
                                                }
                                                if (matchSessionidIdentifier && matchSessionidIdentifier && propertyAccessToConfigObject != null) {
                                                    return new Patches.DetectionInfo(true, {
                                                        "TypedNode": tnode,
                                                        "StatementToInsertAfter": statementToInsertAfter,
                                                        "ConfigObjectAccess": propertyAccessToConfigObject,
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
                return AddHtmlWebuiConfigOnLoadHookCPDF;
            }(Patches.ConfiguredPatchDefinitionFactory));
            Definitions.AddHtmlWebuiConfigOnLoadHookCPDF = AddHtmlWebuiConfigOnLoadHookCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
