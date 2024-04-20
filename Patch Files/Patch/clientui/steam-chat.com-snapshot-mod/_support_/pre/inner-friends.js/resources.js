// Stuff related to dynamically retrieved resources

(function()
{

    let Resources = {};
	TFP.Resources = Resources;


	let UrlVars = new URLSearchParams(window.location.search);


	// ____________________________________________________________________________________________________
	//
	//     Declarations
	// ____________________________________________________________________________________________________
	//

	// --------------------------------------------------
	//   Resource paths
	// --------------------------------------------------

	// Root url for remote resources
	Resources.VALVE_PUBLIC_PATH = "https://community.cloudflare.steamstatic.com/public/"; // Valve defines this in an inline <script> in the root html document. We can redfine it here if needed.

	// Root urls for local resources
	Resources.LOCAL_ROOT = UrlVars.get("PayloadRootUrl") // the local directory that contains the index.html file which has the <script>s that include friends.js and co
	Resources.LOCAL_VALVE_PUBLIC_PATH = Resources.LOCAL_ROOT + "public/" // equivalent to VALVE_PUBLIC_PATH under our LOCAL_ROOT


	// --------------------------------------------------
	//   Types of resources fetched by Valve's JS
	// --------------------------------------------------

	Resources.CdnResourceCategory = TFP.CreateEnum([

		//
		// JS files that are loaded by other JS files (i.e. *not* via <script>s in html)
		//

		"CoreJs", // core Valve javascript; statically linked together in a module system using unstable volatile integer IDs
		"JsonJs", // javascript files that are glorified wrappers around some valid or invalid json string; uses the same vile module system the core Valve JS uses

		"LibraryJs", // lesser javascript libraries, not directly related to steam friends

		//
		// Non-JS files that are loaded by JS files
		//

		"JsCss",

		//
		// Non-code resources that are loaded by JS files
		//

		"JsImages",
		"JsSounds",
	]);


	// --------------------------------------------------
	//   Resource locations
	// --------------------------------------------------

	Resources.CdnResourceLocation = TFP.CreateEnum([
		"Any",
		"Remote",
		"Local",
	]);

	Resources.CdnResourceRootPathType = TFP.CreateEnum([
		"Root", // rootmost directory (where index.html lives)
		"Root_Public", // root/public directory (child of above directory)
		// This distinction is necessary since Valve's friends.js is inconsistent in how it builds CDN resource URL strings
		// - Sometimes it leaves the /public folder out of the root, like: COMMUNITY_URL + "public/sounds/etc"
		// - Other times it expectes the /public folder to be in the root, like: VALVE_PUBLIC_PATH + "javascript/etc"
	]);



	// ____________________________________________________________________________________________________
	//
	//     Configuration
	// ____________________________________________________________________________________________________
	//

	// Instead of downloading remote assets from community.<cdn>.steamstatic.com/VALVE_PUBLIC_PATH, we can get the local copies in the snapshot
	// And if a local copy does not exist, we can fall back to the remote one instead

	Resources.UseLocalAssetCopies =
	{
		//
		// JS modules
		//

		// Must use local copies due to module ID instability between builds of Valve's JS
		[Resources.CdnResourceCategory.CoreJs]: true,
		[Resources.CdnResourceCategory.JsonJs]: true,

		//
		// Standalone JS
		//

		[Resources.CdnResourceCategory.LibraryJs]: true, // it's safer to use library versions that are contemporary to the snapshot's Valve JS rather than whatever latest library version exists at Valve's remote bleeding edge

		//
		// CSS
		//

		[Resources.CdnResourceCategory.JsCss]: true, // same rationale as LibraryJs

		//
		// Resources loaded by Valve JS
		//

		[Resources.CdnResourceCategory.JsImages]: true, // false is safe until valve eventually redacts the files we request, but why take that risk?
		[Resources.CdnResourceCategory.JsSounds]: true, // ditto

		// Note: all resources in static files (notably, CSS) will always be retrieved from remote, since we have no way to rewrite the URLs in those files on the fly
	};

	Resources.LocalAssetFallbackToRemote = true;
	// If we want a local asset but it does not exist, try to fetch the remote version instead



	// ____________________________________________________________________________________________________
	//
	//     Main interface
	// ____________________________________________________________________________________________________
	//

	// --------------------------------------------------
	//   Resource retrieval
	// --------------------------------------------------

	///// Abstraction wrapper for selecting either the remote or local path to a CDN resource and returning the URL to said resource on said host
	// In friends.js, we replace all of Valve's COMMUNITY_BASE_URL + "/path/to/some/file" url string building code with calls to this method
	// Params:
	// - remoteRootPath: The resource's remote root path (e.g. COMMUNITY_BASE_URL, VALVE_PUBLIC_PATH, etc)
	// - resourcePath: The path to the resource, relative to any given root path (e.g. "public/javascript/webui/friendsui_english-json.js")
	// - remoteRootPathType: The CdnAssetRootPathType which describes the type of the remoteRootPath
	// - resourceCategory: The CdnResourceCategory to which this resource belongs
	// - (optional) forceHost: If specified, the resource's category's UseLocalAssetCopies config is ignored, and the returned resource url will always point to the host specified by forceHost (a member of CdnResourceLocation)
	Resources.SelectCdnResourceUrl = function(remoteRootPath, resourcePath, remoteRootPathType, resourceCategory, forceHost = null)
	{
		let local = false;
		if (forceHost == this.CdnResourceLocation.Local || this.CdnResourceLocation[forceHost] == this.CdnResourceLocation.Local)
		{
			local = true;
		}
		else if (forceHost == this.CdnResourceLocation.Remote || this.CdnResourceLocation[forceHost] == this.CdnResourceLocation.Remote)
		{
			local = false;
		}
		else
		{
			let resCat = typeof (resourceCategory) == "string" ? this.CdnResourceCategory[resourceCategory] : resourceCategory;
			if (resCat == null) {
				throw new Error("Invalid value for param resourceCategory", resourceCategory); }

			local = this.UseLocalAssetCopies[resCat];
		}
	
		if (local)
		{
			let resourceUrl = null;
			if (remoteRootPathType == this.CdnResourceRootPathType.Root || this.CdnResourceRootPathType[remoteRootPathType] == this.CdnResourceRootPathType.Root)
			{
				console.log("Use LOCAL (root) asset: ", remoteRootPath, resourcePath, this.CdnResourceCategory[resourceCategory]);
				resourceUrl = this.LOCAL_ROOT + resourcePath;
			}
			else if (remoteRootPathType == this.CdnResourceRootPathType.Root_Public || this.CdnResourceRootPathType[remoteRootPathType] == this.CdnResourceRootPathType.Root_Public)
			{
				console.log("Use LOCAL (root/public) asset: ", remoteRootPath, resourcePath, this.CdnResourceCategory[resourceCategory]);
				resourceUrl = this.LOCAL_VALVE_PUBLIC_PATH + resourcePath;
			}
			else {
				throw new Error("Invalid value for param remoteRootPathType", remoteRootPathType); }
		
			if (this.LocalAssetFallbackToRemote) // verify that the local asset can be retrieved; if not, use remote asset instead
			{
				let xhr = new XMLHttpRequest();
				xhr.open("GET", resourceUrl, false); // we must do this synchronously to block the Valve code which called this method
				xhr.send();
				if (xhr.status < 200 || xhr.status >= 300)
				{
					resourceUrl = remoteRootPath + resourcePath;
					console.log("- Local asset not found (" + xhr.status + "); using fallback to remote path instead: " + resourceUrl);
				}
			}
		
			console.log("- Local path: " + resourceUrl);
			return resourceUrl;
		}
		else
		{
			console.log("Use REMOTE asset: ", remoteRootPath, resourcePath, this.CdnResourceCategory[resourceCategory]);
			return remoteRootPath + resourcePath;
		}	
	}

	///// Version of the above for the specific call site at the Valve .js loader
	// This call site requires special logic to determine whether resourceCategory is Js or JsonJs
	// It is far more maintainable to put that logic here, rather than use TsJsRewriter to create and patch in the needed logic at the call site
	Resources.SelectCdnResourceUrl_JsLoaderDirect = function(remoteRootPath, resourcePath, remoteRootPathType, dummyResourceCategory, forceHost = null)
	{
		let resourceCategory = "CoreJs";
		if (remoteRootPath.indexOf("-json.js") != -1) {
			resourceCategory = "JsonJs"; }

		return Resources.SelectCdnResourceUrl(remoteRootPath, resourcePath, remoteRootPathType, resourceCategory, forceHost);
    }


})();
