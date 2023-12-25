using Ookii.Dialogs.Wpf;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher
{
    /// <summary>
    /// Interaction logic for Patcher.xaml
    /// </summary>
    public partial class Patcher : UserControl, INotifyPropertyChanged
    {

        public event PropertyChangedEventHandler PropertyChanged;
        public void NotifyPropertyChanged(string name)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
        }



        // ____________________________________________________________________________________________________
        // 
        //     Built-in data model
        // ____________________________________________________________________________________________________
        //

        public PatcherState PatcherState
        {
            get { return (PatcherState)FindResource("PatcherState"); }
        }

        public PatchInstallState PatchInstallState
        {
            get { return (PatchInstallState)FindResource("PatchInstallState"); }
        }



        // ____________________________________________________________________________________________________
        // 
        //     Ctor
        // ____________________________________________________________________________________________________
        //

        public Patcher()
        {
            InitializeComponent();


            PresentSteamStateDefaults();
            PresentBeforeInstallingPatch();
            PresentBeforeUninstallingPatch();


            this.Loaded += (s, e) => SteamLocationTextChangedTimer_Init();
            this.Unloaded += (s, e) => SteamLocationTextChangedTimer_Dispose();


            PatcherState.PropertyChanged += (s, e) =>
            {
                NotifyPropertyChanged("PatcherState");
                if (e.PropertyName == "SteamState")
                {
                    PresentSteamState();
                    PresentInstallVersionComboNotices();
                    NotifyLiveStatePropertiesChanged();
                }
            };
            PatcherState.SteamStateLiveRefresh += PatcherState_SteamStateLiveRefresh;
            PatcherState.SteamStateIsSteamRunningChanged += PatcherState_SteamStateIsSteamRunningChanged;

            PatcherState.PatchPayloadToInstallChanged += (s, e) =>
            {
                NotifyPropertyChanged("PatchToInstallMetadata");
                PresentInstallVersionComboNotices();
            };
            

            PatchInstallState.PropertyChanged += (s, e) =>
            {
                NotifyPropertyChanged("PatchInstallState");
                NotifyLiveStatePropertiesChanged();
            };
        }



        // ____________________________________________________________________________________________________
        // 
        //     PatcherState presentation
        // ____________________________________________________________________________________________________
        //

        // ----------------------------------------------------------------------
        //   Metadata of patch version the user wants to install
        // ----------------------------------------------------------------------

        public PatchMetadata PatchToInstallMetadata
        {
            get
            {
                if (PatcherState.PatchPayloadToInstall != null)
                    return PatcherState.PatchPayloadToInstall.PatchMetadata;
                else
                    return null;
            }
        }
        
        
        // ----------------------------------------------------------------------
        //   Steam state
        // ----------------------------------------------------------------------

        //
        // Disk
        //

        private Visibility _Vis_InvalidSteamRootDirPath;
        public Visibility Vis_InvalidSteamRootDirPath
        {
            get { return _Vis_InvalidSteamRootDirPath; }
            set { _Vis_InvalidSteamRootDirPath = value; NotifyPropertyChanged("Vis_InvalidSteamRootDirPath"); }
        }

        private Visibility _Vis_MissingClientUiDir;
        public Visibility Vis_MissingClientUiDir
        {
            get { return _Vis_MissingClientUiDir; }
            set { _Vis_MissingClientUiDir = value; NotifyPropertyChanged("Vis_MissingClientUiDir"); }
        }

        private Visibility _Vis_MissingFriendsJs;
        public Visibility Vis_MissingFriendsJs
        {
            get { return _Vis_MissingFriendsJs; }
            set { _Vis_MissingFriendsJs = value; NotifyPropertyChanged("Vis_MissingFriendsJs"); }
        }

        private Visibility _Vis_SteamClientVersionMismatch;
        public Visibility Vis_SteamClientVersionMismatch
        {
            get { return _Vis_SteamClientVersionMismatch; }
            set { _Vis_SteamClientVersionMismatch = value; NotifyPropertyChanged("Vis_SteamClientVersionMismatch"); }
        }

        private Visibility _Vis_SteamStatus;
        public Visibility Vis_SteamStatus
        {
            get { return _Vis_SteamStatus; }
            set { _Vis_SteamStatus = value; NotifyPropertyChanged("Vis_SteamStatus"); }
        }
        
        private Visibility _Vis_UnknownFriendsJs;
        public Visibility Vis_UnknownFriendsJs
        {
            get { return _Vis_UnknownFriendsJs; }
            set { _Vis_UnknownFriendsJs = value; NotifyPropertyChanged("Vis_UnknownFriendsJs"); }
        }

        private string _FriendsJsReadErrorDetails;
        public string FriendsJsReadErrorDetails
        {
            get { return _FriendsJsReadErrorDetails; }
            set { _FriendsJsReadErrorDetails = value; NotifyPropertyChanged("FriendsJsReadErrorDetails"); }
        }

        private Visibility _Vis_StockFriendsJs;
        public Visibility Vis_StockFriendsJs
        {
            get { return _Vis_StockFriendsJs; }
            set { _Vis_StockFriendsJs = value; NotifyPropertyChanged("Vis_StockFriendsJs"); }
        }

        private Visibility _Vis_ModifiedFriendsJs;
        public Visibility Vis_ModifiedFriendsJs
        {
            get { return _Vis_ModifiedFriendsJs; }
            set { _Vis_ModifiedFriendsJs = value; NotifyPropertyChanged("Vis_ModifiedFriendsJs"); }
        }

        private Visibility _Vis_ModifiedFriendsJs_WithMetadata;
        public Visibility Vis_ModifiedFriendsJs_WithMetadata
        {
            get { return _Vis_ModifiedFriendsJs_WithMetadata; }
            set { _Vis_ModifiedFriendsJs_WithMetadata = value; NotifyPropertyChanged("Vis_ModifiedFriendsJs_WithMetadata"); }
        }

        private Visibility _Vis_ModifiedFriendsJs_WithoutMetadata;
        public Visibility Vis_ModifiedFriendsJs_WithoutMetadata
        {
            get { return _Vis_ModifiedFriendsJs_WithoutMetadata; }
            set { _Vis_ModifiedFriendsJs_WithoutMetadata = value; NotifyPropertyChanged("Vis_ModifiedFriendsJs_WithoutMetadata"); }
        }

        private Visibility _Vis_DowngradeWarning;
        public Visibility Vis_DowngradeWarning
        {
            get { return _Vis_DowngradeWarning; }
            set { _Vis_DowngradeWarning = value; NotifyPropertyChanged("Vis_DowngradeWarning"); }
        }
        
        private Visibility _Vis_NogradeWarning;
        public Visibility Vis_NogradeWarning
        {
            get { return _Vis_NogradeWarning; }
            set { _Vis_NogradeWarning = value; NotifyPropertyChanged("Vis_NogradeWarning"); }
        }

        private Visibility _Vis_UpgradeWarning;
        public Visibility Vis_UpgradeWarning
        {
            get { return _Vis_UpgradeWarning; }
            set { _Vis_UpgradeWarning = value; NotifyPropertyChanged("Vis_UpgradeWarning"); }
        }

        private Visibility _Vis_UninstallPatch;
        public Visibility Vis_UninstallPatch
        {
            get { return _Vis_UninstallPatch; }
            set { _Vis_UninstallPatch = value; NotifyPropertyChanged("Vis_UninstallPatch"); }
        }

        private Visibility _Vis_DirtyBackupFriendsJs;
        public Visibility Vis_DirtyBackupFriendsJs
        {
            get { return _Vis_DirtyBackupFriendsJs; }
            set { _Vis_DirtyBackupFriendsJs = value; NotifyPropertyChanged("Vis_DirtyBackupFriendsJs"); }
        }

        //
        // Memory (live)
        //

        public bool EnableInstallPatchButton
        {
            get
            {
                return (
                    (PatcherState.SteamState != null && (
                        !PatcherState.SteamState.IsSteamRunning
                     && PatcherState.SteamState.ClientUiDirExists
                     && (PatcherState.SteamState.SteamclientDllVersionStatus == SteamClientVersionStatus.Compatible || PatcherState.SteamState.SteamclientDllVersionStatus == SteamClientVersionStatus.Unknown)
                    ))
                    && (!PatchInstallState.AnyOperationInProgress)
                );
            }
        }

        public bool EnableUninstallPatchButton
        {
            get
            {
                return (
                    (PatcherState.SteamState != null && (
                        !PatcherState.SteamState.IsSteamRunning
                     && PatcherState.SteamState.ClientUiDirExists
                     && PatcherState.SteamState.ClientUiFriendsJsBackupExists
                    ))
                    && (!PatchInstallState.AnyOperationInProgress)
                );
            }
        }

        public Visibility Vis_SteamIsRunningWarning
        {
            get
            {
                if (   (PatcherState.SteamState != null && PatcherState.SteamState.IsSteamRunning)
                    && (!PatchInstallState.AnyOperationInProgress))
                    return Visibility.Visible;
                else
                    return Visibility.Collapsed;
            }
        }

        private void NotifyLiveStatePropertiesChanged()
        {
            NotifyPropertyChanged("EnableInstallPatchButton");
            NotifyPropertyChanged("EnableUninstallPatchButton");
            NotifyPropertyChanged("Vis_SteamIsRunningWarning");
        }

        private void PatcherState_SteamStateLiveRefresh(object sender, EventArgs e)
        {
            NotifyLiveStatePropertiesChanged();
        }
        
        private void PatcherState_SteamStateIsSteamRunningChanged(object sender, EventArgs e)
        {
            if (PatcherState.SteamState.IsSteamRunning && PatchInstallState.AnyOperationInProgress)
            {
                Application.Current.Dispatcher.Invoke(() =>
                {
                    string op = "operation";
                    if (PatchInstallState.InstallInProgress) op = "install";
                    else if (PatchInstallState.InstallInProgress) op = "uninstall";

                    PatchInstallState.InstallLog.LogItem("[!!!] Steam was launched during patch " + op + " [!!!]");
                    PatchInstallState.InstallLog.LogItem("Patch " + op + " may fail if Steam locks the paths we are using!");
                });
            }
        }



        private void PresentSteamStateDefaults(bool disk = true, bool live = true)
        {
            if (disk)
            {
                Vis_InvalidSteamRootDirPath = Visibility.Collapsed;

                Vis_MissingClientUiDir = Visibility.Collapsed;

                Vis_MissingFriendsJs = Visibility.Collapsed;

                Vis_SteamClientVersionMismatch = Visibility.Collapsed;

                Vis_SteamStatus = Visibility.Collapsed;

                Vis_UnknownFriendsJs = Visibility.Collapsed;
                FriendsJsReadErrorDetails = null;

                Vis_StockFriendsJs = Visibility.Collapsed;

                Vis_ModifiedFriendsJs = Visibility.Collapsed;
                Vis_ModifiedFriendsJs_WithMetadata = Visibility.Collapsed;
                Vis_ModifiedFriendsJs_WithoutMetadata = Visibility.Collapsed;

                Vis_UninstallPatch = Visibility.Collapsed;
                Vis_DirtyBackupFriendsJs = Visibility.Collapsed;
            }

            if (live)
            {

            }
        }

        private void PresentInstallVersionComboNotices()
        {
            Vis_DowngradeWarning = Visibility.Collapsed;
            Vis_NogradeWarning = Visibility.Collapsed;
            Vis_UpgradeWarning = Visibility.Collapsed;

            if (PatchToInstallMetadata != null)
            {
                if (PatcherState.SteamState.ClientUiFriendsJsExists)
                {
                    ClientUiFriendsJsState friendsJsState = PatcherState.SteamState.ClientUiFriendsJsState;

                    if (friendsJsState.PatchStatus == ClientUiFriendsJsPatchStatus.AnyPatchInstalled)
                    {
                        if (PatchToInstallMetadata.Level0.Version < friendsJsState.PatchMetadata.Level0.Version)
                            Vis_DowngradeWarning = Visibility.Visible;
                        else if (PatchToInstallMetadata.Level0.Version == friendsJsState.PatchMetadata.Level0.Version)
                            Vis_NogradeWarning = Visibility.Visible;
                        else if (PatchToInstallMetadata.Level0.Version > friendsJsState.PatchMetadata.Level0.Version)
                            Vis_UpgradeWarning = Visibility.Visible;
                    }
                }
            }
        }

        private void PresentSteamState(bool disk = true, bool live = true)
        {
            SteamState steamState = PatcherState.SteamState;

            PresentSteamStateDefaults(disk, live);

            if (disk)
            {
                //
                // Required things
                //

                // Valid steam location path
                if (!steamState.SteamRootDirPathIsValid)
                {
                    Vis_InvalidSteamRootDirPath = Visibility.Visible;
                    return;
                }
                
                // clientui exists
                if (!steamState.ClientUiDirExists)
                {
                    Vis_MissingClientUiDir = Visibility.Visible;
                    return;
                }
                
                // compatible steamclient.dll version
                if (steamState.SteamclientDllVersionStatus == SteamClientVersionStatus.TooOld || steamState.SteamclientDllVersionStatus == SteamClientVersionStatus.TooNew)
                {
                    Vis_SteamClientVersionMismatch = Visibility.Visible;
                    return;
                }

                
                // All requirements passed; steam status will be displayed and install button will be enabled

                Vis_SteamStatus = Visibility.Visible;


                //
                // friends.js exists
                //
                if (!steamState.ClientUiFriendsJsExists)
                {
                    Vis_MissingFriendsJs = Visibility.Visible;
                    // Non-fatal, we will allow installation but obviously wont be able to back up existing friends.js since it doesn't exist
                }
                
                //
                // Unknown friends.js state
                //

                ClientUiFriendsJsState friendsJsState = steamState.ClientUiFriendsJsState;

                if (friendsJsState.PatchStatus == ClientUiFriendsJsPatchStatus.Unknown)
                {
                    Vis_UnknownFriendsJs = Visibility.Visible;
                    if (friendsJsState.FileReadError != null)
                        FriendsJsReadErrorDetails = friendsJsState.FileReadError.ToString();
                }

                //
                // friends.js does *not* have one of our modifications
                //

                else if (friendsJsState.PatchStatus == ClientUiFriendsJsPatchStatus.ProbablyStock)
                {
                    Vis_StockFriendsJs = Visibility.Visible;
                }

                //
                // friends.js has one of our modifications
                //

                else if (friendsJsState.PatchStatus == ClientUiFriendsJsPatchStatus.AnyPatchInstalled)
                {
                    Vis_ModifiedFriendsJs = Visibility.Visible;
                    if (steamState.InstalledPatchMetadata == null)
                    {
                        Vis_ModifiedFriendsJs_WithoutMetadata = Visibility.Visible;
                    }
                    else
                    {
                        Vis_ModifiedFriendsJs_WithMetadata = Visibility.Visible;
                    }
                    
                    //
                    // Back up of friends.js
                    //

                    if (steamState.ClientUiFriendsJsBackupExists)
                    {
                        Vis_UninstallPatch = Visibility.Visible;
                        if (steamState.ClientUiFriendsJsBackupIsDirty)
                            Vis_DirtyBackupFriendsJs = Visibility.Visible;
                    }
                }
            }

            if (live)
            {

            }
        }


        // ----------------------------------------------------------------------
        //   Install progress
        // ----------------------------------------------------------------------

        private void PresentBeforeInstallingPatch()
        {
            InstallProgressGroupBox.Visibility = Visibility.Collapsed;

            PatchInstallProgressBar.Value = 0;

            PatchInstallSuccessNotice.Visibility = Visibility.Collapsed;
            PatchInstallErrorNotice.Visibility = Visibility.Collapsed;
        }

        private void PresentInstallingPatch()
        {
            InstallProgressGroupBox.Visibility = Visibility.Visible;
            UninstallProgressGroupBox.Visibility = Visibility.Collapsed;
            
            PatchInstallProgressBar.Value = 0;

            PatchInstallSuccessNotice.Visibility = Visibility.Collapsed;
            PatchInstallErrorNotice.Visibility = Visibility.Collapsed;
        }

        private void PatchInstallState_InstallProgress(object sender, PatchInstallState.InstallProgressEventArgs e)
        {
            PatchInstallProgressBar.Value = e.Current;
            PatchInstallProgressBar.Maximum = e.Total;
        }

        private void PresentAfterInstallingPatch()
        {
            InstallProgressGroupBox.Visibility = Visibility.Visible;
            
            if (PatchInstallState.LastInstallResult == 0)
                PatchInstallSuccessNotice.Visibility = Visibility.Visible;
            else
                PatchInstallErrorNotice.Visibility = Visibility.Visible;
        }


        // ----------------------------------------------------------------------
        //   Uninstall progress
        // ----------------------------------------------------------------------

        private void PresentBeforeUninstallingPatch()
        {
            UninstallProgressGroupBox.Visibility = Visibility.Collapsed;
            
            PatchUninstallSuccessNotice.Visibility = Visibility.Collapsed;
            PatchUninstallErrorNotice.Visibility = Visibility.Collapsed;
        }

        private void PresentUninstallingPatch()
        {
            InstallProgressGroupBox.Visibility = Visibility.Collapsed;
            UninstallProgressGroupBox.Visibility = Visibility.Visible;
            
            PatchUninstallSuccessNotice.Visibility = Visibility.Collapsed;
            PatchUninstallErrorNotice.Visibility = Visibility.Collapsed;
        }
        
        private void PresentAfterUninstallingPatch()
        {
            UninstallProgressGroupBox.Visibility = Visibility.Visible;

            if (PatchInstallState.LastUninstallResult == 0)
                PatchUninstallSuccessNotice.Visibility = Visibility.Visible;
            else
                PatchUninstallErrorNotice.Visibility = Visibility.Visible;
        }


        // ____________________________________________________________________________________________________
        // 
        //     User interaction logic
        // ____________________________________________________________________________________________________
        //

        // ----------------------------------------------------------------------
        //   Steam location textfield
        // ----------------------------------------------------------------------

        private Timer SteamLocationTextChangedTimer;
        private string SteamLocationTextChangedLastText = "";
        private int SteamLocationTextChangedTimerSkipCount = 0;
        private const int SteamLocationTextChangedTimerUpdateInterval = 300; // milliseconds

        private void SteamLocationPath_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (SteamLocationTextChangedTimer != null)
            {
                // Evaluating a new SteamState every time just 1 character in the textfield changes is silly
                // Instead, we wait a small period of time after each change to the textfield, then evaluate a new SteamState at the end of the period
                // As the user types, the evaluation period delay keeps getting reset until they eventually stop typing
                SteamLocationTextChangedTimerSkipCount = 0;
                SteamLocationTextChangedTimer.Change(SteamLocationTextChangedTimerUpdateInterval, SteamLocationTextChangedTimerUpdateInterval);
            }
            else
            {
                OnSteamLocationPathChanged(SteamLocationPath.Text);
            }
        }

        private void OnSteamLocationPathChanged(string newValue)
        {
            PatcherState.SteamRootDirPath = newValue;
        }

        private void SteamLocationTextChangedTimer_Init()
        {
            SteamLocationTextChangedTimer = new Timer(SteamLocationTextChangedTimer_OnFire, null, Timeout.Infinite, SteamLocationTextChangedTimerUpdateInterval);
            SteamLocationTextChangedLastText = "";
            SteamLocationTextChangedTimerSkipCount = 0;
        }
        
        private void SteamLocationTextChangedTimer_Dispose()
        {
            SteamLocationTextChangedTimer.Change(Timeout.Infinite, SteamLocationTextChangedTimerUpdateInterval); // "stop" the timer by setting it to an inifinite interval
            SteamLocationTextChangedTimer.Dispose();
            SteamLocationTextChangedTimer = null;
        }
        
        private void SteamLocationTextChangedTimer_OnFire(object state)
        {
            try
            {
                Application.Current.Dispatcher.Invoke(() =>
                {
                    string path = SteamLocationPath.Text;
                    if (path != SteamLocationTextChangedLastText)
                    {
                        OnSteamLocationPathChanged(path);
                    }
                    else
                    {
                        SteamLocationTextChangedTimerSkipCount++;
                        if (SteamLocationTextChangedTimerSkipCount > 1)
                            SteamLocationTextChangedTimer.Change(Timeout.Infinite, SteamLocationTextChangedTimerUpdateInterval); // Turn off timer by setting delay to Timeout.Infinite    
                    }
                    
                    SteamLocationTextChangedLastText = path;
                });
            }
            catch (Exception e) { }
        }


        // ----------------------------------------------------------------------
        //   Steam location browse button
        // ----------------------------------------------------------------------

        private void OnSteamLocationBrowseClick(object sender, RoutedEventArgs e)
        {
            var folderBrowserDialog = new VistaFolderBrowserDialog();
            folderBrowserDialog.ShowNewFolderButton = false;
            folderBrowserDialog.Description = "Select the root Steam program files folder";
            folderBrowserDialog.UseDescriptionForTitle = true;

            // Default initial selected path
            string regSteamPath = Helpers.GetSteamPathRegValue();
            if (Directory.Exists(regSteamPath))
                folderBrowserDialog.SelectedPath = regSteamPath;
            else
                folderBrowserDialog.SelectedPath = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);

            // User-specified path
            if (Directory.Exists(SteamLocationPath.Text))
                folderBrowserDialog.SelectedPath = SteamLocationPath.Text;

            bool? result = folderBrowserDialog.ShowDialog();
            if (result == true)
            {
                string path = folderBrowserDialog.SelectedPath;

                /*if (path.ToLower().EndsWith("steam.exe")) // If the user picked Steam.exe instead of the Steam folder, resolve that back to the Steam folder
                {
                    FileInfo fi = new FileInfo(path);
                    path = fi.DirectoryName;
                }*/

                SteamLocationPath.Text = path;
            }

        }


        // ----------------------------------------------------------------------
        //   Install patch
        // ----------------------------------------------------------------------

        private void ShowSteamGuide(object sender, RequestNavigateEventArgs e)
        {
            Process.Start((sender as Hyperlink).NavigateUri.ToString());
        }

        private void SteamGuideLinkToClipboard(object sender, RoutedEventArgs e)
        {
            Clipboard.SetText(SteamGuideHyperlink.NavigateUri.ToString());
        }

        private string RunningSteamProcsStringListForMessageBox(SteamState steamState)
        {
            List<string> procs = new List<string>();
            foreach (Tuple<int, string> processInfo in steamState.RunningSteamProcessesInfo)
                procs.Add("- PID " + processInfo.Item1 + ": " + processInfo.Item2);

            return "Running Steam processes:\n" + string.Join("\n", procs);
        }
        
        private void ShowMessageBoxRunningSteamProcesses(object sender, RequestNavigateEventArgs e)
        {
            MessageBox.Show(RunningSteamProcsStringListForMessageBox(PatcherState.SteamState),
                "Processes",
                MessageBoxButton.OK,
                MessageBoxImage.Information
            );
        }

        private async void OnInstallPatchButtonClick(object sender, RoutedEventArgs e)
        {
            if (PatchInstallState.AnyOperationInProgress)
            {
                if (PatchInstallState.InstallInProgress)
                    MessageBox.Show("Patch install is already in progress", "Notice", MessageBoxButton.OK, MessageBoxImage.Information);
                else if (PatchInstallState.UninstallInProgress)
                    MessageBox.Show("Patch uninstall is currently in progress. Only one patch operation can run at a time.", "Notice", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }
            
            //
            // Install patch
            //

            PresentInstallingPatch();
            PatchInstallState.InstallProgress += PatchInstallState_InstallProgress;

            PatcherState.SteamState.SuspendAutoRefresh();

            await PatchInstallState.InstallPatchAsync(PatcherState.SteamRootDirPath, PatcherState.PatchPayloadToInstall);
            
            PatchInstallState.InstallProgress -= PatchInstallState_InstallProgress;
            PresentAfterInstallingPatch();
            
            //
            // Re-eval steam state
            //

            SteamState steamState = PatcherState.NewSteamState();

            //
            // Specific handling of some returne error codes
            //

            // Patch failed b/c steam is running modal notice
            if (PatchInstallState.LastInstallResult == PatchInstaller.Result_SteamRunning)
            {
                MessageBox.Show("Patch cannot be installed while Steam is running. Close Steam before attempting to install the patch."
                        + "\n\n" + RunningSteamProcsStringListForMessageBox(steamState),
                    "Steam is running",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error
                );
            }
        }


        // ----------------------------------------------------------------------
        //   Uninstall patch
        // ----------------------------------------------------------------------

        private void ShowForcedSteamClientUpdateTip(object sender, RequestNavigateEventArgs e)
        {
            var w = new ForcedSteamClientUpdateTip();
            w.ShowDialog();
        }

        private async void OnUninstallPatchButtonClick(object sender, RoutedEventArgs e)
        {
            if (PatchInstallState.AnyOperationInProgress)
            {
                if (PatchInstallState.InstallInProgress)
                    MessageBox.Show("Patch install is currently in progress. Only one patch operation can run at a time.", "Notice", MessageBoxButton.OK, MessageBoxImage.Information);
                else if (PatchInstallState.UninstallInProgress)
                    MessageBox.Show("Patch uninstall is already in progress", "Notice", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            //
            // Uninstall patch
            //

            PresentUninstallingPatch();

            PatcherState.SteamState.SuspendAutoRefresh();

            await PatchInstallState.UninstallPatchAsync(PatcherState.SteamRootDirPath);
            
            PresentAfterUninstallingPatch();

            //
            // Re-eval steam state
            //

            SteamState steamState = PatcherState.NewSteamState();

            //
            // Specific handling of some returne error codes
            //

            // Patch op failed b/c steam is running modal notice
            if (PatchInstallState.LastInstallResult == PatchInstaller.Result_SteamRunning)
            {
                MessageBox.Show("Patch cannot be uninstalled while Steam is running. Close Steam before attempting to uninstall the patch."
                        + "\n\n" + RunningSteamProcsStringListForMessageBox(steamState),
                    "Steam is running",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error
                );
            }
        }

    }
}
