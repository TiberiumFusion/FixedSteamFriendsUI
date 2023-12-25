using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.Infra;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher
{
    public class PatchPayloadDiskRepository : PropertyChangedNotifier, IDisposable
    {

        // ____________________________________________________________________________________________________
        // 
        //     Properties
        // ____________________________________________________________________________________________________
        //

        public string DiskDirectoryPath { get; private set; }

        public ObservableCollection<PatchPayloadFileInfo> PayloadFiles { get; private set; }



        // ____________________________________________________________________________________________________
        // 
        //     Events
        // ____________________________________________________________________________________________________
        //

        public event EventHandler PayloadFilesChanged;
        public void NotifyPayloadFilesChanged()
        {
            PayloadFilesChanged?.Invoke(this, new EventArgs());
        }



        // ____________________________________________________________________________________________________
        // 
        //     Internals
        // ____________________________________________________________________________________________________
        //

        private FileSystemWatcher FswDiskDirectory;


        public PatchPayloadDiskRepository(string diskDirectory, bool autoRefresh = true)
        {
            PayloadFiles = new ObservableCollection<PatchPayloadFileInfo>();

            DiskDirectoryPath = diskDirectory;

            Refresh();

            if (autoRefresh)
            {
                ResetFileWatchers();
            }
        }

        public void Dispose()
        {
            DisposeFileWatchers();

            PayloadFiles.Clear();
        }


        private void ResetFileWatchers()
        {
            DisposeFileWatchers();

            if (Directory.Exists(DiskDirectoryPath))
            {
                FswDiskDirectory = new FileSystemWatcher(DiskDirectoryPath);
                FswDiskDirectory.NotifyFilter = NotifyFilters.DirectoryName | NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Attributes | NotifyFilters.Size;
                FswDiskDirectory.IncludeSubdirectories = false;
                FswDiskDirectory.EnableRaisingEvents = true;
                FswDiskDirectory.Changed += FswDiskDirectory_Activity;
                FswDiskDirectory.Changed += FswDiskDirectory_Activity;
                FswDiskDirectory.Created += FswDiskDirectory_Activity;
                FswDiskDirectory.Deleted += FswDiskDirectory_Activity;
                FswDiskDirectory.Renamed += FswDiskDirectory_Activity;
            }
        }

        private void FswDiskDirectory_Activity(object sender, FileSystemEventArgs e)
        {
            Application.Current.Dispatcher.Invoke(() =>
            {
                Refresh();
            });
        }

        private void DisposeFileWatchers()
        {
            if (FswDiskDirectory != null)
            {
                FswDiskDirectory.Changed -= FswDiskDirectory_Activity;
                FswDiskDirectory.Changed -= FswDiskDirectory_Activity;
                FswDiskDirectory.Created -= FswDiskDirectory_Activity;
                FswDiskDirectory.Deleted -= FswDiskDirectory_Activity;
                FswDiskDirectory.Renamed -= FswDiskDirectory_Activity;
                FswDiskDirectory.Dispose();
                FswDiskDirectory = null;
            }

        }

        private void Refresh()
        {
            Dictionary<string, PatchPayloadFileInfo> oldFilesByPath = new Dictionary<string, PatchPayloadFileInfo>();
            Dictionary<string, PatchPayloadFileInfo> removedFiles = new Dictionary<string, PatchPayloadFileInfo>();
            foreach (PatchPayloadFileInfo item in PayloadFiles)
            {
                oldFilesByPath[item.FilePath] = item;
                removedFiles[item.FilePath] = item;
            }

            if (Directory.Exists(DiskDirectoryPath))
            {
                MD5 hashSlingingSlasher = MD5.Create();

                // Find zip files that appear to be patch payloads
                foreach (string filePath in Directory.GetFiles(DiskDirectoryPath, "*.zip", SearchOption.AllDirectories))
                {
                    if (removedFiles.TryGetValue(filePath, out PatchPayloadFileInfo existingItem))
                        removedFiles.Remove(filePath);

                    // Validate file contents
                    // Specifically, we are looking for the outer friends.js file and checking if it has a patch metadata json string in it
                    try
                    {
                        using (FileStream fs = File.Open(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                        {
                            byte[] fileHash = hashSlingingSlasher.ComputeHash(fs);
                            if (oldFilesByPath.TryGetValue(filePath, out PatchPayloadFileInfo checkOldItem))
                            {
                                if (fileHash.SequenceEqual(checkOldItem.FileHash))
                                    continue; // keep existing PatchPayloadFileInfo instance
                                else
                                    PayloadFiles.Remove(checkOldItem); // file changed, remove item and replace it with a new one for the updated file
                            }

                            fs.Seek(0, SeekOrigin.Begin);
                            using (ZipArchive ar = new ZipArchive(fs))
                            {
                                ZipArchiveEntry friendsJs = ar.GetEntry(@"clientui\friends.js");
                                if (friendsJs == null)
                                    continue; // not a valid patch payload

                                using (MemoryStream ms = new MemoryStream())
                                {
                                    using (Stream entry = friendsJs.Open())
                                    {
                                        entry.CopyTo(ms);
                                    }
                                    string friendsJsContents = Encoding.UTF8.GetString(ms.ToArray());

                                    if (friendsJsContents.Contains("{A0806671-AC87-4543-A2B6-51BC55CEE900}")) // scraper magic
                                    {
                                        PatchMetadata pm;
                                        Exception parseError;
                                        if (!PatchMetadata.TryScrapeFromString(friendsJsContents, out pm, out parseError))
                                        {
                                            Debug.WriteLine("Failed to scrape-parse PatchMetadata for potential patch payload file: " + filePath);
                                            Debug.WriteLine(parseError);
                                            continue; // ignore malformed patch payloads
                                        }

                                        PayloadFiles.Add(new PatchPayloadFileInfo(filePath, fileHash, pm));
                                    }
                                }
                            }
                        }
                    }
                    catch (Exception e)
                    {
                        Debug.WriteLine("An unhandled exception occurred while validating potential patch payload file: " + filePath);
                        Debug.WriteLine("Details: " + e);
                        // Ignore files that we cannot validate
                        if (oldFilesByPath.TryGetValue(filePath, out PatchPayloadFileInfo existingItem2))
                            PayloadFiles.Remove(existingItem2);
                    }
                }
            }

            foreach (PatchPayloadFileInfo file in removedFiles.Values)
                PayloadFiles.Remove(file);

            NotifyPayloadFilesChanged();
        }

    }
}
