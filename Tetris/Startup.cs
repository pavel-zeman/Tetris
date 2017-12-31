using System;
using Microsoft.AspNet.Identity.EntityFramework;
using Microsoft.AspNet.SignalR;
using Microsoft.Owin;
using Newtonsoft.Json;
using Owin;
using Tetris;
using Tetris.Models;

[assembly: OwinStartup(typeof(Startup))]

namespace Tetris
{
    public partial class Startup
    {
        private static readonly Lazy<JsonSerializer> jsonSerializerFactory = new Lazy<JsonSerializer>(GetJsonSerializer);

        private static JsonSerializer GetJsonSerializer()
        {
            return new JsonSerializer
            {
                ContractResolver = new FilteredCamelCasePropertyNamesContractResolver
                {
                    AssembliesToInclude =
                    {
                        typeof(Startup).Assembly
                    }
                }
            };
        }

        public void Configuration(IAppBuilder app)
        {
            ConfigureAuth(app);
            app.MapSignalR();
            GlobalHost.DependencyResolver.Register(typeof(JsonSerializer), () => jsonSerializerFactory.Value);
        }
    }
}