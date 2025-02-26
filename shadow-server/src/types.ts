import WebSocket from "@fastify/websocket";

export type Room = Set<WebSocket.WebSocket>;
type Metadata = { name: string };

export type Rooms = Map<string, Room>;
export type WebSocketMetadata = Map<WebSocket.WebSocket, Metadata>;

export type RoomData = {
  roomId?: string;
  name: string;
  type: "create or join";
};

export type LeaveData = {
  roomId: string;
  type: "leave";
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
  | SignalOfferData
  | SignalAnswerData
  | SignalCandidateData;
