import { createStore } from "@xstate/store";
import { useSelector } from "@xstate/store/react";
import { serverUrl } from "../socket";

export type ClientArray = {
  clientId: string;
}[];

export enum ReadyState {
  UNINSTANTIATED = -1,
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

export const store = createStore({
  context: {
    clientId: "",
    roomId: "",
    clients: [] as ClientArray,
    webRTC: new RTCPeerConnection({
      //    iceServers: [
      // Information about ICE servers - Use your own!
      //    {
      //  urls: "stun.l.google.com:19302",
      //   },
      // ],
    }),
    socket: new WebSocket(serverUrl),
  },
  on: {
    handleMessage: (context, event: any) => {
      console.log(event.message);
      try {
        const msg = JSON.parse(event.message.data);

        console.log(msg);

        switch (msg.type) {
          case "ready":
            store.trigger.sendMessage({ message: { type: "clients" } });
            return {
              ...context,
              clientId: msg.metadata.clientId,
              roomId: msg.metadata.roomId,
            };

          case "clients":
            return {
              ...context,
              clients: msg.clients.filter(
                (client) => client.clientId !== context.clientId,
              ),
            };

          default:
            console.error("Unknown message received:");
            console.error(msg);
        }
      } catch (e) {
        console.log(e, event.event.data);
      }
    },
    sendMessage: (context, event: { type: "sendMessage"; message: any }) => {
      console.log("Sending: ", event.message);
      context.socket.send(JSON.stringify(event.message));
      return { ...context };
    },
    setupSocket: (context, event: { type: "setupSocket"; roomId: string }) => {
      const tempSocket = context.socket;

      tempSocket.onopen = function () {
        // Handle connection open
        console.log("Connection Open!");

        store.trigger.sendMessage({
          message: {
            type: "create or join",
            roomId: event.roomId,
          },
        });
      };

      tempSocket.onmessage = (event) =>
        store.trigger.handleMessage({ message: event });

      tempSocket.onclose = function (event) {
        // Handle connection close
        console.log("Connection Closed!");
      };

      return { ...context, socket: tempSocket, roomId: event.roomId };
    },
    setupConnection: (context) => {
      console.log("Setting up a connection...");

      // context.webRTC.onicecandidate = handleICECandidateEvent;
      // context.webRTC.oniceconnectionstatechange = handleICEConnectionStateChangeEvent;
      // context.webRTC.onicegatheringstatechange = handleICEGatheringStateChangeEvent;
      // context.webRTC.onsignalingstatechange = handleSignalingStateChangeEvent;
      // context.webRTC.onnegotiationneeded = handleNegotiationNeededEvent;
      // context.webRTC.ontrack = handleTrackEvent;
    },
  },
});

export const useClientId = () =>
  useSelector(store, (state) => state.context.clientId);
export const useRoomId = () =>
  useSelector(store, (state) => state.context.roomId);
export const useClients = () =>
  useSelector(store, (state) => state.context.clients);
export const useSocketState = () =>
  useSelector(store, (state) => state.context.socket.readyState);
