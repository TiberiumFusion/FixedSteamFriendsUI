using System;
using System.Collections.Generic;
using System.Text;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Snapshot
{
    public enum ResourceCategory
    {
        Any,
        Html, // So far the only HTML document we need is the index.html at the root url (https://steam-chat.com/chat/clientui)
        Js, // All javascript files
        JsonJs, // Valve's nasty js-wrapped json localized strings files
        Css, // All stylesheets
        CssFonts, // All fonts referenced in the css
        JsAudio, // All sound effects referenced in the js
        JsImages, // All images referenced in the js
    }
}
