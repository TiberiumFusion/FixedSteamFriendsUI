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
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.CefJsProvider;
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.CefJsProvider.Apis;
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
        /// If false, modified versions of files will overwrite the originals. If true, modified Move the original version of modified file to a new file name, then write the modified version at the original file name.
        /// </summary>
        public FileWriteMode ModifiedFileWriteMode = FileWriteMode.IncrementSxs;

        public enum Task
        {
            None,
            RelativePathsInRootHtml,
            RelativePathsInCssFontFaceUrls,
            DeMinifyTargetJs,
        }

        /// <summary>
        /// Toggles for each task we can perform.
        /// </summary>
        public Dictionary<Task, bool> EnabledTasks = new Dictionary<Task, bool>();

        public Fixer()
        {
            // --------------------------------------------------
            //   Default config
            // --------------------------------------------------

            // Filter by types of resources to modify
            ResourceTypesToModify = new Dictionary<ResourceCategory, bool>();
            foreach (ResourceCategory category in Enum.GetValues(typeof(ResourceCategory)))
                ResourceTypesToModify[category] = true; // Process everything (that needs processing)

            // Filter by types of tasks to perform
            SetEnableAllTasks(true); // Enable all tasks
        }

        public void SetEnableAllTasks(bool value)
        {
            foreach (Task task in Enum.GetValues(typeof(Task)))
            {
                if (task != Task.None)
                    EnabledTasks[task] = value;
            }
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
            
            if (EnabledTasks[Task.RelativePathsInRootHtml] && ResourceTypesToModify[ResourceCategory.Html])
            {
                LogLine("Fixing URLs in \"index.html\"");

                string rootHtmlPath = QualifyPathWebFile(snapshotDirectoryPath, "index.html");

                string rootHtmlRaw = File.ReadAllText(GetPathForHighestIncrementOfFile(rootHtmlPath), Encoding.UTF8);

                HtmlDocument rootHtml = new HtmlDocument();
                rootHtml.LoadHtml(rootHtmlRaw);

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
                WriteModifiedFileUtf8(rootHtmlPath, rootHtml.DocumentNode.OuterHtml, ModifiedFileWriteMode, incrementNameSuffix:"urlfix");
                LogOK();
            }


            //
            // public/shared/css/motiva_sans.css
            //

            // Make the @font-face url()s in the css relative to the snapshot structure
            if (EnabledTasks[Task.RelativePathsInCssFontFaceUrls] && ResourceTypesToModify[ResourceCategory.CssFonts])
            {
                string cssMotivaSansPathRel = "public/shared/css/motiva_sans.css";
                string cssMotivaSansPathFull = QualifyPathWebFile(snapshotDirectoryPath, cssMotivaSansPathRel);
                if (File.Exists(cssMotivaSansPathFull))
                {
                    LogLine("Fixing URLs in \"" + cssMotivaSansPathRel + "\"...");
                    
                    string cssRaw = File.ReadAllText(GetPathForHighestIncrementOfFile(cssMotivaSansPathFull), Encoding.UTF8);

                    MatchCollection matchedSrcUrls = CssFontFaceUrlFinder.Matches(cssRaw);
                    foreach (Match match in matchedSrcUrls.Cast<Match>().Reverse())
                    {
                        string urlStartMagic = "url('";
                        int urlStartPos = match.Value.IndexOf(urlStartMagic) + urlStartMagic.Length;

                        string urlEndMagic = "')";
                        int urlEndPos = match.Value.LastIndexOf(urlEndMagic);

                        string urlFull = match.Value.Substring(urlStartPos, urlEndPos - urlStartPos); // https://community.cloudflare.steamstatic.com/public/shared/fonts/MotivaSans-Regular.ttf?v=4.015
                        string urlRelToRoot = GetValveResourcePath(urlFull); // public/shared/fonts/MotivaSans-Regular.ttf
                        string urlRelToCssFile = Microsoft.IO.Path.GetRelativePath(Path.GetDirectoryName(cssMotivaSansPathRel), urlRelToRoot).Replace('\\', '/');

                        LogLine("- " + urlRelToRoot);

                        cssRaw = cssRaw.Remove(match.Index, match.Value.Length)
                            .Insert(match.Index, string.Format("src: url('{0}')", urlRelToCssFile));
                    }

                    Log("Saving changes...");
                    WriteModifiedFileUtf8(cssMotivaSansPathFull, cssRaw, ModifiedFileWriteMode, incrementNameSuffix:"urlfix");
                    LogOK();
                }
            }


            //
            // JS processing
            //

            if (ResourceTypesToModify[ResourceCategory.Js])
            {
                if (EnabledTasks[Task.DeMinifyTargetJs])
                {
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


                    LogLine("\nPreparing to de-minify javascript");


                    //
                    // Configuration
                    //

                    string[] deminTargetsPaths = new string[]
                    {
                        "public/javascript/webui/friends.js", // so far this is the only file that a human needs to modify, so it's the only one needing deminification
                    };


                    //
                    // Ensure our cef js host is initialized
                    //

                    CefJsHost cefJsHost = Program.SharedCefJsHost;
                    cefJsHost.Initialize(); // will silently abort if already initialized


                    //
                    // Deminify the javascript we need to process, using pretter.io
                    //

                    foreach (string deminTargetPath in deminTargetsPaths)
                    {
                        Log("De-minifying \"" + deminTargetPath + "\"...");

                        // Validate and read in file
                        string deminTargetFullPath = QualifyPathWebFile(snapshotDirectoryPath, deminTargetPath);
                        if (!File.Exists(deminTargetFullPath))
                            throw new FileNotFoundException("De-minify target \"" + deminTargetPath + "\" does not exist in snapshot directory \"" + snapshotDirectoryPath + "\"", deminTargetFullPath);

                        string rawJs = File.ReadAllText(GetPathForHighestIncrementOfFile(deminTargetFullPath), Encoding.UTF8);

                        // Deminify the javascript
                        string deminifiedJs = null;
                        try
                        {
                            deminifiedJs = cefJsHost.ApiJsDeMinifier.DeMin(rawJs);
                        }
                        catch (CefSharpJavascriptEvalExceptionException e)
                        {
                            LogERROR();
                            LogLine("[!!!] JS threw an exception [!!!]");
                            LogLine(e.ToString());
                            continue; // Swallow exceptions and move on to the next deminify target
                        }
                        catch (CefSharpJavascriptEvalFailureException e)
                        {
                            LogERROR();
                            LogLine("[!!!] JS experienced a non-halting eval failure [!!!]");
                            LogLine(e.ToString());
                            continue;
                        }
                        catch (JsDeMinifier.PretterIoFailureException e)
                        {
                            LogERROR();
                            LogLine("[!!!] prettier.io returned null [!!!]");
                            LogLine(e.ToString());
                            continue;
                        }

                        // Write deminified js to disk
                        try
                        {
                            WriteModifiedFileUtf8(deminTargetFullPath, deminifiedJs, ModifiedFileWriteMode, incrementNameSuffix:"demin");
                        }
                        catch (Exception e)
                        {
                            LogERROR();
                            LogLine("[!!!] An unhandled exception occurred while writing the de-minified javascript back to the disk [!!!]");
                            LogLine(e.ToString());
                            continue;
                        }

                        LogOK();
                    }
                }
            }

        }

    }

}
