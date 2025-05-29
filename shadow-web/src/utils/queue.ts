import { Message, store } from "../store";
import { decryptMessage, deriveSecretKey } from "./encryption";

export class FIFOQueue {
  private queue: Message[] = [];
  private isProcessing: boolean = false;
  private locked: string[] = [];

  constructor(private processItem: (item: Message) => Promise<void>) {}

  enqueue(item: Message): void {
    if (!this.isLocked(item.id)) {
      this.queue.push(item);
      if (!this.isProcessing) {
        this.processQueue();
      }
    }
  }

  lock(id: string): void {
    this.locked.push(id);
  }

  unlock(id: string): void {
    this.locked = this.locked.filter((l) => l !== id);
  }

  isLocked(id: string): boolean {
    return this.locked.some((l) => l === id);
  }

  clear(id: string): void {
    this.queue = this.queue.filter((q) => q.id !== id);
    this.unlock(id);
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

export type CustomFile = {
  data:
    | {
        name: string;
        size: number;
        type: string;
        publicKey: JsonWebKey;
      }
    | undefined;
  status: {
    activity: "sending" | "receiving" | "pending";
    progress: number;
  };
};

export const receiveBuffers: { [id: string]: ArrayBuffer[] } = {};
export const receiveSizes: { [id: string]: number } = {};

const messageProcessing = async (message: Message): Promise<void> => {
  if (messageQueue.isLocked(message.id)) return;
  const keyPair = store.select((state) => state.keyPair).get();

  const clients = store.select((state) => state.clients).get();
  const client = clients.find((client) => client.clientId === message.id);

  const files = store.select((state) => state.files).get();
  const file = files[message.id];
  let receiveFile: CustomFile;
  if (file) {
    if (file.data === undefined && file.status) {
      receiveFile = {
        data: {
          publicKey: client!.publicKey,
          name: "",
          size: 0,
          type: "",
        },
        status: files[message.id].status,
      };
    } else {
      receiveFile = files[message.id];
    }
  } else {
    receiveFile = {
      data: {
        publicKey: client!.publicKey,
        name: "",
        size: 0,
        type: "",
      },
      status: {
        activity: "pending",
        progress: 0,
      },
    };
  }

  const receiveBuffer = receiveBuffers[message.id] ?? [];

  let receivedSize = receiveSizes[message.id] ?? 0;

  const messageArray = new Uint8Array(message.data);

  const packetType = messageArray[0];

  if (packetType === 0b00000001) {
    try {
      if (receiveFile.data) {
        const publicKey = await window.crypto.subtle.importKey(
          "jwk",
          receiveFile.data.publicKey,
          {
            name: "ECDH",
            namedCurve: "P-384",
          },
          true,
          [],
        );

        const secretKey = await deriveSecretKey(keyPair!.privateKey, publicKey);

        const iv = messageArray.slice(1, 9);

        const chunkData = messageArray.slice(1 + iv.length);

        const data = await decryptMessage(secretKey, iv, chunkData);

        const decodedData = new TextDecoder("utf-8").decode(data);
        const parsedMetadata = JSON.parse(decodedData);

        store.trigger.setFile({
          peerId: message.id,
          status: { activity: "receiving" },
          file: { ...parsedMetadata, publicKey: receiveFile.data.publicKey },
        });
        store.trigger.setSenderAwaitingApproval({
          peerId: message.id,
          fileId: parsedMetadata.id,
          fileName: parsedMetadata.name,
        });
        return;
      }
    } catch (e) {
      console.log(e);
      return;
    }
  } else if (packetType === 0b00000000) {
    const sendersAwaitingApproval = store
      .select((state) => state.sendersAwaitingApproval)
      .get();
    if (!sendersAwaitingApproval.some((s) => s.peerId === message.id)) {
      if (receiveFile !== undefined && receiveFile.data) {
        const publicKey = await window.crypto.subtle.importKey(
          "jwk",
          receiveFile.data.publicKey,
          {
            name: "ECDH",
            namedCurve: "P-384",
          },
          true,
          [],
        );

        const secretKey = await deriveSecretKey(keyPair!.privateKey, publicKey);

        const iv = messageArray.slice(1, 9);

        const chunkData = messageArray.slice(1 + iv.length);

        const data = await decryptMessage(secretKey, iv, chunkData);

        if (data) {
          receiveBuffer.push(data);
          receivedSize += data.byteLength;
          const newProgress = Math.floor(
            (receivedSize / receiveFile.data["size"]) * 100,
          );
          if (
            newProgress - (receiveFile.status?.progress ?? 0) > 1 ||
            (receiveFile.status?.progress ?? 0 === 0)
          ) {
            store.trigger.setFileStatus({
              peerId: message.id,
              status: { activity: "receiving", progress: newProgress },
            });
          }

          if (receivedSize == receiveFile.data["size"]) {
            const blob = new Blob(receiveBuffer, {
              type: receiveFile.data["type"],
            });
            const fileURL = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = fileURL;
            a.download = receiveFile.data.name || "download";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(fileURL);
            receiveBuffers[message.id] = [];
            receiveSizes[message.id] = 0;

            store.trigger.removeFile({
              peerId: message.id,
            });

            return;
          }
          receiveBuffers[message.id] = receiveBuffer;
          receiveSizes[message.id] = receivedSize;
        }
      }
    }
  } else if (packetType === 0b00000010) {
    if (receiveFile.data) {
      const publicKey = await window.crypto.subtle.importKey(
        "jwk",
        receiveFile.data.publicKey,
        {
          name: "ECDH",
          namedCurve: "P-384",
        },
        true,
        [],
      );

      const secretKey = await deriveSecretKey(keyPair!.privateKey, publicKey);

      const iv = messageArray.slice(1, 9);

      const chunkData = messageArray.slice(1 + iv.length);

      const data = await decryptMessage(secretKey, iv, chunkData);

      if (data) {
        const decodedData = new TextDecoder("utf-8").decode(data);
        const parsedMetadata = JSON.parse(decodedData);

        if (parsedMetadata.accepted === true) {
          store.trigger.removeAwaitingApproval({
            fileId: parsedMetadata.fileId,
          });
        } else {
          const fileChannels = store
            .select((state) => state.fileChannelConnections)
            .get();
          fileChannels[message.id].close();
          store.trigger.removeAwaitingApproval({
            fileId: parsedMetadata.fileId,
          });
        }
      }
    }
  } else {
    console.log("Unknown packetType:", packetType);
  }
};

const chatMessageProcessing = async (message: Message): Promise<void> => {
  const keyPair = store.select((state) => state.keyPair).get();
  const clients = store.select((state) => state.clients).get();
  const client = clients.find((client) => client.clientId === message.id);

  if (!client) throw new Error("Missing client");

  const messageArray = new Uint8Array(message.data);

  const packetType = messageArray[0];

  if (packetType === 0b00000000) {
    try {
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

      const iv = messageArray.slice(1, 9);

      const chunkData = messageArray.slice(1 + iv.length);

      const data = await decryptMessage(secretKey, iv, chunkData);

      const decodedData = new TextDecoder("utf-8").decode(data);

      store.trigger.setNewChatMessage({
        message: decodedData,
        peerId: message.id,
      });
      return;
    } catch (e) {
      console.log(e);
      return;
    }
  }
};

export const messageQueue = new FIFOQueue(messageProcessing);
export const chatMessageQueue = new FIFOQueue(chatMessageProcessing);
