(function()
{
    let api = {};
    let apiName = "ValveFriendsJsRewriter";
    window.ValveFriendsJsRewriter = api;

    
    // ____________________________________________________________________________________________________
    // 
    //     Infrastructure
    // ____________________________________________________________________________________________________
    //
    
    api.GetJibName = function() { return apiName + "_JsInteropBridge"; };
    api.GetJib = function() { return window[api.GetJibName()] }
    
    api.GetJtbName = function() { return apiName + "_JsTraceBridge"; };
    api.GetJtb = function() { return window[api.GetJtbName()] }

    api.BindInteropCommunication = function()
    {
        // Main
        CefSharp.BindObjectAsync(api.GetJibName())
            .then(function (bindResultInfo)
            {
                //console.log("CefSharp.BindObjectAsync() succeeded", bindResultInfo);
                //console.log("bindResultInfo = ", JSON.stringify(bindResultInfo));
                //console.log("JIB CHECK >> ", api.GetJib());
            })
            .catch(function (error)
            {
                console.log("[!!!] CefSharp.BindObjectAsync(api.GetJibName()) threw an unhandled exception. Rethrowing. [!!!]", error);
                throw error;
            });

        // Tracing
        CefSharp.BindObjectAsync(api.GetJtbName())
            .then(function (bindResultInfo)
            {

            })
            .catch(function (error)
            {
                console.log("[!!!] CefSharp.BindObjectAsync(api.GetJtbName()) threw an unhandled exception. Rethrowing. [!!!]", error);
                throw error;
            });
    }



    // ____________________________________________________________________________________________________
    //
    //     Main
    // ____________________________________________________________________________________________________
    //

    api.RewriteInternal = function(sourceJsCodeString)
    {
        // todo: bring in TsJsRewriter once that's ready

        return sourceJsCodeString;
    }


    // ____________________________________________________________________________________________________
    //
    //     Interop interface
    // ____________________________________________________________________________________________________
    //

    api.Rewrite = async function()
    {
        let jib = api.GetJib();
        let jtb = api.GetJtb();


        //
        // Get input data from C#
        //

        // Input javascript to rewrite
        let inputJsCodeString = await jib.GetInputJavascript();
        
        // SnapshotMaker.TsJsRewriter config
        // CefSharp fails to marshal ExpandoObjects from C# -> JS correctly (they become arrays of item key-value tuples, instead of an actual object)
        // So we send the config over as a json string and then have to parse it back into an object here
        let inputTsJsRewriterConfigJson = await jib.GetInputTsJsRewriterConfigJson();
        let inputTsJsRewriterConfig = JSON.parse(inputTsJsRewriterConfigJson);


        //
        // Extra config
        //

        // Enable traces from the rewriter
        SnapshotMakerTsJsRewriter.EnableTraces = true;

        // Set the trace handler to our own message printer
        SnapshotMakerTsJsRewriter.UserTraceHandler = jtb.Trace;


        //
        // Main
        //

        // Prepare the patches defined in the config
        SnapshotMakerTsJsRewriter.DefinePatches(inputTsJsRewriterConfig);

        // Rewrite the javascript
        let rewriteResult = SnapshotMakerTsJsRewriter.PatchJavascript(inputJsCodeString);
        // return is a SnapshotMaker.TsJsRewriter.PatchJavascriptResult object


        //
        // Distill rewrite result & return
        //

        // PatchJavascriptResult.AppliedPatches[].Applications[].OriginalNode and .PatchedNode are both ts.Nodes with parent references, meaning that the PatchJavascriptResult has cyclical references and fails to stringify to json with the default json library
        // CefSharp is not smart enough to detect this and silently aborts the marshalling process and provides a null instead. Very helpful.
        // The solution is to extract the non-reference data and return that instead, which CefSharp will correctly marshal

        // For now, the C# caller only really cares about the rewritten javascript string. The statistics about the rewrite operation are not needed.
        // So, we will simply return just the rewritten javascript string
        jib.SetResult(rewriteResult.JavascriptString);
    }

})();
