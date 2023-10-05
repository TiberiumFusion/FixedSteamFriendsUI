using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Text;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.Infra
{
    /// <summary>
    /// Common MVVM glue for ViewModels and other event-driven objects
    /// </summary>
    public class PropertyChangedNotifier : INotifyPropertyChanged
    {
        /*
         * .NET 4.5's new CallerMemberName param attribute allows us to shrink the boilerplate needed to raise property changed events
         * See: https://www.danrigby.com/2012/04/01/inotifypropertychanged-the-net-4-5-way-revisited/
         
         * Using this class, instead of writing:
         
            class MyClass : INotifyPropertyChanged
            {
                public event PropertyChangedEventHandler PropertyChanged;
                private void NotifyPropertyChanged(string propName)
                {
                    PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propName));
                }

                private string _MyName;
                public string MyName
                {
                    get { return _MyName; }
                    set
                    {
                        if (value == _MyName)
                            return;
                        
                        _MyName = value;
                        NotifyPropertyChanged("MyName");
                    }
                }
            }


         * We can instead write a somwhat more consise version:

            class MyClass : PropertyChangedNotifier
            {
                private string _MyName;
                public string MyName
                {
                    get { return _MyName; }
                    set { SetProperty(ref _MyName, value); }
                }
            }

         * It's not the ideal auto-notifying auto properties proposal that was never accepted by Microsoft, but it's a little better.
        */


        // The code below is taken from a template in the v110 toolset. It is written by Microsoft for Microsoft solutions, but was not included in the baseline framework for whatever reason.


        /// <summary>
        ///     Multicast event for property change notifications.
        /// </summary>
        public event PropertyChangedEventHandler PropertyChanged;

        /// <summary>
        ///     Checks if a property already matches a desired value.  Sets the property and
        ///     notifies listeners only when necessary.
        /// </summary>
        /// <typeparam name="T">Type of the property.</typeparam>
        /// <param name="storage">Reference to a property with both getter and setter.</param>
        /// <param name="value">Desired value for the property.</param>
        /// <param name="propertyName">
        ///     Name of the property used to notify listeners.  This
        ///     value is optional and can be provided automatically when invoked from compilers that
        ///     support CallerMemberName.
        /// </param>
        /// <returns>
        ///     True if the value was changed, false if the existing value matched the
        ///     desired value.
        /// </returns>
        protected bool SetProperty<T>(ref T storage, T value, [CallerMemberName] string propertyName = null)
        {
            if (Equals(storage, value))
            {
                return false;
            }

            storage = value;
            this.OnPropertyChanged(propertyName);
            return true;
        }

        /// <summary>
        ///     Notifies listeners that a property value has changed.
        /// </summary>
        /// <param name="propertyName">
        ///     Name of the property used to notify listeners.  This
        ///     value is optional and can be provided automatically when invoked from compilers
        ///     that support <see cref="CallerMemberNameAttribute" />.
        /// </param>
        protected void OnPropertyChanged([CallerMemberName] string propertyName = null)
        {
            this.PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }

    }
}
