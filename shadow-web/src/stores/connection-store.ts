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
  WSResponse,
} from "shadow-shared";

export interface rtcConnectionsArray {
  clientId: string;
}

interface WebRTCConnections {
  [key: string]: RTCPeerConnection;
}
interface DataChannelConnections {
  [key: string]: RTCDataChannel;
}
interface ReceivedFiles {
  name: string;
  url: string;
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
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_PASSWORD,
    },
  ],
};

function deriveSecretKey(privateKey: CryptoKey, publicKey: CryptoKey) {
  return window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptMessage(
  key: CryptoKey,
  initializationVector: Uint8Array,
  message: ArrayBuffer,
) {
  try {
    return await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: initializationVector },
      key,
      message,
    );
  } catch (e) {
    console.log(e);
  }
}

async function decryptMessage(
  key: CryptoKey,
  initializationVector: Uint8Array,
  ciphertext: ArrayBuffer,
) {
  try {
    const decryptedText = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: initializationVector },
      key,
      ciphertext,
    );
    const utf8Decoder = new TextDecoder();
    return utf8Decoder.decode(decryptedText);
  } catch (e) {
    console.log(e);
  }
}

export const store = createStore({
  context: {
    clientId: "",
    roomId: "",
    keyPair: null as CryptoKeyPair | null,
    clients: [] as Clients,
    receivedFiles: [] as ReceivedFiles[],
    receiveBuffers: {} as { [id: string]: BlobPart[] },
    receiveSizes: {} as { [id: string]: number },
    receiveFiles: {} as {
      [id: string]: { name: string; size: number; type: string } | undefined;
    },
    webrtcConnections: {} as WebRTCConnections,
    fileChannelConnections: {} as DataChannelConnections,
    chatChannelConnections: {} as DataChannelConnections,
    socket: null as WebSocket | null,
  },
  on: {
    setCryptoKey: (context, event: { keys: CryptoKeyPair }) => {
      return { ...context, keyPair: event.keys };
    },
    setWebSocket: (context, event: { webSocket: WebSocket }) => {
      return { ...context, socket: event.webSocket };
    },
    setClientId: (context, event: { clientId: string }) => {
      return { ...context, clientId: event.clientId };
    },
    setClients: (context, event: { clients: Clients }) => {
      return { ...context, clients: event.clients };
    },
    setFileChannelConnection: (
      context,
      event: { peerId: string; dataChannel: RTCDataChannel },
    ) => {
      return {
        ...context,
        fileChannelConnections: {
          ...context.fileChannelConnections,
          [event.peerId]: event.dataChannel,
        },
      };
    },
    setWebRTCConnections: (
      context,
      event: { peerId: string; connection: RTCPeerConnection },
    ) => {
      return {
        ...context,
        webrtcConnections: {
          ...context.webrtcConnections,
          [event.peerId]: event.connection,
        },
      };
    },
    setRoom: (context, event: { roomId: string }, enqueue) => {
      enqueue.effect(async () => {
        const keys = await window.crypto.subtle.generateKey(
          {
            name: "ECDH",
            namedCurve: "P-384",
          },
          false,
          ["deriveKey"],
        );

        store.send({ type: "setCryptoKey", keys });

        const webSocket = new WebSocket(serverUrl);

        webSocket.onopen = function () {
          console.log("Connection Open!");
          const message: RoomData = {
            type: "create or join",
            roomId: event.roomId,
            publicKey: keys.publicKey,
          };

          webSocket.send(JSON.stringify(message));
        };

        webSocket.onmessage = async (event) => {
          try {
            const msg = WSResponse.parse(JSON.parse(event.data));

            switch (msg.type) {
              case "ready": {
                const message: ClientsData = {
                  type: "clients",
                };
                webSocket.send(JSON.stringify(message));
                store.send({
                  type: "setClientId",
                  clientId: msg.metadata.clientId,
                });
                break;
              }
              case "clients":
                store.send({ type: "setClients", clients: msg.clients });
                break;
              case "offer": {
                let localPeer;
                if (context.webrtcConnections[msg.from]) {
                  localPeer = context.webrtcConnections[msg.from];
                } else {
                  localPeer = new RTCPeerConnection(config);
                }

                localPeer.onicecandidate = ({ candidate }) => {
                  if (candidate) {
                    const message: SignalCandidateData = {
                      type: "signal-candidate",
                      to: msg.from,
                      signal: candidate,
                    };
                    webSocket.send(JSON.stringify(message));
                  }
                };

                await localPeer.setRemoteDescription(msg.offer);
                await localPeer.setLocalDescription(
                  await localPeer.createAnswer(),
                );
                if (localPeer.localDescription !== null) {
                  const message: SignalAnswerData = {
                    type: "signal-answer",
                    to: msg.from,
                    signal: localPeer.localDescription,
                  };
                  webSocket.send(JSON.stringify(message));
                }

                localPeer.ondatachannel = (e) => {
                  const dataChannel = e.channel;
                  dataChannel.binaryType = "arraybuffer";
                  dataChannel.bufferedAmountLowThreshold = 0;
                  dataChannel.onmessage = (e) =>
                    store.send({
                      type: "onReceiveMessageCallback",
                      peerId: msg.from,
                      event: e,
                    });

                  dataChannel.onopen = () =>
                    console.log("Connected to sender peer.");

                  store.send({
                    type: "setFileChannelConnection",
                    peerId: msg.from,
                    dataChannel: dataChannel,
                  });
                };

                store.send({
                  type: "setWebRTCConnections",
                  peerId: msg.from,
                  connection: localPeer,
                });
                break;
              }
              case "answer": {
                let localPeer;
                if (context.webrtcConnections[msg.from]) {
                  localPeer = context.webrtcConnections[msg.from];
                } else {
                  break;
                }

                localPeer.setRemoteDescription(msg.answer);

                store.send({
                  type: "setWebRTCConnections",
                  peerId: msg.from,
                  connection: localPeer,
                });
                break;
              }

              case "candidate": {
                let localPeer;
                if (context.webrtcConnections[msg.from]) {
                  localPeer = context.webrtcConnections[msg.from];
                } else {
                  break;
                }

                localPeer.addIceCandidate(msg.candidate);
                store.send({
                  type: "setWebRTCConnections",
                  peerId: msg.from,
                  connection: localPeer,
                });
                break;
              }
              case "leave":
                store.send({
                  type: "setClients",
                  clients: context.clients.filter(
                    (client) => client.clientId !== msg.client,
                  ),
                });
                break;
              default:
                console.error("Unknown message received:");
                console.error(msg);
            }
          } catch (e) {
            console.log(e);
          }
        };

        webSocket.onclose = function () {
          console.log("Connection Closed!");
        };

        store.send({ type: "setWebSocket", webSocket });
      });

      return { ...context, roomId: event.roomId };
    },
    sendData: (context, event: { peerId: string; data: File }) => {
      let dataChannel;
      if (context.fileChannelConnections[event.peerId]) {
        dataChannel = context.fileChannelConnections[event.peerId];
      } else {
        return context;
      }
      if (dataChannel) {
        dataChannel.send(
          JSON.stringify({
            name: "hey.ts",
            size: 200,
            type: "ts",
          }),
        );
      }
      return {
        ...context,
        fileChannelConnections: {
          ...context.fileChannelConnections,
          [event.peerId]: dataChannel,
        },
      };
    },
    newFile: (context, event: { fileURL: string; fileName: string }) => {
      return {
        ...context,
        receivedFiles: [
          ...context.receivedFiles,
          { url: event.fileURL, name: event.fileName },
        ],
      };
    },
    sendFile: (context, event: { peerId: string; file: File }, enqueue) => {
      let dataChannel;
      if (context.fileChannelConnections[event.peerId]) {
        dataChannel = context.fileChannelConnections[event.peerId];
      } else {
        return context;
      }
      if (dataChannel) {
        dataChannel.send(
          JSON.stringify({
            name: event.file.name,
            size: event.file.size,
            type: event.file.type,
          }),
        );
      }

      enqueue.effect(async () => {
        let offset = 0;
        const maxChunkSize = 16384;

        console.log(dataChannel.bufferedAmountLowThreshold);
        const client = context.clients.filter(
          (client) => client.clientId === event.peerId,
        );
        if (client.length === 0) return;
        if (!context.keyPair) return;

        console.log(client[0].publicKey);
        const secretKey = await deriveSecretKey(
          context.keyPair.privateKey,
          client[0].publicKey,
        );

        await event.file.arrayBuffer().then(async (buffer) => {
          const send = async () => {
            while (buffer.byteLength) {
              if (
                dataChannel.bufferedAmount >
                dataChannel.bufferedAmountLowThreshold
              ) {
                dataChannel.onbufferedamountlow = () => {
                  dataChannel.onbufferedamountlow = null;
                  send();
                };
                return;
              }
              const chunk = buffer.slice(0, maxChunkSize);
              buffer = buffer.slice(maxChunkSize, buffer.byteLength);

              const initializationVector = window.crypto.getRandomValues(
                new Uint8Array(8),
              );
              const encryptedChunk = await encryptMessage(
                secretKey,
                initializationVector,
                chunk,
              );
              if (!encryptedChunk) {
                throw new Error("Failed to encrypt!!!");
              }

              dataChannel.send(encryptedChunk);
              offset += maxChunkSize;
              console.log("Sent " + offset + " bytes.");
              console.log(((offset / event.file.size) * 100).toFixed(1) + "%");
            }
          };

          await send();
        });
      });
    },

    pushToReceiveBuffer: (
      context,
      event: { peerId: string; blob: BlobPart },
    ) => {
      return {
        ...context,
        receiveBuffers: {
          ...context.receiveBuffers,
          [event.peerId]: [...context.receiveBuffers[event.peerId], event.blob],
        },
      };
    },
    onReceiveMessageCallback: (
      context,
      event: { peerId: string; event: MessageEvent },
    ) => {
      const receive = async () => {
        const receiveBuffer = context.receiveBuffers[event.peerId] ?? [];
        let receivedSize = context.receiveSizes[event.peerId] ?? 0;
        let receivedFile = context.receiveFiles[event.peerId] ?? undefined;

        const client = context.clients.filter(
          (client) => client.clientId === event.peerId,
        );
        if (client.length === 0) return;
        if (!context.keyPair) return;
        console.log(client[0].publicKey);
        const secretKey = await deriveSecretKey(
          context.keyPair.privateKey,
          client[0].publicKey,
        );

        const initializationVector = window.crypto.getRandomValues(
          new Uint8Array(8),
        );

        const data = await decryptMessage(
          secretKey,
          initializationVector,
          event.event.data,
        );
        if (!data) {
          throw new Error("Failed to encrypt!!!");
        }

        if (receivedFile == undefined) {
          const file = JSON.parse(data);
          receivedFile = file;
          return {
            ...context,
            receiveFiles: {
              ...context.receiveFiles,
              [event.peerId]: receivedFile,
            },
          };
        }
        receiveBuffer.push(data);
        // @ts-expect-error Missing type
        receivedSize += data.byteLength;

        if (receivedSize == receivedFile["size"]) {
          const blob = new Blob(context.receiveBuffers[event.peerId], {
            type: receivedFile["type"],
          });
          const fileURL = URL.createObjectURL(blob);
          return {
            ...context,
            receiveBuffers: {
              ...context.receiveBuffers,
              [event.peerId]: [],
            },
            receiveSizes: {
              ...context.receiveSizes,
              [event.peerId]: 0,
            },
            receiveFiles: {
              ...context.receiveFiles,
              [event.peerId]: undefined,
            },
            receivedFiles: [
              ...context.receivedFiles,
              { name: receivedFile.name, url: fileURL },
            ],
          };
        }

        return {
          ...context,
          receiveBuffers: {
            ...context.receiveBuffers,
            [event.peerId]: receiveBuffer,
          },
          receiveSizes: {
            ...context.receiveSizes,
            [event.peerId]: receivedSize,
          },
        };
      };
      receive();
    },

    setupConnection: (context, event: { peerId: string }) => {
      console.log("Setting up a connection...");
      let localPeer;
      if (context.webrtcConnections[event.peerId]) {
        return context;
      } else {
        localPeer = new RTCPeerConnection(config);
      }

      const dataChannel = localPeer.createDataChannel("fileChannel");
      dataChannel.binaryType = "arraybuffer";
      dataChannel.onmessage = (e) =>
        store.send({
          type: "onReceiveMessageCallback",
          peerId: event.peerId,
          event: e,
        });
      dataChannel.bufferedAmountLowThreshold = 0;
      dataChannel.onopen = () => console.log("Connected to receiver peer.");

      localPeer.onicecandidate = ({ candidate }) => {
        if (candidate) {
          const message: SignalCandidateData = {
            type: "signal-candidate",
            to: event.peerId,
            signal: candidate,
          };
          context.socket!.send(JSON.stringify(message));
        }
      };

      localPeer.onnegotiationneeded = async () => {
        try {
          await localPeer.setLocalDescription(await localPeer.createOffer());

          if (localPeer.localDescription !== null) {
            const message: SignalOfferData = {
              type: "signal-offer",
              to: event.peerId,
              signal: localPeer.localDescription,
            };
            context.socket!.send(JSON.stringify(message));
          }
        } catch (err) {
          console.error(err);
        }
      };

      return {
        ...context,
        webrtcConnections: {
          ...context.webrtcConnections,
          [event.peerId]: localPeer,
        },
        fileChannelConnections: {
          ...context.fileChannelConnections,
          [event.peerId]: dataChannel,
        },
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
  useSelector(store, (state) =>
    state.context.socket ? state.context.socket.readyState : undefined,
  );
export const useNewFiles = () =>
  useSelector(store, (state) => state.context.receivedFiles);
