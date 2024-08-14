using System;
using System.Collections.Generic;
using System.Dynamic;
using System.IO;
using System.Linq;
using System.Text;
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.CefJsProvider;
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.CefJsProvider.Apis;
using static TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Helpers;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Procedures.ConformSnapshot
{
    public class Conformer
    {

        // ____________________________________________________________________________________________________
        // 
        //     Configuration
        // ____________________________________________________________________________________________________
        //

        /// <summary>
        /// If false, modified versions of files will overwrite the originals. If true, modified Move the original version of modified file to a new file name, then write the modified version at the original file name.
        /// </summary>
        public FileWriteMode ModifiedFileWriteMode = FileWriteMode.IncrementSxs;

        public enum Task
        {
            None,
            TranspileInnerFriendsJs,
        }

        /// <summary>
        /// Toggles for each task we can perform.
        /// </summary>
        public Dictionary<Task, bool> EnabledTasks = new Dictionary<Task, bool>();

        public Conformer()
        {
            // --------------------------------------------------
            //   Default config
            // --------------------------------------------------

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

        public void ConformSteamchatDotComSnapshot(string snapshotDirectoryPath)
        {
            // --------------------------------------------------
            //   Transpile inner friends.js
            // --------------------------------------------------

            // Some time between CLSTAMP 8997688 (circa 2024-06-25) and 9004798 (circa 2024-07-02), Valve changed the ecmascript target used by their website build process
            // It is unknown what the target was before and after this event
            // However, 8997688 is compatible with the M86 CEF present in the final Steam clients to include FriendsUI, while 9004798 is NOT compatible with M86
            // I do not have an exhaustive list of incompatibilities, since, in the infinite retardation of web 'developers', there exists no such basic tool which analyzes a given chunk of javascript and determines the minimum blink/gecko/whatever client capable of executing said javascript. Expensive snakeoil antidotes like browserstack are obviously out of the question.
            // But the new target is at least M94, due to the new presence of 'static' initializer syntax. M109 is more likely, however, since that is the version of CEF included in Steam client releases since early 2024.

            // It also unclear how many files require transpilation. As of 9097133, it seems that only the inner friends.js requires this - again, discerned though only spot-checking and partial empirical testing.

            // Babel is used here to transpile. The babel output has gross formatting that also deviates from our staging standard established by prettier.io, so we will run the babel output back through prettier.io.

            if (EnabledTasks[Task.TranspileInnerFriendsJs])
            {
                LogLine("Preparing to transpile javascript files");


                //
                // Select a transpiler configuration
                //

                LogLine("Selecting transpiler config");

                // Scrape CLSTAMP from friends.js
                long clstamp = -1;
                bool gotClstamp = false;

                string innerFriendsJsPath = "public/javascript/webui/friends.js";

                string innerFriendsJsFullPath = QualifyPathWebFile(snapshotDirectoryPath, innerFriendsJsPath);
                if (!File.Exists(innerFriendsJsFullPath))
                {
                    LogLine("- Inner friends.js file \"" + innerFriendsJsFullPath + "\" does not exist in snapshot directory \"" + snapshotDirectoryPath + "\". Without its CLSTAMP, we cannot select an appropriate transpiler config. The most recent config will be used instead.");
                }
                else
                {
                    string sourceJs = File.ReadAllText(GetPathForHighestIncrementOfFile(innerFriendsJsFullPath), Encoding.UTF8);

                    gotClstamp = Utils.TryScrapeClstampFieldFromFriendsJsJavascript(sourceJs, out clstamp, out string clstampErrorMessage);
                    if (gotClstamp)
                        LogLine("- CLSTMAP = " + clstamp);
                    else
                    {
                        LogLine("[!] Failed to scrape CLSTAMP from friends.js [!]");
                        LogLine("  - " + clstampErrorMessage);
                    }
                }

                // Determine config to use per CLSTAMP
                TranspilerConfig transpilerConfig = Config.TranspilerConfigs.OrderByDescending(a => a.MinCLSTAMP).First(); // Fallback: use the most recent config if we are unable to select one per friends.js

                if (gotClstamp)
                {
                    // Pick the manifest which is closest to the CLSTAMP
                    transpilerConfig = Config.GetClosestTranspilerConfigForClstamp(clstamp, out TranspilerConfigMatchType clstampMatchType);

                    string matchTypeInfo = "";
                    if (clstampMatchType == TranspilerConfigMatchType.ExactKnown) matchTypeInfo = "exact range match for remote friends.js";
                    else if (clstampMatchType == TranspilerConfigMatchType.ExactTentative) matchTypeInfo = "tenative range match for remote friends.js";
                    else if (clstampMatchType == TranspilerConfigMatchType.ClosestNewer) matchTypeInfo = "closest locally known config (newer than remote friends.js!)";
                    else if (clstampMatchType == TranspilerConfigMatchType.NewestKnown) matchTypeInfo = "newest locally known config (older than remote friends.js!)";
                    LogLine("Using config for CLSTAMP "
                        + transpilerConfig.MinCLSTAMP + " thru " + transpilerConfig.MaxCLSTAMP + (transpilerConfig.UnboundedMaxCLSTAMP ? "+" : "")
                        + " (" + matchTypeInfo + ")"
                    );
                }
                else
                {
                    // Fallback to default manifest
                    LogLine("Lack of CLSTAMP from friends.js means default fallback config will be used: "
                        + transpilerConfig.MinCLSTAMP + " thru " + transpilerConfig.MaxCLSTAMP + (transpilerConfig.UnboundedMaxCLSTAMP ? "+" : "")
                    );
                }


                //
                // Verify configuration
                //

                if (transpilerConfig.Targets.Count == 0)
                {
                    LogLine("Config does not specify any transpile targets. Skipping transpile task.");
                    goto TaskEnd;
                }

                LogLine("Transpile targets:");
                foreach (string targetJsPath in transpilerConfig.Targets)
                    LogLine("- " + targetJsPath);

                LogLine("");


                //
                // Ensure our cef js host is initialized
                //

                CefJsHost cefJsHost = Program.SharedCefJsHost;
                bool alreadyInitialized = cefJsHost.Initialize(); // will silently abort if already initialized

                if (alreadyInitialized) // avoid double newlines in log
                    LogLine("");


                // Process each file in turn
                bool firstTarget = true;
                foreach (string targetJsPath in transpilerConfig.Targets)
                {
                    if (!firstTarget)
                        LogLine("");

                    //
                    // Validate and read in file
                    //

                    string targetJsPathFullPath = QualifyPathWebFile(snapshotDirectoryPath, targetJsPath);
                    if (!File.Exists(targetJsPathFullPath))
                        throw new FileNotFoundException("Transpile target \"" + targetJsPath + "\" does not exist in snapshot directory \"" + snapshotDirectoryPath + "\"", targetJsPath);

                    string sourceJs = File.ReadAllText(GetPathForHighestIncrementOfFile(targetJsPathFullPath), Encoding.UTF8);


                    //
                    // Send the source javascript and config to the babel transpiler in the cef js host
                    //

                    Log("Transpiling \"" + targetJsPath + "\"...");

                    // Transpile the javascript
                    string transpiledJs = null;
                    try
                    {
                        transpiledJs = cefJsHost.ApiJsTranspiler.Transpile(sourceJs, transpilerConfig.BabelConfig);
                        LogOK();
                    }
                    catch (CefSharpJavascriptEvalExceptionException e)
                    {
                        LogLine("...FAILED");
                        LogLine("[!!!] JS threw an exception [!!!]");
                        LogLine(e.ToString());
                        goto TaskEnd; // Swallow exceptions and skip to the next task
                    }
                    catch (CefSharpJavascriptEvalFailureException e)
                    {
                        LogLine("...FAILED");
                        LogLine("[!!!] JS experienced a non-halting eval failure [!!!]");
                        LogLine(e.ToString());
                        goto TaskEnd;
                    }

                    string writeToDiskJs = transpiledJs;


                    //
                    // Run the source javascript back through prettier.io to reformat it
                    //

                    Log("Reformatting transpiled js with prettier.io...");

                    string reformatedTranspiledJs = null;
                    try
                    {
                        reformatedTranspiledJs = cefJsHost.ApiJsDeMinifier.DeMin(transpiledJs);
                        LogOK();
                    }
                    catch (CefSharpJavascriptEvalExceptionException e)
                    {
                        LogERROR();
                        LogLine("[!!!] JS threw an exception [!!!]");
                        LogLine(e.ToString());
                    }
                    catch (CefSharpJavascriptEvalFailureException e)
                    {
                        LogERROR();
                        LogLine("[!!!] JS experienced a non-halting eval failure [!!!]");
                        LogLine(e.ToString());
                    }
                    catch (JsDeMinifier.PretterIoFailureException e)
                    {
                        LogERROR();
                        LogLine("[!!!] prettier.io returned null [!!!]");
                        LogLine(e.ToString());
                    }

                    if (reformatedTranspiledJs == null)
                        LogLine("Originally formatted transpiled JS will be used instead");
                    else
                        writeToDiskJs = reformatedTranspiledJs;


                    //
                    // Write modified js to disk
                    //

                    Log("Writing to disk...");

                    try
                    {
                        WriteModifiedFileUtf8(targetJsPathFullPath, writeToDiskJs, ModifiedFileWriteMode, incrementNameSuffix: "transpile");
                        LogOK();
                    }
                    catch (Exception e)
                    {
                        LogLine("[!!!] An unhandled exception occurred while writing the transpiled javascript back to the disk [!!!]");
                        LogLine(e.ToString());
                        goto TaskEnd;
                    }


                    firstTarget = false;
                }


                TaskEnd:;
            }

        }
    }

}
