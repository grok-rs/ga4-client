import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { GA4BatchHandler } from './batch.js';
import { GA4Client } from './client.js';

describe('GA4BatchHandler', () => {
	let client: GA4Client;
	let mockFetch: ReturnType<typeof mock.fn>;

	beforeEach(() => {
		mockFetch = mock.fn(async () => ({ ok: true, status: 204 }));
		client = new GA4Client({
			measurementId: 'G-TEST',
			apiSecret: 'test-secret',
			fetch: mockFetch as unknown as typeof fetch,
		});
	});

	afterEach(() => {
		mock.timers.reset();
	});

	describe('constructor', () => {
		it('should create with default options', () => {
			const batch = new GA4BatchHandler(client);
			assert.equal(batch.size, 0);
			assert.equal(batch.isRunning, false);
		});

		it('should throw for invalid batch size', () => {
			assert.throws(() => new GA4BatchHandler(client, { batchSize: 0 }));
			assert.throws(() => new GA4BatchHandler(client, { batchSize: 26 }));
		});
	});

	describe('add', () => {
		it('should add event to batch', async () => {
			const batch = new GA4BatchHandler(client);
			await batch.add({ client_id: 'test', events: [{ name: 'test' }] });
			assert.equal(batch.size, 1);
			assert.equal(mockFetch.mock.callCount(), 0);
		});

		it('should auto-flush when batch size reached', async () => {
			const batch = new GA4BatchHandler(client, { batchSize: 2 });
			await batch.add({ client_id: 'test-1', events: [{ name: 'event_1' }] });
			await batch.add({ client_id: 'test-2', events: [{ name: 'event_2' }] });
			assert.equal(mockFetch.mock.callCount(), 1);
			assert.equal(batch.size, 0);
		});
	});

	describe('addMany', () => {
		it('should add multiple events', async () => {
			const batch = new GA4BatchHandler(client, { batchSize: 10 });
			await batch.addMany([
				{ client_id: 'test-1', events: [{ name: 'event_1' }] },
				{ client_id: 'test-2', events: [{ name: 'event_2' }] },
				{ client_id: 'test-3', events: [{ name: 'event_3' }] },
			]);
			assert.equal(batch.size, 3);
		});
	});

	describe('flush', () => {
		it('should flush all events', async () => {
			const batch = new GA4BatchHandler(client);
			await batch.add({ client_id: 'test-1', events: [{ name: 'event_1' }] });
			await batch.add({ client_id: 'test-2', events: [{ name: 'event_2' }] });
			await batch.flush();
			assert.equal(mockFetch.mock.callCount(), 1);
			assert.equal(batch.size, 0);
		});

		it('should skip flush for empty batch', async () => {
			const batch = new GA4BatchHandler(client);
			await batch.flush();
			assert.equal(mockFetch.mock.callCount(), 0);
		});

		it('should call onFlush callback', async () => {
			const onFlush = mock.fn();
			const batch = new GA4BatchHandler(client, { onFlush });
			await batch.add({ client_id: 'test', events: [{ name: 'test' }] });
			await batch.flush();
			assert.equal(onFlush.mock.callCount(), 1);
		});

		it('should call onError on failure', async () => {
			mockFetch.mock.mockImplementationOnce(async () => ({ ok: false, status: 500, text: async () => 'Error' }));
			const onError = mock.fn();
			const batch = new GA4BatchHandler(client, { onError, maxRetries: 0 });
			await batch.add({ client_id: 'test', events: [{ name: 'test' }] });
			await assert.rejects(batch.flush());
			assert.equal(onError.mock.callCount(), 1);
		});

		it('should retain events on failure', async () => {
			mockFetch.mock.mockImplementationOnce(async () => ({ ok: false, status: 500, text: async () => 'Error' }));
			const batch = new GA4BatchHandler(client, { maxRetries: 0 });
			await batch.add({ client_id: 'test', events: [{ name: 'test' }] });
			try {
				await batch.flush();
			} catch {
				/* expected */
			}
			assert.equal(batch.size, 1);
		});
	});

	describe('start/stop', () => {
		it('should start and stop timer', async () => {
			mock.timers.enable({ apis: ['setInterval'] });
			const batch = new GA4BatchHandler(client, { flushIntervalMs: 1000 });

			batch.start();
			assert.ok(batch.isRunning);

			await batch.add({ client_id: 'test', events: [{ name: 'test' }] });
			mock.timers.tick(1000);
			await new Promise((r) => setImmediate(r));

			assert.equal(mockFetch.mock.callCount(), 1);

			await batch.stop();
			assert.ok(!batch.isRunning);
		});

		it('should flush remaining on stop', async () => {
			const batch = new GA4BatchHandler(client);
			await batch.add({ client_id: 'test', events: [{ name: 'test' }] });
			await batch.stop();
			assert.equal(mockFetch.mock.callCount(), 1);
			assert.equal(batch.size, 0);
		});
	});

	describe('clear', () => {
		it('should clear pending events', async () => {
			const batch = new GA4BatchHandler(client);
			await batch.add({ client_id: 'test', events: [{ name: 'test' }] });
			assert.equal(batch.size, 1);
			batch.clear();
			assert.equal(batch.size, 0);
		});
	});
});
