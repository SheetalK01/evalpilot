import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeysService } from '../../api-keys/api-keys.service';

export function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = bearerToken(req);
    if (!token)
      throw new UnauthorizedException('Send your project API key as "Authorization: Bearer ep_live_…"');
    const apiKey = await this.apiKeys.authenticate(token);
    if (!apiKey) throw new UnauthorizedException('Invalid or revoked API key');
    req.apiKey = apiKey;
    return true;
  }
}
