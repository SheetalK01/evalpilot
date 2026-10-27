import { Injectable, NotFoundException } from '@nestjs/common';
import type { ApiKey } from '@prisma/client';
import {
  apiKeyDisplayPrefix,
  type ApiKeyResponse,
  type CreateApiKeyInput,
  type CreatedApiKeyResponse,
  isApiKeyFormat,
} from '@evalpilot/shared';
import { PrismaService } from '@evalpilot/server-core';
import { ProjectsService } from '../projects/projects.service';
import type { ApiKeyContext } from '../types/auth';
import { generateApiKey, hashApiKey } from './api-key.util';

/** `last_used_at` is refreshed at most this often, so busy keys do not write on every request. */
const LAST_USED_RESOLUTION_MS = 60_000;

export function toApiKeyResponse(key: ApiKey): ApiKeyResponse {
  return {
    id: key.id,
    projectId: key.projectId,
    name: key.name,
    prefix: key.prefix,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null,
    createdAt: key.createdAt.toISOString(),
  };
}

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async list(ownerId: string, projectId: string): Promise<ApiKeyResponse[]> {
    await this.projects.assertOwned(ownerId, projectId);
    const keys = await this.prisma.apiKey.findMany({
      where: { projectId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return keys.map(toApiKeyResponse);
  }

  /** The raw key is returned here once and never stored; only its SHA-256 hash is. */
  async create(ownerId: string, projectId: string, input: CreateApiKeyInput): Promise<CreatedApiKeyResponse> {
    await this.projects.assertOwned(ownerId, projectId);
    const rawKey = generateApiKey();
    const key = await this.prisma.apiKey.create({
      data: { projectId, name: input.name, prefix: apiKeyDisplayPrefix(rawKey), keyHash: hashApiKey(rawKey) },
    });
    return { ...toApiKeyResponse(key), key: rawKey };
  }

  /** Revoking is idempotent: revoking an already revoked key succeeds and keeps the first timestamp. */
  async revoke(ownerId: string, keyId: string): Promise<void> {
    const key = await this.prisma.apiKey.findFirst({ where: { id: keyId, project: { ownerId } } });
    if (!key) throw new NotFoundException('API key not found');
    if (!key.revokedAt)
      await this.prisma.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
  }

  /** Resolves a raw key to its project, or null when the key is malformed, unknown or revoked. */
  async authenticate(rawKey: string): Promise<ApiKeyContext | null> {
    if (!isApiKeyFormat(rawKey)) return null;
    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(rawKey) },
      include: { project: { select: { ownerId: true } } },
    });
    if (!key || key.revokedAt) return null;
    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
      await this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    }
    return { apiKeyId: key.id, projectId: key.projectId, ownerId: key.project.ownerId };
  }
}
