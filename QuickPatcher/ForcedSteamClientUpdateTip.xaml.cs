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
using System.Windows.Shapes;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher
{
    /// <summary>
    /// Interaction logic for ForcedSteamClientUpdateTip.xaml
    /// </summary>
    public partial class ForcedSteamClientUpdateTip : Window
    {
        public ForcedSteamClientUpdateTip()
        {
            InitializeComponent();
        }


        private void OpenLightwoGuide(object sender, System.Windows.Navigation.RequestNavigateEventArgs e)
        {
            Process.Start(e.Uri.ToString());
        }
        
        private void CopyLightwoGuideLinkToClipboard(object sender, RoutedEventArgs e)
        {
            Clipboard.SetText(HyperlinkLightwoGuide.NavigateUri.ToString());
        }
    }
}
