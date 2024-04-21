// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Patch definitions and the factory objects which create them
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

namespace SnapshotMakerTsJsRewriter.Patches
{
    // ____________________________________________________________________________________________________
    //
    //     Structures
    // ____________________________________________________________________________________________________
    //

    // --------------------------------------------------
    //   Patch definitions
    // --------------------------------------------------
    
    // Each patch target is defined by two things: an anchor ast node from which the detection is evaluated, and the patch to be performed relative to that node if the detection passes
    // Since the same patch may be performed at many different locations, each patch definition consists of one patch and one or more detections

    // Named combination of detector(s) + patch
    export class PatchDefinition
    {
        IdName: string;
        Patch: Function;
        Detections: Function[];

        constructor(idName: string, patch: Function, detections: Function[])
        {
            this.IdName = idName;
            this.Patch = patch;
            this.Detections = detections;
        }

        DetectAndPatch(context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node): ts.Node
        {
            // This is called for each node during the single AST traverse
            // The node will be patched if any of our detections match the currently visited node in the ast

            // Try all detections until one or none match
            for (let detection of this.Detections)
            {
                let detectionInfo: DetectionInfo = detection(context, sourceFile, node);
                if (detectionInfo != null && detectionInfo.Match == true)
                {
                    let nodePos = sourceFile.getLineAndCharacterOfPosition(node.pos);
                    Trace("> Detection '" + this.IdName + "' matched >>", "Line " + nodePos.line + ", char " + nodePos.character, ">>", "Node:", node);

                    let oldJs: string = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile);
                    Trace("  - Original JS: ", oldJs);

                    let patchedNode: ts.Node = this.Patch(context, sourceFile, node, detectionInfo.Data);

                    let newJs: string = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, patchedNode, patchedNode.getSourceFile());
                    Trace("  - Patched JS:  ", newJs);

                    return patchedNode;
                    // Only the first matched detection will result in applying patch to the visited note. Any remaining detections are skipped.
                    // There should never be multiple matched detections!
                }
            }

            // No match, no patch, return null
        }
    }

    // Derivative that retains its instantiation configuration object
    export class ConfiguredPatchDefinition extends PatchDefinition
    {
        Config: any; // Each patch definition has its own bespoke configuration object, so we use any type here

        constructor(idName: string, config: any, patch: Function, detections: Function[])
        {
            super(idName, patch, detections);
            this.Config = config;
        }
    }


    // --------------------------------------------------
    //   Helpers
    // --------------------------------------------------
    
    // Bundle of data created on a matched detection; provided to the patch method associated with the detection method
    export class DetectionInfo
    {
        Match: boolean;
        Data: any;

        constructor(match: boolean, data?: any)
        {
            this.Match = match;
            this.Data = data;
        }
    }

    
    // --------------------------------------------------
    //   Patch definition factories
    // --------------------------------------------------

    // Object which creates patch definitions
    // Not strictly necessary and a little confusing as a result, but this provides a layer of abstraction between the patch definitions config object passed to Main.DefinePatches() and each PatchDefinition
    // A configured patch definition has its detection and patch methods both altered by a provided config, which usually specifies the signatures of the patch targets and what to do with them when patching them
    // The configuration can be null, however, for patches which do not accept any configuration
    export class ConfiguredPatchDefinitionFactory
    {
        PatchIdName: string;

        CreatePatchDefinition(config: any): PatchDefinition
        {
            throw new Error("Not implemented");
        }
    }
    


    // ____________________________________________________________________________________________________
    //
    //     Instantiation of all known configured patch definition factories
    // ____________________________________________________________________________________________________
    //
    
    var FactoriesInitialized: boolean = false;

    var Factories: ConfiguredPatchDefinitionFactory[] = [];
    var FactoriesByIdName: Record<string, ConfiguredPatchDefinitionFactory> = {};


    export function GetPatchDefinitionFactoryByIdName(idName: string): ConfiguredPatchDefinitionFactory
    {
        return FactoriesByIdName[idName];
    }


    function RegisterPatchDefinitionFactoryInstance(factory: ConfiguredPatchDefinitionFactory)
    {
        Factories.push(factory);
        FactoriesByIdName[factory.PatchIdName] = factory;
    }

    export function InitAllPatchDefinitionFactories()
    {
        Factories = [];
        FactoriesByIdName = {};

        let factories: ConfiguredPatchDefinitionFactory[] = [
            new Definitions.RewriteCdnAssetUrlStringBuildCPDF(),
            new Definitions.ShimSettingsStoreIsSteamInTournamentModeCPDF(),
            new Definitions.ShimSteamClientIsSteamInTournamentModeCPDF(),
            new Definitions.DisableMiniprofileBrokenBlurHandlerCPDF(),
            new Definitions.ShimSteamClientBrowserGetBrowserIdCPDF(),
            new Definitions.FixBlackFrameBugCPDF(),
            new Definitions.FixBrokenIsMaximizedCopypastaCPDF(),
            new Definitions.DisableBrokenXssAttackValveRelianceCPDF(),
            new Definitions.DisableLate2023ChatCensorshipFeatureAdditionCPDF(),
            new Definitions.ShimSteamClientOpenVrSoiaCPDF(),
            new Definitions.ShimSteamClientBrowserGetBrowserIdCheckCPDF(),
            new Definitions.AddHtmlWebuiConfigOnLoadHookCPDF(),
            new Definitions.DisableContenthashGetParamOnFetchesCPDF(),
            new Definitions.RewriteSteamClientWindowNewGetterPromisesCPDF(),
            new Definitions.RewriteEarly2024NewWindowGettersUsageCPDF(),
            new Definitions.FixBrokenInviteListAutoCloseOnDoneCPDF(),
            new Definitions.FixBrokenInviteListInviteItemsCPDF(),
        ];

        for (let factory of factories)
            RegisterPatchDefinitionFactoryInstance(factory);
    }
}
