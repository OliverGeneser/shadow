import WebSocket from "@fastify/websocket";

export type Room = Set<WebSocket.WebSocket>;
export type Metadata = { clientId: string };

export type Rooms = Map<string, Room>;
export type WebSocketMetadata = Map<WebSocket.WebSocket, Metadata>;

export type RoomData = {
  roomId?: string;
  type: "create or join";
};

export type LeaveData = {
  roomId: string;
  type: "leave";
};

export type ClientsData = {
  roomId: string;
  type: "clients";
};

export type SignalOfferData = {
  signal: unknown;
  roomId: string;
  type: "signal-offer";
};

export type SignalAnswerData = {
  signal: unknown;
  roomId: string;
  type: "signal-answer";
};

export type SignalCandidateData = {
  signal: unknown;
  roomId: string;
  type: "signal-candidate";
};

export type Data =
  | RoomData
  | LeaveData
  | ClientsData
  | SignalOfferData
  | SignalAnswerData
  | SignalCandidateData;
