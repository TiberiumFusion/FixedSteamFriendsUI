using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.Infra;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher
{
    public class PatcherState : PropertyChangedNotifier, IDisposable
    {

        // ____________________________________________________________________________________________________
        // 
        //     Properties
        // ____________________________________________________________________________________________________
        //

        private string _SteamRootDirPath;
        public string SteamRootDirPath
        {
            get { return _SteamRootDirPath; }
            set
            {
                if (SetProperty(ref _SteamRootDirPath, value))
                {
                    NewSteamState();
                    ResetFileWatchers();
                }
            }
        }
        
        public SteamState SteamState { get; private set; }

        private void _SteamState_PropertyChanged(object sender, System.ComponentModel.PropertyChangedEventArgs e)
        {
            OnPropertyChanged("SteamState");
        }

        private PatchPayloadDiskRepository _PayloadRepo;
        public PatchPayloadDiskRepository PayloadRepo
        {
            get { return _PayloadRepo; }
            set
            {
                if (_PayloadRepo != value)
                {
                    SetProperty(ref _PayloadRepo, value);
                    PatchPayloadToInstall = _PayloadRepo.PayloadFiles.FirstOrDefault();
                }
            }
        }


        private PatchPayloadFileInfo _PatchPayloadToInstall;
        public PatchPayloadFileInfo PatchPayloadToInstall
        {
            get { return _PatchPayloadToInstall; }
            set
            {
                SetProperty(ref _PatchPayloadToInstall, value);
                NotifyPatchPayloadToInstallChanged();
            }
        }



        // ____________________________________________________________________________________________________
        // 
        //     Events
        // ____________________________________________________________________________________________________
        //

        public event EventHandler SteamStateLiveRefresh;
        public void NotifySteamStateLiveRefresh()
        {
            SteamStateLiveRefresh?.Invoke(this, new EventArgs());
        }

        public event EventHandler SteamStateIsSteamRunningChanged;
        public void NotifySteamStateIsSteamRunningChanged()
        {
            SteamStateIsSteamRunningChanged?.Invoke(this, new EventArgs());
        }

        public event EventHandler PatchPayloadToInstallChanged;
        public void NotifyPatchPayloadToInstallChanged()
        {
            PatchPayloadToInstallChanged?.Invoke(this, new EventArgs());
        }



        // ____________________________________________________________________________________________________
        // 
        //     Internals
        // ____________________________________________________________________________________________________
        //

        private FileSystemWatcher FswSteamRootDirPath;

        public PatcherState()
        {
            PayloadRepo = new PatchPayloadDiskRepository( Path.Combine(Directory.GetCurrentDirectory(), "PatchPayloads") );
            PayloadRepo.PayloadFilesChanged += (s, e) =>
            {
                if (PatchPayloadToInstall == null)
                    SetPatchPayloadToInstallToLatestVersion();
            };

            SetPatchPayloadToInstallToLatestVersion();
        }
        
        public void Dispose()
        {
            DisposeFileWatchers();

            DisposeSteamState();
            _SteamRootDirPath = null;
        }

        
        internal SteamState NewSteamState()
        {
            DisposeSteamState();

            SteamState = new SteamState(SteamRootDirPath);
            SteamState.PropertyChanged += _SteamState_PropertyChanged;
            SteamState.LiveRefresh += _SteamState_LiveRefresh;
            SteamState.IsSteamRunningChanged += _SteamState_IsSteamRunningChanged;

            OnPropertyChanged("SteamState");

            return SteamState;
        }

        private void _SteamState_LiveRefresh(object sender, EventArgs e)
        {
            NotifySteamStateLiveRefresh();
        }
        private void _SteamState_IsSteamRunningChanged(object sender, EventArgs e)
        {
            NotifySteamStateIsSteamRunningChanged();
        }

        private void DisposeSteamState()
        {
            if (SteamState != null)
            {
                SteamState.PropertyChanged -= _SteamState_PropertyChanged;
                SteamState.LiveRefresh -= _SteamState_LiveRefresh;
                SteamState.IsSteamRunningChanged -= _SteamState_IsSteamRunningChanged;
                SteamState.Dispose();
            }
        }


        private void ResetFileWatchers()
        {
            DisposeFileWatchers();

            if (Directory.Exists(SteamRootDirPath))
            {
                FswSteamRootDirPath = new FileSystemWatcher(SteamRootDirPath);
                FswSteamRootDirPath.NotifyFilter = NotifyFilters.DirectoryName;
                FswSteamRootDirPath.IncludeSubdirectories = false;
                FswSteamRootDirPath.EnableRaisingEvents = true;
                FswSteamRootDirPath.Changed += FswSteamRootDirPath_Activity;
                FswSteamRootDirPath.Changed += FswSteamRootDirPath_Activity;
                FswSteamRootDirPath.Created += FswSteamRootDirPath_Activity;
                FswSteamRootDirPath.Deleted += FswSteamRootDirPath_Activity;
                FswSteamRootDirPath.Renamed += FswSteamRootDirPath_Activity;
            }
        }
        
        private void FswSteamRootDirPath_Activity(object sender, FileSystemEventArgs e)
        {
            NewSteamState();
        }

        private void DisposeFileWatchers()
        {
            if (FswSteamRootDirPath != null)
            {
                FswSteamRootDirPath.Changed -= FswSteamRootDirPath_Activity;
                FswSteamRootDirPath.Changed -= FswSteamRootDirPath_Activity;
                FswSteamRootDirPath.Created -= FswSteamRootDirPath_Activity;
                FswSteamRootDirPath.Deleted -= FswSteamRootDirPath_Activity;
                FswSteamRootDirPath.Renamed -= FswSteamRootDirPath_Activity;
                FswSteamRootDirPath.Dispose();
                FswSteamRootDirPath = null;
            }

        }

        private void SetPatchPayloadToInstallToLatestVersion()
        {
            if (PayloadRepo.PayloadFiles.Count > 0)
            {
                PatchPayloadToInstall = PayloadRepo.PayloadFiles.OrderBy(i => i.PatchVersion).Last();
            }
        }
        
    }
}
