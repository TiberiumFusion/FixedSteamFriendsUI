using System;
using System.Collections.Generic;
using System.Dynamic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using CefSharp;
using CefSharp.OffScreen;
using HtmlAgilityPack;
using static TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Helpers;
using static TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Helpers.HtmlAgilityPack;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Snapshot.Procedures.AmendSnapshot
{
    public class Fixer
    {

        // ____________________________________________________________________________________________________
        // 
        //     Configuration
        // ____________________________________________________________________________________________________
        //

        /// <summary>
        /// Toggles for each category of resources to modify
        /// </summary>
        public Dictionary<ResourceCategory, bool> ResourceTypesToModify;

        /// <summary>
        /// Move the original version of modified file to a new file name, then write the modified version at the original file name.
        /// </summary>
        public bool PreserveOriginalCopyOfModifiedFiles = true;

        public Fixer()
        {
            // --------------------------------------------------
            //   Default config
            // --------------------------------------------------

            ResourceTypesToModify = new Dictionary<ResourceCategory, bool>();
            foreach (ResourceCategory category in Enum.GetValues(typeof(ResourceCategory)))
                ResourceTypesToModify[category] = true; // Process everything (that needs processing)
        }



        // ____________________________________________________________________________________________________
        // 
        //     Main interface
        // ____________________________________________________________________________________________________
        //

        public void ModifySteamchatDotComSnapshot(string snapshotDirectoryPath)
        {
            // --------------------------------------------------
            //   Change absolute resource URLs to relative paths
            // --------------------------------------------------

            LogLine("Preparing to modify URLs");

            //
            // index.html
            //

            if (ResourceTypesToModify[ResourceCategory.Html])
            {
                LogLine("Fixing URLs in \"index.html\"");

                string rootHtmlPath = QualifyPathWebFile(snapshotDirectoryPath, "index.html");

                HtmlDocument rootHtml = new HtmlDocument();
                rootHtml.LoadHtml(File.ReadAllText(rootHtmlPath, Encoding.UTF8));

                // We only need to change the URLs for elements in the <head>
                HtmlNode rhHead = rootHtml.DocumentNode.SelectSingleNode("/html/head");

                foreach (HtmlNode linkNode in rhHead.SelectNodes(".//link"))
                {
                    // CSS
                    if (IsLinkNodeCss(linkNode))
                    {
                        string urlFull = linkNode.GetAttributeValue("href", "");
                        string urlRel = GetValveResourcePath(urlFull);
                        linkNode.SetAttributeValue("href", urlRel);

                        LogLine("- " + urlRel);
                    }

                    // Favicon
                    else if (linkNode.GetAttributeValue("href", "").TrimStart('/') == "favicon.ico")
                    {
                        linkNode.SetAttributeValue("href", "favicon.ico"); // Change "/favicon.ico" to "favicon.ico"

                        LogLine("- favicon.ico");
                    }
                }

                // JS
                foreach (HtmlNode scriptNode in rhHead.SelectNodes(".//script"))
                {
                    string urlFull = scriptNode.GetAttributeValue("src", "");
                    if (!string.IsNullOrWhiteSpace(urlFull))
                    {
                        string urlRel = GetValveResourcePath(urlFull);
                        scriptNode.SetAttributeValue("src", urlRel);

                        LogLine("- " + urlRel);
                    }
                }

                Log("Saving changes...");
                WriteModifiedFileUtf8(rootHtmlPath, rootHtml.DocumentNode.OuterHtml);
                LogOK();
            }


            //
            // public/shared/css/motiva_sans.css
            //

            // Make the @font-face url()s in the css relative to the snapshot structure
            if (ResourceTypesToModify[ResourceCategory.CssFonts])
            {
                string cssMotivaSansPathRel = "public/shared/css/motiva_sans.css";
                string cssMotivaSansPathFull = QualifyPathWebFile(snapshotDirectoryPath, cssMotivaSansPathRel);
                if (File.Exists(cssMotivaSansPathFull))
                {
                    LogLine("Fixing URLs in \"" + cssMotivaSansPathRel + "\"...");

                    string cssRaw = File.ReadAllText(cssMotivaSansPathFull, Encoding.UTF8);

                    MatchCollection matchedSrcUrls = CssFontFaceUrlFinder.Matches(cssRaw);
                    foreach (Match match in matchedSrcUrls.Reverse())
                    {
                        string urlStartMagic = "url('";
                        int urlStartPos = match.Value.IndexOf(urlStartMagic) + urlStartMagic.Length;

                        string urlEndMagic = "')";
                        int urlEndPos = match.Value.LastIndexOf(urlEndMagic);

                        string urlFull = match.Value.Substring(urlStartPos, urlEndPos - urlStartPos); // https://community.cloudflare.steamstatic.com/public/shared/fonts/MotivaSans-Regular.ttf?v=4.015
                        string urlRelToRoot = GetValveResourcePath(urlFull); // public/shared/fonts/MotivaSans-Regular.ttf
                        string urlRelToCssFile = Path.GetRelativePath(Path.GetDirectoryName(cssMotivaSansPathRel), urlRelToRoot).Replace('\\', '/');

                        LogLine("- " + urlRelToRoot);

                        cssRaw = cssRaw.Remove(match.Index, match.Value.Length)
                            .Insert(match.Index, string.Format("src: url('{0}')", urlRelToCssFile));
                    }

                    Log("Saving changes...");
                    WriteModifiedFileUtf8(cssMotivaSansPathFull, cssRaw);
                    LogOK();
                }
            }


            // --------------------------------------------------
            //   De-minify the Valve JS files we need to modify
            // --------------------------------------------------

            // Symbol names are unrecoverable, but we can at least reintroduce a small amount of code formatting to Valve's bastardized javascript
            // For this purpose afaik there is only one deminifer that 1) uses Babel and 2) doesn't crash on excessively massive javascript files like Valve's friends.js
            // And that is prettier.io

            // Unfortunately, like many deminifiers, prettier.io is implemented in (chromezilla) javascript itself, and thus is an absolute pain in the ass to get running outside of a web browser
            // There is a web user interface which exposes all options and it works, and that's what I've used so far, but the point of this Snapshot Maker is to automate all of this, so we need to use prettier.io's library API instead
            // prettier.io is available as a standard javascript file and has a basic interface described here: https://prettier.io/docs/en/browser

            // Now all we need is a way to run this fucking javascript... and since it's chromezilla javascript and not normal javascript, it will break anything that isn't chromezilla
            // Enter CefSharp, which provides the CEF flavor of chromezilla through a C# interface. It's unofficial, messy, and has some painful usage patterns, but it seems to be the only ready-made option available.
            // Here we are using the "OffScreen" variant of CefSharp, which is unfortunately the smallest one available. There is no variant which strips away all the cancer & bloat and leaves just the smoke belching V8 behind.


            if (ResourceTypesToModify[ResourceCategory.Js])
            {
                LogLine("\nPreparing to de-minify javascript");


                //
                // Configuration
                //

                string[] deminTargetsPaths = new string[]
                {
                "public/javascript/webui/friends.js", // so far this is the only file that a human needs to modify, so it's the only one needing deminification
                };


                //
                // Create a CEF instance to host the HTML doc which hosts the pretter.io library
                //

                Log("Initializing CefSharp prettier.io host...");

                // Document which provides the js-side interface to prettier.io
                string targetWebpageUrl = Path.Combine(Directory.GetCurrentDirectory(), @"JsDeMinifier\Main.html");

                // CefSharp configuration
                CefSettings cefSettings = new CefSettings();
                cefSettings.WindowlessRenderingEnabled = true;
                cefSettings.CefCommandLineArgs.Add("disable-application-cache"); // don't cache retrieved resources

                if (!Cef.Initialize(cefSettings, true))
                    throw new CefSharpInitException();

                // CEF browser instance
                ChromiumWebBrowser cefBrowser = new ChromiumWebBrowser(targetWebpageUrl);

                // CefSharp (and CEF itself) is unfortunately infested with an advanced async-code-only virus. We will be fighting against this in multiple places from here on out.

                // When ChromiumWebBrowser's ctor returns, the target document is NOT loaded yet and thus is not ready for any sort of use whatsoever

                // This awaitable returns once the HTML document is loaded and ready to execute scripts
                cefBrowser.WaitForInitialLoadAsync().Wait();


                //
                // Set up C# <-> JS communication
                //

                // This does not exist out of the box and requires manual set up every time. Tragically, CefSharp gives us zero ability to directly read or write data in the JS realm. The only way to get data out of JS is to make JS expressly send it to us by calling a method on an interop-bound object to marshal the data across.

                // Invoking JS is also obnoxious. We cannot directly call JS methods. Instead, we must use eval() to evaluate a string prepared here in C#, e.g. "SomeFunction(1, 2, { hello: 'world' }, 'blah blah');"
                // This means that trying to use JS as a straightforward library interface requires passing all parameters as literals.

                // I don't want to marshal a monstrous js eval() string that contains a 3MB string literal containing the Valve javascript to deminify. Maybe it will work fine. Maybe it wont, like in Awesomium. I dont trust it.
                // So instead we are going to use CefSharp's interop to expose the javascript string to the JS realm first, then call a JS function which will read in that data and process it with pretter.io

                cefBrowser.JavascriptObjectRepository.NameConverter = null; // Stop CefSharp from annoyingly changing symbol names on us

                JsInteropBridge jib = new JsInteropBridge();
                cefBrowser.JavascriptObjectRepository.Register("JsInteropBridge", jib, BindingOptions.DefaultBinder);

                Task<JavascriptResponse> jBindTask = cefBrowser.EvaluateScriptAsync(@"BindInteropCommunication();"); // Interop requires a handshake from both C# and JS realms in order to create a binding
                jBindTask.Wait(); // wait for script evaluation to complete
                if (!jBindTask.Result.Success)
                {
                    LogERROR();
                    LogLine("[!!!] JS threw an exception during binding setup [!!!]");
                    throw new CefSharpJavascriptEvalException(jBindTask.Exception);
                }

                LogOK();


                //
                // Invoke pretter.io on the javascript we need to process
                //

                foreach (string deminTargetPath in deminTargetsPaths)
                {
                    Log("Deminifying \"" + deminTargetPath + "\"...");

                    // Validate and read file
                    string deminTargetFullPath = QualifyPathWebFile(snapshotDirectoryPath, deminTargetPath);
                    if (!File.Exists(deminTargetFullPath))
                        throw new FileNotFoundException("De-minify target \"" + deminTargetPath + "\" does not exist in snapshot directory \"" + snapshotDirectoryPath + "\"", deminTargetFullPath);

                    string rawJs = File.ReadAllText(deminTargetFullPath, Encoding.UTF8);

                    // Expose input javascript code string to JS
                    jib.Input = rawJs; // JS cannot access this field; it can, however, access jib's GetInput() method, which returns the field (rather, a promise which resolved to the field value once that value is marshalled)

                    // Run pretter.io
                    Task<JavascriptResponse> scriptTask = cefBrowser.EvaluateScriptAsync(@"DeMin();");
                    scriptTask.Wait();
                    if (!scriptTask.Result.Success)
                    {
                        LogERROR();
                        LogLine("[!!!] JS threw an exception during main operation [!!!]");
                        throw new CefSharpJavascriptEvalException(jBindTask.Exception);
                    }

                    // Get result from pretter.io
                    // jib.Result will still be unassigned at this point. CefSharp does not account for the work required to marshal the return data of the JS function call back to C# land before notifying the conclusion of the JS execution.
                    while (!jib.GotResult) { } // JS calls jib.SetResult(), which flips GotResult from false to true. jib.Result is now guaranteed to be assigned.

                    object prettierResult = jib.Result;
                    if (prettierResult == null)
                    {
                        LogERROR();
                        LogLine("[!!!] prettier.io returned null [!!!]");
                        throw new PretterIoFailureException(rawJs);
                    }

                    string deminifiedJs = (string)prettierResult; // JS.DeMin() returns a string

                    // Write deminified js to disk
                    WriteModifiedFileUtf8(deminTargetFullPath, deminifiedJs);

                    LogOK();
                }
            }


            //
            // Dispose Cef
            //

            Log("Shutting down CefSharp...");
            Cef.Shutdown();
            LogOK();

        }



        // ____________________________________________________________________________________________________
        // 
        //     CefSharp necessities
        // ____________________________________________________________________________________________________
        //

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



        // ____________________________________________________________________________________________________
        // 
        //     Helpers
        // ____________________________________________________________________________________________________
        //

        // --------------------------------------------------
        //   File modification
        // --------------------------------------------------

        private void WriteModifiedFileUtf8(string path, string contents)
        {
            if (PreserveOriginalCopyOfModifiedFiles)
            {
                string preserveFilePath = path + ".original";
                File.Move(path, preserveFilePath);
            }
            else
            {
                File.Delete(path);
            }

            File.WriteAllText(path, contents, Encoding.UTF8);
        }

    }


    public class CefSharpInitException : Exception
    {
        public CefSharpInitException() { }
    }

    public class CefSharpJavascriptEvalException : Exception
    {
        public AggregateException CefSharpInteropException { get; private set; }
        public CefSharpJavascriptEvalException(AggregateException cefSharpInteropException)
        {
            CefSharpInteropException = cefSharpInteropException;
        }
    }

    public class PretterIoFailureException : Exception
    {
        public string InputJavascriptString { get; private set; }
        public PretterIoFailureException(string inputJavascriptString)
        {
            InputJavascriptString = inputJavascriptString;
        }
    }

}
