using HtmlAgilityPack;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker
{
    public static class Helpers
    {
        // ____________________________________________________________________________________________________
        // 
        //     Logging
        // ____________________________________________________________________________________________________
        //

        public static List<string> LogMessages = new List<string>();
        private static string CurrentLogMessage = "";

        public static void Log(params string[] messages)
        {
            foreach (string m in messages)
            {
                Console.Write(m);
                CurrentLogMessage += m;
            }
        }

        public static void LogLine(params string[] messages)
        {
            for (int i = 0; i < messages.Length; i++)
            {
                string m = messages[i];
                if (i == messages.Length - 1)
                {
                    Console.WriteLine(m);
                    CurrentLogMessage += m;

                    LogMessages.Add(CurrentLogMessage);
                    CurrentLogMessage = "";
                }
                else
                {
                    Console.Write(m);
                    CurrentLogMessage += m;
                }
            }
        }

        public static void LogOK(bool onlyIfOpenLine = false)
        {
            if (onlyIfOpenLine)
            {
                if (string.IsNullOrEmpty(CurrentLogMessage))
                    return;
            }

            LogLine(" OK");
        }

        public static void LogERROR(bool onlyIfOpenLine = false)
        {
            if (onlyIfOpenLine)
            {
                if (string.IsNullOrEmpty(CurrentLogMessage))
                    return;
            }

            LogLine(" ERROR");
        }

        public static void WriteLogToFile(string path)
        {
            if (!string.IsNullOrEmpty(CurrentLogMessage))
            {
                LogMessages.Add(CurrentLogMessage);
                CurrentLogMessage = "";
            }

            File.WriteAllText(path, string.Join('\n', LogMessages) + '\n');
        }


        // ____________________________________________________________________________________________________
        // 
        //     Path handling
        // ____________________________________________________________________________________________________
        //

        public static string QualifyPathWebFile(string localParentDirectoryPath, string webFilePath)
        {
            return Path.GetFullPath(Path.Combine(localParentDirectoryPath, webFilePath));
        }


        // Reduces strings like: 
        //   "https://community.cloudflare.steamstatic.com/public/javascript/webui/libraries.js?v=12tnlVitHUA6&amp;l=english&amp;_cdn=cloudflare"
        // into:
        //   "public/javascript/webui/libraries.js"
        public static string GetValveResourcePath(string url, bool withGetParams = false)
        {
            if (string.IsNullOrWhiteSpace(url))
                throw new ArgumentException("Empty string", "url");

            string tld = ".com";

            int tldPos = url.IndexOf(tld);
            if (tldPos == -1)
                throw new ArgumentException("Unrecognized URL format", "url");

            string path = url.Substring(tldPos + tld.Length + 1);

            if (withGetParams)
                return path;

            int qmarkPos = path.IndexOf('?');
            if (qmarkPos != -1)
                return path.Substring(0, qmarkPos);
            else
                return path;
        }



        // ____________________________________________________________________________________________________
        // 
        //     HtmlAgilityPack
        // ____________________________________________________________________________________________________
        //

        public static class HtmlAgilityPack
        {
            // --------------------------------------------------
            //   HTML DOM handling
            // --------------------------------------------------

            public static bool IsLinkNodeCss(HtmlNode node)
            {
                return (node.GetAttributeValue("rel", "") == "stylesheet");
            }

        }


        // ____________________________________________________________________________________________________
        // 
        //     Filling in gaps in HtmlAgilityPack
        // ____________________________________________________________________________________________________
        //

        // --------------------------------------------------
        //   CSS Handling
        // --------------------------------------------------

        public static Regex CssFontFaceUrlFinder = new Regex(@"src: *url\('\S+'\)", RegexOptions.CultureInvariant);
        // Captures the 'src' property of @font-face selectors. Example:
        //   src: url('https://community.cloudflare.steamstatic.com/public/shared/fonts/MotivaSans-Regular.ttf?v=4.015')

    }
}
