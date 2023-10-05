using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Data;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.Infra
{
    // https://stackoverflow.com/a/6561809
    [ValueConversion(typeof(string), typeof(ImageSource))]
    public class XamlDllIconGetter : IValueConverter
    {
        [DllImport("shell32.dll")]
        private static extern IntPtr ExtractIcon(IntPtr hInst, string lpszExeFileName, int nIconIndex);

        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            string[] fileName = ((string)parameter).Split('|');

            if (targetType != typeof(ImageSource))
                return Binding.DoNothing;

            IntPtr hIcon = ExtractIcon(Process.GetCurrentProcess().Handle, fileName[0], int.Parse(fileName[1]));

            ImageSource ret = Imaging.CreateBitmapSourceFromHIcon(hIcon, Int32Rect.Empty, BitmapSizeOptions.FromEmptyOptions());
            return ret;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
