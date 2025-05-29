import { createStore } from "@xstate/store";
import { useSelector } from "@xstate/store/react";
import { sendMessageWithRetry } from "./socket";
import {
  SignalCandidateData,
  Clients,
  RoomData,
  SignalOfferData,
} from "shadow-shared";
import { UUID } from "crypto";
import { deriveSecretKey, encryptMessage } from "./utils/encryption";
import {
  chatMessageQueue,
  CustomFile,
  messageQueue,
  receiveBuffers,
  receiveSizes,
} from "./utils/queue";

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

export const webRTCConfig: RTCConfiguration = {
  iceServers: [
    {
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_PASSWORD,
    },
  ],
};

export interface Message {
  id: string;
  data: ArrayBuffer;
}

type SendersApproval = {
  peerId: string;
  fileId: UUID;
  fileName: string;
};

type Approval = { peerId: string; fileId: UUID };

export const store = createStore({
  context: {
    webSocketConnectionStatus: "init" as
      | "init"
      | "connecting"
      | "connected"
      | "disconnected",
    clientId: undefined as string | undefined,
    roomId: "",
    keyPair: undefined as CryptoKeyPair | undefined,
    chatMessages: [] as ChatMessages,
    clients: [] as Clients,
    files: {} as Record<string, CustomFile>,
    webRTCConnections: {} as WebRTCConnections,
    fileChannelConnections: {} as DataChannelConnections,
    chatChannelConnections: {} as DataChannelConnections,
    sendersAwaitingApproval: [] as SendersApproval[],
    awaitingApprovals: [] as Approval[],
    justJoined: true as boolean,
  },
  on: {
    setKeyPair: (context, event: { keyPair: CryptoKeyPair }) => ({
      ...context,
      keyPair: event.keyPair,
    }),
    setWebSocketConnectionStatus: (
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
      webRTCConnections: {
        ...context.webRTCConnections,
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
    setFile: (
      context,
      event: {
        peerId: string;
        file:
          | { name: string; size: number; type: string; publicKey: JsonWebKey }
          | undefined;
        status: { activity: "pending" | "sending" | "receiving" };
      },
    ) => ({
      ...context,
      files: {
        ...context.files,
        [event.peerId]: {
          data: event.file,
          status: { activity: event.status.activity, progress: 0 },
        },
      },
    }),
    setFileStatus: (
      context,
      event: {
        peerId: string;
        status: {
          activity: "pending" | "sending" | "receiving";
          progress: number;
        };
      },
    ) => ({
      ...context,
      files: {
        ...context.files,
        [event.peerId]: {
          ...context.files[event.peerId],
          status: event.status,
        },
      },
    }),
    removeFile: (
      context,
      event: {
        peerId: string;
      },
    ) => {
      const { [event.peerId]: _, ...updatedConnections } = context.files;

      return {
        ...context,
        files: {
          ...updatedConnections,
        },
      };
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
    cancelFileTransfer: (context, event: { peerId: string }) => {
      const fileChannels = store
        .select((state) => state.fileChannelConnections)
        .get();

      if (fileChannels[event.peerId]) {
        fileChannels[event.peerId].close();
        messageQueue.clear(event.peerId);
      }

      return resetFileTransfer(context, event.peerId);
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
        return resetFileTransfer(context, connection.peerId);
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
              fileId: event.fileId,
              accepted: event.accepted,
            }),
          ),
        );
        if (!encryptedChunk) {
          throw new Error("Failed to encrypt!!!");
        }

        const packetType = new Uint8Array([2]);
        const encrypted = new Uint8Array(encryptedChunk);
        const data = new Uint8Array(
          packetType.length + initializationVector.length + encrypted.length,
        );

        data.set(packetType, 0);
        data.set(initializationVector, packetType.length);
        data.set(encrypted, packetType.length + initializationVector.length);

        if (dataChannel.readyState === "open") {
          dataChannel.send(data);
        }
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
        const localPeer = new RTCPeerConnection(webRTCConfig);

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
              setupDataChannel(dataChannel, client.clientId);
              store.trigger.setChatChannelConnection({
                peerId: client.clientId,
                dataChannel: dataChannel,
              });
              break;
            case "fileChannel":
              setupFileChannel(dataChannel, client.clientId);
              store.trigger.setFileChannelConnection({
                peerId: client.clientId,
                dataChannel: dataChannel,
              });
          }
        };

        if (context.justJoined) {
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
          setupDataChannel(dataChannel, client.clientId);
          dataChannelConnecions[client.clientId] = dataChannel;
        }

        connections[client.clientId] = localPeer;
      });

      return {
        ...context,
        clients: event.clients,
        webRTCConnections: { ...context.webRTCConnections, ...connections },
        chatChannelConnections: {
          ...context.chatChannelConnections,
          ...dataChannelConnecions,
        },
        justJoined: false,
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
        const maxChunkSize = 16000;

        const client = context.clients.find(
          (client) => client.clientId === event.peerId,
        );
        if (!client) return context;
        if (dataChannel) {
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
          const initializationVector = window.crypto.getRandomValues(
            new Uint8Array(8),
          );

          const fileData = new TextEncoder().encode(
            JSON.stringify({
              id: event.fileId,
              name: event.file.name,
              size: event.file.size,
              type: event.file.type,
            }),
          );

          const encryptedChunk = await encryptMessage(
            secretKey,
            initializationVector,
            fileData,
          );
          if (!encryptedChunk) {
            throw new Error("Failed to encrypt!!!");
          }

          const packetType = new Uint8Array([1]);
          const encrypted = new Uint8Array(encryptedChunk);
          const data = new Uint8Array(
            packetType.length + initializationVector.length + encrypted.length,
          );

          data.set(packetType, 0);
          data.set(initializationVector, packetType.length);
          data.set(encrypted, packetType.length + initializationVector.length);

          console.log(
            data.slice(packetType.length + initializationVector.length),
          );

          if (dataChannel.readyState === "open") {
            dataChannel.send(data);
          }

          store.trigger.setAwaitingApprovals({
            peerId: event.peerId,
            fileId: event.fileId,
          });

          let bytesSent = 0;

          await waitForFileAcceptance(store, event.peerId, event.fileId)
            .then(async () => {
              await event.file.arrayBuffer().then(async (buffer) => {
                const view = new Uint8Array(buffer);
                let offset = 0;
                const files = store.select((state) => state.files).get();
                const currentFile = files[event.fileId];

                const send = async () => {
                  while (offset < view.byteLength) {
                    if (
                      dataChannel.readyState === "closed" ||
                      dataChannel.readyState === "closing"
                    )
                      return;
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

                    const end = Math.min(
                      offset + maxChunkSize,
                      view.byteLength,
                    );
                    const chunk = view.subarray(offset, offset + maxChunkSize);
                    offset = end;

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

                    const packetType = new Uint8Array([0]);

                    const encrypted = new Uint8Array(encryptedChunk);
                    const data = new Uint8Array(
                      packetType.length +
                        initializationVector.length +
                        encrypted.length,
                    );

                    data.set(packetType, 0);
                    data.set(initializationVector, packetType.length);
                    data.set(
                      encrypted,
                      packetType.length + initializationVector.length,
                    );

                    if (dataChannel.readyState === "open") {
                      dataChannel.send(data);
                    }
                    console.log("Send data chunk: ", encryptedChunk);

                    console.log(chunk.byteLength);

                    bytesSent += chunk.byteLength;

                    console.log(bytesSent);

                    const newProgress = Math.floor(
                      (bytesSent / event.file.size) * 100,
                    );

                    if (
                      newProgress - (currentFile?.status?.progress ?? 0) >
                      1
                    ) {
                      store.trigger.setFileStatus({
                        peerId: event.peerId,
                        status: { activity: "sending", progress: newProgress },
                      });
                    }
                    if (newProgress >= 100) {
                      store.trigger.removeFile({
                        peerId: event.peerId,
                      });
                    }
                  }
                };

                await send();
              });
            })
            .catch((e) => {
              console.log("File transfer was denied");
              console.log(e);
            });
        }
      });
      return {
        ...context,
      };
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

            const encryptedChunk = await encryptMessage(
              secretKey,
              initializationVector,
              new TextEncoder().encode(event.message),
            );
            if (!encryptedChunk) {
              throw new Error("Failed to encrypt!!!");
            }

            const packetType = new Uint8Array([0]);

            const encrypted = new Uint8Array(encryptedChunk);
            const data = new Uint8Array(
              packetType.length +
                initializationVector.length +
                encrypted.length,
            );

            data.set(packetType, 0);
            data.set(initializationVector, packetType.length);
            data.set(
              encrypted,
              packetType.length + initializationVector.length,
            );

            if (dataChannel.readyState === "open") {
              dataChannel.send(data);
            }
          }
        });
      }
    },
    setupConnection: (context, event: { peerId: string }) => {
      console.log("Setting up file channel connection...");
      let localPeer;
      if (context.webRTCConnections[event.peerId]) {
        localPeer = context.webRTCConnections[event.peerId];
      } else {
        return context;
      }
      const dataChannel = localPeer.createDataChannel("fileChannel");
      setupFileChannel(dataChannel, event.peerId);

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

const setupDataChannel = (dataChannel: RTCDataChannel, peerId: string) => {
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

const setupFileChannel = (dataChannel: RTCDataChannel, peerId: string) => {
  dataChannel.binaryType = "arraybuffer";
  dataChannel.bufferedAmountLowThreshold = 0;

  dataChannel.onopen = () => console.log("Connected to file channel peer.");

  dataChannel.onclose = async () => {
    messageQueue.lock(peerId);
    await new Promise((res) => setTimeout(res, 500));
    receiveBuffers[peerId] = [];
    receiveSizes[peerId] = 0;
    store.trigger.cancelFileTransfer({
      peerId,
    });
  };

  dataChannel.onmessage = (e) => {
    messageQueue.enqueue({ id: peerId, data: e.data });
  };
};

const resetFileTransfer = (context: any, peerId: string) => {
  console.log(context.files[peerId]);
  const { [peerId]: _, ...updatedFiles } = context.files;
  const { [peerId]: __, ...updatedFileConnections } =
    context.fileChannelConnections;

  return {
    ...context,
    fileChannelConnections: {
      ...updatedFileConnections,
    },
    files: {
      ...updatedFiles,
    },
    awaitingApprovals: [
      ...context.awaitingApprovals.filter(
        (s: { peerId: string }) => s.peerId !== peerId,
      ),
    ],
    sendersAwaitingApproval: [
      ...context.sendersAwaitingApproval.filter(
        (s: { peerId: string }) => s.peerId !== peerId,
      ),
    ],
  };
};

const waitForFileAcceptance = async (
  store: StoreType,
  peerId: string,
  fileId: UUID,
): Promise<void> => {
  store.trigger.setFileStatus({
    peerId: peerId,
    status: {
      activity: "pending",
      progress: 0,
    },
  });
  return new Promise((resolve, reject) => {
    const subscription = store.subscribe((state) => {
      if (!state.context.awaitingApprovals.some((a) => a.fileId === fileId)) {
        if (
          state.context.fileChannelConnections[peerId] &&
          state.context.fileChannelConnections[peerId].readyState === "open"
        ) {
          subscription.unsubscribe();
          store.trigger.setFileStatus({
            peerId: peerId,
            status: { activity: "sending", progress: 0 },
          });
          resolve();
        } else {
          store.trigger.removeFile({
            peerId: peerId,
          });
          reject();
        }
      }
    });
  });
};

export const useClientId = () =>
  useSelector(store, (state) => state.context.clientId);
export const useRoomId = () =>
  useSelector(store, (state) => state.context.roomId);
export const useClients = () =>
  useSelector(store, (state) => state.context.clients);
export const useChatMessages = () =>
  useSelector(store, (state) => state.context.chatMessages);
export const useFiles = () =>
  useSelector(store, (state) => state.context.files);
export const useSendersAwaitingApproval = () =>
  useSelector(store, (state) => state.context.sendersAwaitingApproval);
