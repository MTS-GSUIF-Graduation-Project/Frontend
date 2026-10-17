import { isUnexpiredJwt } from './session-token';

describe('isUnexpiredJwt', () => {
  const now = Date.UTC(2026, 9, 12, 12, 0, 0);

  it('rejects a missing token', () => {
    expect(isUnexpiredJwt(null, now)).toBe(false);
    expect(isUnexpiredJwt(undefined, now)).toBe(false);
    expect(isUnexpiredJwt('   ', now)).toBe(false);
  });

  it('rejects a malformed token', () => {
    expect(isUnexpiredJwt('not-a-jwt', now)).toBe(false);
    expect(isUnexpiredJwt('only.two', now)).toBe(false);
    expect(isUnexpiredJwt(`${encode({ alg: 'none' })}.@@@.sig`, now)).toBe(false);
    expect(isUnexpiredJwt(token({ exp: 'later' }), now)).toBe(false);
  });

  it('rejects an expired token', () => {
    const exp = Math.floor(now / 1000) - 1;
    expect(isUnexpiredJwt(token({ exp }), now)).toBe(false);
    expect(isUnexpiredJwt(token({ exp: Math.floor(now / 1000) }), now)).toBe(false);
  });

  it('accepts a valid unexpired token', () => {
    const exp = Math.floor(now / 1000) + 60;
    expect(isUnexpiredJwt(token({ exp, sub: 'developer' }), now)).toBe(true);
    expect(isUnexpiredJwt(token({ exp: Math.floor(now / 1000) }), now - 1)).toBe(true);
  });

  it('does not reject a structurally valid JWT because the signature is unverified', () => {
    const exp = Math.floor(now / 1000) + 60;
    const [header, payload] = token({ exp, sub: 'developer' }).split('.');

    expect(isUnexpiredJwt(`${header}.${payload}.dGFtcGVyZWQ`, now)).toBe(true);
    expect(isUnexpiredJwt(`${header}.${payload}.sig`, now)).toBe(true);
  });

  it('reads exp from a UTF-8 payload with a non-ASCII subject', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ sub: 'مستخدم_é', exp: Math.floor(now / 1000) + 60 }));
    const payload = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

    expect(isUnexpiredJwt(`${encode({ alg: 'HS384' })}.${payload}.sig`, now)).toBe(true);
  });
});

function token(payload: object): string {
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.sig`;
}

function encode(value: object): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
