import WebSocket from "@fastify/websocket";

export type Subset<T extends U, U> = U;

export type Room = Set<WebSocket.WebSocket>;
export type Metadata = { clientId: string; roomId: string };

export type Rooms = Map<string, Room>;
export type WebSocketMetadata = Map<WebSocket.WebSocket, Metadata>;
