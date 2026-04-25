export interface EnduranceEntry {
  seq: number;
  duration_ms: number;
  timestamp: number;
}

export interface IEndurance {
  addEntry(seq: number, duration_ms: number): Promise<void>;
  getTop(limit: number): Promise<EnduranceEntry[]>;
}
