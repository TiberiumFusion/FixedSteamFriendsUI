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

        //console.log("Check JIB", jib);
        //console.log(jib.GetInput, jib.SetResult);


        jtb.Trace("test1");
        
        // Input js code string to rewrite
        let inputJsCodeString = await jib.GetInput();



        jtb.Trace("test2");

        jtb.Trace("test3", "and more");

        // todo: rewrite js
        let rewrittenJsCodeString = api.RewriteInternal(inputJsCodeString);

        // Send rewritten code back to C#
        jib.SetResult(rewrittenJsCodeString);
    }

})();
