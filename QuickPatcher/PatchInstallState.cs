using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.Infra;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher
{
    public class PatchInstallState : PropertyChangedNotifier
    {
        public PatchInstallState()
        {
            InstallLog = new PatchInstallLog();
            InstallLog.PropertyChanged += (s, e) => OnPropertyChanged("InstallLog");

            UninstallLog = new PatchInstallLog();
            UninstallLog.PropertyChanged += (s, e) => OnPropertyChanged("UninstallLog ");
        }

        public bool AnyOperationInProgress
        {
            get
            {
                return InstallInProgress || UninstallInProgress;
            }
        }


        // ____________________________________________________________________________________________________
        // 
        //     Install
        // ____________________________________________________________________________________________________
        //

        public PatchInstallLog InstallLog { get; private set; }

        public bool _InstallInProgress;
        public bool InstallInProgress
        {
            get { return _InstallInProgress; }
            set { if (SetProperty(ref _InstallInProgress, value)) OnPropertyChanged("AnyOperationInProgress"); }
        }

        public int _LastInstallResult;
        public int LastInstallResult
        {
            get { return _LastInstallResult; }
            set { SetProperty(ref _LastInstallResult, value); }
        }


        public event EventHandler<InstallProgressEventArgs> InstallProgress;
        public class InstallProgressEventArgs : EventArgs
        {
            public int Current { get; private set; }
            public int Total { get; private set; }
            public InstallProgressEventArgs(int current, int total)
            {
                Current = current;
                Total = total;
            }
        }
        public void NotifyInstallProgress(int current, int total)
        {
            InstallProgress?.Invoke(this, new InstallProgressEventArgs(current, total));
        }

        
        public async Task<int> InstallPatchAsync(string steamRootDirPath)
        {
            if (AnyOperationInProgress)
                throw new InvalidOperationException("A patch install or uninstall is already in progress. Only one patch install/uninstall can run at time.");

            InstallInProgress = true;

            if (InstallLog.LogItems.Count > 0)
            {
                InstallLog.LogItem(""); // space between this install and the next
                InstallLog.LogItem("");
            }
            
            InstallLog.LogItem("------------------------------");
            InstallLog.LogItem("Patch install started");

            await Task.Yield();

            SynchronizationContext uiContext = SynchronizationContext.Current;
            Exception asyncError = null;

            int resultCode = await Task.Run(() =>
            {
                try
                {
                    return PatchInstaller.InstallPatch(steamRootDirPath,
                        (m) => uiContext.Send(x => InstallLog.LogItem(m), null), // All patch install attempts write to the same log (our log)
                        (c, t) => uiContext.Send(x => NotifyInstallProgress(c, t), null)
                    );
                }
                catch (Exception e)
                {
                    uiContext.Send(x => asyncError = e, null);
                    return -1;
                }
            });

            LastInstallResult = resultCode;

            Debug.WriteLine("Patch install result code: " + resultCode);


            if (resultCode == 0)
            {
                InstallLog.LogItem("Patch install complete");
            }
            else if (resultCode == -1)
            {
                InstallLog.LogItem("[!!!] An unhandled exception occurred during patch install [!!!]");
                InstallLog.LogItem("Details: " + asyncError);
            }
            else if (resultCode > 0)
            {
                InstallLog.LogItem("[!!!] Patch install failed [!!!]");
            }

            InstallInProgress = false;

            return resultCode;
        }



        // ____________________________________________________________________________________________________
        // 
        //     Uninstall
        // ____________________________________________________________________________________________________
        //

        public PatchInstallLog UninstallLog { get; private set; }

        public bool _UninstallInProgress;
        public bool UninstallInProgress
        {
            get { return _UninstallInProgress; }
            set { if (SetProperty(ref _UninstallInProgress, value)) OnPropertyChanged("AnyOperationInProgress"); }
        }

        public int _LastUninstallResult;
        public int LastUninstallResult
        {
            get { return _LastUninstallResult; }
            set { SetProperty(ref _LastUninstallResult, value); }
        }

        public async Task<int> UninstallPatchAsync(string steamRootDirPath)
        {
            if (AnyOperationInProgress)
                throw new InvalidOperationException("A patch install or uninstall is already in progress. Only one patch install/uninstall can run at time.");

            UninstallInProgress = true;

            if (UninstallLog.LogItems.Count > 0)
            {
                UninstallLog.LogItem("");
                UninstallLog.LogItem("");
            }

            UninstallLog.LogItem("------------------------------");
            UninstallLog.LogItem("Patch uninstall started");

            await Task.Yield();

            SynchronizationContext uiContext = SynchronizationContext.Current;
            Exception asyncError = null;

            int resultCode = await Task.Run(() =>
            {
                try
                {
                    return PatchInstaller.UninstallPatch(steamRootDirPath,
                        (m) => uiContext.Send(x => UninstallLog.LogItem(m), null)
                    );
                }
                catch (Exception e)
                {
                    uiContext.Send(x => asyncError = e, null);
                    return -1;
                }
            });

            LastUninstallResult = resultCode;

            Debug.WriteLine("Patch uninstall result code: " + resultCode);


            if (resultCode == 0)
            {
                UninstallLog.LogItem("Patch uninstall complete");
            }
            else if (resultCode == -1)
            {
                UninstallLog.LogItem("[!!!] An unhandled exception occurred during patch uninstall [!!!]");
                UninstallLog.LogItem("Details: " + asyncError);
            }
            else if (resultCode > 0)
            {
                UninstallLog.LogItem("[!!!] Patch uninstall failed [!!!]");
            }

            UninstallInProgress = false;

            return resultCode;
        }


    }
}
