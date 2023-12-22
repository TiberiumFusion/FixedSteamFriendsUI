using System;
using System.Collections.Generic;
using System.IO;
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

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.CaptureSnapshot
{
    public static class Scraper
    {

        // ____________________________________________________________________________________________________
        // 
        //     Static data
        // ____________________________________________________________________________________________________
        //

        public enum ResourceCategory
        {
            Any,
            Html, // So far the only HTML document we need is the index.html at the root url (https://steam-chat.com/chat/clientui)
            Js, // All javascript files
            JsonJs, // Valve's nasty js-wrapped json localized strings files
            Css, // All stylesheets
            CssFonts, // All fonts referenced in the css
            JsAudio, // All sound effects referenced in the js
            JsImages, // All images referenced in the js
        }
        
        public static Dictionary<ResourceCategory, List<string>> ExpectedResources;
        public static string[] ValveLocaleNames;

        public static Dictionary<ResourceCategory, bool> ResourceTypesToSave;
        

        static Scraper()
        {
            // --------------------------------------------------
            //   Valve resource names
            // --------------------------------------------------

            // Symbol names given by Valve to their locales
            ValveLocaleNames = new string[]
            {
                "arabic",
                "brazilian",
                "bulgarian",
                "czech",
                "danish",
                "dutch",
                "english",
                "finnish",
                "french",
                "german",
                "greek",
                "hungarian",
                "italian",
                "japanese",
                "koreana", // sometimes "korean" instead in other places, but not on steam-chat.com
                "latam",
                "norwegian",
                "polish",
                "portuguese",
                "romanian",
                "russian",
                "sc_schinese",
                "schinese",
                "spanish",
                "swedish",
                "tchinese",
                "thai",
                "turkish",
                "ukrainian",
                "vietnamese",
            };


            // --------------------------------------------------
            //   Known resources
            // --------------------------------------------------

            // Valve may add or remove resources without any notification, so we keep a list of all expected resources and alert if any are missing or there are new ones
            ExpectedResources = new Dictionary<ResourceCategory, List<string>>();
            
            //
            // HTML
            //

            ExpectedResources[ResourceCategory.Html] = new List<string>()
            {
                "index.html",
                "favicon.ico",
            };

            //
            // JS
            //
            
            ExpectedResources[ResourceCategory.Js] = new List<string>()
            {
                "public/javascript/webui/libraries/react.production.min.js",
                "public/javascript/webui/libraries/react-dom.production.min.js",
                "public/javascript/webui/461.js",
                "public/javascript/webui/friends.js",
                "public/javascript/webui/libraries.js",
                "public/javascript/webui/libraries_cm.js",
                "public/javascript/webui/steammessages.js",
                "public/javascript/webui/noisegate-audio-worklet.js",
            };

            //
            // json.js
            //

            List<string> jsonJs = new List<string>();
            foreach (string localeName in ValveLocaleNames)
                jsonJs.Add(string.Format("public/javascript/webui/friendsui_{0}-json.js", localeName));
            foreach (string localeName in ValveLocaleNames)
                jsonJs.Add(string.Format("public/javascript/webui/shared_{0}-json.js", localeName));
            ExpectedResources[ResourceCategory.JsonJs] = jsonJs;

            //
            // CSS
            //
            
            ExpectedResources[ResourceCategory.Css] = new List<string>()
            {
                "public/css/webui/461.css",
                "public/css/webui/broadcastapp.css",
                "public/css/webui/friends.css",
                "public/shared/css/motiva_sans.css",
                "public/shared/css/shared_global.css",
            };

            //
            // @font-faces
            //

            ExpectedResources[ResourceCategory.CssFonts] = new List<string>()
            {
                "public/shared/fonts/MotivaSans-Black.ttf",
                "public/shared/fonts/MotivaSans-Bold.ttf",
                "public/shared/fonts/MotivaSans-BoldItalic.ttf",
                "public/shared/fonts/MotivaSans-Light.ttf",
                "public/shared/fonts/MotivaSans-LightItalic.ttf",
                "public/shared/fonts/MotivaSans-Medium.ttf",
                "public/shared/fonts/MotivaSans-Regular.ttf",
                "public/shared/fonts/MotivaSans-RegularItalic.ttf",
                "public/shared/fonts/MotivaSans-Thin.ttf",
            };

            //
            // JS-referenced audio
            //

            ExpectedResources[ResourceCategory.JsAudio] = new List<string>()
            {
                "public/sounds/webui/steam_at_mention.m4a",
                "public/sounds/webui/steam_chatroom_notification.m4a",
                "public/sounds/webui/steam_phonecall.m4a",
                "public/sounds/webui/steam_rpt_join.m4a",
                "public/sounds/webui/steam_rpt_leave.m4a",
                "public/sounds/webui/steam_ui_ptt_short_01_quiet.m4a",
                "public/sounds/webui/steam_ui_ptt_short_02_quiet.m4a",
                "public/sounds/webui/steam_voice_channel_enter.m4a",
                "public/sounds/webui/steam_voice_channel_exit.m4a",
                "public/sounds/webui/ui_steam_message_old_smooth.m4a",
                "public/sounds/webui/ui_steam_smoother_friend_join.m4a",
                "public/sounds/webui/ui_steam_smoother_friend_online.m4a",
            };

            //
            // JS-referenced images
            //

            ExpectedResources[ResourceCategory.JsImages] = new List<string>()
            {
                "public/images/webui/8669e97b288da32670e77181618c3dfb.png",
            };


            // --------------------------------------------------
            //   Config
            // --------------------------------------------------

            ResourceTypesToSave = new Dictionary<ResourceCategory, bool>()
            {

                //
                // Critical code files
                //

                // Mainly files modified by the patch
                [ResourceCategory.Html] = true,
                [ResourceCategory.Js] = true,
                // Valve uses a nasty module system that assigned a different instable integer ID to every module every time they build their website, which links their multiple .js files together.
                // This category includes those files, as well as the thid party js libraries Valve uses that are not statically linked, but are contemporary to the core js. Other versions of these libraries may not work.
                // The only JS file we need to modify in this category, though, is public/javascript/webui/friends.js
                [ResourceCategory.JsonJs] = true,
                // Valve's ugly -json.js localized strings files are also statically linked in the same way the all of their javascript is


                //
                // Other code which is contemporary to the critical files
                //

                // These are not strictly needed, but it's better if these files are also downloaded, so that we don't have, say, mismatched 2023-07 js using 2023-12 css, in case there are tighly-coupled changes to either
                [ResourceCategory.Css] = true,


                //
                // Assets which are contemporary to the critical files
                //

                // We probably don't need these. So long as the file names and data types do not fundamentally change, we can use the live remote versions instead.
                // But for the sake of completeness, we might as well include them in the snapshot
                [ResourceCategory.CssFonts] = true,
                [ResourceCategory.JsAudio] = true,
                [ResourceCategory.JsImages] = true,

            };

        }



        // ____________________________________________________________________________________________________
        // 
        //     Main interface
        // ____________________________________________________________________________________________________
        //

        public static void CaptureSteamchatDotComSnapshot(string outputPath)
        {

            // --------------------------------------------------
            //   Config
            // --------------------------------------------------

            string rootHtmlUrl = "https://steam-chat.com/chat/clientui/?l=english&cc=US&build=0&origin=https%3A%2F%2Fsteamloopback.host";

            string valveCdnRootUrl = null; // To be scraped from the root HTML
            


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

            if (ResourceTypesToSave[ResourceCategory.Html])
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
                    string cssRaw = (string)DownloadValveResource(url, ResourceByteFormat.StringUtf8, ResourceTypesToSave[ResourceCategory.Css] ? outputDir : null);
                    rhHeadCss.Add(cssRaw);
                }


                //
                // Download favicon
                //

                else if (node.GetAttributeValue("href", "").TrimStart('/') == "favicon.ico")
                {
                    if (ResourceTypesToSave[ResourceCategory.Html])
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

                    DownloadValveResource(url, ResourceByteFormat.ByteArray, ResourceTypesToSave[ResourceCategory.CssFonts] ? outputDir : null);
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
                        valveCdnRootUrl = node.InnerText.Substring(start, end - start + 1)
                            .Replace("\\\"", "\"") // HtmlAgilityPack escapes quotes in InnerText so we have to undo that first
                            .Replace(@"\/", "/"); // Then convert valve's \/ into /
                    }
                }
                else // referenced file
                {
                    DownloadValveResource(url, ResourceByteFormat.StringUtf8, ResourceTypesToSave[ResourceCategory.Js] ? outputDir : null);
                }
            }


            // --------------------------------------------------
            //   Download files referenced by index.html's JS
            // --------------------------------------------------

            // Some of these are easy to spot string literals with the full path
            // Some are paths built in pieces by JS and are nigh-impossible to scrape from the offline JS
            // The paths to all of these (especially the latter) are thus analyzed and assembled by a human (me) and then entered below

            //
            // Other Valve javascript files and third party library javascript
            //

            LogLine("Processing JS referenced by the root html's JS");

            if (ResourceTypesToSave[ResourceCategory.Js])
            {
                string[] jsRefs = new string[]
                {
                    "javascript/webui/461.js", // Not directly referenced anywhere, but maybe(?) used
                    "javascript/webui/noisegate-audio-worklet.js", // In friends.js nearly verbatim
                };

                foreach (string res in jsRefs)
                    DownloadValveResource(valveCdnRootUrl + res, ResourceByteFormat.StringUtf8, outputDir);
            }


            //
            // Localization strings
            //

            // There are two files we need for each locale: friendsui_ZZZ-json.js and shared_ZZZ-json.js, where ZZZ is the locale name given by Valve
            // These json.js files are referenced in a large dictionary literal in friends.js that is duplicated many times for idiocy's sake. Ctrl+F for any locale like "friendsui_english-json" and "shared_english-json" to find them.

            LogLine("Processing localized strings json.js files");

            if (ResourceTypesToSave[ResourceCategory.JsonJs])
            {
                // These are not json files. Instead, each is an obnoxious js wrapper around a json string, in part due to the nasty module framework Valve is using and in part due to Valve's decision to (mis)use said nasty framework.

                string jsonJsRootPath = "javascript/webui/"; // and this is where they live

                List<string> localizedStringResources = new List<string>();

                foreach (string locale in ValveLocaleNames)
                    localizedStringResources.Add(string.Format("friendsui_{0}-json.js", locale));

                foreach (string locale in ValveLocaleNames)
                    localizedStringResources.Add(string.Format("shared_{0}-json.js", locale));

                foreach (string res in localizedStringResources)
                    DownloadValveResource(valveCdnRootUrl + jsonJsRootPath + res, ResourceByteFormat.StringUtf8, outputDir);
            }


            //
            // CSS
            //

            LogLine("Processing CSS referenced by the root html's JS");

            if (ResourceTypesToSave[ResourceCategory.Css])
            {
                string[] jsRefs = new string[]
                {
                    "css/webui/461.css", // Not directly referenced anywhere, but maybe(?) used
                    "css/webui/broadcastapp.css", // In friends.js; Ctrl+F for ".css?contenthash="
                };

                foreach (string res in jsRefs)
                    DownloadValveResource(valveCdnRootUrl + res, ResourceByteFormat.StringUtf8, outputDir);
            }


            //
            // Images referenced by Valve JS
            //

            LogLine("Processing images referenced by the root html's JS");

            if (ResourceTypesToSave[ResourceCategory.JsImages])
            {
                string[] jsRefs = new string[]
                {
                    "images/webui/8669e97b288da32670e77181618c3dfb.png", // In friends.js nearly verbatim
                };

                foreach (string res in jsRefs)
                    DownloadValveResource(valveCdnRootUrl + res, ResourceByteFormat.ByteArray, outputDir);
            }


            //
            // Audio referenced by Valve JS
            //

            LogLine("Processing audio referenced by the root html's JS");

            if (ResourceTypesToSave[ResourceCategory.JsAudio])
            {
                string[] jsRefs = new string[]
                {
                    "sounds/webui/steam_voice_channel_enter.m4a", // All of these are in friends.js verbatim
                    "sounds/webui/steam_voice_channel_exit.m4a", // And some are duplicated several times
                    "sounds/webui/steam_chatroom_notification.m4a",
                    "sounds/webui/steam_at_mention.m4a",
                    "sounds/webui/ui_steam_smoother_friend_join.m4a",
                    "sounds/webui/ui_steam_smoother_friend_online.m4a",
                    "sounds/webui/ui_steam_message_old_smooth.m4a",
                    "sounds/webui/steam_rpt_leave.m4a",
                    "sounds/webui/steam_rpt_join.m4a",
                    "sounds/webui/steam_phonecall.m4a",
                    "sounds/webui/steam_ui_ptt_short_02_quiet.m4a",
                    "sounds/webui/steam_ui_ptt_short_01_quiet.m4a",
                };

                foreach (string res in jsRefs)
                    DownloadValveResource(valveCdnRootUrl + res, ResourceByteFormat.ByteArray, outputDir);
            }



            // --------------------------------------------------
            //   Expected files check
            // --------------------------------------------------
            
            LogLine("\nChecking downloaded resource against expected resource list");

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

                if (ResourceTypesToSave[cat])
                {
                    foreach (string resourcePath in ExpectedResources[cat])
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



        // ____________________________________________________________________________________________________
        // 
        //     Helpers
        // ____________________________________________________________________________________________________
        //

        // --------------------------------------------------
        //   Resource fetching
        // --------------------------------------------------

        private enum ResourceByteFormat
        {
            Any,
            ByteArray,
            StringUtf8,
        }

        private static object DownloadValveResource(string url, ResourceByteFormat byteFormat, DirectoryInfo outputDir)
        {
            return DownloadValveResource(url, byteFormat, outputDir != null ? outputDir.FullName : null);
        }

        private static object DownloadValveResource(string url, ResourceByteFormat byteFormat, string outputDirPath = null)
        {
            bool writeFile = !string.IsNullOrEmpty(outputDirPath);

            Log("Downloading \"" + url + "\"...");

            string remoteResPath = GetValveResourcePath(url);
            string outputResPath = null;
            if (writeFile)
            {
                outputResPath = QualifyPathWebFile(outputDirPath, remoteResPath);
                Directory.CreateDirectory(Path.GetDirectoryName(outputResPath));
            }

            object result = DownloadResource(url, byteFormat, outputResPath);

            LogOK();

            return result;
        }
        
        private static object DownloadResource(string url, ResourceByteFormat byteFormat, string outputFilePath = null)
        {
            bool writeFile = !string.IsNullOrEmpty(outputFilePath);

            byte[] resourceRaw = CurlHttp.FetchResource(url);

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

            return result;
        }
        
    }
}
