﻿using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Snapshot;
using static TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Helpers;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Procedures.CleanSnapshot
{
    public class Cleaner
    {
        public void CleanSteamChatDotComSnapshot(string snapshotDirectoryPath)
        {
            // --------------------------------------------------
            //   Remove all files not declared in the manifest
            // --------------------------------------------------

            // Removes files like .001 increments and .original backups


            //
            // Get CLSTAMP from friends.js
            //

            Log("Getting CLSTAMP from friends.js...");

            long clstamp = -1;
            bool gotClstamp = false;

            // Validate and read in friends.js file
            string targetJsPath = "public/javascript/webui/friends.js";

            string targetJsPathFullPath = QualifyPathWebFile(snapshotDirectoryPath, targetJsPath);
            if (!File.Exists(targetJsPathFullPath))
            {
                LogERROR();
                LogLine("[!!!] File 'public/javascript/webui/friends.js' does not exist [!!!]");
            }
            else
            {
                string sourceJs = File.ReadAllText(GetPathForHighestIncrementOfFile(targetJsPathFullPath), Encoding.UTF8);

                // Scrape CLSTAMP
                clstamp = -1;
                gotClstamp = Utils.TryScrapeClstampFieldFromFriendsJsJavascript(sourceJs, out clstamp, out string clstampErrorMessage);
                if (gotClstamp)
                {
                    LogOK();
                    LogLine("- CLSTMAP = " + clstamp);
                }
                else
                {
                    LogERROR();
                    LogLine("[!] Failed to scrape CLSTAMP from friends.js [!]");
                    LogLine("  - " + clstampErrorMessage);
                }
            }


            //
            // Select a manifest
            //

            SnapshotManifest manifest = null;

            // If the snapshot includes a working manifest, try to load and use that first
            string snapshotWorkingManifestRelPath = "WorkingSnapshotManifest.json";
            string snapshotWorkingManifestFullPath = Path.Combine(snapshotDirectoryPath, snapshotWorkingManifestRelPath);
            if (File.Exists(snapshotWorkingManifestFullPath))
            {
                LogLine("Found working snapshot manifest: " + snapshotWorkingManifestRelPath);
                Log("Loading manifest file...");

                // Note that currently there is NO VALIDATION of these manifests!
                try
                {
                    manifest = Config.LoadJsonConfigFile<SnapshotManifest>(snapshotWorkingManifestFullPath);
                    LogOK();
                }
                catch (Exception e)
                {
                    LogERROR();
                    LogLine("[!!!] An unhandled exception occurred while loading the manifest file [!!!]");
                    LogLine(e.ToString());
                }

                if (manifest == null)
                    LogLine("Falling back to selecting a stock manifest");
            }

            // Otherwise use a stock manifest if the working manifest is missing or failed to parse
            if (manifest == null)
            {
                manifest = Config.SnapshotManifests.OrderByDescending(a => a.MinCLSTAMP).First(); // Fallback: use the most recent manifest if we are unable to select one per friends.js

                if (gotClstamp)
                {
                    // Pick the manifest which is closest to the CLSTAMP
                    manifest = Config.GetClosestSnapshotManifestForClstamp(clstamp, out SnapshotManifestMatchType clstampMatchType);

                    string matchTypeInfo = "";
                    if (clstampMatchType == SnapshotManifestMatchType.ExactKnown) matchTypeInfo = "exact range match for remote friends.js";
                    else if (clstampMatchType == SnapshotManifestMatchType.ExactTentative) matchTypeInfo = "tenative range match for remote friends.js";
                    else if (clstampMatchType == SnapshotManifestMatchType.ClosestNewer) matchTypeInfo = "closest locally known manifest (newer than remote friends.js!)";
                    else if (clstampMatchType == SnapshotManifestMatchType.NewestKnown) matchTypeInfo = "newest locally known manifest (older than remote friends.js!)";
                    LogLine("Using snapshot manifest for CLSTAMP "
                        + manifest.MinCLSTAMP + " thru " + manifest.MaxCLSTAMP + (manifest.UnboundedMaxCLSTAMP ? "+" : "")
                        + " (" + matchTypeInfo + ")"
                    );
                }
                else
                {
                    // Fallback to default manifest
                    LogLine("Lack of CLSTAMP from friends.js means default fallback manifest will be used: "
                        + manifest.MinCLSTAMP + " thru " + manifest.MaxCLSTAMP + (manifest.UnboundedMaxCLSTAMP ? "+" : "")
                    );
                }
            }


            //
            // Keep extra files
            //

            // In addition to everything declared in the snapshot manifest, also keep some other important files
            List<string> keepExtraFiles = new List<string>()
            {
                // These are all paths relative to the root snapshot directory
                "WorkingSnapshotManifest.json",
            };


            //
            // Purge superfluous files
            //

            // Delete all files from the snapshot which are not declared in the manifest
            // Snapshot Maker log files are exempt

            LogLine("\nDeleting undeclared files");

            DirectoryInfo snapshotDir = new DirectoryInfo(snapshotDirectoryPath);
            foreach (FileInfo file in snapshotDir.GetFiles("*", SearchOption.AllDirectories))
            {
                // Keep snapshot maker log files
                if (file.Name.StartsWith("Snapshot Maker Log") && file.Extension == ".txt")
                    continue;

                string relWebPath = file.FullName.Substring(snapshotDir.FullName.Length).TrimStart('\\').Replace('\\', '/');
                if (!manifest.DeclaresFile(relWebPath) && !keepExtraFiles.Contains(relWebPath))
                {
                    Log("- Deleting '" + relWebPath + "'...");

                    try
                    {
                        file.Delete();
                        LogOK();
                    }
                    catch (Exception e)
                    {
                        LogERROR();
                        LogLine("[!!!] An unhandled exception occurred. [!!!]");
                        LogLine(e.ToString());
                    }
                }
            }

        }
    }
}
