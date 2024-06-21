// Entry points into various logic paths in Valve's bastardized js

(function ()
{
    
    let Hooks = {};
    TFP.Hooks = Hooks;


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
        // So instead we are hooking into the moment the webui_config json is loaded and rewriting the fields we need to change, such as the LANGUAGE field


        //
        // LANGUAGE
        //

        // We will set this per the user's choice of display language in their Steam client
        // This information is given to us by outer friends.js, which passes the value for LANGUAGE as a GET param to the inner iframe's url, which is read in in our config.js

        let lang = TFP.Config.ForwardDisplayLanguage;
        if (lang != "english") // i.e. if the user's client's display language does not match the value hardcoded in the snapshot ("english")
        {
            console.log("Switching from snapshot default display language 'english' to '" + lang + "' per the Steam client's decision");
            parsedJson.LANGUAGE = lang;
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

        // However, we may as well set this correctly, especially since WebChat.GetWebChatURL() includes a `cc` param which is set to a string like "US" which seems like exactly what goes in COUNTRY
        // Since the COUNTRY field in this baked-in-hypertext json is "US" in my snapshots, presumably there is a 1:1 mapping here between COUNTRY and Valve's country code string

        let cc = TFP.Config.ForwardCountryCode;
        if (cc != "US") // snapshot is captured in US so "US" is hardcoded into it
        {
            console.log("Switching from snapshot default country code 'US' to '" + cc + "' per the Steam client's decision");
            parsedJson.COUNTRY = cc;
        }


        //
        // Other fields
        //

        // There's a lot of fields in webui_config's json string
        // In native form it is nasty and hard to read due to all the XML escapes and lack of linebreaks, so here's a nicely formatted sample of the one from the 8601984 snapshot
        /*
            {
                "EUNIVERSE": 1,
                "WEB_UNIVERSE": "public",
                "LANGUAGE": "english",
                "COUNTRY": "US",
                "MEDIA_CDN_COMMUNITY_URL": "https:\/\/cdn.cloudflare.steamstatic.com\/steamcommunity\/public\/",
                "MEDIA_CDN_URL": "https:\/\/cdn.cloudflare.steamstatic.com\/",
                "COMMUNITY_CDN_URL": "https:\/\/community.cloudflare.steamstatic.com\/",
                "COMMUNITY_CDN_ASSET_URL": "https:\/\/cdn.cloudflare.steamstatic.com\/steamcommunity\/public\/assets\/",
                "STORE_CDN_URL": "https:\/\/store.cloudflare.steamstatic.com\/",
                "PUBLIC_SHARED_URL": "https:\/\/community.cloudflare.steamstatic.com\/public\/shared\/",
                "COMMUNITY_BASE_URL": "https:\/\/steamcommunity.com\/",
                "CHAT_BASE_URL": "https:\/\/steam-chat.com\/",
                "STORE_BASE_URL": "https:\/\/store.steampowered.com\/",
                "STORE_CHECKOUT_BASE_URL": "https:\/\/checkout.steampowered.com\/",
                "IMG_URL": "https:\/\/community.cloudflare.steamstatic.com\/public\/images\/",
                "STEAMTV_BASE_URL": "https:\/\/steam.tv\/",
                "HELP_BASE_URL": "https:\/\/help.steampowered.com\/",
                "PARTNER_BASE_URL": "https:\/\/partner.steamgames.com\/",
                "STATS_BASE_URL": "https:\/\/partner.steampowered.com\/",
                "INTERNAL_STATS_BASE_URL": "https:\/\/steamstats.valve.org\/",
                "IN_CLIENT": true,
                "USE_POPUPS": true,
                "STORE_ICON_BASE_URL": "https:\/\/cdn.cloudflare.steamstatic.com\/steam\/apps\/",
                "WEBAPI_BASE_URL": "https:\/\/api.steampowered.com\/",
                "TOKEN_URL": "https:\/\/steam-chat.com\/chat\/clientjstoken",
                "BUILD_TIMESTAMP": 1703193195,
                "PAGE_TIMESTAMP": 1703279325,
                "IN_TENFOOT": false,
                "IN_GAMEPADUI": false,
                "IN_CHROMEOS": false,
                "IN_MOBILE_WEBVIEW": false,
                "PLATFORM": "unknown",
                "BASE_URL_STORE_CDN_ASSETS": "https:\/\/cdn.cloudflare.steamstatic.com\/store\/",
                "EREALM": 1,
                "LOGIN_BASE_URL": "https:\/\/login.steampowered.com\/",
                "AVATAR_BASE_URL": "https:\/\/avatars.cloudflare.steamstatic.com\/",
                "FROM_WEB": true,
                "WEBSITE_ID": "Community",
                "BASE_URL_SHARED_CDN": "https:\/\/shared.cloudflare.steamstatic.com\/",
                "CLAN_CDN_ASSET_URL": "https:\/\/clan.cloudflare.steamstatic.com\/",
                "SNR": "2_chat_clientui_"
            }
         */
        // And here's a more authentic sample, from a circa 2023-06-05 version of the root html document, retrieved by the Steam client itself, in period, as designed, recovered from the client's CEF http cache
        /*
            {
                "EUNIVERSE": 1,
                "WEB_UNIVERSE": "public",
                "LANGUAGE": "english",
                "COUNTRY": "US",
                "MEDIA_CDN_COMMUNITY_URL": "https:\/\/cdn.cloudflare.steamstatic.com\/steamcommunity\/public\/",
                "MEDIA_CDN_URL": "https:\/\/cdn.cloudflare.steamstatic.com\/",
                "COMMUNITY_CDN_URL": "https:\/\/community.cloudflare.steamstatic.com\/",
                "COMMUNITY_CDN_ASSET_URL": "https:\/\/cdn.cloudflare.steamstatic.com\/steamcommunity\/public\/assets\/",
                "STORE_CDN_URL": "https:\/\/store.cloudflare.steamstatic.com\/",
                "PUBLIC_SHARED_URL": "https:\/\/community.cloudflare.steamstatic.com\/public\/shared\/",
                "COMMUNITY_BASE_URL": "https:\/\/steamcommunity.com\/",
                "CHAT_BASE_URL": "https:\/\/steam-chat.com\/",
                "STORE_BASE_URL": "https:\/\/store.steampowered.com\/",
                "STORE_CHECKOUT_BASE_URL": "https:\/\/store.steampowered.com\/",
                "IMG_URL": "https:\/\/community.cloudflare.steamstatic.com\/public\/images\/",
                "STEAMTV_BASE_URL": "https:\/\/steam.tv\/",
                "HELP_BASE_URL": "https:\/\/help.steampowered.com\/",
                "PARTNER_BASE_URL": "https:\/\/partner.steamgames.com\/",
                "STATS_BASE_URL": "https:\/\/partner.steampowered.com\/",
                "INTERNAL_STATS_BASE_URL": "https:\/\/steamstats.valve.org\/",
                "IN_CLIENT": true,
                "USE_POPUPS": true,
                "STORE_ICON_BASE_URL": "https:\/\/cdn.cloudflare.steamstatic.com\/steam\/apps\/",
                "WEBAPI_BASE_URL": "https:\/\/api.steampowered.com\/",
                "TOKEN_URL": "https:\/\/steam-chat.com\/chat\/clientjstoken",
                "BUILD_TIMESTAMP": 1685979070,
                "PAGE_TIMESTAMP": 1685992982,
                "IN_TENFOOT": false,
                "IN_GAMEPADUI": false,
                "IN_CHROMEOS": false,
                "IN_MOBILE_WEBVIEW": false,
                "PLATFORM": "windows",
                "BASE_URL_STORE_CDN_ASSETS": "https:\/\/cdn.cloudflare.steamstatic.com\/store\/",
                "EREALM": 1,
                "LOGIN_BASE_URL": "https:\/\/login.steampowered.com\/",
                "AVATAR_BASE_URL": "https:\/\/avatars.cloudflare.steamstatic.com\/",
                "FROM_WEB": true,
                "WEBSITE_ID": "Community",
                "BASE_URL_SHARED_CDN": "https:\/\/shared.cloudflare.steamstatic.com\/",
                "CLAN_CDN_ASSET_URL": "https:\/\/clan.cloudflare.steamstatic.com\/",
                "SNR": "2_chat_clientui_"
            }
        */
        // There are very few differences, only: STORE_CHECKOUT_BASE_URL, BUILD_TIMESTAMP, PAGE_TIMESTAMP, and PLATFORM.
        // The lack of change in important-sounding fields (like IN_CLIENT = true in both cases), and the according lack of behavior change in the snapshot versus "authentic" steam-chat.com, is notable.

        // Presumably, all of these fields are assigned by Valve's unknown PHP code that generates the https://steam-chat.com/chat/clientui/index.html file
        // And thus, presumably, all are tailored to the conditions of the web browser which made the request to that URL
        // Since the snapshots are captured by me in the US, there may be discrepancies between the values seen above and what someone in a different country would get
        // However, I have not received any reports of weird issues that happen only to non-US users, so evidently these US-generated values are good and work in other notable countries where users are using this patch
        // So it seems they are safe to leave as is for now, though this may change in the future if more research is conducted on how the steam-chat.com service works
    }

    
})();
