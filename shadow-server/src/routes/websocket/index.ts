import { FastifyPluginAsync } from "fastify";
import { randomUUID } from "crypto";
import WebSocket from "@fastify/websocket";
import {
  WebSocketMetadata,
  Rooms,
  Room,
  Metadata,
  ClientsInformation,
} from "../../types.js";
import { animals, uniqueNamesGenerator } from "unique-names-generator";
import {
  clientsResponseSchema,
  colorMap,
  createOrJoinResponse,
  leaveResponseSchema,
  RoomData,
  SignalAnswerData,
  signalAnswerResponseSchema,
  SignalCandidateData,
  signalCandidateResponseSchema,
  SignalOfferData,
  signalOfferResponseSchema,
  WSRequest,
  ZodError,
} from "shadow-shared";

const rooms: Rooms = new Map();
const wsMetadata: WebSocketMetadata = new Map();

const websocket: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get("/", { websocket: true }, function (socket, req) {
    socket.on("message", (buffer) => {
      try {
        const parsed = WSRequest.parse(JSON.parse(buffer.toString()));
        switch (parsed.type) {
          case "create or join":
            handleRoom(socket, parsed);
            break;
          case "leave":
            handleLeave(socket);
            break;
          case "clients":
            handleClients(socket);
            break;
          case "signal-offer":
            handleSignalOffer(socket, parsed);
            break;
          case "signal-answer":
            handleSignalAnswer(socket, parsed);
            break;
          case "signal-candidate":
            handleSignalCandidate(socket, parsed);
            break;
          case "ping":
            socket.send(JSON.stringify({ type: "pong" }));
            break;
        }
      } catch (e) {
        if (e instanceof ZodError) {
          console.log(e.errors);
        } else {
          console.error(e);
        }
      }
    });

    socket.on("close", () => {
      try {
        handleLeave(socket);
      } catch (e) {
        if (e instanceof ZodError) {
          console.log(e.errors);
        } else {
          console.error(e);
        }
      }
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
    dictionaries: [Object.keys(colorMap), animals],
    separator: " ",
    style: "capital",
    length: 2,
  });

  while (clientIdExists(clients, clientId)) {
    clientId = uniqueNamesGenerator({
      dictionaries: [Object.keys(colorMap), animals],
      separator: " ",
      style: "capital",
      length: 2,
    });
  }

  const metadata = { clientId, roomId, publicKey: data.publicKey };
  wsMetadata.set(ws, metadata);

  let clientsInformation: ClientsInformation | undefined;
  if (clients.size > 1) {
    clientsInformation = getClientInformationOfAllClients(clients);
    sendClientIdsToAllClients(clients, ws, clientsInformation);
  }

  const parsed = createOrJoinResponse.parse({
    type: "ready",
    metadata: {
      clientId: metadata.clientId,
      roomId: metadata.roomId,
      clients: clientsInformation
        ? clientsInformation
            .filter((ci) => ci.ws !== ws)
            .map((ci) => {
              return { clientId: ci.clientId, publicKey: ci.publicKey };
            })
        : [],
    },
  });
  ws.send(JSON.stringify(parsed));
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
      const message = {
        type: "leave",
        client: metadata.clientId,
      };
      const parsed = leaveResponseSchema.parse(message);
      sendMessageToClients(clients, ws, JSON.stringify(parsed));
    }
  }
  ws.close();
};

const handleClients = (ws: WebSocket.WebSocket) => {
  const clientsAndCurrentMetadata = getClientsAndCurrentMetadata(ws);
  if (!clientsAndCurrentMetadata) return;

  const message = createClientsMessage(clientsAndCurrentMetadata.clients, ws);
  const parsed = clientsResponseSchema.parse(message);
  ws.send(JSON.stringify(parsed));
};

const createClientsMessage = (clients: Room, ws: WebSocket.WebSocket) => {
  const clientsMetadata: Omit<Metadata, "roomId">[] = [];
  clients.forEach((client) => {
    if (client !== ws) {
      const metadata = wsMetadata.get(client);
      if (metadata) {
        clientsMetadata.push({
          clientId: metadata.clientId,
          publicKey: metadata.publicKey,
        });
      }
    }
  });
  return {
    type: "clients",
    clients: clientsMetadata,
  };
};

const handleSignalOffer = (ws: WebSocket.WebSocket, data: SignalOfferData) => {
  const clientsAndCurrentMetadata = getClientsAndCurrentMetadata(ws);
  if (!clientsAndCurrentMetadata) return;
  const message = {
    type: "offer",
    from: clientsAndCurrentMetadata.metadata.clientId,
    offer: data.signal,
  };
  const parsed = signalOfferResponseSchema.parse(message);
  sendMessageToClient(
    clientsAndCurrentMetadata.clients,
    data.to,
    JSON.stringify(parsed),
  );
};

const handleSignalAnswer = (
  ws: WebSocket.WebSocket,
  data: SignalAnswerData,
) => {
  const clientsAndCurrentMetadata = getClientsAndCurrentMetadata(ws);
  if (!clientsAndCurrentMetadata) return;
  const message = {
    type: "answer",
    from: clientsAndCurrentMetadata.metadata.clientId,
    answer: data.signal,
  };
  const parsed = signalAnswerResponseSchema.parse(message);
  sendMessageToClient(
    clientsAndCurrentMetadata.clients,
    data.to,
    JSON.stringify(parsed),
  );
};

const handleSignalCandidate = (
  ws: WebSocket.WebSocket,
  data: SignalCandidateData,
) => {
  const clientsAndCurrentMetadata = getClientsAndCurrentMetadata(ws);
  if (!clientsAndCurrentMetadata) return;
  const message = {
    type: "candidate",
    from: clientsAndCurrentMetadata.metadata.clientId,
    candidate: data.signal,
  };
  const parsed = signalCandidateResponseSchema.parse(message);
  sendMessageToClient(
    clientsAndCurrentMetadata.clients,
    data.to,
    JSON.stringify(parsed),
  );
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

const getClientInformationOfAllClients = (clients: Room) => {
  const clientsInformation: ClientsInformation = [];
  clients.forEach((client) => {
    const metadata = wsMetadata.get(client);
    if (!metadata) return;
    clientsInformation.push({
      clientId: metadata.clientId,
      ws: client,
      publicKey: metadata.publicKey,
    });
  });

  return clientsInformation;
};

const sendClientIdsToAllClients = (
  clients: Room,
  ws: WebSocket.WebSocket,
  clientsInformation: ClientsInformation,
) => {
  clients.forEach((client) => {
    if (client !== ws) {
      const message = {
        type: "clients",
        clients: clientsInformation
          .filter((ci) => ci.ws !== client)
          .map((ci) => {
            return { clientId: ci.clientId, publicKey: ci.publicKey };
          }),
      };
      const parsedMessage = clientsResponseSchema.parse(message);
      client.send(JSON.stringify(parsedMessage));
    }
  });
};

const sendMessageToClient = (clients: Room, to: string, message: string) => {
  clients.forEach((client) => {
    const metadata = wsMetadata.get(client);
    if (metadata?.clientId == to) {
      client.send(message);
    }
  });
};

const getClientsAndCurrentMetadata = (ws: WebSocket.WebSocket) => {
  const metadata = wsMetadata.get(ws);
  if (!metadata) return;
  const clients = rooms.get(metadata.roomId);
  if (!clients) return;
  return { clients, metadata };
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
