using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CefSharp;
using CefSharp.OffScreen;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.CefJsProvider
{
    public interface Api
    {
        string Name { get; }

        Task<JavascriptResponse> Bind(ChromiumWebBrowser cefBrowser);
    }
}
