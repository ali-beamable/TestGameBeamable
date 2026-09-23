using System;
using System.Collections.Generic;
using MongoDB.Bson.Serialization.Attributes;

namespace Beamable.Server
{
	/// <summary>
	/// One Rock-Paper-Scissors match session, stored in the "matches" collection of MatchStorage.
	/// </summary>
	[BsonIgnoreExtraElements]
	public class MatchRecord : StorageDocument
	{
		public const string CollectionName = "matches";

		public long PlayerId;
		public DateTime StartedAt;
		public DateTime? EndedAt;

		/// <summary>One of <see cref="MatchStatus"/>.</summary>
		public string Status = MatchStatus.InProgress;

		public int PlayerWins;
		public int CpuWins;
		public List<RoundRecord> Rounds = new List<RoundRecord>();
	}

	public class RoundRecord
	{
		public string PlayerMove;
		public string CpuMove;

		/// <summary>"player", "cpu" or "tie".</summary>
		public string Winner;
		public DateTime PlayedAt;
	}

	public static class MatchStatus
	{
		public const string InProgress = "in_progress";
		public const string Won = "won";
		public const string Lost = "lost";
		public const string Draw = "draw";
		public const string Forfeit = "forfeit";

		public static bool IsFinished(string status) => status != InProgress;
	}
}
