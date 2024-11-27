// Javascript infrastructure

(function ()
{

    // ____________________________________________________________________________________________________
    //
    //     JS loader
    // ____________________________________________________________________________________________________
    //

    // For loading and evaluating shared javascript components without needing to modify index.html to load them via <script> elements
    // Same as in the outer frame's friends.js, for loading those shared components in the same way the outer frame does (since they do not register into global TFP object, but instead return a component object instance)
    TFP.LoadJs = function(path)
    {
        let xhr = new XMLHttpRequest();
        xhr.open("GET", path, false); // must be synchronous
        xhr.send();

        if (xhr.status < 200 || xhr.status >= 300)
        {
            console.error("[!!!] Failed to load js file from path: '" + path + "' (full url: '" + xhr.responseURL + "'), http: " + xhr.status + " [!!!]");
            throw new Error();
        }

        if (xhr == null || typeof xhr.response !== "string" || xhr.length == 0)
        {
            console.error("[!!!] Failed to load js file from path: '" + path + "' (full url: '" + xhr.responseURL + "'), file contents are empty or were not retrieved as text");
            throw new Error();
        }

        // Hideous javascript kludge to run eval() in the global scope (i.e. on window)
        // See: https://stackoverflow.com/q/9107240
        return (1, eval)(xhr.responseText);
    }


})();
