export type CorsOrigins = string | string[];

export function resolveCorsOrigins(rawOrigins?: string): CorsOrigins {
  if (!rawOrigins) return '*';

  const trimmed = rawOrigins.trim();
  if (trimmed === '' || trimmed === '*') return '*';

  const origins = trimmed
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  if (origins.includes('*')) return '*';

  return origins.length > 0 ? origins : '*';
}
