using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.StaticData;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher
{
    public class PatchPayloadFileInfo
    {
        public string FilePath { get; set; }
        public string FileName { get; set; }

        public byte[] FileHash { get; set; }

        public PatchMetadata PatchMetadata { get; set; }

        public Version PatchVersion { get { return PatchMetadata.Level0.Version; } }

        public string PatchTypeDisplayName
        {
            get
            {
                if (Guid.TryParse(PatchMetadata.Level0.PatchType, out Guid guid))
                {
                    if (PatchTypes.TryGetPatchTypeInfo(guid, out PatchTypeInfo patchTypeInfo))
                    {
                        return patchTypeInfo.DisplayName;
                    }
                }

                return "Unknown Patch Type";
            }
        }

        public PatchPayloadFileInfo(string filePath, byte[] fileHash, PatchMetadata patchMetadata)
        {
            FilePath = filePath;
            FileHash = fileHash;
            PatchMetadata = patchMetadata;

            FileName = Path.GetFileName(filePath);
        }
    }
}
