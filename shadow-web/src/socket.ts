import { ClientsData, SignalAnswerData, WSResponse } from "shadow-shared";
import { store } from "./stores/connection-store";

const serverUrl = "wss://" + import.meta.env.VITE_WEBSOCKET_URL;
const websocket = new WebSocket(serverUrl);

websocket.onopen = () => {
  console.log("WebSocket connected");
  store.send({ type: "setWebsocketConnectionStatus", state: "connected" });
};

websocket.onmessage = async (event) => {
  try {
    const msg = WSResponse.parse(JSON.parse(event.data));
    console.log(msg);

    switch (msg.type) {
      case "ready": {
        const message: ClientsData = {
          type: "clients",
        };
        websocket.send(JSON.stringify(message));

        store.send({ type: "setClientId", clientId: msg.metadata.clientId });
        break;
      }
      case "clients": {
        store.send({ type: "setClients", clients: msg.clients });
        break;
      }
      case "offer": {
        const webrtcConnections = store
          .select((state) => state.webrtcConnections)
          .get();
        let localPeer;
        if (webrtcConnections[msg.from]) {
          localPeer = webrtcConnections[msg.from];
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

        store.send({
          type: "setWebRTCConnection",
          peerId: msg.from,
          connection: localPeer,
        });
        break;
      }
      case "answer": {
        const webrtcConnections = store
          .select((state) => state.webrtcConnections)
          .get();
        let localPeer;
        if (webrtcConnections[msg.from]) {
          localPeer = webrtcConnections[msg.from];
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
        const webrtcConnections = store
          .select((state) => state.webrtcConnections)
          .get();

        let localPeer;
        if (webrtcConnections[msg.from]) {
          localPeer = webrtcConnections[msg.from];
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
  store.send({ type: "setWebsocketConnectionStatus", state: "disconnected" });
};

websocket.onerror = (error) => {
  console.error("WebSocket error:", error);
  store.send({ type: "setWebsocketConnectionStatus", state: "disconnected" });
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
