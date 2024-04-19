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
        /// Gets a known manifest which most closely matches the supplied <paramref name="clstamp"/>.
        /// </summary>
        /// <param name="clstamp"></param>
        /// <param name="matchType"></param>
        /// <returns></returns>
        public static SnapshotManifest GetClosestSnapshotManifestForClstamp(long clstamp, out ManifestMatchType matchType)
        {
            // If we have a perfect match, use that
            // Otherwise, use to the newest known manifest that is also closest to the provided CLSTAMP
            // Lastly, fall back to the latest known manifest if all known manifests are older than the provided clstamp

            foreach (SnapshotManifest knownManifest in SnapshotManifests.OrderByDescending(a => a.MinCLSTAMP))
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

    }
}
