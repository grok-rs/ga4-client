# ga4-client

Type-safe Google Analytics 4 Measurement Protocol client for Node.js.

## Features

- Full TypeScript support with comprehensive types
- Event batching with automatic flush
- Retry with exponential backoff (5xx, 429)
- Debug endpoint validation
- Zero dependencies (native fetch)

## Installation

```bash
npm install ga4-client
```

## Quick Start

```typescript
import { GA4Client, generateClientId } from 'ga4-client';

const client = new GA4Client({
  measurementId: 'G-XXXXXXXXXX',
  apiSecret: 'your-api-secret',
});

await client.send({
  client_id: generateClientId(),
  events: [{ name: 'purchase', params: { value: 99.99, currency: 'USD' } }],
});
```

## API

### GA4Client

```typescript
const client = new GA4Client({
  measurementId: string;  // G-XXXXXXXXXX
  apiSecret: string;      // From GA4 Admin > Data Streams > Measurement Protocol
  baseUrl?: string;       // Default: 'https://www.google-analytics.com'
  timeoutMs?: number;     // Default: 30000
  debug?: boolean;        // Use debug endpoint
});

// Send single event
await client.send(event);

// Send batch (max 25 events)
await client.sendBatch(events);

// Send with retry (5xx, 429)
await client.sendWithRetry(events, { maxRetries: 3 });

// Validate without sending to production
const result = await client.debug(events);
```

### GA4BatchHandler

```typescript
import { GA4Client, GA4BatchHandler } from 'ga4-client';

const batch = new GA4BatchHandler(client, {
  batchSize: 20,         // Auto-flush threshold (1-25)
  flushIntervalMs: 5000, // Periodic flush interval
  maxRetries: 3,
  onFlush: (events) => console.log(`Sent ${events.length} events`),
  onError: (error, events) => console.error('Failed:', error),
});

batch.start();  // Start periodic flushing
await batch.add(event);
await batch.stop(); // Flush remaining and stop
```

### Utilities

```typescript
import { generateClientId, generateSessionId, toMicros } from 'ga4-client';

// Generate UUID v4 client identifier
const clientId = generateClientId();

// Generate session ID (Unix timestamp in seconds)
const sessionId = generateSessionId();

// Convert Date to microseconds for timestamp_micros
const timestamp = toMicros(new Date());
```

### Error Handling

```typescript
import { GA4Error, GA4ErrorCode } from 'ga4-client';

try {
  await client.send(event);
} catch (error) {
  if (error instanceof GA4Error) {
    console.log(error.code);       // GA4ErrorCode.RateLimited
    console.log(error.statusCode); // 429
    console.log(error.isRetryable()); // true
  }
}
```

### Constants

```typescript
import { GA4 } from 'ga4-client';

GA4.MAX_EVENTS;      // 25 - max events per request
GA4.MAX_EVENT_NAME;  // 40 - max event name length
GA4.MAX_PARAMS;      // 25 - max parameters per event
GA4.MAX_PARAM_VALUE; // 100 - max parameter value length
```

## Event Structure

```typescript
interface GA4Event {
  client_id: string;           // Required: UUID identifying the client
  user_id?: string;            // Cross-device user identifier
  timestamp_micros?: number;   // Event time (backdate up to 72h)
  user_properties?: Record<string, { value: string | number | boolean }>;
  events: Array<{
    name: string;              // Max 40 chars, alphanumeric + underscore
    params?: Record<string, string | number | boolean>;
  }>;
}
```

## Credentials

1. **Measurement ID**: GA4 Admin > Data Streams > select stream
2. **API Secret**: GA4 Admin > Data Streams > select stream > Measurement Protocol > Create

## Requirements

- Node.js 22+

## License

MIT
