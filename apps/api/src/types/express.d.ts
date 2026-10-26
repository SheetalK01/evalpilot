import type { ApiKeyContext, AuthUser } from './auth';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthUser {}
    interface Request {
      apiKey?: ApiKeyContext;
    }
  }
}

export {};
