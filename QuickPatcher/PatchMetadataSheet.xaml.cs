using System;
using System.Collections.Generic;
using System.ComponentModel;
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
    /// Interaction logic for PatchMetadataSheet.xaml
    /// </summary>
    public partial class PatchMetadataSheet : UserControl, INotifyPropertyChanged
    {

        public event PropertyChangedEventHandler PropertyChanged;
        public void NotifyPropertyChanged(string name)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
        }
        

        public static readonly DependencyProperty _PatchMetadata = DependencyProperty.Register("PatchMetadata", typeof(PatchMetadata), typeof(PatchMetadataSheet), new PropertyMetadata(default(PatchMetadata)));
        public PatchMetadata PatchMetadata
        {
            get { return (PatchMetadata)GetValue(_PatchMetadata); }
            set { SetValue(_PatchMetadata, value); NotifyPropertyChanged("PatchMetadata"); }
        }


        public PatchMetadataSheet()
        {
            InitializeComponent();
        }


        private object GetCellFromContextMenuClickEvent(object sender)
        {
            MenuItem m = (MenuItem)sender;
            ContextMenu c = (ContextMenu)m.Parent;
            return c.PlacementTarget;
        }

        private void CellContextMenu_CopyValue_Click(object sender, RoutedEventArgs e)
        {
            TextBlock t = (TextBlock)GetCellFromContextMenuClickEvent(sender);
            Clipboard.SetText(t.Text);
        }

        private void CellContextMenu_CopyRawValue_Click(object sender, RoutedEventArgs e)
        {
            TextBlock t = (TextBlock)GetCellFromContextMenuClickEvent(sender);
            object raw = t.Tag;
            if (raw != null)
                Clipboard.SetText(raw.ToString());
            else
                Clipboard.SetText(t.Text);
        }

        private void CellContextMenu_CopyEntireRawJson_Click(object sender, RoutedEventArgs e)
        {
            Clipboard.SetText(PatchMetadata.RAW);
        }
    }
}
