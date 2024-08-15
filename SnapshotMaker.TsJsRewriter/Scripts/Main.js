var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    SnapshotMakerTsJsRewriter.Version = "1.1.0.0";
    SnapshotMakerTsJsRewriter.EnableTraces = true;
    SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites = true;
    var ConfiguredPatchDefinitions = [];
    function DefinePatches(patchDefinitionsConfig) {
        SnapshotMakerTsJsRewriter.Patches.InitAllPatchDefinitionFactories();
        ConfiguredPatchDefinitions = [];
        patchDefinitionsConfig.Definitions.forEach(function (item) {
            var factory = SnapshotMakerTsJsRewriter.Patches.GetPatchDefinitionFactoryByIdName(item.IdName);
            if (factory == null) {
                SnapshotMakerTsJsRewriter.Trace("[!] Unknown patch IdName '" + item.IdName + "'. Patch cannot be built and will be skipped. [!]");
                return;
            }
            ConfiguredPatchDefinitions.push(factory.CreatePatchDefinition(item.Config));
        });
    }
    SnapshotMakerTsJsRewriter.DefinePatches = DefinePatches;
    var PatchJavascriptResult = (function () {
        function PatchJavascriptResult(patchDefinitions) {
            this.TotalVisitedNodes = 0;
            var appliedPatches = [];
            for (var _i = 0, patchDefinitions_1 = patchDefinitions; _i < patchDefinitions_1.length; _i++) {
                var patchDef = patchDefinitions_1[_i];
                appliedPatches.push({
                    IdName: patchDef.IdName,
                    Applications: [],
                });
            }
            this.AppliedPatches = appliedPatches;
            this.JavascriptString = "";
        }
        return PatchJavascriptResult;
    }());
    function PatchJavascript(inputJs) {
        var result = new PatchJavascriptResult(ConfiguredPatchDefinitions);
        var inputJsSourceFile = ts.createSourceFile("source.js", inputJs, ts.ScriptTarget.ES2015, true, ts.ScriptKind.JS);
        var totalVisitedNodes = 0;
        var totalPatchedNodes = 0;
        var megatron = function (context) {
            return function (sourceFile) {
                var visitor = function (node) {
                    totalVisitedNodes++;
                    for (var i = 0; i < ConfiguredPatchDefinitions.length; i++) {
                        var patchDefinition = ConfiguredPatchDefinitions[i];
                        var patchedNode = patchDefinition.DetectAndPatch(context, sourceFile, node);
                        if (patchedNode != null) {
                            totalPatchedNodes++;
                            var patchApplicationsInfo = result.AppliedPatches[i];
                            patchApplicationsInfo.Applications.push({
                                Location: sourceFile.getLineAndCharacterOfPosition(node.pos),
                                OriginalNode: node,
                                PatchedNode: patchedNode,
                            });
                            return patchedNode;
                        }
                    }
                    return ts.visitEachChild(node, visitor, context);
                };
                return ts.visitNode(sourceFile, visitor);
            };
        };
        var inputJsTransformResult = ts.transform(inputJsSourceFile, [megatron]);
        var transformedInputJsSourceFile = inputJsTransformResult.transformed[0];
        var outputJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printFile(transformedInputJsSourceFile);
        outputJs = outputJs.replace(/\r\n/g, "\n");
        result.TotalVisitedNodes = totalVisitedNodes;
        result.TotalPatchedNodes = totalPatchedNodes;
        result.JavascriptString = outputJs;
        SnapshotMakerTsJsRewriter.Trace("Total visited ast nodes: " + totalVisitedNodes);
        SnapshotMakerTsJsRewriter.Trace("Total applied patches: " + totalPatchedNodes);
        SnapshotMakerTsJsRewriter.Trace("Applied patches:");
        for (var i = 0; i < ConfiguredPatchDefinitions.length; i++) {
            var patchDefinition = ConfiguredPatchDefinitions[i];
            var configuredPatchDefinition = (patchDefinition.Config != null) ? patchDefinition : null;
            var patchApplicationsInfo = result.AppliedPatches[i];
            var appliedCount = patchApplicationsInfo.Applications.length;
            var message = ["  - "];
            if (appliedCount == 0)
                message.push("[!]");
            message.push("'" + patchDefinition.IdName + "'");
            if (configuredPatchDefinition != null)
                message.push("(config:", configuredPatchDefinition.Config, ")");
            message.push("applied " + appliedCount + " time(s)");
            if (appliedCount == 0)
                message.push("[!]");
            SnapshotMakerTsJsRewriter.Trace.apply(void 0, message);
        }
        return result;
    }
    SnapshotMakerTsJsRewriter.PatchJavascript = PatchJavascript;
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
