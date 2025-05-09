import WebSocket from "@fastify/websocket";

export type Subset<T extends U, U> = U;

export type Room = Set<WebSocket.WebSocket>;
export type Metadata = {
  clientId: string;
  roomId: string;
  publicKey: any;
};

export type ClientInformation = {
  clientId: string;
  ws: WebSocket.WebSocket;
  publicKey: any;
};
export type ClientsInformation = ClientInformation[];

export type Rooms = Map<string, Room>;
export type WebSocketMetadata = Map<WebSocket.WebSocket, Metadata>;
