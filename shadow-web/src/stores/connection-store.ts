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
type DataChannelConnections = Record<string, RTCDataChannel>;
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

const receiveBuffers: { [id: string]: ArrayBuffer[] } = {};
const receiveSizes: { [id: string]: number } = {};

interface Message {
  id: string;
  data: string;
}

const messageProcessing = async (message: Message): Promise<void> => {
  console.log(`Processed task ${message.id}: ${message.data}`);

  const keyPair = store.select((state) => state.keyPair).get();
  const clients = store.select((state) => state.clients).get();
  const client = clients.find((client) => client.clientId === message.id);
  if (!client) throw new Error("Client is missing!");

  const receiveFiles = store.select((state) => state.receiveFiles).get();
  const receiveFile = receiveFiles[message.id] ?? undefined;

  const receiveBuffer = receiveBuffers[message.id] ?? [];
  console.log("reeeeeeeeeee bufff", receiveBuffer);

  let receivedSize = receiveSizes[message.id] ?? 0;

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

  const secretKey = await deriveSecretKey(keyPair!.privateKey, publicKey);

  const WSData = JSON.parse(message.data);

  const data = await decryptMessage(
    secretKey,
    new Uint8Array(WSData.initializationVector),
    new Uint8Array(WSData.encryptedChunk),
  );
  if (!data) {
    throw new Error("Failed to decrypt!!!");
  }

  if (receiveFile === undefined) {
    try {
      const file = JSON.parse(new TextDecoder().decode(data));
      store.trigger.setReceiveFile({
        peerId: message.id,
        file,
      });
      return;
    } catch (e) {
      console.log(e);
      return;
    }
  } else {
    receiveBuffer.push(data);
    receivedSize += data.byteLength;

    if (receivedSize == receiveFile["size"]) {
      const blob = new Blob(receiveBuffer, {
        type: receiveFile["type"],
      });
      const fileURL = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = fileURL;
      a.download = receiveFile.name || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(fileURL);
      receiveBuffers[message.id] = [];
      receiveSizes[message.id] = 0;

      return;
    }
    receiveBuffers[message.id] = receiveBuffer;
    receiveSizes[message.id] = receivedSize;
  }
};

class FIFOQueue<T> {
  private queue: T[] = [];
  private isProcessing: boolean = false;

  constructor(private processItem: (item: T) => Promise<void>) {}

  enqueue(item: T): void {
    this.queue.push(item);
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        try {
          await this.processItem(item);
        } catch (error) {
          console.error("Error processing item:", error);
        }
      }
    }

    this.isProcessing = false;
  }
}

const messageQueue = new FIFOQueue<Message>(messageProcessing);

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
    setReceiveFile: (
      context,
      event: {
        peerId: string;
        file: { name: string; size: number; type: string } | undefined;
      },
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
    removeFileChannelConnection: (context, event: { peerId: string }) => {
      const { [event.peerId]: _, ...updatedConnections } =
        context.fileChannelConnections;

      return {
        ...context,
        fileChannelConnections: {
          ...updatedConnections,
        },
      };
    },
    setChatChannelConnection: (
      context,
      event: { peerId: string; dataChannel: RTCDataChannel },
    ) => {
      return {
        ...context,
        chatChannelConnections: {
          ...context.chatChannelConnections,
          [event.peerId]: event.dataChannel,
        },
      };
    },
    removeChatChannelConnection: (context, event: { peerId: string }) => {
      const { [event.peerId]: _, ...updatedConnections } =
        context.chatChannelConnections;

      return {
        ...context,
        chatChannelConnections: {
          ...updatedConnections,
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
      const dataChannelConnecions: DataChannelConnections = {};

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
          switch (dataChannel.label) {
            case "chatChannel":
              setUpDataChannel(dataChannel, client.clientId);
              store.trigger.setChatChannelConnection({
                peerId: client.clientId,
                dataChannel: dataChannel,
              });
              break;
            case "fileChannel":
              dataChannel.binaryType = "arraybuffer";
              dataChannel.bufferedAmountLowThreshold = 0;

              dataChannel.onopen = () =>
                console.log("Connected to sender peer.");

              dataChannel.onclose = () =>
                store.trigger.removeFileChannelConnection({
                  peerId: client.clientId,
                });

              dataChannel.onmessage = (e) => {
                messageQueue.enqueue({ id: client.clientId, data: e.data });
              };

              store.trigger.setFileChannelConnection({
                peerId: client.clientId,
                dataChannel: dataChannel,
              });
          }
        };

        if (oldClientIds.size > 0) {
          localPeer.onnegotiationneeded = async () => {
            try {
              await localPeer.setLocalDescription(
                await localPeer.createOffer(),
              );

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

          const dataChannel = localPeer.createDataChannel("chatChannel");
          setUpDataChannel(dataChannel, client.clientId);
          dataChannelConnecions[client.clientId] = dataChannel;
        }

        connections[client.clientId] = localPeer;
      });

      return {
        ...context,
        clients: event.clients,
        webrtcConnections: { ...context.webrtcConnections, ...connections },
        chatChannelConnections: {
          ...context.chatChannelConnections,
          ...dataChannelConnecions,
        },
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
        const maxChunkSize = 14000; //16384;

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

        await new Promise((res) => setTimeout(res, 1000));

        await event.file.arrayBuffer().then(async (buffer) => {
          const send = async () => {
            while (buffer.byteLength) {
              if (
                dataChannel.bufferedAmount >
                dataChannel.bufferedAmountLowThreshold
              ) {
                dataChannel.onbufferedamountlow = async () => {
                  dataChannel.onbufferedamountlow = null;
                  await send();
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
    sendChatMessage: (context, event: { message: string }) => {
      for (const to in context.chatChannelConnections) {
        const dataChannel = context.chatChannelConnections[to];
        dataChannel.send(event.message);
      }
    },
    setupConnection: (context, event: { peerId: string }) => {
      console.log("Setting up file channel connection...");
      let localPeer;
      if (context.webrtcConnections[event.peerId]) {
        localPeer = context.webrtcConnections[event.peerId];
      } else {
        return context;
      }
      const dataChannel = localPeer.createDataChannel("fileChannel");

      console.log("peer", localPeer);
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

const setUpDataChannel = (dataChannel: RTCDataChannel, peerId: string) => {
  dataChannel.binaryType = "arraybuffer";
  dataChannel.bufferedAmountLowThreshold = 0;

  dataChannel.onopen = () =>
    console.log("Connected to data channel receiver peer.");

  dataChannel.onclose = () => {
    store.trigger.removeChatChannelConnection({
      peerId,
    });
  };

  dataChannel.onmessage = async (e) => {
    console.log("Receiving message:", e.data);
  };
};


export const useClientId = () =>
  useSelector(store, (state) => state.context.clientId);
export const useKeyPair = () =>
  useSelector(store, (state) => state.context.keyPair);
export const useRoomId = () =>
  useSelector(store, (state) => state.context.roomId);
export const useClients = () =>
  useSelector(store, (state) => state.context.clients);
export const useSocketState = () =>
  useSelector(store, (state) => state.context.websocketConnectionStatus);
