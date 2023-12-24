// Shims, hooks, and switches for maintaining compatibility with things that Valve has abandoned

(function()
{

    let Compat = {};
    TFP.Compat = Compat;



    // ____________________________________________________________________________________________________
    //
    //     Browser.GetBrowserID()
    //
    //     > Needed by:
    //       - Dec 2022 steam client (1674790765, 7.72.78.29), possibly older ones, possibly newer ones up to (excluding) July 2023
    // ____________________________________________________________________________________________________
    //

    // In the Dec 2022 steam client, steamwebhelper injects a function binding with symbol name "Window.GetBrowserID"
    // In the May 2023 steam client, steamwebhelper injects a function binding with symbol name "Browser.GetBrowserID"
    // Both functions are used by steam-chat.com in the same way & for the same purposes, so presumably they are identical in all regards except for name, which Valve changed sometime between Dec 2022 and May 2023

    // The late July snapshot of steam-chat.com that I have exclusively uses Browser.GetBrowserID, with the expectation that it is *not* running on the Dec 2022 client
    // Evidently, when Valve changed the name of this symbol, they couldn't be fucked to maintain compatibility with older clients that used the original symbol name. It is possible that at some point between Dec 2022 and May 2023, steam-chat.com's JS had logic for selecting between trying Window.GetBrowserID and Browser.GetBrowserID. If so, that was removed prior to May 2023. I don't have any copies of steam-chat.com from that time range to verify and compare with.

    Compat.SteamClient_Browser_GetBrowserID = function(steamClient)
    {
        if ("Browser" in steamClient && "GetBrowserID" in steamClient.Browser)
        {
            return steamClient.Browser.GetBrowserID();
        }
        else if ("Window" in steamClient && "GetBrowserID" in steamClient.Window)
        {
            return steamClient.Window.GetBrowserID();
        }
        else
        {
            console.error("[!!!] Failed to find GetBrowserID [!!!]");
        }

        // We don't store or reassign the GetBrowserID() binding and have to re-eval it every time because:
        // 1. Browser is always injected into the steam-chat.com page before any scripts run, but Window is not, so Window.GetBrowserID doesn't exist yet. Other CEF frames (like sharedjscontext) get Window.* prior to script execution, but we (FriendsUI) do not.
        // 2. FriendsUI's SteamClient is not the only SteamClient in existence. Other steamwebhelper windows each have their own SteamClient, and for some reason Valve likes accessing other windows' SteamClients instead of making a proper way to communicate across frames. Multiple objects in Valve's JS store references to these other windows' SteamClients and call GetBrowserID() on them (where the Window.* interface does exist).
    }

    // Companion to the above. Returns true if either Browser.GetBrowserID() or Window.GetBrowserID() exists on the provided SteamClient.
    // For use replacing Valve code that wants to check if GetBrowserID exists and only does so on SteamClient.Browser (ignoring SteamClient.Window)
    Compat.SteamClient_HasGetBrowserID = function(steamClient)
    {
        return (
               ("Browser" in steamClient && "GetBrowserID" in steamClient.Browser)
            || ("Window" in steamClient && "GetBrowserID" in steamClient.Window)
        );
    }



    // ____________________________________________________________________________________________________
    //
    //     m_FriendsUIApp.SettingsStore.IsSteamInTournamentMode
    //     SteamClient.System.IsSteamInTournamentMode()
    //
    //     > Needed by:
    //       - All clients released May 2023 (1685488080, 8.9.11.89) or earlier
    //       - Possibly(?) June/July/August 2023 clients in vgui mode (untested)
    // ____________________________________________________________________________________________________
    //

    // This is the change which sparked this patch into existence
    // Concurrent with the June 2023 pure-cef/pure-shit downgrade of the Steam client, Valve introduced something called "Tournament Mode". The steam client injects an interface to this component into SharedJsContext.
    // Later, on Sept 21 2023, Valve downgraded steam-chat.com with code that assumes it is always running in SharedJsContext and thus has the tournament mode interface available. Valve also fucked up writing the code that uses the tournament mode interface, by calling it on the wrong objects where it does not exist, causing the fatal error that broke steam chat for all vgui-clients on that day.

    // The 1.x.x versions of this patch were based on a prior version of steam-chat.com (8200419, ca late July 2023), before steam-chat.com knew about tournament mode, and so they sidestepped the issue
    // Patch version 2.0.0 is based on steam-chat.com 8601984 (Dec 22 2022), where tournament mode exists and Valve tries to use it (incorrectly). So we have to introduce a shim for those calls to work around the issue.

    Compat.IsSteamInTournamentMode = function()
    {
        return false;

        // Afaik this "tournament mode" does not exist in the May 2023 and earlier clients, and it is never loaded in the June/July/August 2023 clients in vgui mode
        // So we are simply returning false here for now, but this could change if have to reconcile supporting more versions of the client for this patch
    }


    // ____________________________________________________________________________________________________
    //
    //     SteamClient.OpenVR.SetOverlayInteractionAffordance()
    //
    //     > Needed by:
    //       - All clients released May 2023 (1685488080, 8.9.11.89) or earlier
    //       - Possibly(?) June/July/August 2023 clients in vgui mode (untested)
    // ____________________________________________________________________________________________________
    //

    // First appeared in Valve javascript sometime between 2023-10-07 and 2023-12-22
    // Not present in the injected interface created by friendsui.dll in the May 2023 client. Unknown which client introduces this method.
    // Appears to be related to vr junk and has nothing to do with actual steam chat functionality, so shimming this with a nop is fine

    Compat.SteamClient_OpenVR_SetOverlayInteractionAffordance = function(steamClient, unknown1, unknown2)
    {
        if ("SetOverlayInteractionAffordance" in steamClient.OpenVR)
        {
            return steamClient.OpenVR.SetOverlayInteractionAffordance(unknown1, unknown2); // usage in valve javascript suggests this returns a bool
        }
        else
        {
            return false; // 50/50 chance we get this right
        }
    }


})();
