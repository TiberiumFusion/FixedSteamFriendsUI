using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker
{
    public class CmdArgs
    {
        //
        // Switches with default values
        //

        public bool WriteLogFileToSnapshot = true;

        public string Stages = "sa"; // 's' = scrape, 'a' = amend, 'p' = patch, 'f' = conform, 'c' = clean

        public string ValveCdn = "akamai"; // default Valve CDN (when not requesting a specific one) is likely to broken dogshit, so we want our forced default CDN to be an actually functional one


        //
        // Parsing
        //

        public CmdArgs(string[] args)
        {
            bool matchArg(string arg, string expected)
            {
                return (arg.ToLowerInvariant() == expected.ToLowerInvariant());
            }

            bool tryMatchArgWithValue(string arg, string expectedFront, out string value)
            {
                string canonArg = arg.ToLowerInvariant();
                string canonExpectedFront = expectedFront.ToLowerInvariant();

                if (canonArg.Length >= canonExpectedFront.Length && canonArg.Substring(0, canonExpectedFront.Length) == canonExpectedFront)
                {
                    value = arg.Substring(canonExpectedFront.Length);
                    return true;
                }
                else
                {
                    value = "";
                    return false;
                }
            }

            foreach (string a in args)
            {
                string argValue = "";

                if (false) { }

                else if (tryMatchArgWithValue(a, "/IncludeLog:", out argValue))
                {
                    if (bool.TryParse(argValue, out bool argValueBool))
                    {
                        WriteLogFileToSnapshot = argValueBool;
                        Debug.WriteLine("Cmd arg '" + a + "'  ->  WriteLogFileToSnapshot = " + argValueBool);
                    }
                    else
                        Debug.WriteLine("Cmd arg '" + a + "' has unrecognized/invalid value");
                }
                else if (matchArg(a, "/IncludeLog"))
                {
                    WriteLogFileToSnapshot = true;
                    Debug.WriteLine("Cmd arg '" + a + "'  ->  WriteLogFileToSnapshot = true");
                }

                else if (tryMatchArgWithValue(a, "/Stages:", out argValue))
                {
                    Stages = argValue;
                    Debug.WriteLine("Cmd arg '" + a + "'  ->  Stages = " + argValue);
                }

                else if (tryMatchArgWithValue(a, "/ValveCdn:", out argValue))
                {
                    ValveCdn = argValue;
                    Debug.WriteLine("Cmd arg '" + a + "'  ->  ValveCdn = " + argValue);
                }

                else
                {
                    Debug.WriteLine("Unrecognized cmd arg '" + a + "'");
                }
            }
        }
    }
}
