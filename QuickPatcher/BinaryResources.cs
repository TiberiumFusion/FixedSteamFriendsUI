using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher
{
    public static class BinaryResources
    {

        public static Stream GetPatchPayload()
        {
            string payloadResourcePath = "TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.Resources."
                + "Patch.PatchPayload_v1.2.0-{33959a10-3a63-42d1-a3c2-d827d3f3fd77}.zip";

            return Assembly.GetExecutingAssembly().GetManifestResourceStream(payloadResourcePath);
        }

    }
}
