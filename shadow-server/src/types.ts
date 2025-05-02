import WebSocket from "@fastify/websocket";

export type Subset<T extends U, U> = U;

export type Room = Set<WebSocket.WebSocket>;
export type Metadata = { clientId: string; roomId: string; publicKey: string };

export type ClientInformation = {
  clientId: string;
  ws: WebSocket.WebSocket;
  publicKey: string;
};
export type ClientsInformation = ClientInformation[];

export type Rooms = Map<string, Room>;
export type WebSocketMetadata = Map<WebSocket.WebSocket, Metadata>;
