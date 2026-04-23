export interface WinnerEntry {
  seq: number;
  position: number;
  duration_ms: number;
  timestamp: number;
}

export interface ILeaderboard {
  /**
   * Adds a winner to the leaderboard.
   */
  addWinner(seq: number, position: number, duration_ms: number): Promise<void>;

  /**
   * Retrieves the top N winners, ordered by the most recent.
   */
  getRecentWinners(limit: number): Promise<WinnerEntry[]>;
}
