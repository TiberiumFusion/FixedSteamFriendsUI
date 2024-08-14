using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CefSharp;
using CefSharp.OffScreen;
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.CefJsProvider.Apis;
using static TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Helpers;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.CefJsProvider
{
    public class CefJsHost
    {
        // ____________________________________________________________________________________________________
        // 
        //     Internals
        // ____________________________________________________________________________________________________
        //

        /// <summary>
        /// Changes from false to true after <see cref="Initialize"/> is called.
        /// </summary>
        public bool IsInitialized { get; private set; } = false;

        private ChromiumWebBrowser CefBrowser;

        // APIs
        private List<Api> Apis;
        public JsDeMinifier ApiJsDeMinifier { get; private set; }
        public ValveFriendsJsRewriter ApiValveFriendsJsRewriter { get; private set; }
        public JsTranspiler ApiJsTranspiler { get; private set; }

        public CefJsHost()
        {
            ApiJsDeMinifier = new JsDeMinifier();
            ApiValveFriendsJsRewriter = new ValveFriendsJsRewriter();
            ApiJsTranspiler = new JsTranspiler();

            Apis = new List<Api>()
            {
                ApiJsDeMinifier,
                ApiValveFriendsJsRewriter,
                ApiJsTranspiler,
            };
        }


        // ____________________________________________________________________________________________________
        // 
        //     Main interface
        // ____________________________________________________________________________________________________
        //

        /// <summary>
        /// Enables console traces from calls to the main interface.
        /// </summary>
        public bool Trace { get; set; } = true;

        /// <summary>
        /// Instantiates a cef instance, then initializes and binds all apis to that cef instance.
        /// </summary>
        /// <param name="onlyIfUnintialized">Abort if we are already initialized.</param>
        /// <returns>Returns false if <paramref name="onlyIfUnintialized"/> == true and we are already initialized. Returns true if we did initialize.</returns>
        public bool Initialize(bool onlyIfUnintialized = true)
        {
            if (onlyIfUnintialized && IsInitialized)
                return false;


            if (Trace)
                LogLine("Initializing CefJsHost");


            //
            // Create a CEF instance to host the HTML doc which hosts all the js procedures we need
            //

            if (Trace)
                Log("- Creating cef instance...");

            string targetWebpageUrl = Path.Combine(Directory.GetCurrentDirectory(), @"CefJsProviderWebFiles\Main.html");

            // CefSharp configuration
            CefSettings cefSettings = new CefSettings();
            cefSettings.WindowlessRenderingEnabled = true;
            cefSettings.CefCommandLineArgs.Add("disable-application-cache"); // don't cache retrieved resources

            if (!Cef.Initialize(cefSettings, true))
                throw new CefSharpInitException();

            // CEF browser instance
            CefBrowser = new ChromiumWebBrowser(targetWebpageUrl);

            // CefSharp (and CEF itself) is unfortunately infested with an advanced async-code-only virus. We will be fighting against this in multiple places from here on out.

            // When ChromiumWebBrowser's ctor returns, the target document is NOT loaded yet and thus is not ready for any sort of use whatsoever

            // This awaitable returns once the HTML document is loaded and ready to execute scripts
            CefBrowser.WaitForInitialLoadAsync().Wait();

            if (Trace)
                LogOK();


            //
            // Set up C# <-> JS communication
            //

            // This does not exist out of the box and requires manual set up every time. Tragically, CefSharp gives us zero ability to directly read or write data in the JS realm. The only way to get data out of JS is to make JS expressly send it to us by calling a method on an interop-bound object to marshal the data across.

            CefBrowser.JavascriptObjectRepository.NameConverter = null; // Stop CefSharp from annoyingly changing symbol names on us

            if (Trace)
                LogLine("- Binding apis");

            foreach (Api api in Apis)
            {
                if (Trace)
                    Log(string.Format("  - {0}...", api.Name));

                Task<JavascriptResponse> jBindTask = api.Bind(CefBrowser);
                // See comments in JsDeMinifier for more on this process. It's the primordial CefJsHost api.

                if (jBindTask.Result.Success)
                {
                    if (Trace)
                        LogOK();
                }
                else
                {
                    LogERROR();
                    if (jBindTask.Exception != null) // scriptTask.Exception may or may not be null. How convenient.
                    {
                        if (Trace)
                            LogLine("[!!!] JS threw an exception during binding setup [!!!]");
                        throw new CefSharpJavascriptEvalExceptionException(jBindTask.Exception);
                    }
                    else
                    {
                        if (Trace)
                            LogLine("[!!!] JS experienced a non-halting eval failure during binding setup [!!!]");
                        throw new CefSharpJavascriptEvalFailureException(jBindTask.Result.Message);
                    }
                }
            }


            IsInitialized = true;

            return true;
        }

    }
}
