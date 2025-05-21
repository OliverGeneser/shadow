import { SignalAnswerData, WSResponse } from "shadow-shared";
import { store } from "./store";

const serverUrl = "wss://" + import.meta.env.VITE_WEBSOCKET_URL;
const websocket = new WebSocket(serverUrl);
let pingInterval: NodeJS.Timeout;

websocket.onopen = () => {
  console.log("WebSocket connected");
  store.send({ type: "setWebSocketConnectionStatus", state: "connected" });

  pingInterval = setInterval(() => {
    if (websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({ type: "ping" }));
    }
  }, 20000);
};

websocket.onmessage = async (event) => {
  try {
    const msg = WSResponse.parse(JSON.parse(event.data));

    switch (msg.type) {
      case "ready": {
        store.send({ type: "setClientId", clientId: msg.metadata.clientId });
        store.send({ type: "setClients", clients: msg.metadata.clients });
        break;
      }
      case "clients": {
        store.send({ type: "setClients", clients: msg.clients });
        break;
      }
      case "offer": {
        const webRTCConnections = store
          .select((state) => state.webRTCConnections)
          .get();
        let localPeer;
        if (webRTCConnections[msg.from]) {
          localPeer = webRTCConnections[msg.from];
        } else {
          throw new Error("THERE is no WEBRTC CONNECTION for offer");
        }
        await localPeer.setRemoteDescription(msg.offer);
        await localPeer.setLocalDescription(await localPeer.createAnswer());

        if (localPeer.localDescription !== null) {
          const message: SignalAnswerData = {
            type: "signal-answer",
            to: msg.from,
            signal: localPeer.localDescription,
          };
          websocket.send(JSON.stringify(message));
        }

        store.trigger.setWebRTCConnection({
          peerId: msg.from,
          connection: localPeer,
        });
        break;
      }
      case "answer": {
        const webRTCConnections = store
          .select((state) => state.webRTCConnections)
          .get();
        let localPeer;
        if (webRTCConnections[msg.from]) {
          localPeer = webRTCConnections[msg.from];
        } else {
          break;
        }

        localPeer.setRemoteDescription(msg.answer);

        store.send({
          type: "setWebRTCConnection",
          peerId: msg.from,
          connection: localPeer,
        });
        break;
      }

      case "candidate": {
        const webRTCConnections = store
          .select((state) => state.webRTCConnections)
          .get();

        let localPeer;
        if (webRTCConnections[msg.from]) {
          localPeer = webRTCConnections[msg.from];
        } else {
          break;
        }

        localPeer.addIceCandidate(msg.candidate);

        store.send({
          type: "setWebRTCConnection",
          peerId: msg.from,
          connection: localPeer,
        });
        break;
      }

      case "leave": {
        const clients = store.select((state) => state.clients).get();
        store.send({
          type: "setClients",
          clients: clients.filter((client) => client.clientId !== msg.client),
        });
        break;
      }

      case "pong":
        break;

      default:
        console.error("Unknown message received:");
        console.error(msg);
    }
  } catch (e) {
    console.log(e);
  }
};

websocket.onclose = () => {
  console.log("WebSocket disconnected");
  clearInterval(pingInterval);
  store.send({ type: "setWebSocketConnectionStatus", state: "disconnected" });
};

websocket.onerror = (error) => {
  console.error("WebSocket error:", error);
  clearInterval(pingInterval);
  store.send({ type: "setWebSocketConnectionStatus", state: "disconnected" });
};

export default websocket;

export const sendMessageWithRetry = async (
  message: string,
  retriesRemaining: number = 10,
): Promise<void> => {
  if (websocket.readyState === WebSocket.OPEN) {
    websocket.send(message);
    return;
  }

  if (retriesRemaining === 0) {
    throw new Error("Failed to send message after multiple retries");
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log(
    `WebSocket not open, retrying in 1 second... (Retries remaining: ${retriesRemaining})`,
  );

  return sendMessageWithRetry(message, retriesRemaining - 1);
};
