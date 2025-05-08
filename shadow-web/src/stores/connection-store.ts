import { createStore } from "@xstate/store";
import { useSelector } from "@xstate/store/react";
import { sendMessageWithRetry } from "../socket";
import {
  SignalCandidateData,
  Clients,
  RoomData,
  SignalOfferData,
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
export const webrtcConfig: RTCConfiguration = {
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
    websocketConnectionStatus: "init" as
      | "init"
      | "connecting"
      | "connected"
      | "disconnected",
    clientId: undefined as string | undefined,
    roomId: "",
    keyPair: undefined as CryptoKeyPair | undefined,
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
  },
  on: {
    setKeyPair: (context, event: { keyPair: CryptoKeyPair }) => ({
      ...context,
      keyPair: event.keyPair,
    }),
    setWebsocketConnectionStatus: (
      context,
      event: { state: "init" | "connecting" | "connected" | "disconnected" },
    ) => ({
      ...context,
      websocketConnectionStatus: event.state,
    }),
    changeRoom: (context, event: { roomId: string }, enqueue) => {
      enqueue.effect(async () => {
        try {
          const keyPair = await window.crypto.subtle.generateKey(
            {
              name: "ECDH",
              namedCurve: "P-384",
            },
            false,
            ["deriveKey"],
          );
          store.trigger.setKeyPair({ keyPair: keyPair });

          const message: RoomData = {
            type: "create or join",
            roomId: event.roomId,
            publicKey: await window.crypto.subtle.exportKey(
              "jwk",
              keyPair.publicKey,
            ),
          };

          await sendMessageWithRetry(JSON.stringify(message));
        } catch (e) {
          console.log(e);
        }
      });
      return { ...context, roomId: event.roomId };
    },
    setClientId: (context, event: { clientId: string }) => ({
      ...context,
      clientId: event.clientId,
    }),
    setWebRTCConnection: (
      context,
      event: { peerId: string; connection: RTCPeerConnection },
    ) => ({
      ...context,
      webrtcConnections: {
        ...context.webrtcConnections,
        [event.peerId]: event.connection,
      },
    }),
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
    setClients: (context, event: { clients: Clients }) => {
      const oldClientIds = new Set(
        context.clients.map((client) => client.clientId),
      );
      const diffClients = event.clients.filter(
        (newClient) => !oldClientIds.has(newClient.clientId),
      );

      const connections: WebRTCConnections = {};

      diffClients.forEach((client) => {
        const localPeer = new RTCPeerConnection(webrtcConfig);

        localPeer.onicecandidate = async ({ candidate }) => {
          if (candidate) {
            const message: SignalCandidateData = {
              type: "signal-candidate",
              to: client.clientId,
              signal: candidate,
            };
            await sendMessageWithRetry(JSON.stringify(message));
          }
        };

        localPeer.ondatachannel = async (e) => {
          const dataChannel = e.channel;
          dataChannel.binaryType = "arraybuffer";
          dataChannel.bufferedAmountLowThreshold = 0;

          dataChannel.onopen = () => console.log("Connected to sender peer.");

          dataChannel.onmessage = async (e) => {
            const receiveBuffers = store
              .select((state) => state.receiveBuffers)
              .get();
            const receiveBuffer = receiveBuffers[client.clientId] ?? [];

            const receiveSizes = store
              .select((state) => state.receiveSizes)
              .get();
            let receivedSize = receiveSizes[client.clientId] ?? 0;

            const receiveFiles = store
              .select((state) => state.receiveFiles)
              .get();
            const receiveFile = receiveFiles[client.clientId] ?? undefined;

            const publicKey = await window.crypto.subtle.importKey(
              "jwk",
              client.publicKey,
              {
                name: "ECDH",
                namedCurve: "P-384",
              },
              true,
              [],
            );

            const secretKey = await deriveSecretKey(
              context.keyPair!.privateKey,
              publicKey,
            );

            const WSData = JSON.parse(e.data);

            const data = await decryptMessage(
              secretKey,
              new Uint8Array(WSData.initializationVector),
              new Uint8Array(WSData.encryptedChunk),
            );
            if (!data) {
              throw new Error("Failed to decrypt!!!");
            }

            if (receiveFile === undefined) {
              console.log(receiveFile, data);
              const file = JSON.parse(new TextDecoder().decode(data));
              store.trigger.setReceiveFile({
                peerId: client.clientId,
                file,
              });
              return;
            }

            receiveBuffer.push(data);
            receivedSize += data.byteLength;

            if (receivedSize == receiveFile["size"]) {
              const blob = new Blob(context.receiveBuffers[client.clientId], {
                type: receiveFile["type"],
              });
              const fileURL = URL.createObjectURL(blob);
              store.trigger.newFile({
                peerId: client.clientId,
                fileURL,
                fileName: receiveFile.name,
              });
              return;
            }

            store.trigger.pushToReceiveBuffer({
              peerId: client.clientId,
              receivedSize,
              receiveBuffer,
            });
          };

          store.trigger.setFileChannelConnection({
            peerId: client.clientId,
            dataChannel: dataChannel,
          });
        };

        localPeer.onnegotiationneeded = async () => {
          try {
            await localPeer.setLocalDescription(await localPeer.createOffer());

            if (localPeer.localDescription !== null) {
              const message: SignalOfferData = {
                type: "signal-offer",
                to: client.clientId,
                signal: localPeer.localDescription,
              };
              await sendMessageWithRetry(JSON.stringify(message));
            }
          } catch (err) {
            console.error(err);
          }
        };

        connections[client.clientId] = localPeer;
      });

      return {
        ...context,
        clients: event.clients,
        webrtcConnections: { ...context.webrtcConnections, ...connections },
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

        const client = context.clients.find(
          (client) => client.clientId === event.peerId,
        );
        if (!client) return context;

        const publicKey = await window.crypto.subtle.importKey(
          "jwk",
          client.publicKey,
          {
            name: "ECDH",
            namedCurve: "P-384",
          },
          true,
          [],
        );
        const keyPair = store.select((state) => state.keyPair).get();

        const secretKey = await deriveSecretKey(keyPair!.privateKey, publicKey);

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
    setupConnection: (context, event: { peerId: string }) => {
      console.log("Setting up data channel connection...");
      let localPeer;
      if (context.webrtcConnections[event.peerId]) {
        localPeer = context.webrtcConnections[event.peerId];
      } else {
        return context;
      }

      const dataChannel = localPeer.createDataChannel("fileChannel");
      dataChannel.binaryType = "arraybuffer";

      dataChannel.bufferedAmountLowThreshold = 0;
      dataChannel.onopen = () => console.log("Connected to receiver peer.");

      return {
        ...context,
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
  useSelector(store, (state) => state.context.websocketConnectionStatus);
export const useNewFiles = () =>
  useSelector(store, (state) => state.context.receivedFiles);
