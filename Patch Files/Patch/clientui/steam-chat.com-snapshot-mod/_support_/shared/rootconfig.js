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
    //     Inline libraries
    // ____________________________________________________________________________________________________
    //

    // These are inlined in the component that needs them, much like how the outer friends.js does this, because this is a shared component which can be used by both the outer and inner frames

    // mergician
    // https://cdn.jsdelivr.net/npm/mergician@1.1.0/dist/mergician.min.js
    // Because javascript has no ability to actually merge objects and requires a library to do that

    /*!
     * mergician
     * v1.1.0
     * https://jhildenbiddle.github.io/mergician/
     * (c) 2022-2023 John Hildenbiddle
     * MIT license
     */
    var mergician=(()=>{var V=(r,s)=>()=>(s||r((s={exports:{}}).exports,s),s.exports);var D=V((Q,S)=>{function M(...r){let s={};return r.forEach(e=>{e.forEach(l=>{s[l]=l in s?++s[l]:1})}),s}function U(...r){let s=M(...r);return Object.keys(s).filter(e=>s[e]>1)}function b(...r){return r.reduce((s,e)=>s.filter(Set.prototype.has,new Set(e)))}function x(...r){let s=M(...r);return Object.keys(s).filter(e=>s[e]===1)}function G(...r){let s=M(...r);return Object.keys(s).filter(e=>s[e]<r.length)}function R(r,s=!1){if(s){let e=[];for(let l in r)e.push(l);return e}else return Object.keys(r)}function P(r){return typeof r=="object"&&r!==null&&!Array.isArray(r)}function _(r){if(!P(r))return!1;let s=["writable","enumerable","configurable"].some(a=>a in r),e=["get","set"].some(a=>typeof r[a]=="function"),l=["get","set"].every(a=>a in r),h="value"in r&&s||e&&(l||s);if(h){let a=["configurable","get","set","enumerable","value","writable"];h=Object.keys(r).some(m=>!(m in a))}return h}S.exports={countOccurrences:M,getInMultiple:U,getInAll:b,getNotInMultiple:x,getNotInAll:G,getObjectKeys:R,isObject:P,isPropDescriptor:_}});var H=V((T,F)=>{var{getInMultiple:q,getInAll:L,getNotInMultiple:W,getNotInAll:z,getObjectKeys:B,isObject:I,isPropDescriptor:v}=D(),g={onlyKeys:[],skipKeys:[],onlyCommonKeys:!1,onlyUniversalKeys:!1,skipCommonKeys:!1,skipUniversalKeys:!1,invokeGetters:!1,skipSetters:!1,appendArrays:!1,prependArrays:!1,dedupArrays:!1,sortArrays:!1,hoistProto:!1,filter:Function.prototype,beforeEach:Function.prototype,afterEach:Function.prototype,onCircular:Function.prototype};function C(...r){let s=arguments.length===1?arguments[0]:{},e={...g,...s},l=new Map,h=new Map,a=typeof e.sortArrays=="function"?e.sortArrays:void 0,m=new WeakMap,d=0;function k(c){return B(c,e.hoistProto)}function w(...c){let u;c.length>1&&(e.onlyCommonKeys?u=q(...c.map(n=>k(n))):e.onlyUniversalKeys?u=L(...c.map(n=>k(n))):e.skipCommonKeys?u=W(...c.map(n=>k(n))):e.skipUniversalKeys&&(u=z(...c.map(n=>k(n))))),!u&&e.onlyKeys.length&&(u=e.onlyKeys),u&&u!==e.onlyKeys&&e.onlyKeys.length&&(u=u.filter(n=>e.onlyKeys.includes(n)));let N=c.reduce((n,f)=>{m.set(f,n);let y=u||k(f);e.skipKeys.length&&(y=y.filter(A=>e.skipKeys.indexOf(A)===-1));for(let A=0;A<y.length;A++){let o=y[A],p=n[o],K=!1,t;if(!(o in f))continue;try{t=f[o]}catch(i){console.error(i);continue}let E=Object.getOwnPropertyDescriptor(f,o);if(E&&typeof E.set=="function"&&typeof E.get!="function"){e.skipSetters||(E.configurable=!0,Object.defineProperty(n,o,E));continue}if(e.filter!==g.filter){let i=e.filter({depth:d,key:o,srcObj:f,srcVal:t,targetObj:n,targetVal:p});if(i!==void 0&&!i)continue}if(e.beforeEach!==g.beforeEach){let i=e.beforeEach({depth:d,key:o,srcObj:f,srcVal:t,targetObj:n,targetVal:p});i!==void 0&&(K=!0,t=i)}if(typeof t=="object"&&t!==null&&m.has(f[o])){let i=e.onCircular({depth:d,key:o,srcObj:f,srcVal:f[o],targetObj:n,targetVal:p});if(i===void 0){t=m.get(f[o]),n[o]=t;continue}K=!0,t=i}if(Array.isArray(t)){if(t=[...t],Array.isArray(p)&&(e.appendArrays?t=[...p,...t]:e.prependArrays&&(t=[...t,...p])),e.dedupArrays)if(e.afterEach!==g.afterEach)t=[...new Set(t)];else{let i=l.get(n);i&&!i.includes(o)?i.push(o):l.set(n,[o])}if(e.sortArrays)if(e.afterEach!==g.afterEach)t=t.sort(a);else{let i=h.get(n);i&&!i.includes(o)?i.push(o):h.set(n,[o])}}else I(t)&&(!K||!v(t))&&(d++,I(p)?t=w(p,t):t=w(t),d--);if(e.afterEach!==g.afterEach){let i=e.afterEach({depth:d,key:o,mergeVal:t,srcObj:f,targetObj:n});i!==void 0&&(K=!0,t=i)}if(K)v(t)?(t.configurable=!0,t.enumerable="enumerable"in t?t.enumerable:!0,"value"in t&&!("writable"in t)&&(t.writable=!0),Object.defineProperty(n,o,t)):n[o]=t;else{let i=Object.getOwnPropertyDescriptor(f,o);i&&typeof i.get=="function"&&!e.invokeGetters?(e.skipSetters&&(i.set=void 0),i.configurable=!0,Object.defineProperty(n,o,i)):n[o]=t}}return n},{});for(let[n,f]of l.entries())for(let y of f)n[y]=[...new Set(n[y])];for(let[n,f]of h.entries())for(let y of f)n[y].sort(a);return N}return arguments.length===1?function(...c){return arguments.length===1?C({...e,...c[0]}):w(...c)}:w(...arguments)}F.exports=C});return H();})();
    //# sourceMappingURL=mergician.min.js.map



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
            console.log("Initial default user config:", assembledConfig);

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
                assembledConfig = mergician(assembledConfig, configLayer);
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
