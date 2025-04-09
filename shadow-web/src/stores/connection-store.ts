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

export enum ReadyState {
  UNINSTANTIATED = -1,
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}
const config = {
  iceServers: [
    // Information about ICE servers - Use your own!
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

export const store = createStore({
  context: {
    clientId: "",
    targetId: "",
    roomId: "",
    clients: [] as Clients,
    rtcConnections: {},
    webRTC: new RTCPeerConnection(config),
    socket: new WebSocket(serverUrl),
  },
  on: {
    handleMessage: (context, event: { message: string }) => {
      try {
        const msg = WSResponse.parse(JSON.parse(event.message));

        console.log(msg);

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
            console.log("offer, ", event);
            context.webRTC.setRemoteDescription(msg.offer);
            context.webRTC.createAnswer().then((answer) => {
              context.webRTC.setLocalDescription(answer);

              const message: SignalAnswerData = {
                to: msg.from,
                type: "signal-answer",
                signal: answer,
              };
              context.socket.send(JSON.stringify(message));
            });
            break;
          }
          case "answer":
            console.log("answer, ", event);
            context.webRTC.setRemoteDescription(msg.answer);
            break;

          default:
            console.error("Unknown message received:");
            console.error(msg);
        }
      } catch (e) {
        console.log(e);
      }
    },
    setTarget: (context, event: { targetId: string }) => {
      return { ...context, targetId: event.targetId };
    },
    setupSocket: (context, event: { type: "setupSocket"; roomId: string }) => {
      const tempSocket = context.socket;

      tempSocket.onopen = function () {
        // Handle connection open
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
        // Handle connection close
        console.log("Connection Closed!");
      };

      return { ...context, socket: tempSocket, roomId: event.roomId };
    },
    startRTCConnection: (context, event: { peerId: string }) => {
      const connection = new RTCPeerConnection(config);
      connection.onicecandidate = (e) => {
        if (e.candidate != null) {
          const message: SignalCandidateData = {
            type: "signal-candidate",
            to: event.peerId,
            signal: e.candidate,
          };
          context.socket.send(JSON.stringify(message));
        }
      };

      const connections = context.rtcConnections;
      //connections[event.peerId] = connection;

      console.log(connections);
      return { ...context, rtcConnections: connections };
    },
    sendData: (context, event: { data: string }) => {
      const sendChannel = context.webRTC.createDataChannel("sendChannel");

      while (sendChannel.readyState === "connecting") {
        console.log("Connecting datachannel");
      }

      if (sendChannel.readyState === "open") sendChannel.send(event.data);

      return { ...context };
    },
    setupConnection: (context) => {
      console.log("Setting up a connection...");

      context.webRTC.ondatachannel = (event) => {
        const receiveChannel = event.channel;
        receiveChannel.onmessage = (event) => {
          console.log("message", event);
        };
        receiveChannel.onopen = (event) => {
          console.log("open", event);
        };
        receiveChannel.onclose = (event) => {
          console.log("close", event);
        };
      };

      context.webRTC.onicecandidate = (e) => {
        if (e.candidate) {
          console.log("*** Outgoing ICE candidate: " + e.candidate.candidate);

          const message: SignalCandidateData = {
            type: "signal-candidate",
            to: context.targetId,
            signal: e.candidate,
          };
          context.socket.send(JSON.stringify(message));
        }
      };

      context.webRTC.oniceconnectionstatechange =
        function handleICEConnectionStateChangeEvent() {
          console.log(
            "*** ICE connection state changed to " +
              context.webRTC.iceConnectionState,
          );

          switch (context.webRTC.iceConnectionState) {
            case "closed":
            case "failed":
            case "disconnected":
              break;
          }
        };

      context.webRTC.onsignalingstatechange =
        function handleSignalingStateChangeEvent() {
          console.log(
            "*** WebRTC signaling state changed to: " +
              context.webRTC.signalingState,
          );
          switch (context.webRTC.signalingState) {
            case "closed":
              break;
          }
        };

      context.webRTC.onicegatheringstatechange =
        function handleICEGatheringStateChangeEvent() {
          console.log(
            "*** ICE gathering state changed to: " +
              context.webRTC.iceGatheringState,
          );
        };
      context.webRTC.onnegotiationneeded =
        async function handleNegotiationNeededEvent() {
          console.log("*** Negotiation needed");

          try {
            console.log("---> Creating offer");
            const offer = await context.webRTC.createOffer();

            if (context.webRTC.signalingState != "stable") {
              console.log("The connection isn't stable yet; postponing...");
              return;
            }

            // Establish the offer as the local peer's current
            // description.

            console.log("---> Setting local description to the offer");
            await context.webRTC.setLocalDescription(offer);

            // Send the offer to the remote peer.

            console.log("---> Sending the offer to the remote peer");
            const message: SignalOfferData = {
              type: "signal-offer",
              to: context.targetId,
              signal: context.webRTC.localDescription!,
            };
            context.socket.send(JSON.stringify(message));
          } catch (err) {
            console.error(
              "*** The following error occurred while handling the negotiationneeded event:",
              err,
            );
          }
        };
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
export const useWebRTCConnection = () =>
  useSelector(store, (state) => state.context.webRTC);
