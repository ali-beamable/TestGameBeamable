/**
 * ⚠️ THIS FILE IS AUTO-GENERATED. DO NOT EDIT MANUALLY.
 * All manual edits will be lost when this file is regenerated.
 */

export type MatchView = { 
  matchId: string; 
  status: string; 
  playerWins: number; 
  cpuWins: number; 
  roundsPlayed: number; 
  winsNeeded: number; 
  startedAt: string; 
  endedAt: string; 
};

export type RoundResult = { 
  playerMove: string; 
  cpuMove: string; 
  roundWinner: string; 
  match: MatchView; 
};

export type PlayRoundRequestArgs = { 
  matchId: string; 
  move: string; 
};

export type ForfeitRequestArgs = { 
  matchId: string; 
};

export type MatchHistory = { 
  wins: number; 
  losses: number; 
  draws: number; 
  forfeits: number; 
  recent: MatchView[]; 
};

export type GetMyHistoryRequestArgs = { 
  limit: number; 
};
