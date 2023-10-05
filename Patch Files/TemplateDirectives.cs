using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml.Serialization;

namespace TiberiumFusion.FixedSteamFriendsUI.PatchFilesPackager
{
    [XmlRoot]
    public class TemplateDirectives
    {
        [XmlElement]
        public string Version { get; set; }

        [XmlElement]
        public string VersionGuid { get; set; }

        [XmlElement]
        public long ReleaseDate { get; set; }
        
        [XmlElement]
        public string ReleaseDateFriendly { get; set; }


        public static TemplateDirectives FromStream(Stream stream)
        {
            XmlSerializer xs = new XmlSerializer(typeof(TemplateDirectives));
            return (TemplateDirectives)xs.Deserialize(stream);
        }
    }
}
