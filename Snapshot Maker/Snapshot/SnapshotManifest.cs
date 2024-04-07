using System;
using System.Collections.Generic;
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

        public SnapshotManifest(long clstampMin = 0, long clstampMax = 0, bool unboundedMaxCLSTAMP = false)
        {
            MinCLSTAMP = clstampMin;
            MaxCLSTAMP = clstampMax; // -1 means this manifest is (probably) valid for the latest steam-chat.com
            UnboundedMaxCLSTAMP = unboundedMaxCLSTAMP;

            ResourcesByCategory = new Dictionary<ResourceCategory, List<string>>();
            foreach (ResourceCategory category in Enum.GetValues(typeof(ResourceCategory)))
                ResourcesByCategory[category] = new List<string>();
        }



        /// <summary>
        /// All known manifests, in order of CLSTAMP.
        /// </summary>
        public static List<SnapshotManifest> KnownManifests;

        static SnapshotManifest()
        {
            KnownManifests = new List<SnapshotManifest>()
            {
                Circa_8622903_Now(),
                Circa_8200419_8601984(),
            }
            .OrderByDescending(a => a.MinCLSTAMP).ToList(); // newest to oldest
        }



        /// <summary>
        /// Gets a known manifest which most closely matches the supplied <paramref name="clstamp"/>.
        /// </summary>
        /// <param name="clstamp"></param>
        /// <param name="matchType"></param>
        /// <returns></returns>
        public static SnapshotManifest GetClosestManifestForClstamp(long clstamp, out ManifestMatchType matchType)
        {
            // If we have a perfect match, use that
            // Otherwise, use to the newest known manifest that is also closest to the provided CLSTAMP
            // Lastly, fall back to the latest known manifest if all known manifests are older than the provided clstamp

            foreach (SnapshotManifest knownManifest in KnownManifests) // this list is in order from newest to oldestd
            {
                if (clstamp >= knownManifest.MinCLSTAMP && clstamp <= knownManifest.MaxCLSTAMP)
                {
                    matchType = ManifestMatchType.ExactKnown;
                    return knownManifest;
                }
                else if (clstamp >= knownManifest.MinCLSTAMP && knownManifest.UnboundedMaxCLSTAMP)
                {
                    matchType = ManifestMatchType.ExactTentative;
                    return knownManifest;
                }
                else if (clstamp >= knownManifest.MinCLSTAMP)
                {
                    matchType = ManifestMatchType.ClosestNewer;
                    return knownManifest;
                }
            }

            matchType = ManifestMatchType.NewestKnown;
            return KnownManifests.Last();
        }

        public enum ManifestMatchType
        {
            Any,
            ExactKnown,
            ExactTentative,
            ClosestNewer,
            NewestKnown,
        }



        // ____________________________________________________________________________________________________
        // 
        //     Manifests for notable snapshots
        // ____________________________________________________________________________________________________
        //


        /// <summary>
        /// Manifest for steam-chat.com 8622903 to present (8804332 as of writing this).
        /// </summary>
        public static SnapshotManifest Circa_8622903_Now()
        {
            SnapshotManifest manifest = new SnapshotManifest(8622903, 8804332, true);


            // --------------------------------------------------
            //   Known resources
            // --------------------------------------------------

            //
            // HTML
            //

            manifest.ResourcesByCategory[ResourceCategory.Html].AddRange(new List<string>()
            {
                "index.html",
                "favicon.ico",
            });

            //
            // JS
            //

            manifest.ResourcesByCategory[ResourceCategory.Js].AddRange(new List<string>()
            {
                // libraries/react.production.min.js and libraries/react-dom.production.min.js were first observed to have been removed in 8622903 (circa January 12th 2024)
                // 461.js was also removed at the same time
                "public/javascript/webui/friends.js",
                "public/javascript/webui/libraries.js",
                "public/javascript/webui/libraries_cm.js",
                "public/javascript/webui/steammessages.js",
                "public/javascript/webui/noisegate-audio-worklet.js", // In friends.js nearly verbatim
                // Items without comments are directly referenced in the src="" attribute of the root html's <script> tags
            });

            //
            // json.js
            //

            List<string> jsonJs = new List<string>();
            
            foreach (string localeName in StaticData.ValveLocaleNames)
                jsonJs.Add(string.Format("public/javascript/webui/friendsui_{0}-json.js", localeName));
            
            foreach (string localeName in StaticData.ValveLocaleNames)
                jsonJs.Add(string.Format("public/javascript/webui/shared_{0}-json.js", localeName));
            
            manifest.ResourcesByCategory[ResourceCategory.JsonJs].AddRange(jsonJs);

            //
            // CSS
            //

            manifest.ResourcesByCategory[ResourceCategory.Css].AddRange(new List<string>()
            {
                // 461.css removed since at least 8622903
                "public/css/webui/broadcastapp.css", // In friends.js; Ctrl+F for ".css?contenthash="
                "public/css/webui/friends.css",
                "public/shared/css/motiva_sans.css",
                "public/shared/css/shared_global.css",
                // Items without comments are directly referenced in the href="" attribute of the root html's <link> tags
            });

            //
            // @font-faces
            //

            manifest.ResourcesByCategory[ResourceCategory.CssFonts].AddRange(new List<string>()
            {
                "public/shared/fonts/MotivaSans-Black.ttf",
                "public/shared/fonts/MotivaSans-Bold.ttf",
                "public/shared/fonts/MotivaSans-BoldItalic.ttf",
                "public/shared/fonts/MotivaSans-Light.ttf",
                "public/shared/fonts/MotivaSans-LightItalic.ttf",
                "public/shared/fonts/MotivaSans-Medium.ttf",
                "public/shared/fonts/MotivaSans-Regular.ttf",
                "public/shared/fonts/MotivaSans-RegularItalic.ttf",
                "public/shared/fonts/MotivaSans-Thin.ttf",
            });

            //
            // JS-referenced audio
            //

            manifest.ResourcesByCategory[ResourceCategory.JsAudio].AddRange(new List<string>()
            {
                "public/sounds/webui/steam_at_mention.m4a", // All of these are in friends.js verbatim
                "public/sounds/webui/steam_chatroom_notification.m4a", // And some are duplicated several times
                "public/sounds/webui/steam_phonecall.m4a",
                "public/sounds/webui/steam_rpt_join.m4a",
                "public/sounds/webui/steam_rpt_leave.m4a",
                "public/sounds/webui/steam_ui_ptt_short_01_quiet.m4a",
                "public/sounds/webui/steam_ui_ptt_short_02_quiet.m4a",
                "public/sounds/webui/steam_voice_channel_enter.m4a",
                "public/sounds/webui/steam_voice_channel_exit.m4a",
                "public/sounds/webui/ui_steam_message_old_smooth.m4a",
                "public/sounds/webui/ui_steam_smoother_friend_join.m4a",
                "public/sounds/webui/ui_steam_smoother_friend_online.m4a",
            });

            //
            // JS-referenced images
            //

            manifest.ResourcesByCategory[ResourceCategory.JsImages].AddRange(new List<string>()
            {
                "public/images/webui/8669e97b288da32670e77181618c3dfb.png", // In friends.js nearly verbatim
            });


            return manifest;
        }


        /// <summary>
        /// Manifest for steam-chat.com 8200419 to 8601984.
        /// </summary>
        /// <remarks>
        /// Adapted from version 1.0.0.0 of Snapshot Maker.
        /// </remarks>
        public static SnapshotManifest Circa_8200419_8601984()
        {
            SnapshotManifest manifest = new SnapshotManifest(8200419, 8601984);
            // Min CLSTAMP here is wrong. This manifest is valid for versions earlier than 8200419. But how far back does it go? I don't know, and I don't care to spent 20 hours finding out.
            // Max CLSTAMP here is probably correct. Afaik 8622903 was the immediate successor of 8601984, and 8622903 is when these files changed.


            // --------------------------------------------------
            //   Known resources
            // --------------------------------------------------

            //
            // HTML
            //

            manifest.ResourcesByCategory[ResourceCategory.Html].AddRange(new List<string>()
            {
                "index.html",
                "favicon.ico",
            });

            //
            // JS
            //

            manifest.ResourcesByCategory[ResourceCategory.Js].AddRange(new List<string>()
            {
                "public/javascript/webui/libraries/react.production.min.js",
                "public/javascript/webui/libraries/react-dom.production.min.js",
                "public/javascript/webui/461.js", // Not directly referenced anywhere, but maybe(?) used
                "public/javascript/webui/friends.js",
                "public/javascript/webui/libraries.js",
                "public/javascript/webui/libraries_cm.js",
                "public/javascript/webui/steammessages.js",
                "public/javascript/webui/noisegate-audio-worklet.js", // In friends.js nearly verbatim
                // Items without comments are directly referenced in the src="" attribute of the root html's <script> tags
            });

            //
            // json.js
            //

            List<string> jsonJs = new List<string>();
            
            foreach (string localeName in StaticData.ValveLocaleNames)
                jsonJs.Add(string.Format("public/javascript/webui/friendsui_{0}-json.js", localeName));
            
            foreach (string localeName in StaticData.ValveLocaleNames)
                jsonJs.Add(string.Format("public/javascript/webui/shared_{0}-json.js", localeName));
            
            manifest.ResourcesByCategory[ResourceCategory.JsonJs].AddRange(jsonJs);

            //
            // CSS
            //

            manifest.ResourcesByCategory[ResourceCategory.Css].AddRange(new List<string>()
            {
                "public/css/webui/461.css", // Not directly referenced anywhere, but maybe(?) used
                "public/css/webui/broadcastapp.css", // In friends.js; Ctrl+F for ".css?contenthash="
                "public/css/webui/friends.css",
                "public/shared/css/motiva_sans.css",
                "public/shared/css/shared_global.css",
                // Items without comments are directly referenced in the href="" attribute of the root html's <link> tags
            });

            //
            // @font-faces
            //

            manifest.ResourcesByCategory[ResourceCategory.CssFonts].AddRange(new List<string>()
            {
                "public/shared/fonts/MotivaSans-Black.ttf",
                "public/shared/fonts/MotivaSans-Bold.ttf",
                "public/shared/fonts/MotivaSans-BoldItalic.ttf",
                "public/shared/fonts/MotivaSans-Light.ttf",
                "public/shared/fonts/MotivaSans-LightItalic.ttf",
                "public/shared/fonts/MotivaSans-Medium.ttf",
                "public/shared/fonts/MotivaSans-Regular.ttf",
                "public/shared/fonts/MotivaSans-RegularItalic.ttf",
                "public/shared/fonts/MotivaSans-Thin.ttf",
            });

            //
            // JS-referenced audio
            //

            manifest.ResourcesByCategory[ResourceCategory.JsAudio].AddRange(new List<string>()
            {
                "public/sounds/webui/steam_at_mention.m4a", // All of these are in friends.js verbatim
                "public/sounds/webui/steam_chatroom_notification.m4a", // And some are duplicated several times
                "public/sounds/webui/steam_phonecall.m4a",
                "public/sounds/webui/steam_rpt_join.m4a",
                "public/sounds/webui/steam_rpt_leave.m4a",
                "public/sounds/webui/steam_ui_ptt_short_01_quiet.m4a",
                "public/sounds/webui/steam_ui_ptt_short_02_quiet.m4a",
                "public/sounds/webui/steam_voice_channel_enter.m4a",
                "public/sounds/webui/steam_voice_channel_exit.m4a",
                "public/sounds/webui/ui_steam_message_old_smooth.m4a",
                "public/sounds/webui/ui_steam_smoother_friend_join.m4a",
                "public/sounds/webui/ui_steam_smoother_friend_online.m4a",
            });

            //
            // JS-referenced images
            //

            manifest.ResourcesByCategory[ResourceCategory.JsImages].AddRange(new List<string>()
            {
                "public/images/webui/8669e97b288da32670e77181618c3dfb.png", // In friends.js nearly verbatim
            });


            return manifest;
        }

    }
}
