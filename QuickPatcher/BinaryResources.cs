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
                + "Patch.PatchPayload_v1.2.0-{68c67e12-e61e-4148-a5af-91b0e2c223b7}.zip";

            return Assembly.GetExecutingAssembly().GetManifestResourceStream(payloadResourcePath);
        }

    }
}
