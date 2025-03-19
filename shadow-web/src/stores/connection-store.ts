import { createStore } from "@xstate/store";
import { useSelector } from "@xstate/store/react";
import { serverUrl } from "../socket";

export type ClientArray = {
  clientId: string;
}[];

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

function getOnIceCandidate(socket, peer_id) {
  return (event) => {
    if (event.candidate != null) {
      const message = {
        to: [peer_id],
        event: "candidate",
        data: event.candidate,
      };
      socket.send(JSON.stringify(message));
    }
  };
}

export const store = createStore({
  context: {
    clientId: "",
    targetId: "",
    roomId: "",
    clients: [] as ClientArray,
    rtcConnections: {},
    webRTC: new RTCPeerConnection(config),
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
          case "offer":
            console.log("offer, ", event);
            break;

          default:
            console.error("Unknown message received:");
            console.error(msg);
        }
      } catch (e) {
        console.log(e, event.event.data);
      }
    },
    setTarget: (context, event: { targetId: string }) => {
      return { ...context, targetId: event.targetId };
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
    startRTCConnection: (context, event: { peerId: string }) => {
      const connection = new RTCPeerConnection(config);
      connection.onicecandidate = getOnIceCandidate(
        context.socket,
        event.peerId,
      );
      const connections = context.rtcConnections;
      connections[event.peerId] = connection;

      console.log(connections);
      return { ...context, rtcConnections: connections };
    },
    setupConnection: (context) => {
      console.log("Setting up a connection...");

      context.webRTC.onicecandidate = function handleICECandidateEvent(event) {
        if (event.candidate) {
          console.log(
            "*** Outgoing ICE candidate: " + event.candidate.candidate,
          );
        }
      };

      context.webRTC.oniceconnectionstatechange =
        function handleICEConnectionStateChangeEvent(event) {
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
        function handleSignalingStateChangeEvent(event) {
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
        function handleICEGatheringStateChangeEvent(event) {
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
            store.trigger.sendMessage({
              message: {
                name: context.clientId,
                target: context.targetId,
                type: "signal-offer",
                sdp: context.webRTC.localDescription,
              },
            });
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
