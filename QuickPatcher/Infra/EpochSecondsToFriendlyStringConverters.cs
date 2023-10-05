using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Data;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.Infra
{
    public class EpochSecondsToMMMMdyyyyConverter : IValueConverter
    {
        private static DateTime UnixEpoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            DateTime dt = UnixEpoch.AddSeconds((long)value);
            return dt.ToString("MMMM d, yyyy");
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }

    public class EpochSecondsToHHmmssConverter : IValueConverter
    {
        private static DateTime UnixEpoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            DateTime dt = UnixEpoch.AddSeconds((long)value);
            return dt.ToString("HH:mm:ss");
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
