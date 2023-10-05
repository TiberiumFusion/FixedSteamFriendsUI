using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TiberiumFusion.FixedSteamFriendsUI.QuickPatcher.Infra
{
    // Dirty rip of System.IO.Compression.FileSystem's ZipFileExtension with progress notifications added
    public static class ZipFileExtensions
    {
        public static ZipArchiveEntry CreateEntryFromFile(this ZipArchive destination, string sourceFileName, string entryName)
        {
            return DoCreateEntryFromFile(destination, sourceFileName, entryName, null);
        }

        public static ZipArchiveEntry CreateEntryFromFile(this ZipArchive destination, string sourceFileName, string entryName, CompressionLevel compressionLevel)
        {
            return DoCreateEntryFromFile(destination, sourceFileName, entryName, compressionLevel);
        }

        public delegate void NotifyExtractFile(string archiveEntryPath, string destinationPath);

        public static void ExtractToDirectoryEx(this ZipArchive source, string destinationDirectoryName, NotifyExtractFile notifyExtractFile = null)
        {
            if (source == null)
            {
                throw new ArgumentNullException("source");
            }
            if (destinationDirectoryName == null)
            {
                throw new ArgumentNullException("destinationDirectoryName");
            }
            DirectoryInfo directoryInfo = Directory.CreateDirectory(destinationDirectoryName);
            string text = directoryInfo.FullName;
            //if (!LocalAppContextSwitches.DoNotAddTrailingSeparator)
            if (!false)
            {
                int length = text.Length;
                if (length != 0 && text[length - 1] != Path.DirectorySeparatorChar)
                {
                    text += Path.DirectorySeparatorChar.ToString();
                }
            }
            foreach (ZipArchiveEntry entry in source.Entries)
            {
                string fullPath = Path.GetFullPath(Path.Combine(text, entry.FullName));
                if (!fullPath.StartsWith(text, StringComparison.OrdinalIgnoreCase))
                {
                    //throw new IOException(SR.GetString("IO_ExtractingResultsInOutside")); // SR is sealed and internal
                    throw new IOException("Extracting Zip entry would have resulted in a file outside the specified destination directory.");
                }
                if (Path.GetFileName(fullPath).Length == 0)
                {
                    if (entry.Length != 0L)
                    {
                        //throw new IOException(SR.GetString("IO_DirectoryNameWithData"));
                        throw new IOException("Zip entry name ends in directory separator character but contains data.");
                    }
                    Directory.CreateDirectory(fullPath);
                }
                else
                {
                    notifyExtractFile?.Invoke(entry.FullName, fullPath);
                    Directory.CreateDirectory(Path.GetDirectoryName(fullPath));
                    entry.ExtractToFile(fullPath, false);
                }
            }
        }

        internal static ZipArchiveEntry DoCreateEntryFromFile(ZipArchive destination, string sourceFileName, string entryName, CompressionLevel? compressionLevel)
        {
            if (destination == null)
            {
                throw new ArgumentNullException("destination");
            }
            if (sourceFileName == null)
            {
                throw new ArgumentNullException("sourceFileName");
            }
            if (entryName == null)
            {
                throw new ArgumentNullException("entryName");
            }
            using (Stream stream = File.Open(sourceFileName, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                ZipArchiveEntry zipArchiveEntry = compressionLevel.HasValue ? destination.CreateEntry(entryName, compressionLevel.Value) : destination.CreateEntry(entryName);
                DateTime dateTime = File.GetLastWriteTime(sourceFileName);
                if (dateTime.Year < 1980 || dateTime.Year > 2107)
                {
                    dateTime = new DateTime(1980, 1, 1, 0, 0, 0);
                }
                zipArchiveEntry.LastWriteTime = dateTime;
                using (Stream destination2 = zipArchiveEntry.Open())
                {
                    stream.CopyTo(destination2);
                }
                return zipArchiveEntry;
            }
        }

        public static void ExtractToFile(this ZipArchiveEntry source, string destinationFileName)
        {
            source.ExtractToFile(destinationFileName, false);
        }

        public static void ExtractToFile(this ZipArchiveEntry source, string destinationFileName, bool overwrite)
        {
            if (source == null)
            {
                throw new ArgumentNullException("source");
            }
            if (destinationFileName == null)
            {
                throw new ArgumentNullException("destinationFileName");
            }
            FileMode mode = (!overwrite) ? FileMode.CreateNew : FileMode.Create;
            using (Stream destination = File.Open(destinationFileName, mode, FileAccess.Write, FileShare.None))
            {
                using (Stream stream = source.Open())
                {
                    stream.CopyTo(destination);
                }
            }
            File.SetLastWriteTime(destinationFileName, source.LastWriteTime.DateTime);
        }
    }
}
