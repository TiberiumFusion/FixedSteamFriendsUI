using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher
{
    [JsonObject]
    public class PatchMetadata
    {
        public string ScraperMagic { get; set; }

        [JsonObject]
        public class _Level0
        {
            public string PatchType { get; set; }
            public Version Version { get; set; }
            public string VersionGuid { get; set; }
            public long ReleaseDate { get; set; }
            public string ReleaseDateFriendly { get; set; }
            public string CoreBase { get; set; }
            public string PayloadName { get; set; }
            public string PayloadRootIndexFilename { get; set; }
        }

        public _Level0 Level0 { get; set; }

        
        [JsonIgnore]
        public string RAW; // raw json string, set by TryScrapeFromString


        public static bool TryScrapeFromString(string s, out PatchMetadata result, out Exception error)
        {
            string magicStart = "//-@[PMJ[";
            string magicEnd = "//]]@-";
            try
            {
                int magicStartPos = s.IndexOf(magicStart);
                if (magicStartPos == -1)
                    throw new Exception("Magic not found: " + magicStart); // it's never a good day when there's no magic to be found :c
                
                magicStartPos += magicStart.Length;
                int magicEndPos = s.IndexOf(magicEnd, magicStartPos);
                if (magicEndPos == -1)
                    throw new Exception("Magic not found: " + magicEndPos);

                string scrapeSlice = s.Substring(magicStartPos, magicEndPos - magicStartPos).Trim();
                string jsonString = scrapeSlice.Substring(scrapeSlice.IndexOf('`')).Trim('`'); // strip the "var TfusionPatchMetadataJsonRaw = `" and closing '`'

                PatchMetadata pm = JsonConvert.DeserializeObject<PatchMetadata>(jsonString);
                pm.RAW = jsonString;

                result = pm;
                error = null;
                return true;
            }
            catch (Exception e)
            {
                result = null;
                error = e;
                return false;
            }
        }

    }
}
