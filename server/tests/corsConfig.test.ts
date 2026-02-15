import { describe, it, expect } from 'vitest';
import { resolveCorsOrigins } from '../src/corsConfig';

describe('resolveCorsOrigins', () => {
  it('returns wildcard for undefined', () => {
    expect(resolveCorsOrigins(undefined)).toBe('*');
  });

  it('returns wildcard for empty string', () => {
    expect(resolveCorsOrigins('')).toBe('*');
  });

  it('returns wildcard for blank string', () => {
    expect(resolveCorsOrigins('   ')).toBe('*');
  });

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

  it('returns wildcard when list contains wildcard', () => {
    expect(resolveCorsOrigins('https://a.com,*,https://b.com')).toBe('*');
  });

  it('returns wildcard for standalone wildcard', () => {
    expect(resolveCorsOrigins('*')).toBe('*');
  });

  it('handles three origins', () => {
    const result = resolveCorsOrigins('https://a.com,https://b.com,https://c.com');
    expect(result).toEqual(['https://a.com', 'https://b.com', 'https://c.com']);
  });
});
