using System;
using System.Collections.Generic;
using System.Text;
using System.ComponentModel;
using System.Linq;
using System.IO;
using Newtonsoft.Json;
using TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.Infra;
using Newtonsoft.Json.Linq;
using System.Diagnostics;
using System.Threading;
using TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.StaticData;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher
{
    public class SteamState : PropertyChangedNotifier, IDisposable
    {

        // ____________________________________________________________________________________________________
        // 
        //     Constants
        // ____________________________________________________________________________________________________
        //

        public static readonly string SteamServiceRootDirPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonProgramFilesX86), "Steam"); // afaik the steam service is always installed here
        
        
        
        // ____________________________________________________________________________________________________
        // 
        //     Properties
        // ____________________________________________________________________________________________________
        //
        
        // --------------------------------------------------
        //   Steam\* - root level files
        // --------------------------------------------------
        
        public string SteamRootDirPath { get; private set; }

        private bool _SteamRootDirPathIsValid;
        public bool SteamRootDirPathIsValid
        {
            get { return _SteamRootDirPathIsValid; }
            private set { SetProperty(ref _SteamRootDirPathIsValid, value); }
        }

        public string SteamclientDllPath
        {
            get { return Path.Combine(SteamRootDirPath, "steamclient.dll"); }
        }

        private bool _SteamclientDllExists;
        public bool SteamclientDllExists
        {
            get { return _SteamclientDllExists; }
            private set { SetProperty(ref _SteamclientDllExists, value); }
        }

        private Version _SteamclientDllVersion;
        public Version SteamclientDllVersion
        {
            get { return _SteamclientDllVersion; }
            private set { SetProperty(ref _SteamclientDllVersion, value); }
        }

        private SteamClientVersionStatus _SteamclientDllVersionStatus;
        public SteamClientVersionStatus SteamclientDllVersionStatus
        {
            get { return _SteamclientDllVersionStatus; }
            private set { SetProperty(ref _SteamclientDllVersionStatus, value); }
        }


        // --------------------------------------------------
        //   Steam\clientui\*
        // --------------------------------------------------

        public string ClientUiDirPath
        {
            get { return Path.Combine(SteamRootDirPath, "clientui"); }
        }

        private bool _ClientUiDirExists;
        public bool ClientUiDirExists
        {
            get { return _ClientUiDirExists; }
            private set { SetProperty(ref _ClientUiDirExists, value); }
        }

        // --------------------------------------------------
        //   Steam\clientui\friends.js
        // -------------------------------------------------

        public string ClientUiFriendsJsPath
        {
            get { return Path.Combine(ClientUiDirPath, "friends.js"); }
        }

        private bool _ClientUiFriendsJsExists;
        public bool ClientUiFriendsJsExists
        {
            get { return _ClientUiFriendsJsExists; }
            private set { SetProperty(ref _ClientUiFriendsJsExists, value); }
        }

        public ClientUiFriendsJsState ClientUiFriendsJsState { get; private set; }

        public string ClientUiFriendsJsBackupPath
        {
            get { return Path.Combine(ClientUiDirPath, "friends.js.first-backup"); }
        }

        private bool _ClientUiFriendsJsBackupExists;
        public bool ClientUiFriendsJsBackupExists
        {
            get { return _ClientUiFriendsJsBackupExists; }
            private set { SetProperty(ref _ClientUiFriendsJsBackupExists, value); }
        }

        public ClientUiFriendsJsState ClientUiFriendsJsBackupState { get; private set; }


        // --------------------------------------------------
        //   Patch files
        // -------------------------------------------------

        public PatchMetadata InstalledPatchMetadata
        {
            get
            {
                if (ClientUiFriendsJsState != null)
                    return ClientUiFriendsJsState.PatchMetadata;
                else
                    return null;
            }
        }


        // --------------------------------------------------
        //   Backup files
        // -------------------------------------------------

        public bool ClientUiFriendsJsBackupIsDirty
        {
            get
            {
                if (ClientUiFriendsJsBackupState != null)
                    return ClientUiFriendsJsBackupState.PatchStatus == ClientUiFriendsJsPatchStatus.AnyPatchInstalled;
                else
                    return false;
            }
        }


        // --------------------------------------------------
        //   Live state
        // -------------------------------------------------

        private bool _IsSteamRunning;
        public bool IsSteamRunning
        {
            get { return _IsSteamRunning; }
            private set { SetProperty(ref _IsSteamRunning, value); }
        }

        public List<Tuple<int, string>> RunningSteamProcessesInfo { get; private set; } // <pid, image name>



        // ____________________________________________________________________________________________________
        // 
        //     Events
        // ____________________________________________________________________________________________________
        //

        public event EventHandler LiveRefresh;
        public void NotifyLiveRefresh()
        {
            LiveRefresh?.Invoke(this, new EventArgs());
        }

        public event EventHandler IsSteamRunningChanged;
        public void NotifyIsSteamRunningChanged()
        {
            IsSteamRunningChanged?.Invoke(this, new EventArgs());
        }



        // ____________________________________________________________________________________________________
        // 
        //     Internals
        // ____________________________________________________________________________________________________
        //

        private bool AutoRefreshHandlersEnabled = true;
        

        public SteamState(string steamRootDirPath, bool autoRefresh = true)
        {
            RunningSteamProcessesInfo = new List<Tuple<int, string>>();

            SteamRootDirPath = steamRootDirPath;

            ClientUiFriendsJsState = new ClientUiFriendsJsState(ClientUiFriendsJsPath, autoRefresh);
            ClientUiFriendsJsState.PropertyChanged += ClientUiFriendsJsState_PropertyChanged;

            ClientUiFriendsJsBackupState = new ClientUiFriendsJsState(ClientUiFriendsJsBackupPath, autoRefresh);
            ClientUiFriendsJsBackupState.PropertyChanged += ClientUiFriendsJsBackupState_PropertyChanged;

            Refresh();
            
            if (autoRefresh)
            {
                ResetFileWatchers();
                CreateLiveStateRefreshTimer();
            }
        }

        public void Dispose()
        {
            DisposeFileWatchers();

            DisposeLiveStateRefreshTimer();

            ClientUiFriendsJsState.PropertyChanged -= ClientUiFriendsJsState_PropertyChanged;
            ClientUiFriendsJsState.Dispose();
            ClientUiFriendsJsState = null;

            ClientUiFriendsJsBackupState.PropertyChanged -= ClientUiFriendsJsBackupState_PropertyChanged;
            ClientUiFriendsJsBackupState.Dispose();
            ClientUiFriendsJsBackupState = null;
        }


        private void ClientUiFriendsJsState_PropertyChanged(object sender, PropertyChangedEventArgs e)
        {
            OnPropertyChanged("ClientUiFriendsJsState");
        }

        private void ClientUiFriendsJsBackupState_PropertyChanged(object sender, PropertyChangedEventArgs e)
        {
            OnPropertyChanged("ClientUiFriendsJsBackupState");
        }


        public void SuspendAutoRefresh()
        {
            AutoRefreshHandlersEnabled = false;
        }

        public void ResumeAutoRefresh(bool forceDisk = true, bool forceLive = true)
        {
            AutoRefreshHandlersEnabled = true;
            Refresh(forceDisk, forceLive);
        }


        //
        // Watch memory for changes and refresh
        //

        private Timer TimerLiveStateRefresh;
        private int TimerLiveStateRefreshInterval = 300; // ms

        private void DisposeLiveStateRefreshTimer()
        {
            if (TimerLiveStateRefresh != null)
            {
                TimerLiveStateRefresh.Change(Timeout.Infinite, 0);
                TimerLiveStateRefresh.Dispose();
                TimerLiveStateRefresh= null;
            }
        }

        private void CreateLiveStateRefreshTimer()
        {
            DisposeLiveStateRefreshTimer();

            TimerLiveStateRefresh = new Timer(OnLiveStateRefreshTimerInterval, null, TimerLiveStateRefreshInterval, TimerLiveStateRefreshInterval);
        }

        private void OnLiveStateRefreshTimerInterval(object state)
        {
            if (!AutoRefreshHandlersEnabled)
                return;

            Refresh(disk:false, live:true);
        }


        //
        // Watch disk for changes and refresh
        //

        private FileSystemWatcher FswClientUiDir;
        
        private void ResetFileWatchers()
        {
            DisposeFileWatchers();

            if (Directory.Exists(ClientUiDirPath))
            {
                FswClientUiDir = new FileSystemWatcher(ClientUiDirPath);
                FswClientUiDir.NotifyFilter = NotifyFilters.DirectoryName | NotifyFilters.FileName | NotifyFilters.LastWrite;
                FswClientUiDir.IncludeSubdirectories = false;
                FswClientUiDir.EnableRaisingEvents = true;
                FswClientUiDir.Changed += ClientUiDirPath_Activity;
                FswClientUiDir.Created += ClientUiDirPath_Activity;
                FswClientUiDir.Deleted += ClientUiDirPath_Activity;
                FswClientUiDir.Renamed += ClientUiDirPath_Activity;
            }
        }

        private void ClientUiDirPath_Activity(object sender, FileSystemEventArgs e)
        {
            if (!AutoRefreshHandlersEnabled)
                return;

            //Refresh(disk:true, live:false);
            Refresh(disk:true, live:true); // refresh live as well because the "is steam running" check uses the file paths we determine in the disk checks
        }
        
        private void DisposeFileWatchers()
        {
            if (FswClientUiDir != null)
            {
                FswClientUiDir.Changed -= ClientUiDirPath_Activity;
                FswClientUiDir.Created -= ClientUiDirPath_Activity;
                FswClientUiDir.Deleted -= ClientUiDirPath_Activity;
                FswClientUiDir.Renamed -= ClientUiDirPath_Activity;
                FswClientUiDir.Dispose();
                FswClientUiDir = null;
            }
        }


        private void Defaults(bool disk = true, bool live = true)
        {
            if (disk)
            {
                _SteamRootDirPathIsValid = false; // use backing fields, don't notify property changes since Refresh will be setting them immediately afterwards
                _SteamclientDllExists = false;
                _SteamclientDllVersion = null;
                _SteamclientDllVersionStatus = SteamClientVersionStatus.Unknown;
                _ClientUiDirExists = false;
                _ClientUiFriendsJsExists = false;
                _ClientUiFriendsJsBackupExists = false;
            }
            if (live)
            {
                // move this stuff out to the exact locations where it changes
            }
        }

        private void Refresh(bool disk = true, bool live = true)
        {
            bool oldIsSteamRunning = IsSteamRunning;


            Defaults(disk, live);


            if (disk)
            {
                //
                // Root directory
                //

                SteamRootDirPathIsValid = Directory.Exists(SteamRootDirPath);
                if (!SteamRootDirPathIsValid)
                    goto PostDisk;

                //
                // steamclient.dll
                //
                
                if (File.Exists(SteamclientDllPath))
                {
                    SteamclientDllExists = true;

                    // steamclient.dll version check is optional, if we cannot determine the version we wont block patch install
                    try
                    {
                        SteamclientDllVersion = Version.Parse(FileVersionInfo.GetVersionInfo(SteamclientDllPath).FileVersion);
                        // We use steamclient.dll instead of Steam.exe because Steam.exe is just a bootstrapper and has zero Steam client logic inside it
                        // Valve exploits this my making Steam.exe never revert itself during updates
                        // For example, if the user has the July 2023 client installed and then uses -forcesteamupdate to install the May 2023 client, Steam.exe will NOT be reverted and will remain circa July 2023
                        // Which means there is a discrepancy between the version reported by Steam.exe versus every other single file
                        // So we ignore Steam.exe and check steamclient.dll instead, but any other real client binary would work as well
                    }
                    catch (Exception e)
                    {
                        Debug.WriteLine("Failed to get steamclient.dll version. Details: " + e);
                    }
                    
                    if (SteamclientDllVersion == null)
                        SteamclientDllVersionStatus = SteamClientVersionStatus.Unknown;
                    else if (SteamclientDllVersion <= SteamClientNotableVersions.Client20230728)
                        SteamclientDllVersionStatus = SteamClientVersionStatus.Compatible;
                    else
                        SteamclientDllVersionStatus = SteamClientVersionStatus.TooNew;
                    // todo: test each client release before May 30 2023 until we find the first one that warrants returning TooOld
                }

                //
                // Steam\clientui
                //

                if (!Directory.Exists(ClientUiDirPath))
                {
                    ClientUiDirExists = false;
                    goto PostDisk;
                }
                ClientUiDirExists = true;

                //
                // clientui\friends.js
                //

                ClientUiFriendsJsExists = File.Exists(ClientUiFriendsJsPath);
                // Non-fatal if friends.js is missing since we are installing our own version anyways
                // But obviously no backup can be made in this case

                ClientUiFriendsJsBackupExists = File.Exists(ClientUiFriendsJsBackupPath);
                // A
            }

            PostDisk:
            
            if (live)
            {
                //
                // Is steam running
                //

                HashSet<string> steamProcessNames = new HashSet<string>()
                {
                    "steam".ToLowerInvariant(),
                    "steamwebhelper".ToLowerInvariant(),
                    "steamerrorreporter".ToLowerInvariant(),
                    "steamerrorreporter64".ToLowerInvariant(),
                    "GameOverlayUI".ToLowerInvariant(),
                    // This is not an exhaustive list of all the Steam binaries, but I believe it is a complete list of the root-level processes that Steam starts
                };
                HashSet<string> steamServiceProcessNames = new HashSet<string>()
                {
                    "SteamService".ToLowerInvariant(),
                };
                
                RunningSteamProcessesInfo.Clear();

                bool isSteamRunning = false;

                foreach (Process process in Process.GetProcesses())
                {
                    string pNameCanon = process.ProcessName.ToLowerInvariant();

                    bool match = false;
                    try
                    {
                        if (steamProcessNames.Contains(pNameCanon))
                        {
                            // Only consider online steam binaries at the target dir
                            // Running steam processes that from binaries at a different dir will not be locking the files in our target dir
                            match = Helpers.DirectoryHasSubdirectory(SteamRootDirPath, Path.GetDirectoryName(process.MainModule.FileName), true);
                        }
                        else if (steamServiceProcessNames.Contains(pNameCanon))
                        {
                            // SteamService.exe is global, so the prior exclusion rule does not apply
                            // But we will verify that this is the real SteamService and not an imposter
                            match = Helpers.DirectoryHasSubdirectory(SteamServiceRootDirPath, Path.GetDirectoryName(process.MainModule.FileName), true);
                        }
                    }
                    catch (Exception e)
                    {
                        match = true; // assume worst case
                    }

                    if (match)
                    {
                        isSteamRunning = true;
                        RunningSteamProcessesInfo.Add(new Tuple<int, string>(process.Id, process.ProcessName + ".exe"));
                    }
                }

                RunningSteamProcessesInfo.Sort((a, b) =>
                {
                    if (a.Item2 == b.Item2)
                        return a.Item1.CompareTo(b.Item1); // sort by pid within same names
                    else
                        return a.Item2.CompareTo(b.Item2);
                });
                
                IsSteamRunning = isSteamRunning;

                NotifyLiveRefresh();

                if (oldIsSteamRunning != IsSteamRunning)
                    NotifyIsSteamRunningChanged();
            }

        }
    }
}
