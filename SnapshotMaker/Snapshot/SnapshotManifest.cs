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
        /// For future use.
        /// </summary>
        public long Version;

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
    }

    public enum SnapshotManifestMatchType
    {
        Any,
        ExactKnown,
        ExactTentative,
        ClosestNewer,
        NewestKnown,
    }
}
