namespace SnapshotMakerTsJsRewriter
{
    export const Version: string = "1.1.0.0";


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
        //
        // Ensure factories exist for all patch definitions
        //

        Patches.InitAllPatchDefinitionFactories();

        //
        // Create patch definitions for each patch specified in the provided config
        //

        ConfiguredPatchDefinitions = [];

        //for (let definition in config.Definitions) // typescript fails to infer correct type for local `definition`
        patchDefinitionsConfig.Definitions.forEach((item) =>
        {
            let factory = Patches.GetPatchDefinitionFactoryByIdName(item.IdName);

            if (factory == null)
            {
                Trace("[!] Unknown patch IdName '" + item.IdName + "'. Patch cannot be built and will be skipped. [!]")
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

    //
    // Patch result
    //

    export interface IPatchJavascriptResult
    {
        TotalVisitedNodes: number; // Count of the nodes visited by the AST traverse
        AppliedPatches: { // List of the applications of each patch definition
            IdName: string; // The IdName of the PatchDefinition this item in the list is for
            // todo: add patch def config (after refactoring that code)
            Applications: { // Info about each time this PatchDefinition was applied
                OriginalNode: ts.Node; // Original unpatched AST node
                PatchedNode: ts.Node; // Patched AST node
                Location: ts.LineAndCharacter; // Location in the source file of the ast node which was patched
            }[];
        }[];
        JavascriptString: string; // The output patched javascript source code string
    }

    class PatchJavascriptResult implements IPatchJavascriptResult
    {
        TotalVisitedNodes: number;
        TotalPatchedNodes: number;
        AppliedPatches: {
            IdName: string;
            Applications: {
                OriginalNode: ts.Node;
                PatchedNode: ts.Node;
                Location: ts.LineAndCharacter;
            }[];
        }[];
        JavascriptString: string;

        constructor(patchDefinitions: Patches.PatchDefinition[])
        {
            this.TotalVisitedNodes = 0;

            let appliedPatches: any = [];
            for (let patchDef of patchDefinitions)
            {
                appliedPatches.push({
                    IdName: patchDef.IdName,
                    Applications: [],
                });
            }
            this.AppliedPatches = appliedPatches;

            this.JavascriptString = "";
        }
    }


    //
    // Patch operation
    //

    export function PatchJavascript(inputJs: string): IPatchJavascriptResult
    {
        let result: PatchJavascriptResult = new PatchJavascriptResult(ConfiguredPatchDefinitions);


        //
        // Create a ts.SourceFile for the input javascript
        //

        let inputJsSourceFile = ts.createSourceFile(
            "source.js", // Irrelevant, since we are not loading from the disk or writing to the disk. However, when the final param (ScriptKind) is omitted, typescript infers a ScripType from the extension of this file name.
            inputJs, // Source code string
            ts.ScriptTarget.ES2015, // Feature level of input javascript iiuc (i.e. not feature level of *output* js)
            /*setParentNodes*/ true, // Required for ast traversal to actually be feasible. When false, each node is missing the reference to its parent node.
            ts.ScriptKind.JS // Switch for javascript vs typescript source code
        );
        //console.log(inputJsSourceFile);

        // The ts.SourceFile includes a complete AST model, which can be traversed and manipulated


        //
        // Modify the source file's AST
        //
        
        let totalVisitedNodes: number = 0;
        let totalPatchedNodes: number = 0;

        // AST traverse occurs within a "transform" operation
        // This method is passed to ts.transform(). Its sole argument is supplied by ts.transform().
        let megatron: ts.TransformerFactory<ts.SourceFile> = function(context)
        {
            // Ugly js nested method that must be returned from this transformer init method. Its sole argument is supplied by the actual transform process.
            // This is the actual AST node traversal, starting with the ts.SourceFile
            return function(sourceFile)
            {
                let visitor = function(node: ts.Node): ts.Node
                {
                    totalVisitedNodes++;

                    // Run all detections against this node. The first match (if any) gets to patch the node.
                    for (let i = 0; i < ConfiguredPatchDefinitions.length; i++)
                    {
                        let patchDefinition = ConfiguredPatchDefinitions[i];

                        let patchedNode: ts.Node = patchDefinition.DetectAndPatch(context, sourceFile, node);
                        if (patchedNode != null) // return is non-null if this node was detected & patched
                        {
                            totalPatchedNodes++;

                            let patchApplicationsInfo: IPatchJavascriptResult["AppliedPatches"][0] = result.AppliedPatches[i];
                            patchApplicationsInfo.Applications.push({
                                Location: sourceFile.getLineAndCharacterOfPosition(node.pos),
                                OriginalNode: node,
                                PatchedNode: patchedNode,
                            });

                            // Modification of the AST inside a transform operation is only possible by returning a different node in the traversal visit function of the victim node
                            return patchedNode;
                        }
                    }

                    // Recurse to children of this node
                    return ts.visitEachChild(node, visitor, context)
                }

                // Start traverse with the root-level nodes
                return ts.visitNode(sourceFile, visitor);
            }
        };

        // Run the transform operation
        let inputJsTransformResult = ts.transform(inputJsSourceFile, [megatron]);

        // Get the new ts.SourceFile which contains the modified AST
        let transformedInputJsSourceFile = inputJsTransformResult.transformed[0];


        //
        // Generate a javascript source code string from the modified AST
        //

        let outputJs: string = JsEmitPrinter.printFile(transformedInputJsSourceFile);
        
        // Fix line endings
        // The typescript js emitter uses the host OS to determine line endings. When running on Windows, the output js has CRLF endings. On everything else, its LF endings.
        // friends.js has LF line endings. For consistency's sake, we will ensure the patched js also has LF line endings.
        outputJs = outputJs.replace(/\r\n/g, "\n");

        //console.log(outputJs);


        //
        // Finalize result object
        //

        result.TotalVisitedNodes = totalVisitedNodes;
        result.TotalPatchedNodes = totalPatchedNodes;

        result.JavascriptString = outputJs;


        //
        // Report some result data
        //

        Trace("Total visited ast nodes: " + totalVisitedNodes);

        Trace("Total applied patches: " + totalPatchedNodes);

        Trace("Applied patches:");

        for (let i = 0; i < ConfiguredPatchDefinitions.length; i++)
        {
            let patchDefinition = ConfiguredPatchDefinitions[i];
            let configuredPatchDefinition = ((<Patches.ConfiguredPatchDefinition>patchDefinition).Config != null) ? <Patches.ConfiguredPatchDefinition>patchDefinition : null;

            let patchApplicationsInfo: IPatchJavascriptResult["AppliedPatches"][0] = result.AppliedPatches[i];

            let appliedCount: number = patchApplicationsInfo.Applications.length;

            let message: string[] = ["  - "];

            if (appliedCount == 0) message.push("[!]");

            message.push("'" + patchDefinition.IdName + "'");

            if (configuredPatchDefinition != null)
                message.push("(config:", configuredPatchDefinition.Config, ")");

            message.push("applied " + appliedCount + " time(s)")

            if (appliedCount == 0) message.push("[!]");

            Trace(...message);
        }


        return result;
    }
}
