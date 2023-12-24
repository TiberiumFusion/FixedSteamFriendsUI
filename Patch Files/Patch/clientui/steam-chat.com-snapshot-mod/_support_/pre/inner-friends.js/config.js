// Configuration of the patch logic

(function ()
{
    
    let Config = {};
    TFP.Config = Config;


    // ____________________________________________________________________________________________________
    //
    //     Initialization
    // ____________________________________________________________________________________________________
    //

    // --------------------------------------------------
    //   Url vars passed to us by outer friends.js
    // --------------------------------------------------

    // The easiest way to get basic data from the outer frame to the inner frame is through GET params
    // We use this to forward the `l` (DisplayLanguage) and `cc` (CountryCode) GET params that the Steam client generated for WebChat.GetWebChatURL(), which configure steam-chat.com to work properly

    let UrlVars = new URLSearchParams(window.location.search);
    
    Config.ForwardDisplayLanguage = UrlVars.get("DisplayLanguage") ?? "english"; // english is a fallback; this matches static "LANGUAGE":"english" in json in webui_config in index.html in snapshot
        // When forwarded to webui_config, controls which -json.js files are loaded to provide culture-localized display strings
    
    Config.ForwardCountryCode = UrlVars.get("CountryCode") ?? "US"; // snapshot is captured in US, which means all baked-in cc literals are "US", so "US" is the best choice of fallback
        // When forwarded to webui_config, controls some minor behavior of steam-chat.com. See notes in TFP.Hooks.OnWebuiConfigLoaded().

    
})();
