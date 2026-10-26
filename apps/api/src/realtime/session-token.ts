import { SESSION_COOKIE } from '@evalpilot/shared';

/** Reads the session JWT from a raw `Cookie` header (the WebSocket handshake has no cookie-parser). */
export function sessionTokenFromCookieHeader(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) {
      const value = rest.join('=');
      try {
        return value ? decodeURIComponent(value) : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}
