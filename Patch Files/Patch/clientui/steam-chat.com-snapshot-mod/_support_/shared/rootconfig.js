// This is a root level, user-adjustable configuration that is used by both the outer frame and inner frame
// Values set in this config are available to both frames. It is up to the discretion of each component to respect this root config, especially in the case of components with local configurations.

// The user can control this root configuration by placing and editing named .json files in particular locations


// The current pattern for these outer-inner shared components is a factory which returns a component object instance on evaluation
(function ()
{

    let com = {};


    // ____________________________________________________________________________________________________
    //
    //     Static data
    // ____________________________________________________________________________________________________
    //

    //
    // Default config
    //

    // Contains ALL known values
    // Bound by closure and kept out of com to make manipulation more difficult
    const DefaultConfig =
    {
        "General":
        {
            "EnablePatch": true,
        },

        "OuterFrame":
        {
            "RetryConnectionButtonStrongerReload": true,
            // When true, clicking the blue Retry Connection button will reload the entire FriendsUI. When false, it will send a meager reload message to the inner document js that does almost nothing (default Valve behavior).

            "InnerLoadFailAutoRetryCount": 3,
            // Number of times to automatically refresh the page if a load failure of the inner frame is detected
        },

        "InnerFrame":
        {
            "ValveCdnOverride": null,
        },
    };
    


    // ____________________________________________________________________________________________________
    //
    //     Helpers
    // ____________________________________________________________________________________________________
    //

    //
    // Arbitrary property access by dereferncing path
    //

    // See: https://stackoverflow.com/a/23809123/2489580
    function getNestedProperty(obj, key)
    {
        return key.split(".").reduce(
            function(o, x) {
                return (typeof o == "undefined" || o === null) ? o : o[x];
            },
        obj); // returns null on short-out
    }

    function hasNestedProperty(obj, key)
    {
        return key.split(".").every(
            function(x) {
                if (typeof obj != "object" || obj === null || !(x in obj)) {
                    return false; }
                obj = obj[x];
                return true;
            }
        );
    }



    // ____________________________________________________________________________________________________
    //
    //     Properties
    // ____________________________________________________________________________________________________
    //

    // Final configuration object to use; built from the default config and all found user config layers
    com.AssembledConfig = null;
    // This is built in a series of layers like so:
    // 1. Default config
    // 2a. Optional user config at location 0
    // 2b. Optional user config at location 1
    // 2c. etc
    // Successive layers overwrite add key values not seen yet and override key values that are already defined



    // ____________________________________________________________________________________________________
    //
    //     Initialization
    // ____________________________________________________________________________________________________
    //

    com.Initialize = function(userConfigsRootPath, userConfigsPaths)
    {
        try
        {
            //
            // Start with copy of default config
            //

            let assembledConfig = JSON.parse(JSON.stringify(DefaultConfig))

            //
            // Load potential user configs
            //

            function addConfig(path)
            {
                // Download it
                let xhr = new XMLHttpRequest();
                xhr.open("GET", userConfigsRootPath + path, false); // relative paths are relative to window.location, and this must be synchronous
                xhr.send();
                
                if (xhr.status < 200 || xhr.status >= 300)
                {
                    console.log("No user config exists at path: '" + path + "' (full url: '" + xhr.responseURL + "')");
                    return;
                }

                if (xhr == null || typeof xhr.response !== "string" || xhr.length == 0)
                {
                    console.log("Invalid user config (empty file) at path: '" + path + "' (full url: '" + xhr.responseURL + "')");
                    return;
                }

                // Parse it
                let configLayer = null;
                try
                {
                    configLayer = JSON.parse(xhr.response);
                }
                catch (e2)
                {
                    console.log("Invalid user config (not valid json) at path: '" + path + "' (full url: '" + xhr.responseURL + "')");
                    console.log("Details: ", e2);
                    return;
                }

                // Merge it
                Object.assign(assembledConfig, configLayer);
                console.log("Added user config:", configLayer, "from path: '" + path + "' (full url: '" + xhr.responseURL + "')");
            }

            // Load overwrite layers in order
            for (let userConfigPath of userConfigsPaths) {
                addConfig(userConfigPath); }

            // Done
            this.AssembledConfig = assembledConfig;
            console.log("Assembled root configuration:", this.AssembledConfig);
        }
        catch (e)
        {
	        console.log("[!!!] Unhandled exception while discovering and assembling the FixedSteamFriendsUI root configuration [!!!]");
            console.log("  Default configuration will be used.");
            console.log("  Exception details: ", e);
        }
    }



    // ____________________________________________________________________________________________________
    //
    //     Config access interface
    // ____________________________________________________________________________________________________
    //

    com.GetConfigProperty = function(path, throwIfUndefined=true, rethrowExceptions=false)
    {
        let result = null;
        let wasDefined = false;

        try // protected section here for quick and easy coverage of faults in the config json and its interface
        {
            // First query the assembled configuration
            if (this.AssembledConfig != null)
            {
                if (hasNestedProperty(this.AssembledConfig, path))
                {
                    result = getNestedProperty(this.AssembledConfig, path);
                    wasDefined = true; // to discern between 'intentional null' and 'undefined because not defined'
                }
            }

            // If the assembled config didn't have the property at the specified path, try the default config next
            if (!wasDefined)
            {
                if (hasNestedProperty(this.AssembledConfig, path))
                {
                    result = getNestedProperty(this.AssembledConfig, path);
                    wasDefined = true;
                }
            }
        }
        catch (e)
        {
            if (rethrowExceptions) { // intended for handling by the immediate caller (such as for a fallback value)
                throw e; }
            
            console.log("[!!!] Unhandled exception while accessing FixedSteamFriendsUI root config property path '" + path + "' [!!!]");
            console.log("  Caller will receive null for config property value!", e);
            console.log("  Exception details: ", e);
        }

        // If property value is not defined, this is an error
        if (!wasDefined)
        {
            if (throwIfUndefined) { // intended for handling by the immediate caller (such as for a fallback value)
                throw new Error("Path '" + path + "' does not exist in any configuration object"); }
        }
    
        return result;
    }


    // Component created and ready for use
    return com;

})();
