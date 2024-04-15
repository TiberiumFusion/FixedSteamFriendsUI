namespace SnapshotMakerTsJsRewriter
{
    // ____________________________________________________________________________________________________
    //
    //     Configuration
    // ____________________________________________________________________________________________________
    //

    export var EnableTraces: boolean = true;



    // ____________________________________________________________________________________________________
    //
    //     Main
    // ____________________________________________________________________________________________________
    //

    var ConfiguredPatchDefinitions: Patches.PatchDefinition[] = [];


    // --------------------------------------------------
    //   Define patches per configuration
    // --------------------------------------------------

    export function DefinePatches(config: any)
    {
        Patches.InitAllPatchDefinitionFactories();

    }


    // --------------------------------------------------
    //   Patch some javascript
    // --------------------------------------------------

    export function PatchJavascript(code: string): string
    {


        let config: Patches.Definitions.CdnAssetUrlStringBuildConfig = {
            MethodIdentifierExpression: "TFP.Resources.SelectCdnResourceUrl",
            Targets: [
                {
                    ResourceUrl: "public/sounds/webui/steam_voice_channel_enter.m4a",
                    UrlRootPathType: "Root",
                    ResourceCategory: "JsSounds",
                }
            ]
        };

        ConfiguredPatchDefinitions.push(
            Patches.GetPatchDefinitionFactoryByIdName("CdnAssetUrlStringBuild").CreatePatchDefinition(config),
        );



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
