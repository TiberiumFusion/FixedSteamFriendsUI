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
using Newtonsoft.Json;
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Procedures;
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Procedures.CaptureSnapshot;
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

        /// <summary>
        /// Optional Valve CDN selector. When non-null, this will be added to the root HTML url as the value for the _cdn GET param.
        /// </summary>
        /// <remarks>
        /// The _cdn url var was first observed (by this project) to be new on the Valve network circa 2024-11-27. It is unknown how stable it behavior is and how long Valve will honor it for.
        /// </remarks>
        public string ValveCdn;


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

            // Base URL
            string rootHtmlUrl = "https://steam-chat.com/chat/clientui/?l=english&cc=US&build=0&origin=https%3A%2F%2Fsteamloopback.host";

            // Valve CDN specifier
            if (ValveCdn != null)
                rootHtmlUrl += "&_cdn=" + ValveCdn;

            

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

            LogLine("Using root html URL: " + rootHtmlUrl);

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
            //   friends.js
            // --------------------------------------------------

            // The centerpiece of this whole affair. We need to scrape data from it and of course include it in the snapshot.

            string friendsJsContents = null;

            long friendsJsClstamp = -1;
            bool gotFriendsJsClstamp = false;


            //
            // Download it
            //

            LogLine("Retrieving friends.js");

            // Get its URL from the root html
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
                LogLine("[!] Failed to find friends.js <script> in <head> of root html document [!]");

                // friends.js is missing, but we can still the rest of the snapshot
            }
            else
            {
                // Fetch from the url
                string headScriptFriendsJsSrc = headScriptFriendsJs.GetAttributeValue("src", "");
                friendsJsContents = (string)DownloadValveResource(headScriptFriendsJsSrc, ResourceByteFormat.StringUtf8, outputDirPath: null, log: false);


                //
                // Scrape it for the CLSTAMP
                //

                Log("Scraping CLSTAMP from friends.js...");

                gotFriendsJsClstamp = Utils.TryScrapeClstampFieldFromFriendsJsJavascript(friendsJsContents, out friendsJsClstamp, out string errorMessage);
                if (gotFriendsJsClstamp)
                {
                    LogOK();
                    LogLine("- CLSTMAP = " + friendsJsClstamp);
                }
                else
                {
                    LogERROR();
                    LogLine("- " + errorMessage);
                }
            }



            // --------------------------------------------------
            //   Manifest
            // --------------------------------------------------

            // We need to select a manifest to supply us with a list of expected files to check for and download
            // Our manifests are keyed by the CLSTAMP in the public/javascript/webui/friends.js file

            SnapshotManifest manifest = Config.SnapshotManifests.OrderByDescending(a => a.MinCLSTAMP).First(); // Fallback: use the most recent manifest if we are unable to select one per friends.js


            //
            // Select a manifest
            //

            LogLine("Selecting snapshot manifest");

            if (gotFriendsJsClstamp)
            {
                // Pick the manifest which is closest to the CLSTAMP in the friends.js file
                manifest = Config.GetClosestSnapshotManifestForClstamp(friendsJsClstamp, out SnapshotManifestMatchType clstampMatchType);

                string matchTypeInfo = "";
                if (clstampMatchType == SnapshotManifestMatchType.ExactKnown) matchTypeInfo = "exact range match for remote friends.js";
                else if (clstampMatchType == SnapshotManifestMatchType.ExactTentative) matchTypeInfo = "tenative range match for remote friends.js";
                else if (clstampMatchType == SnapshotManifestMatchType.ClosestNewer) matchTypeInfo = "closest locally known manifest (newer than remote friends.js!)";
                else if (clstampMatchType == SnapshotManifestMatchType.NewestKnown) matchTypeInfo = "newest locally known manifest (older than remote friends.js!)";
                LogLine("- Using snapshot manifest for CLSTAMP "
                    + manifest.MinCLSTAMP + " thru " + manifest.MaxCLSTAMP + (manifest.UnboundedMaxCLSTAMP ? "+" : "")
                    + " (" + matchTypeInfo + ")"
                );
            }
            else
            {
                // Fallback to default manifest
                LogLine("- Lack of CLSTAMP from friends.js means default fallback manifest will be used: "
                    + manifest.MinCLSTAMP + " thru " + manifest.MaxCLSTAMP + (manifest.UnboundedMaxCLSTAMP ? "+" : "")
                );
            }

            // Now that we have a manifest, we can start scraping everything starting from the root of the HTML

            // But first, clone the manifest, so that we can modify it
            // - The "get unnamed unstable js chunks stage" needs to do this, in order for the post-scrape report on missing & extra files to be correct
            manifest = manifest.Clone();



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
            // Unstable unnamed js chunk files
            //

            // One of the js loaders in friends.js is of specific interest due to the critical nature of the files it loads
            // It's the one that concats "javascript/webui/" with various items from the dictionary with these kind of items: 2256: "shared_english-json", 7653: "broadcastapp",

            // There are two dictionaries in this area.
            // 1. The first one maps chunk IDs to more meaningful names, which happen to be the actual names of the .js files on Valve's server.
            //   - Most of these are localization -json.js files
            // 2. The second dictionary maps each chunk ID to the `contenthash` GET param that is needlessly appended to each URL
            // The number of items in the two dictionaries is NOT the same. Dictionary #2 has MORE items in it, i.e. js chunk files that do NOT have meaningful names.
            // These nameless chunks are important, however, and are loaded and used by other (unknown) parts of friends.js. As such, they must be in the snapshot.
            // Comparing the keys in both dictionaries reveals which chunk IDs lack names and thus their file name for retrieval is their chunk id from Valve remote (i.e. "3159.js" instead of "broadcastapp.js")

            // The chunks with names are easier to deal with, since their names are semi-constant and thus can be manually entered into a SnapshotManifest and used successfully with future releases of steam-chat.com
            // The unnamed chunks are a problem. Their chunk IDs are unstable and needlessly change every single time Valve builds their website.

            // Previously, all manual labor was required to compare the dictionaries and update the changed chunk IDs for each unnamed chunk in each new SnapshotManifest required by each new steam-chat.com release
            // This step now automates part of the process, by discerning the unnamed chunks and fetching them automatically. Manual review is still required to reveal the contents and function of each unnamed chunk.

            if (ResourceTypesToDownload[ResourceCategory.Js])
            {
                LogLine("Finding unnamed unstable js chunk IDs");

                List<int> unnamedUnstableChunkIds = null;
                try
                {
                    unnamedUnstableChunkIds = Routines.FindUnnamedJsChunkIds(friendsJsContents, unstableOnly: true); // Quick and dirty with no guards
                }
                catch (Exception e)
                {
                    LogLine("[!] Unexpected failure while parsing js for chunk IDs [!]");
                    LogLine(e.ToString());
                    // Continue anyways; manual review will be needed to check if this is a problem and then collect these js files if they are needed
                }

                if (unnamedUnstableChunkIds != null && unnamedUnstableChunkIds.Count > 0)
                {
                    foreach (int chunkID in unnamedUnstableChunkIds)
                        LogLine("- Chunk ID: " + chunkID);

                    LogLine("Fetching js chunks:");

                    List<string> manifestJsFiles = manifest.ResourcesByCategory[ResourceCategory.Js];

                    foreach (int chunkID in unnamedUnstableChunkIds)
                    {
                        string webpath = string.Format("public/javascript/webui/{0}.js", chunkID);

                        // Add to snapshot manifest
                        if (!manifestJsFiles.Contains(webpath))
                            manifestJsFiles.Add(webpath);

                        // Download it
                        DownloadValveResource(valveCdnRootUrl + webpath, ResourceByteFormat.StringUtf8, outputDir);
                    }
                }
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



            // --------------------------------------------------
            //   Save manifest
            // --------------------------------------------------

            // Dynamic changes to the manifest (e.g. unstable valve js files) need to be recorded, so that the Cleaner stage works properly
            // We will write the final manifest we used during this scrape (with any edits it may have from its stock form) to the snapshot directory, for the Cleaner to use later

            Log("\nWriting working manifest to snapshot...");

            // Write deminified js to disk
            try
            {
                string manifestJson = JsonConvert.SerializeObject(manifest, Formatting.Indented);
                File.WriteAllText(Path.Combine(outputDir.FullName, "WorkingSnapshotManifest.json"), manifestJson, Encoding.UTF8);
                LogOK();
            }
            catch (Exception e)
            {
                LogERROR();
                LogLine("[!!!] An unhandled exception occurred while writing the working snapshot manifest to a file [!!!]");
                LogLine(e.ToString());
                // Non-fatal. The snapshot is still functional, but running it through the Cleaner stage may result in necessary files getting removed (if the stock SnapshotManifests/*.json files don't explicitly list any dynamic files that were added to the manifest during the scrap).
            }


        }

    }
}
