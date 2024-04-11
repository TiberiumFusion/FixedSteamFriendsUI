(function()
{
    let api = {};
    let apiName = "JsDeMinifier";
    window.JsDeMinifier = api;


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

    api.DeMin = async function()
    {
        let jib = api.GetJib();

        //console.log("Check JIB", jib);
        //console.log(jib.GetInput, jib.SetResult);

        //
        // Configuration
        //

        // Input js code string to de-minify
        let inputJsCodeString = await jib.GetInput();

        // Options for prettier.io
        let options =
        {
            // Deminification engine
            parser: "babel",
            plugins: prettierPlugins, // files like plugins/babel.js and plugins/estree.js appear to automatically create window-bound symbol "prettierPlugins" and insert themselves into it

            // Code formatting
            printWidth: 1000, // Rough maximum characters per line. Not exact. Prettier.io will fudge this somewhat.
                // This param has undocumented behavior when set to magic numbers. The magic numbers are dependent on the input source code.
                // - When >= {magic number 1}, prettier.io will fail to achieve "one item declaration per line" for things like list and object literals, and instead put every single item on 1 line. The magic number varies for each symbol in the input javascript. For example, 6149 will make long literals (> ~20 items) get "one item per line", but shorter literals (< ~20 items) will be smashed into all items on 1 line. Ugly.
                // - When <= {magic number 2}, pretter.io will fail to achieve one item per line even when there is zero reason not to. For example, when set to 700, it will write key:\nvalue instead of key: value for lines which are only 80 characters long - clearly well below 700.
                // There is zero option to properly control this behavior to ensure every list/dictionary item declaration gets its own line. I guess that's just too much effort for web dev knuckledraggers.
            tabWidth: 4, // Number of spaces to use in fake tabs, also controls prettier.io's expectation of indentation level(?)
            useTabs: true, // Use tabs instead of fake tabs
        };


        //
        // Run prettier.io
        //

        let formattedCode = await prettier.format(inputJsCodeString, options);

        // Send formatted code back to C#
        jib.SetResult(formattedCode);
    }

})();
