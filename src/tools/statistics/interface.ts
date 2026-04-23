export interface IStatistics {
  /**
   * Increments the departure counter for the current day.
   */
  incrementDepartures(): Promise<number>;

  /**
   * Returns the total number of departures recorded today.
   */
  getDeparturesToday(): Promise<number>;
}
