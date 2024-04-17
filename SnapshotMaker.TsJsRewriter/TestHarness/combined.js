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
        UserTraceHandler(...message);
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
        SnapshotMakerTsJsRewriter.Patches.InitAllPatchDefinitionFactories();
        ConfiguredPatchDefinitions = [];
        //for (let definition in config.Definitions) // typescript fails to infer correct type for local `definition`
        patchDefinitionsConfig.Definitions.forEach((item) => {
            let factory = SnapshotMakerTsJsRewriter.Patches.GetPatchDefinitionFactoryByIdName(item.IdName);
            if (factory == null) {
                console.warn("Unknown patch IdName '" + item.IdName + "'. Patch cannot be built and will be skipped.");
                return;
            }
            ConfiguredPatchDefinitions.push(factory.CreatePatchDefinition(item.Config));
        });
    }
    SnapshotMakerTsJsRewriter.DefinePatches = DefinePatches;
    // --------------------------------------------------
    //   Patch some javascript
    // --------------------------------------------------
    function PatchJavascript(code) {
        let inputJsSourceFile = ts.createSourceFile("blah.js", code, ts.ScriptTarget.ES2015, /*setParentNodes*/ true, ts.ScriptKind.JS);
        console.log(inputJsSourceFile);
        let totalNodes = 0;
        // Method passed to ts.transform(); sole argument is supplied by ts.transform()
        let megatron = function (context) {
            // Ugly js nested method, which somehow obtains its sole argument from the ts.transform() caller
            return function (sourceFile) {
                let visitor = function (node) {
                    totalNodes += 1;
                    for (let patchDefinition of ConfiguredPatchDefinitions) {
                        let patchedNode = patchDefinition.DetectAndPatch(context, sourceFile, node);
                        if (patchedNode != null) // return is non-null if this node was detected & patched
                            return patchedNode;
                        // todo: track and report the following
                        // - count of applied patches
                        // - patches who had none of their detections match and thus were never used
                    }
                    return ts.visitEachChild(node, visitor, context);
                };
                return ts.visitNode(sourceFile, visitor);
            };
        };
        let inputJsTransformResult = ts.transform(inputJsSourceFile, [megatron]);
        console.log(">>>>> TRANSFORM DONE >>>>>", totalNodes);
        console.log("EXPORT");
        let transformedInputJsSourceFile = inputJsTransformResult.transformed[0];
        let outputJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printFile(transformedInputJsSourceFile);
        console.log(outputJs);
        return outputJs;
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
                        SnapshotMakerTsJsRewriter.Trace("> Detection '" + this.IdName + "' matched node: ", node);
                        let oldJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile);
                        SnapshotMakerTsJsRewriter.Trace("  - Original JS: ", oldJs);
                        let patchedNode = this.Patch(context, sourceFile, node, detectionInfo.Data);
                        let newJs = SnapshotMakerTsJsRewriter.JsEmitPrinter.printNode(ts.EmitHint.Unspecified, patchedNode, sourceFile);
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
        // Bundle of data created on a matched detection; provided to the patch method associated with the detection method
        class DetectionInfo {
            constructor(match, data) {
                this.Match = match;
                this.Data = data;
            }
        }
        Patches.DetectionInfo = DetectionInfo;
        //export interface PatchDefinitionFactoryCreateConfig { }
        // Object which creates configured patch definitions
        // A configured patch definition has its detection and patch methods both altered by a provided config, which usually specifies the signatures of the patch targets and what to do with them when patching them
        class ConfiguredPatchDefinitionFactory {
            //PatchDefConfig: PatchDefinitionFactoryCreateConfig;
            //PatchMethod: Function;
            //DetectionMethods: Function[];
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
           - Circa 8811541, Valve finally "fixed" this bug, by way of completely rewriting the IsMinimized() and IsMaximized() methods for this type. The rewrite involves a new guarded access paradigm to members of SteamClient, which is good and save me the work of writing a shim patch to do the same thing. Unfortunately, Valve's access guard only exists on this one type in question and is only used for its own access to SteamClient members.

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
                    return new Patches.PatchDefinition(this.PatchIdName, 
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
                    return new Patches.PatchDefinition(this.PatchIdName, 
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
                                                                }
                                                            }
                                                        }
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
                    ]);
                }
            }
            Definitions.ShimSteamClientBrowserGetBrowserIdCheckCPDF = ShimSteamClientBrowserGetBrowserIdCheckCPDF;
        })(Definitions = Patches.Definitions || (Patches.Definitions = {}));
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Compat shim for SteamClient.OpenVR.SetOverlayInteractionAffordance()
/*

    ----- Target Examples -----

    1.  o.OpenVR.SetOverlayInteractionAffordance(t, s)
      =>
        TFP.Compat.SteamClient_OpenVR_SetOverlayInteractionAffordance(o, t, s)

    
    ----- Notes -----
    
    First appeared in Valve javascript sometime between 8390683 and 8601984

    SetOverlayInteractionAffordance() and in fact the entire OpenVR subinterface are not present in the injected interface created by the May 2023 client's friendsui.dll. It's unknown which client introduces this method, though it is likely to be the first pure-shit steam client or one of the updates between then and Dec 2023.

    Appears to be related to vr junk and has nothing to do with actual steam chat functionality.

    
    ----- Range -----

    Since: Sometime between 8390683 and 8601984.

    Until: Sometime between 8601984 and 8811541.
           - Circa 8811541, Valve added a guard to accessing the OpenVR subinterface, and only for OpenVR. Zero guard for SetOverlayInteractionAffordance. It seems likely that SetOverlayInteractionAffordance is part of RTM OpenVR.

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
                    return new Patches.PatchDefinition(this.PatchIdName, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        let tnode = detectionInfoData.TypedNode; // e.g.  o.OpenVR.SetOverlayInteractionAffordance(t, s)
                        // Replace the call to the original method with a call to the shim function that receives the original arguments as well
                        let patched = context.factory.updateCallExpression(tnode, context.factory.createIdentifier(config.ShimMethodIdentifierExpression), tnode.typeArguments, tnode.arguments);
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
                                        return new Patches.DetectionInfo(true, {
                                            "TypedNode": tnode,
                                        });
                                    }
                                }
                            }
                        }
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
                    return new Patches.PatchDefinition(this.PatchIdName, 
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
                    return new Patches.PatchDefinition(this.PatchIdName, 
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
//    CDN asset fetch url rewriting
/*

    ----- Target Examples -----

    1.  u.Ul.AudioPlaybackManager.PlayAudioURL( o.De.COMMUNITY_CDN_URL + "public/sounds/webui/steam_voice_channel_enter.m4a?v=1" )
      =>
        u.Ul.AudioPlaybackManager.PlayAudioURL( TFP.Resources.SelectCdnResourceUrl(o.De.COMMUNITY_CDN_URL, "public/sounds/webui/steam_voice_channel_enter.m4a?v=1", "Root", "JsSounds") )

    
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
                    return new Patches.PatchDefinition(this.PatchIdName, 
                    // ____________________________________________________________________________________________________
                    //
                    //     Patch
                    // ____________________________________________________________________________________________________
                    //
                    (context, sourceFile, node, detectionInfoData) => {
                        let tnode = detectionInfoData.TypedNode; // e.g.  o.De.COMMUNITY_CDN_URL + "public/sounds/webui/steam_voice_channel_enter.m4a?v=1"
                        let matchedTarget = detectionInfoData.MatchedTarget; // e.g.  ["public/sounds/webui/steam_voice_channel_enter.m4a", "Root", "JsSounds"]
                        // syntax for retrieving implicit nested interface type ^--^
                        // Replace the binary expression with a method call that takes the original halves of the binary expr as arguments
                        let patched = context.factory.createCallExpression(context.factory.createIdentifier(config.ShimMethodIdentifierExpression), null, [
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
                                            "TypedNode": tnode,
                                            "MatchedTarget": matchedTarget,
                                        });
                                    }
                                }
                            }
                        }
                    ]);
                }
            }
            Definitions.RewriteCdnAssetUrlStringBuildCPDF = RewriteCdnAssetUrlStringBuildCPDF;
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
        function AstFindFirstAncestor(node, ...kind) {
            let curNode = node;
            do {
                curNode = curNode.parent;
                if (curNode == null)
                    return null;
                else if (kind.indexOf(curNode.kind) != -1)
                    return curNode;
            } while (curNode.parent != null);
            return null;
        }
        Patches.AstFindFirstAncestor = AstFindFirstAncestor;
        function AstGetAllChildNodes(node, filterCallback, cullCallback = null, maximumDepth = 0) {
            let nodes = [];
            let seenNodes = {};
            function recurse(curNode, depth) {
                let seenNodeId = curNode.pos.toString() + "-" + curNode.end.toString(); // there's no unique hash value for each node, but the start + end pos in the source file of each node is a unique & cheap identifier
                if (seenNodeId in seenNodes) // I don't know if cyclical references are possible in typescript's ast model, so it's possible this isn't even needed
                    return;
                seenNodes[seenNodeId] = true;
                for (let child of curNode.getChildren()) {
                    if (cullCallback != null && !cullCallback(child))
                        continue;
                    let addToList = true;
                    if (filterCallback != null)
                        addToList = filterCallback(child);
                    if (addToList)
                        nodes.push(child);
                    let nextDepth = depth + 1;
                    if (nextDepth > maximumDepth)
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