import { Message } from "../store";

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
