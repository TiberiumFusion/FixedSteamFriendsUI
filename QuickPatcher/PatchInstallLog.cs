using System;
using System.Collections;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Data;
using TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.Infra;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher
{
    public class PatchInstallLogItem : IComparable, IComparer
    {
        private static long NextTimeNonce = 0;

        public DateTime Time { get; private set; }
        public long TimeNonce { get; private set; } // For preserving insertion order when Times are equivalent between items
        public string Message { get; private set; }

        public PatchInstallLogItem(DateTime time, string message)
        {
            Time = time;
            Message = message;

            TimeNonce = NextTimeNonce++;
        }

        public int CompareTo(object other)
        {
            return Compare(this, other);
        }

        public int Compare(object x, object y)
        {
            var a = (PatchInstallLogItem)x;
            var b = (PatchInstallLogItem)y;

            if (a.Time == b.Time)
                return a.TimeNonce.CompareTo(b.TimeNonce);
            else
                return a.Time.CompareTo(b.Time);
        }
    }

    public class PatchInstallLog : PropertyChangedNotifier
    {
        public ObservableCollection<PatchInstallLogItem> LogItems { get; private set; }
        
        public event EventHandler<LogItemAddedEventArgs> LogItemAdded;
        public class LogItemAddedEventArgs : EventArgs
        {
            public PatchInstallLogItem LogItem { get; private set; }
            public LogItemAddedEventArgs(PatchInstallLogItem logItem)
            {
                LogItem = logItem;
            }
        }
        public void NotifyLogItemAdded(PatchInstallLogItem logItem)
        {
            LogItemAdded?.Invoke(this, new LogItemAddedEventArgs(logItem));
        }


        public PatchInstallLog()
        {
            LogItems = new ObservableCollection<PatchInstallLogItem>();
            LogItems.CollectionChanged += (s, e) => OnPropertyChanged("LogItems");
        }


        public void LogItem(string message)
        {
            var item = new PatchInstallLogItem(DateTime.Now, message);
            LogItems.Add(item);
            NotifyLogItemAdded(item);
        }
        public void LogItem(DateTime time, string message)
        {
            var item = new PatchInstallLogItem(time, message);
            LogItems.Add(item);
            NotifyLogItemAdded(item);
        }

        public void Clear()
        {
            LogItems.Clear();
        }


        public string Serialize()
        {
            var orderedItems = LogItems.ToList();
            orderedItems.Sort();

            StringBuilder sb = new StringBuilder();
            foreach (PatchInstallLogItem item in orderedItems)
                sb.Append(item.Time.ToString() + " :: " + item.Message + "\r\n");

            return sb.ToString();
        }
    }
}
