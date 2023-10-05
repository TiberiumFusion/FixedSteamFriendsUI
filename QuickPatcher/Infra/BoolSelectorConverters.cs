using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Data;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.Infra
{
    public class BoolSelectorObjectConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo cultureInfo)
        {
            object[] choices = (object[])parameter;
            if ((bool)value == true)
                return choices[1];
            else
                return choices[0];
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo cultureInfo)
        {
            throw new NotImplementedException();
        }
    }

    public class BoolSelectorDoubleConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo cultureInfo)
        {
            double[] choices = (double[])parameter;
            if ((bool)value == true)
                return choices[1];
            else
                return choices[0];
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo cultureInfo)
        {
            throw new NotImplementedException();
        }
    }
}
