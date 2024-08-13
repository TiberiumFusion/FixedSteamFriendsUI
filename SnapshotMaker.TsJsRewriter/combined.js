var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    // ____________________________________________________________________________________________________
    //
    //     Tracing
    // ____________________________________________________________________________________________________
    //
    // Our functions call this
    function Trace(...message) {
        if (!SnapshotMakerTsJsRewriter.EnableTraces)
            return;
        SnapshotMakerTsJsRewriter.UserTraceHandler(...message);
    }
    SnapshotMakerTsJsRewriter.Trace = Trace;
    // User can replace this with their own trace handler
    function UserTraceHandler(...message) {
        console.log(...message);
    }
    SnapshotMakerTsJsRewriter.UserTraceHandler = UserTraceHandler;
    // ____________________________________________________________________________________________________
    //
    //     TypeScript js emission
    // ____________________________________________________________________________________________________
    //
    // General purpose formatted JS code string provider for nodes and source files
    SnapshotMakerTsJsRewriter.JsEmitPrinter = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    // ____________________________________________________________________________________________________
    //
    //     String handling
    // ____________________________________________________________________________________________________
    //
    // Given:   "some\full\or partial.url?with=urlvars&thatwe=dontwant"
    // Returns: "some\full\or partial.url"
    function RemoveQueryTailFromUrl(url) {
        let qPos = url.indexOf('?');
        if (qPos == -1)
            return url;
        else
            return url.substr(0, qPos);
    }
    SnapshotMakerTsJsRewriter.RemoveQueryTailFromUrl = RemoveQueryTailFromUrl;
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    SnapshotMakerTsJsRewriter.Version = "1.1.0.0";
    // ____________________________________________________________________________________________________
    //
    //     Configuration
    // ____________________________________________________________________________________________________
    //
    SnapshotMakerTsJsRewriter.EnableTraces = true;
    SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites = true;
    // ____________________________________________________________________________________________________
    //
    //     Main
    // ____________________________________________________________________________________________________
    //
    var ConfiguredPatchDefinitions = [];
    function DefinePatches(patchDefinitionsConfig) {
        //
        // Ensure factories exist for all patch definitions
        //
        SnapshotMakerTsJsRewriter.Patches.InitAllPatchDefinitionFactories();
        //
        // Create patch definitions for each patch specified in the provided config
        //
        ConfiguredPatchDefinitions = [];
        //for (let definition in config.Definitions) // typescript fails to infer correct type for local `definition`
        patchDefinitionsConfig.Definitions.forEach((item) => {
            let factory = SnapshotMakerTsJsRewriter.Patches.GetPatchDefinitionFactoryByIdName(item.IdName);
            if (factory == null) {
                SnapshotMakerTsJsRewriter.Trace("[!] Unknown patch IdName '" + item.IdName + "'. Patch cannot be built and will be skipped. [!]");
                return;
            }
            ConfiguredPatchDefinitions.push(factory.CreatePatchDefinition(item.Config));
        });
    }
    SnapshotMakerTsJsRewriter.DefinePatches = DefinePatches;
    class PatchJavascriptResult {
        constructor(patchDefinitions) {
            this.TotalVisitedNodes = 0;
            let appliedPatches = [];
            for (let patchDef of patchDefinitions) {
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
    function PatchJavascript(inputJs) {
        let result = new PatchJavascriptResult(ConfiguredPatchDefinitions);
        //
        // Create a ts.SourceFile for the input javascript
        //
        let inputJsSourceFile = ts.createSourceFile("source.js", // Irrelevant, since we are not loading from the disk or writing to the disk. However, when the final param (ScriptKind) is omitted, typescript infers a ScripType from the extension of this file name.
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
        let totalVisitedNodes = 0;
        let totalPatchedNodes = 0;
        // AST traverse occurs within a "transform" operation
        // This method is passed to ts.transform(). Its sole argument is supplied by ts.transform().
        let megatron = function (context) {
            // Ugly js nested method that must be returned from this transformer init method. Its sole argument is supplied by the actual transform process.
            // This is the actual AST node traversal, starting with the ts.SourceFile
            return function (sourceFile) {
                let visitor = function (node) {
                    totalVisitedNodes++;
                    // Run all detections against this node. The first match (if any) gets to patch the node.
                    for (let i = 0; i < ConfiguredPatchDefinitions.length; i++) {
                        let patchDefinition = ConfiguredPatchDefinitions[i];
                        let patchedNode = patchDefinition.DetectAndPatch(context, sourceFile, node);
                        if (patchedNode != null) // return is non-null if this node was detected & patched
                         {
                            totalPatchedNodes++;
                            let patchApplicationsInfo = result.AppliedPatches[i];
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
                    return ts.visitEachChild(node, visitor, context);
                };
                // Start traverse with the root-level nodes
                return ts.visitNode(sourceFile, visitor);
            };
        };
        // Run the transform operation
        let inputJsTransformResult = ts.transform(inputJsSourceFile, [megatron]);
        // Get the new ts.SourceFile which contains the modified AST
        let transformedInputJsSourceFile = inputJsTransformResult.transformed[0];
        //
        // Generate a javascript source code string from the modified AST
        //
        let outputJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printFile(transformedInputJsSourceFile);
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
        SnapshotMakerTsJsRewriter.Trace("Total visited ast nodes: " + totalVisitedNodes);
        SnapshotMakerTsJsRewriter.Trace("Total applied patches: " + totalPatchedNodes);
        SnapshotMakerTsJsRewriter.Trace("Applied patches:");
        for (let i = 0; i < ConfiguredPatchDefinitions.length; i++) {
            let patchDefinition = ConfiguredPatchDefinitions[i];
            let configuredPatchDefinition = (patchDefinition.Config != null) ? patchDefinition : null;
            let patchApplicationsInfo = result.AppliedPatches[i];
            let appliedCount = patchApplicationsInfo.Applications.length;
            let message = ["  - "];
            if (appliedCount == 0)
                message.push("[!]");
            message.push("'" + patchDefinition.IdName + "'");
            if (configuredPatchDefinition != null)
                message.push("(config:", configuredPatchDefinition.Config, ")");
            message.push("applied " + appliedCount + " time(s)");
            if (appliedCount == 0)
                message.push("[!]");
            SnapshotMakerTsJsRewriter.Trace(...message);
        }
        return result;
    }
    SnapshotMakerTsJsRewriter.PatchJavascript = PatchJavascript;
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Patch definitions and the factory objects which create them
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
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
        class PatchDefinition {
            constructor(idName, patch, detections) {
                this.IdName = idName;
                this.Patch = patch;
                this.Detections = detections;
            }
            DetectAndPatch(context, sourceFile, node) {
                // This is called for each node during the single AST traverse
                // The node will be patched if any of our detections match the currently visited node in the ast
                // Try all detections until one or none match
                for (let detection of this.Detections) {
                    let detectionInfo = detection(context, sourceFile, node);
                    if (detectionInfo != null && detectionInfo.Match == true) {
                        let nodePos = sourceFile.getLineAndCharacterOfPosition(node.pos);
                        SnapshotMakerTsJsRewriter.Trace("> Detection '" + this.IdName + "' matched >>", "Line " + nodePos.line + ", char " + nodePos.character, ">>", "Node:", node);
                        let oldJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile);
                        SnapshotMakerTsJsRewriter.Trace("  - Original JS: ", oldJs);
                        let patchedNode = this.Patch(context, sourceFile, node, detectionInfo.Data);
                        let newJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, patchedNode, patchedNode.getSourceFile());
                        SnapshotMakerTsJsRewriter.Trace("  - Patched JS:  ", newJs);
                        return patchedNode;
                        // Only the first matched detection will result in applying patch to the visited note. Any remaining detections are skipped.
                        // There should never be multiple matched detections!
                    }
                }
                // No match, no patch, return null
            }
        }
        Patches.PatchDefinition = PatchDefinition;
        // Derivative that retains its instantiation configuration object
        class ConfiguredPatchDefinition extends PatchDefinition {
            constructor(idName, config, patch, detections) {
                super(idName, patch, detections);
                this.Config = config;
            }
        }
        Patches.ConfiguredPatchDefinition = ConfiguredPatchDefinition;
        // --------------------------------------------------
        //   Helpers
        // --------------------------------------------------
        // Bundle of data created on a matched detection; provided to the patch method associated with the detection method
        class DetectionInfo {
            constructor(match, data) {
                this.Match = match;
                this.Data = data;
            }
        }
        Patches.DetectionInfo = DetectionInfo;
        // --------------------------------------------------
        //   Patch definition factories
        // --------------------------------------------------
        // Object which creates patch definitions
        // Not strictly necessary and a little confusing as a result, but this provides a layer of abstraction between the patch definitions config object passed to Main.DefinePatches() and each PatchDefinition
        // A configured patch definition has its detection and patch methods both altered by a provided config, which usually specifies the signatures of the patch targets and what to do with them when patching them
        // The configuration can be null, however, for patches which do not accept any configuration
        class ConfiguredPatchDefinitionFactory {
            CreatePatchDefinition(config) {
                throw new Error("Not implemented");
            }
        }
        Patches.ConfiguredPatchDefinitionFactory = ConfiguredPatchDefinitionFactory;
        // ____________________________________________________________________________________________________
        //
        //     Instantiation of all known configured patch definition factories
        // ____________________________________________________________________________________________________
        //
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
            let factories = [
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
            ];
            for (let factory of factories)
                RegisterPatchDefinitionFactoryInstance(factory);
        }
        Patches.InitAllPatchDefinitionFactories = InitAllPatchDefinitionFactories;
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Disable censorship feature addition first seen in late 2023 which breaks itself under pre pure-shit steam clients
/*

    ----- Targets -----

    1.  (8601984: line 47119)
        InitSteamEngineLanguages() {
            null != this.m_WebUIServiceTransport && (this.m_WebUIServiceTransport.messageHandlers.RegisterServiceNotificationHandler(_.gi.NotifyTextFilterDictionaryChangedHandler, this.OnTextFilterDictionaryChanged),   / this.InitSteamEngineLanguage(u.De.LANGUAGE), "english" !== u.De.LANGUAGE && this.InitSteamEngineLanguage("english"));}
        }
      =>
        // remove code inside block

    2.  (8601984: line 47239)
        if (null != this.m_WebUIServiceTransport) {
      =>
        if (false) {
    

    ----- Notes -----

    Sept 21 2023 and later versions of steam-chat.com use this method (and several others) introduce some kind of networking on the censorship feature of steam chat, not seen before in previous versions. It apepars to be a mechanism for obtaining constantly updated lists from Valve's servers specifying certain user speech in steam chat that will be censored.

    Loading this feature causes problems. At Site #1, the new interface causes a bunch of "SendMsg: Attempted to send message but socket wasn't ready" errors under the May 2023 client (and presumably all other vgui clients), likely due to the lack of injected/exposed interface from steamclient.dll/friendsui.dll in those older steam clients. And Valve does not care to put this behavior behind a compatibility check.
    The late July 2023 version of steam-chat.com is missing the new interface, so evidently it is not critical to running steam chat or even the censorship feature it interacts with. And indeed, simply disabling the entry point to this code prevents the errors from occuring in the May 2023 client, and chat censorship still works perfectly fine afaik. Presumably it is using offline censor dictionaries in the Steam client's program files.

    It may be possible to re-implement this feature using what is available with the pre pure-shit steam clients. Maybe a 20 hour job? Fuck that.

    Simply disabling the Sept 2023 code works, so that's what we are doing.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            class DisableLate2023ChatCensorshipFeatureAdditionCPDF extends Patches.ConfiguredPatchDefinitionFactory {
                constructor() {
                    super(...arguments);
                    this.PatchIdName = "DisableLate2023ChatCensorshipFeatureAddition";
                }
                CreatePatchDefinition() {
                    return new Patches.PatchDefinition(this.PatchIdName, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        //
                        // Patch location 1
                        //
                        if (detectionInfoData.Location == 1) {
                            let tnode = detectionInfoData.TypedNode;
                            /* e.g. body of this function:
                                InitSteamEngineLanguages() {
                                    null != this.m_WebUIServiceTransport && (this.m_WebUIServiceTransport.messageHandlers.RegisterServiceNotificationHandler(_.gi.NotifyTextFilterDictionaryChangedHandler, this.OnTextFilterDictionaryChanged), this.InitSteamEngineLanguage(u.De.LANGUAGE), "english" !== u.De.LANGUAGE && this.InitSteamEngineLanguage("english"));
                                }
                            */
                            // Replace function body with stub
                            let stub = context.factory.createEmptyStatement();
                            if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites) {
                                let oldJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile)
                                    .replace("{", "").replace("}", "").trim(); // typescript has no built-in for printing only the inside of a block (just the statement, no braces)
                                ts.addSyntheticLeadingComment(stub, ts.SyntaxKind.MultiLineCommentTrivia, oldJs, false);
                            }
                            return context.factory.updateBlock(tnode, [stub]);
                        }
                        //
                        // Patch location 2
                        //
                        else if (detectionInfoData.Location == 2) {
                            let tnode = detectionInfoData.TypedNode;
                            // In 8601984:  if (null != this.m_WebUIServiceTransport) { ...
                            // In 8811541:  if (this.m_WebUIServiceTransport.BIsValid()) ...
                            // Replace the conditional with constant false
                            let constantExpression = context.factory.createFalse();
                            if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                                ts.addSyntheticLeadingComment(constantExpression, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, tnode.expression, sourceFile), false);
                            return context.factory.updateIfStatement(tnode, constantExpression, tnode.thenStatement, tnode.elseStatement);
                        }
                    }, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Detections
                    // ____________________________________________________________________________________________________
                    //
                    [
                        //
                        // Patch location 1
                        //
                        /*
                            InitSteamEngineLanguages() {
                        >>	    null != this.m_WebUIServiceTransport && (this.m_WebUIServiceTransport.messageHandlers.RegisterServiceNotificationHandler(_.gi.NotifyTextFilterDictionaryChangedHandler, this.OnTextFilterDictionaryChanged), this.InitSteamEngineLanguage(u.De.LANGUAGE), "english" !== u.De.LANGUAGE && this.InitSteamEngineLanguage("english"));
                            }
    
                        */
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.Block) {
                                let tnode = node;
                                // Validate parent function definition
                                if (tnode.parent.kind == ts.SyntaxKind.MethodDeclaration) // e.g.  InitSteamEngineLanguages() { }
                                 {
                                    let method = tnode.parent;
                                    if (method.name.kind == ts.SyntaxKind.Identifier && method.name.escapedText == "InitSteamEngineLanguages") {
                                        return new Patches.DetectionInfo(true, {
                                            "Location": 1,
                                            "TypedNode": tnode,
                                        });
                                    }
                                }
                            }
                        },
                        //
                        // Patch location 2
                        //
                        /*
                        -- In 8601984 --
                            LoadLanguage(e) {
                                return (0, i.mG)(this, void 0, void 0, function* () {
                                    let t = "";
                        =>		    if (null != this.m_WebUIServiceTransport) {
    
                        -- In 8811541 --
                            LoadLanguage(e) {
                                return (0, i.mG)(this, void 0, void 0, function* () {
                                    let t = "", n = !1;
                        =>          if (this.m_WebUIServiceTransport.BIsValid())
    
                        */
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.IfStatement) {
                                let tnode = node;
                                // Validate expected method
                                let method = Patches.AstFindFirstAncestor(tnode, ts.SyntaxKind.MethodDeclaration);
                                if (method != null) {
                                    let methodTNode = method;
                                    if (methodTNode.name.kind == ts.SyntaxKind.Identifier && methodTNode.name.escapedText == "LoadLanguage") {
                                        // Validate if statement condition
                                        let ifConditionJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, tnode.expression, sourceFile); // tnode.expression can be anything; such as BinaryExpression or CallExpression
                                        if (ifConditionJs.includes("m_WebUIServiceTransport")) {
                                            // Highly likely match
                                            return new Patches.DetectionInfo(true, {
                                                "Location": 2,
                                                "TypedNode": tnode,
                                            });
                                        }
                                    }
                                }
                            }
                        },
                    ]);
                }
            }
            Definitions.DisableLate2023ChatCensorshipFeatureAdditionCPDF = DisableLate2023ChatCensorshipFeatureAdditionCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Disable broken cross-site scripting attack code in page initialization logic
/*

    ----- Targets -----

    1.  (8601984: line 37944)
        try {
            if (window.parent != window) {
                const t = window.parent;
                if (t.__SHARED_FRIENDSUI_GLOBALS && t.__SHARED_FRIENDSUI_GLOBALS[e]) return t.__SHARED_FRIENDSUI_GLOBALS[e];
                (0, o.X)(!1, `SharedFriendsUIGlobal "${e}" not initialized by parent, proceeding with local copy`);
            }
        } catch (e) {}
     =>
        // all code removed

    
    ----- Notes -----

    The offending code only works correctly when friends is running in the sharedjscontext created by a pure cef desktopui Steam client (June 2023 and later)
    On half-vgui half-cef Steam clients (Oct 30 2019 - May 31 2023), the commented out block is cross-domain scripting violation
    
    Because of the xss attack attempt (steam-chat.com's window accessing steamloopback.host's window), CEF aborts the function early, which prevents the 2 lines below the try-catch from running and clobbering existing valid required data with uninitialized garbage
    
    In other words, this code:
        const n = window;
        return n.__SHARED_FRIENDSUI_GLOBALS || (n.__SHARED_FRIENDSUI_GLOBALS = {}), (0, o.X)(!n.__SHARED_FRIENDSUI_GLOBALS[e], `Unexpected second call to SharedFriendsUIGlobal for "${e}"`), n.__SHARED_FRIENDSUI_GLOBALS[e] || (n.__SHARED_FRIENDSUI_GLOBALS[e] = t()), n.__SHARED_FRIENDSUI_GLOBALS[e];
    fails to run in the half-cef Steam clients. It must fail to run, or else steam-chat.com shits the bed.
    
    Valve has been relying on this invalid behavior induced by their fuck-up since early 2023 at least.

    We, however, get screwed by it. Because the steam-chat.com snapshot is served from steamloopback.host, this code is *not* an xss attack, and thus it runs, and thus is clobbers the valid data with garbage.
    So we have to disable it.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            class DisableBrokenXssAttackValveRelianceCPDF extends Patches.ConfiguredPatchDefinitionFactory {
                constructor() {
                    super(...arguments);
                    this.PatchIdName = "DisableBrokenXssAttackValveReliance";
                }
                CreatePatchDefinition() {
                    return new Patches.PatchDefinition(this.PatchIdName, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        let tnode = detectionInfoData.TypedNode;
                        /* e.g.
                            try {
                                if (window.parent != window) {
                                    const t = window.parent;
                                    if (t.__SHARED_FRIENDSUI_GLOBALS && t.__SHARED_FRIENDSUI_GLOBALS[e]) return t.__SHARED_FRIENDSUI_GLOBALS[e];
                                    (0, o.X)(!1, `SharedFriendsUIGlobal "${e}" not initialized by parent, proceeding with local copy`);
                                }
                            } catch (e) {}
                        */
                        // Remove entirely
                        let oldJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile);
                        let stub = context.factory.createEmptyStatement();
                        if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                            ts.addSyntheticLeadingComment(stub, ts.SyntaxKind.MultiLineCommentTrivia, oldJs, false);
                        return stub;
                    }, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Detections
                    // ____________________________________________________________________________________________________
                    //
                    [
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.TryStatement) {
                                /* e.g.
                                    try {
                                        if (window.parent != window) {
                                            const t = window.parent;
                                            if (t.__SHARED_FRIENDSUI_GLOBALS && t.__SHARED_FRIENDSUI_GLOBALS[e]) return t.__SHARED_FRIENDSUI_GLOBALS[e];
                                            (0, o.X)(!1, `SharedFriendsUIGlobal "${e}" not initialized by parent, proceeding with local copy`);
                                        }
                                    } catch (e) {}
                                */
                                let tnode = node;
                                // Validate root try node and immediate inner if statement
                                let tryBlock = tnode.tryBlock;
                                if (tryBlock.statements.length == 1 && tryBlock.statements[0].kind == ts.SyntaxKind.IfStatement) // e.g.  if (window.parent != window)
                                 {
                                    let tryBlockRootStatement = tryBlock.statements[0];
                                    if (tryBlockRootStatement.expression.kind == ts.SyntaxKind.BinaryExpression) {
                                        let ifCondition = tryBlockRootStatement.expression; // e.g.  window.parent != window
                                        if (ifCondition.operatorToken.kind == ts.SyntaxKind.ExclamationEqualsToken) // !=
                                         {
                                            let ifConditionJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, ifCondition, sourceFile);
                                            if (ifConditionJs.includes("window.parent")) {
                                                // Validate specific contents inside if block
                                                if (tryBlockRootStatement.thenStatement != null && tryBlockRootStatement.thenStatement.kind == ts.SyntaxKind.Block) {
                                                    let ifBlock = tryBlockRootStatement.thenStatement;
                                                    let ifBlockJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, ifBlock, sourceFile);
                                                    if (ifBlockJs.includes("SharedFriendsUIGlobal") && ifBlockJs.includes("not initialized by parent, proceeding with local copy")) {
                                                        // All but guaranteed match
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
                }
            }
            Definitions.DisableBrokenXssAttackValveRelianceCPDF = DisableBrokenXssAttackValveRelianceCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
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
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            class DisableContenthashGetParamOnFetchesCPDF extends Patches.ConfiguredPatchDefinitionFactory {
                constructor() {
                    super(...arguments);
                    this.PatchIdName = "DisableContenthashGetParamOnFetches";
                }
                CreatePatchDefinition() {
                    return new Patches.PatchDefinition(this.PatchIdName, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        //
                        // -json.js files
                        //
                        if (detectionInfoData.Location == 1) {
                            let tnode = detectionInfoData.TypedNode; // e.g.  ".js?contenthash="
                            // Change the "contenthash" get param to something different
                            // Previously, the by-hand manul human version of this patch involved commenting out the entire string concatentation from ".js?contenthash=" to the end of the content array dictionary it indexes into
                            // This works perfectly fine, but it takes significantly longer to write a detection and patch which does all that, rather than a simple string literal replacement
                            // The Valve server only returns a 404 when the URL has a known GET param with a value Valve doesn't like
                            // The Valve server ignores GET params that it doesn't know
                            // So, an easy patch which saves me time and works just as well as the proper manual patch is simply changing the GET param "contenthash" to something the Valve server won't recognize
                            let patched = context.factory.createStringLiteral(".js?_contenthash_=");
                            if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                                ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                            return patched;
                        }
                        //
                        // .css files
                        //
                        else if (detectionInfoData.Location == 2) {
                            let tnode = detectionInfoData.TypedNode; // e.g.  ".css?contenthash="
                            // Same thing, but for the .css file loader, shortly after the -json.js file loader
                            let patched = context.factory.createStringLiteral(".css?_contenthash_=");
                            if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                                ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                            return patched;
                        }
                    }, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Detections
                    // ____________________________________________________________________________________________________
                    //
                    [
                        //
                        // -json.js files (localized strings)
                        //
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.StringLiteral) // e.g.  ".js?contenthash="
                             {
                                let tnode = node;
                                if (tnode.text == ".js?contenthash=") // unique string, only appears once in friends.js
                                 {
                                    return new Patches.DetectionInfo(true, {
                                        "Location": 1,
                                        "TypedNode": tnode,
                                    });
                                }
                            }
                        },
                        //
                        // .css files
                        //
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.StringLiteral) // e.g.  ".css?contenthash="
                             {
                                let tnode = node;
                                if (tnode.text == ".css?contenthash=") // unique string, only appears once in friends.js
                                 {
                                    return new Patches.DetectionInfo(true, {
                                        "Location": 2,
                                        "TypedNode": tnode,
                                    });
                                }
                            }
                        },
                    ]);
                }
            }
            Definitions.DisableContenthashGetParamOnFetchesCPDF = DisableContenthashGetParamOnFetchesCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Fix the friend invitations list having blank items for requests received before the invitations list was opened for the first time
/*

    ----- Target -----
    
    1.  (8825046: line 26825 :: in the render() method directly below a componentDidUpdate() method and a ToggleOfflineSortMethod() method)
        render() {
            var e, t, n, i, r, a, l;
            let m = this.props.searchString && this.props.searchString.length > 0,
                u = m,
            ...
      =>
        render() {
            try
            {
                if (this.IsInviteGroup())
                {
                    // Run this every 0.5 seconds as long as the invite list is open
                    let now = Date.now()
                    let forceUpdateInterval = 500;
                    if (this.__TFP_BrokenValveCodeWorkaround_TimeOfLastSetTimeout == null || now > this.__TFP_BrokenValveCodeWorkaround_TimeOfLastSetTimeout + forceUpdateInterval)
                    {
                        this.__TFP_BrokenValveCodeWorkaround_TimeOfLastSetTimeout = now;
                        let localThis = this;
                        setTimeout(function () {
                            localThis.forceUpdate();
                        }, forceUpdateInterval);
                    }
                }
            }
            catch (e) { }
            var e, t, n, i, r, a, l;
            let m = this.props.searchString && this.props.searchString.length > 0,
                u = m,
            ...

    
    ----- Notes -----
    
    See notes in FixBrokenInviteListAutoCloseOnDone first.
    Valve broke multiple things in the friend invitations list with their 8791341 update. This is another one of their fuckups in the same vein.

    Because Valve no longer invokes the 10-method deep react getter methods for parts of FriendStore, their lack of properly signalling to redraw the associated visuals means some are no longer being redrawn at all.
    One of the affected things are the items in the friends requests/invitations list.

    When steam-chat.com launches, it finds all invitations sent before it was launched. It then dislays them in the invitiations list if the user clicks on the waving avatar icon.
    In 8782155 and earlier, this worked.

    8791341 broke this. Now these invitiation items are never redrawn from the initial empty state and thus appear invisible - until the user clicks on something which triggers a property access which triggers a refresh and thus redraw of the affected items.

    Unlike FixBrokenInviteListAutoCloseOnDone, the fix for this is not obvious. It's not clear which piece of altered/removed Valve bastardized js is the key to the puzzle.
    So I've come up with my own simply fix for now.

    react provides some "forceUpdate" method, which causes the object to tag itself for redrawing. If we call this at some point after the user opens the invitations list, it will force the invisible items to redraw themselves and become visible.

    The top of the target site render() method is a serviceable choice. This render() method is called upon the user clicking the waving avatar icon to open the invitations list.

    However, care must be taken NEVER to call forceUpdate() within a call stack that originated from a react update, or else react shits the bed and goes into an infinite loop.
    As such, we set an ugly timeout and call forceUpdate() in there.
    And so the next iteration of the react message loop causes a redraw of the invitations list, making the invisible items become visible again.

    Related: see FixBrokenInviteListAutoCloseOnDone.

    
    ----- Range -----

    Unneeded: 8782155 and earlier.
              - Everything worked before Valve fucked it up in this update

    Since: 8791341.

    Until: At least 8825046.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            class FixBrokenInviteListInviteItemsCPDF extends Patches.ConfiguredPatchDefinitionFactory {
                constructor() {
                    super(...arguments);
                    this.PatchIdName = "FixBrokenInviteListInviteItems";
                }
                CreatePatchDefinition() {
                    return new Patches.PatchDefinition(this.PatchIdName, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        let tnode = detectionInfoData.TypedNode; // body of the render() method
                        // Insert required statements at the very start of the method
                        let snippetJs = `
						try
						{
							if (this.IsInviteGroup())
							{
								// Run this every 0.5 seconds as long as the invite list is open
								let now = Date.now()
								let forceUpdateInterval = 500;
								if (this.__TFP_BrokenValveCodeWorkaround_TimeOfLastSetTimeout == null || now > this.__TFP_BrokenValveCodeWorkaround_TimeOfLastSetTimeout + forceUpdateInterval)
								{
									this.__TFP_BrokenValveCodeWorkaround_TimeOfLastSetTimeout = now;
									let localThis = this;
									setTimeout(function () {
										localThis.forceUpdate();
									}, forceUpdateInterval);
								}
							}
						}
						catch (e) { }
                    `;
                        let snippetSourceFile = ts.createSourceFile("snippet.js", snippetJs, ts.ScriptTarget.ES2015, /*setParentNodes*/ false, ts.ScriptKind.JS);
                        // Keep setParentNodes=false to avoid garbage in emit from printer.PrintFile()
                        let newStatements = snippetSourceFile.statements.concat(tnode.statements);
                        return context.factory.updateBlock(tnode, newStatements);
                    }, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Detections
                    // ____________________________________________________________________________________________________
                    //
                    [
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.Block) // e.g. body of  render()
                             {
                                let tnode = node;
                                if (tnode.parent != null && tnode.parent.kind == ts.SyntaxKind.MethodDeclaration) // e.g.  render()
                                 {
                                    let method = tnode.parent;
                                    if (method.name.kind == ts.SyntaxKind.Identifier && method.name.escapedText == "render") {
                                        // There are over 300 render() methods in friends.js
                                        if (method.body.statements.length >= 2) {
                                            let statement1 = method.body.statements[1];
                                            if (statement1.kind == ts.SyntaxKind.VariableStatement) {
                                                /* e.g.
                                                    let m = this.props.searchString && this.props.searchString.length > 0,
                                                        u = m,
                                                        p = this.IsCollapsed() && !m && !this.state.friendDrag,
                                                        _ = [],
                                                        g = this.IsInviteGroup(),
                                                        C = this.props.group.m_eDisplayType == c.h1.eOfflineOnly,
                                                        f = !1;
                                                */
                                                let varDecList = statement1.declarationList;
                                                let matchedVarDec = false;
                                                if (varDecList.declarations.length >= 2) {
                                                    for (let varDec of varDecList.declarations) {
                                                        if (varDec.initializer != null) {
                                                            // Validate declaration:  p = this.IsCollapsed() && !m && !this.state.friendDrag,
                                                            // The  this.IsCollapsed  call and  this.state.friendDrag  access in a var dec is unique to this render() method among all other render() methods
                                                            if (varDec.initializer.kind == ts.SyntaxKind.BinaryExpression) // e.g.  this.IsCollapsed() && !m && !this.state.friendDrag
                                                             {
                                                                let initializer = varDec.initializer;
                                                                let initializerJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, initializer, sourceFile);
                                                                if (initializerJs.includes(".IsCollapsed()") && initializerJs.includes(".state.friendDrag")) {
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
                                }
                            }
                        }
                    ]);
                }
            }
            Definitions.FixBrokenInviteListInviteItemsCPDF = FixBrokenInviteListInviteItemsCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Fix the friend invitations list not closing & returning to the main friends list after accepting or ignoring all incoming invitations
/*

    ----- Target -----
    
    1.  (8825046: line 26141 :: in the render() method directly below a componentDidUpdate() method and a SignIn() method)
        render() {
            let e = this.props.friends.self,
                t = this.GetNormalizedSearchString(),
                n = this.state.bFriendTabSearch,
                i = "friendTab socialListTab activeTab";
            n && (i += " TabSearchActive");
            let r = {};
            ...
      =>
        render() {
            let zzz1 = d.Ul.FriendStore.FriendGroupStore.incoming_invites_group.member_count > 0,
                zzz2 = d.Ul.FriendStore.ClanStore.clan_invites.length > 0,
                zzz3 = d.Ul.FriendStore.FriendGroupStore.outgoing_invites_group.member_count > 0,
                zzz4 = d.Ul.FriendStore.FriendGroupStore.incoming_invites_group.member_count + d.Ul.FriendStore.ClanStore.clan_invites.length;
            let e = this.props.friends.self,
                t = this.GetNormalizedSearchString(),
                n = this.state.bFriendTabSearch,
                i = "friendTab socialListTab activeTab";
            n && (i += " TabSearchActive");
            let r = {};

    
    ----- Notes -----
    
    Yet Valve fuckup along the lines of "we make billions of dollars hand of over fist but we cannot be fucked to test our code even once to make sure it runs correctly"
    In this case, it's Valve dependency on their shit usage of a shit library causing something to work correctly by accident. Valve later changed their shit code and thus broke the thing that was depending on their shit code.

    The shit library is react. Evidently, it manifests some form of property update notification system that does not handle edge cases. Given that react comes from the retards "programming" facebook's website, who use identifier names like "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED" (<-- this is real btw), honestly it's not that surprising.

    The shit Valve code is their triggering of this system, which may or may not be performed incorrectly, and their depedency fucking it up.

    In 8782155, the start of the target render() method looks like this:
        let e = this.props.friends.self,
            t = this.GetNormalizedSearchString(),
            n = d.Ul.FriendStore.FriendGroupStore.incoming_invites_group.member_count > 0,
            i = d.Ul.FriendStore.ClanStore.clan_invites.length > 0,
            r = d.Ul.FriendStore.FriendGroupStore.outgoing_invites_group.member_count > 0,
            a = d.Ul.FriendStore.FriendGroupStore.incoming_invites_group.member_count + d.Ul.FriendStore.ClanStore.clan_invites.length,
            s = "friendRequestButton";
        this.state.bViewingIncomingInvites && (s += " friendRequestViewActive"), r && 0 == a && (s += " friendRequestOutgoingOnly");
        let l = this.state.bFriendTabSearch,
            c = "friendTab socialListTab activeTab";
        l && (c += " TabSearchActive");

    In 8791341, it looks like this:
        let e = this.props.friends.self,
            t = this.GetNormalizedSearchString(),
            n = this.state.bFriendTabSearch,
            i = "friendTab socialListTab activeTab";
        n && (i += " TabSearchActive");

    If this was a sane world created by sane people, there would be no problem here. Ha. Ha.

    These four property accessors are the crux of the problem:
        n = d.Ul.FriendStore.FriendGroupStore.incoming_invites_group.member_count > 0,
        i = d.Ul.FriendStore.ClanStore.clan_invites.length > 0,
        r = d.Ul.FriendStore.FriendGroupStore.outgoing_invites_group.member_count > 0,
        a = d.Ul.FriendStore.FriendGroupStore.incoming_invites_group.member_count + d.Ul.FriendStore.ClanStore.clan_invites.length,

    1. In the relevant render() method, Valve accesses each property and does absolutely nothing with the return value. Already a sign of good, quality programming.

    2. These properties are getters that spiral down into a rabbit hole of react callbacks and triggers. One of those triggers is setting some "componentDidUpdate" flag on the object.

    3. Valve uses the react callback for "componentDidUpdate" to close the invitations list when the user accepts or ignores all invitations.

    4. Starting in 8791341, Valve removed the "pointless" property accesses that did nothing with the return value.
       As a result, the the react callback for "componentDidUpdate" will now never fire in this scenario, because render() is no longer making react run its 10-function deep getter methods on the properties which trigger componentDidUpdate.

    5. The invitations list remains open and requires the user to manually close & reopen the friends list or start searching for a friend name in order to unfuck it back to displaying all friends


    And, as of 8825046, the bug still exists. There is a full month worth of Valve updates between 8791341 and 8825046, but evidently 10,000,000,000 dollars is still not enough to test 4 fucking lines of code.

    This bug can be observed right now by anyone in any browser, by going to steamcommunity.com/chat and getting a friends request. It's not specific to running in FriendsUI.


    The fix is to reintroduce the "pointless" property access statemetns.

    
    To prevent users from incorrectly attributing this Valve fuck up to being the fault of FixedSteamFriendsUI, I have spent 5 hours diagnosing and fixing Valve's retard code. Fuck you Valve.

    
    Related: see FixBrokenInviteListInviteItems.

    
    ----- Range -----
    
    Unneeded: 8782155 and earlier.
              - Everything worked before Valve fucked it up in this update

    Since: 8791341.

    Until: At least 8825046.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            class FixBrokenInviteListAutoCloseOnDoneCPDF extends Patches.ConfiguredPatchDefinitionFactory {
                constructor() {
                    super(...arguments);
                    this.PatchIdName = "FixBrokenInviteListAutoCloseOnDone";
                }
                CreatePatchDefinition() {
                    return new Patches.PatchDefinition(this.PatchIdName, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        let tnode = detectionInfoData.TypedNode; // body of the render() method
                        let friendStoreAccess = detectionInfoData.FriendStoreAccess; // e.g.  d.Ul.FriendStore
                        let friendStoreAccessJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, friendStoreAccess, sourceFile);
                        // Insert required statements at the very start of the method
                        let newStatements = tnode.statements.slice();
                        let snippetJs = `
						let zzz1 = ${friendStoreAccessJs}.FriendGroupStore.incoming_invites_group.member_count > 0,
							zzz2 = ${friendStoreAccessJs}.ClanStore.clan_invites.length > 0,
							zzz3 = ${friendStoreAccessJs}.FriendGroupStore.outgoing_invites_group.member_count > 0,
							zzz4 = ${friendStoreAccessJs}.FriendGroupStore.incoming_invites_group.member_count + ${friendStoreAccessJs}.ClanStore.clan_invites.length;
                    `; // local names that are unlikely to collide
                        let snippetSourceFile = ts.createSourceFile("snippet.js", snippetJs, ts.ScriptTarget.ES2015, /*setParentNodes*/ false, ts.ScriptKind.JS);
                        // Bizzarely, if setParentNodes=true, typescript fucks up and emits "> {" instead of "> 0" for zzz3, but only in printer.PrintFile, never in printer.PrintNode. Evidently it doesn't care to reevaluate parent nodes when transferring a node from one source file to another, which appear to use a simple incrementing integer as a unique identity only in the context of their origin source file. Which ends up pointing to garbage in other files.
                        let patchNode = snippetSourceFile.statements[0]; // Extract the node we want from the implicit statement wrapper it's inside of
                        newStatements.splice(0, 0, patchNode);
                        return context.factory.updateBlock(tnode, newStatements);
                    }, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Detections
                    // ____________________________________________________________________________________________________
                    //
                    [
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.Block) // e.g. body of  render()
                             {
                                let tnode = node;
                                if (tnode.parent != null && tnode.parent.kind == ts.SyntaxKind.MethodDeclaration) // e.g.  render()
                                 {
                                    let method = tnode.parent;
                                    if (method.name.kind == ts.SyntaxKind.Identifier && method.name.escapedText == "render") {
                                        // There are over 300 render() methods in friends.js
                                        if (method.body.statements.length > 0) {
                                            let statement0 = method.body.statements[0];
                                            if (statement0.kind == ts.SyntaxKind.VariableStatement) // e.g.  let e = this.props.friends.self ...
                                             {
                                                let varDecList = statement0.declarationList;
                                                let matchedVarDecA = false;
                                                let matchedVarDecB = false;
                                                if (varDecList.declarations.length >= 2) {
                                                    for (let varDec of varDecList.declarations) {
                                                        if (varDec.initializer != null) {
                                                            // Validate declaration:  e = this.props.friends.self
                                                            if (varDec.initializer.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  this.props.friends.self
                                                             {
                                                                let initializer = varDec.initializer;
                                                                if (initializer.name.kind == ts.SyntaxKind.Identifier && initializer.name.escapedText == "self") {
                                                                    let initializerJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, initializer, sourceFile);
                                                                    if (initializerJs.endsWith(".props.friends.self")) {
                                                                        // There only 2 render() methods with their first statement as a var declaration list and  let e = this.props.friends.self  as one of those vars
                                                                        matchedVarDecA = true;
                                                                    }
                                                                }
                                                            }
                                                            // Validate declaration:  t = this.GetNormalizedSearchString()
                                                            else if (varDec.initializer.kind == ts.SyntaxKind.CallExpression) // e.g.  this.GetNormalizedSearchString()
                                                             {
                                                                let initializer = varDec.initializer;
                                                                if (initializer.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
                                                                    let thingToCall = initializer.expression;
                                                                    if (thingToCall.name.kind == ts.SyntaxKind.Identifier && thingToCall.name.escapedText == "GetNormalizedSearchString") {
                                                                        // The other render() method doesn't have this var dec
                                                                        matchedVarDecB = true;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                                if (matchedVarDecA && matchedVarDecB) {
                                                    // The patch code needs to access d.Ul.FriendStore, so we need to find a property access node for that
                                                    // There is one we can use from later in the method body:  const v = d.Ul.FriendStore.BIsOfflineMode(),
                                                    let friendStoreAccess = null;
                                                    for (let statement of tnode.statements) {
                                                        if (statement.kind == ts.SyntaxKind.VariableStatement) // e.g.  const v = d.Ul.FriendStore.BIsOfflineMode(), S = a
                                                         {
                                                            for (let varDec of statement.declarationList.declarations) {
                                                                if (varDec.initializer != null && varDec.initializer.kind == ts.SyntaxKind.CallExpression) // e.g.  d.Ul.FriendStore.BIsOfflineMode()
                                                                 {
                                                                    let call = varDec.initializer;
                                                                    if (call.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  d.Ul.FriendStore.BIsOfflineMode
                                                                     {
                                                                        let propertyAccess1 = call.expression;
                                                                        if (propertyAccess1.name.kind == ts.SyntaxKind.Identifier && propertyAccess1.name.escapedText == "BIsOfflineMode") {
                                                                            if (propertyAccess1.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  d.Ul.FriendStore
                                                                             {
                                                                                let propertyAccess2 = propertyAccess1.expression;
                                                                                if (propertyAccess2.name.kind == ts.SyntaxKind.Identifier && propertyAccess2.name.escapedText == "FriendStore") {
                                                                                    friendStoreAccess = propertyAccess2;
                                                                                    break;
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                    if (friendStoreAccess != null) {
                                                        return new Patches.DetectionInfo(true, {
                                                            "TypedNode": tnode,
                                                            "FriendStoreAccess": friendStoreAccess,
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
                }
            }
            Definitions.FixBrokenInviteListAutoCloseOnDoneCPDF = FixBrokenInviteListAutoCloseOnDoneCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Fix some IsMaximized() method calling this.m_popup.SteamClient.Window.IsWindowMinimized instead of this.m_popup.SteamClient.Window.IsWindowMaximized
/*

    ----- Targets -----
    
    1.  (8601984: line 34511 :: in the IsMaximized() method near Ctrl+F for "get focused() {")
        this.m_popup && !this.m_popup.closed && this.m_popup.SteamClient && this.m_popup.SteamClient.Window && this.m_popup.SteamClient.Window.IsWindowMinimized
      =>
        this.m_popup && !this.m_popup.closed && this.m_popup.SteamClient && this.m_popup.SteamClient.Window && this.m_popup.SteamClient.Window.IsWindowMaximized

    
    ----- Notes -----
    
    So this is yet another one of Valve's pathetic "we make billions of dollars hand of over fist but we cannot be fucked to spend 5 seconds testing or proofreading our copy & paste code" errors
    And it causes errors when running under the Dec 2022 client, where IsWindowMaximized does not exist for some reason

    Fixing Valve's idiot code doesn't make IsWindowMaximized always magically exist, but it falsey automatic null for this nonexistent property isn't causing problems, and since Valve likes abusing this (anti-)feature of javascript, it's very possible that some code downstream of this actually depends on that.

    
    ----- Range -----

    Since: 8200419 or earlier.

    Until: Sometime between 8601984 and 8811541.
           - Circa 8811541, Valve finally "fixed" this bug, by way of completely rewriting the IsMinimized() and IsMaximized() methods for this type. The rewrite involves a new guarded access paradigm to members of SteamClient, which at first might seem good since it would save me the work of writing a shim patch to do the same thing. Unfortunately, the exact oppposite is true. See patch RewriteSteamClientWindowNewGetterPromises.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            class FixBrokenIsMaximizedCopypastaCPDF extends Patches.ConfiguredPatchDefinitionFactory {
                constructor() {
                    super(...arguments);
                    this.PatchIdName = "FixBrokenIsMaximizedCopypasta";
                }
                CreatePatchDefinition() {
                    return new Patches.PatchDefinition(this.PatchIdName, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        let tnode = detectionInfoData.TypedNode; // e.g.  this.m_popup.SteamClient.Window.IsWindowMinimized
                        // Change the "IsWindowMinimized" identifier to "IsWindowMaximized"
                        let patched = context.factory.updatePropertyAccessExpression(tnode, tnode.expression, context.factory.createIdentifier("IsWindowMaximized"));
                        if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                            ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                        return patched;
                    }, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Detections
                    // ____________________________________________________________________________________________________
                    //
                    [
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  this.m_popup.SteamClient.Window.IsWindowMinimized
                             {
                                let tnode = node; // e.g.  
                                if (tnode.parent != null && tnode.parent.kind == ts.SyntaxKind.BinaryExpression) // e.g.  this.m_popup.SteamClient.Window && this.m_popup.SteamClient.Window.IsWindowMinimized
                                 {
                                    // Last binary expression in the long && chain:  this.m_popup && !this.m_popup.closed && this.m_popup.SteamClient && this.m_popup.SteamClient.Window && this.m_popup.SteamClient.Window.IsWindowMinimized
                                    let andChainLast = tnode.parent;
                                    if (andChainLast.operatorToken.kind == ts.SyntaxKind.AmpersandAmpersandToken) // && operator
                                     {
                                        // Validate the expected method that we are inside
                                        // This will save execution time wasted on stringifying a lot of unnecessary ast in the next validation stage
                                        let methodNode = Patches.AstFindFirstAncestor(tnode, ts.SyntaxKind.MethodDeclaration); // e.g.  the expected IsMaximized() method that contains the expression we're looking for
                                        if (methodNode != null) {
                                            let methodTNode = methodNode;
                                            if (methodTNode.name.kind == ts.SyntaxKind.Identifier) // e.g.  IsMaximized
                                             {
                                                let methodTNodeName = methodTNode.name;
                                                if (methodTNodeName.escapedText == "IsMaximized") {
                                                    // Validate the long && chain expression
                                                    // We are simply going to check if it's a match by stringifying it and comparing that
                                                    let js = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, tnode, sourceFile);
                                                    if (js == "this.m_popup.SteamClient.Window.IsWindowMinimized") {
                                                        // All but guaranteed match
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
                }
            }
            Definitions.FixBrokenIsMaximizedCopypastaCPDF = FixBrokenIsMaximizedCopypastaCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Fix black frame bug when steam-chat.com is running under Steam clients that don't create "popup-created" signals
/*

    ----- Targets -----

    1.  (8601984: line 34417 :: within the Show(e = d.IF.k_EWindowBringToFrontAndForceOS) method)
        r && (this.OnCreateInternal(), t != d.IF.k_EWindowBringToFrontInvalid && this.Focus(t))
      =>
        r ? (this.OnCreateInternal(), t != d.IF.k_EWindowBringToFrontInvalid && this.Focus(t)) : this.OnCreateInternal()

    
    ----- Notes -----
    
    The notable manifestation of this bug is the solid black Friends List under the Dec 2022 Steam client. Everything is loaded and running properly in the background, but the frame never renders itself and thus is solid black.

    When running under Steam clients that never raise the "popup-created" event, the inner frame will never render itself since m_bCreated will never be set to true
    The solution ternary is adapted from 8200419, where it is Valve's solution to that problem. Valve removed this by the time of 8601984 and replaced it with the "r &&" block isntead, so we are bringing it back (but with alterations)
    Verbatim, the 8200419 ternary includes a nasty call to some "SteamInitPopups" method. In the context provided by 8200419, this works without issue. In the context here of 8601984, this causes problems: all windows spawned by the inner frame steal focus upon creation. Despite the code here in Show() having zero functional changes between 8200419 and 8601984, that focus stealing problem was still somehow conceived, indicating that the context surrounding the use of this Show() function has changed (in some unknown way). Removing the use of SteamInitPopups appears to fix the problem, which is closer to vanilla 8601984 anyways.

    So the ultimate fix here is to ensure OnCreateInternal() is always called in the Show(e = d.IF.k_EWindowBringToFrontAndForceOS) method. And we want to do that without disrupting the logic of the disgusting javascript in this area.
    
    For more info see #9 and #10 on gh.

    
    ----- Range -----

    Since: Whichever version between 8200419 and 8601984 made the change noted above.

    Until: At least 8811541.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            class FixBlackFrameBugCPDF extends Patches.ConfiguredPatchDefinitionFactory {
                constructor() {
                    super(...arguments);
                    this.PatchIdName = "FixBlackFrameBug";
                }
                CreatePatchDefinition() {
                    return new Patches.PatchDefinition(this.PatchIdName, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        let tnode = detectionInfoData.TypedNode; // e.g.  r && (this.OnCreateInternal(), t != d.IF.k_EWindowBringToFrontInvalid && this.Focus(t))
                        // Convert the && expression into a ternary
                        // The right side of the original && expr will be the true ternary path
                        // We will add the bugfix logic to the false ternary path
                        let falsePath = context.factory.createCallExpression(// this.OnCreateInternal()
                        context.factory.createPropertyAccessExpression(// this.OnCreateInternal
                        context.factory.createThis(), context.factory.createIdentifier("OnCreateInternal")), null, []);
                        let patched = context.factory.createConditionalExpression(// e.g.  r ? (this.OnCreateInternal(), t != d.IF.k_EWindowBringToFrontInvalid && this.Focus(t)) : this.OnCreateInternal()
                        tnode.left, // e.g.  r
                        context.factory.createToken(ts.SyntaxKind.QuestionToken), tnode.right, context.factory.createToken(ts.SyntaxKind.ColonToken), falsePath);
                        if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                            ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                        return patched;
                    }, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Detections
                    // ____________________________________________________________________________________________________
                    //
                    [
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.BinaryExpression) // e.g.  r && (this.OnCreateInternal(), t != d.IF.k_EWindowBringToFrontInvalid && this.Focus(t))
                             {
                                let tnode = node;
                                if (tnode.operatorToken.kind == ts.SyntaxKind.AmpersandAmpersandToken) // && operator
                                 {
                                    // Validate the expected show method that we are inside
                                    // This will save execution time wasted on stringifying a lot of unnecessary ast in the next validation stage
                                    let methodNode = Patches.AstFindFirstAncestor(tnode, ts.SyntaxKind.MethodDeclaration); // e.g.  the expected Show(e = d.IF.k_EWindowBringToFrontAndForceOS) method that contains the expression we're looking for
                                    if (methodNode != null) {
                                        let methodTNode = methodNode;
                                        if (methodTNode.name.kind == ts.SyntaxKind.Identifier) // e.g.  Show
                                         {
                                            let methodTNodeName = methodTNode.name;
                                            if (methodTNodeName.escapedText == "Show") {
                                                // Validate the right half of the r && expression
                                                let right = tnode.right; // e.g.  (this.OnCreateInternal(), t != d.IF.k_EWindowBringToFrontInvalid && this.Focus(t))
                                                // Currently, this is a ParenthesizedExpression, but this could change
                                                // We are simply going to check if it's a match by stringifying it and looking for (semi-)constant keywords in the js
                                                let rightJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, right, sourceFile);
                                                if (rightJs.includes("OnCreateInternal") && rightJs.includes("WindowBringToFrontInvalid") && rightJs.includes("Focus")) {
                                                    // All but guaranteed match
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
                    ]);
                }
            }
            Definitions.FixBlackFrameBugCPDF = FixBlackFrameBugCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Disable broken (t.m_BlurHandler = () => { this.HideByElement(t.m_OwningElement); }) code in the ShowPopup() handler for miniprofiles
/*

    ----- Targets -----

    1.  (8601984: line 13927)
        (t.m_BlurHandler = () => {
            this.HideByElement(t.m_OwningElement);
        }),
      =>
        (t.m_BlurHandler = () => {
            // removed
        }),

    
    ----- Notes -----

    This appears to be Valve's attempt to add a visual effect when a miniprofile is displayed.
    I don't know what the intended effect is, but it possibly is meant to blur the parent window which created the miniprofile, which would be pretty retarded.

    Regardless, it doesn't work properly in the December 2022 client. It ends up making the miniprofile immediately close itself, since the miniprofile's m_OwningElement is itself. But only when the window which created the miniprofile popup has focus. If a different window has focus, the miniprofile works properly. Clearly a symptom of some more rootward problem.

    This problem does not occur in the May 2023 client.

    This effect appears to be written expressly for pure shit steam clients and thus has no reason to attempt itself on vgui capable Steam clients. In fact, despite not causing any problems in the May 2023, it does absolutely nothing to affect the look & behavior of the miniprofiles. They are the same whether or not this code is disabled/enabled.
    Accordingly, disabling this code fixes the aforementioned issue under the Dec 2022 client and renders no changes to the unaffected clients.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            class DisableMiniprofileBrokenBlurHandlerCPDF extends Patches.ConfiguredPatchDefinitionFactory {
                constructor() {
                    super(...arguments);
                    this.PatchIdName = "DisableMiniprofileBrokenBlurHandler";
                }
                CreatePatchDefinition() {
                    return new Patches.PatchDefinition(this.PatchIdName, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        let tnode = detectionInfoData.TypedNode; // e.g.  { this.HideByElement(t.m_OwningElement); }
                        let targetStatement = detectionInfoData.TargetStatement; // e.g.  this.HideByElement(t.m_OwningElement);
                        let targetStatementJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, targetStatement, sourceFile);
                        // Remove target statement from function body and insert comment of old JS
                        let newStatements = [];
                        tnode.statements.forEach((statement, index) => {
                            if (statement == targetStatement) {
                                if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites) {
                                    let commentAnchorStatement = context.factory.createEmptyStatement(); // afaik this is the only way to insert a line-exclusive comment in all scenarios, including when there are no other statements to anchor it to (i.e. the removed target statement was the only statement in the function body)
                                    newStatements.push(commentAnchorStatement);
                                    ts.addSyntheticLeadingComment(commentAnchorStatement, ts.SyntaxKind.MultiLineCommentTrivia, targetStatementJs, false);
                                }
                            }
                            else {
                                newStatements.push(statement);
                            }
                        });
                        return context.factory.updateBlock(tnode, newStatements);
                    }, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Detections
                    // ____________________________________________________________________________________________________
                    //
                    [
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.Block) // e.g.  { this.HideByElement(t.m_OwningElement); }
                             {
                                let tnode = node;
                                let matchedStatement = null;
                                for (let statement of tnode.statements) // e.g.  this.HideByElement(t.m_OwningElement);
                                 {
                                    let statementJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, statement, sourceFile);
                                    if (statementJs.includes("HideByElement")) // not a precise detection, but it's highly unlikely to collide
                                     {
                                        matchedStatement = statement;
                                        break;
                                    }
                                }
                                if (matchedStatement != null) {
                                    if (tnode.parent.kind == ts.SyntaxKind.ArrowFunction) // e.g.  () => { this.HideByElement(t.m_OwningElement); }
                                     {
                                        // Currently this is an ArrowFunction in valve's bastardized js, but it might change)
                                        let func = tnode.parent;
                                        if (func.parent.kind == ts.SyntaxKind.BinaryExpression) // e.g.  t.m_BlurHandler = () => { this.HideByElement(t.m_OwningElement); }
                                         {
                                            let memberFuncAssign = func.parent;
                                            if (memberFuncAssign.left.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  t.m_BlurHandler
                                             {
                                                let memberProperty = memberFuncAssign.left;
                                                if (memberProperty.name.kind == ts.SyntaxKind.Identifier) // e.g.  m_BlurHandler
                                                 {
                                                    let memberPropertyName = memberProperty.name;
                                                    if (memberPropertyName.escapedText == "m_BlurHandler") {
                                                        return new Patches.DetectionInfo(true, {
                                                            "TypedNode": tnode,
                                                            "TargetStatement": matchedStatement,
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
                }
            }
            Definitions.DisableMiniprofileBrokenBlurHandlerCPDF = DisableMiniprofileBrokenBlurHandlerCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    CDN asset fetch url rewriting
/*

    ----- Generic Target Examples -----

    1.  u.Ul.AudioPlaybackManager.PlayAudioURL( o.De.COMMUNITY_CDN_URL + "public/sounds/webui/steam_voice_channel_enter.m4a?v=1" )
      =>
        u.Ul.AudioPlaybackManager.PlayAudioURL( TFP.Resources.SelectCdnResourceUrl(o.De.COMMUNITY_CDN_URL, "public/sounds/webui/steam_voice_channel_enter.m4a?v=1", "Root", "JsSounds") )

    
    ----- Specific Targets -----

    1. (8601984: line 58917 :: css file loader)
        if ("undefined" != typeof document) {
            var e = (e) =>
                    new Promise((t, n) => {
                        var i = s.miniCssF(e),
                            o = s.p + i;
                        if (
                            ((e, t) => {
                                for (var n = document.getElementsByTagName("link"), i = 0; i < n.length; i++) { ...
      =>
        if ("undefined" != typeof document) {
            var e = (e) =>
                    new Promise((t, n) => {
                        var i = s.miniCssF(e),
                            o = TFP.Resources.SelectCdnResourceUrl(s.p, i, "Root_Public", "JsCss");
                        if (
                            ((e, t) => {
                                for (var n = document.getElementsByTagName("link"), i = 0; i < n.length; i++) {
    
    
    ----- Notes -----
    
    In order for the snapshot to be 100% local, all resource fetches must go to steamloopback.host instead of the remote Valve servers.
    We achieve that by inserting a shim method in all locations where Valve's js builds url path strings. The shim method will return a different url that originates from the steamloopback.host.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            class RewriteCdnAssetUrlStringBuildCPDF extends Patches.ConfiguredPatchDefinitionFactory {
                constructor() {
                    super(...arguments);
                    this.PatchIdName = "RewriteCdnAssetUrlStringBuild";
                }
                CreatePatchDefinition(config) {
                    return new Patches.ConfiguredPatchDefinition(this.PatchIdName, config, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        // Common patch logic works for both Location 0 and Location 1
                        let tnode = detectionInfoData.TypedNode; // e.g.  o.De.COMMUNITY_CDN_URL + "public/sounds/webui/steam_voice_channel_enter.m4a?v=1"
                        let matchedTarget = detectionInfoData.MatchedTarget; // e.g.  ["public/sounds/webui/steam_voice_channel_enter.m4a", "Root", "JsSounds"]
                        // syntax for retrieving implicit nested interface type ^--^
                        let shimMethodId = config.ShimMethodIdentifierExpression;
                        if (matchedTarget.OverrideShimMethodIdentifierExpression != null && matchedTarget.OverrideShimMethodIdentifierExpression.length > 0)
                            shimMethodId = matchedTarget.OverrideShimMethodIdentifierExpression;
                        // Replace the binary expression with a method call that takes the original halves of the binary expr as arguments
                        let patched = context.factory.createCallExpression(context.factory.createIdentifier(shimMethodId), null, [
                            tnode.left,
                            tnode.right,
                            context.factory.createStringLiteral(matchedTarget.UrlRootPathType),
                            context.factory.createStringLiteral(matchedTarget.ResourceCategory),
                        ]); // e.g.  TFP.Resources.SelectCdnResourceUrl(o.De.COMMUNITY_CDN_URL, "public/sounds/webui/steam_voice_channel_enter.m4a?v=1", "Root", "JsSounds")
                        if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                            ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                        return patched;
                    }, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Detections
                    // ____________________________________________________________________________________________________
                    //
                    [
                        //
                        // Generic patch location
                        //
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.BinaryExpression) // e.g.  o.De.COMMUNITY_CDN_URL + "public/sounds/webui/steam_voice_channel_enter.m4a?v=1"
                             {
                                let tnode = node;
                                if (tnode.right.kind == ts.SyntaxKind.StringLiteral) // e.g.  "public/sounds/webui/steam_voice_channel_enter.m4a?v=1"
                                 {
                                    let rightTNode = tnode.right;
                                    let matchedTarget = config.Targets.find(item => item.ResourceUrl == SnapshotMakerTsJsRewriter.RemoveQueryTailFromUrl(rightTNode.text));
                                    if (matchedTarget != null) {
                                        return new Patches.DetectionInfo(true, {
                                            "Location": 1,
                                            "TypedNode": tnode,
                                            "MatchedTarget": matchedTarget,
                                        });
                                    }
                                }
                            }
                        },
                        //
                        // Specific patch location 1: css loader
                        //
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.BinaryExpression) // e.g.  s.p + i
                             {
                                let tnode = node;
                                // Validate url string build binary expression being part of the expected variable definition list
                                if (tnode.parent != null && tnode.parent.kind == ts.SyntaxKind.VariableDeclaration) // e.g.  [var] o = s.p + i
                                 {
                                    let parentVarDec = tnode.parent;
                                    if (parentVarDec.parent != null) // e.g.  var i = s.miniCssF(e), o = s.p + i;
                                     {
                                        let parentVarDecList = parentVarDec.parent;
                                        // Validate our expected location in the var dec list
                                        if (parentVarDecList.declarations.indexOf(parentVarDec) == 1) // 2nd declaration
                                         {
                                            // Validate the first item in the variable declaration list
                                            // This has the unique identifier miniCssF ("miniCssF" only appears in friends.js once)
                                            let dec0 = parentVarDecList.declarations[0];
                                            if (dec0.initializer != null && dec0.initializer.kind == ts.SyntaxKind.CallExpression) // e.g.  s.miniCssF(e)
                                             {
                                                let dec0InitCall = dec0.initializer;
                                                if (dec0InitCall.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  s.miniCssF
                                                 {
                                                    let dec0InitCallAccessExpression = dec0InitCall.expression;
                                                    if (dec0InitCallAccessExpression.name.kind == ts.SyntaxKind.Identifier && dec0InitCallAccessExpression.name.escapedText == "miniCssF") {
                                                        // Get config for this target
                                                        let matchedTarget = config.Targets.find(item => item.SpecialCase == "CssLoader");
                                                        if (matchedTarget != null) {
                                                            return new Patches.DetectionInfo(true, {
                                                                "Locaton": 2,
                                                                "TypedNode": tnode,
                                                                "MatchedTarget": matchedTarget,
                                                            });
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        //
                        // Specific patch location 2: js loader
                        //
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.BinaryExpression) // e.g.  s.p + s.u(t),
                             {
                                let tnode = node;
                                // Validate url string build binary expression being part of the expected variable definition list
                                if (tnode.parent != null && tnode.parent.kind == ts.SyntaxKind.VariableDeclaration) // e.g.  var r = s.p + s.u(t)
                                 {
                                    let parentVarDec = tnode.parent;
                                    if (parentVarDec.parent != null) // e.g.  var r = s.p + s.u(t), a = new Error();
                                     {
                                        let parentVarDecList = parentVarDec.parent;
                                        // Validate our expected location in the var dec list
                                        if (parentVarDecList.declarations.indexOf(parentVarDec) == 0) // 1st declaration
                                         {
                                            // Validate the second item in the variable declaration list
                                            // This has the almost unique signature of initializing a new Error() with zero ctor arguments
                                            if (parentVarDecList.declarations.length == 2) {
                                                let dec1 = parentVarDecList.declarations[1];
                                                if (dec1.initializer != null && dec1.initializer.kind == ts.SyntaxKind.NewExpression) // e.g.  new Error()
                                                 {
                                                    let dec0InitNew = dec1.initializer;
                                                    if (dec0InitNew.expression.kind == ts.SyntaxKind.Identifier) // e.g.  Error
                                                     {
                                                        let dec0InitNewTypeIndentifier = dec0InitNew.expression;
                                                        if (dec0InitNewTypeIndentifier.escapedText == "Error") {
                                                            if (dec0InitNew.arguments.length == 0) // e.g.  ()
                                                             {
                                                                // This node detection won't collide with the single other "new Error()" in friends.js, and unlikely to collide with later new Error() additions
                                                                // If we need more data to validate against, we can look into the if statement shortly after new Error(), which has unqiue string literals in it like "Loading chunk" and "ChunkLoadError"
                                                                // Get config for this target
                                                                let matchedTarget = config.Targets.find(item => item.SpecialCase == "JsLoader");
                                                                if (matchedTarget != null) {
                                                                    return new Patches.DetectionInfo(true, {
                                                                        "Locaton": 3,
                                                                        "TypedNode": tnode,
                                                                        "MatchedTarget": matchedTarget,
                                                                    });
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                    ]);
                }
            }
            Definitions.RewriteCdnAssetUrlStringBuildCPDF = RewriteCdnAssetUrlStringBuildCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Rewrite bare this.m_popup.SteamClient.Window.*() promise getters to old promise creator syntax
/*

    ----- Targets -----

    1.  (8811541: line 33706)
        return (0, v.w3)(this.m_popup, "Window.GetWindowRestoreDetails") && !this.m_popup.closed ? this.m_popup.SteamClient.Window.GetWindowRestoreDetails() : Promise.resolve("");
      =>
        return (0, v.w3)(this.m_popup, "Window.GetWindowRestoreDetails") && !this.m_popup.closed
            ? new Promise((e, t) => {
                    this.m_popup.SteamClient.Window.GetWindowRestoreDetails((t) => {
                        e(t);
                    });
                })
            : Promise.resolve("");

    2.  (8811541: line 33709)
        return (0, v.w3)(this.m_popup, "Window.IsWindowMinimized") && !this.m_popup.closed ? this.m_popup.SteamClient.Window.IsWindowMinimized() : Promise.resolve(!1);
      =>
        return (0, v.w3)(this.m_popup, "Window.IsWindowMinimized") && !this.m_popup.closed
            ? new Promise((e, t) => {
                    this.m_popup.SteamClient.Window.IsWindowMinimized((t) => {
                        e(t);
                    });
                })
            : Promise.resolve(!1);

    3.  (8811541: line 33712)
        return (0, v.w3)(this.m_popup, "Window.IsWindowMaximized") && !this.m_popup.closed ? this.m_popup.SteamClient.Window.IsWindowMaximized() : Promise.resolve(!1);
      =>
        return (0, v.w3)(this.m_popup, "Window.IsWindowMaximized") && !this.m_popup.closed
            ? new Promise((e, t) => {
                    this.m_popup.SteamClient.Window.IsWindowMaximized((t) => {
                        e(t);
                    });
                })
            : Promise.resolve(!1);

    
    ----- Notes -----
    
    Some time between 8601984 and 8811541, Valve released a Steam client update which changed how the SteamClient.Window.*() getter methods work.
    - In 8601984, these methods require a callback argument and return nothing
    - Circa 8811541, these methods now have zero arguments and return a promise
    
    Here we are patching a specific component of friends.js which uses these functions.

    Check the Targets list above. The original version of each item is the circa 8811541 version. The patched version of each item is its circa 8601984 equivalent.

    Since circa 8811541 blindly assumes these SteamClient.Window.* returns promises now despite the fact they don't do that in our target Steam clients, we have to reintroduce the old 8601984 logic. Our target Steam clients take a callback as an arg and return nothing. 8601984 understands this and uses it correctly, so we can simply copy+paste the 8601984 logic and everything works.

    This change to the Steam client and steam-chat.com seems very abrupt. 8811541 is ~4 months after 8601984. 8601984 is circa the December 2023 Steam client. And there is no dual logic in 8601984 to use both the old style and new style Window.* methods.
    From this information, we can infer that Valve very quickly rammed a Steam client down users' throats between Dec 2023 and Apr 2024 which changed the SteamClient.Window.* methods to return promises, and accordingly very quickly updated steam-chat.com to exclusively use the changed methods without any dual logic to continue supporting Steam clients yet to update.
    This is now part of a growing pile of evidence to Valve's disregard for users' who do not immediately take Steam client updates and thus get screwed by unconditional breaking changes in very small timeframes previously unheard of.

    >> Related: see patch RewriteSteamClientWindowNewGetterPromises.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            class RewriteEarly2024NewWindowGettersUsageCPDF extends Patches.ConfiguredPatchDefinitionFactory {
                constructor() {
                    super(...arguments);
                    this.PatchIdName = "RewriteEarly2024NewWindowGettersUsage";
                }
                CreatePatchDefinition(config) {
                    return new Patches.ConfiguredPatchDefinition(this.PatchIdName, config, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        let tnode = detectionInfoData.TypedNode; // e.g.  this.m_popup.SteamClient.Window.IsWindowMaximized()
                        /* Rewrite the target site like so:
                            new Promise((e, t) => {
                                this.m_popup.SteamClient.Window.IsWindowMaximized((t) => {
                                    e(t);
                                });
                            })
                        */
                        let memberToCallAccessJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, tnode.expression, sourceFile);
                        let snippetJs = `
                        new Promise((e, t) => {
							${memberToCallAccessJs}((t) => {
								e(t);
							});
						})
                    `;
                        let snippetSourceFile = ts.createSourceFile("snippet.js", snippetJs, ts.ScriptTarget.ES2015, /*setParentNodes*/ true, ts.ScriptKind.JS);
                        // setParentNodes MUST be true, otherwise typescript fucks up and fails to associate the nodes with their SourceFile, which causes ts.addSyntheticLeadingComment() to always complain and throw due to the missing source file
                        let patchNode = snippetSourceFile.statements[0].expression; // Extract the node we want from the implicit statement wrapper it's inside of
                        if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                            ts.addSyntheticLeadingComment(patchNode, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                        // Note: currently there is some screw up happening where typescript is duplicating the leading comment (i.e. valve copyright notice) of the sourceFile to the start of each emitted node using the node from this snippet file
                        // After hours of searching and tests, there is no clear fix to this, and the lack of quality information on the internet regarding the typescript compiler does not help at all
                        // It is obnoxious but does not break anything, so it gets to stay for now. I'd like to fix it eventually.
                        return patchNode;
                    }, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Detections
                    // ____________________________________________________________________________________________________
                    //
                    [
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.CallExpression) // e.g.  this.m_popup.SteamClient.Window.IsWindowMaximized()
                             {
                                let tnode = node;
                                // Validate call arguments
                                if (tnode.arguments.length == 0) {
                                    // Validate name of member to call
                                    if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  this.m_popup.SteamClient.Window.IsWindowMaximized
                                     {
                                        let memberToCall = tnode.expression;
                                        if (memberToCall.name.kind == ts.SyntaxKind.Identifier) // e.g.  IsWindowMaximized
                                         {
                                            let memberToCallName = memberToCall.name;
                                            let matchedTarget = config.Targets.find(item => item.NameOfMemberCallToRewrite == memberToCallName.escapedText);
                                            if (matchedTarget != null) {
                                                // Validate immediate qualification of member to call
                                                if (memberToCall.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  this.m_popup.SteamClient.Window
                                                 {
                                                    let memberToCallAccess = memberToCall.expression;
                                                    if (memberToCallAccess.name.kind == ts.SyntaxKind.Identifier && memberToCallAccess.name.escapedText == "Window") {
                                                        // Validate that the return value of the called member is not dereferenced
                                                        //   Yes: this.m_popup.SteamClient.Window.GetWindowRestoreDetails()
                                                        //   No:  this.m_popup.SteamClient.Window.GetWindowRestoreDetails().then(() => { ... })
                                                        let tnodeParent = tnode.parent;
                                                        if (tnodeParent != null && tnode.parent.kind != ts.SyntaxKind.PropertyAccessExpression) // this is not a comprehensive check and is only valid for this local target site
                                                         {
                                                            // Validate the location of this method call belonging to the matched target method definition
                                                            let method = Patches.AstFindFirstAncestor(tnode, ts.SyntaxKind.MethodDeclaration);
                                                            if (method != null) {
                                                                let methodT = method;
                                                                if (methodT.name.kind == ts.SyntaxKind.Identifier) {
                                                                    let methodName = methodT.name;
                                                                    if (methodName.escapedText == matchedTarget.OwningMethodName) {
                                                                        // Highly likely match
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
                                    }
                                }
                            }
                        }
                    ]);
                }
            }
            Definitions.RewriteEarly2024NewWindowGettersUsageCPDF = RewriteEarly2024NewWindowGettersUsageCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Rewrite e.SteamClient.Window.*().then() promise syntax to old callback syntax
/*

    ----- Target Examples -----

    1.  (8811541: line 56314)
        e.SteamClient.Window.IsWindowMaximized().then((e) => {
            n(e);
        })
      =>
        e.SteamClient.Window.IsWindowMaximized((e) => {
            n(e);
        });

    2.  (8811541: line 47421)
        i.SteamClient.Window.GetWindowRestoreDetails().then((e) => { ...
      =>
        i.SteamClient.Window.GetWindowRestoreDetails((e) => { ...

    
    ----- Notes -----
    
    Some time between 8601984 and 8811541, Valve released a Steam client update which changed how the SteamClient.Window.*() getter methods work.
    - In 8601984, these methods require a callback argument and return nothing
    - Circa 8811541, these methods now have zero arguments and return a promise
    
    Reconciling this change means rewriting all the  method().then(() => {})  call sites in 8811541+ to the old  method(then(() => {})  syntax which works on our target Steam clients.

    >> Related: see patch RewriteEarly2024NewWindowGettersUsage.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            class RewriteSteamClientWindowNewGetterPromisesCPDF extends Patches.ConfiguredPatchDefinitionFactory {
                constructor() {
                    super(...arguments);
                    this.PatchIdName = "RewriteSteamClientWindowNewGetterPromises";
                }
                CreatePatchDefinition() {
                    return new Patches.PatchDefinition(this.PatchIdName, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        let tnode = detectionInfoData.TypedNode;
                        /* e.g.
                            e.SteamClient.Window.IsWindowMaximized().then((e) => {
                                n(e);
                            })
                        */
                        let memberToCallRequiringThenFuncAsArgument = detectionInfoData.MemberToCallRequiringThenFuncAsArgument; // e.g. e.SteamClient.Window.IsWindowMaximized
                        let thenCallFunction = detectionInfoData.ThenCallFunction; // e.g.  (e) => { ne(e); }
                        // Move the thenCallFunction out of then()'s args and into the arguments of the SteamClient.*.Function()
                        let patched = context.factory.createCallExpression(memberToCallRequiringThenFuncAsArgument, // e.g.  e.SteamClient.Window.IsWindowMaximized
                        null, [
                            thenCallFunction,
                        ]);
                        /* e.g.
                            e.SteamClient.Window.IsWindowMaximized((e) => {
                                n(e);
                            })
                        */
                        if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                            ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                        return patched;
                    }, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Detections
                    // ____________________________________________________________________________________________________
                    //
                    [
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.CallExpression) {
                                /* e.g.
                                    e.SteamClient.Window.IsWindowMaximized().then((e) => {
                                        n(e);
                                    })
                                */
                                let tnode = node;
                                // Validate call().then structure
                                if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  e.SteamClient.Window.IsWindowMaximized().then
                                 {
                                    let thenChainAccess = tnode.expression;
                                    if (thenChainAccess.name.kind == ts.SyntaxKind.Identifier && thenChainAccess.name.escapedText == "then") {
                                        if (thenChainAccess.expression.kind == ts.SyntaxKind.CallExpression) // e.g.  e.SteamClient.Window.IsWindowMaximized()
                                         {
                                            let callBeforeChain = thenChainAccess.expression;
                                            if (callBeforeChain.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
                                                let propertyAccessToCall = callBeforeChain.expression;
                                                // e.g.
                                                // - e.SteamClient.Window.GetWindowRestoreDetails
                                                // - e.SteamClient.Window.IsWindowMinimized
                                                // - e.SteamClient.Window.IsWindowMaximized
                                                if (propertyAccessToCall.name.kind == ts.SyntaxKind.Identifier) {
                                                    // Validate property access of member to call before the then chain
                                                    let memberNameToCall = propertyAccessToCall.name;
                                                    let targets = ["GetWindowRestoreDetails", "IsWindowMinimized", "IsWindowMaximized"];
                                                    if (targets.indexOf(memberNameToCall.escapedText.toString()) != -1) {
                                                        let propertyAccessJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, propertyAccessToCall, sourceFile);
                                                        if (propertyAccessJs.includes("SteamClient.Window.")) {
                                                            // Validate callback to then()
                                                            if (tnode.arguments.length > 0) {
                                                                let thenCallFunction = tnode.arguments[0]; // e.g. (e) => { n(e); }
                                                                if (thenCallFunction.kind == ts.SyntaxKind.ArrowFunction) {
                                                                    // All but guaranteed match
                                                                    return new Patches.DetectionInfo(true, {
                                                                        "TypedNode": tnode,
                                                                        "MemberToCallRequiringThenFuncAsArgument": propertyAccessToCall,
                                                                        "ThenCallFunction": thenCallFunction,
                                                                    });
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    ]);
                }
            }
            Definitions.RewriteSteamClientWindowNewGetterPromisesCPDF = RewriteSteamClientWindowNewGetterPromisesCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Compat shim for SteamClient.Browser.GetBrowserID()
/*

    ----- Target Examples -----

    1.  SteamClient.Browser.GetBrowserID()
      =>
        TFP.Compat.SteamClient_Browser_GetBrowserID(SteamClient)

    2.  n.SteamClient.Browser.GetBrowserID()
      =>
        TFP.Compat.SteamClient_Browser_GetBrowserID(n.SteamClient)

    
    ----- Notes -----
    
    SteamClient.Window.GetBrowserID() and SteamClient.Browser.GetBrowserID() both do (presumably) the same thing.
    The Window version was used by steam-chat.com until May 2023 or earlier, when it was replaced by the Browser version.

    This reflects a change in the Steam client.
    - The Dec 2022 steam client includes the Window version on its injected SteamClient object.
    - The May 2023 steam client includes the Browser version on its injected SteamClient object.

    To support the Dec 2022 client and others like it, we insert a shim in place of the original call, which will defer to calling GetBrowserID() on the appropriate SteamClient.* interface.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            class ShimSteamClientBrowserGetBrowserIdCPDF extends Patches.ConfiguredPatchDefinitionFactory {
                constructor() {
                    super(...arguments);
                    this.PatchIdName = "ShimSteamClientBrowserGetBrowserId";
                }
                CreatePatchDefinition(config) {
                    return new Patches.ConfiguredPatchDefinition(this.PatchIdName, config, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        let tnode = detectionInfoData.TypedNode; // e.g.  SteamClient.Browser.GetBrowserID()
                        let steamClientAccessExpression = detectionInfoData.SteamClientAccessExpression; // e.g.  SteamClient  or  n.SteamClient
                        // Replace the original call expression with a new call expression to a shim site that takes the SteamClient access node
                        let patched = context.factory.createCallExpression(context.factory.createIdentifier(config.ShimMethodIdentifierExpression), null, [
                            steamClientAccessExpression,
                        ]); // e.g.  TFP.Compat.SteamClient_Browser_GetBrowserID(SteamClient)  or  TFP.Compat.SteamClient_Browser_GetBrowserID(n.SteamClient)
                        if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                            ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                        return patched;
                    }, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Detections
                    // ____________________________________________________________________________________________________
                    //
                    [
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.CallExpression) // e.g.  n.SteamClient.Browser.GetBrowserID()
                             {
                                let tnode = node;
                                // This is a chain of PropertyAccessExpressions, each nested in the reverse order of how it's typed in the js
                                if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  n.SteamClient.Browser.GetBrowserID
                                 {
                                    let methodToCall = tnode.expression;
                                    if (methodToCall.name.kind == ts.SyntaxKind.Identifier) // e.g.  GetBrowserID
                                     {
                                        let memberToCallName = methodToCall.name;
                                        if (memberToCallName.escapedText == "GetBrowserID") {
                                            if (methodToCall.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  n.SteamClient.Browser
                                             {
                                                let methodOwner = methodToCall.expression;
                                                if (methodOwner.name.kind == ts.SyntaxKind.Identifier) // e.g.  Browser
                                                 {
                                                    // Valve likes accessing SteamClients on other objects, so there is a mix of code accessing the window-bound SteamClient and code accessing another window's SteamClient
                                                    // This produces differing AST, since the front-most object in the js (leaf-most node in the AST) will be either an Identifier (SteamClient) or a PropertyAccessExpression (n.SteamClient)
                                                    let steamClientAccess;
                                                    if (methodOwner.expression.kind == ts.SyntaxKind.Identifier) // e.g.  SteamClient
                                                     {
                                                        let identifier = methodOwner.expression;
                                                        if (identifier.escapedText == "SteamClient")
                                                            steamClientAccess = identifier;
                                                    }
                                                    else if (methodOwner.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  n.SteamClient
                                                     {
                                                        let methodOwnerOwner = methodOwner.expression;
                                                        if (methodOwnerOwner.name.kind == ts.SyntaxKind.Identifier) {
                                                            let identifier = methodOwnerOwner.name;
                                                            if (identifier.escapedText == "SteamClient")
                                                                steamClientAccess = methodOwnerOwner;
                                                        }
                                                    }
                                                    if (steamClientAccess != null) {
                                                        return new Patches.DetectionInfo(true, {
                                                            "TypedNode": tnode,
                                                            "SteamClientAccessExpression": steamClientAccess, // SteamClient or n.SteamClient
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
                }
            }
            Definitions.ShimSteamClientBrowserGetBrowserIdCPDF = ShimSteamClientBrowserGetBrowserIdCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Compat shim for hideous existence check of SteamClient.Browser.GetBrowserID
/*

    ----- Target -----

    1.  (null === (r = null === (o = null == i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.Browser) || void 0 === r ? void 0 : r.GetBrowserID)
      =>
        TFP.Compat.SteamClient_HasGetBrowserID(i.SteamClient)

    
    ----- Notes -----
    
    This dereference chain existence check pattern appears in multiple locations in Valve's bastardized js. It is most likely the result of Valve's minifier, though the original code could be just as rancid since this is Valve after all.

    Dissecting and patching the individual property access expressions, to patch individually, is an enormous amount of work. We are not doing that.
    Instead, we are going to identify and replace the entire thing. The replacement is a shim method which will conduct the same check, using sane javascript instead.

    This patch is required by the Dec 2022 client and others for which GetBrowserID exists on SteamClient.Window, not on SteamClient.Browser. Without this patch, steam-chat.com logic which guards the use GetBrowserID() behind this existence check will fail to use GetBrowserID(), breaking certain things.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            class ShimSteamClientBrowserGetBrowserIdCheckCPDF extends Patches.ConfiguredPatchDefinitionFactory {
                constructor() {
                    super(...arguments);
                    this.PatchIdName = "ShimSteamClientBrowserGetBrowserIdCheck";
                }
                CreatePatchDefinition(config) {
                    return new Patches.ConfiguredPatchDefinition(this.PatchIdName, config, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        let tnode = detectionInfoData.TypedNode; // e.g.  (null === (r = null === (o = null == i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.Browser) || void 0 === r ? void 0 : r.GetBrowserID)
                        let steamClientAccess = detectionInfoData.SteamClientPropertyAccess; // e.g.  i.SteamClient
                        // Replace entire expression with shim method call
                        // - Note that the original expression includes a check to make sure that i.SteamClient is not null. Since we pass i.SteamClient to the shim method without any check, .SteamClient may be null, if it doesn't exist or is explicitly set to null. This is now the responsibility of the shim method to validate.
                        // Replace the call to the original method with a call to the shim function that receives the original arguments as well
                        let patched = context.factory.createCallExpression(context.factory.createIdentifier(config.ShimMethodIdentifierExpression), null, [
                            steamClientAccess,
                        ]);
                        if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                            ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                        return patched;
                    }, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Detections
                    // ____________________________________________________________________________________________________
                    //
                    [
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.ParenthesizedExpression) // e.g.  (null === (r = null === (o = null == i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.Browser) || void 0 === r ? void 0 : r.GetBrowserID)
                             {
                                let tnode = node;
                                // There are hordes of ParenthesizedExpressions in Valve's bastardized js. Some are short; some are exceedingly long. Stringifying each one for "".includes() tests may significantly impact ast traverse speed.
                                // The expected ParenthesizedExpression will have a ConditionalExpression as its immediate child
                                if (tnode.expression.kind == ts.SyntaxKind.ConditionalExpression) {
                                    let rootConditional = tnode.expression;
                                    // Validating every node type of this 14-layer ast chunk is not code I want to write
                                    // We will validate the immediate children of the conditional, then defer to more sweeping checks for the rest
                                    if (rootConditional.condition.kind == ts.SyntaxKind.BinaryExpression
                                        && rootConditional.whenTrue.kind == ts.SyntaxKind.VoidExpression
                                        && rootConditional.whenFalse.kind == ts.SyntaxKind.PropertyAccessExpression) {
                                        // Validate the  r.GetBrowserID)  at the very end of the root conditional, which will filter out the vast majority of non-matches
                                        let rootFalsePath = rootConditional.whenFalse;
                                        if (rootFalsePath.expression.kind == ts.SyntaxKind.Identifier && rootFalsePath.name.kind == ts.SyntaxKind.Identifier) // r.GetBrowserID
                                         {
                                            let rootFalsePathAccessMemberName = rootFalsePath.name;
                                            if (rootFalsePathAccessMemberName.escapedText == "GetBrowserID") {
                                                // Validate character length in the source javascript string. The expected javascript is not outrageously long, so this will filter out the outrageously long ParenthesizedExpressions.
                                                let nodeLength = tnode.end - tnode.pos;
                                                if (nodeLength < 200) // in 8811541, our expected js is 146 characters long, so 200 is plenty of wiggle room for changing member names while still eliminating the massive non-matches
                                                 {
                                                    // Everything from here could be SLOOOOOOW!! (i.e. on large non-matching node)
                                                    // We want to filter as much as possible before and during what's next: collecting 14 levels of child codes, stringifying them, and scanning them
                                                    //console.log("SLOW WARNING ON NODE", tnode, JsEmitPrinter.printNode(ts.EmitHint.Unspecified, tnode, sourceFile));
                                                    // Gather all child nodes up to a maximum depth. We will look for expected properties and js strings in these nodes.
                                                    let childNodes = Patches.AstGetAllChildNodes(node, 
                                                    // Filter node inclusion callback (nodes that will not be included in the output, but their children will still be recursed)
                                                    (n) => {
                                                        // We are only interested in the node types we are evaluating in the loop over childNodes
                                                        return (n.kind == ts.SyntaxKind.ConditionalExpression ||
                                                            n.kind == ts.SyntaxKind.VoidExpression ||
                                                            n.kind == ts.SyntaxKind.PropertyAccessExpression ||
                                                            n.kind == ts.SyntaxKind.Identifier);
                                                    }, 
                                                    // Cull recursion callback (nodes that are not included in output and are not recursed)
                                                    (n) => {
                                                        return (ts.isToken(n) == false);
                                                    }, 
                                                    // Maximum depth
                                                    14);
                                                    //console.log("- Child node gather count: ", childNodes.length);
                                                    //console.log("- Child nodes: ", childNodes);
                                                    if (childNodes.length > 0) {
                                                        // Expectations in the child nodes
                                                        let matchedTernarySteamClientPaths = false; // the true & false paths in  ... ? void 0 : i.SteamClient
                                                        let matchedTernaryBrowserPaths = false; // the true & false paths in  ... ? void 0 : o.Browser
                                                        let matchedTernaryBrowserIdPaths = false; // the true & false paths in  ... ? void 0 : r.GetBrowserID
                                                        let steamClientPropertyAccess; // Expression which accesses i.SteamClient, which is passed as an argument to the shim method
                                                        for (let childNode of childNodes) {
                                                            if (childNode.kind == ts.SyntaxKind.ConditionalExpression) {
                                                                let childNodeTyped = childNode;
                                                                // Any of:
                                                                //  null == i ? void 0 : i.SteamClient
                                                                //  null === (o = null == i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.Browser
                                                                //  null === (r = null === (o = null == i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.Browser) || void 0 === r ? void 0 : r.GetBrowserID
                                                                // Note how each is nested in the ast in the reverse order of how a sane person would write this if they had to
                                                                if (childNodeTyped.whenTrue.kind == ts.SyntaxKind.VoidExpression) // void 0
                                                                 {
                                                                    // All 3 ternaries have void 0 in their true path and a property access expression in their false path
                                                                    if (childNodeTyped.whenFalse.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  i.SteamClient
                                                                     {
                                                                        let falsePath = childNodeTyped.whenFalse;
                                                                        let falsePathJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, falsePath, sourceFile);
                                                                        if (falsePathJs.includes(".SteamClient")) {
                                                                            matchedTernarySteamClientPaths = true;
                                                                            steamClientPropertyAccess = falsePath;
                                                                        }
                                                                        else if (falsePathJs.includes(".Browser")) {
                                                                            matchedTernaryBrowserPaths = true;
                                                                        }
                                                                        else if (falsePathJs.includes(".GetBrowserID")) {
                                                                            matchedTernaryBrowserIdPaths = true;
                                                                        }
                                                                        if (matchedTernarySteamClientPaths && matchedTernaryBrowserPaths && matchedTernaryBrowserIdPaths) {
                                                                            // Highly likely match
                                                                            return new Patches.DetectionInfo(true, {
                                                                                "TypedNode": tnode,
                                                                                "SteamClientPropertyAccess": steamClientPropertyAccess,
                                                                            });
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    ]);
                }
            }
            Definitions.ShimSteamClientBrowserGetBrowserIdCheckCPDF = ShimSteamClientBrowserGetBrowserIdCheckCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Hook site immediately after friends.js has loaded webui_config from html
/*

    ----- Target -----

    1.  (8601984: line 57645)
        function d(e = a) {
            const t = {},
                n = m("config", e);
            n && (delete n.SESSIONID, Object.assign(r.De, n), (t.config = !0));
            // << INSERT HERE >>
            const i = m("userinfo", e);
            i && (Object.assign(r.L7, i), (t.userConfig = !0), r.L7.is_support && _() && (r.L7.is_support = !1));
      =>
        TFP.Hooks.OnWebuiConfigLoaded(r.De);

    
    ----- Notes -----
    
    We need a way to modify the json config object that is baked into the html document which is running friends.js.
    This is required for things like localized display strings and nation-specific behavior.

    A good place for planting the hook is immediately after the deserialized json is assigned to the globalish object that all of friends.js references.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            class AddHtmlWebuiConfigOnLoadHookCPDF extends Patches.ConfiguredPatchDefinitionFactory {
                constructor() {
                    super(...arguments);
                    this.PatchIdName = "AddHtmlWebuiConfigOnLoadHook";
                }
                CreatePatchDefinition(config) {
                    return new Patches.ConfiguredPatchDefinition(this.PatchIdName, config, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        let tnode = detectionInfoData.TypedNode; // the function body block where we will insert the hook function call
                        let statementToInsertAfter = detectionInfoData.StatementToInsertAfter; // e.g.  n && (delete n.SESSIONID, Object.assign(r.De, n), (t.config = !0));
                        let configObjectAccess = detectionInfoData.ConfigObjectAccess; // e.g.  r.De
                        let insertIndex = tnode.statements.indexOf(statementToInsertAfter) + 1;
                        let hookCall = context.factory.createExpressionStatement(context.factory.createCallExpression(context.factory.createIdentifier(config.HookMethodIdentifierExpression), null, [
                            configObjectAccess,
                        ]));
                        let newStatements = tnode.statements.slice();
                        newStatements.splice(insertIndex, 0, hookCall);
                        return context.factory.updateBlock(tnode, newStatements);
                    }, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Detections
                    // ____________________________________________________________________________________________________
                    //
                    [
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.Block) // expected function's block of body statements
                             {
                                /* e.g. (8601984)
                                    function d(e = a) {
                                        const t = {},
                                            n = m("config", e);
                                        n && (delete n.SESSIONID, Object.assign(r.De, n), (t.config = !0));
                                        const i = m("userinfo", e);
                                        i && (Object.assign(r.L7, i), (t.userConfig = !0), r.L7.is_support && _() && (r.L7.is_support = !1));
                                        const o = m("broadcast", e);
                                        o && (Object.assign(r.dk, o), (t.broadcastConfig = !0));
                                        const s = m("community", e);
                                        s && (Object.assign(r.JA, s), (t.communityConfig = !0));
                                        const l = m("event", e);
                                        return l && (Object.assign(r.Wj, l), (t.eventConfig = !0)), t;
                                    }
                                */
                                let tnode = node;
                                if (tnode.statements.length <= 15) // 10 statements in 8601984, +5 for wiggle room
                                 {
                                    if (tnode.end - tnode.pos < 700) // entire body is 548 characters long in 8601984, +extra for wiggle room
                                     {
                                        let js = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, tnode, sourceFile);
                                        // Gather expected child nodes to verify of limited criteria
                                        let validateNodes = Patches.AstGetAllChildNodes(tnode, 
                                        // Node filter callback
                                        (n) => {
                                            return ( // only gather the expected nodes we want to validate
                                            n.kind == ts.SyntaxKind.CallExpression ||
                                                n.kind == ts.SyntaxKind.StringLiteral ||
                                                n.kind == ts.SyntaxKind.Identifier);
                                        }, 
                                        // Recursion cull callback
                                        null, 
                                        // Maximum depth
                                        10);
                                        if (validateNodes.length > 0) {
                                            // Expectations in the gathered nodes
                                            let matchConfigStringLiteral = false; // "config"  from  const t = {}, n = m("config", e);
                                            let matchSessionidIdentifier = false; // n.SESSIONID  from  n && (delete n.SESSIONID, Object.assign(r.De, n), (t.config = !0));
                                            let statementToInsertAfter;
                                            let propertyAccessToConfigObject; // r.De
                                            for (let checkNode of validateNodes) {
                                                if (checkNode.kind == ts.SyntaxKind.StringLiteral && checkNode.text == "config") {
                                                    matchConfigStringLiteral = true;
                                                }
                                                else if (checkNode.kind == ts.SyntaxKind.Identifier && checkNode.escapedText == "SESSIONID") {
                                                    matchSessionidIdentifier = true;
                                                    statementToInsertAfter = Patches.AstFindFirstAncestor(checkNode, ts.SyntaxKind.ExpressionStatement); // get the statement this node is from
                                                }
                                                else if (checkNode.kind == ts.SyntaxKind.CallExpression) // e.g.  Object.assign(r.De, n)
                                                 {
                                                    let methodCall = checkNode;
                                                    if (methodCall.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
                                                        let methodAccess = methodCall.expression;
                                                        if (methodAccess.expression.kind == ts.SyntaxKind.Identifier && methodAccess.expression.escapedText == "Object"
                                                            && methodAccess.name.kind == ts.SyntaxKind.Identifier && methodAccess.name.escapedText == "assign") // Object.assign
                                                         {
                                                            propertyAccessToConfigObject = methodCall.arguments[0]; // first argument to Object.assign is r.De which is the parsed json object
                                                        }
                                                    }
                                                }
                                                if (matchSessionidIdentifier && matchSessionidIdentifier && propertyAccessToConfigObject != null) {
                                                    // Highly likely match
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
                }
            }
            Definitions.AddHtmlWebuiConfigOnLoadHookCPDF = AddHtmlWebuiConfigOnLoadHookCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Compat shim for SteamClient.OpenVR.SetOverlayInteractionAffordance()
/*

    ----- Targets -----

    1.  (8601984: line 47615)
        o.OpenVR.SetOverlayInteractionAffordance(t, s)
      =>
        TFP.Compat.SteamClient_OpenVR_SetOverlayInteractionAffordance(o, t, s)
        
    2.  (8811541: line 46841)
        (null === (r = null === (o = null === (i = e.ownerDocument.defaultView) || void 0 === i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.OpenVR) || void 0 === r || r.SetOverlayInteractionAffordance(t, l))
      =>
        (null === (r = null === (o = null === (i = e.ownerDocument.defaultView) || void 0 === i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.OpenVR) || void 0 === r || TFP.Compat.SteamClient_OpenVR_SetOverlayInteractionAffordance(i.SteamClient, t, s))

    3.  (9097133: line 48039)
        r != o && e.ownerDocument.defaultView?.SteamClient?.OpenVR?.SetOverlayInteractionAffordance(t, r);
      =>
        r != o && TFP.Compat.SteamClient_OpenVR_SetOverlayInteractionAffordance(e.ownerDocument.defaultView?.SteamClient, t, r);

    
    ----- Notes -----
    
    First appeared in Valve javascript sometime between 8390683 and 8601984

    SetOverlayInteractionAffordance() is not present in the SteamClient.OpenVR subinterface created by the May 2023 client's friendsui.dll. It's unknown which client introduces this method, though it is likely to be the first pure-shit steam client or one of the updates between then and Dec 2023.

    Appears to be related to vr junk and has nothing to do with actual steam chat functionality.
    

    ----- Range -----

    Since: Sometime between 8390683 and 8601984.

    Until: At least 9097133.
            - Circa 8811541, Valve added a guard to accessing the OpenVR subinterface, and only for OpenVR. Zero guard for SetOverlayInteractionAffordance. This changed the call site from Target #1 to Target #2.
            - Circa 9097133, Valve stopped translating their ?. into rancid syntax and now simply keep the almost-as-rancid ?. operator. Still zero guard for SetOverlayInteractionAffordance. Call site is now changed to Target #3.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            class ShimSteamClientOpenVrSoiaCPDF extends Patches.ConfiguredPatchDefinitionFactory {
                constructor() {
                    super(...arguments);
                    this.PatchIdName = "ShimSteamClientOpenVrSoia";
                }
                CreatePatchDefinition(config) {
                    return new Patches.ConfiguredPatchDefinition(this.PatchIdName, config, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        // Common patch logic valid for all target sites
                        let tnode = detectionInfoData.TypedNode;
                        // e.g.
                        // - Site 1:  o.OpenVR.SetOverlayInteractionAffordance(t, s)
                        // - Site 2:  r.SetOverlayInteractionAffordance(t, l)
                        // - Site 3:  e.ownerDocument.defaultView?.SteamClient?.OpenVR?.SetOverlayInteractionAffordance(t, r)
                        // Replace the call to the original method with a call to the shim function that receives the original arguments as well
                        let newArgs = tnode.arguments.slice();
                        newArgs.splice(0, 0, detectionInfoData.SteamClientPropertyAccess);
                        let patched = context.factory.updateCallExpression(tnode, context.factory.createIdentifier(config.ShimMethodIdentifierExpression), null, newArgs);
                        if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                            ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                        return patched;
                    }, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Detections
                    // ____________________________________________________________________________________________________
                    //
                    [
                        //
                        // Target site 1
                        //
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.CallExpression) // e.g.  o.OpenVR.SetOverlayInteractionAffordance(t, s)
                             {
                                let tnode = node;
                                // This is a chain of PropertyAccessExpressions, each nested in the reverse order of how it's typed in the js
                                if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  o.OpenVR.SetOverlayInteractionAffordance
                                 {
                                    let memberToCall = tnode.expression;
                                    let memberToCallJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, memberToCall, sourceFile);
                                    if (memberToCallJs.endsWith(".OpenVR.SetOverlayInteractionAffordance")) {
                                        // Highly likely match
                                        let steamClientPropertyAccess = memberToCall.expression.expression;
                                        return new Patches.DetectionInfo(true, {
                                            "Location": 1,
                                            "TypedNode": tnode,
                                            "SteamClientPropertyAccess": steamClientPropertyAccess,
                                        });
                                    }
                                }
                            }
                        },
                        //
                        // Target site 2
                        //
                        (context, sourceFile, node) => {
                            // Adapted from ShimSteamClientBrowserGetBrowserIdCheck
                            if (node.kind == ts.SyntaxKind.CallExpression) // e.g. r.SetOverlayInteractionAffordance(t, l)
                             {
                                let tnode = node;
                                // Validate name of function call
                                if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g. r.SetOverlayInteractionAffordance
                                 {
                                    let memberToCallAccess = tnode.expression;
                                    if (memberToCallAccess.name.kind == ts.SyntaxKind.Identifier && memberToCallAccess.name.escapedText == "SetOverlayInteractionAffordance") {
                                        // Validate hideous conditional chain this call is at the very end of
                                        let paren = Patches.AstFindFirstAncestor(tnode, ts.SyntaxKind.ParenthesizedExpression, 20); // I didn't bother counting but it looks like ~20 layers from here to the root
                                        if (paren != null) // e.g.  (null === (r = null === (o = null === (i = e.ownerDocument.defaultView) || void 0 === i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.OpenVR) || void 0 === r || r.SetOverlayInteractionAffordance(t, l))
                                         {
                                            // Validate character length in the parenthesized expression
                                            let parenNodeLength = paren.end - paren.pos;
                                            if (parenNodeLength < 250) // in 8811541, our expected js is 208 characters long, so we use 250 for wiggle room
                                             {
                                                // Everything from here could be SLOOOOOOW!! (i.e. on large non-matching node)
                                                //console.log("SLOW WARNING ON NODE", tnode, JsEmitPrinter.printNode(ts.EmitHint.Unspecified, tnode, sourceFile));
                                                // Gather all child nodes up to a maximum depth. We will look for expected properties and js strings in these nodes.
                                                let childNodes = Patches.AstGetAllChildNodes(paren, 
                                                // Filter node inclusion callback (nodes that will not be included in the output, but their children will still be recursed)
                                                (n) => {
                                                    // We are only interested in the node types we are evaluating in the loop over childNodes
                                                    return (n.kind == ts.SyntaxKind.ConditionalExpression ||
                                                        n.kind == ts.SyntaxKind.VoidExpression ||
                                                        n.kind == ts.SyntaxKind.PropertyAccessExpression ||
                                                        n.kind == ts.SyntaxKind.Identifier);
                                                }, 
                                                // Cull recursion callback (nodes that are not included in output and are not recursed)
                                                (n) => {
                                                    return (ts.isToken(n) == false);
                                                }, 
                                                // Maximum depth
                                                20);
                                                //console.log("- Child node gather count: ", childNodes.length);
                                                //console.log("- Child nodes: ", childNodes);
                                                if (childNodes.length > 0) {
                                                    // Expectations in the child nodes
                                                    let matchedTernarySteamClientPaths = false; // the true & false paths in  ... ? void 0 : i.SteamClient
                                                    let matchedTernaryOpenVrPaths = false; // the true & false paths in  ... ? void 0 : o.OpenVR
                                                    let steamClientPropertyAccess; // Expression which accesses i.SteamClient, which is passed as an argument to the shim method
                                                    for (let childNode of childNodes) {
                                                        if (childNode.kind == ts.SyntaxKind.ConditionalExpression) {
                                                            let childNodeTyped = childNode;
                                                            // Any of:
                                                            //  null === (i = e.ownerDocument.defaultView) || void 0 === i ? void 0 : i.SteamClient
                                                            //  null === (o = null === (i = e.ownerDocument.defaultView) || void 0 === i ? void 0 : i.SteamClient) || void 0 === o ? void 0 : o.OpenVR
                                                            if (childNodeTyped.whenTrue.kind == ts.SyntaxKind.VoidExpression) // void 0
                                                             {
                                                                // All relevant ternaries have void 0 in their true path and a property access expression in their false path
                                                                if (childNodeTyped.whenFalse.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  i.SteamClient
                                                                 {
                                                                    let falsePath = childNodeTyped.whenFalse;
                                                                    let falsePathJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, falsePath, sourceFile);
                                                                    if (falsePathJs.includes(".SteamClient")) {
                                                                        matchedTernarySteamClientPaths = true;
                                                                        steamClientPropertyAccess = falsePath;
                                                                    }
                                                                    else if (falsePathJs.includes(".OpenVR")) {
                                                                        matchedTernaryOpenVrPaths = true;
                                                                    }
                                                                    if (matchedTernarySteamClientPaths && matchedTernaryOpenVrPaths) {
                                                                        // Highly likely match
                                                                        return new Patches.DetectionInfo(true, {
                                                                            "Location": 2,
                                                                            "TypedNode": tnode,
                                                                            "SteamClientPropertyAccess": steamClientPropertyAccess,
                                                                        });
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        //
                        // Target site 3
                        //
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.CallExpression) // e.g.  e.ownerDocument.defaultView?.SteamClient?.OpenVR?.SetOverlayInteractionAffordance(t, r)
                             {
                                let tnode = node;
                                // This is a chain of PropertyAccessExpressions, each nested in the reverse order of how it's typed in the js
                                if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  e.ownerDocument.defaultView?.SteamClient?.OpenVR?.SetOverlayInteractionAffordance
                                 {
                                    let memberToCall = tnode.expression;
                                    let memberToCallJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, memberToCall, sourceFile);
                                    if (memberToCallJs.endsWith(".OpenVR?.SetOverlayInteractionAffordance")) {
                                        // Highly likely match
                                        let steamClientPropertyAccess = memberToCall.expression.expression;
                                        return new Patches.DetectionInfo(true, {
                                            "Location": 3,
                                            "TypedNode": tnode,
                                            "SteamClientPropertyAccess": steamClientPropertyAccess,
                                        });
                                    }
                                }
                            }
                        },
                    ]);
                }
            }
            Definitions.ShimSteamClientOpenVrSoiaCPDF = ShimSteamClientOpenVrSoiaCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Compat shim for SteamClient.System.IsSteamInTournamentMode()
/*

    ----- Target Examples -----

    1.  SteamClient.System.IsSteamInTournamentMode().then((e) => (this.m_bSteamIsInTournamentMode = e))
      =>
        TFP.Compat.SteamClient_System_IsSteamInTournamentMode(SteamClient, "System", "IsSteamInTournamentMode").then((e) => (this.m_bSteamIsInTournamentMode = e))

    
    ----- Notes -----
    
    Despite the identical name and usage pattern, this SteamClient.System.IsSteamInTournamentMode() is DIFFERENT from SettingsStore.IsSteamInTournamentMode().
    - The SettingsStore version is a normal function
    - The SteamClient.System version returns a promise

    Also, since the members of SteamClient (like .System) are not always real JS objects, it's safer to pass the SteamClient to the shim function (for it to make the .System deference itself) instead of passing SteamClient.System.
    Hence the need for two different IsSteamInTournamentMode patches.

    Refer to the other IsSteamInTournamentMode for more info.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            class ShimSteamClientIsSteamInTournamentModeCPDF extends Patches.ConfiguredPatchDefinitionFactory {
                constructor() {
                    super(...arguments);
                    this.PatchIdName = "ShimSteamClientIsSteamInTournamentMode";
                }
                CreatePatchDefinition(config) {
                    return new Patches.ConfiguredPatchDefinition(this.PatchIdName, config, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        let tnode = detectionInfoData.TypedNode; // e.g.  SteamClient.System.IsSteamInTournamentMode()
                        let steamClientAccessExpression = detectionInfoData.SteamClientAccessExpression; // e.g.  SteamClient
                        let subInterfaceName = detectionInfoData.SteamClientSubInterfaceName; // e.g.  "System"
                        let nameOfMemberToCall = detectionInfoData.SubInterfaceMemberToCall; // e.g.  "IsSteamInTournamentMode"
                        // Replace the original call expression with a new call expression to a shim site that takes the original member to call access expression exploded in parts
                        // The shim function must return a promise like the original
                        let patched = context.factory.createCallExpression(context.factory.createIdentifier(config.ShimMethodIdentifierExpression), null, [
                            steamClientAccessExpression,
                            context.factory.createStringLiteral(subInterfaceName),
                            context.factory.createStringLiteral(nameOfMemberToCall),
                        ]); // e.g.  TFP.Compat.SteamClient_System_IsSteamInTournamentMode(SteamClient, "System", "IsSteamInTournamentMode")
                        if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                            ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                        return patched;
                    }, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Detections
                    // ____________________________________________________________________________________________________
                    //
                    [
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.CallExpression) // e.g.  SteamClient.System.IsSteamInTournamentMode()
                             {
                                let tnode = node;
                                // This is a chain of PropertyAccessExpressions, each nested in the reverse order of how it's typed in the js
                                // Validate the .IsSteamInTournamentMode() call at the end of the expression
                                if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  SteamClient.System.IsSteamInTournamentMode
                                 {
                                    let memberToCall = tnode.expression;
                                    if (memberToCall.name.kind == ts.SyntaxKind.Identifier) // e.g.  IsSteamInTournamentMode
                                     {
                                        let memberToCallName = memberToCall.name;
                                        if (memberToCallName.escapedText == config.SubInterfaceMemberToCall) {
                                            // Validate "SteamClient.System" qualification to the .IsSteamInTournamentMode member is accessed and called
                                            if (memberToCall.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  SteamClient.System
                                             {
                                                let memberOwner = memberToCall.expression;
                                                if (memberOwner.expression.kind == ts.SyntaxKind.Identifier // e.g.  SteamClient
                                                    && memberOwner.name.kind == ts.SyntaxKind.Identifier) // e.g.  System
                                                 {
                                                    let memberOwnerOwnerName = memberOwner.expression;
                                                    let memberOwnerName = memberOwner.name;
                                                    if (memberOwnerOwnerName.escapedText == "SteamClient" && memberOwnerName.escapedText == config.SteamClientSubInterface) {
                                                        return new Patches.DetectionInfo(true, {
                                                            "TypedNode": tnode,
                                                            "SteamClientAccessExpression": memberOwnerOwnerName,
                                                            "SteamClientSubInterfaceName": memberOwnerName.escapedText,
                                                            "SubInterfaceMemberToCall": memberToCallName.escapedText, // "IsSteamInTournamentMode"
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
                }
            }
            Definitions.ShimSteamClientIsSteamInTournamentModeCPDF = ShimSteamClientIsSteamInTournamentModeCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Compat shim for SettingsStore.IsSteamInTournamentMode()
/*

    ----- Target Examples -----

    1.  let e = I.Ul.ParentalStore.BIsFriendsBlocked() || I.Ul.SettingsStore.IsSteamInTournamentMode();
      =>
        let e = I.Ul.ParentalStore.BIsFriendsBlocked() || TFP.Compat.SettingsStore_IsSteamInTournamentMode(I.Ul.SettingsStore);

    
    ----- Notes -----
    
    Valve's inability to call SettingsStore.IsSteamInTournamentMode() properly is the specific fuckup that required the creation of the entire FixedSteamFriendsUI project.

    Valve tries to call IsSteamInTournamentMode() (sometimes incorrectly) on two objects observed thus far, neither of which exist outside of the sharedjscontext abomination in the pure-shit steam clients. Javascript's null == false behavior hides half of these faults, while nested access on the null throws a halting error that breaks the entire inner frame.
    
    This is resolved by shimming each call site with a wrapper that ensures a valid return without exceptions.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        var Definitions;
        (function (Definitions) {
            class ShimSettingsStoreIsSteamInTournamentModeCPDF extends Patches.ConfiguredPatchDefinitionFactory {
                constructor() {
                    super(...arguments);
                    this.PatchIdName = "ShimSettingsStoreIsSteamInTournamentMode";
                }
                CreatePatchDefinition(config) {
                    return new Patches.ConfiguredPatchDefinition(this.PatchIdName, config, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        let tnode = detectionInfoData.TypedNode; // e.g.  b.Ul.SettingsStore.IsSteamInTournamentMode()
                        let nameOfMemberToCall = detectionInfoData.NameOfMemberToCallAccessNode; // e.g.  "IsSteamInTournamentMode"
                        let ownerOfMemberToCall = detectionInfoData.OwnerOfMemberToCallAccessNode; // e.g.  b.Ul.SettingsStore
                        // Replace the original call expression with a new call expression to a shim site that takes 1) the name of original member to call and 2) its owner as arguments
                        let patched = context.factory.createCallExpression(context.factory.createIdentifier(config.ShimMethodIdentifierExpression), null, [
                            ownerOfMemberToCall,
                            context.factory.createStringLiteral(nameOfMemberToCall),
                        ]); // e.g.  TFP.Compat.SettingsStore_IsSteamInTournamentMode(b.Ul.SettingsStore, "IsSteamInTournamentMode")
                        if (SnapshotMakerTsJsRewriter.IncludeOldJsCommentAtPatchSites)
                            ts.addSyntheticLeadingComment(patched, ts.SyntaxKind.MultiLineCommentTrivia, SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile), false);
                        return patched;
                    }, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Detections
                    // ____________________________________________________________________________________________________
                    //
                    [
                        (context, sourceFile, node) => {
                            if (node.kind == ts.SyntaxKind.CallExpression) // e.g.  b.Ul.SettingsStore.IsSteamInTournamentMode()
                             {
                                let tnode = node;
                                // This is a chain of PropertyAccessExpressions, each nested in the reverse order of how it's typed in the js
                                // Validate the .IsSteamInTournamentMode() call at the end of the expression
                                if (tnode.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  b.Ul.SettingsStore.IsSteamInTournamentMode
                                 {
                                    let memberToCall = tnode.expression;
                                    if (memberToCall.name.kind == ts.SyntaxKind.Identifier) // e.g.  IsSteamInTournamentMode
                                     {
                                        let memberToCallName = memberToCall.name;
                                        if (memberToCallName.escapedText == config.TargetFinalIdentifier) {
                                            // Validate the SettingsStore object upon which .IsSteamInTournamentMode is accessed and called
                                            if (memberToCall.expression.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  b.Ul.SettingsStore
                                             {
                                                let memberOwner = memberToCall.expression;
                                                if (memberOwner.name.kind == ts.SyntaxKind.Identifier) // e.g.  SettingsStore
                                                 {
                                                    let memberOwnerName = memberOwner.name;
                                                    if (memberOwnerName.escapedText == config.TargetFinalQualifier) {
                                                        // Match: the end of the root (tnode) expression is: .SettingsStore.IsSteamInTournamentMode() (or whatever config.TargetFinalQualifier/Identifier are configured to)
                                                        return new Patches.DetectionInfo(true, {
                                                            "TypedNode": tnode,
                                                            "NameOfMemberToCallAccessNode": memberToCallName.escapedText,
                                                            "OwnerOfMemberToCallAccessNode": memberOwner, // b.Ul.SettingsStore
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
                }
            }
            Definitions.ShimSettingsStoreIsSteamInTournamentModeCPDF = ShimSettingsStoreIsSteamInTournamentModeCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Helpers for the patch definitions
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        // ____________________________________________________________________________________________________
        //
        //     AST
        // ____________________________________________________________________________________________________
        //
        function AstFindFirstAncestor(node, kind, maximumDepth = 0) {
            let matchKinds;
            if (Array.isArray(kind))
                matchKinds = kind;
            else
                matchKinds = [kind];
            let curNode = node;
            let depth = 0;
            do {
                curNode = curNode.parent;
                if (curNode == null)
                    return null;
                depth++;
                if (maximumDepth > 0 && depth > maximumDepth)
                    return null;
                else if (matchKinds.indexOf(curNode.kind) != -1)
                    return curNode;
            } while (curNode.parent != null);
            return null;
        }
        Patches.AstFindFirstAncestor = AstFindFirstAncestor;
        function AstGetAllChildNodes(node, filterCallback = null, cullCallback = null, maximumDepth = 0) {
            let nodes = [];
            let seenNodes = {};
            function recurse(curNode, depth) {
                let seenNodeId = curNode.pos.toString() + "-" + curNode.end.toString(); // there's no unique hash value for each node, but the start + end pos in the source file of each node is a unique & cheap identifier
                if (seenNodeId in seenNodes) // I don't know if cyclical references are possible in typescript's ast model, so it's possible this isn't even needed
                    return;
                seenNodes[seenNodeId] = true;
                let children;
                if (ts.isBlock(curNode))
                    children = [...curNode.statements]; // for some reason, typescript does not consider Statements to be children of Blocks. Instead, the root Nodes of each Statement are the "immediate" children of the Block.
                else
                    children = curNode.getChildren();
                for (let child of children) {
                    if (cullCallback != null && !cullCallback(child))
                        continue;
                    let addToList = true;
                    if (filterCallback != null)
                        addToList = filterCallback(child);
                    if (addToList)
                        nodes.push(child);
                    let nextDepth = depth + 1;
                    if (maximumDepth > 0 && nextDepth > maximumDepth)
                        continue;
                    recurse(child, nextDepth);
                }
            }
            recurse(node, 0);
            return nodes;
        }
        Patches.AstGetAllChildNodes = AstGetAllChildNodes;
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
//# sourceMappingURL=combined.js.map