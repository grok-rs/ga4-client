/**
 * GA4 Measurement Protocol Types
 * @see https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference
 */

/**
 * Event parameters - custom key-value pairs attached to events.
 * - Parameter names: max 40 characters, alphanumeric and underscores, must start with letter
 * - Parameter values: max 100 characters (500 for GA360)
 * - Reserved prefixes: _, firebase_, ga_, google_, gtag.
 */
export type GA4EventParams = Record<string, string | number | boolean | string[] | undefined>;

/**
 * User properties - persistent attributes about the user.
 * - Max 25 user properties per request
 * - Property names: max 24 characters
 * - Property values: max 36 characters
 * - Reserved prefixes: _, firebase_, ga_, google_
 */
export type GA4UserProperties = Record<string, { value: string | number | boolean }>;

/**
 * Individual event within a GA4 payload.
 */
export interface GA4EventItem {
  /**
   * Event name identifier.
   * - Max 40 characters, alphanumeric and underscores only
   * - Must start with an alphabetic character
   * - Reserved names: ad_activeview, ad_click, ad_exposure, ad_query, adunit_exposure,
   *   app_clear_data, app_install, app_remove, app_update, error, first_open,
   *   first_visit, in_app_purchase, notification_dismiss, notification_foreground,
   *   notification_open, notification_receive, os_update, session_start,
   *   screen_view, user_engagement, firebase_campaign
   */
  name: string;

  /**
   * Event-specific parameters.
   * - Max 25 parameters per event
   * - Include `session_id` and `engagement_time_msec` for Realtime reports
   */
  params?: GA4EventParams;
}

/**
 * GA4 Measurement Protocol event payload sent to /mp/collect endpoint.
 */
export interface GA4Event {
  /**
   * Required. Unique identifier for a user instance of a web client.
   * Identifies individual browser instances or web sessions.
   * Typically a UUID v4 format (e.g., "550e8400-e29b-41d4-a716-446655440000").
   */
  client_id: string;

  /**
   * Optional. Unique identifier for the user across devices/platforms.
   * Used for cross-platform analysis when the same user is logged in.
   * UTF-8 characters only, max 256 characters.
   */
  user_id?: string;

  /**
   * Optional. Event timestamp in microseconds since Unix epoch.
   * Can be backdated up to 72 hours from the current time.
   * If not provided, GA4 uses the time the event is received.
   */
  timestamp_micros?: number;

  /**
   * Optional. Persistent user-scoped custom attributes.
   * These attributes are attached to all subsequent events for this user.
   */
  user_properties?: GA4UserProperties;

  /**
   * Required. Array of events to send.
   * Maximum 25 events per request.
   */
  events: GA4EventItem[];
}

/** Debug endpoint validation message. */
export interface GA4ValidationMessage {
  fieldPath: string;
  description: string;
  validationCode: string;
}

/** Response from GA4 debug endpoint (/debug/mp/collect). */
export interface GA4DebugResponse {
  validationMessages: GA4ValidationMessage[];
}

/** GA4Client configuration options. */
export interface GA4ClientOptions {
  /**
   * GA4 Measurement ID (format: G-XXXXXXXXXX).
   * Found in GA4 Admin > Data Streams > select stream > Measurement ID.
   */
  measurementId: string;

  /**
   * GA4 API secret for authentication.
   * Generated in GA4 Admin > Data Streams > select stream > Measurement Protocol > Create.
   * Keep private and rotate regularly.
   */
  apiSecret: string;

  /** Base URL for GA4 API. @default "https://www.google-analytics.com" */
  baseUrl?: string;

  /** Request timeout in milliseconds. @default 30000 */
  timeoutMs?: number;

  /** Use debug endpoint for validation without sending to production. @default false */
  debug?: boolean;

  /** Custom fetch implementation for testing or custom HTTP handling. */
  fetch?: typeof fetch;
}

/** GA4BatchHandler configuration options. */
export interface GA4BatchOptions {
  /** Max events per batch before auto-flush (1-25). @default 20 */
  batchSize?: number;

  /** Interval in ms between automatic flushes. @default 5000 */
  flushIntervalMs?: number;

  /** Retry attempts for failed requests. @default 3 */
  maxRetries?: number;

  /** Callback when flush fails. Events are retained for retry. */
  onError?: (error: Error, events: GA4Event[]) => void;

  /** Callback after successful flush. */
  onFlush?: (events: GA4Event[]) => void;
}

/** Retry configuration for sendWithRetry. */
export interface RetryOptions {
  /** Max retry attempts. @default 3 */
  maxRetries?: number;

  /** Initial delay before first retry in ms. @default 100 */
  initialDelayMs?: number;

  /** Maximum delay between retries in ms. @default 30000 */
  maxDelayMs?: number;
}

/** GA4 Measurement Protocol limits and defaults. */
export const GA4 = {
  /** Base URL for GA4 Measurement Protocol API. */
  BASE_URL: 'https://www.google-analytics.com',

  /** Default request timeout in ms. */
  TIMEOUT_MS: 30_000,

  /** Maximum events per single request. */
  MAX_EVENTS: 25,

  /** Maximum event name length. */
  MAX_EVENT_NAME: 40,

  /** Maximum parameter name length. */
  MAX_PARAM_NAME: 40,

  /** Maximum parameter value length (500 for GA360). */
  MAX_PARAM_VALUE: 100,

  /** Maximum user property name length. */
  MAX_USER_PROP_NAME: 24,

  /** Maximum user property value length. */
  MAX_USER_PROP_VALUE: 36,

  /** Maximum user properties per request. */
  MAX_USER_PROPERTIES: 25,

  /** Maximum parameters per event. */
  MAX_PARAMS: 25,

  /** Maximum timestamp backdating in hours. */
  MAX_BACKDATE_HOURS: 72,

  /** Default batch size. */
  BATCH_SIZE: 20,

  /** Default flush interval in ms. */
  FLUSH_INTERVAL_MS: 5_000,

  /** Default max retries. */
  MAX_RETRIES: 3,

  /** Default initial retry delay in ms. */
  INITIAL_RETRY_DELAY_MS: 100,

  /** Default max retry delay in ms. */
  MAX_RETRY_DELAY_MS: 30_000,
} as const;
