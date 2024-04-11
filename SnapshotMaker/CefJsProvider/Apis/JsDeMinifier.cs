using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CefSharp;
using CefSharp.OffScreen;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.CefJsProvider.Apis
{

    // ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    //    API
    //
    // ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    public class JsDeMinifier : Api
    {
        public string Name { get; } = "JsDeMinifier";

        // ____________________________________________________________________________________________________
        // 
        //     Init
        // ____________________________________________________________________________________________________
        //

        private ChromiumWebBrowser CefBrowser;

        private JsInteropBridge Jib;

        public Task<JavascriptResponse> Bind(ChromiumWebBrowser cefBrowser)
        {
            CefBrowser = cefBrowser;

            // Invoking JS is obnoxious. We cannot directly call JS methods. Instead, we must use eval() to evaluate a string prepared here in C#, e.g. "SomeFunction(1, 2, { hello: 'world' }, 'blah blah');"
            // This means that trying to use JS as a straightforward library interface requires passing all parameters as literals.

            // I don't want to marshal a monstrous js eval() string that contains a 3MB string literal containing the Valve javascript to deminify. Maybe it will work fine. Maybe it wont, like in Awesomium. I dont trust it.
            // So instead we are going to use CefSharp's interop to expose the javascript string to the JS realm first, then call a JS function which will read in that data and process it with pretter.io

            Jib = new JsInteropBridge();
            CefBrowser.JavascriptObjectRepository.Register("JsDeMinifier_JsInteropBridge", Jib, true, BindingOptions.DefaultBinder);
            // There appears to be zero way to make CefSharp create a binding scoped to an object. It always binds to window.
            // This means we are unable to bind each jib to the api object that owns it, because that would just be too normal and convenient and we cant have that
            // So instead we must use names that will never collide under window, i.e. "window.JsDeMinifier_JsInteropBridge" instead of "window.JsDeMinifier.JsInteropBridge"
            // And thus adjust the js of each api object accordingly to look for its jib object under window, not under itself

            Task<JavascriptResponse> jBindTask = CefBrowser.EvaluateScriptAsync(@"JsDeMinifier.BindInteropCommunication();"); // Interop requires a handshake from both C# and JS realms in order to create a binding
            jBindTask.Wait(); // wait for script evaluation to complete

            return jBindTask;
        }


        // ____________________________________________________________________________________________________
        // 
        //     Main interface
        // ____________________________________________________________________________________________________
        //

        /// <summary>
        /// De-minifies a string of javascript code, using prettier.io.
        /// </summary>
        /// <param name="sourceJs">The javascript code to de-minify.</param>
        /// <returns>A string containing the deminified javascript.</returns>
        public string DeMin(string sourceJs)
        {
            // Expose input javascript code string to JS
            Jib.Input = sourceJs; // JS cannot access this field; it can, however, access jib's GetInput() method, which returns the field (rather, a promise which resolved to the field value once that value is marshalled)

            // Run pretter.io on the source javascript
            Task<JavascriptResponse> scriptTask = CefBrowser.EvaluateScriptAsync(@"JsDeMinifier.DeMin();");
            scriptTask.Wait();
            if (!scriptTask.Result.Success)
            {
                if (scriptTask.Exception != null) // scriptTask.Exception may or may not be null. How convenient.
                    throw new CefSharpJavascriptEvalExceptionException(scriptTask.Exception);
                else
                    throw new CefSharpJavascriptEvalFailureException(scriptTask.Result.Message);
            }

            // Get result from pretter.io
            // Jib.Result will still be unassigned at this point. CefSharp does not account for the work required to marshal the return data of the JS function call back to C# land before notifying the conclusion of the JS execution.
            while (!Jib.GotResult) { } // JS calls Jib.SetResult(), which flips GotResult from false to true. Jib.Result is now guaranteed to be assigned.

            object prettierResult = Jib.Result;
            if (prettierResult == null)
                throw new PretterIoFailureException(sourceJs);

            string deminifiedJs = (string)prettierResult; // JS.DeMin() returns a string

            return deminifiedJs;
        }

        public class PretterIoFailureException : Exception
        {
            public string InputJavascriptString { get; private set; }
            public PretterIoFailureException(string inputJavascriptString)
            {
                InputJavascriptString = inputJavascriptString;
            }
        }



        // ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        //    Interop types
        //
        // ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        private class JsInteropBridge
        {
            // CefSharp does not have any interop for fields. Only methods are supported. We cannot use properties either since CefSharp isn't smart enough to bind them properly.
            // So instead of this class being a simple buffer object with an input and result field, we have to use methods for JS to get and set its fields

            //
            // C# -> JS
            //

            public object Input; // The data JS needs, assigned here in C#
            public object GetInput() // JS calls this to get that data
            {
                return Input;
            }

            //
            // JS -> C#
            //

            public object Result; // The data we want from JS
            public bool GotResult = false;
            public void SetResult(object result) // JS calls this to set that data
            {
                Result = result;
                GotResult = true;
            }
        }
    }
}
