// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Disable the "contenthash" get param on the -json.js file fetches
/*

    ----- Targets -----

    1.  (8601984: line 58790)
        ".js?contenthash=" +
      =>
        ".js?_contenthash_=" +

    
    ----- Notes -----

    We must strip the contenthash GET param because Valve redacts old versions and returns a 404 for those requests, instead of ignoring the contenthash and just serving the current version instead (which is what they do for their .js files only)

    The old manual version of this patch included commenting out the entire block with the hashes dictionary and string concat into it, but this patch simply renames the GET param which also works.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export class DisableContenthashGetParamOnJsonJsFetchesCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "DisableContenthashGetParamOnJsonJsFetches";

        CreatePatchDefinition(): PatchDefinition
        {
            return new PatchDefinition(this.PatchIdName,

                // ____________________________________________________________________________________________________
                //
                //     Patch
                // ____________________________________________________________________________________________________
                //

                (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node, detectionInfoData: any) =>
                {
                    let tnode: ts.StringLiteral = detectionInfoData.TypedNode; // e.g.  ".js?contenthash="

                    // Change the "contenthash" get param to something different

                    // Previously, the by-hand manul human version of this patch involved commenting out the entire string concatentation from ".js?contenthash=" to the end of the content array dictionary it indexes into
                    // This works perfectly fine, but it takes significantly longer to write a detection and patch which does all that, rather than a simple string literal replacement

                    // The Valve server only returns a 404 when the URL has a known GET param with a value Valve doesn't like
                    // The Valve server ignores GET params that it doesn't know

                    // So, an easy patch which saves me time and works just as well as the proper manual patch is simply changing the GET param "contenthash" to something the Valve server won't recognize

                    let patched = context.factory.createStringLiteral(".js?_contenthash_=");

                    if (IncludeOldJsCommentAtPatchSites)
                        ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);

                    return patched;
                },


                // ____________________________________________________________________________________________________
                //
                //     Detections
                // ____________________________________________________________________________________________________
                //

                [
                    (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node) =>
                    {
                        if (node.kind == ts.SyntaxKind.StringLiteral) // e.g.  ".js?contenthash="
                        {
                            let tnode = node as ts.StringLiteral;
                            if (tnode.text == ".js?contenthash=")
                            {
                                return new DetectionInfo(true, {
                                    "TypedNode": tnode,
                                });
                            }
                        }
                    }
                ],

            );
        }
    }
    
}
