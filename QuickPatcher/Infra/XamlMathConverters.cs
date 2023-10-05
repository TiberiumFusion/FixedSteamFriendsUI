using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Data;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.Infra
{
    public class XamlMathMinDoubleMultiConverter : IMultiValueConverter
    {
        public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
        {
            double[] dValues = new double[values.Length];

            for (int i = 0; i < dValues.Length; i++)
                dValues[i] = System.Convert.ToDouble(values[i]);
            
            return dValues.Min();
        }

        public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
    
    public class XamlMathMaxDoubleMultiConverter : IMultiValueConverter
    {
        public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
        {
            double[] dValues = new double[values.Length];

            for (int i = 0; i < dValues.Length; i++)
                dValues[i] = System.Convert.ToDouble(values[i]);

            return dValues.Max();
        }

        public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
    
    public class XamlMathMax2ClampDoubleMultiConverter : IMultiValueConverter
    {
        public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
        {
            double[] dValuesMax = new double[values.Length - 1];
            
            for (int i = 0; i < dValuesMax.Length - 1; i++)
                dValuesMax[i] = System.Convert.ToDouble(values[i]);

            double max = dValuesMax.Max();
            double clampMax = System.Convert.ToDouble(values[values.Length - 1]);
            
            return Math.Min(max, clampMax);
        }

        public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
