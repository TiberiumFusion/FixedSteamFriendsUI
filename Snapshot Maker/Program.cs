using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.CaptureSnapshot;
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.AmendSnapshot;
using static TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Helpers;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker
{
    class Program
    {
        public const int RESULT_SUCCESS = 0;
        public const int RESULT_ERROR = 1;

        static int Main(string[] args)
        {
            LogLine("Snapshot Maker :: Started at " + DateTime.Now.ToString("G") + "\n");


            // --------------------------------------------------
            //   Configuration
            // --------------------------------------------------

            string outputPath = "snapshot";


            // --------------------------------------------------
            //   Capture snapshot
            // --------------------------------------------------

            // Downloads all necessary files to a snapshot directory
            // No changes are made to the files

            LogLine("---------- |  Capturing Snapshot  | ----------");

            try
            {
                Scraper.CaptureSteamchatDotComSnapshot(outputPath);
            }
            catch (Exception e)
            {
                LogERROR(true);
                LogLine("[!!!] An unhandled exception occurred during the capture operation [!!!]");
                LogLine(e.ToString());
                return RESULT_ERROR;
            }


            // --------------------------------------------------
            //   Amend snapshot
            // --------------------------------------------------

            // Makes various changes to the snapshot
            // - Syntax unminification of the JS files we need to modify
            // - Changes absolute Valve resource CDN urls to relative urls in relevant files (notably, <script> and <link> elements in index.html)

            LogLine("\n---------- |  Amending Snapshot  | ----------");

            try
            {
                Fixer.ModifySteamchatDotComSnapshot(outputPath);
            }
            catch (Exception e)
            {
                LogERROR(true);
                LogLine("[!!!] An unhandled exception occurred during the amend operation [!!!]");
                LogLine(e.ToString());
                return RESULT_ERROR;
            }


            // --------------------------------------------------
            //   Snapshot complete and ready for use
            // --------------------------------------------------

            Log("\nSnapshot Maker :: Finished at " + DateTime.Now.ToString("G"));

            WriteLogToFile( Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), outputPath, "Snapshot Maker Log.txt")) );


            return RESULT_SUCCESS;
        }
    }
}
