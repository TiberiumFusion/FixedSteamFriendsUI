using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Procedures.CaptureSnapshot
{
    partial class Routines
    {
        /*
            Example of the relevant area in friends.js (from 9126016)
				
            (s.u = (e) =>
			"javascript/webui/" +
			({
				43: "friendsui_sc_schinese-json",
				762: "friendsui_indonesian-json",
				976: "shared_thai-json",
				1225: "shared_swedish-json",
				1449: "shared_bulgarian-json",
				1499: "friendsui_latam-json",
				1973: "shared_japanese-json",
				2256: "shared_english-json",
				2320: "shared_norwegian-json",
				2435: "shared_latam-json",
				2632: "shared_spanish-json",
				2749: "shared_romanian-json",
				2945: "friendsui_russian-json",
				2954: "shared_ukrainian-json",
				3e3: "friendsui_turkish-json",
				3016: "friendsui_english-json",
				3232: "friendsui_italian-json",
				3415: "friendsui_portuguese-json",
				3485: "friendsui_japanese-json",
				3710: "shared_arabic-json",
				3789: "friendsui_vietnamese-json",
				3912: "shared_italian-json",
				4154: "friendsui_brazilian-json",
				4302: "friendsui_dutch-json",
				4434: "friendsui_ukrainian-json",
				4488: "friendsui_greek-json",
				4776: "friendsui_norwegian-json",
				4787: "friendsui_danish-json",
				5018: "shared_french-json",
				5110: "shared_dutch-json",
				5241: "shared_tchinese-json",
				5341: "friendsui_hungarian-json",
				5480: "friendsui_german-json",
				6031: "shared_finnish-json",
				6127: "friendsui_polish-json",
				6149: "shared_vietnamese-json",
				6165: "shared_hungarian-json",
				6208: "shared_german-json",
				6239: "shared_portuguese-json",
				6385: "friendsui_bulgarian-json",
				6518: "friendsui_arabic-json",
				6523: "shared_danish-json",
				6562: "shared_brazilian-json",
				6609: "friendsui_swedish-json",
				6888: "friendsui_thai-json",
				6971: "friendsui_koreana-json",
				7462: "gamerecording",
				7487: "friendsui_czech-json",
				7539: "shared_koreana-json",
				7591: "shared_czech-json",
				7653: "broadcastapp",
				7786: "shared_schinese-json",
				7861: "friendsui_romanian-json",
				8025: "shared_russian-json",
				8194: "friendsui_french-json",
				8306: "shared_indonesian-json",
				8759: "friendsui_finnish-json",
				8766: "friendsui_tchinese-json",
				8967: "shared_polish-json",
				9027: "shared_sc_schinese-json",
				9152: "shared_turkish-json",
				9712: "shared_greek-json",
				9746: "friendsui_schinese-json",
				9808: "friendsui_spanish-json",
			}[e] || e) +
			".js?contenthash=" +
			{
				43: "2d1569711644a97b27c9",
				351: "a6a7cb5406472ead1c8a",
				762: "20d1805fb19e04428350",
				976: "921d9b42129d668aa087",
				1225: "20b3af5e97aa92d7472d",
				1449: "c50539f08932082d0e79",
				1499: "c953d14ef1fde518714a",
				1973: "9751ddabe97c3652b911",
				2256: "4960720d898af4eaffa6",
				2320: "321c33c11ae5c8c57eab",
				2435: "93fc44ea4e314f389c1e",
				2632: "5a32b99841352896eb2d",
				2749: "4291f07e8ed1c7cce578",
				2945: "c2615f0bf698d3ba8095",
				2954: "476770cedb233b77c420",
				3e3: "6244423f97bbadfb378f",
				3016: "f772487927b08b66167b",
				3159: "200991dd6114e56702ed",
				3232: "68bf2fea1283ff729b8d",
				3415: "69e2a71281112f4dc868",
				3485: "1ca36b18b92fbd93c82b",
				3710: "357f6ded3ff9007f8dcb",
				3789: "568a8b1b5079d5d4946a",
				3912: "c3abf39905b957235782",
				4154: "0c33e8bbf7c03ddf43fd",
				4302: "7532d5d57aab1e69b2d3",
				4434: "cfa87968e65c1b48e58d",
				4488: "2ba22b0983b646f5294a",
				4776: "28db7f99aa77b21fb4e3",
				4787: "c918d5a66e4b1cb82962",
				5018: "2ddff5d8dbb6ef760077",
				5110: "44c24636064d04f5c06c",
				5241: "92572930bcd5d49c6b7e",
				5341: "0896561e7e8e04ac497a",
				5359: "0e83253bde391922234f",
				5480: "09e6317423e85306930c",
				5834: "afcc5f210d40f8d0b5f9",
				6031: "0a0bed831a582b2f1d74",
				6127: "21285c2d4e9089b111bb",
				6149: "b30cb4d152d01a73e2d7",
				6165: "4a1d280429f6c4916e6e",
				6208: "191c29c3ecfdea29c31a",
				6239: "585dc7f20fc775162a10",
				6385: "3c27faff8d632b9d9b06",
				6518: "8cd538c22d2143bbefe7",
				6523: "06070ee3439ee6aee460",
				6562: "d818650cafeb70671a17",
				6609: "acac235fdaf92994d4f8",
				6888: "97fad568d4bc58c3178c",
				6971: "3f59bfcb09e325651f1d",
				7462: "c3090d3067b4ac74d724",
				7487: "d058c34dbf64df818d6e",
				7539: "d0db8647eb89de6cd369",
				7591: "9605aaa681fed5de7172",
				7653: "e01e961bd9da77b5966f",
				7786: "6ab4d8e4e31a51041d68",
				7861: "ec6590999be2754fb930",
				8025: "46d8ef407befff06b6b3",
				8194: "510ab7f4d7764937eced",
				8306: "91ef2bb6c338e6424f0c",
				8759: "51d00c7c3ca5c19f7399",
				8766: "b9b7b35f7df91bb55b83",
				8887: "0f3fdcbb882916e86c80",
				8967: "47cc47d245939c2fbe0a",
				9027: "8e85e0465fbf17ebf124",
				9152: "7890719f0262d0ebd4ce",
				9712: "958544c56b9143a992b0",
				9746: "e05951d8b37cd69db872",
				9808: "47d563fed12f1789dffb",
			}[e]),
			(s.miniCssF = (e) => "css/webui/" + ({ 7462: "gamerecording", 7653: "broadcastapp" }[e] || e) + ".css?contenthash=" + { 351: "2a29ff31714f8254dd77", 3159: "75a6e9ff11215c0f2a0b", 7462: "b2b1511a51f14e550a7c", 7653: "6e7ae95ddba41e09e298" }[e]),
        */

        public static List<int> FindUnnamedJsChunkIds(string friendsJsContents, bool unstableOnly = false)
        {
			// A proper AST-based scraper is outside of valuable time budget to integrate here, so we're doing some simple scraping instead

			//
			// Find dictionary 1 items
			//

			//  "javascript/webui/"  is incredibly a unique literal in friends.js, so we will use that
			int d1Anchor = friendsJsContents.IndexOf("\"javascript/webui/\"");
			if (d1Anchor == -1)
				return null;

			// From here to the first dictionary item is all non-numeric characters
			int d1Start = friendsJsContents.IndexOfAny(new char[] { '0', '1', '2', '3', '4', '5', '6', '7', '8', '9' }, d1Anchor);
			if (d1Start == -1)
				return null;

			// Find the } that closes the dictionary literal
			int d1End = friendsJsContents.IndexOf('}', d1Start);
            if (d1End == -1)
                return null;

			// Get the first item through the last item (exclude outer braces)
			Dictionary<int, string> d1 = ParseJsChunkIdDictionary( friendsJsContents.Substring(d1Start, d1End - d1Start) );


			//
			// Find dictionary 2 items
			//

			int d2Anchor = friendsJsContents.IndexOf("\".js?contenthash=\"", d1End); //  ".js?contenthash="  is also unique
			if (d2Anchor == -1)
				return null;

            int d2Start = friendsJsContents.IndexOfAny(new char[] { '0', '1', '2', '3', '4', '5', '6', '7', '8', '9' }, d2Anchor);
            if (d2Start == -1)
                return null;

            int d2End = friendsJsContents.IndexOf('}', d2Start);
            if (d2End == -1)
                return null;

            Dictionary<int, string> d2 = ParseJsChunkIdDictionary( friendsJsContents.Substring(d2Start, d2End - d2Start) );


			//
			// Find unnamed chunks IDs
			//

			List<int> unnamedChunkIds = d2.Keys.Except(d1.Keys).ToList(); // Dict 1 is always a subset of Dict 2

			if (!unstableOnly)
				return unnamedChunkIds;


			// We're not done yet. Some unnamed chunk IDs are constant (like 351.js and 3159.js), while most others are not (the ones we are interested in).
			// We can filter out the constant unnamed chunk IDs by checking the third dictionary in this area, the small one that maps chunk IDs for *CSS* files (not js) to contenthashes for ".css?contenthash="
			// This is fine because each chunk ID is provisione to a .js + .css file pair. Not all IDs have both files, but in this case, the chunks with constant IDs happen to have CSS files and thus are in this dictionary.


			//
			// Find dictionary 3
			//

			int d3Anchor = friendsJsContents.IndexOf("\".css?contenthash=\"", d2End);
			if (d3Anchor == -1)
				return null;

            int d3Start = friendsJsContents.IndexOfAny(new char[] { '0', '1', '2', '3', '4', '5', '6', '7', '8', '9' }, d3Anchor);
			if (d3Start == -1)
				return null;

            int d3End = friendsJsContents.IndexOf('}', d3Start);
            if (d3End == -1)
                return null;

			Dictionary<int, string> d3 = ParseJsChunkIdDictionary( friendsJsContents.Substring(d3Start, d3End - d3Start) );


			//
			// Filter unnamed chunk IDs
			//

            return unnamedChunkIds.Except(d3.Keys).ToList();
        }

		private static Dictionary<int, string> ParseJsChunkIdDictionary(string raw)
        {
			Dictionary<int, string> result = new Dictionary<int, string>();

			foreach (string item in raw.Split(','))
            {
				string[] cuts = item.Split(':');

				// Key (integer)
				int id = int.Parse(cuts[0], System.Globalization.NumberStyles.Float); // Specifying Float for style handles obnoxious scientific notation minifier syntax (e.g. "3e3" instead of "3000")

				// Value (string)
				string value = cuts[1].TrimEnd(',').Trim('"');

				result[id] = value;
            }

			return result;
        }

    }
}
