using System;
using System.Collections.Generic;
using System.Reflection;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace Tetris
{
    public class FilteredCamelCasePropertyNamesContractResolver : DefaultContractResolver
    {
        public FilteredCamelCasePropertyNamesContractResolver()
        {
            AssembliesToInclude = new HashSet<Assembly>();
        }

        // Identifies assemblies to include in camel-casing
        public HashSet<Assembly> AssembliesToInclude { get; set; }

        protected override JsonProperty CreateProperty(MemberInfo member, MemberSerialization memberSerialization)
        {
            var jsonProperty = base.CreateProperty(member, memberSerialization);
            var declaringType = member.DeclaringType;
            if (AssembliesToInclude.Contains(declaringType.Assembly))
            {
                jsonProperty.PropertyName = jsonProperty.PropertyName.Substring(0, 1).ToLowerInvariant() + jsonProperty.PropertyName.Substring(1);
            }
            return jsonProperty;
        }
    }
}