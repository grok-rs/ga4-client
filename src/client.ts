/**
 * GA4 Measurement Protocol Client
 * @see https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

import { GA4Error, GA4ErrorCode } from './errors.js';
import { GA4, type GA4ClientOptions, type GA4DebugResponse, type GA4Event, type RetryOptions } from './types.js';

export class GA4Client {
	private readonly config: Required<Omit<GA4ClientOptions, 'fetch'>> & { fetch: typeof fetch };

	constructor(options: GA4ClientOptions) {
		if (!options.measurementId) throw new GA4Error(GA4ErrorCode.Validation, 'measurementId is required');
		if (!options.apiSecret) throw new GA4Error(GA4ErrorCode.Validation, 'apiSecret is required');

		this.config = {
			measurementId: options.measurementId,
			apiSecret: options.apiSecret,
			baseUrl: options.baseUrl ?? GA4.BASE_URL,
			timeoutMs: options.timeoutMs ?? GA4.TIMEOUT_MS,
			debug: options.debug ?? false,
			fetch: options.fetch ?? globalThis.fetch,
		};
	}

	/** Send a single event to GA4. */
	async send(event: GA4Event): Promise<void> {
		await this.sendBatch([event]);
	}

	/** Send multiple events in a single request (max 25). */
	async sendBatch(events: GA4Event[]): Promise<void> {
		if (!events.length) return;

		if (events.length > GA4.MAX_EVENTS) {
			throw new GA4Error(GA4ErrorCode.TooManyEvents, `Max ${GA4.MAX_EVENTS} events, got ${events.length}`);
		}

		for (const e of events) this.validate(e);
		await this.post(this.merge(events), this.config.debug);
	}

	/** Send events with automatic retry on transient errors (5xx, 429). */
	async sendWithRetry(events: GA4Event[], options: RetryOptions = {}): Promise<void> {
		const {
			maxRetries = GA4.MAX_RETRIES,
			initialDelayMs = GA4.INITIAL_RETRY_DELAY_MS,
			maxDelayMs = GA4.MAX_RETRY_DELAY_MS,
		} = options;

		let delay = initialDelayMs;
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await this.sendBatch(events);
			} catch (error) {
				if (!(error instanceof GA4Error) || !error.isRetryable() || attempt === maxRetries) throw error;
				await this.sleep(Math.min(delay, maxDelayMs));
				delay *= 2;
			}
		}
	}

	/** Validate events using GA4's debug endpoint without sending to production. */
	async debug(events: GA4Event[]): Promise<GA4DebugResponse> {
		if (!events.length) return { validationMessages: [] };

		if (events.length > GA4.MAX_EVENTS) {
			throw new GA4Error(GA4ErrorCode.TooManyEvents, `Max ${GA4.MAX_EVENTS} events, got ${events.length}`);
		}

		for (const e of events) this.validate(e);
		const response = await this.post(this.merge(events), true);
		const body = await response.text();

		try {
			return JSON.parse(body) as GA4DebugResponse;
		} catch {
			throw new GA4Error(GA4ErrorCode.Serialization, `Invalid debug response: ${body}`);
		}
	}

	private validate(event: GA4Event): void {
		if (!event.client_id) throw new GA4Error(GA4ErrorCode.Validation, 'client_id is required');
		if (!event.events?.length) throw new GA4Error(GA4ErrorCode.Validation, 'At least one event is required');

		for (const { name } of event.events) {
			if (!name) throw new GA4Error(GA4ErrorCode.Validation, 'Event name is required');
			if (name.length > GA4.MAX_EVENT_NAME) {
				throw new GA4Error(GA4ErrorCode.Validation, `Event name exceeds ${GA4.MAX_EVENT_NAME} chars: ${name}`);
			}
		}
	}

	private merge(events: GA4Event[]): GA4Event {
		const [first, ...rest] = events;
		if (!first) throw new GA4Error(GA4ErrorCode.Validation, 'No events to merge');
		if (!rest.length) return first;

		return {
			client_id: first.client_id,
			user_id: first.user_id,
			timestamp_micros: first.timestamp_micros,
			user_properties: first.user_properties,
			events: events.flatMap((e) => e.events),
		};
	}

	private async post(payload: GA4Event, debug: boolean): Promise<Response> {
		const endpoint = debug ? '/debug/mp/collect' : '/mp/collect';
		const url = `${this.config.baseUrl}${endpoint}?measurement_id=${this.config.measurementId}&api_secret=${this.config.apiSecret}`;

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

		try {
			const response = await this.config.fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
				signal: controller.signal,
			});

			if (!response.ok) await this.handleError(response);
			return response;
		} catch (error) {
			if (error instanceof GA4Error) throw error;
			const msg = error instanceof Error ? error.message : String(error);
			const isTimeout = error instanceof Error && error.name === 'AbortError';
			throw new GA4Error(
				GA4ErrorCode.Request,
				isTimeout ? `Timeout after ${this.config.timeoutMs}ms` : `Request failed: ${msg}`,
			);
		} finally {
			clearTimeout(timeout);
		}
	}

	private async handleError(response: Response): Promise<never> {
		const body = await response.text().catch(() => '');
		const { status } = response;

		if (status === 429) throw new GA4Error(GA4ErrorCode.RateLimited, 'Rate limited', status, body);
		if (status >= 500) throw new GA4Error(GA4ErrorCode.Server, `Server error ${status}`, status, body);
		if (status >= 400) throw new GA4Error(GA4ErrorCode.Client, `Client error ${status}`, status, body);
		throw new GA4Error(GA4ErrorCode.Unknown, `Unexpected status ${status}`, status, body);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((r) => setTimeout(r, ms));
	}
}
