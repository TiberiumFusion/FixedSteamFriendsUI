using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using System.Xml;
using System.Xml.Linq;
using System.Xml.Serialization;

namespace TiberiumFusion.FixedSteamFriendsUI.PatchFilesPackager
{
    class Program
    {
        public const string OutputDirectoryName = "build";

        public const int Result_Success = 0;
        public const int Result_Error = 1;

        public static int Main(string[] args)
        {
            DateTime buildStartTimeUtc = DateTime.UtcNow;


            // ____________________________________________________________________________________________________
            // 
            //     Preparation
            // ____________________________________________________________________________________________________
            //
            
            //
            // Discover paths
            //

            Console.WriteLine("Discovering paths...");

            string projectDirPath = Path.GetFullPath(args[0]);
            if (!Directory.Exists(projectDirPath))
            {
                Console.WriteLine("[!!!] Invalid project root directory [!!!]");
                Console.WriteLine("Directory does not exist: " + projectDirPath);
                return Result_Error;
            }

            string inputFilesRootDirPath = Path.Combine(projectDirPath, "Patch");
            if (!Directory.Exists(inputFilesRootDirPath))
            {
                Console.WriteLine("[!!!] Unable to find input files [!!!]");
                Console.WriteLine("Directory does not exist: " + inputFilesRootDirPath);
                return Result_Error;
            }


            //
            // Prepare output folder
            //
            
            string outputDirPath = Path.Combine(projectDirPath, OutputDirectoryName);
            Directory.CreateDirectory(outputDirPath);

            string buildWorkingDirPath = Path.Combine(outputDirPath, "Patch");

            Console.WriteLine("Cleaning output working directory...");

            if (Directory.Exists(buildWorkingDirPath))
            {
                try
                {
                    Directory.Delete(buildWorkingDirPath, true);
                }
                catch (Exception e)
                {
                    Console.WriteLine(e);
                    return Result_Error;
                }
            }

            Directory.CreateDirectory(buildWorkingDirPath);



            // ____________________________________________________________________________________________________
            // 
            //     Build patch files
            // ____________________________________________________________________________________________________
            //

            //
            // Copy source files to output
            //

            Console.WriteLine("Copying input files to output dir...");

            try
            {
                Helpers.CopyDirectory(inputFilesRootDirPath, buildWorkingDirPath, true);
            }
            catch (Exception e)
            {
                Console.WriteLine("[!!!] Failed to copy files [!!!]");
                Console.WriteLine(e);
                return Result_Error;
            }


            //
            // Load template directives
            //

            Console.WriteLine("Reading template directives...");

            string templateDirectivesPath = Path.Combine(projectDirPath, "TemplateDirectives.xml");
            if (!File.Exists(templateDirectivesPath))
            {
                Console.WriteLine("[!!!] Template directives not found [!!!]");
                Console.WriteLine("File does not exist: " + templateDirectivesPath);
                return Result_Error;
            }

            TemplateDirectives tds = null;
            try
            {
                using (FileStream fs = new FileStream(templateDirectivesPath, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    tds = TemplateDirectives.FromStream(fs);
                }
            }
            catch (Exception e)
            {
                Console.WriteLine("[!!!] Failed to read TemplateDirectives.xml [!!!]");
                Console.WriteLine(e);
                return Result_Error;
            }
            

            //
            // Evaluate auto directives
            //

            if (string.IsNullOrWhiteSpace(tds.VersionGuid) || tds.VersionGuid == "auto")
            {
                tds.VersionGuid = Guid.NewGuid().ToString("B");
                Console.WriteLine("Auto directive VersionGuid = " + tds.VersionGuid);
            }
            
            if (tds.ReleaseDate <= 0)
            {
                tds.ReleaseDate = Helpers.GetUnixEpochSeconds(buildStartTimeUtc);
                Console.WriteLine("Auto directive ReleaseDate = " + tds.ReleaseDate);
            }

            if (string.IsNullOrWhiteSpace(tds.ReleaseDateFriendly) || tds.ReleaseDateFriendly == "auto")
            {
                tds.ReleaseDateFriendly = Helpers.GetDateTimeFromUnixEpochSeconds(tds.ReleaseDate).ToString("MMMM d, yyyy");
                Console.WriteLine("Auto directive ReleaseDateFriendly = " + tds.ReleaseDateFriendly);
            }


            //
            // Replace placeholders in copied files
            //

            List<PropertyInfo> tdProps = tds.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance).Where(p => Attribute.IsDefined(p, typeof(XmlElementAttribute))).ToList();

            string[] targets = new string[]
            {
                @"clientui\friends.js",
                @"clientui\steam-chat.com-snapshot-mod\staticdata.json5",
            };

            foreach (string targetSubpath in targets)
            {
                Console.WriteLine("Processing " + targetSubpath + "...");

                string targetPath = Path.Combine(buildWorkingDirPath, targetSubpath);
                if (!File.Exists(targetPath))
                {
                    Console.WriteLine("[!!!] Target file not found [!!!]");
                    Console.WriteLine("File does not exist: " + targetPath);
                    return Result_Error;
                }

                string contents;
                try
                {
                    contents = File.ReadAllText(targetPath);
                }
                catch (Exception e)
                {
                    Console.WriteLine("[!!!] Failed to read target file [!!!]");
                    Console.WriteLine(e);
                    return Result_Error;
                }

                bool replacedAny = false;
                StringBuilder buffer = new StringBuilder(contents);
                foreach (PropertyInfo tdProp in tdProps)
                {
                    string placeholder = "<<![" + tdProp.Name + "]>>";
                    if (contents.Contains(placeholder))
                    {
                        replacedAny = true;
                        buffer.Replace(placeholder, tdProp.GetValue(tds).ToString());
                    }
                }

                if (replacedAny)
                {
                    Console.WriteLine("Directives placed. Writing modified contents back to disk...");

                    contents = buffer.ToString();

                    try
                    {
                        File.WriteAllText(targetPath, contents);
                    }
                    catch (Exception e)
                    {
                        Console.WriteLine("[!!!] Failed to write modified file [!!!]");
                        Console.WriteLine(e);
                        return Result_Error;
                    }
                }
                else
                {
                    Console.WriteLine("No directives matched");
                }
            }


            //
            // Amend payload folder name with version guid
            //

            Console.WriteLine("Renaming patch payload folder...");

            string payloadDirPath = Path.Combine(buildWorkingDirPath, @"clientui\steam-chat.com-snapshot-mod");
            if (!Directory.Exists(payloadDirPath))
            {
                Console.WriteLine("[!!!] Patch payload directory not found [!!!]");
                Console.WriteLine("Directory does not exist: " + payloadDirPath);
                return Result_Error;
            }

            string payloadRenamedDirPath = Path.Combine(buildWorkingDirPath, @"clientui\steam-chat.com-snapshot-mod-" + tds.VersionGuid);
            try
            {
                Directory.Move(payloadDirPath, payloadRenamedDirPath);
            }
            catch (Exception e)
            {
                Console.WriteLine("[!!!] Failed to rename payload directory [!!!]");
                Console.WriteLine("Destination name: " + payloadRenamedDirPath);
                Console.WriteLine(e);
                return Result_Error;
            }



            // ____________________________________________________________________________________________________
            // 
            //     Package patch files
            // ____________________________________________________________________________________________________
            //

            Console.WriteLine("Packaging patch files...");

            string archiveName = string.Format("PatchPayload_v{0}-{1}.zip", tds.Version, tds.VersionGuid);

            string packagePath = Path.Combine(outputDirPath, archiveName);

            try
            {
                ZipFile.CreateFromDirectory(buildWorkingDirPath, packagePath, CompressionLevel.Optimal, false);
            }
            catch (Exception e)
            {
                Console.WriteLine("[!!!] Failed to package patch files [!!!]");
                Console.WriteLine("Destination: " + packagePath);
                Console.WriteLine(e);
                return Result_Error;
            }
            


            ///// Done
            return Result_Success;
        }
    }
}
