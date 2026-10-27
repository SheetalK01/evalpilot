import { createHmac } from 'node:crypto';

const b64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

/** Signs an HS256 JWT by hand, so tests can forge expired, tampered or `alg: none` tokens. */
export function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  alg: 'HS256' | 'none' = 'HS256',
): string {
  const head = `${b64url(JSON.stringify({ alg, typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}`;
  if (alg === 'none') return `${head}.`;
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
}
