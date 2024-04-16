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
            ];
            for (let factory of factories)
                RegisterPatchDefinitionFactoryInstance(factory);
        }
        Patches.InitAllPatchDefinitionFactories = InitAllPatchDefinitionFactories;
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Disable broken (t.m_BlurHandler = () => { this.HideByElement(t.m_OwningElement); }) code in the ShowPopup() handler for miniprofiles
//
//    Examples:
//      1.  (t.m_BlurHandler = () => {
//			    this.HideByElement(t.m_OwningElement);
//			}),
//       -> (t.m_BlurHandler = () => {
//			    /*this.HideByElement(t.m_OwningElement);*/
//			}),
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*  -- Notes --

    This appears to be Valve's attempt to add a visual effect when a miniprofile is displayed.
    I don't know what the intended effect is, but it possibly is meant to blur the parent window which created the miniprofile, which would be pretty retarded.
    Regardless, it doesn't work properly in the December 2022 client. It ends up making the miniprofile immediately close itself, since the miniprofile's m_OwningElement is itself. But only when the window which created the miniprofile popup has focus. If a different window has focus, the miniprofile works properly. Clearly a symptom of some more rootward problem.
    This problem does not occur in the May 2023 client.
    This effect appears to be written expressly for pure shit steam clients and thus has no reason to attempt itself on vgui capable Steam clients. In fact, despite not causing any problems in the May 2023, it does absolutely nothing to affect the look & behavior of the miniprofiles. They are the same whether or not this code is disabled/enabled.
    Accordingly, disabling this code fixes the aforementioned issue under the Dec 2022 client and renders no changes to the unaffected clients.

 */
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
//
//    Examples:
//      1.  n.SteamClient.Browser.GetBrowserID()
//       -> TFP.Compat.SteamClient_Browser_GetBrowserID(n.SteamClient)
//      2.  n.SteamClient.Window.GetBrowserID()
//       -> TFP.Compat.SteamClient_Browser_GetBrowserID(n.SteamClient)
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*  -- Notes --
    
    SteamClient.Window.GetBrowserID() and SteamClient.Browser.GetBrowserID() both do (presumably) the same thing.
    The Window version was used by steam-chat.com until May 2023 or earlier, when it was replaced by the Browser version.

    This reflects a change in the Steam client.
    - The Dec 2022 steam client includes the Window version on its injected SteamClient object.
    - The May 2023 steam client includes the Browser version on its injected SteamClient object.

    To support the Dec 2022 client and others like it, we insert a shim in place of the original call, which will defer to calling GetBrowserID() on the appropriate SteamClient.* interface.

*/
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
//    Compat shim for SteamClient.System.IsSteamInTournamentMode()
//    - Despite the identical name and usage pattern, this SteamClient.System.IsSteamInTournamentMode() is DIFFERENT from SettingsStore.IsSteamInTournamentMode()
//      - The SteamClient.System version returns a promise, while the SettingsStore version is a normal function
//    - Also, since the members of SteamClient (like .System) are not always real JS objects, it's safer to pass the SteamClient to the shim function instead of passing SteamClient.System
//    - Hence the need for two different IsSteamInTournamentMode patches
//
//    Examples:
//      1.  SteamClient.System.IsSteamInTournamentMode().then((e) => (this.m_bSteamIsInTournamentMode = e))
//       -> TFP.Compat.SteamClient_System_IsSteamInTournamentMode(SteamClient, "System", "IsSteamInTournamentMode").then((e) => (this.m_bSteamIsInTournamentMode = e))
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*  -- Notes --
    
    Refer to the other IsSteamInTournamentMode for more info.

*/
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
//
//    Examples:
//      1.  let e = I.Ul.ParentalStore.BIsFriendsBlocked() || I.Ul.SettingsStore.IsSteamInTournamentMode();
//       -> let e = I.Ul.ParentalStore.BIsFriendsBlocked() || TFP.Compat.SettingsStore_IsSteamInTournamentMode(I.Ul.SettingsStore);
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*  -- Notes --
    
    Valve inability to call SettingsStore.IsSteamInTournamentMode() properly is the specific fuckup that required the creation of the entire FixedSteamFriendsUI project.
    Valve tries to call IsSteamInTournamentMode() on two objects (sometimes incorrectly), neither of which exist outside of the sharedjscontext abomination in the pure-shit steam clients.
    
    This is resolved by shimming each call site with a wrapper that ensures a valid return without exceptions.

*/
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
//
//    Examples:
//      1.  u.Ul.AudioPlaybackManager.PlayAudioURL( o.De.COMMUNITY_CDN_URL + "public/sounds/webui/steam_voice_channel_enter.m4a?v=1" )
//       -> u.Ul.AudioPlaybackManager.PlayAudioURL( TFP.Resources.SelectCdnResourceUrl(o.De.COMMUNITY_CDN_URL, "public/sounds/webui/steam_voice_channel_enter.m4a?v=1", "Root", "JsSounds") )
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*  -- Notes --
    
    In order for the snapshot to be 100% local, all resource fetches must go to steamloopback.host instead of the remote Valve servers.
    We achieve that by inserting a shim method in all locations where Valve's js builds url path strings. The shim method will return a different url that originates from the steamloopback.host.

*/
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
//# sourceMappingURL=combined.js.map