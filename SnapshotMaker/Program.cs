using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Procedures.PatchSnapshot;
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Snapshot;
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Snapshot.Procedures.AmendSnapshot;
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Snapshot.Procedures.CaptureSnapshot;
using static TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Helpers;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker
{
    class Program
    {
#if DEBUG
        internal static readonly bool CatchUnhandledExceptions = false;
#else
        internal static readonly bool CatchUnhandledExceptions = true;
        #endif

        public const int RESULT_SUCCESS = 0;
        public const int RESULT_ERROR = 1;


        static int Main(string[] args)
        {
            CmdArgs cmdArgs = new CmdArgs(args);


            DateTime startTime = DateTime.Now;

            string logFileName = string.Format( "Snapshot Maker Log - {0} (stages={1}).txt", startTime.ToString("yyyy-MM-dd HH꞉mm꞉ss.fff"), cmdArgs.Stages.ToUpper() );

            LogLine("Snapshot Maker (v" + Assembly.GetExecutingAssembly().GetName().Version + ") :: Started at " + startTime.ToString("G"));
            LogLine("Args: " + (args.Length > 0 ? string.Join(" ", args) : "(none)"));

            LogLine("");


            // --------------------------------------------------
            //   Configuration
            // --------------------------------------------------

            // Stages to perform
            bool StageScrape = cmdArgs.Stages.Contains("s");
            bool StageAmend = cmdArgs.Stages.Contains("a");
            bool StagePatch = cmdArgs.Stages.Contains("p");

            // Local output folder for the snapshot
            string outputPath = "snapshot";

            // Toggles for each type of resource to save locally & process
            var ResourceTypesToProcess = new Dictionary<ResourceCategory, bool>()
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


            // --------------------------------------------------
            //   Capture snapshot
            // --------------------------------------------------

            if (StageScrape)
            {
                // Downloads all necessary files to a snapshot directory
                // No changes are made to the files

                LogLine("---------- |  Capturing Snapshot  | ----------");

                try
                {
                    Scraper scraper = new Scraper();
                    scraper.ResourceTypesToDownload = ResourceTypesToProcess;
                    scraper.CaptureSteamchatDotComSnapshot(outputPath);
                }
                catch (Exception e) when (CatchUnhandledExceptions)
                {
                    LogERROR(onlyIfOpenLine:true);
                    LogLine("[!!!] An unhandled exception occurred during the capture operation [!!!]");
                    LogLine(e.ToString());
                    return RESULT_ERROR;
                }
            }


            // --------------------------------------------------
            //   Amend snapshot
            // --------------------------------------------------

            if (StageAmend)
            {
                // Makes various changes to the snapshot
                // - Syntax unminification of the JS files we need to modify
                // - Changes absolute Valve resource CDN urls to relative urls in relevant files (notably, <script> and <link> elements in index.html)

                LogLine("\n---------- |  Amending Snapshot  | ----------");

                try
                {
                    Fixer fixer = new Fixer();
                    fixer.ResourceTypesToModify = ResourceTypesToProcess;
                    fixer.PreserveOriginalCopyOfModifiedFiles = true;
                    fixer.SetEnableAllTasks(false);
                    fixer.EnabledTasks[Fixer.Task.DeMinifyTargetJs] = true;
                    fixer.ModifySteamchatDotComSnapshot(outputPath);
                }
                catch (Exception e) when (CatchUnhandledExceptions)
                {
                    LogERROR(onlyIfOpenLine:true);
                    LogLine("[!!!] An unhandled exception occurred during the amend operation [!!!]");
                    LogLine(e.ToString());
                    return RESULT_ERROR;
                }
            }


            // --------------------------------------------------
            //   Patch snapshot
            // --------------------------------------------------

            if (StagePatch)
            {
                // Automated patching of some spots that are tedious to do manually and can be automated without significant effort
                // Notable examples include the many CDN asset fetches in friends.js and easy shim sites like tournament mode

                LogLine("\n---------- |  Patching Snapshot  | ----------");

                try
                {
                    Patcher patcher = new Patcher();
                }
                catch (Exception e) when (CatchUnhandledExceptions)
                {
                    LogERROR(onlyIfOpenLine: true);
                    LogLine("[!!!] An unhandled exception occurred during the patch operation [!!!]");
                    LogLine(e.ToString());
                    return RESULT_ERROR;
                }
            }


            // --------------------------------------------------
            //   Snapshot complete and ready for use
            // --------------------------------------------------

            Log("\nSnapshot Maker :: Finished at " + DateTime.Now.ToString("G"));

            if (cmdArgs.WriteLogFileToSnapshot)
                WriteLogToFile(Path.Combine(outputPath, logFileName));


            return RESULT_SUCCESS;
        }
    }
}
