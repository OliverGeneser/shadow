import { FastifyPluginAsync } from "fastify";
import { randomUUID } from "crypto";
import WebSocket from "@fastify/websocket";
import {
  Data,
  RoomData,
  SignalOfferData,
  SignalCandidateData,
  SignalAnswerData,
  WebSocketMetadata,
  Rooms,
  Room,
  Metadata,
  Subset,
} from "../../types.js";
import {
  animals,
  uniqueNamesGenerator,
} from "unique-names-generator";

const rooms: Rooms = new Map();
const wsMetadata: WebSocketMetadata = new Map();

const colorMap = ["Azure",
  "Beige",
  "Brick",
  "Bronze",
  "Charcoal",
  "Coral",
  "Cyan",
  "Emerald",
  "Fawn",
  "Indigo",
  "Amethyst",
  "Jade",
  "Lavender",
  "Maroon",
  "Olive",
  "Peach",
  "Rosewood",
  "Sapphire",
  "Teal",
  "Walnut",
]

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
            handleLeave(socket);
            break;
          case "clients":
            handleClients(socket);
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
      handleLeave(socket);
    });
  });
};

const handleRoom = (ws: WebSocket.WebSocket, data: RoomData) => {
  let roomId = data.roomId;
  if (roomId === undefined || roomId === null) {
    roomId = randomUUID();
  }
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }

  const clients = rooms.get(roomId);
  if (!clients) return;
  clients.add(ws);
  let clientId = uniqueNamesGenerator({
    dictionaries: [colorMap, animals],
    separator: " ",
    style: "capital",
    length: 2,
  });

  while (clientIdExists(clients, clientId)) {
    clientId = uniqueNamesGenerator({
      dictionaries: [colorMap, animals],
      separator: " ",
      style: "capital",
      length: 2,
    });
  }

  const metadata = { clientId, roomId };
  wsMetadata.set(ws, metadata);

  const message = createClientsMessage(clients);
  sendMessageToClients(clients, ws, message);

  ws.send(JSON.stringify({ type: "ready", metadata }));
};

const handleLeave = (ws: WebSocket.WebSocket) => {
  const metadata = wsMetadata.get(ws);
  if (!metadata) {
    ws.close();
    return;
  }
  const clients = rooms.get(metadata.roomId);
  if (clients) {
    clients.delete(ws);
    wsMetadata.delete(ws);
    if (clients.size === 0) {
      rooms.delete(metadata.roomId);
    } else {
      const message = JSON.stringify({
        type: "leave",
        client: metadata.clientId,
      });
      sendMessageToClients(clients, ws, message);
    }
  }
  ws.close();
};

const handleClients = (ws: WebSocket.WebSocket) => {
  const metadata = wsMetadata.get(ws);
  if (!metadata) return;
  const clients = rooms.get(metadata.roomId);
  if (!clients) return;

  const message = createClientsMessage(clients);
  ws.send(message);
};

const createClientsMessage = (clients: Room) => {
  const clientsMetadata: Subset<Metadata, { clientId: string }>[] = [];
  clients.forEach((client) => {
    const metadata = wsMetadata.get(client);
    if (metadata) {
      clientsMetadata.push({ clientId: metadata.clientId });
    }
  });
  return JSON.stringify({
    type: "clients",
    clients: clientsMetadata,
  });
};

const handleSignalOffer = (ws: WebSocket.WebSocket, data: SignalOfferData) => {
  const metadata = wsMetadata.get(ws);
  if (!metadata) return;
  const clients = rooms.get(metadata.roomId);
  if (!clients) return;
  const message = JSON.stringify({
    type: "offer",
    offer: data.signal,
  });
  sendMessageToClients(clients, ws, message);
};

const handleSignalAnswer = (
  ws: WebSocket.WebSocket,
  data: SignalAnswerData,
) => {
  const metadata = wsMetadata.get(ws);
  if (!metadata) return;
  const clients = rooms.get(metadata.roomId);
  if (!clients) return;
  const message = JSON.stringify({
    type: "answer",
    answer: data.signal,
  });
  sendMessageToClients(clients, ws, message);
};

const handleSignalCandidate = (
  ws: WebSocket.WebSocket,
  data: SignalCandidateData,
) => {
  const metadata = wsMetadata.get(ws);
  if (!metadata) return;
  const clients = rooms.get(metadata.roomId);
  if (!clients) return;
  const message = JSON.stringify({
    type: "candidate",
    candidate: data.signal,
  });
  sendMessageToClients(clients, ws, message);
};

const sendMessageToClients = (
  clients: Room,
  ws: WebSocket.WebSocket,
  message: string,
) => {
  clients.forEach((client) => {
    if (client !== ws) {
      client.send(message);
    }
  });
};

const clientIdExists = (clients: Room, clientId: string) => {
  let exists = false;
  clients.forEach((client) => {
    const metadata = wsMetadata.get(client);
    if (metadata?.clientId === clientId) {
      exists = true;
    }
  });
  return exists;
};

export default websocket;
