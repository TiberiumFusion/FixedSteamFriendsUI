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


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export class DisableLate2023ChatCensorshipFeatureAdditionCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "DisableLate2023ChatCensorshipFeatureAddition";

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
                    //
                    // Patch location 1
                    //

                    if (detectionInfoData.Location == 1)
                    {
                        let tnode: ts.Block = detectionInfoData.TypedNode;
                        /* e.g. body of this function:
                            InitSteamEngineLanguages() {
						        null != this.m_WebUIServiceTransport && (this.m_WebUIServiceTransport.messageHandlers.RegisterServiceNotificationHandler(_.gi.NotifyTextFilterDictionaryChangedHandler, this.OnTextFilterDictionaryChanged), this.InitSteamEngineLanguage(u.De.LANGUAGE), "english" !== u.De.LANGUAGE && this.InitSteamEngineLanguage("english"));
                            }
                        */

                        // Replace function body with stub
                        let stub: ts.Statement = context.factory.createEmptyStatement();

                        if (IncludeOldJsCommentAtPatchSites)
                        {
                            let oldJs: string = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile)
                                .replace("{", "").replace("}", "").trim(); // typescript has no built-in for printing only the inside of a block (just the statement, no braces)
                            ts.addSyntheticLeadingComment(stub, ts.SyntaxKind.MultiLineCommentTrivia, oldJs, false);
                        }

                        return context.factory.updateBlock(tnode, [ stub ]);
                    }

                    //
                    // Patch location 2
                    //

                    else if (detectionInfoData.Location == 2)
                    {
                        let tnode: ts.IfStatement = detectionInfoData.TypedNode;
                        // In 8601984:  if (null != this.m_WebUIServiceTransport) { ...
                        // In 8811541:  if (this.m_WebUIServiceTransport.BIsValid()) ...

                        // Replace the conditional with constant false
                        let constantExpression = context.factory.createFalse();

                        if (IncludeOldJsCommentAtPatchSites)
                            ts.addSyntheticLeadingComment(constantExpression, ts.SyntaxKind.MultiLineCommentTrivia, JsEmitPrinter.printNode(ts.EmitHint.Unspecified, tnode.expression, sourceFile), false);

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
                    (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node) =>
                    {
                        if (node.kind == ts.SyntaxKind.Block)
                        {
                            let tnode = node as ts.Block;

                            // Validate parent function definition
                            if (tnode.parent.kind == ts.SyntaxKind.MethodDeclaration) // e.g.  InitSteamEngineLanguages() { }
                            {
                                let method = tnode.parent as ts.MethodDeclaration;
                                if (method.name.kind == ts.SyntaxKind.Identifier && (method.name as ts.Identifier).escapedText == "InitSteamEngineLanguages")
                                {
                                    return new DetectionInfo(true, {
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
                    (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node) =>
                    {
                        if (node.kind == ts.SyntaxKind.IfStatement)
                        {
                            let tnode = node as ts.IfStatement;

                            // Validate expected method
                            let method = AstFindFirstAncestor(tnode, ts.SyntaxKind.MethodDeclaration);
                            if (method != null)
                            {
                                let methodTNode = method as ts.MethodDeclaration;
                                if (methodTNode.name.kind == ts.SyntaxKind.Identifier && (methodTNode.name as ts.Identifier).escapedText == "LoadLanguage")
                                {
                                    // Validate if statement condition
                                    let ifConditionJs: string = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, tnode.expression, sourceFile); // tnode.expression can be anything; such as BinaryExpression or CallExpression
                                    if (ifConditionJs.includes("m_WebUIServiceTransport"))
                                    {
                                        // Highly likely match
                                        return new DetectionInfo(true, {
                                            "Location": 2,
                                            "TypedNode": tnode,
                                        });
                                    }
                                }
                            }
                        }
                    },
                ],

            );
        }
    }
    
}
