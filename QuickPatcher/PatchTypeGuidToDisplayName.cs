using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Data;
using TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.StaticData;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher
{
    public class PatchTypeGuidToDisplayName : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            Guid guid;
            if (value is Guid)
                guid = (Guid)value;
            else if (value is string)
                guid = Guid.Parse((string)value);
            else
                throw new ArgumentException("Value is unsupported type '" + value.GetType() + "'", "value");

            return PatchTypes.GetPatchTypeInfo(guid).DisplayName;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
