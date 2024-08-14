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

            // The alterations we perform on this file (amending, patching, conforming) can alter the syntax and location of the CLSTAMP declaration line
            // Notably, babel transpilation will prepend a variety of things to the file, which pushes the CLSTAMP declaration line down quite a bit
            // And patching might produce minor variations in the whitespace in this area

            scrapedClstamp = -1; // Note: Valve has been observed to fuck up and release production code with  var CLSTAMP = 0; , so it may even be possible for the var dec CLSTAMP to be other bogus values like -1
            errorMessage = "";

            // To avoid running a regex on a 3MB string, we'll first do a dumber scrape of the expected var CLSTAMP declaration
            Regex regex = new Regex("CLSTAMP\\s*=\\s*\"\\d+\"", RegexOptions.CultureInvariant);

            // To account for babel prepends, we'll check all var declarations within the first 10000 characters. If the size of the babel prepends grows, this threshold will need to be increased.
            int pos = 0;
            int searchLimitChars = 10000;
            bool found = false;
            while (pos < searchLimitChars)
            {
                int varDecStart = javascript.IndexOf("var", pos);
                if (varDecStart == -1)
                {
                    errorMessage = "Failed to find first var declaration statement. No declarations in first " + searchLimitChars + " characters.";
                    return false;
                }

                int varDecEnd = javascript.IndexOf(';', varDecStart);
                if (varDecEnd == -1)
                {
                    errorMessage = "Failed to find end of var declaration statement for position " + pos;
                    return false;
                }

                pos = varDecEnd;

                string varDec = javascript.Substring(varDecStart, varDecEnd - varDecStart);

                // Now we can run our simple regex on this much smaller string to handle formatting and whitespace variations
                Match match = regex.Match(varDec);
                if (!match.Success)
                    continue; // try the next var declaration

                string[] cuts = varDec.Split('=');
                string clstampValue = cuts[1].Trim();

                long clStampLong;
                if (!long.TryParse(clstampValue.Trim('"'), out clStampLong))
                {
                    errorMessage = "Failed to parse value of CLSTAMP declaration into a long";
                    return false;
                }

                scrapedClstamp = clStampLong;
                found = true;
                break;
            }

            if (!found)
            {
                errorMessage = "CLSTAMP var declaration not found in first " + searchLimitChars + " characters";
                return false;
            }

            return true;
        }
    }
}
