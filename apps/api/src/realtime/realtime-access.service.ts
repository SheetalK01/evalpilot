import { Injectable } from '@nestjs/common';
import { parseRoomName } from '@evalpilot/shared';
import { PrismaService } from '@evalpilot/server-core';

/** Decides whether a user may join a room: only rooms of their own runs and projects. */
@Injectable()
export class RealtimeAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async canJoin(userId: string, room: string): Promise<boolean> {
    const parsed = parseRoomName(room);
    if (!parsed) return false;
    const owner = { ownerId: userId };
    switch (parsed.kind) {
      case 'run':
        return (
          (await this.prisma.testRun.count({ where: { id: parsed.id, suite: { project: owner } } })) === 1
        );
      case 'redteam':
        return (await this.prisma.redteamRun.count({ where: { id: parsed.id, project: owner } })) === 1;
      case 'project':
        return (await this.prisma.project.count({ where: { id: parsed.id, ...owner } })) === 1;
    }
  }
}
