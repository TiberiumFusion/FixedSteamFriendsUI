(function()
{
    let api = {};
    let apiName = "JsTranspiler";
    window.JsTranspiler = api;


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

    api.Transpile = async function()
    {
        let jib = api.GetJib();


        //
        // Get input data from C#
        //

        // Input js code string to de-minify
        let inputJsCodeString = await jib.GetInputJavascript();

        // Json configuration for babel
        let babelJsonConfigString = await jib.GetInputBabelConfigJson(); // workaround cefsharp ExpandoObject marshalling failure
        let babelJsonConfig = JSON.parse(babelJsonConfigString);


        //
        // Transpile
        //

        let transpileResult = Babel.transform(inputJsCodeString, babelJsonConfig);
        // transfom() throws directly from within the babel processing routines when an exception occurs
        // We will allow this exception to break this section and thus raise an according exception in C# land

        let transpiledCodeString = transpileResult.code;

        
        // Send transpiled code back to C#
        jib.SetResult(transpiledCodeString);
    }

})();
