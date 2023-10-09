using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.Infra;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher
{
    public static class PatchInstaller
    {

        public delegate void LogItemDelegate(string message);


        // ____________________________________________________________________________________________________
        // 
        //     Install
        // ____________________________________________________________________________________________________
        //

        public delegate void NotifyInstallProgress(int current, int total);

        public const int Result_Success = 0;
        public const int Result_Error = 1;
        public const int Result_SteamRunning = 2;

        public static int InstallPatch(string steamRootDirPath, LogItemDelegate postLogItem = null, NotifyInstallProgress postNotifyProgress = null)
        {
            void log(string message)
            {
                postLogItem?.Invoke(message);
            }

            int pCur = 0;
            const int pTotal = 100;
            void progress(int current)
            {
                pCur = current;
                postNotifyProgress?.Invoke(current, pTotal);
            }


            progress(0);


            //
            // Preparation
            //

            log("Determining steam state...");
            SteamState steamState = new SteamState(steamRootDirPath, autoRefresh: false);

            if (steamState.IsSteamRunning)
            {
                log("[!!!] Steam is currently running [!!!]");
                log("Patch cannot be installed while Steam is running. Close Steam first.");
                return Result_SteamRunning;
            }

            if (!steamState.ClientUiDirExists)
            {
                log("[!!!] Missing clientui directory [!!!]");
                log("Path \"" + steamState.ClientUiDirPath + "\" does not exist");
                return Result_Error;
            }

            progress(10);


            //
            // Test for restricted permissions on the things we need to do
            //

            log("Testing write permissions...");

            // Creating files and folders in Steam\clientui
            if (!Helpers.TryCreateTestFsObject(steamState.ClientUiDirPath, false, out Exception errorFile))
            {
                log("[!!!] Failed to create test file in clientui [!!!]");
                log("Write access may be denied to path \"" + steamState.ClientUiDirPath + "\"");
                log("Exception details: " + errorFile.ToString());
                return Result_Error;
            }
            progress(15);

            if (!Helpers.TryCreateTestFsObject(steamState.ClientUiDirPath, true, out Exception errorDir))
            {
                log("[!!!] Failed to create test folder in clientui [!!!]");
                log("Write access may be denied to path \"" + steamState.ClientUiDirPath + "\"");
                log("Exception details: " + errorDir.ToString());
                return Result_Error;
            }
            progress(20);


            //
            // Create a scratch folder to extract the patch files to
            //

            //string scratchDirPath = Path.Combine(Path.GetTempPath(), "T-ScratchDir-" + Guid.NewGuid().ToString());
            // File names are too long to use AppData\Local\Temp reliably
            // So we'll make the scratch dir in clientui instead
            string scratchDirPath = Path.Combine(steamState.ClientUiDirPath, "__patchtemp");

            int scratchDirRetryCount = 0;

            ClearScratchDir:
            if (scratchDirRetryCount > 10)
            {
                log("[!!!] Failed to create scratch directory [!!!]");
                log("Incredibly, all randomly generated scratch dir names already point to existing folders and none of them could be cleared.");
                return Result_Error;
            }

            if (Directory.Exists(scratchDirPath))
            {
                log("Scratch directory already exists: " + scratchDirPath);
                try
                {
                    log("Clearing scratch directory...");
                    Directory.Delete(scratchDirPath, true);
                    // This can fail for way too many reasons... No.1 likely is that the user is browsing the files in explorer, which won't easily give up its handles and thus prevents the files from being deleted
                }
                catch (Exception e)
                {
                    log("[!!!] Failed to delete existing scratch directory [!!!]");
                    log("Exception details: " + e.ToString());

                    scratchDirPath = Path.Combine(steamState.ClientUiDirPath, "__patchtemp" + Guid.NewGuid().ToString().Substring(0, 8));
                    log("Using alternate scratch dir: " + scratchDirPath);
                    log("Retrying...");
                    goto ClearScratchDir;
                }
            }

            // Create it
            try
            {
                Directory.CreateDirectory(scratchDirPath);
            }
            catch (Exception e)
            {
                log("[!!!] Failed to create temporary scratch space directory [!!!]");
                log("Path: " + scratchDirPath);
                log("Exception details: " + e.ToString());
                return Result_Error;
            }


            //
            // Decompress patch payload
            //

            log("Extracting patch files...");
            log("Destination: " + scratchDirPath);

            try
            {
                using (Stream payloadZip = BinaryResources.GetPatchPayload())
                {
                    using (ZipArchive ar = new ZipArchive(payloadZip))
                    {
                        int initialProgress = pCur;
                        double progressSegment = 60.0; // from 20 to 80

                        int extractedFiles = 0;
                        int totalFiles = ar.Entries.Where(e => e.Length > 0).Count();

                        void onZipExtractFile(string entryPath, string destPath)
                        {
                            progress(initialProgress + (int)(((double)++extractedFiles / (double)totalFiles) * progressSegment));
                            log(string.Format("- Extract {0}/{1}: {2}", extractedFiles, totalFiles, entryPath));
                        }

                        ar.ExtractToDirectoryEx(scratchDirPath, onZipExtractFile);
                    }
                }
            }
            catch (Exception e)
            {
                log("[!!!] Failed to extract patch files [!!!]");
                log("Destination path: " + scratchDirPath);
                log("Exception details: " + e.ToString());
                return Result_Error;
            }

            progress(80);


            //
            // Read patch metadata
            //

            log("Scanning patch files...");

            string patchFriendsJsPath = Path.Combine(scratchDirPath, "clientui", "friends.js");
            string patchFriendsJsContents = null;
            try
            {
                patchFriendsJsContents = File.ReadAllText(patchFriendsJsPath, Encoding.UTF8);
            }
            catch (Exception e)
            {
                log("[!!!] Failed to read patch file: friends.js [!!!]");
                log("Path: " + patchFriendsJsPath);
                log("Exception details: " + e.ToString());
                return Result_Error;
            }
            progress(85);

            PatchMetadata pm;
            if (!PatchMetadata.TryScrapeFromString(patchFriendsJsContents, out pm, out Exception pmError))
            {
                log("[!!!] Failed to read metadata from friends.js [!!!]");
                log("Path: " + patchFriendsJsPath);
                log("Exception details: " + pmError.ToString());
                return Result_Error;
            }
            progress(90);


            //
            // Delete old patch payload folder
            //

            PatchMetadata oldPm = steamState.InstalledPatchMetadata;
            if (oldPm != null)
            {
                string oldPayloadDirPath = Path.Combine(steamState.ClientUiDirPath, oldPm.Level0.PayloadName);

                if (Directory.Exists(oldPayloadDirPath))
                {
                    log("Deleting old payload folder...");

                    try
                    {
                        Directory.Delete(oldPayloadDirPath, true);
                    }
                    catch (Exception e)
                    {
                        log("Failed to delete old payload folder from the previously installed version of the patch.");
                        log("Path: " + oldPayloadDirPath);
                        log("Exception details: " + e.ToString());
                        log("You can safely ignore this error, or you can manually delete the old payload folder yourself. The old payload folder has been made inactive and is no longer in use.");
                    }
                }
            }

            progress(92);


            //
            // Move payload directory to final location
            //

            log("Preparing to install payload folder...");

            string payloadDirPath = Path.Combine(scratchDirPath, "clientui", pm.Level0.PayloadName);

            if (!Directory.Exists(payloadDirPath))
            {
                log("[!!!] Payload folder missing [!!!]");
                log("Path: " + payloadDirPath);
                log("Directory does not exist. Patch payload files may be corrupt, or another application may have deleted the extracted payload files! (e.g. \"anti\"-\"virus\" and other hostile programs)");
                return Result_Error;
            }

            string destPayloadDirPath = Path.Combine(steamState.ClientUiDirPath, pm.Level0.PayloadName);

            // Clear if already existing
            if (Directory.Exists(destPayloadDirPath))
            {
                log("Destination for payload folder already exists: " + destPayloadDirPath);
                log("Removing existing payload folder first...");

                try
                {
                    Directory.Delete(destPayloadDirPath, true);
                }
                catch (Exception e)
                {
                    log("[!!!] Failed to delete existing payload folder [!!!]");
                    log("Exception details: " + e.ToString());
                    return Result_Error;
                }
            }

            // Move payload folder
            log("Installing payload folder...");
            try
            {
                Directory.Move(payloadDirPath, destPayloadDirPath);
            }
            catch (Exception e)
            {
                log("[!!!] Failed to move payload folder to final path [!!!]");
                log("Destination path: " + destPayloadDirPath);
                log("Exception details: " + e.ToString());
                return Result_Error;
            }

            progress(95);
            

            //
            // Move entry point file (friends.js) to final location
            //

            log("Preparing to install modified friends.js...");

            string entryFilePath = Path.Combine(scratchDirPath, "clientui", "friends.js");

            if (!File.Exists(entryFilePath))
            {
                log("[!!!] Entry file missing [!!!]");
                log("Path: " + entryFilePath);
                log("File does not exist. Patch payload files may be corrupt, or another application may have deleted the extracted payload files! (e.g. \"anti\"-\"virus\" and other hostile programs)");
                return Result_Error;
            }

            if (steamState.ClientUiFriendsJsExists)
            {
                // If this one of our friends.js, just delete it
                // If it's not, assume it's important (likely the stock friends.js) and move it to a new name. This enables us to easily uninstall the patch later.

                if (steamState.ClientUiFriendsJsState.PatchStatus == ClientUiFriendsJsPatchStatus.AnyPatchInstalled)
                {
                    log("A modified friends.js is already installed at: " + steamState.ClientUiFriendsJsPath);

                    if (File.Exists(steamState.ClientUiFriendsJsBackupPath))
                    {
                        log("Backup of friends.js already exists");
                    }
                    else
                    {
                        log("[!!!] No friends.js backup found [!!!]");
                        log("Also, the existing friends.js will NOT be backed up this time, because the existing friends.js is already modified by the patch!");
                    }

                    log("Deleting existing friends.js...");
                    try
                    {
                        File.Delete(steamState.ClientUiFriendsJsPath);
                    }
                    catch (Exception e)
                    {
                        log("[!!!] Failed to delete modified friends.js [!!!]");
                        log("Exception details: " + e.ToString());
                        return Result_Error;
                    }
                }
                else
                {
                    if (File.Exists(steamState.ClientUiFriendsJsBackupPath))
                    {
                        log("Backup of friends.js already exists, skipping creating backup this time");

                        // Assume that the existing backup is good and that we have no need to back up the current friends.js
                        // So we can just delete the current friends.js
                        try
                        {
                            File.Delete(steamState.ClientUiFriendsJsPath);
                        }
                        catch (Exception e)
                        {
                            log("[!!!] Failed to delete existing friends.js [!!!]");
                            log("Path: " + steamState.ClientUiFriendsJsPath);
                            log("Exception details: " + e.ToString());
                            return Result_Error;
                        }
                    }
                    else
                    {
                        // friends.js.first-backup does not exist, so turn the current friends.js file into the first-backup
                        log("Backing up existing friends.js...");
                        try
                        {
                            File.Move(steamState.ClientUiFriendsJsPath, steamState.ClientUiFriendsJsBackupPath);
                            log("Backup path: " + steamState.ClientUiFriendsJsBackupPath);
                        }
                        catch (Exception e)
                        {
                            log("[!!!] Failed to move existing friends.js [!!!]");
                            log("Unable to move existing friends.js to backup path: " + steamState.ClientUiFriendsJsBackupPath);
                            log("Exception details: " + e.ToString());
                            return Result_Error;
                        }
                    }
                }
            }
            else
            {
                log("Skipping existing friends.js backup. File does not exist.");
            }

            log("Installing modified friends.js...");
            try
            {
                File.Move(entryFilePath, steamState.ClientUiFriendsJsPath);
            }
            catch (Exception e)
            {
                log("[!!!] Failed to move modified friends.js to final path [!!!]");
                log("Destination path: " + steamState.ClientUiFriendsJsPath);
                log("Exception details: " + e.ToString());
                return Result_Error;
            }

            progress(100);


            //
            // Remove temp scratch dir
            //

            try
            {
                Directory.Delete(scratchDirPath, true);
            }
            catch (Exception e)
            {
                log("[!!!] Failed to delete scratch directory [!!!]");
                log("Exception details: " + e.ToString());
                // non-fatal
            }


            return Result_Success;
        }



        // ____________________________________________________________________________________________________
        // 
        //     Unnstall
        // ____________________________________________________________________________________________________
        //

        public static int UninstallPatch(string steamRootDirPath, LogItemDelegate postLogItem = null)
        {
            void log(string message)
            {
                postLogItem?.Invoke(message);
            }


            //
            // Preparation
            //

            log("Determining steam state...");
            SteamState steamState = new SteamState(steamRootDirPath, autoRefresh: false);

            if (steamState.IsSteamRunning)
            {
                log("[!!!] Steam is currently running [!!!]");
                log("Patch cannot be uninstalled while Steam is running. Close Steam first.");
                return Result_SteamRunning;
            }

            if (!steamState.ClientUiDirExists)
            {
                log("[!!!] Missing clientui directory [!!!]");
                log("Path \"" + steamState.ClientUiDirPath + "\" does not exist");
                return Result_Error;
            }

            if (!steamState.ClientUiFriendsJsBackupExists)
            {
                log("[!!!] Backup friends.js file does not exist [!!!]");
                log("Path: " + steamState.ClientUiFriendsJsBackupPath);
                return Result_Error;
            }

            
            //
            // Delete existing (modified) friends.js
            //

            if (steamState.ClientUiFriendsJsExists)
            {
                log("Deleting modified friends.js...");
                try
                {
                    File.Delete(steamState.ClientUiFriendsJsPath);
                }
                catch (Exception e)
                {
                    log("[!!!] Failed to delete existing (modified) friends.js [!!!]");
                    log("Path: " + steamState.ClientUiFriendsJsPath);
                    log("Exception details: " + e.ToString());
                    return Result_Error;
                }
            }


            //
            // Rename backup file to friends.js
            //

            log("Restoring backup friends.js...");
            try
            {
                File.Move(steamState.ClientUiFriendsJsBackupPath, steamState.ClientUiFriendsJsPath);
            }
            catch (Exception e)
            {
                log("[!!!] Failed to restore friends.js backup [!!!]");
                log("Backup path: " + steamState.ClientUiFriendsJsBackupPath);
                log("Destination path: " + steamState.ClientUiFriendsJsPath);
                log("Exception details: " + e.ToString());
                return Result_Error;
            }


            //
            // Delete patch payload files folder
            //

            PatchMetadata pm = steamState.InstalledPatchMetadata;
            if (pm != null)
            {
                string payloadDirPath = Path.Combine(steamState.ClientUiDirPath, pm.Level0.PayloadName);
                
                if (Directory.Exists(payloadDirPath))
                {
                    log("Deleting patch payload folder...");
                    
                    try
                    {
                        Directory.Delete(payloadDirPath, true);
                    }
                    catch (Exception e)
                    {
                        log("Failed to delete payload folder: " + payloadDirPath);
                        log("Exception details: " + e.ToString());
                        // No error result here because this is non fatal
                        // Leftover payload folders dont do anything except take up space, since the files in them are only loaded by the modified friends.js
                        log("You can safely ignore this error, or you can manually delete the patch payload folder yourself. Without a modified friends.js, the payload folder does nothing on its own.");
                    }
                }
            }


            return Result_Success;
        }

    }
}
