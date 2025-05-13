import { createStore } from "@xstate/store";
import { useSelector } from "@xstate/store/react";
import { sendMessageWithRetry } from "../socket";
import {
  SignalCandidateData,
  Clients,
  RoomData,
  SignalOfferData,
  activity,
} from "shadow-shared";
import { UUID } from "crypto";

export interface rtcConnectionsArray {
  clientId: string;
}

export type ChatMessages = {
  id: number;
  user: string;
  text: string;
}[];

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

console.log(import.meta.env.VITE_TURN_URL);
console.log(import.meta.env.VITE_TURN_USERNAME);
console.log(import.meta.env.VITE_TURN_PASSWORD);

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

  let file;

  try {
    file = JSON.parse(new TextDecoder().decode(data));
  } catch (_) {
    file = undefined;
  }

  if (file?.packetType === "transferAnswer") {
    try {
      if (file.accepted === true) {
        store.trigger.removeAwaitingApproval({
          fileId: file.fileId,
        });
      } else {
        const fileChannels = store
          .select((state) => state.fileChannelConnections)
          .get();
        fileChannels[client.clientId].close();
        store.trigger.removeAwaitingApproval({
          fileId: file.fileId,
        });
      }
      return;
    } catch (e) {
      console.log(e);
      return;
    }
  } else if (file?.packetType === "fileMetadata") {
    try {
      store.trigger.setReceiveFile({
        peerId: message.id,
        file,
      });
      store.trigger.setSenderAwaitingApproval({
        peerId: message.id,
        fileId: file.id,
        fileName: file.name,
      });
      return;
    } catch (e) {
      console.log(e);
      return;
    }
  } else {
    store.trigger.setClientActivity({
      clientId: message.id,
      activity: "receiving",
    });
    const sendersAwaitingApproval = store
      .select((state) => state.sendersAwaitingApproval)
      .get();
    if (!sendersAwaitingApproval.some((s) => s.peerId === message.id)) {
      if (receiveFile !== undefined) {
        receiveBuffer.push(data);
        receivedSize += data.byteLength;

        store.trigger.setClientProgress({
          clientId: message.id,
          progress: Math.floor(receivedSize/receiveFile["size"]*100),
        });

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

          store.trigger.setClientActivity({
            clientId: message.id,
            activity: undefined,
          });
          store.trigger.setClientProgress({
            clientId: message.id,
            progress: undefined,
          });

          return;
        }
        receiveBuffers[message.id] = receiveBuffer;
        receiveSizes[message.id] = receivedSize;
      }
    }
  }
};

const chatMessageProcessing = async (message: Message): Promise<void> => {
  const keyPair = store.select((state) => state.keyPair).get();
  const clients = store.select((state) => state.clients).get();
  const client = clients.find((client) => client.clientId === message.id);
  if (!client) throw new Error("Client is missing!");

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
    new Uint8Array(WSData.encryptedMessage),
  );
  if (!data) {
    throw new Error("Failed to decrypt!!!");
  }

  const plainText = new TextDecoder().decode(data);

  store.trigger.setNewChatMessage({
    message: plainText,
    peerId: message.id,
  });
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
const chatMessageQueue = new FIFOQueue<Message>(chatMessageProcessing);

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
    chatMessages: [] as ChatMessages,
    clients: [] as Clients,
    receiveFiles: {} as {
      [id: string]: { name: string; size: number; type: string } | undefined;
    },
    webrtcConnections: {} as WebRTCConnections,
    fileChannelConnections: {} as DataChannelConnections,
    chatChannelConnections: {} as DataChannelConnections,
    sendersAwaitingApproval: [] as {
      peerId: string;
      fileId: UUID;
      fileName: string;
    }[],
    awaitingApprovals: [] as { peerId: string; fileId: UUID }[],
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
    setNewChatMessage: (
      context,
      event: { peerId: string; message: string },
    ) => {
      const newId = context.chatMessages.length + 1;
      return {
        ...context,
        chatMessages: [
          ...context.chatMessages,
          { id: newId, user: event.peerId, text: event.message },
        ],
      };
    },
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
    setAwaitingApprovals: (
      context,
      event: { peerId: string; fileId: UUID },
    ) => {
      return {
        ...context,
        awaitingApprovals: [
          ...context.awaitingApprovals,
          { peerId: event.peerId, fileId: event.fileId },
        ],
      };
    },
    removeAwaitingApproval: (context, event: { fileId: UUID }) => {
      return {
        ...context,
        awaitingApprovals: [
          ...context.awaitingApprovals.filter((s) => s.fileId !== event.fileId),
        ],
      };
    },
    setSenderAwaitingApproval: (
      context,
      event: { peerId: string; fileId: UUID; fileName: string },
    ) => {
      return {
        ...context,
        sendersAwaitingApproval: [
          ...context.sendersAwaitingApproval,
          {
            peerId: event.peerId,
            fileId: event.fileId,
            fileName: event.fileName,
          },
        ],
      };
    },
    removeSenderAwaitingApproval: (context, event: { fileId: UUID }) => {
      return {
        ...context,
        sendersAwaitingApproval: [
          ...context.sendersAwaitingApproval.filter(
            (s) => s.fileId !== event.fileId,
          ),
        ],
      };
    },
    acceptOrDenyFileTransfer: (
      context,
      event: { fileId: UUID; accepted: boolean },
    ) => {
      const connection = context.sendersAwaitingApproval.find(
        (s) => s.fileId === event.fileId,
      );

      if (!connection) {
        console.log("No sendersAwaitingApproval found");
        return;
      }

      const dataChannel = context.fileChannelConnections[connection.peerId];
      if (!dataChannel) {
        console.log("No datachannel found");
        return;
      }

      const encryptAndSend = async () => {
        const client = context.clients.find(
          (client) => client.clientId === connection.peerId,
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

        const initializationVector = window.crypto.getRandomValues(
          new Uint8Array(8),
        );

        const encryptedChunk = await encryptMessage(
          secretKey,
          initializationVector,
          new TextEncoder().encode(
            JSON.stringify({
              packetType: "transferAnswer",
              fileId: event.fileId,
              accepted: event.accepted,
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
      };

      encryptAndSend();

      return {
        ...context,
        sendersAwaitingApproval: [
          ...context.sendersAwaitingApproval.filter(
            (s) => s.fileId !== connection.fileId,
          ),
        ],
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
              setUpFileChannel(dataChannel, client.clientId);
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
    setClientActivity: (
      context,
      event: { clientId: string; activity: activity },
    ) => {
      const updatedClients = context.clients.map((client) =>
        client.clientId === event.clientId
          ? { ...client, activity: event.activity }
          : client,
      );

      return {
        ...context,
        clients: updatedClients,
      };
    },
    setClientProgress: (
      context,
      event: { clientId: string; progress: number | undefined },
    ) => {
      const updatedClients = context.clients.map((client) =>
        client.clientId === event.clientId
          ? { ...client, progress: event.progress }
          : client,
      );

      return {
        ...context,
        clients: updatedClients,
      };
    },
    sendFile: (
      context,
      event: { peerId: string; file: File; fileId: UUID },
      enqueue,
    ) => {
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
                packetType: "fileMetadata",
                id: event.fileId,
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

        store.trigger.setAwaitingApprovals({
          peerId: event.peerId,
          fileId: event.fileId,
        });

        await waitForFileAcceptance(store, event.peerId, event.fileId)
          .then(async () => {
            store.trigger.setClientActivity({
              clientId: event.peerId,
              activity: "sending",
            });
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
                      encryptedChunk: Array.from(
                        new Uint8Array(encryptedChunk),
                      ),
                      initializationVector: Array.from(initializationVector),
                    }),
                  );
                  offset += maxChunkSize;
                  offset += maxChunkSize;
                  const progress = Math.floor((offset / event.file.size) * 100);
                  store.trigger.setClientProgress({
                    clientId: event.peerId,
                    progress,
                  });
                  if (progress >= 100) {
                    store.trigger.setClientProgress({
                      clientId: event.peerId,
                      progress: undefined,
                    });
                    store.trigger.setClientActivity({
                      clientId: event.peerId,
                      activity: undefined,
                    });
                  }
                }
              };

              await send();
            });
          })
          .catch(() => console.log("File transfer was denied"));
      });
    },
    sendChatMessage: (context, event: { message: string }, enqueue) => {
      for (const peerId in context.chatChannelConnections) {
        const dataChannel = context.chatChannelConnections[peerId];

        enqueue.effect(async () => {
          const client = context.clients.find(
            (client) => client.clientId === peerId,
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

          const secretKey = await deriveSecretKey(
            keyPair!.privateKey,
            publicKey,
          );

          if (dataChannel) {
            const initializationVector = window.crypto.getRandomValues(
              new Uint8Array(8),
            );

            const encryptedMessage = await encryptMessage(
              secretKey,
              initializationVector,
              new TextEncoder().encode(event.message).buffer,
            );
            if (!encryptedMessage) {
              throw new Error("Failed to encrypt!!!");
            }

            dataChannel.send(
              JSON.stringify({
                encryptedMessage: Array.from(new Uint8Array(encryptedMessage)),
                initializationVector: Array.from(initializationVector),
              }),
            );
          }
        });
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
      setUpFileChannel(dataChannel, event.peerId);
      
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

type StoreType = typeof store;

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
    chatMessageQueue.enqueue({ id: peerId, data: e.data });
  };
};

const setUpFileChannel = (dataChannel: RTCDataChannel, peerId: string) => {
  dataChannel.binaryType = "arraybuffer";
  dataChannel.bufferedAmountLowThreshold = 0;

  dataChannel.onopen = () => console.log("Connected to file channel peer.");

  dataChannel.onclose = () =>
    store.trigger.removeFileChannelConnection({
      peerId: peerId,
    });

  dataChannel.onmessage = (e) => {
    messageQueue.enqueue({ id: peerId, data: e.data });
  };
};

const waitForFileAcceptance = async (
  store: StoreType,
  peerId: string,
  fileId: UUID,
): Promise<void> => {
  store.trigger.setClientActivity({
    clientId: peerId,
    activity: "pending",
  });
  return new Promise((resolve, reject) => {
    const subscription = store.subscribe((state) => {
      if (!state.context.awaitingApprovals.some((a) => a.fileId === fileId)) {
        if (
          state.context.fileChannelConnections[peerId] &&
          state.context.fileChannelConnections[peerId].readyState === "open"
        ) {
          subscription.unsubscribe();
          resolve();
        } else {
          reject();
        }
      }
    });
  });
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
export const useChatMessages = () =>
  useSelector(store, (state) => state.context.chatMessages);
export const useSendersAwaitingApproval = () =>
  useSelector(store, (state) => state.context.sendersAwaitingApproval);
