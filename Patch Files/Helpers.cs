using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TiberiumFusion.FixedSteamFriendsUI.PatchFilesPackager
{
    public static class Helpers
    {
        // Unix epoch time
        public static readonly DateTime UnixEpoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        public static long GetUnixEpochSeconds(DateTime dt)
        {
            return Convert.ToInt64(dt.Subtract(UnixEpoch).TotalSeconds);
        }
        public static DateTime GetDateTimeFromUnixEpochSeconds(long seconds)
        {
            return UnixEpoch.AddSeconds(seconds);
        }

        // Obligatory directory copy boilerplate
        public static void CopyDirectory(string sourcePath, string destPath, bool recursive = true)
        {
            DirectoryInfo sourceDi = new DirectoryInfo(sourcePath);
            if (!sourceDi.Exists)
                throw new DirectoryNotFoundException("Source directory does not exist: " + sourcePath);
            
            void copyDir(DirectoryInfo sourceDir, string destDirPath)
            {
                Directory.CreateDirectory(destDirPath);

                foreach (FileInfo file in sourceDir.GetFiles())
                {
                    string fileDestPath = Path.Combine(destDirPath, file.Name);
                    file.CopyTo(fileDestPath);
                }

                if (recursive)
                {
                    foreach (DirectoryInfo subdir in sourceDir.GetDirectories())
                        copyDir(subdir, Path.Combine(destDirPath, subdir.Name));
                }
            }

            copyDir(sourceDi, destPath);
        }
    }
}
