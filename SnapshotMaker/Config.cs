using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Snapshot;
using TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Procedures.PatchSnapshot;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker
{
    public static class Config
    {

        // ____________________________________________________________________________________________________
        // 
        //     Common
        // ____________________________________________________________________________________________________
        //

        /// <summary>
        /// Loads all .json files found in the provided directory as a type of configuration object.
        /// </summary>
        /// <typeparam name="T">The type of object to deserialized the .json files into.</typeparam>
        /// <param name="directoryPath">Path to the folder to search within for .json files.</param>
        /// <param name="deep">Search subfolders of <paramref name="directoryPath"/> for more files.</param>
        /// <param name="ignoreExceptions">Ignore exceptions on nonexistent paths and continue loading the remaining paths.</param>
        /// <returns>A list of deserialized configuration objects</returns>
        public static List<T> LoadJsonConfigsFromDirectory<T>(string directoryPath, bool deep = true, bool ignoreExceptions = false)
        {
            List<T> configs = new List<T>();

            if (!Directory.Exists(directoryPath))
            {
                if (ignoreExceptions)
                    return configs;
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
                    T config = default(T);
                    try
                    {
                        config = JsonConvert.DeserializeObject<T>(manifestText);
                    }
                    catch (Exception e)
                    {
                        Console.WriteLine("Unhandled exception while deserializing file '" + file.FullName + '"');
                        Console.WriteLine(e);

                        if (!ignoreExceptions)
                            throw e;

                        Console.WriteLine("Skipping file");
                    }

                    if (config != null)
                        configs.Add(config);
                }
            }

            return configs;
        }



        // ____________________________________________________________________________________________________
        // 
        //     Snapshot Manifests
        // ____________________________________________________________________________________________________
        //

        /// <summary>
        /// All <see cref="SnapshotManifest"/>s loaded by <see cref="LoadSnapshotManifests"/>.
        /// </summary>
        public static List<SnapshotManifest> SnapshotManifests { get; private set; } = new List<SnapshotManifest>();

        /// <summary>
        /// Load and deserialize all .json files in <paramref name="directoryPath"/> into <see cref="SnapshotManifest"/> objects and add them to <see cref="SnapshotManifests"/>.
        /// </summary>
        /// <param name="directoryPath">Path to the folder to search within for .json files.</param>
        /// <param name="deep">Search subfolders of <paramref name="directoryPath"/> for more files.</param>
        /// <param name="ignoreExceptions">Ignore exceptions on nonexistent paths and continue loading the remaining paths.</param>
        public static void LoadSnapshotManifestsFrom(string directoryPath, bool deep = true, bool ignoreExceptions = false)
        {
            SnapshotManifests.AddRange(LoadJsonConfigsFromDirectory<SnapshotManifest>(directoryPath, deep, ignoreExceptions));
        }


        /// <summary>
        /// Gets a loaded <see cref="SnapshotManifest"/> which most closely matches the supplied <paramref name="clstamp"/>.
        /// </summary>
        /// <param name="clstamp">The CLSTAMP to query by, as a number.</param>
        /// <param name="matchType">Indicates the type of match that was made.</param>
        /// <returns>The matched <see cref="SnapshotManifest"/></returns>
        public static SnapshotManifest GetClosestSnapshotManifestForClstamp(long clstamp, out SnapshotManifestMatchType matchType)
        {
            // Each SnapshotManifest specifies itself to be valid for a CLSTAMP range
            // A match here is defined as a SnapshotManifest whose CLSTAMP range includes the provided clstamp parameter

            // If we have a perfect match, use that
            // Otherwise, use to the newest manifest that is also closest to the provided CLSTAMP
            // Lastly, fall back to the latest manifest if all manifests are older than the provided clstamp

            foreach (SnapshotManifest manifest in SnapshotManifests.OrderByDescending(a => a.MinCLSTAMP))
            {
                if (clstamp >= manifest.MinCLSTAMP && clstamp <= manifest.MaxCLSTAMP)
                {
                    matchType = SnapshotManifestMatchType.ExactKnown;
                    return manifest;
                }
                else if (clstamp >= manifest.MinCLSTAMP && manifest.UnboundedMaxCLSTAMP)
                {
                    matchType = SnapshotManifestMatchType.ExactTentative;
                    return manifest;
                }
                else if (clstamp >= manifest.MinCLSTAMP)
                {
                    matchType = SnapshotManifestMatchType.ClosestNewer;
                    return manifest;
                }
            }

            matchType = SnapshotManifestMatchType.NewestKnown;
            return SnapshotManifests.Last();
        }



        // ____________________________________________________________________________________________________
        // 
        //     Patcher Configurations
        // ____________________________________________________________________________________________________
        //

        /// <summary>
        /// All <see cref="PatcherConfig"/>s loaded by <see cref="LoadPatcherConfigsFrom"/>.
        /// </summary>
        public static List<PatcherConfig> PatcherConfigs { get; private set; } = new List<PatcherConfig>();

        /// <summary>
        /// Load and deserialize all .json files in <paramref name="directoryPath"/> into <see cref="PatcherConfig"/> objects and add them to <see cref="PatcherConfigs"/>.
        /// </summary>
        /// <param name="directoryPath">Path to the folder to search within for .json files.</param>
        /// <param name="deep">Search subfolders of <paramref name="directoryPath"/> for more files.</param>
        /// <param name="ignoreExceptions">Ignore exceptions on nonexistent paths and continue loading the remaining paths.</param>
        public static void LoadPatcherConfigsFrom(string directoryPath, bool deep = true, bool ignoreExceptions = false)
        {
            PatcherConfigs.AddRange(LoadJsonConfigsFromDirectory<PatcherConfig>(directoryPath, deep, ignoreExceptions));
        }


        /// <summary>
        /// Gets a loaded <see cref="PatcherConfig"/> which most closely matches the supplied <paramref name="clstamp"/>.
        /// </summary>
        /// <param name="clstamp">The CLSTAMP to query by, as a number.</param>
        /// <returns>The matched <see cref="PatcherConfig"/></returns>
        public static PatcherConfig GetClosestPatcherConfigForClstamp(long clstamp)
        {
            // Patcher configs are currently designed only for a specific certain CLSTAMP, since they take magnitudes more time to create and test than SnapshotManifests
            // A match here is defined as the PatcherConfig whose CLSTAMP exactly matches the provided clstamp param

            // If we have a perfect match, use that
            // Otherwise, use to the newest config that is also closest to the provided CLSTAMP
            // Lastly, fall back to the latest config if all configs are older than the provided clstamp

            PatcherConfig curMatch = null;

            IEnumerable<PatcherConfig> configsNewestToOldest = PatcherConfigs.OrderByDescending(a => a.TargetCLSTAMP);

            foreach (PatcherConfig config in configsNewestToOldest)
            {
                if (   curMatch == null
                    || ( config.TargetCLSTAMP >= clstamp && (clstamp - config.TargetCLSTAMP) < (clstamp - curMatch.TargetCLSTAMP) )
                    )
                {
                    curMatch = config;
                }
            }

            if (curMatch == null)
            {
                curMatch = configsNewestToOldest.First();
            }

            return curMatch;
        }

    }
}
