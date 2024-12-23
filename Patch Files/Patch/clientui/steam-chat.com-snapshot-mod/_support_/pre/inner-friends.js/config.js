// Configuration of the patch logic

(function ()
{
    
    let Config = {};
    TFP.Config = Config;


    // ____________________________________________________________________________________________________
    //
    //     Upstream config
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



    // ____________________________________________________________________________________________________
    //
    //     FixedSteamFriendsUI runtime root config
    // ____________________________________________________________________________________________________
    //

    // This is the same thing that is first loaded by the outer frame's friend.js
    // The process and interface we expose are much like the outer frame's and essentially copied directly from there

    //
    // Load & init the rootconfig component
    //

    console.log("----- BEGIN load FixedSteamFriendsUI rootconfig (inner) -----")

    let rootConfig = TFP.LoadJs("_support_/shared/rootconfig.js");
    Config.FsfuiRootConfig = rootConfig;

    rootConfig.Initialize(
	    "../", // Root path suffix (keep as window.location's root, which will be "https://steamloopback.host/")
	    rootConfig.GetDefaultLocationsForConfigFiles(TFP.Meta.StaticDataJson5.PatchMetadata) // List of config file paths to try loading from, specified in overwrite order
    );

    console.log("-----  END  load FixedSteamFriendsUI rootconfig (inner) -----")

    //
    // Access interface
    //

    Config.FsfuiRootConfigGetValueOrFallback = function(path, fallback=null)
    {
        // Catch-all within our scope for anything that can go wrong with accessing the root config component
        try
        {
            return this.FsfuiRootConfig.GetConfigProperty(path, throwIfUndefined=true, rethrowExceptions=true); // throw in all scenarios where we can supply a fallback config value
        }
        catch (e)
        {
            console.warn("[!] Unable to retrieve config property value for path: '" + path + "'; using fallback value instead: '" + fallback + "' [!]");
            console.log("  Inner exception details: ", e);
            return fallback;
        }
    }

    
})();
