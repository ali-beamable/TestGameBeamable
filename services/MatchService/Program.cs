using Beamable.Server;
using System.Threading.Tasks;

namespace Beamable.MatchService
{
	public class Program
	{
		/// <summary>
		/// The entry point for the <see cref="MatchService"/> service.
		/// </summary>
		public static async Task Main()
		{
			await BeamServer
				.Create()
				.IncludeRoutes<MatchService>(routePrefix: "")
				.RunForever();
		}
	}
}
