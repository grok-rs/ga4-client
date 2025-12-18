/** GA4 Error Types */

export const GA4ErrorCode = {
	Request: 'REQUEST_ERROR',
	Serialization: 'SERIALIZATION_ERROR',
	Validation: 'VALIDATION_ERROR',
	RateLimited: 'RATE_LIMITED',
	TooManyEvents: 'TOO_MANY_EVENTS',
	Client: 'CLIENT_ERROR',
	Server: 'SERVER_ERROR',
	Unknown: 'UNKNOWN_ERROR',
} as const;

export type GA4ErrorCode = (typeof GA4ErrorCode)[keyof typeof GA4ErrorCode];

const RETRYABLE_CODES = new Set<GA4ErrorCode>([GA4ErrorCode.RateLimited, GA4ErrorCode.Server]);

export class GA4Error extends Error {
	constructor(
		readonly code: GA4ErrorCode,
		message: string,
		readonly statusCode?: number,
		readonly responseBody?: string,
	) {
		super(message);
		this.name = 'GA4Error';
		Object.setPrototypeOf(this, GA4Error.prototype);
	}

	isRetryable(): boolean {
		return RETRYABLE_CODES.has(this.code);
	}

	toJSON() {
		return {
			name: this.name,
			code: this.code,
			message: this.message,
			statusCode: this.statusCode,
			responseBody: this.responseBody,
		};
	}
}
