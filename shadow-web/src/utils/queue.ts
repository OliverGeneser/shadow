export class FIFOQueue<T> {
  private queue: T[] = [];
  private isProcessing: boolean = false;
  private locked: boolean = false;

  constructor(private processItem: (item: T) => Promise<void>) {}

  enqueue(item: T): void {
    if (!this.locked) {
      this.queue.push(item);
      if (!this.isProcessing) {
        this.processQueue();
      }
    }
  }

  lock(): void {
    this.locked = true;
  }

  isLocked(): boolean {
    return this.locked;
  }

  clear(): void {
    this.queue = [];
    this.locked = false;
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
