import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveCorsOrigins } from '../src/corsConfig';

describe('resolveCorsOrigins', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('dev/test mode (default)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('returns wildcard for undefined', () => {
      expect(resolveCorsOrigins(undefined)).toBe('*');
    });

    it('returns wildcard for empty string', () => {
      expect(resolveCorsOrigins('')).toBe('*');
    });

    it('returns wildcard for blank string', () => {
      expect(resolveCorsOrigins('   ')).toBe('*');
    });

    it('returns wildcard when list contains wildcard', () => {
      expect(resolveCorsOrigins('https://a.com,*,https://b.com')).toBe('*');
    });

    it('returns wildcard for standalone wildcard', () => {
      expect(resolveCorsOrigins('*')).toBe('*');
    });
  });

  describe('production mode (fail closed)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('throws for undefined', () => {
      expect(() => resolveCorsOrigins(undefined)).toThrow('CORS_ORIGIN must be set in production');
    });

    it('throws for empty string', () => {
      expect(() => resolveCorsOrigins('')).toThrow('CORS_ORIGIN must be set in production');
    });

    it('throws for blank string', () => {
      expect(() => resolveCorsOrigins('   ')).toThrow('CORS_ORIGIN must be set in production');
    });

    it('throws for wildcard', () => {
      expect(() => resolveCorsOrigins('*')).toThrow('wildcard) is not allowed in production');
    });

    it('throws when list contains wildcard', () => {
      expect(() => resolveCorsOrigins('https://a.com,*')).toThrow('wildcard) is not allowed in production');
    });

    it('allows explicit origins in production', () => {
      expect(resolveCorsOrigins('https://example.com')).toBe('https://example.com');
    });
  });

  describe('origin parsing (all environments)', () => {
    it('returns single origin as string', () => {
      expect(resolveCorsOrigins('https://example.com')).toBe('https://example.com');
    });

    it('trims single origin', () => {
      expect(resolveCorsOrigins('  https://example.com  ')).toBe('https://example.com');
    });

    it('splits comma-separated origins into array', () => {
      expect(resolveCorsOrigins('https://a.com,https://b.com'))
        .toEqual(['https://a.com', 'https://b.com']);
    });

    it('trims each origin in comma-separated list', () => {
      expect(resolveCorsOrigins(' https://a.com , https://b.com '))
        .toEqual(['https://a.com', 'https://b.com']);
    });

    it('filters empty entries from trailing commas', () => {
      expect(resolveCorsOrigins('https://a.com,,https://b.com,'))
        .toEqual(['https://a.com', 'https://b.com']);
    });

    it('handles three origins', () => {
      const result = resolveCorsOrigins('https://a.com,https://b.com,https://c.com');
      expect(result).toEqual(['https://a.com', 'https://b.com', 'https://c.com']);
    });
  });
});
