using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher
{
    public static class Helpers
    {

        public static T GetSteamRegistryKeyValue<T>(string valueName)
        {
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam", false))
            {
                string[] vns = key.GetValueNames();
                if (vns.Contains(valueName))
                {
                    return (T)key.GetValue(valueName, null);
                }
            }

            return default(T);
        }

        public static T GetSteamRegistryKeyValue<T>(string subkeyPath, string valueName)
        {
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam\" + subkeyPath, false))
            {
                string[] vns = key.GetValueNames();
                if (vns.Contains(valueName))
                {
                    return (T)key.GetValue(valueName, null);
                }
            }

            return default(T);
        }


        // https://stackoverflow.com/a/326153
        public static string GetPathRealCapitalization(string pathName)
        {
            var di = new DirectoryInfo(pathName);

            if (di.Parent != null)
            {
                return Path.Combine(
                    GetPathRealCapitalization(di.Parent.FullName),
                    di.Parent.GetFileSystemInfos(di.Name)[0].Name);
            }
            else
            {
                return di.Name.ToUpper();
            }
        }


        public static string GetSteamPathRegValue()
        {
            string steamPath = GetSteamRegistryKeyValue<string>("SteamPath");
            if (steamPath != null && Directory.Exists(steamPath))
            {
                // Steam writes this value in all lowercase, so let's fix it up into the real path's capitalization
                return GetPathRealCapitalization(steamPath);
            }
            else
            {
                return steamPath;
            }
        }


        private static Random TryCreateTestFsObject_Random = new Random();
        private static string TryCreateTestFsObject_RandomCharPool = "abcdefghijklmnopqrstuvwxyz0123456789";

        public static bool TryCreateTestFsObject(string targetDirectory, bool fileOrDir, out Exception error, string testObjectName = "__test_5up3r_1337_m8_") // probably unique
        {
            if (!Directory.Exists(targetDirectory))
                throw new DirectoryNotFoundException();

            string useTestObjectName = testObjectName;
            string fullpath;
            do
            {
                useTestObjectName += TryCreateTestFsObject_RandomCharPool[TryCreateTestFsObject_Random.Next(TryCreateTestFsObject_RandomCharPool.Length)];
                fullpath = Path.Combine(targetDirectory, useTestObjectName);

                if ((!fileOrDir && fullpath.Length > 248) || (fileOrDir && fullpath.Length > 260)) // MAX_PATH
                    throw new Exception("Incredibly, an object already exists at path: " + fullpath);
            }
            while (
                   (!fileOrDir && File.Exists(fullpath))
                || (fileOrDir && Directory.Exists(fullpath))
            );

            try
            {
                if (!fileOrDir)
                {
                    Directory.CreateDirectory(fullpath);
                    Directory.Delete(fullpath);
                }
                else
                {
                    FileStream fs = File.Create(fullpath);
                    fs.Dispose();
                    File.Delete(fullpath);
                }
                error = null;
                return true;
            }
            catch (Exception e)
            {
                error = e;
                return false;
            }
        }

        public static bool DirectoryPathsEqual(string a, string b)
        {
            string aCanon = Path.GetFullPath(a).TrimEnd('\\');
            string bCanon = Path.GetFullPath(b).TrimEnd('\\');
            return (aCanon == bCanon);
        }


        public static bool DirectoryHasSubdirectory(string outer, string inner, bool caseInsensitive)
        {
            string outerCanon = Path.GetFullPath(outer).TrimEnd('\\');
            string innerCanon = Path.GetFullPath(inner).TrimEnd('\\');

            if (caseInsensitive)
            {
                outerCanon = outerCanon.ToLowerInvariant();
                innerCanon = innerCanon.ToLowerInvariant();
            }

            if (outerCanon.Length > innerCanon.Length)
                return false;

            return (inner.Substring(0, outer.Length) == outer);
        }

    }
}
