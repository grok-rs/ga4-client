/**
 * GA4 Utility Functions
 */

import { randomUUID } from 'node:crypto';

/**
 * Generate a unique client_id for GA4 tracking.
 * Uses UUID v4 format as recommended by GA4.
 * @example
 * const clientId = generateClientId(); // "550e8400-e29b-41d4-a716-446655440000"
 */
export function generateClientId(): string {
	return randomUUID();
}

/**
 * Generate a session_id for GA4 tracking.
 * Uses Unix timestamp in seconds as the session identifier.
 * Include this in event params for Realtime reports.
 * @example
 * const sessionId = generateSessionId(); // "1702934567"
 */
export function generateSessionId(): string {
	return Math.floor(Date.now() / 1000).toString();
}

/**
 * Convert Date to GA4 timestamp_micros format.
 * @param date - Date object or timestamp in milliseconds
 * @example
 * const timestamp = toMicros(new Date()); // 1702934567000000
 * const timestamp = toMicros(Date.now()); // 1702934567000000
 */
export function toMicros(date: Date | number): number {
	const ms = typeof date === 'number' ? date : date.getTime();
	return ms * 1000;
}
