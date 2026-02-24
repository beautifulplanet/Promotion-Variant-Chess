// =============================================================================
// CORS Origin Parser
// Shared between Express and Socket.io to ensure consistent behavior.
// =============================================================================

/**
 * Parse a CORS_ORIGIN env string into the format expected by cors middleware.
 *
 * Rules:
 *  - In production (NODE_ENV=production): missing/blank → throws (fail closed)
 *  - In dev/test: missing/blank → wildcard '*'
 *  - single origin → that origin string
 *  - comma-separated → array of trimmed origins
 *  - if any entry is '*' → wildcard '*' (prevents partial misconfiguration)
 */
export function resolveCorsOrigins(rawOrigins?: string): string | string[] {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!rawOrigins || !rawOrigins.trim()) {
    if (isProduction) {
      throw new Error(
        'CORS_ORIGIN must be set in production. ' +
        'Example: CORS_ORIGIN=https://your-app.vercel.app'
      );
    }
    return '*';
  }

  const origins = rawOrigins
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    if (isProduction) {
      throw new Error('CORS_ORIGIN resolved to zero valid origins in production.');
    }
    return '*';
  }

  if (origins.includes('*')) {
    if (isProduction) {
      throw new Error(
        'CORS_ORIGIN=* (wildcard) is not allowed in production. ' +
        'Specify explicit origins: CORS_ORIGIN=https://your-app.vercel.app'
      );
    }
    return '*';
  }

  if (origins.length === 1) return origins[0];
  return origins;
}
