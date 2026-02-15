// =============================================================================
// CORS Origin Parser
// Shared between Express and Socket.io to ensure consistent behavior.
// =============================================================================

/**
 * Parse a CORS_ORIGIN env string into the format expected by cors middleware.
 *
 * Rules:
 *  - undefined / empty / blank → wildcard '*'
 *  - single origin → that origin string
 *  - comma-separated → array of trimmed origins
 *  - if any entry is '*' → wildcard '*' (prevents partial misconfiguration)
 */
export function resolveCorsOrigins(rawOrigins?: string): string | string[] {
  if (!rawOrigins || !rawOrigins.trim()) return '*';

  const origins = rawOrigins
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.includes('*')) return '*';
  if (origins.length === 1) return origins[0];
  return origins;
}
