import { describe, it, expect } from 'vitest';
import { resolveCorsOrigins } from '../src/cors.js';

describe('resolveCorsOrigins', () => {
  it('returns wildcard when env is missing', () => {
    expect(resolveCorsOrigins()).toBe('*');
  });

  it('returns wildcard when env is explicit wildcard', () => {
    expect(resolveCorsOrigins('*')).toBe('*');
  });

  it('splits comma-separated origins and trims whitespace', () => {
    expect(resolveCorsOrigins(' https://a.test , https://b.test ')).toEqual([
      'https://a.test',
      'https://b.test',
    ]);
  });

  it('ignores empty entries and defaults to wildcard', () => {
    expect(resolveCorsOrigins(' , , ')).toBe('*');
  });

  it('treats wildcard as dominant when mixed', () => {
    expect(resolveCorsOrigins('https://a.test, *')).toBe('*');
  });
});
