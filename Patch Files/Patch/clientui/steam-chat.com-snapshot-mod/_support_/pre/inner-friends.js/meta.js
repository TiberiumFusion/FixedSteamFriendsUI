// Patch self awareness and the like

(function ()
{

    let Meta = {};
    TFP.Meta = Meta;


    let UrlVars = new URLSearchParams(window.location.search);


    // ____________________________________________________________________________________________________
    //
    //     Static data
    // ____________________________________________________________________________________________________
    //

    // This is a bunch of data that we need in order to do various things

    let xhrStaticData = new XMLHttpRequest();
    xhrStaticData.open("GET", UrlVars.get("PayloadRootUrl") + "_support_/staticdata.json5", false); // blocking request
    xhrStaticData.send();

    Meta.StaticDataJson5 = JSON5.parse(xhrStaticData.responseText);


})();
