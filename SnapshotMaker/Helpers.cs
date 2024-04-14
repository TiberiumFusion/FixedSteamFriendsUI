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
        private static string MessageInlineSeparator = " ";

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

                if (i > 0)
                    m = MessageInlineSeparator + m;

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

        public static void LogOK(string tail = "", bool onlyIfOpenLine = false)
        {
            if (onlyIfOpenLine)
            {
                if (string.IsNullOrEmpty(CurrentLogMessage))
                    return;
            }

            LogLine( " OK" + (string.IsNullOrWhiteSpace(tail) ? "" : " " + tail) );
        }

        public static void LogERROR(string tail = "", bool onlyIfOpenLine = false)
        {
            if (onlyIfOpenLine)
            {
                if (string.IsNullOrEmpty(CurrentLogMessage))
                    return;
            }

            LogLine( " ERROR" + (string.IsNullOrWhiteSpace(tail) ? "" : " " + tail) );
        }

        public static void WriteLogToFile(string path)
        {
            if (!string.IsNullOrEmpty(CurrentLogMessage))
            {
                LogMessages.Add(CurrentLogMessage);
                CurrentLogMessage = "";
            }

            File.WriteAllText(path, string.Join("\n", LogMessages) + '\n');
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
        //     File access
        // ____________________________________________________________________________________________________
        //

        // --------------------------------------------------
        //   Writing back modified files
        // --------------------------------------------------

        public enum FileWriteMode
        {
            /// <summary>
            /// Overwrite the original file with the modified data.
            /// </summary>
            Overwrite,

            /// <summary>
            /// Rename the original file with ".original" suffix, then write the modified data to the original file name.
            /// </summary>
            Backup,

            /// <summary>
            /// Leave the original file untouched. Write the modified file to a new file name, next to the original file.
            /// </summary>
            Increment,

            /// <summary>
            /// Maintain copies of all iterations of the file, using the increment suffix notation. The original file will be always overwritten with the latest increment.
            /// </summary>
            IncrementSxs,
        }

        private static Regex IncrementedFilenameIncValidator = new Regex(@"\d{3}(-|$)", RegexOptions.CultureInvariant);

        public static void WriteModifiedFileUtf8(string path, string contents, FileWriteMode writeMode, string backupNameSuffix = null, string incrementNameSuffix = null)
        {
            if (writeMode == FileWriteMode.Overwrite)
            {
                if (File.Exists(path))
                    File.Delete(path);
                File.WriteAllText(path, contents, Encoding.UTF8);
            }
            else if (writeMode == FileWriteMode.Backup)
            {
                string baseFilenameNoExt = Path.GetFileNameWithoutExtension(path);
                string ext = Path.GetExtension(path);
                
                string preserveFilePath = "";
                int inc = 0;
                do
                {
                    inc++;
                    preserveFilePath = baseFilenameNoExt + ".old" + inc.ToString("-000") + (backupNameSuffix != null ? "-"+backupNameSuffix : "") + ext;
                    if (inc > 999)
                        throw new Exception("All potential backup file names already exist!");
                }
                while (File.Exists(preserveFilePath));

                File.Move(path, preserveFilePath);

                File.WriteAllText(path, contents, Encoding.UTF8);
            }
            else if (writeMode == FileWriteMode.Increment || writeMode == FileWriteMode.IncrementSxs)
            {
                DirectoryInfo writeDir = new DirectoryInfo(Path.GetDirectoryName(path));
                HashSet<string> existingFileNamesNoSuffixes = new HashSet<string>(
                    writeDir.GetFiles("*", SearchOption.TopDirectoryOnly).Select(file =>
                    {
                        string filenameNoSuffix = file.Name;

                        string filenameNoExt = Path.GetFileNameWithoutExtension(file.Name); // e.g. "friends.001-demin.js"
                        string fileExt = Path.GetExtension(file.Name);
                        int lastDotPos = filenameNoExt.LastIndexOf('.');
                        if (lastDotPos != -1)
                        {
                            string info = filenameNoExt.Substring(lastDotPos + 1); // "001-demin.js"
                            if (IncrementedFilenameIncValidator.IsMatch(info))
                                filenameNoSuffix = filenameNoExt.Substring(0, lastDotPos + 4) + fileExt; // "friends.001.js"
                        }

                        return filenameNoSuffix;
                    })
                );

                string baseFilenameNoExt = Path.GetFileNameWithoutExtension(path);
                string ext = Path.GetExtension(path);

                string incFilenameNoExtNoSuffix = "";
                string incFilenameNoExt = "";
                int inc = 0;
                do
                {
                    inc++;
                    incFilenameNoExtNoSuffix = baseFilenameNoExt + "." + inc.ToString("000");
                    incFilenameNoExt = incFilenameNoExtNoSuffix + (incrementNameSuffix != null ? "-" + incrementNameSuffix : "");
                    if (inc > 999)
                        throw new Exception("All potential increment file names already exist!");
                }
                while (existingFileNamesNoSuffixes.Contains(incFilenameNoExtNoSuffix + ext));

                if (writeMode == FileWriteMode.IncrementSxs && inc == 1)
                {
                    string storeOrigName = baseFilenameNoExt + ".000-original" + ext;
                    string storeOrigPath = Path.Combine(writeDir.FullName, storeOrigName);
                    if (File.Exists(storeOrigPath))
                        File.Delete(storeOrigPath);
                    File.Move(path, storeOrigPath);
                }

                string incPath = Path.Combine(writeDir.FullName, incFilenameNoExt + ext);

                File.WriteAllText(incPath, contents, Encoding.UTF8);

                if (writeMode == FileWriteMode.IncrementSxs)
                    File.Copy(incPath, path, overwrite:true);
            }
        }

        // --------------------------------------------------
        //   Finding modified files
        // --------------------------------------------------

        public static string GetPathForHighestIncrementOfFile(string path)
        {
            DirectoryInfo dir = new DirectoryInfo(Path.GetDirectoryName(path));

            FileInfo inputFile = new FileInfo(path);
            string inputFileNameNoExt = Path.GetFileNameWithoutExtension(path);

            FileInfo chosenFile = inputFile;
            int chosenFileInc = -1;

            foreach (FileInfo file in dir.EnumerateFiles("*", SearchOption.TopDirectoryOnly))
            {
                if (file.FullName == inputFile.FullName)
                    continue;

                string filenameNoExt = Path.GetFileNameWithoutExtension(file.Name);

                int lastDotPos = filenameNoExt.LastIndexOf('.');
                if (lastDotPos != -1)
                {
                    string realName = filenameNoExt.Substring(0, lastDotPos);

                    if (realName != inputFileNameNoExt)
                        continue;

                    string info = filenameNoExt.Substring(lastDotPos + 1);

                    string incStr = info;
                    int infoDelim = info.IndexOf('-');
                    if (infoDelim != -1)
                        incStr = info.Substring(0, infoDelim);

                    if (int.TryParse(incStr, out int inc))
                    {
                        if (inc > chosenFileInc)
                        {
                            chosenFile = file;
                            chosenFileInc = inc;
                        }
                    }
                }
            }

            return chosenFile.FullName;
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
