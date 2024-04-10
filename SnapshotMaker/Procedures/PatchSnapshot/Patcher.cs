using System;
using System.Collections.Generic;
using System.Text;
using static TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Helpers;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.Procedures.PatchSnapshot
{
    public class Patcher
    {
        // ____________________________________________________________________________________________________
        // 
        //     Main interface
        // ____________________________________________________________________________________________________
        //

        public void PatchSteamchatDotComSnapshot(string snapshotDirectoryPath)
        {
            LogLine("\nPreparing to patch public/javascript/webui/friends.js");

            string friendsJsPath = QualifyPathWebFile(snapshotDirectoryPath, "public/javascript/webui/friends.js");


        }
    }
}
