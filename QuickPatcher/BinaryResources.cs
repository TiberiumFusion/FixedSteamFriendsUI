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
                + "Patch.PatchPayload_v1.0.0-{9e2017aa-091c-423f-8ff3-37d340e97c35}.zip";

            return Assembly.GetExecutingAssembly().GetManifestResourceStream(payloadResourcePath);
        }

    }
}
