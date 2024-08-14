using System;
using System.Collections.Generic;
using System.Dynamic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CefSharp;
using CefSharp.OffScreen;
using Newtonsoft.Json;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.CefJsProvider.Apis
{

    // ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    //    API
    //
    // ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    public class JsTranspiler : Api
    {
        public string Name { get; } = "JsTranspiler";

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

            // Same base interop as JsDeMinifier
            Jib = new JsInteropBridge();
            CefBrowser.JavascriptObjectRepository.Register("JsTranspiler_JsInteropBridge", Jib, true, BindingOptions.DefaultBinder);

            Task<JavascriptResponse> jBindTask = CefBrowser.EvaluateScriptAsync(@"JsTranspiler.BindInteropCommunication();");
            jBindTask.Wait();

            return jBindTask;
        }


        // ____________________________________________________________________________________________________
        // 
        //     Main interface
        // ____________________________________________________________________________________________________
        //

        /// <summary>
        /// Transpiles a string of javascript code, using babel.
        /// </summary>
        /// <param name="sourceJs">The javascript code to transpile.</param>
        /// <param name="babelConfigJson">Configuration object used by babel.</param>
        /// <returns>A string containing the transpiled javascript.</returns>
        public string Transpile(string sourceJs, ExpandoObject babelConfigJson)
        {
            // Same interop pattern as the JsDeMinifier
            Jib.InputJavascript = sourceJs;
            Jib.InputBabelConfigJson = JsonConvert.SerializeObject(babelConfigJson);

            // Run pretter.io on the source javascript
            Task<JavascriptResponse> scriptTask = CefBrowser.EvaluateScriptAsync(@"JsTranspiler.Transpile();");
            scriptTask.Wait();
            if (!scriptTask.Result.Success)
            {
                if (scriptTask.Exception != null)
                    throw new CefSharpJavascriptEvalExceptionException(scriptTask.Exception);
                else
                    throw new CefSharpJavascriptEvalFailureException(scriptTask.Result.Message);
            }

            while (!Jib.GotResult) { } // insurance against slow/sloppy cefsharp async marshalling from js -> c#

            object transpileResult = Jib.Result; // Jib.Result is guaranteed to be set, since the js will throw if babel fails to produce an output

            string transpiledJs = (string)transpileResult; // JsTranspiler.Transpile() returns a string

            return transpiledJs;
        }



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

            public string InputJavascript;
            public string GetInputJavascript()
            {
                return InputJavascript;
            }

            public string InputBabelConfigJson;
            public string GetInputBabelConfigJson()
            {
                return InputBabelConfigJson;
            }

            //
            // JS -> C#
            //

            public object Result; // Transpiled javascript
            public bool GotResult = false;
            public void SetResult(object result)
            {
                Result = result; // JS return is the transpiled javascript
                GotResult = true;
            }
        }
    }
}
