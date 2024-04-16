namespace SnapshotMakerTsJsRewriter
{
    // ____________________________________________________________________________________________________
    //
    //     Configuration
    // ____________________________________________________________________________________________________
    //

    export var EnableTraces: boolean = true;

    export var IncludeOldJsCommentAtPatchSites: boolean = true;



    // ____________________________________________________________________________________________________
    //
    //     Main
    // ____________________________________________________________________________________________________
    //

    var ConfiguredPatchDefinitions: Patches.PatchDefinition[] = [];


    // --------------------------------------------------
    //   Define patches per user configuration
    // --------------------------------------------------

    export interface DefinePatchesConfig
    {
        Version: number,
        Definitions: {
            IdName: string, // e.g.  "CdnAssetUrlStringBuild"
            Config: any, // e.g.  A valid Patches.Definitions.CdnAssetUrlStringBuildConfig object
        }[]
    }

    export function DefinePatches(patchDefinitionsConfig: DefinePatchesConfig)
    {
        Patches.InitAllPatchDefinitionFactories();

        ConfiguredPatchDefinitions = [];

        //for (let definition in config.Definitions) // typescript fails to infer correct type for local `definition`
        patchDefinitionsConfig.Definitions.forEach((item) =>
        {
            let factory = Patches.GetPatchDefinitionFactoryByIdName(item.IdName);

            if (factory == null)
            {
                console.warn("Unknown patch IdName '" + item.IdName + "'. Patch cannot be built and will be skipped.")
                return;
            }

            ConfiguredPatchDefinitions.push(
                factory.CreatePatchDefinition(item.Config), // Config can be omitted from the config object and thus null, if the patch definition does not accept any config
            );
        });
    }


    // --------------------------------------------------
    //   Patch some javascript
    // --------------------------------------------------

    export function PatchJavascript(code: string): string
    {
        let inputJsSourceFile = ts.createSourceFile("blah.js", code, ts.ScriptTarget.ES2015, /*setParentNodes*/ true, ts.ScriptKind.JS);
        console.log(inputJsSourceFile);


        let totalNodes: number = 0;


        // Method passed to ts.transform(); sole argument is supplied by ts.transform()
        let megatron: ts.TransformerFactory<ts.SourceFile> = function(context)
        {
            // Ugly js nested method, which somehow obtains its sole argument from the ts.transform() caller
            return function(sourceFile)
            {
                let visitor = function(node: ts.Node): ts.Node
                {
                    totalNodes += 1;

                    for (let patchDefinition of ConfiguredPatchDefinitions)
                    {
                        let patchedNode: ts.Node = patchDefinition.DetectAndPatch(context, sourceFile, node);
                        if (patchedNode != null) // return is non-null if this node was detected & patched
                            return patchedNode;

                        // todo: track and report the following
                        // - count of applied patches
                        // - patches who had none of their detections match and thus were never used
                    }

                    return ts.visitEachChild(node, visitor, context)
                }

                return ts.visitNode(sourceFile, visitor);
            }
        };

        let inputJsTransformResult = ts.transform(inputJsSourceFile, [megatron]);

        console.log(">>>>> TRANSFORM DONE >>>>>", totalNodes);

        console.log("EXPORT");

        let transformedInputJsSourceFile = inputJsTransformResult.transformed[0];

        let outputJs: string = JsEmitPrinter.printFile(transformedInputJsSourceFile);

        console.log(outputJs);

        return outputJs;
    }
}
