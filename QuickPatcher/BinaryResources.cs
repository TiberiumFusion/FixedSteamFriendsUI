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
                + "Patch.PatchPayload_v1.1.0-{146983a4-25d3-43f6-b05d-7e1c0620758d}.zip";

            return Assembly.GetExecutingAssembly().GetManifestResourceStream(payloadResourcePath);
        }

    }
}
