using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.Infra
{
    // From: https://stackoverflow.com/questions/8932720/listview-inside-of-scrollviewer-prevents-scrollviewer-scroll/61092700#61092700
    public static class ScrollViewerHelper
    {
        // Attached property boilerplate
        public static bool GetFixMouseWheel(ScrollViewer scrollViewer) => (bool)scrollViewer?.GetValue(FixMouseWheelProperty);
        public static void SetFixMouseWheel(ScrollViewer scrollViewer, bool value) => scrollViewer?.SetValue(FixMouseWheelProperty, value);
        public static readonly DependencyProperty FixMouseWheelProperty =
            DependencyProperty.RegisterAttached("FixMouseWheel", typeof(bool), typeof(ScrollViewerHelper),
                new PropertyMetadata(OnFixMouseWheelChanged));
        // End attached property boilerplate

        static void OnFixMouseWheelChanged(DependencyObject d,
                                              DependencyPropertyChangedEventArgs e)
        {
            var scrollViewer = d as ScrollViewer;
            if (scrollViewer == null) return;

            scrollViewer.PreviewMouseWheel += (s2, e2) =>
            {
                var parent = scrollViewer.Parent as UIElement;
                bool hitTopOrBottom = HitTopOrBottom(e2.Delta, scrollViewer);
                if (parent == null || !hitTopOrBottom) return;

                var argsCopy = Copy(e2);
                parent.RaiseEvent(argsCopy);
            };
        }

        static bool HitTopOrBottom(double delta, ScrollViewer scrollViewer)
        {
            var contentVerticalOffset = scrollViewer.ContentVerticalOffset;

            var atTop = contentVerticalOffset == 0;
            var movedUp = delta > 0;
            var hitTop = atTop && movedUp;

            var atBottom =
                contentVerticalOffset == scrollViewer.ScrollableHeight;
            var movedDown = delta < 0;
            var hitBottom = atBottom && movedDown;

            return hitTop || hitBottom;
        }

        static MouseWheelEventArgs Copy(MouseWheelEventArgs e)
            => new MouseWheelEventArgs(e.MouseDevice, e.Timestamp, e.Delta)
            {
                RoutedEvent = UIElement.MouseWheelEvent,
                Source = e.Source,
            };
    }
}
