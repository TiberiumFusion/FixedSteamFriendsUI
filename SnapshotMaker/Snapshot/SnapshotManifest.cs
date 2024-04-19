using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Snapshot
{
    /// <summary>
    /// Manifest of known files expected to be present in a snapshot.
    /// </summary>
    public class SnapshotManifest
    {
        /// <summary>
        /// Minimum version of steam-chat.com for which this manifest is known to be valid.
        /// </summary>
        public long MinCLSTAMP;

        /// <summary>
        /// Maximum version of steam-chat.com for which this manifest is known to be valid.
        /// </summary>
        public long MaxCLSTAMP;

        /// <summary>
        /// When true, this manifest is expected to remain valid for the ever-changing latest version of steam-chat.com, which may have a higher CLSTAMP than <see cref="MaxCLSTAMP"/>.
        /// </summary>
        public bool UnboundedMaxCLSTAMP;

        /// <summary>
        /// Lists of local file paths, per each resource categorgy.
        /// </summary>
        public Dictionary<ResourceCategory, List<string>> ResourcesByCategory;

        public SnapshotManifest() { }

        public SnapshotManifest(long clstampMin = 0, long clstampMax = 0, bool unboundedMaxCLSTAMP = false)
        {
            MinCLSTAMP = clstampMin;
            MaxCLSTAMP = clstampMax; // -1 means this manifest is (probably) valid for the latest steam-chat.com
            UnboundedMaxCLSTAMP = unboundedMaxCLSTAMP;

            ResourcesByCategory = new Dictionary<ResourceCategory, List<string>>();
            foreach (ResourceCategory category in Enum.GetValues(typeof(ResourceCategory)))
                ResourcesByCategory[category] = new List<string>();
        }

        public override string ToString()
        {
            return "{" + string.Format("CLSTAMP range: {0} - {1}{2}",
                MinCLSTAMP,
                MaxCLSTAMP,
                UnboundedMaxCLSTAMP ? "+" : ""
            ) + "}";
        }



        /// <summary>
        /// All known manifests, in order of CLSTAMP.
        /// </summary>
        public static List<SnapshotManifest> KnownManifests { get; private set; } = new List<SnapshotManifest>();


        /// <summary>
        /// Loads all .json files found in the provided directory as SnapshotManifests.
        /// </summary>
        /// <param name="directoryPath">Path to the folder from which to load the manifests.</param>
        /// <param name="ignoreExceptions">Ignore exceptions on nonexistent paths and continue loading the remaining paths.</param>
        public static void LoadManifests(string directoryPath, bool ignoreExceptions = false)
        {
            KnownManifests.Clear();

            if (!Directory.Exists(directoryPath))
            {
                if (ignoreExceptions)
                    return;
                else
                    throw new DirectoryNotFoundException("Cannot find directory '" + directoryPath + "'");
            }

            DirectoryInfo dir = new DirectoryInfo(directoryPath);
            foreach (FileInfo file in dir.EnumerateFiles("*.json", SearchOption.AllDirectories))
            {
                string manifestText = null;
                try
                {
                    manifestText = File.ReadAllText(file.FullName, Encoding.UTF8);
                }
                catch (Exception e)
                {
                    Console.WriteLine("Unhandled exception while reading file '" + file.FullName + '"');
                    Console.WriteLine(e);

                    if (!ignoreExceptions)
                        throw e;

                    Console.WriteLine("Skipping file");
                }

                if (manifestText != null)
                {
                    SnapshotManifest manifest = null;
                    try
                    {
                        manifest = JsonConvert.DeserializeObject<SnapshotManifest>(manifestText);
                    }
                    catch (Exception e)
                    {
                        Console.WriteLine("Unhandled exception while deserializing file '" + file.FullName + '"');
                        Console.WriteLine(e);

                        if (!ignoreExceptions)
                            throw e;

                        Console.WriteLine("Skipping file");
                    }

                    if (manifest != null)
                        KnownManifests.Add(manifest);
                }
            }
        }



        /// <summary>
        /// Gets a known manifest which most closely matches the supplied <paramref name="clstamp"/>.
        /// </summary>
        /// <param name="clstamp"></param>
        /// <param name="matchType"></param>
        /// <returns></returns>
        public static SnapshotManifest GetClosestManifestForClstamp(long clstamp, out ManifestMatchType matchType)
        {
            // If we have a perfect match, use that
            // Otherwise, use to the newest known manifest that is also closest to the provided CLSTAMP
            // Lastly, fall back to the latest known manifest if all known manifests are older than the provided clstamp

            foreach (SnapshotManifest knownManifest in KnownManifests.OrderByDescending(a => a.MinCLSTAMP))
            {
                if (clstamp >= knownManifest.MinCLSTAMP && clstamp <= knownManifest.MaxCLSTAMP)
                {
                    matchType = ManifestMatchType.ExactKnown;
                    return knownManifest;
                }
                else if (clstamp >= knownManifest.MinCLSTAMP && knownManifest.UnboundedMaxCLSTAMP)
                {
                    matchType = ManifestMatchType.ExactTentative;
                    return knownManifest;
                }
                else if (clstamp >= knownManifest.MinCLSTAMP)
                {
                    matchType = ManifestMatchType.ClosestNewer;
                    return knownManifest;
                }
            }

            matchType = ManifestMatchType.NewestKnown;
            return KnownManifests.Last();
        }

        public enum ManifestMatchType
        {
            Any,
            ExactKnown,
            ExactTentative,
            ClosestNewer,
            NewestKnown,
        }

    }
}
