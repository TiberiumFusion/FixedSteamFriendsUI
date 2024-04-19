using System;
using System.Collections.Generic;
using System.Dynamic;
using System.IO;
using System.Linq;
using System.Text;
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.CefJsProvider;
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.CefJsProvider.Apis;
using static TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Helpers;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Procedures.PatchSnapshot
{
    public class Patcher
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
            RewriteInnerFriendsJs,
        }

        /// <summary>
        /// Toggles for each task we can perform.
        /// </summary>
        public Dictionary<Task, bool> EnabledTasks = new Dictionary<Task, bool>();

        public Patcher()
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

        public void PatchSteamchatDotComSnapshot(string snapshotDirectoryPath)
        {
            // --------------------------------------------------
            //   Patch inner friends.js
            // --------------------------------------------------

            // In other words, automate the code editing at the various patch locations that would otherwise need to be done by a human

            // There are absolutely zero modern javascript AST manipulation tools for .NET. But there are dozens in javascript itself.
            // So tragically, once again, we have to use CEF to do this
            // The interop here is very similar to the deminification process

            // For the actual rewriting-js-using-js process, I'm using the typescript.js library. The SnapshotMaker.TsJsRewriter project contains all of our rewrite code, written & compiled in typescript and using typescript.js from within typescript, which is incredibly the least convoluted way to get intellisense on typescript.js (via typescript.d.js) for the development process of the rewrite code.
            // Initially I tried babel, but babel is fucked beyond belief and 4 of the 5 necessary components are completely unusable outside of its nodejs circlejerk

            if (EnabledTasks[Task.RewriteInnerFriendsJs])
            {
                LogLine("\nPreparing to rewrite inner friends.js javascript");


                //
                // Validate and read in file
                //

                string targetJsPath = "public/javascript/webui/friends.js";

                string targetJsPathFullPath = QualifyPathWebFile(snapshotDirectoryPath, targetJsPath);
                if (!File.Exists(targetJsPathFullPath))
                    throw new FileNotFoundException("Rewrite target \"" + targetJsPath + "\" does not exist in snapshot directory \"" + snapshotDirectoryPath + "\"", targetJsPath);

                string sourceJs = File.ReadAllText(GetPathForHighestIncrementOfFile(targetJsPathFullPath), Encoding.UTF8);


                //
                // Scrape CLSTAMP
                //

                long clstamp = -1;
                bool gotClstamp = Utils.TryScrapeClstampFieldFromFriendsJsJavascript(sourceJs, out clstamp, out string clstampErrorMessage);
                if (!gotClstamp)
                    LogLine("[!] Failed to scrape CLSTAMP from friends.js [!]");


                //
                // Get patcher configuration
                //

                LogLine("Selecting patcher config");

                PatcherConfig config = Config.PatcherConfigs.OrderByDescending(a => a.TargetCLSTAMP).First(); // default fallback: newest patch config

                if (gotClstamp)
                {
                    config = Config.GetClosestPatcherConfigForClstamp(clstamp);
                    LogLine("- Using patcher config for CLSTAMP " + config.TargetCLSTAMP);
                }
                else
                    LogLine("- Lack of CLSTAMP from friends.js means default fallback patcher config will be used");


                //
                // Ensure our cef js host is initialized
                //

                CefJsHost cefJsHost = Program.SharedCefJsHost;
                cefJsHost.Initialize(); // will silently abort if already initialized


                //
                // Send the source javascript and config to our typescript-powered rewriter in the cef js host
                //

                LogLine("\nRewriting \"" + targetJsPath + "\"...");

                // Rewrite the javascript
                string rewrittenJs = null;
                try
                {
                    rewrittenJs = cefJsHost.ApiValveFriendsJsRewriter.Rewrite(sourceJs, config.TsJsRewriterConfig);
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

                string writeToDiskJs = rewrittenJs;


                //
                // Run the source javascript back through prettier.io to reformat it
                //

                Log("\nReformatting rewritten js with prettier.io...");

                string reformatedRewrittenJs = null;
                try
                {
                    reformatedRewrittenJs = cefJsHost.ApiJsDeMinifier.DeMin(rewrittenJs);
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

                if (reformatedRewrittenJs == null)
                    LogLine("Originally formatted rewritten JS will be used instead");
                else
                    writeToDiskJs = reformatedRewrittenJs;


                //
                // Write modified js to disk
                //
                
                Log("\nWriting to disk...");

                try
                {
                    WriteModifiedFileUtf8(targetJsPathFullPath, writeToDiskJs, ModifiedFileWriteMode, incrementNameSuffix: "patch");
                    LogOK();
                }
                catch (Exception e)
                {
                    LogLine("[!!!] An unhandled exception occurred while writing the rewritten javascript back to the disk [!!!]");
                    LogLine(e.ToString());
                    goto TaskEnd;
                }


                TaskEnd:;
            }

        }
    }

}
