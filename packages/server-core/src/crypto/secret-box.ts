import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectConfig } from '../config/config.module';
import type { AppConfig } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

/**
 * Authenticated encryption (AES-256-GCM) for secrets at rest, such as target headers.
 * Format: `v1.<iv>.<auth tag>.<ciphertext>`, each part base64url. Tampering makes `open` throw.
 */
export class SecretBox {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32) throw new Error('SecretBox key must be 32 bytes');
  }

  seal(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [VERSION, iv, cipher.getAuthTag(), ciphertext]
      .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
      .join('.');
  }

  open(sealed: string): string {
    const [version, iv, tag, ciphertext] = sealed.split('.');
    if (version !== VERSION || !iv || !tag || ciphertext === undefined)
      throw new Error('Unrecognised secret format');
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString(
      'utf8',
    );
  }
}

@Injectable()
export class SecretBoxService extends SecretBox {
  constructor(@InjectConfig() config: AppConfig) {
    super(config.targetSecretKey);
  }
}
