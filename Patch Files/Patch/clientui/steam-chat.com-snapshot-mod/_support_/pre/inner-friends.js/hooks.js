﻿// Entry points into various logic paths in Valve's bastardized js

(function ()
{
    
    let Hooks = {};
    TFP.Hooks = Hooks;


    // --------------------------------------------------
    //   Config
    // --------------------------------------------------
    
    let UrlVars = new URLSearchParams(window.location.search)

    var CultureStrings_DisplayLanguage = UrlVars.get("DisplayLanguage") ?? "english" // english is a fallback; this matches static "LANGUAGE":"english" in json in webui_config in index.html
        // Controls which -json.js files are loaded to provide culture-localized display strings
        // clientui\friends.js can get the client's chosen display language (but we cannot) and tells us about it through our url


    // ____________________________________________________________________________________________________
    //
    //     HTML 'webui_config' json data read
    // ____________________________________________________________________________________________________
    //

    // Called after the JSON string defined on <div id="webui_config" data-config="..."/> in index.html has been read, parsed, and assigned to .De
    // Param parsedJson is that object for us to modify
    Hooks.OnWebuiConfigLoaded = function(parsedJson)
    {
        // Normally, localization works in PWA friends like this:
        // 1. FriendsUI sets iframe src to blahblahblah?l=<LANGUAGE>
        // 2. Valve php serves index.html:
        //    - with GET param `l` propagated to all urls in the hypertext (like <script>'s)
        //    - with <div id="webui_config/>'s `data-config` attr set to a chunk of escaped json, which includes:
        //      - a LANGUAGE field
        //      - a COUNTRY field
        // 3. Inner friends.js parses this json and selects a json.js file to load per that LANGUAGE field

        // Thus, normally, controlling which language the PWA uses is baked in to the hypertext of the webpage itself

        // We do not have that luxury because of extremely strict cross-origin script priviledges (or lack thereof)
        // So instead we are hooking into the moment the webui_config json is loaded and rewriting the fields we need to change, such as LANGUAGE field


        //
        // LANGUAGE
        //

        // We will set this per the user's choice of display language in their Steam client
        // This information is given to us by outer friends.js, which passes the value for LANGUAGE as a GET param to the inner iframe's url

        if (CultureStrings_DisplayLanguage != "english") // i.e. if the user's client's display language does not match the value hardcoded in index.html ("english")
        {
            console.log("Switching from default display language 'english' to '" + CultureStrings_DisplayLanguage + "'");
            parsedJson.LANGUAGE = CultureStrings_DisplayLanguage;
        }


        //
        // COUNTRY
        //

        // Seems non-critical. Inner friends.js does reference this value and appears to use it for a few things, but none of these seem to prevent chat from working in a mismatched country
        // - Tracking & targeting the user's country when making HTTP requests to the web Steam API
        // - Tracking & targeting the user's country when they log in to steam services
        // - Blocking(?) game invites if the steam user is trying to hide their country from Valve
        // - Tracking & targeting the user's country when steam-chat navigates them to a game's store page
        // - Blocking services in some countries (e.g. blocking youtube in china)
        // - Tracking & targeting the user's country when steam-chat navigates them to a "steam curator"'s list of "curated" games

        // Since the snapshot was captured in the US, our index.html has COUNTRY set to US
        // Again, this appears to be a non-issue since there were never any reports of non US users of this patch experiencing specific issues that US users never experienced

        // However, if there is some way to get the correct COUNTRY value for the user's country and set that here, I'd like to make that happen. Research pending.

    }

    
})();