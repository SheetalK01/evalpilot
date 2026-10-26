import { SESSION_COOKIE } from '@evalpilot/shared';
import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '../config/env';

export function sessionCookieOptions(config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
    maxAge: config.jwt.ttlSeconds * 1000,
  };
}

export function setSessionCookie(res: Response, token: string, config: AppConfig): void {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(config));
}

export function clearSessionCookie(res: Response, config: AppConfig): void {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions(config);
  res.clearCookie(SESSION_COOKIE, options);
}
