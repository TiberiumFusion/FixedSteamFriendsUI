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
        var PatchDefinition = (function () {
            function PatchDefinition(idName, patch, detections) {
                this.IdName = idName;
                this.Patch = patch;
                this.Detections = detections;
            }
            PatchDefinition.prototype.DetectAndPatch = function (context, sourceFile, node) {
                for (var _i = 0, _a = this.Detections; _i < _a.length; _i++) {
                    var detection = _a[_i];
                    var detectionInfo = detection(context, sourceFile, node);
                    if (detectionInfo != null && detectionInfo.Match == true) {
                        var nodePos = sourceFile.getLineAndCharacterOfPosition(node.pos);
                        SnapshotMakerTsJsRewriter.Trace("> Detection '" + this.IdName + "' matched >>", "Line " + nodePos.line + ", char " + nodePos.character, ">>", "Node:", node);
                        var oldJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile);
                        SnapshotMakerTsJsRewriter.Trace("  - Original JS: ", oldJs);
                        var patchedNode = this.Patch(context, sourceFile, node, detectionInfo.Data);
                        var newJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, patchedNode, patchedNode.getSourceFile());
                        SnapshotMakerTsJsRewriter.Trace("  - Patched JS:  ", newJs);
                        return patchedNode;
                    }
                }
            };
            return PatchDefinition;
        }());
        Patches.PatchDefinition = PatchDefinition;
        var ConfiguredPatchDefinition = (function (_super) {
            __extends(ConfiguredPatchDefinition, _super);
            function ConfiguredPatchDefinition(idName, config, patch, detections) {
                var _this = _super.call(this, idName, patch, detections) || this;
                _this.Config = config;
                return _this;
            }
            return ConfiguredPatchDefinition;
        }(PatchDefinition));
        Patches.ConfiguredPatchDefinition = ConfiguredPatchDefinition;
        var DetectionInfo = (function () {
            function DetectionInfo(match, data) {
                this.Match = match;
                this.Data = data;
            }
            return DetectionInfo;
        }());
        Patches.DetectionInfo = DetectionInfo;
        var ConfiguredPatchDefinitionFactory = (function () {
            function ConfiguredPatchDefinitionFactory() {
            }
            ConfiguredPatchDefinitionFactory.prototype.CreatePatchDefinition = function (config) {
                throw new Error("Not implemented");
            };
            return ConfiguredPatchDefinitionFactory;
        }());
        Patches.ConfiguredPatchDefinitionFactory = ConfiguredPatchDefinitionFactory;
        var FactoriesInitialized = false;
        var Factories = [];
        var FactoriesByIdName = {};
        function GetPatchDefinitionFactoryByIdName(idName) {
            return FactoriesByIdName[idName];
        }
        Patches.GetPatchDefinitionFactoryByIdName = GetPatchDefinitionFactoryByIdName;
        function RegisterPatchDefinitionFactoryInstance(factory) {
            Factories.push(factory);
            FactoriesByIdName[factory.PatchIdName] = factory;
        }
        function InitAllPatchDefinitionFactories() {
            Factories = [];
            FactoriesByIdName = {};
            var factories = [
                new Patches.Definitions.RewriteCdnAssetUrlStringBuildCPDF(),
                new Patches.Definitions.ShimSettingsStoreIsSteamInTournamentModeCPDF(),
                new Patches.Definitions.ShimSteamClientIsSteamInTournamentModeCPDF(),
                new Patches.Definitions.DisableMiniprofileBrokenBlurHandlerCPDF(),
                new Patches.Definitions.ShimSteamClientBrowserGetBrowserIdCPDF(),
                new Patches.Definitions.FixBlackFrameBugCPDF(),
                new Patches.Definitions.FixBrokenIsMaximizedCopypastaCPDF(),
                new Patches.Definitions.DisableBrokenXssAttackValveRelianceCPDF(),
                new Patches.Definitions.DisableLate2023ChatCensorshipFeatureAdditionCPDF(),
                new Patches.Definitions.ShimSteamClientOpenVrSoiaCPDF(),
                new Patches.Definitions.ShimSteamClientBrowserGetBrowserIdCheckCPDF(),
                new Patches.Definitions.AddHtmlWebuiConfigOnLoadHookCPDF(),
                new Patches.Definitions.DisableContenthashGetParamOnFetchesCPDF(),
                new Patches.Definitions.RewriteSteamClientWindowNewGetterPromisesCPDF(),
                new Patches.Definitions.RewriteEarly2024NewWindowGettersUsageCPDF(),
                new Patches.Definitions.FixBrokenInviteListAutoCloseOnDoneCPDF(),
                new Patches.Definitions.FixBrokenInviteListInviteItemsCPDF(),
                new Patches.Definitions.RewriteScRpBCanCreateInviteForGameCallCPDF(),
            ];
            for (var _i = 0, factories_1 = factories; _i < factories_1.length; _i++) {
                var factory = factories_1[_i];
                RegisterPatchDefinitionFactoryInstance(factory);
            }
        }
        Patches.InitAllPatchDefinitionFactories = InitAllPatchDefinitionFactories;
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
