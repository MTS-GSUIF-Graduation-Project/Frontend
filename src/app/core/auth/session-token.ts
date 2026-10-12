export function isUnexpiredJwt(token: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (typeof token !== 'string') {
    return false;
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts.some(part => part.length === 0)) {
    return false;
  }

  const payload = decodePayload(parts[1]);
  const exp = payload?.['exp'];
  return typeof exp === 'number' && Number.isFinite(exp) && exp * 1000 > nowMs;
}

function decodePayload(segment: string): Record<string, unknown> | null {
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    const parsed: unknown = JSON.parse(atob(normalized + padding));

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
