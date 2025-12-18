/**
 * GA4 Batch Handler - accumulates events and sends them in optimized batches.
 */

import type { GA4Client } from './client.js';
import { GA4, type GA4BatchOptions, type GA4Event } from './types.js';

export class GA4BatchHandler {
  private readonly client: GA4Client;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxRetries: number;
  private readonly onError?: (error: Error, events: GA4Event[]) => void;
  private readonly onFlush?: (events: GA4Event[]) => void;

  private queue: GA4Event[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  constructor(client: GA4Client, options: GA4BatchOptions = {}) {
    const batchSize = options.batchSize ?? GA4.BATCH_SIZE;
    if (batchSize < 1 || batchSize > GA4.MAX_EVENTS) {
      throw new Error(`batchSize must be 1-${GA4.MAX_EVENTS}`);
    }

    this.client = client;
    this.batchSize = batchSize;
    this.flushIntervalMs = options.flushIntervalMs ?? GA4.FLUSH_INTERVAL_MS;
    this.maxRetries = options.maxRetries ?? GA4.MAX_RETRIES;
    this.onError = options.onError;
    this.onFlush = options.onFlush;
  }

  /** Start automatic periodic flushing. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.flush().catch((e) => this.onError?.(e as Error, [...this.queue])), this.flushIntervalMs);
  }

  /** Stop periodic flushing and flush remaining events. */
  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }

  /** Add an event to the batch. Auto-flushes when batch size is reached. */
  async add(event: GA4Event): Promise<void> {
    this.queue.push(event);
    if (this.queue.length >= this.batchSize) await this.flush();
  }

  /** Add multiple events to the batch. */
  async addMany(events: GA4Event[]): Promise<void> {
    for (const event of events) await this.add(event);
  }

  /** Flush all queued events. Events are retained on failure for retry. */
  async flush(): Promise<void> {
    if (!this.queue.length || this.flushing) return;

    this.flushing = true;
    const batch = [...this.queue];

    try {
      await this.client.sendWithRetry(batch, { maxRetries: this.maxRetries });
      this.queue = [];
      this.onFlush?.(batch);
    } catch (error) {
      this.onError?.(error as Error, batch);
      throw error;
    } finally {
      this.flushing = false;
    }
  }

  /** Current number of queued events. */
  get size(): number {
    return this.queue.length;
  }

  /** Whether periodic flushing is active. */
  get isRunning(): boolean {
    return this.timer !== null;
  }

  /** Clear all queued events without sending. */
  clear(): void {
    this.queue = [];
  }
}
