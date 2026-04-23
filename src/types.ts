export type SlotState = 'waiting' | 'checked';

// Client → Server
export interface JoinMsg       { type: 'join';              token: string; }
export interface PingMsg       { type: 'ping'; }
export interface CheckMsg      { type: 'check';             token: string; }
export interface ViewportSubMsg { type: 'viewport_subscribe'; from_position: number; to_position: number; }

export type ClientMessage = JoinMsg | PingMsg | CheckMsg | ViewportSubMsg;

// Server → Client
export interface JoinedMsg {
  type: 'joined';
  seq: number;
  position: number; // Absolute
  waiting_position: number; // Current place in waiting line
}

export interface JoinRejectedMsg { type: 'join_rejected'; reason: 'rate_limited' | 'other'; }
export interface PongMsg { type: 'pong'; }

export interface CheckOkMsg {
  type: 'check_ok';
  position: number;
  duration_ms: number;
}

export interface CheckRejectedMsg {
  type: 'check_rejected';
  reason: 'not_eligible' | 'already_checked';
}

export interface WinnerMsg {
  type: 'winner';
  seq: number;
  position: number;
  duration_ms: number;
}

export interface LeftMsg {
  type: 'left';
  seq: number;
  departures_today: number;
}

export interface PositionUpdateMsg {
  type: 'position_update';
  position: number; // Absolute
  waiting_position: number; // Current place in waiting line
}

export interface SlotSummary {
  seq: number;
  position: number;
  state: SlotState;
}

export interface RangeStateMsg {
  type: 'range_state';
  slots: SlotSummary[];
  total: number;
}

export interface RangeUpdateMsg {
  type: 'range_update';
  seq: number;
  position: number;
  state: SlotState;
}

export type ServerMessage =
  | JoinedMsg | JoinRejectedMsg | PongMsg
  | CheckOkMsg | CheckRejectedMsg
  | WinnerMsg | LeftMsg | PositionUpdateMsg
  | RangeStateMsg | RangeUpdateMsg;
