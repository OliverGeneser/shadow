import WebSocket from "@fastify/websocket";

export type Subset<T extends U, U> = U;

export type Room = Set<WebSocket.WebSocket>;
export type Metadata = { clientId: string; roomId: string };

export type Rooms = Map<string, Room>;
export type WebSocketMetadata = Map<WebSocket.WebSocket, Metadata>;

export type RoomData = {
  roomId?: string;
  type: "create or join";
};

export type LeaveData = {
  type: "leave";
};

export type ClientsData = {
  type: "clients";
};

export type SignalOfferData = {
  signal: unknown;
  type: "signal-offer";
};

export type SignalAnswerData = {
  signal: unknown;
  type: "signal-answer";
};

export type SignalCandidateData = {
  signal: unknown;
  type: "signal-candidate";
};

export type Data =
  | RoomData
  | LeaveData
  | ClientsData
  | SignalOfferData
  | SignalAnswerData
  | SignalCandidateData;
