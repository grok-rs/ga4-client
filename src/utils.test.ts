import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateClientId, generateSessionId, toMicros } from './utils.js';

describe('utils', () => {
  describe('generateClientId', () => {
    it('should generate valid UUID v4', () => {
      const id = generateClientId();
      assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateClientId()));
      assert.equal(ids.size, 100);
    });
  });

  describe('generateSessionId', () => {
    it('should return Unix timestamp in seconds', () => {
      const before = Math.floor(Date.now() / 1000);
      const sessionId = generateSessionId();
      const after = Math.floor(Date.now() / 1000);

      const id = Number(sessionId);
      assert.ok(id >= before && id <= after);
    });
  });

  describe('toMicros', () => {
    it('should convert Date to microseconds', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      const micros = toMicros(date);
      assert.equal(micros, 1704067200000000);
    });

    it('should convert timestamp to microseconds', () => {
      const ms = 1704067200000;
      const micros = toMicros(ms);
      assert.equal(micros, 1704067200000000);
    });
  });
});
