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

    public class ValveFriendsJsRewriter : Api
    {
        public string Name { get; } = "ValveFriendsJsRewriter";

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

            // Same interop pattern as the JsDeMinifier
            Jib = new JsInteropBridge();
            CefBrowser.JavascriptObjectRepository.Register("ValveFriendsJsRewriter_JsInteropBridge", Jib, true, BindingOptions.DefaultBinder);

            Task<JavascriptResponse> jBindTask = CefBrowser.EvaluateScriptAsync(@"ValveFriendsJsRewriter.BindInteropCommunication();");
            jBindTask.Wait();

            return jBindTask;
        }


        // ____________________________________________________________________________________________________
        // 
        //     Main interface
        // ____________________________________________________________________________________________________
        //

        /// <summary>
        /// Rewrites portions of steam-chat.com/public/javascript/webui/friends.js. Inclues 1) automatic patching of the various patch locations, and 2) marking of patch locations that require a human.
        /// </summary>
        /// <param name="sourceJs">The friends.js javascript code to rewrite.</param>
        /// <returns>A string containing the rewritten friends.js javascript code.</returns>
        public string Rewrite(string sourceJs)
        {
            // Same interop pattern as the JsDeMinifier
            Jib.Input = sourceJs;

            // Run pretter.io on the source javascript
            Task<JavascriptResponse> scriptTask = CefBrowser.EvaluateScriptAsync(@"ValveFriendsJsRewriter.Rewrite();");
            scriptTask.Wait();
            if (!scriptTask.Result.Success)
            {
                if (scriptTask.Exception != null)
                    throw new CefSharpJavascriptEvalExceptionException(scriptTask.Exception);
                else
                    throw new CefSharpJavascriptEvalFailureException(scriptTask.Result.Message);
            }

            // Get result from pretter.io
            // Jib.Result will still be unassigned at this point. CefSharp does not account for the work required to marshal the return data of the JS function call back to C# land before notifying the conclusion of the JS execution.
            while (!Jib.GotResult) { } // JS calls Jib.SetResult(), which flips GotResult from false to true. Jib.Result is now guaranteed to be assigned.

            object rewriteResult = Jib.Result;
            //if (prettierResult == null)
            //    throw new PretterIoFailureException(sourceJs);

            string rewrittenJs = (string)rewriteResult; // ValveFriendsJsRewriter.Rewrite() returns a string

            return rewrittenJs;
        }
        /*
        public class PretterIoFailureException : Exception
        {
            public string InputJavascriptString { get; private set; }
            public PretterIoFailureException(string inputJavascriptString)
            {
                InputJavascriptString = inputJavascriptString;
            }
        }
        */


        // ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        //    Interop types
        //
        // ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        private class JsInteropBridge
        {
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
