using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Beamable.Server;
using MongoDB.Driver;

namespace Beamable.MatchService
{
	/// <summary>
	/// Server-authoritative Rock-Paper-Scissors. A match is a "first to <see cref="WinsNeeded"/>" session
	/// against a CPU opponent; every match and its final outcome is recorded in the MatchStorage microstorage.
	/// </summary>
	public partial class MatchService : Microservice
	{
		public const int WinsNeeded = 2;
		public const int MaxRounds = 9;

		static readonly string[] Moves = { "rock", "paper", "scissors" };
		static readonly Random Rng = new Random();

		/// <summary>Starts a new match session. Any match the player left unfinished is recorded as a forfeit.</summary>
		[ClientCallable]
		public async Task<MatchView> StartMatch()
		{
			var matches = await Matches();
			var playerId = Context.UserId;
			var now = DateTime.UtcNow;

			await matches.UpdateManyAsync(
				m => m.PlayerId == playerId && m.Status == MatchStatus.InProgress,
				Builders<MatchRecord>.Update.Set(m => m.Status, MatchStatus.Forfeit).Set(m => m.EndedAt, now));

			var match = new MatchRecord { PlayerId = playerId, StartedAt = now };
			await matches.InsertOneAsync(match);
			return MatchView.From(match);
		}

		/// <summary>Plays one round of the given match. The CPU move is chosen on the server.</summary>
		[ClientCallable]
		public async Task<RoundResult> PlayRound(string matchId, string move)
		{
			move = move?.Trim().ToLowerInvariant();
			if (!Moves.Contains(move))
				throw new MicroserviceException(400, "InvalidMove", $"Move must be one of: {string.Join(", ", Moves)}");

			var matches = await Matches();
			var match = await FindOwnMatch(matches, matchId);
			if (MatchStatus.IsFinished(match.Status))
				throw new MicroserviceException(409, "MatchFinished", "This match is already over.");

			string cpuMove;
			lock (Rng) cpuMove = Moves[Rng.Next(Moves.Length)];

			var winner = Resolve(move, cpuMove);
			if (winner == "player") match.PlayerWins++;
			else if (winner == "cpu") match.CpuWins++;
			match.Rounds.Add(new RoundRecord { PlayerMove = move, CpuMove = cpuMove, Winner = winner, PlayedAt = DateTime.UtcNow });

			if (match.PlayerWins >= WinsNeeded) Finish(match, MatchStatus.Won);
			else if (match.CpuWins >= WinsNeeded) Finish(match, MatchStatus.Lost);
			else if (match.Rounds.Count >= MaxRounds)
				Finish(match, match.PlayerWins > match.CpuWins ? MatchStatus.Won
					: match.CpuWins > match.PlayerWins ? MatchStatus.Lost
					: MatchStatus.Draw);

			await matches.ReplaceOneAsync(m => m.Id == match.Id, match);
			return new RoundResult { playerMove = move, cpuMove = cpuMove, roundWinner = winner, match = MatchView.From(match) };
		}

		/// <summary>Gives up the given match; it is recorded as a forfeit.</summary>
		[ClientCallable]
		public async Task<MatchView> Forfeit(string matchId)
		{
			var matches = await Matches();
			var match = await FindOwnMatch(matches, matchId);
			if (!MatchStatus.IsFinished(match.Status))
			{
				Finish(match, MatchStatus.Forfeit);
				await matches.ReplaceOneAsync(m => m.Id == match.Id, match);
			}
			return MatchView.From(match);
		}

		/// <summary>Returns the calling player's most recent finished matches, newest first.</summary>
		[ClientCallable]
		public async Task<MatchHistory> GetMyHistory(int limit)
		{
			limit = Math.Clamp(limit <= 0 ? 10 : limit, 1, 50);
			var matches = await Matches();
			var playerId = Context.UserId;
			var finished = Builders<MatchRecord>.Filter.Where(m => m.PlayerId == playerId && m.Status != MatchStatus.InProgress);

			var recent = await matches.Find(finished).SortByDescending(m => m.EndedAt).Limit(limit).ToListAsync();
			var counts = await matches.Aggregate().Match(finished)
				.Group(m => m.Status, g => new { Status = g.Key, Count = g.Count() })
				.ToListAsync();
			int Count(string status) => counts.FirstOrDefault(c => c.Status == status)?.Count ?? 0;

			return new MatchHistory
			{
				wins = Count(MatchStatus.Won),
				losses = Count(MatchStatus.Lost),
				draws = Count(MatchStatus.Draw),
				forfeits = Count(MatchStatus.Forfeit),
				recent = recent.Select(MatchView.From).ToArray(),
			};
		}

		async Task<IMongoCollection<MatchRecord>> Matches() =>
			await Storage.MatchStorageCollection<MatchRecord>(MatchRecord.CollectionName);

		async Task<MatchRecord> FindOwnMatch(IMongoCollection<MatchRecord> matches, string matchId)
		{
			if (string.IsNullOrWhiteSpace(matchId) || !MongoDB.Bson.ObjectId.TryParse(matchId, out _))
				throw new MicroserviceException(400, "InvalidMatchId", "A valid matchId is required.");

			var playerId = Context.UserId;
			var match = await matches.Find(m => m.Id == matchId && m.PlayerId == playerId).FirstOrDefaultAsync();
			return match ?? throw new MicroserviceException(404, "MatchNotFound", "No such match for this player.");
		}

		static void Finish(MatchRecord match, string status)
		{
			match.Status = status;
			match.EndedAt = DateTime.UtcNow;
		}

		static string Resolve(string player, string cpu)
		{
			if (player == cpu) return "tie";
			var playerWins = (player == "rock" && cpu == "scissors")
				|| (player == "paper" && cpu == "rock")
				|| (player == "scissors" && cpu == "paper");
			return playerWins ? "player" : "cpu";
		}
	}

	[Serializable]
	public class MatchView
	{
		public string matchId;
		public string status;
		public int playerWins;
		public int cpuWins;
		public int roundsPlayed;
		public int winsNeeded;
		/// <summary>ISO-8601 UTC timestamps; endedAt is empty while the match is in progress.</summary>
		public string startedAt;
		public string endedAt;

		public static MatchView From(MatchRecord m) => new MatchView
		{
			matchId = m.Id,
			status = m.Status,
			playerWins = m.PlayerWins,
			cpuWins = m.CpuWins,
			roundsPlayed = m.Rounds.Count,
			winsNeeded = MatchService.WinsNeeded,
			startedAt = DateTime.SpecifyKind(m.StartedAt, DateTimeKind.Utc).ToString("o"),
			endedAt = m.EndedAt.HasValue ? DateTime.SpecifyKind(m.EndedAt.Value, DateTimeKind.Utc).ToString("o") : "",
		};
	}

	[Serializable]
	public class RoundResult
	{
		public string playerMove;
		public string cpuMove;
		public string roundWinner;
		public MatchView match;
	}

	[Serializable]
	public class MatchHistory
	{
		public int wins;
		public int losses;
		public int draws;
		public int forfeits;
		public MatchView[] recent;
	}
}
