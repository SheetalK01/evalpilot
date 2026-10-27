import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type User } from '@prisma/client';
import type { RegisterInput } from '@evalpilot/shared';
import bcrypt from 'bcryptjs';
import { PrismaService } from '@evalpilot/server-core';
import { UsersService } from '../users/users.service';

export const BCRYPT_ROUNDS = 12;
/** Compared against when the email is unknown, so both paths take the same time. */
const DUMMY_HASH = bcrypt.hashSync('evalpilot-timing-equaliser', BCRYPT_ROUNDS);

export interface JwtPayload {
  sub: string;
}

export interface GithubProfile {
  githubId: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<User> {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    try {
      return await this.prisma.user.create({ data: { name: input.name, email: input.email, passwordHash } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  /** Returns the user when the email and password match, otherwise null (never says which part was wrong). */
  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.users.findByEmail(email);
    const matches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    return user?.passwordHash && matches ? user : null;
  }

  /** Signs in with GitHub: links by GitHub id, then by verified email, otherwise creates an account. */
  async findOrCreateGithubUser(profile: GithubProfile): Promise<User> {
    const byGithub = await this.prisma.user.findUnique({ where: { githubId: profile.githubId } });
    if (byGithub) return byGithub;
    const email = profile.email?.toLowerCase() ?? `${profile.githubId}@users.noreply.github.com`;
    const byEmail = await this.users.findByEmail(email);
    if (byEmail) {
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: { githubId: profile.githubId, avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl },
      });
    }
    return this.prisma.user.create({
      data: { githubId: profile.githubId, email, name: profile.name, avatarUrl: profile.avatarUrl },
    });
  }

  issueToken(userId: string): string {
    const payload: JwtPayload = { sub: userId };
    return this.jwt.sign(payload);
  }
}
