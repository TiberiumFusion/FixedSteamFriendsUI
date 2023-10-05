using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.StaticData
{
    public enum PatchType
    {
        None,
        LocalSteamChatDotComSnapshot,
    }

    public class PatchTypeInfo
    {
        public PatchType Type { get; set; }
        public Guid Guid { get; set; }
        public string DisplayName { get; set; }

        public PatchTypeInfo(PatchType type, Guid guid, string displayName)
        {
            Type = type;
            Guid = guid;
            DisplayName = displayName;
        }
    }

    public static class PatchTypes
    {
        private static List<PatchTypeInfo> KnownPatchTypes;

        private static Dictionary<Guid, PatchTypeInfo> GuidToInfo;
        private static Dictionary<PatchType, PatchTypeInfo> TypeToInfo;

        static PatchTypes()
        {
            KnownPatchTypes = new List<PatchTypeInfo>()
            {
                new PatchTypeInfo(PatchType.None, Guid.Empty, ""), // default value placeholder
                new PatchTypeInfo(PatchType.LocalSteamChatDotComSnapshot, Guid.Parse("{62C3D4C0-8A0B-4602-820E-7020B8473037}"), "Local steam-chat.com Snapshot"),
            };

            GuidToInfo = new Dictionary<Guid, PatchTypeInfo>();
            TypeToInfo = new Dictionary<PatchType, PatchTypeInfo>();
            foreach (var info in KnownPatchTypes)
            {
                GuidToInfo[info.Guid] = info;
                TypeToInfo[info.Type] = info;
            }
        }

        public static PatchTypeInfo GetPatchTypeInfo(Guid guid)
        {
            return GuidToInfo[guid];
        }

        public static PatchTypeInfo GetPatchTypeInfo(PatchType type)
        {
            return TypeToInfo[type];
        }

    }
}
