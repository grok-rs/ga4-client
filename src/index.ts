/**
 * GA4 Measurement Protocol Client
 * @see https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

export { GA4Client } from './client.js';
export { GA4BatchHandler } from './batch.js';
export { GA4Error, GA4ErrorCode } from './errors.js';
export { GA4 } from './types.js';
export { generateClientId, generateSessionId, toMicros } from './utils.js';

export type {
	GA4Event,
	GA4EventItem,
	GA4EventParams,
	GA4UserProperties,
	GA4ClientOptions,
	GA4BatchOptions,
	GA4DebugResponse,
	GA4ValidationMessage,
	RetryOptions,
} from './types.js';
