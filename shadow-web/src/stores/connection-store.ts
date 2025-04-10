import { createStore } from "@xstate/store";
import { useSelector } from "@xstate/store/react";
import { serverUrl } from "../socket";
import {
  SignalCandidateData,
  Clients,
  SignalAnswerData,
  ClientsData,
  RoomData,
  SignalOfferData,
  clientsSchema,
  WSResponse,
} from "shadow-shared";

export type rtcConnectionsArray = {
  clientId: string;
};
interface Connections {
  [key: string]: {
    webrtc: RTCPeerConnection;
    dataChannel: RTCDataChannel | undefined;
  };
}

export enum ReadyState {
  UNINSTANTIATED = -1,
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}
const config = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

export const store = createStore({
  context: {
    clientId: "",
    roomId: "",
    clients: [] as Clients,
    connections: {} as Connections,
    socket: new WebSocket(serverUrl),
  },
  on: {
    handleMessage: (context, event: { message: string }) => {
      try {
        const msg = WSResponse.parse(JSON.parse(event.message));

        switch (msg.type) {
          case "ready": {
            const message: ClientsData = {
              type: "clients",
            };
            context.socket.send(JSON.stringify(message));

            return {
              ...context,
              clientId: msg.metadata.clientId,
              roomId: msg.metadata.roomId,
            };
          }
          case "clients":
            return {
              ...context,
              clients: msg.clients,
            };
          case "offer": {
            console.log("offer, ", msg);

            const localPeer = new RTCPeerConnection(config);

            localPeer.ondatachannel = (e) => {
              console.log("remote", e);
              const dataChannel = e.channel;
              dataChannel.binaryType = "arraybuffer";
              dataChannel.bufferedAmountLowThreshold = 0;
              dataChannel.onmessage = (msg) => onReceiveMessageCallback(msg);
              dataChannel.onopen = () => console.log("Connected to peer.");
            };

            localPeer.setRemoteDescription(msg.offer);
            if (localPeer.localDescription === null) {
              localPeer
                .createAnswer()
                .then((answer) => localPeer.setLocalDescription(answer));
            }

            localPeer.onicecandidate = () => {
              if (localPeer.localDescription !== null) {
                console.log(localPeer.localDescription);
                const message: SignalAnswerData = {
                  to: msg.from,
                  type: "signal-answer",
                  signal: localPeer.localDescription,
                };
                context.socket.send(JSON.stringify(message));
              }
            };

            return {
              ...context,
              connections: {
                ...context.connections,
                [msg.from]: { webrtc: localPeer, dataChannel: undefined },
              },
            };
          }
          case "answer": {
            console.log("answer, ", msg);
            const localPeer = context.connections[msg.from].webrtc;

            localPeer.setRemoteDescription(msg.answer);

            if (localPeer.localDescription == null) {
              localPeer
                .createAnswer()
                .then((answer) => localPeer.setLocalDescription(answer));
            }
            localPeer.onicecandidate = () => {
              if (localPeer.localDescription !== null) {
                const message: SignalAnswerData = {
                  to: msg.from,
                  type: "signal-answer",
                  signal: localPeer.localDescription,
                };
                context.socket.send(JSON.stringify(message));
              }
            };

            return {
              ...context,
              connections: {
                ...context.connections,
                [msg.from]: {
                  webrtc: localPeer,
                  dataChannel: context.connections[msg.from].dataChannel,
                },
              },
            };
          }
          case "leave":
            console.log(msg);
            break;

          default:
            console.error("Unknown message received:");
            console.error(msg);
        }
      } catch (e) {
        console.log(e);
      }
    },
    setupSocket: (context, event: { type: "setupSocket"; roomId: string }) => {
      const tempSocket = context.socket;

      tempSocket.onopen = function () {
        console.log("Connection Open!");

        const message: RoomData = {
          type: "create or join",
          roomId: event.roomId,
        };
        context.socket.send(JSON.stringify(message));
      };

      tempSocket.onmessage = (event) =>
        store.trigger.handleMessage({ message: event.data });

      tempSocket.onclose = function () {
        console.log("Connection Closed!");
      };

      return { ...context, socket: tempSocket, roomId: event.roomId };
    },
    sendData: (context, event: { peerId: string; data: string }) => {
      const dataChannel = context.connections[event.peerId].dataChannel;
      if (dataChannel) {
        dataChannel.send(
          JSON.stringify({
            name: "hey.ts",
            size: 200,
            type: "ts",
          }),
        );
      }
      return { ...context };
    },
    setupConnection: (context, event: { peerId: string }) => {
      console.log("Setting up a connection...");

      const localpeer = new RTCPeerConnection(config);

      const dataChannel = localpeer.createDataChannel("dataChannel");
      dataChannel.binaryType = "arraybuffer";
      dataChannel.onmessage = (msg: unknown) => onReceiveMessageCallback(msg);
      dataChannel.bufferedAmountLowThreshold = 0;
      dataChannel.onopen = () => console.log("Connected to peer.");

      localpeer.onicecandidate = () => {
        if (localpeer.localDescription !== null) {
          const message: SignalOfferData = {
            type: "signal-offer",
            to: event.peerId,
            signal: localpeer.localDescription,
          };
          context.socket.send(JSON.stringify(message));
        }
      };
      const func = async () => {
        const localOffer = await localpeer.createOffer();
        localpeer.setLocalDescription(new RTCSessionDescription(localOffer));
      };
      func();

      return {
        ...context,
        connections: {
          ...context.connections,
          [event.peerId]: { webrtc: localpeer, dataChannel: dataChannel },
        },
      };
    },
  },
});

function onReceiveMessageCallback(event: unknown) {
  console.log("MESSAGEEEEEE");
  console.log(event);
}

export const useClientId = () =>
  useSelector(store, (state) => state.context.clientId);
export const useRoomId = () =>
  useSelector(store, (state) => state.context.roomId);
export const useClients = () =>
  useSelector(store, (state) => state.context.clients);
export const useSocketState = () =>
  useSelector(store, (state) => state.context.socket.readyState);
