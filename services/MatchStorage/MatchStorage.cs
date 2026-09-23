using Beamable.Server;

namespace Beamable.Server
{
	/// <summary>
	/// This class represents the existence of the MatchStorage database.
	/// Use it for type safe access to the database.
	/// <code>
	/// var db = await Storage.GetDatabase&lt;MatchStorage&gt;();
	/// </code>
	/// </summary>
	[StorageObject("MatchStorage")]
	public class MatchStorage : MongoStorageObject
	{
		
	}
}
