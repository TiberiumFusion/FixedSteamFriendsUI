using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
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
    /// Interaction logic for Log.xaml
    /// </summary>
    public partial class Log : UserControl
    {
        private PatchInstallLog _Log;

        public Log()
        {
            InitializeComponent();

            this.DataContextChanged += (s, e) =>
            {
                if (_Log != null)
                {
                    _Log.LogItemAdded -= Log_LogItemAdded;
                }
                
                if (DataContext != null)
                {
                    _Log = DataContext as PatchInstallLog;
                    _Log.LogItemAdded += Log_LogItemAdded;
                }
            };
        }

        //
        // Glue
        //

        private void ItemsControl_Loaded(object sender, RoutedEventArgs e)
        {
            // Make the log sort with its IComparer because there is no xaml binding for CustomSort setting it for whatever reason
            CollectionViewSource cvs = (CollectionViewSource)FindResource("SortedItemsSource");
            ListCollectionView lcv = cvs.View as ListCollectionView;
            lcv.CustomSort = new PatchInstallLogItem(DateTime.Now, "dummy");
        }

        private void Log_LogItemAdded(object sender, PatchInstallLog.LogItemAddedEventArgs e)
        {
            // Scroll log when items are added
            if (ScrollHost.VerticalOffset == ScrollHost.ScrollableHeight) // but only if it's already scrolled to the bottom
                ScrollHost.ScrollToBottom();
        }

        private void CopyLogToClipboard(object sender, RoutedEventArgs e)
        {
            if (_Log != null)
            {
                try
                {
                    Clipboard.SetText(_Log.Serialize());
                }
                catch (Exception e2)
                {
                    Debug.WriteLine("Unhandled exception while serializing log.");
                    Debug.WriteLine(e2);
                    Clipboard.SetText("An error occurred while serializing the log. Details:\n\n" + e2.ToString());
                }
            }
        }

        private void ClearLog(object sender, RoutedEventArgs e)
        {
            if (_Log != null)
                _Log.Clear();
        }

    }
}
