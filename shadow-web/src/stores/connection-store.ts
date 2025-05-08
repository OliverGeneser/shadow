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
const config: RTCConfiguration = {
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
  ciphertext: Uint8Array,
) {
  try {
    return await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: initializationVector },
      key,
      ciphertext,
    );
  } catch (e) {
    console.log(e);
  }
}

export const store = createStore({
  context: {
    clientId: "",
    roomId: "",
    keyPair: await window.crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-384",
      },
      false,
      ["deriveKey"],
    ),
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
    socket: new WebSocket(serverUrl),
  },
  on: {
    setReceiveFile: (
      context,
      event: { peerId: string; file: File | undefined },
    ) => ({
      ...context,
      receiveFiles: {
        ...context.receiveFiles,
        [event.peerId]: event.file,
      },
    }),
    setClients: (context, event: { clients: Clients }) => {
      console.log("THE sTORE is FUCKEd", event.clients);
      return { ...context, clients: event.clients };
    },
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
          case "clients": {
            console.log("CLIENTSS", msg.clients);
            //store.send({ type: "setClients", clients: msg.clients });
            //break;
            //
            return { ...context, clients: msg.clients };
          }
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
                context.socket.send(JSON.stringify(message));
              }
            };
            const func = async () => {
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
                context.socket.send(JSON.stringify(message));
              }
            };

            func();

            localPeer.ondatachannel = async (e) => {
              const dataChannel = e.channel;
              dataChannel.binaryType = "arraybuffer";
              dataChannel.bufferedAmountLowThreshold = 0;
              dataChannel.onmessage = async (e) => {
                const receiveBuffer = context.receiveBuffers[msg.from] ?? [];
                let receivedSize = context.receiveSizes[msg.from] ?? 0;
                const receivedFile =
                  context.receiveFiles[msg.from] ?? undefined;
                console.log(context.receiveFiles);

                const client = context.clients.filter(
                  (client) => client.clientId === msg.from,
                );
                if (client.length === 0) return;

                const publicKey = await window.crypto.subtle.importKey(
                  "jwk",
                  client[0].publicKey,
                  {
                    name: "ECDH",
                    namedCurve: "P-384",
                  },
                  true,
                  [],
                );

                const secretKey = await deriveSecretKey(
                  context.keyPair.privateKey,
                  publicKey,
                );

                const WSData = JSON.parse(e.data);

                const data = new TextDecoder().decode(
                  await decryptMessage(
                    secretKey,
                    new Uint8Array(WSData.initializationVector),
                    new Uint8Array(WSData.encryptedChunk),
                  ),
                );
                if (!data) {
                  throw new Error("Failed to decrypt!!!");
                }

                console.log(data);
                console.log(receivedFile);

                if (receivedFile === undefined) {
                  console.log("setting file");
                  const file = JSON.parse(data);
                  store.send({
                    type: "setReceiveFile",
                    peerId: msg.from,
                    file,
                  });
                  return;
                }

                receiveBuffer.push(data);
                // @ts-expect-error Missing type
                receivedSize += data.byteLength;

                if (receivedSize == receivedFile["size"]) {
                  const blob = new Blob(context.receiveBuffers[msg.from], {
                    type: receivedFile["type"],
                  });
                  const fileURL = URL.createObjectURL(blob);
                  store.send({
                    type: "newFile",
                    peerId: msg.from,
                    fileName: receivedFile.name,
                    fileURL,
                  });
                  return;
                }

                store.send({
                  type: "pushToReceiveBuffer",
                  peerId: msg.from,
                  receiveBuffer,
                  receivedSize,
                });
              };

              dataChannel.onopen = () =>
                console.log("Connected to sender peer.");

              store.send({
                type: "setFileChannelConnection",
                peerId: msg.from,
                dataChannel: dataChannel,
              });
            };

            return {
              ...context,
              webrtcConnections: {
                ...context.webrtcConnections,
                [msg.from]: localPeer,
              },
            };
          }

          case "answer": {
            let localPeer;
            if (context.webrtcConnections[msg.from]) {
              localPeer = context.webrtcConnections[msg.from];
            } else {
              return { ...context };
            }

            localPeer.setRemoteDescription(msg.answer);

            return {
              ...context,
              webrtcConnections: {
                ...context.webrtcConnections,
                [msg.from]: localPeer,
              },
            };
          }

          case "candidate": {
            let localPeer;
            if (context.webrtcConnections[msg.from]) {
              localPeer = context.webrtcConnections[msg.from];
            } else {
              return { ...context };
            }

            localPeer.addIceCandidate(msg.candidate);

            return {
              ...context,
              webrtcConnections: {
                ...context.webrtcConnections,
                [msg.from]: localPeer,
              },
            };
          }

          case "leave": {
            console.log(
              "LEVING",
              context.clients.filter(
                (client) => client.clientId !== msg.client,
              ),
            );
            store.send({
              type: "setClients",
              clients: context.clients.filter(
                (client) => client.clientId !== msg.client,
              ),
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
      return context;
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
    setupSocket: (context, event: { type: "setupSocket"; roomId: string }) => {
      const tempSocket = context.socket;

      tempSocket.onopen = async function () {
        console.log("Connection Open!");

        const message: RoomData = {
          type: "create or join",
          roomId: event.roomId,
          publicKey: await window.crypto.subtle.exportKey(
            "jwk",
            context.keyPair.publicKey,
          ),
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
    newFile: (
      context,
      event: { peerId: string; fileURL: string; fileName: string },
    ) => {
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

      enqueue.effect(async () => {
        let offset = 0;
        const maxChunkSize = 16384;

        console.log(dataChannel.bufferedAmountLowThreshold);
        const client = context.clients.filter(
          (client) => client.clientId === event.peerId,
        );
        if (client.length === 0) return context;

        console.log(client[0].publicKey);

        const publicKey = await window.crypto.subtle.importKey(
          "jwk",
          client[0].publicKey,
          {
            name: "ECDH",
            namedCurve: "P-384",
          },
          true,
          [],
        );

        const secretKey = await deriveSecretKey(
          context.keyPair.privateKey,
          publicKey,
        );

        if (dataChannel) {
          const initializationVector = window.crypto.getRandomValues(
            new Uint8Array(8),
          );

          const encryptedChunk = await encryptMessage(
            secretKey,
            initializationVector,
            new TextEncoder().encode(
              JSON.stringify({
                name: event.file.name,
                size: event.file.size,
                type: event.file.type,
              }),
            ).buffer,
          );
          if (!encryptedChunk) {
            throw new Error("Failed to encrypt!!!");
          }

          dataChannel.send(
            JSON.stringify({
              encryptedChunk: Array.from(new Uint8Array(encryptedChunk)),
              initializationVector: Array.from(initializationVector),
            }),
          );
        }

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

              dataChannel.send(
                JSON.stringify({
                  encryptedChunk: Array.from(new Uint8Array(encryptedChunk)),
                  initializationVector: Array.from(initializationVector),
                }),
              );
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
      event: {
        peerId: string;
        receiveBuffer: BlobPart[];
        receivedSize: number;
      },
    ) => {
      return {
        ...context,
        receiveBuffers: {
          ...context.receiveBuffers,
          [event.peerId]: event.receiveBuffer,
        },
        receiveSizes: {
          ...context.receiveSizes,
          [event.peerId]: event.receivedSize,
        },
      };
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

      dataChannel.bufferedAmountLowThreshold = 0;
      dataChannel.onopen = () => console.log("Connected to receiver peer.");

      localPeer.onicecandidate = ({ candidate }) => {
        if (candidate) {
          const message: SignalCandidateData = {
            type: "signal-candidate",
            to: event.peerId,
            signal: candidate,
          };
          context.socket.send(JSON.stringify(message));
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
            context.socket.send(JSON.stringify(message));
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

console.log("store", store);
store.subscribe((snapshot) =>
  console.log(
    "sub",
    snapshot.context.clientId,
    snapshot.context.clients,
    snapshot.context.receiveFiles,
    snapshot.context.receivedFiles,
    snapshot.context.receiveSizes,
  ),
);

export const useClientId = () =>
  useSelector(store, (state) => state.context.clientId);
export const useRoomId = () =>
  useSelector(store, (state) => state.context.roomId);
export const useClients = () =>
  useSelector(store, (state) => state.context.clients);
export const useSocketState = () =>
  useSelector(store, (state) => state.context.socket.readyState);
export const useNewFiles = () =>
  useSelector(store, (state) => state.context.receivedFiles);
