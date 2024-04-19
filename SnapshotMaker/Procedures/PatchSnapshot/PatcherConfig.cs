using System;
using System.Collections.Generic;
using System.Dynamic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Procedures.PatchSnapshot
{
    /// <summary>
    /// Configuration of the <see cref="Patcher"/> stage.
    /// </summary>
    public class PatcherConfig
    {
        /// <summary>
        /// For future use.
        /// </summary>
        public long Version;

        /// <summary>
        /// Target version of steam-chat.com for which this PatcherConfig was designed.
        /// </summary>
        public long TargetCLSTAMP;

        /// <summary>
        /// Configuration for the SnapshotMaker.TsJsRewriter library used to rewrite the inner friends.js file.
        /// </summary>
        /// <remarks>
        /// This property is an opaque ExpandoObject, since we (the C# side of SnapshotMaker) do not need to inspect it. We only need to pass it on to the TsJsRewriter library inside the CEF JS Provider.
        /// </remarks>
        public ExpandoObject TsJsRewriterConfig;
    }
}
