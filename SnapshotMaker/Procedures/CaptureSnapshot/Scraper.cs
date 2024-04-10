using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using CurlThin;
using CurlThin.Enums;
using CurlThin.Helpers;
using CurlThin.Native;
using CurlThin.SafeHandles;
using HtmlAgilityPack;
using static TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Helpers;
using static TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Helpers.HtmlAgilityPack;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Snapshot.Procedures.CaptureSnapshot
{
    public class Scraper
    {

        // ____________________________________________________________________________________________________
        // 
        //     Configuration
        // ____________________________________________________________________________________________________
        //

        /// <summary>
        /// Toggles for each category of resources to download
        /// </summary>
        public Dictionary<ResourceCategory, bool> ResourceTypesToDownload;

        public Scraper()
        {
            // --------------------------------------------------
            //   Default config
            // --------------------------------------------------

            ResourceTypesToDownload = new Dictionary<ResourceCategory, bool>();
            foreach (ResourceCategory category in Enum.GetValues(typeof(ResourceCategory)))
                ResourceTypesToDownload[category] = true; // Download everything
        }



        // ____________________________________________________________________________________________________
        // 
        //     Internals
        // ____________________________________________________________________________________________________
        //

        // --------------------------------------------------
        //   Resource fetching
        // --------------------------------------------------

        /// <summary>
        /// Valve resources that have already been downloaded, in the order they were downloaded.
        /// </summary>
        /// <remarks>
        /// Items use local resource paths (e.g. "public/javascript/webui/friends.js") instead of full urls (e.g. "https://community.cloudflare.steamstatic.com/public/javascript/webui/friends.js?v=SKBGYKEOnJp2&amp;l=english&amp;_cdn=cloudflare")
        /// </remarks>
        private List<string> DownloadedValveResourcesOrdered = new List<string>();

        /// <summary>
        /// Valve resources that have already been downloaded. Faster, unordered set version of <see cref="DownloadedValveResourcesOrdered"/>.
        /// </summary>
        private HashSet<string> DownloadedValveResources = new HashSet<string>();

        /// <summary>
        /// Downloads which failed for any reason.
        /// </summary>
        private List<string> FailedDownloads = new List<string>();

        /// <summary>
        /// Byte interpretation for downloaded files
        /// </summary>
        private enum ResourceByteFormat
        {
            Any,
            ByteArray,
            StringUtf8,
        }

        private object DownloadValveResource(string url, ResourceByteFormat byteFormat, DirectoryInfo outputDir, bool log = true, bool logIndent = true)
        {
            return DownloadValveResource(url, byteFormat, outputDir != null ? outputDir.FullName : null);
        }

        private object DownloadValveResource(string url, ResourceByteFormat byteFormat, string outputDirPath = null, bool log = true, bool logIndent = true)
        {
            bool writeFile = !string.IsNullOrEmpty(outputDirPath);

            string remoteResPath = GetValveResourcePath(url);
            string outputResPath = null;
            if (writeFile)
            {
                outputResPath = QualifyPathWebFile(outputDirPath, remoteResPath);
                Directory.CreateDirectory(Path.GetDirectoryName(outputResPath));
            }

            object result = DownloadResource(url, byteFormat, outputResPath);
            DownloadedValveResourcesOrdered.Add(remoteResPath);
            DownloadedValveResources.Add(remoteResPath);

            return result;
        }

        private int LastDownloadHttpCode = -1;
        private object DownloadResource(string url, ResourceByteFormat byteFormat, string outputFilePath = null, bool log = true, bool logIndent = true)
        {
            bool writeFile = !string.IsNullOrEmpty(outputFilePath);

            LastDownloadHttpCode = -1;

            if (log)
            {
                string message = "Downloading \"" + url + "\"...";
                if (logIndent) message = "- " + message;
                Log(message);
            }

            try
            {
                byte[] resourceRaw = CurlHttp.FetchResource(url);
                int httpCode = CurlHttp.GetLastFetchHttpCode();

                LastDownloadHttpCode = httpCode;

                if (httpCode < 200 || httpCode >= 300)
                {
                    LogERROR("(HTTP: " + LastDownloadHttpCode.ToString() + ")");
                    FailedDownloads.Add(url);
                    return null;
                }

                object result = null;
                if (byteFormat == ResourceByteFormat.ByteArray || byteFormat == ResourceByteFormat.Any)
                {
                    result = resourceRaw;
                    if (writeFile)
                        File.WriteAllBytes(outputFilePath, resourceRaw);
                }
                else if (byteFormat == ResourceByteFormat.StringUtf8)
                {
                    string resourceUtf8 = Encoding.UTF8.GetString(resourceRaw);
                    result = resourceUtf8;
                    if (writeFile)
                        File.WriteAllText(outputFilePath, resourceUtf8, Encoding.UTF8);
                }

                if (log)
                    LogOK("(HTTP: " + httpCode.ToString() + ")");

                return result;
            }
            catch (Exception e)
            {
                if (log)
                {
                    LogERROR("(HTTP: " + LastDownloadHttpCode.ToString() + ")");
                    LogLine("An unhandled exception occurred while downloading this resource. Details: " + e);
                    FailedDownloads.Add(url);
                }

                return null;
            }
        }



        // ____________________________________________________________________________________________________
        // 
        //     Main interface
        // ____________________________________________________________________________________________________
        //

        public void CaptureSteamchatDotComSnapshot(string outputPath)
        {

            // --------------------------------------------------
            //   Config
            // --------------------------------------------------

            string rootHtmlUrl = "https://steam-chat.com/chat/clientui/?l=english&cc=US&build=0&origin=https%3A%2F%2Fsteamloopback.host";

            

            // --------------------------------------------------
            //   Init
            // --------------------------------------------------

            // Initialize our HTTP(S) client
            Log("Initializing CurlHttp...");
            CurlHttp.Initialize();
            LogOK();



            // --------------------------------------------------
            //   Build initial output structure
            // --------------------------------------------------

            if (Directory.Exists(outputPath))
            {
                Log("Cleaning output directory structure...");
                Directory.Delete(outputPath, true);
                LogOK();
            }

            Log("Creating output directory structure...");
            DirectoryInfo outputDir = Directory.CreateDirectory(outputPath);
            LogOK();



            // --------------------------------------------------
            //   HTML entry point
            // --------------------------------------------------

            //
            // Retrieve html document
            //

            Log("Fetching root html...");

            string rootHtmlRaw = CurlHttp.FetchResourceUtf8(rootHtmlUrl);

            if (ResourceTypesToDownload[ResourceCategory.Html])
                File.WriteAllText(Path.Combine(outputDir.FullName, "index.html"), rootHtmlRaw, Encoding.UTF8);

            LogOK();
            

            //
            // Build DOM
            //

            Log("Parsing root html...");

            HtmlDocument rootHtml = new HtmlDocument();
            rootHtml.LoadHtml(rootHtmlRaw);

            // <head> contains all linked resources, including CSS and JS
            HtmlNode rhHead = rootHtml.DocumentNode.SelectSingleNode("/html/head");
            HtmlNodeCollection rhHeadLinks = rhHead.SelectNodes(".//link");
            HtmlNodeCollection rhHeadScripts = rhHead.SelectNodes(".//script");

            LogOK();

            // Example <head> excerpt: (ca 2023-12-18)
            //   <link href="https://community.cloudflare.steamstatic.com/public/shared/css/motiva_sans.css?v=GfSjbGKcNYaQ&amp;l=english&amp;_cdn=cloudflare" rel="stylesheet" type="text/css" >
            //   <link href="https://community.cloudflare.steamstatic.com/public/shared/css/shared_global.css?v=z-f6airRlPUH&amp;l=english&amp;_cdn=cloudflare" rel="stylesheet" type="text/css" >
            //   <link href="https://community.cloudflare.steamstatic.com/public/css/webui/friends.css?v=QnI6kXAaEGsI&amp;l=english&amp;_cdn=cloudflare" rel="stylesheet" type="text/css" >
            //   <script type="text/javascript">VALVE_PUBLIC_PATH = "https:\/\/community.cloudflare.steamstatic.com\/public\/";</script>	<script type="text/javascript" src="https://community.cloudflare.steamstatic.com/public/javascript/webui/libraries/react.production.min.js?v=.fbOs_8-DdSs_&amp;_cdn=cloudflare" ></script>
            //   <script type="text/javascript" src="https://community.cloudflare.steamstatic.com/public/javascript/webui/libraries/react-dom.production.min.js?v=.4T5YlODL7kmB&amp;_cdn=cloudflare" ></script>
            //   <script type="text/javascript" src="https://community.cloudflare.steamstatic.com/public/javascript/webui/libraries.js?v=12tnlVitHUA6&amp;l=english&amp;_cdn=cloudflare" ></script>
            //   <script type="text/javascript" src="https://community.cloudflare.steamstatic.com/public/javascript/webui/libraries_cm.js?v=N_MWw68bEpUV&amp;l=english&amp;_cdn=cloudflare" ></script>
            //   <script type="text/javascript" src="https://community.cloudflare.steamstatic.com/public/javascript/webui/steammessages.js?v=UZaq8Hq00otL&amp;l=english&amp;_cdn=cloudflare" ></script>
            //   <script type="text/javascript" src="https://community.cloudflare.steamstatic.com/public/javascript/webui/friends.js?v=3zaS60afl3rM&amp;l=english&amp;_cdn=cloudflare" ></script>

            // - Note how each resources comes from an obnoxious gatekeeper middleman subdomain; in this case, cloudfuck
            // - Also note how resources are served from "steamstatic.com" and not "steam-chat.com"
            //   - Generally, these urls are all interchangeable between "steamstatic.com", "steamcommunity.com", and "steam-chat.com". Each domain has its own copy of the same files.

            LogLine("- " + rhHeadLinks.Count + " <link>s");
            LogLine("- " + rhHeadScripts.Count + " <script>s");



            // --------------------------------------------------
            //   Manifest
            // --------------------------------------------------

            // We need to select a manifest to supply us with a list of expected files to check for and download
            // Our manifests are keyed by the CLSTAMP in the public/javascript/webui/friends.js file

            SnapshotManifest manifest = SnapshotManifest.KnownManifests.Last(); // Fallback: use the most recent manifest if we are unable to select one per friends.js

            bool manifestSelectionFailed = false;
            SnapshotManifest.ManifestMatchType clstampMatchType = SnapshotManifest.ManifestMatchType.Any;

            Log("Selecting snapshot manifest...");

            //
            // Get friends.js file
            //

            HtmlNode headScriptFriendsJs = rhHeadScripts.Where(a =>
            {
                string src = a.GetAttributeValue("src", "");
                return (
                    !string.IsNullOrWhiteSpace(src)
                    && src.Contains("public/javascript/webui/friends.js")
                );
            }).FirstOrDefault();

            if (headScriptFriendsJs == null)
            {
                LogERROR();
                LogLine("[!] Failed to find friends.js <script> in <head> of root html document [!]");
                manifestSelectionFailed = true;
            }
            else
            {
                //
                // Download it
                //

                string headScriptFriendsJsSrc = headScriptFriendsJs.GetAttributeValue("src", "");
                string jsRaw = (string)DownloadValveResource(headScriptFriendsJsSrc, ResourceByteFormat.StringUtf8, outputDirPath:null, log:false);

                //
                // Scrape it
                //

                // This file always seems to start the same way:
                // 1. 10 pointless newlines
                // 2. Valve's fucker eula stub comment
                // 3. 3MB of bastardized javascript on a single line

                // The very start of item no.3 always seems to be the CLSTAMP declaration, like so:
                //   var CLSTAMP="8804332";(()=>{var e,t,n,i,o,r={3119:(e,t,n)=>{var ...
                // The string "CLSTAMP" also only appears once in the entire file, at this location

                // Start of var declaration
                string clstampStartMagic = "CLSTAMP=\"";
                int clstampStart = jsRaw.IndexOf(clstampStartMagic);
                if (clstampStart == -1)
                {
                    LogERROR();
                    Log("[!] Failed to find start of CLSTAMP in friends.js [!]");
                    manifestSelectionFailed = true;
                }
                else
                {
                    // End of var declaration
                    int clStampEnd = jsRaw.IndexOf('"', clstampStart + clstampStartMagic.Length);
                    if (clStampEnd == -1)
                    {
                        LogERROR();
                        Log("[!] Failed to find end of CLSTAMP in friends.js [!]");
                        manifestSelectionFailed = true;
                    }
                    else
                    {
                        // CLSTAMP var value
                        int valueStart = clstampStart + clstampStartMagic.Length;
                        string clStamp = jsRaw.Substring(valueStart, clStampEnd - valueStart);

                        long clStampLong;
                        if (!long.TryParse(clStamp, out clStampLong))
                        {
                            LogERROR();
                            Log("[!] Failed to parse CLSTAMP value \"" + clStamp + "\" to long [!]");
                            manifestSelectionFailed = true;
                        }
                        else
                        {
                            //
                            // Select a manifest
                            //

                            // Pick the manifest which is closest to the CLSTAMP in the friends.js file
                            manifest = SnapshotManifest.GetClosestManifestForClstamp(clStampLong, out clstampMatchType);
                        }
                    }
                }
            }

            if (manifestSelectionFailed)
                LogLine("    Default fallback manifest will be used instead -> manifest for CLSTAMP " + manifest.MinCLSTAMP + " thru " + manifest.MaxCLSTAMP);
            else
            {
                LogOK();
                string matchTypeInfo = "";
                if (clstampMatchType == SnapshotManifest.ManifestMatchType.ExactKnown) matchTypeInfo = "exact range match for remote friends.js";
                else if (clstampMatchType == SnapshotManifest.ManifestMatchType.ExactTentative) matchTypeInfo = "tenative range match for remote friends.js";
                else if (clstampMatchType == SnapshotManifest.ManifestMatchType.ClosestNewer) matchTypeInfo = "closest locally known manifest (newer than remote friends.js!)";
                else if (clstampMatchType == SnapshotManifest.ManifestMatchType.NewestKnown) matchTypeInfo = "newest locally known manifest (older than remote friends.js!)";
                LogLine("Using snapshot manifest for CLSTAMP " + manifest.MinCLSTAMP + " thru " + manifest.MaxCLSTAMP + "  <- " + matchTypeInfo);
            }


            // Now that we have a manifest, we can start scraping everything starting from the root of the HTML


            // --------------------------------------------------
            //   Process HTML
            // --------------------------------------------------

            string valvePublicPathUrl = null; // To be scraped from the root HTML. Looks like this: VALVE_PUBLIC_PATH = "https:\/\/community.cloudflare.steamstatic.com\/public\/";
            string valveCdnRootUrl = null; // Above url with the trailing /public directory removed

            List<string> rhHeadCss = new List<string>();

            LogLine("Processing <link>s in root html");
            foreach (HtmlNode node in rhHeadLinks)
            {
                //
                // Download CSS files
                //

                if (IsLinkNodeCss(node))
                {
                    string url = node.GetAttributeValue("href", "");
                    string cssRaw = (string)DownloadValveResource(url, ResourceByteFormat.StringUtf8, ResourceTypesToDownload[ResourceCategory.Css] ? outputDir : null);
                    rhHeadCss.Add(cssRaw);
                }


                //
                // Download favicon
                //

                else if (node.GetAttributeValue("href", "").TrimStart('/') == "favicon.ico")
                {
                    if (ResourceTypesToDownload[ResourceCategory.Html])
                    {
                        string faviconUrl = rootHtmlUrl.Substring(0, rootHtmlUrl.IndexOf(".com") + 4) + "/favicon.ico";
                        DownloadResource(faviconUrl, ResourceByteFormat.ByteArray, Path.Combine(outputDir.FullName, "favicon.ico"));
                    }
                }
            }


            //
            // Download font files referenced in the CSS
            //

            // Example:
            //   @font-face {
            //       font-family: 'Motiva Sans';
            //       src: url('https://community.cloudflare.steamstatic.com/public/shared/fonts/MotivaSans-Regular.ttf?v=4.015') format('truetype');
            //       font-weight: normal;
            //       font-style: normal;
            //   }

            LogLine("Processing @font-faces in the root html's stylesheets");

            foreach (string cssRaw in rhHeadCss)
            {
                MatchCollection matchedSrcUrls = CssFontFaceUrlFinder.Matches(cssRaw);
                foreach (Match match in matchedSrcUrls)
                {
                    string urlStartMagic = "url('";
                    int urlStartPos = match.Value.IndexOf(urlStartMagic) + urlStartMagic.Length;

                    string urlEndMagic = "')";
                    int urlEndPos = match.Value.LastIndexOf(urlEndMagic);

                    string url = match.Value.Substring(urlStartPos, urlEndPos - urlStartPos);

                    DownloadValveResource(url, ResourceByteFormat.ByteArray, ResourceTypesToDownload[ResourceCategory.CssFonts] ? outputDir : null);
                }
            }


            //
            // Download JS files
            //

            LogLine("Processing <script>s in root html");

            foreach (HtmlNode node in rhHeadScripts)
            {
                string url = node.GetAttributeValue("src", "");
                if (string.IsNullOrWhiteSpace(url))
                {
                    // There are two inline <script>s
                    // 1. "configure our Valve callbacks.  We do this on the web so they can be safely used there as well"
                    // 2. VALVE_PUBLIC_PATH
                    
                    // #1 is meaningless to us
                    // #2 is the root url to the CDN that the HTML we got it currently using. This field is accessed by friends.js and is prefixed onto all "/public/blah/blah/whatever.ext" resources.

                    if (node.InnerText.Contains("VALVE_PUBLIC_PATH"))
                    {
                        //
                        // Scrape CDN root url
                        //

                        // Example: <script type="text/javascript">VALVE_PUBLIC_PATH = "https:\/\/community.cloudflare.steamstatic.com\/public\/";</script>
                        // Note how all / are strangely escaped

                        int start = node.InnerText.IndexOf('"') + 1;
                        int end = node.InnerText.LastIndexOf('"') - 1;

                        valvePublicPathUrl = node.InnerText.Substring(start, end - start + 1)
                            .Replace("\\\"", "\"") // HtmlAgilityPack escapes quotes in InnerText so we have to undo that first
                            .Replace(@"\/", "/"); // Then convert valve's \/ into /
                        LogLine("- VALVE_PUBLIC_PATH = " + valvePublicPathUrl);

                        valveCdnRootUrl = valvePublicPathUrl.Substring(0, valvePublicPathUrl.TrimEnd('/').LastIndexOf('/') + 1); // strip the trailing "public/" directory
                        LogLine("- Valve CDN Root URL: " + valveCdnRootUrl);
                    }
                }
                else // referenced file
                {
                    DownloadValveResource(url, ResourceByteFormat.StringUtf8, ResourceTypesToDownload[ResourceCategory.Js] ? outputDir : null);
                }
            }


            // --------------------------------------------------
            //   Download files referenced by index.html's <script>s
            // --------------------------------------------------

            // Some of these are easy to spot string literals with the full path
            // Some are paths built in pieces by JS and are nigh-impossible to easily scrape from the offline JS
            // The paths to all of these (especially the latter) are thus analyzed and assembled by a human (me) and entered into a Snapshot Manifest

            //
            // Other Valve javascript files and third party library javascript
            //

            LogLine("Fetching any remaining known JS from indirect JS references");

            if (ResourceTypesToDownload[ResourceCategory.Js])
            {
                foreach (string res in manifest.ResourcesByCategory[ResourceCategory.Js])
                {
                    if (!DownloadedValveResources.Contains(res))
                    {
                        DownloadValveResource(valveCdnRootUrl + res, ResourceByteFormat.StringUtf8, outputDir);
                    }
                }
            }


            //
            // Localization strings
            //

            // There are two files we need for each locale: friendsui_ZZZ-json.js and shared_ZZZ-json.js, where ZZZ is the locale name given by Valve
            // These json.js files are referenced in a large dictionary literal in friends.js that is duplicated many times for idiocy's sake. Ctrl+F for any locale like "friendsui_english-json" and "shared_english-json" to find them.

            LogLine("Fetching known localized strings json.js files");

            if (ResourceTypesToDownload[ResourceCategory.JsonJs])
            {
                // These are not json files. Instead, each is an obnoxious js wrapper around a json string, in part due to the nasty module framework Valve is using and in part due to Valve's decision to (mis)use said nasty framework.
                foreach (string res in manifest.ResourcesByCategory[ResourceCategory.JsonJs])
                    DownloadValveResource(valveCdnRootUrl + res, ResourceByteFormat.StringUtf8, outputDir);
            }


            //
            // CSS
            //

            LogLine("Fetching any remaining known CSS");

            if (ResourceTypesToDownload[ResourceCategory.Css])
            {
                foreach (string res in manifest.ResourcesByCategory[ResourceCategory.Css])
                {
                    if (!DownloadedValveResources.Contains(res))
                    {
                        DownloadValveResource(valveCdnRootUrl + res, ResourceByteFormat.StringUtf8, outputDir);
                    }
                }
            }


            //
            // Images referenced by Valve JS
            //

            LogLine("Fetching known images from indirect JS references");

            if (ResourceTypesToDownload[ResourceCategory.JsImages])
            {
                foreach (string res in manifest.ResourcesByCategory[ResourceCategory.JsImages])
                    DownloadValveResource(valveCdnRootUrl + res, ResourceByteFormat.ByteArray, outputDir);
            }


            //
            // Audio referenced by Valve JS
            //

            LogLine("Fetching known audio from indirect JS references");

            if (ResourceTypesToDownload[ResourceCategory.JsAudio])
            {
                foreach (string res in manifest.ResourcesByCategory[ResourceCategory.JsAudio])
                    DownloadValveResource(valveCdnRootUrl + res, ResourceByteFormat.ByteArray, outputDir);
            }



            // --------------------------------------------------
            //   Checks & reports
            // --------------------------------------------------

            //
            // Failed downloads
            //

            LogLine("\nFailed downloads: " + FailedDownloads.Count);
            if (FailedDownloads.Count > 0)
            {
                foreach (string url in FailedDownloads)
                    LogLine("- " + url);
            }


            //
            // Expected files
            //

            LogLine("\nChecking downloaded resources against expected resource list");

            List<string> missingFiles = new List<string>();
            List<string> extraFiles = new List<string>();
            
            foreach (FileInfo file in outputDir.GetFiles("*", SearchOption.AllDirectories))
            {
                string relWebPath = file.FullName.Substring(outputDir.FullName.Length).TrimStart('\\').Replace('\\', '/');
                extraFiles.Add(relWebPath);
            }

            foreach (ResourceCategory cat in Enum.GetValues(typeof(ResourceCategory)))
            {
                if (cat == ResourceCategory.Any)
                    continue;

                if (ResourceTypesToDownload[cat])
                {
                    foreach (string resourcePath in manifest.ResourcesByCategory[cat])
                    {
                        string diskPath = QualifyPathWebFile(outputDir.FullName, resourcePath);
                        if (File.Exists(diskPath))
                            extraFiles.Remove(resourcePath);
                        else
                            missingFiles.Add(resourcePath);
                    }
                }
            }

            LogLine(missingFiles.Count + " missing files");
            if (missingFiles.Count > 0)
            {
                foreach (string resourcePath in missingFiles)
                    LogLine("- " + resourcePath);
            }

            LogLine(extraFiles.Count + " extra files");
            if (extraFiles.Count > 0)
            {
                foreach (string resourcePath in extraFiles)
                    LogLine("- " + resourcePath);
            }

        }
        
    }
}
