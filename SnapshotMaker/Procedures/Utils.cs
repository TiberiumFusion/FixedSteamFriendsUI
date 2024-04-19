using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Procedures
{
    public static class Utils
    {
        /// <summary>
        /// Scrapes the value of CLSTAMP from a string contained the javascript of the inner friends.js file.
        /// </summary>
        /// <param name="javascript">The javascript code to scrape.</param>
        /// <param name="scrapedClstamp">Set to the scraped CLSTAMP, as a <see cref="long"/>.</param>
        /// <param name="errorMessage">Set to an error message explaining why this method failed (if it did). Set to null otherwise.</param>
        /// <returns>True if successful, false otherwise.</returns>
        public static bool TryScrapeClstampFieldFromFriendsJsJavascript(string javascript, out long scrapedClstamp, out string errorMessage)
        {
            // This file always seems to start the same way:
            // 1. 10 pointless newlines
            // 2. Valve's fucker eula stub comment
            // 3. 3MB of bastardized javascript on a single line

            // The very start of item no.3 always seems to be the CLSTAMP declaration, like so:
            //   var CLSTAMP="8804332";(()=>{var e,t,n,i,o,r={3119:(e,t,n)=>{var ...
            // The string "CLSTAMP" also only appears once in the entire file, at this location

            scrapedClstamp = -1;
            errorMessage = "";

            // To avoid running a regex on a 3MB string, we'll first do a dumber scrape of the expected var CLSTAMP declaration

            int varDecStart = javascript.IndexOf("var");
            if (varDecStart == -1)
            {
                errorMessage = "Failed to find first var declaration statement";
                return false;
            }

            int varDecEnd = javascript.IndexOf(';', varDecStart);
            if (varDecEnd == -1)
            {
                errorMessage = "Failed to find end of first var declaration statement";
                return false;
            }

            string varDec = javascript.Substring(varDecStart, varDecEnd - varDecStart);

            // Then we can run a simpler regex on this much smaller string to handle formatting and whitespace variations

            Regex regex = new Regex("CLSTAMP\\s*=\\s*\"\\d+\"", RegexOptions.CultureInvariant);
            Match match = regex.Match(varDec);
            if (match == null)
            {
                errorMessage = "First var declaration did not match CLSTAMP pattern";
                return false;
            }

            string[] cuts = varDec.Split('=');
            string clstampValue = cuts[1].Trim();

            long clStampLong;
            if (!long.TryParse(clstampValue.Trim('"'), out clStampLong))
            {
                errorMessage = "Failed to parse value of CLSTAMP declaration into a long";
                return false;
            }

            scrapedClstamp = clStampLong;
            return true;
        }
    }
}
