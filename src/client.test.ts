import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { GA4Client } from './client.js';
import { GA4Error, GA4ErrorCode } from './errors.js';

describe('GA4Client', () => {
	const defaultOptions = { measurementId: 'G-TEST123', apiSecret: 'test-secret' };

	describe('constructor', () => {
		it('should create client with valid options', () => {
			const client = new GA4Client(defaultOptions);
			assert.ok(client instanceof GA4Client);
		});

		it('should throw if measurementId is missing', () => {
			assert.throws(() => new GA4Client({ measurementId: '', apiSecret: 'secret' }), GA4Error);
		});

		it('should throw if apiSecret is missing', () => {
			assert.throws(() => new GA4Client({ measurementId: 'G-TEST', apiSecret: '' }), GA4Error);
		});
	});

	describe('send', () => {
		it('should send event successfully', async () => {
			const mockFetch = mock.fn(async () => ({ ok: true, status: 204 }));

			const client = new GA4Client({ ...defaultOptions, fetch: mockFetch as unknown as typeof fetch });

			await client.send({ client_id: 'test-client', events: [{ name: 'test_event' }] });

			assert.equal(mockFetch.mock.callCount(), 1);
			const call = mockFetch.mock.calls[0];
			assert.ok(call?.arguments[0]?.includes('/mp/collect'));
			assert.equal(call?.arguments[1]?.method, 'POST');
		});

		it('should throw for missing client_id', async () => {
			const client = new GA4Client(defaultOptions);
			await assert.rejects(client.send({ client_id: '', events: [{ name: 'test' }] }), GA4Error);
		});

		it('should throw for missing events', async () => {
			const client = new GA4Client(defaultOptions);
			await assert.rejects(client.send({ client_id: 'test', events: [] }), GA4Error);
		});

		it('should throw for long event name', async () => {
			const client = new GA4Client(defaultOptions);
			await assert.rejects(client.send({ client_id: 'test', events: [{ name: 'a'.repeat(41) }] }), GA4Error);
		});
	});

	describe('sendBatch', () => {
		it('should send batch successfully', async () => {
			const mockFetch = mock.fn(async () => ({ ok: true, status: 204 }));
			const client = new GA4Client({ ...defaultOptions, fetch: mockFetch as unknown as typeof fetch });

			await client.sendBatch([
				{ client_id: 'client-1', events: [{ name: 'event_1' }] },
				{ client_id: 'client-2', events: [{ name: 'event_2' }] },
			]);

			assert.equal(mockFetch.mock.callCount(), 1);
			const body = JSON.parse(mockFetch.mock.calls[0]?.arguments[1]?.body as string);
			assert.equal(body.events.length, 2);
		});

		it('should throw for more than 25 events', async () => {
			const client = new GA4Client(defaultOptions);
			const events = Array.from({ length: 26 }, (_, i) => ({ client_id: `c-${i}`, events: [{ name: `e_${i}` }] }));
			await assert.rejects(client.sendBatch(events), GA4Error);
		});

		it('should skip empty batch', async () => {
			const mockFetch = mock.fn();
			const client = new GA4Client({ ...defaultOptions, fetch: mockFetch as unknown as typeof fetch });
			await client.sendBatch([]);
			assert.equal(mockFetch.mock.callCount(), 0);
		});
	});

	describe('error handling', () => {
		it('should throw RateLimited on 429', async () => {
			const mockFetch = mock.fn(async () => ({ ok: false, status: 429, text: async () => 'Rate limited' }));
			const client = new GA4Client({ ...defaultOptions, fetch: mockFetch as unknown as typeof fetch });

			try {
				await client.send({ client_id: 'test', events: [{ name: 'test' }] });
				assert.fail('Should have thrown');
			} catch (error) {
				assert.ok(error instanceof GA4Error);
				assert.equal(error.code, GA4ErrorCode.RateLimited);
				assert.ok(error.isRetryable());
			}
		});

		it('should throw Server on 5xx', async () => {
			const mockFetch = mock.fn(async () => ({ ok: false, status: 500, text: async () => 'Error' }));
			const client = new GA4Client({ ...defaultOptions, fetch: mockFetch as unknown as typeof fetch });

			try {
				await client.send({ client_id: 'test', events: [{ name: 'test' }] });
				assert.fail('Should have thrown');
			} catch (error) {
				assert.ok(error instanceof GA4Error);
				assert.equal(error.code, GA4ErrorCode.Server);
				assert.ok(error.isRetryable());
			}
		});

		it('should throw Client on 4xx', async () => {
			const mockFetch = mock.fn(async () => ({ ok: false, status: 400, text: async () => 'Bad request' }));
			const client = new GA4Client({ ...defaultOptions, fetch: mockFetch as unknown as typeof fetch });

			try {
				await client.send({ client_id: 'test', events: [{ name: 'test' }] });
				assert.fail('Should have thrown');
			} catch (error) {
				assert.ok(error instanceof GA4Error);
				assert.equal(error.code, GA4ErrorCode.Client);
				assert.ok(!error.isRetryable());
			}
		});
	});

	describe('sendWithRetry', () => {
		it('should retry on server error', async () => {
			let attempts = 0;
			const mockFetch = mock.fn(async () => {
				attempts++;
				if (attempts < 3) return { ok: false, status: 500, text: async () => 'Error' };
				return { ok: true, status: 204 };
			});

			const client = new GA4Client({ ...defaultOptions, fetch: mockFetch as unknown as typeof fetch });
			await client.sendWithRetry([{ client_id: 'test', events: [{ name: 'test' }] }], {
				maxRetries: 3,
				initialDelayMs: 1,
			});

			assert.equal(mockFetch.mock.callCount(), 3);
		});

		it('should not retry on client error', async () => {
			const mockFetch = mock.fn(async () => ({ ok: false, status: 400, text: async () => 'Bad request' }));
			const client = new GA4Client({ ...defaultOptions, fetch: mockFetch as unknown as typeof fetch });

			await assert.rejects(
				client.sendWithRetry([{ client_id: 'test', events: [{ name: 'test' }] }], { maxRetries: 3 }),
				GA4Error,
			);
			assert.equal(mockFetch.mock.callCount(), 1);
		});
	});

	describe('debug', () => {
		it('should call debug endpoint', async () => {
			const mockFetch = mock.fn(async () => ({ ok: true, status: 200, text: async () => '{"validationMessages":[]}' }));
			const client = new GA4Client({ ...defaultOptions, fetch: mockFetch as unknown as typeof fetch });

			const result = await client.debug([{ client_id: 'test', events: [{ name: 'test' }] }]);

			assert.ok(mockFetch.mock.calls[0]?.arguments[0]?.includes('/debug/mp/collect'));
			assert.deepEqual(result.validationMessages, []);
		});
	});
});
