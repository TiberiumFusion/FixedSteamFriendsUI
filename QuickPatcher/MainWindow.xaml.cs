using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
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
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();

            this.Loaded += MainWindow_Loaded;
            this.Closing += MainWindow_Closing;
        }

        private void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            //
            // Initial default values for the Patcher
            //
            
            Patcher.SteamLocationPath.Text = Helpers.GetSteamPathRegValue();
        }

        private void MainWindow_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            if (Patcher.PatchInstallState.AnyOperationInProgress)
            {
                e.Cancel = true;

                string op1 = "operation";
                string op2 = "operation";
                if (Patcher.PatchInstallState.InstallInProgress)
                {
                    op1 = "install";
                    op2 = "installation";
                }
                else if (Patcher.PatchInstallState.UninstallInProgress)
                {
                    op1 = "uninstall";
                    op2 = "patch removal";
                }

                MessageBox.Show("Patch " + op1 + " currently in progress.\n\nTo avoid mangling your Steam client's files, please wait until the " + op2 + " completes before closing this application.", "Patch in progress", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

    }
}
