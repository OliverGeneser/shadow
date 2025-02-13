import { FastifyPluginAsync } from "fastify";
import { randomUUID } from "crypto";
import WebSocket from "@fastify/websocket";

type Room = Set<WebSocket.WebSocket>;
const rooms: Map<string, Room> = new Map();

const websocket: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get("/", { websocket: true }, async function (socket, req) {
    socket.on("message", (buffer) => {
      try {
        const data = JSON.parse(buffer.toString());

        switch (data.type) {
          case "create or join":
            handleRoom(socket, data.roomId);
            break;
          case "leave":
            handleLeave(socket, data.roomId);
            break;
          case "signal-offer":
            handleSignalOffer(socket, data.roomId, data.signal);
            break;
          case "signal-answer":
            handleSignalAnswer(socket, data.roomId, data.signal);
            break;
          case "signal-candidate":
            handleSignalCandidate(socket, data.roomId, data.signal);
            break;
          default:
            socket.send("Unsupported type!");
        }
      } catch (e) {
        console.error(e);
      }
    });

    socket.on("close", () => {
      handleDisconnect(socket);
    });
  });
};

const handleRoom = (ws: WebSocket.WebSocket, dataRoomId?: string) => {
  let roomId = dataRoomId;
  if (roomId === undefined || !rooms.has(roomId)) {
    roomId = randomUUID();
    rooms.set(roomId, new Set());
  }

  const clients = rooms.get(roomId);
  if (!clients) return;
  clients.add(ws);

  ws.send(JSON.stringify({ type: "ready", roomId }));
};

const handleLeave = (ws: WebSocket.WebSocket, roomId: string) => {
  const clients = rooms.get(roomId);
  if (clients) {
    clients.delete(ws);
    if (clients.size === 0) {
      rooms.delete(roomId);
    }
  }
};

const handleSignalOffer = (
  ws: WebSocket.WebSocket,
  roomId: string,
  signal: unknown
) => {
  const clients = rooms.get(roomId);
  if (!clients) return;
  clients.forEach((client) => {
    if (client !== ws) {
      client.send(
        JSON.stringify({
          type: "offer",
          offer: signal,
        })
      );
    }
  });
};

const handleSignalAnswer = (
  ws: WebSocket.WebSocket,
  roomId: string,
  signal: unknown
) => {
  const clients = rooms.get(roomId);
  if (!clients) return;
  clients.forEach((client) => {
    if (client !== ws) {
      client.send(
        JSON.stringify({
          type: "answer",
          answer: signal,
        })
      );
    }
  });
};

const handleSignalCandidate = (
  ws: WebSocket.WebSocket,
  roomId: string,
  signal: unknown
) => {
  const clients = rooms.get(roomId);
  if (!clients) return;
  clients.forEach((client) => {
    if (client !== ws) {
      client.send(
        JSON.stringify({
          type: "candidate",
          candidate: signal,
        })
      );
    }
  });
};

const handleDisconnect = (ws: WebSocket.WebSocket) => {};

export default websocket;
