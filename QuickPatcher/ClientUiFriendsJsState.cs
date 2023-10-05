using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.Infra;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher
{

    public enum ClientUiFriendsJsPatchStatus
    {
        Unknown,
        ProbablyStock,
        AnyPatchInstalled,
    }


    public class ClientUiFriendsJsState : PropertyChangedNotifier, IDisposable
    {

        // ____________________________________________________________________________________________________
        // 
        //     Properties
        // ____________________________________________________________________________________________________
        //

        public string FilePath { get; private set; }

        private bool _PathIsValid;
        public bool PathIsValid
        {
            get { return _PathIsValid; }
            private set { SetProperty(ref _PathIsValid, value); }
        }

        private Exception _FileReadError;
        public Exception FileReadError
        {
            get { return _FileReadError; }
            private set { SetProperty(ref _FileReadError, value); }
        }

        private string _Contents;
        public string Contents
        {
            get { return _Contents; }
            private set { SetProperty(ref _Contents, value); }
        }

        private ClientUiFriendsJsPatchStatus _PatchStatus;
        public ClientUiFriendsJsPatchStatus PatchStatus
        {
            get { return _PatchStatus; }
            private set { SetProperty(ref _PatchStatus, value); }
        }

        private Exception _PatchMetadataReadError;
        public Exception PatchMetadataReadError
        {
            get { return _PatchMetadataReadError; }
            private set { SetProperty(ref _PatchMetadataReadError, value); }
        }
        
        private PatchMetadata _PatchMetadata;
        public PatchMetadata PatchMetadata
        {
            get { return _PatchMetadata; }
            private set { SetProperty(ref _PatchMetadata, value); }
        }


        // ____________________________________________________________________________________________________
        // 
        //     Internals
        // ____________________________________________________________________________________________________
        //

        private string _FilePath;

        private FileSystemWatcher FswFilePath;

        public ClientUiFriendsJsState(string filePath, bool autoRefresh = true)
        {
            FilePath = filePath;

            Refresh();

            if (autoRefresh)
            {
                ResetFileWatchers();
            }
        }

        public void Dispose()
        {
            DisposeFileWatchers();
            
            _FileReadError = null;
            _PatchMetadataReadError = null;
            _PatchMetadata = null;
        }


        private void ResetFileWatchers()
        {
            DisposeFileWatchers();

            if (File.Exists(FilePath))
            {
                FswFilePath = new FileSystemWatcher(Path.GetDirectoryName(FilePath));
                FswFilePath.Filter = Path.GetFileName(FilePath);
                FswFilePath.NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Attributes | NotifyFilters.Size;
                FswFilePath.IncludeSubdirectories = false;
                FswFilePath.EnableRaisingEvents = true;
                FswFilePath.Changed += FswFilePath_Activity;
                FswFilePath.Created += FswFilePath_Activity;
                FswFilePath.Deleted += FswFilePath_Activity;
                FswFilePath.Renamed += FswFilePath_Activity;
            }
        }

        private void FswFilePath_Activity(object sender, FileSystemEventArgs e)
        {
            Refresh();
        }

        private void DisposeFileWatchers()
        {
            if (FswFilePath != null)
            {
                FswFilePath.Changed -= FswFilePath_Activity;
                FswFilePath.Created -= FswFilePath_Activity;
                FswFilePath.Deleted -= FswFilePath_Activity;
                FswFilePath.Renamed -= FswFilePath_Activity;
                FswFilePath.Dispose();
                FswFilePath = null;
            }
        }
        

        private void Defaults()
        {
            _PathIsValid = false;
            _FileReadError = null;
            _Contents = null;
            _PatchStatus = ClientUiFriendsJsPatchStatus.Unknown;
            _PatchMetadataReadError = null;
            _PatchMetadata = null;
        }

        private void Refresh()
        {
            Defaults();
            
            //
            // Path
            //

            PathIsValid = File.Exists(FilePath);
            if (!PathIsValid)
                return;
            
            //
            // Contents
            //

            try
            {
                string contents = null;
                using (FileStream fs = File.Open(FilePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                {
                    using (MemoryStream ms = new MemoryStream())
                    {
                        fs.CopyTo(ms);
                        contents = Encoding.UTF8.GetString(ms.ToArray());
                    }
                }
                if (contents == null)
                    throw new Exception("Failed to read file contents; file may be locked");

                Contents = contents;
            }
            catch (Exception e)
            {
                FileReadError = e;
                return;
            }

            //
            // Patch status
            //

            // The presence of a magic GUID string in the file indicates with 99% probability that friends.js is modified with the patch
            if (!Contents.Contains("{A0806671-AC87-4543-A2B6-51BC55CEE900}"))
            {
                PatchStatus = ClientUiFriendsJsPatchStatus.ProbablyStock;
                return;
            }

            PatchStatus = ClientUiFriendsJsPatchStatus.AnyPatchInstalled;

            //
            // Patch metadata
            //

            // Scrape the patch metadata json string
            PatchMetadata pm;
            Exception pmError;
            if (!PatchMetadata.TryScrapeFromString(Contents, out pm, out pmError))
            {
                PatchMetadataReadError = pmError;
                return;
            }

            PatchMetadata = pm;

        }

    }

}
