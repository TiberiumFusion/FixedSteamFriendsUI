(function()
{
    let api = {};
    let apiName = "ValveFriendsJsRewriter";
    window.ValveFriendsJsRewriter = api;


    // --------------------------------------------------
    //   Infrastructure
    // --------------------------------------------------

    api.GetJibName = function() { return apiName + "_JsInteropBridge"; };
    api.GetJib = function() { return window[api.GetJibName()] }

    api.BindInteropCommunication = function()
    {
        CefSharp.BindObjectAsync(api.GetJibName())
            .then(function (bindResultInfo)
            {
                //console.log("CefSharp.BindObjectAsync() succeeded", bindResultInfo);
                //console.log("bindResultInfo = ", JSON.stringify(bindResultInfo));
                //console.log("JIB CHECK >> ", api.GetJib());
            })
            .catch(function (error)
            {
                console.log("[!!!] CefSharp.BindObjectAsync() threw an unhandled exception. Rethrowing. [!!!]", error);
                throw error;
            });
    }


    // --------------------------------------------------
    //   Main interface
    // --------------------------------------------------

    api.Rewrite = async function()
    {
        let jib = api.GetJib();

        //console.log("Check JIB", jib);
        //console.log(jib.GetInput, jib.SetResult);

        //
        // Configuration
        //

        // Input js code string to rewrite
        let inputJsCodeString = await jib.GetInput();

        // todo: rewrite js

        // Send rewritten code back to C#
        jib.SetResult(inputJsCodeString);
    }

})();
