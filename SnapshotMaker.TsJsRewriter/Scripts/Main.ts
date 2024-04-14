namespace SnapshotMakerTsJsRewriter
{
    // ____________________________________________________________________________________________________
    //
    //     Configuration
    // ____________________________________________________________________________________________________
    //

    let EnableTraces: boolean = true;



    // ____________________________________________________________________________________________________
    //
    //     Helpers
    // ____________________________________________________________________________________________________
    //

    // --------------------------------------------------
    //   Tracing
    // --------------------------------------------------

    // Our functions call this
    function Trace(...message: any[])
    {
        if (!Trace)
            return;

        UserTraceHandler(...message);
    }

    // User can replace this with their own trace handler
    function UserTraceHandler(...message: any[])
    {
        console.log(...message);
    }


    // --------------------------------------------------
    //   TypeScript js emission
    // --------------------------------------------------

    // General purpose formatted JS code string provider for nodes and source files
    let JsEmitPrinter: ts.Printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });



    // ____________________________________________________________________________________________________
    //
    //     Patches
    // ____________________________________________________________________________________________________
    //

    // Each patch location is defined by two things: an anchor ast node from which the detection is evaluated, and the patch to be performed from that node if the detection passes
    // Since the same patch may be performed at many different locations, each patch definition consists of one patch and one or more detections

    class DetectionInfo
    {
        Match: boolean;
        Data: any;

        constructor(match: boolean, data: any)
        {
            this.Match = match;
            this.Data = data;
        }
    }

    class PatchDefinition
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
            // Try all detections until one or none match
            for (let detection of this.Detections)
            {
                let detectionInfo: DetectionInfo = detection(node);
                if (detectionInfo != null && detectionInfo.Match == true)
                {
                    Trace("> Detection '" + this.IdName + "' matched node: ", node);
                    Trace("  - Original JS: ", JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile));

                    let patchedNode: ts.Node = this.Patch(context, sourceFile, node, detectionInfo.Data);

                    Trace("  - Patched JS: ", JsEmitPrinter.printNode(ts.EmitHint.Unspecified, patchedNode, sourceFile));

                    return patchedNode;
                    // Only the first matched detection gets to patch the area
                    // There should never be multiple matched detections!
                }
            }
        }
    }


    //
    // All patches
    //

    let AllPatches: PatchDefinition[] = [];

    function BuildPatches()
    {
        // --------------------------------------------------
        //   Helpers
        // --------------------------------------------------

        function DetectionMatch(match: boolean, data?: any)
        {
            return new DetectionInfo(match, data);
        }


        // --------------------------------------------------
        //   CDN asset fetch url rewriting
        //
        //   Example:
        //   ->  u.Ul.AudioPlaybackManager.PlayAudioURL(o.De.COMMUNITY_CDN_URL + "public/sounds/webui/steam_voice_channel_enter.m4a?v=1")
        //    -> u.Ul.AudioPlaybackManager.PlayAudioURL( TFP.Resources.SelectCdnResourceUrl(o.De.COMMUNITY_CDN_URL, "public/sounds/webui/steam_voice_channel_enter.m4a?v=1", "Root", "JsSounds") )
        // --------------------------------------------------

        let cdnUrlLiterals: string[] = [
            "public/sounds/webui/steam_voice_channel_enter.m4a?v=1",
            "public/sounds/webui/steam_voice_channel_exit.m4a?v=1",
        ]

        AllPatches.push(new PatchDefinition("CdnAssetUrlStringBuild",
            (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node, detectionInfoData: any) =>
            {
                let top: ts.BinaryExpression = detectionInfoData.Top;
                let right: ts.StringLiteral = detectionInfoData.Right;

                
                console.log("CHECK 1", JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile));

                let mTop = context.factory.updateBinaryExpression(top, top.left, top.operatorToken, context.factory.createStringLiteral("CHANGED"));
                
                console.log("CHECK 2", JsEmitPrinter.printNode(ts.EmitHint.Unspecified, mTop, sourceFile));
                
                return mTop;
            },
            [
                (node: ts.Node) =>
                {
                    if (node.kind == ts.SyntaxKind.BinaryExpression) // e.g.  o.De.COMMUNITY_CDN_URL + "public/sounds/webui/steam_voice_channel_enter.m4a?v=1"
                    {
                        let tnode: ts.BinaryExpression = node as ts.BinaryExpression;
                        if (tnode.right.kind == ts.SyntaxKind.StringLiteral) // e.g.  "public/sounds/webui/steam_voice_channel_enter.m4a?v=1"
                        {
                            let rightTNode: ts.StringLiteral = tnode.right as ts.StringLiteral;
                            if (cdnUrlLiterals.indexOf(rightTNode.text) != -1)
                            {
                                return DetectionMatch(true, {
                                    "Top": tnode,
                                    "Right": rightTNode,
                                });
                            }
                        }
                    }
                }
            ],
        ));
    }

    BuildPatches();
    

    // ____________________________________________________________________________________________________
    //
    //     Main interface
    // ____________________________________________________________________________________________________
    //

    export function Test(code: string)
    {
        console.log("hello world");

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
                    
                    for (let patchDef of AllPatches)
                    {
                        let patchedNode: ts.Node = patchDef.DetectAndPatch(context, sourceFile, node);
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

        console.log(JsEmitPrinter.printFile(transformedInputJsSourceFile));

    }
}
