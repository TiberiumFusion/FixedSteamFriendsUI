using System;
using System.Collections.Generic;
using System.Dynamic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CefSharp;
using CefSharp.OffScreen;
using Newtonsoft.Json;
using static TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Helpers;

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

        private JsTraceBridge Jtb;

        public Task<JavascriptResponse> Bind(ChromiumWebBrowser cefBrowser)
        {
            CefBrowser = cefBrowser;

            // Same base interop pattern as the JsDeMinifier
            Jib = new JsInteropBridge();
            CefBrowser.JavascriptObjectRepository.Register("ValveFriendsJsRewriter_JsInteropBridge", Jib, true, BindingOptions.DefaultBinder);

            // But with a basic js -> c# message bridge added
            Jtb = new JsTraceBridge();
            CefBrowser.JavascriptObjectRepository.Register("ValveFriendsJsRewriter_JsTraceBridge", Jtb, true, BindingOptions.DefaultBinder);

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
        /// Rewrites portions of steam-chat.com/public/javascript/webui/friends.js, per the provided patch definitions configuration, using the SnapshotMaker.TsJsRewriter program.
        /// </summary>
        /// <param name="sourceJs">The friends.js javascript code to rewrite.</param>
        /// <param name="tsJsRewriterConfig">Configuration object required by the TsJsRewriter. Defines patches and their configuration.</param>
        /// <returns>The rewritten javascript string.</returns>
        public string Rewrite(string sourceJs, ExpandoObject tsJsRewriterConfig)
        {
            // Same interop pattern as the JsDeMinifier
            Jib.InputJavascript = sourceJs;
            Jib.InputTsJsRewriterConfigJson = JsonConvert.SerializeObject(tsJsRewriterConfig);

            // Rewrite the javascript
            Task<JavascriptResponse> scriptTask = CefBrowser.EvaluateScriptAsync(@"ValveFriendsJsRewriter.Rewrite();");
            scriptTask.Wait();
            if (!scriptTask.Result.Success)
            {
                if (scriptTask.Exception != null)
                    throw new CefSharpJavascriptEvalExceptionException(scriptTask.Exception);
                else
                    throw new CefSharpJavascriptEvalFailureException(scriptTask.Result.Message);
            }

            while (!Jib.GotResult) { } // insurance against slow/sloppy cefsharp async marshalling from js -> c#

            object rewriteResult = Jib.Result;

            string rewrittenJs = (string)rewriteResult; // ValveFriendsJsRewriter.Rewrite() returns a string

            return rewrittenJs;
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
            public string GetInputJavascript() { return InputJavascript; }


            public string InputTsJsRewriterConfigJson;
            public string GetInputTsJsRewriterConfigJson() { return InputTsJsRewriterConfigJson; }


            //
            // JS -> C#
            //

            public string Result; // The data we want from JS
            public bool GotResult = false;
            public void SetResult(string result) // JS calls this to set that data
            {
                Result = result; // JS return is the rewritten javascript string
                GotResult = true;
            }
        }

        private class JsTraceBridge
        {
            //
            // JS -> C#
            //

            // Basic js -> c# message bridge
            // JS calls this with some strings and we print it
            // The intent and benefit of doing this is that we avoid CefSharp's awful unreadable default js -> c# printer for console.log() calls
            public void Trace(params string[] message)
            {
                List<string> items = new List<string>();
                items.Add("[JS]");
                items.AddRange(message);
                LogLine(items.ToArray());
            }
        }
    }
}
