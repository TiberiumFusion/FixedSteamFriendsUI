using System;
using System.Collections.Generic;
using System.Dynamic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Procedures.ConformSnapshot
{
    /// <summary>
    /// Configuration for the transpilation task of the <see cref="Conformer"/> stage.
    /// </summary>
    public class TranspilerConfig
    {
        /// <summary>
        /// For future use.
        /// </summary>
        public long Version;

        /// <summary>
        /// Minimum version of steam-chat.com for which this config is known to be valid.
        /// </summary>
        public long MinCLSTAMP;

        /// <summary>
        /// Maximum version of steam-chat.com for which this config is known to be valid.
        /// </summary>
        public long MaxCLSTAMP;

        /// <summary>
        /// When true, this config is expected to remain valid for the ever-changing latest version of steam-chat.com, which may have a higher CLSTAMP than <see cref="MaxCLSTAMP"/>.
        /// </summary>
        public bool UnboundedMaxCLSTAMP;

        /// <summary>
        /// List of files (by path) to be transpiled. Paths are relative to their web root, e.g. "public/javascript/webui/friends.js".
        /// </summary>
        /// <remarks>
        /// CLSTAMP 9004798 is when transpilation first becomes necessary.
        /// </remarks>
        public List<string> Targets;

        /// <summary>
        /// Babel configuration for the transpilation process.
        /// </summary>
        /// <remarks>
        /// This property is an opaque ExpandoObject, since we (the C# side of SnapshotMaker) do not need to inspect it. We only need to pass it on to babel inside the CEF JS Provider.
        /// </remarks>
        public ExpandoObject BabelConfig;


        public TranspilerConfig()
        {
            Targets = new List<string>();
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

    public enum TranspilerConfigMatchType
    {
        Any,
        ExactKnown,
        ExactTentative,
        ClosestNewer,
        NewestKnown,
    }
}
