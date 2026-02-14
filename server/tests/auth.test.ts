// =============================================================================
// Authentication Tests — JWT, bcrypt, validation, middleware
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import {
  hashPassword, verifyPassword,
  generateToken, verifyToken, extractToken,
  isValidUsername, isValidPassword,
  requireAuth, optionalAuth,
  type AuthenticatedRequest,
} from '../src/auth.js';

// =============================================================================
// PASSWORD HASHING
// =============================================================================

describe('Password Hashing', () => {
  it('hashes a password and verifies correctly', async () => {
    const password = 'MySecurePass123';
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(20);
    expect(await verifyPassword(password, hash)).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('correct-password');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('generates different hashes for same password (salted)', async () => {
    const hash1 = await hashPassword('same-password');
    const hash2 = await hashPassword('same-password');
    expect(hash1).not.toBe(hash2);
  });
});

// =============================================================================
// JWT TOKENS
// =============================================================================

describe('JWT Tokens', () => {
  const testPayload = {
    playerId: 'test-uuid-1234',
    username: 'TestPlayer',
    isGuest: false,
  };

  it('generates a valid JWT token', () => {
    const token = generateToken(testPayload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  it('verifies a valid token and returns payload', () => {
    const token = generateToken(testPayload);
    const decoded = verifyToken(token);

    expect(decoded).not.toBeNull();
    expect(decoded!.playerId).toBe(testPayload.playerId);
    expect(decoded!.username).toBe(testPayload.username);
    expect(decoded!.isGuest).toBe(testPayload.isGuest);
  });

  it('returns null for invalid token', () => {
    expect(verifyToken('invalid.token.here')).toBeNull();
    expect(verifyToken('')).toBeNull();
    expect(verifyToken('not-a-jwt')).toBeNull();
  });

  it('returns null for tampered token', () => {
    const token = generateToken(testPayload);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(verifyToken(tampered)).toBeNull();
  });

  it('generates different tokens for different payloads', () => {
    const token1 = generateToken(testPayload);
    const token2 = generateToken({ ...testPayload, playerId: 'different-id' });
    expect(token1).not.toBe(token2);
  });

  it('guest token has isGuest = true', () => {
    const guestPayload = { playerId: 'guest-1', username: 'Guest_abc', isGuest: true };
    const token = generateToken(guestPayload);
    const decoded = verifyToken(token);
    expect(decoded!.isGuest).toBe(true);
  });
});

// =============================================================================
// TOKEN EXTRACTION
// =============================================================================

describe('Token Extraction', () => {
  it('extracts token from Bearer header', () => {
    expect(extractToken('Bearer my-jwt-token')).toBe('my-jwt-token');
  });

  it('returns null for missing header', () => {
    expect(extractToken(undefined)).toBeNull();
  });

  it('returns null for non-Bearer scheme', () => {
    expect(extractToken('Basic abc123')).toBeNull();
    expect(extractToken('Token abc123')).toBeNull();
  });

  it('returns null for malformed header', () => {
    expect(extractToken('Bearer')).toBeNull();
    expect(extractToken('Bearer token extra')).toBeNull();
    expect(extractToken('')).toBeNull();
  });
});

// =============================================================================
// VALIDATION
// =============================================================================

describe('Username Validation', () => {
  it('accepts valid usernames', () => {
    expect(isValidUsername('Alice').valid).toBe(true);
    expect(isValidUsername('player_1').valid).toBe(true);
    expect(isValidUsername('ChessMaster2000').valid).toBe(true);
    expect(isValidUsername('abc').valid).toBe(true);
  });

  it('rejects short usernames', () => {
    const result = isValidUsername('ab');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least 3');
  });

  it('rejects long usernames', () => {
    const result = isValidUsername('a'.repeat(21));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at most 20');
  });

  it('rejects usernames starting with number', () => {
    const result = isValidUsername('1player');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('start with a letter');
  });

  it('rejects usernames with special characters', () => {
    const result = isValidUsername('play@er');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('letters, numbers, and underscores');
  });

  it('rejects usernames starting with underscore', () => {
    const result = isValidUsername('_player');
    expect(result.valid).toBe(false);
  });
});

describe('Password Validation', () => {
  it('accepts valid passwords', () => {
    expect(isValidPassword('123456').valid).toBe(true);
    expect(isValidPassword('a very long password with spaces').valid).toBe(true);
  });

  it('rejects short passwords', () => {
    const result = isValidPassword('12345');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least 6');
  });

  it('rejects very long passwords', () => {
    const result = isValidPassword('a'.repeat(129));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at most 128');
  });
});

// =============================================================================
// MIDDLEWARE
// =============================================================================

describe('Auth Middleware', () => {
  function mockReq(authHeader?: string): AuthenticatedRequest {
    return {
      headers: { authorization: authHeader },
    } as AuthenticatedRequest;
  }

  function mockRes() {
    const res: any = {
      statusCode: 200,
      body: null,
      status(code: number) { res.statusCode = code; return res; },
      json(data: any) { res.body = data; return res; },
    };
    return res;
  }

  it('requireAuth — rejects request without token', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAuth — rejects request with invalid token', () => {
    const req = mockReq('Bearer invalid-token');
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAuth — passes with valid token', () => {
    const token = generateToken({ playerId: 'p1', username: 'test', isGuest: false });
    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.player).toBeDefined();
    expect(req.player!.playerId).toBe('p1');
    expect(req.player!.username).toBe('test');
  });

  it('optionalAuth — passes without token (no player set)', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.player).toBeUndefined();
  });

  it('optionalAuth — sets player with valid token', () => {
    const token = generateToken({ playerId: 'p2', username: 'guest', isGuest: true });
    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();
    const next = vi.fn();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.player!.isGuest).toBe(true);
  });

  it('optionalAuth — passes with invalid token (no player set)', () => {
    const req = mockReq('Bearer garbage');
    const res = mockRes();
    const next = vi.fn();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.player).toBeUndefined();
  });
});
