// =============================================================================
// Authentication — JWT + bcrypt
// Guest UUID tokens + optional username/password signup
// =============================================================================

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';

// =============================================================================
// CONFIGURATION
// =============================================================================

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required. ' +
      'Set it in .env or your deployment environment.'
    );
  }
  return secret;
}

const JWT_SECRET: string = getJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = 10;

// =============================================================================
// PASSWORD HASHING
// =============================================================================

/**
 * Hash a plaintext password with bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compare a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// =============================================================================
// JWT TOKEN MANAGEMENT
// =============================================================================

export interface TokenPayload {
  playerId: string;
  username: string;
  isGuest: boolean;
}

/**
 * Generate a JWT token for a player.
 */
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

/**
 * Verify and decode a JWT token. Returns null if invalid.
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extract JWT token from Authorization header (Bearer scheme).
 */
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

// =============================================================================
// EXPRESS MIDDLEWARE
// =============================================================================

/**
 * Augment Express Request with authenticated player info.
 */
export interface AuthenticatedRequest extends Request {
  player?: TokenPayload;
}

/**
 * Middleware: requires valid JWT token. Rejects with 401 if missing/invalid.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
    return;
  }

  req.player = payload;
  next();
}

/**
 * Middleware: optionally authenticates if token provided. Does not reject.
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req.headers.authorization);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.player = payload;
    }
  }
  next();
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate username format.
 * Rules: 3-20 chars, alphanumeric + underscores, must start with letter.
 */
export function isValidUsername(username: string): { valid: boolean; error?: string } {
  if (username.length < 3) return { valid: false, error: 'Username must be at least 3 characters' };
  if (username.length > 20) return { valid: false, error: 'Username must be at most 20 characters' };
  if (!/^[a-zA-Z]/.test(username)) return { valid: false, error: 'Username must start with a letter' };
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  return { valid: true };
}

/**
 * Validate password strength.
 * Rules: at least 6 characters.
 */
export function isValidPassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 6) return { valid: false, error: 'Password must be at least 6 characters' };
  if (password.length > 128) return { valid: false, error: 'Password must be at most 128 characters' };
  return { valid: true };
}
