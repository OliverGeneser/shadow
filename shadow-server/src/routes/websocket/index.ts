import { FastifyPluginAsync } from "fastify";
import { randomUUID } from "crypto";
import WebSocket from "@fastify/websocket";
import {
  Data,
  RoomData,
  LeaveData,
  SignalOfferData,
  SignalCandidateData,
  SignalAnswerData,
  WebSocketMetadata,
  Rooms,
  Room,
} from "../../types.js";

const rooms: Rooms = new Map();
const wsMetadata: WebSocketMetadata = new Map();

const websocket: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get("/", { websocket: true }, async function (socket, req) {
    socket.on("message", (buffer) => {
      try {
        const data: Data = JSON.parse(buffer.toString());

        switch (data.type) {
          case "create or join":
            handleRoom(socket, data);
            break;
          case "leave":
            handleLeave(socket, data);
            break;
          case "signal-offer":
            handleSignalOffer(socket, data);
            break;
          case "signal-answer":
            handleSignalAnswer(socket, data);
            break;
          case "signal-candidate":
            handleSignalCandidate(socket, data);
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

const handleRoom = (ws: WebSocket.WebSocket, data: RoomData) => {
  let roomId = data.roomId;
  if (roomId === undefined || !rooms.has(roomId)) {
    roomId = randomUUID();
    rooms.set(roomId, new Set());
  }

  const clients = rooms.get(roomId);
  if (!clients) return;
  clients.add(ws);
  wsMetadata.set(ws, { name: data.name });

  ws.send(JSON.stringify({ type: "ready", roomId }));
};

const handleLeave = (ws: WebSocket.WebSocket, data: LeaveData) => {
  const clients = rooms.get(data.roomId);
  if (clients) {
    clients.delete(ws);
    const metadata = wsMetadata.get(ws);
    wsMetadata.delete(ws);
    if (clients.size === 0) {
      rooms.delete(data.roomId);
    } else {
      const message = `User ${metadata?.name} left the room`;
      sendMessageToClients(clients, ws, message);
    }
  }
};

const handleSignalOffer = (ws: WebSocket.WebSocket, data: SignalOfferData) => {
  const clients = rooms.get(data.roomId);
  if (!clients) return;
  const message = JSON.stringify({
    type: "offer",
    offer: data.signal,
  });
  sendMessageToClients(clients, ws, message);
};

const handleSignalAnswer = (
  ws: WebSocket.WebSocket,
  data: SignalAnswerData
) => {
  const clients = rooms.get(data.roomId);
  if (!clients) return;
  const message = JSON.stringify({
    type: "answer",
    answer: data.signal,
  });
  sendMessageToClients(clients, ws, message);
};

const handleSignalCandidate = (
  ws: WebSocket.WebSocket,
  data: SignalCandidateData
) => {
  const clients = rooms.get(data.roomId);
  if (!clients) return;
  const message = JSON.stringify({
    type: "candidate",
    candidate: data.signal,
  });
  sendMessageToClients(clients, ws, message);
};

const handleDisconnect = (ws: WebSocket.WebSocket) => {};

const sendMessageToClients = (
  clients: Room,
  ws: WebSocket.WebSocket,
  message: string
) => {
  clients.forEach((client) => {
    if (client !== ws) {
      client.send(message);
    }
  });
};

export default websocket;
