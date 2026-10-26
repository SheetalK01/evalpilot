import { randomBytes } from 'node:crypto';
import { SecretBox } from './secret-box';

describe('SecretBox (AES-256-GCM)', () => {
  const box = new SecretBox(randomBytes(32));

  it('round-trips text, including unicode', () => {
    const secret = JSON.stringify({ Authorization: 'Bearer sk-live-ünïcødé-🔐' });
    expect(box.open(box.seal(secret))).toBe(secret);
  });

  it('uses a fresh IV, so the same input never encrypts the same way twice', () => {
    expect(box.seal('same')).not.toBe(box.seal('same'));
  });

  it('produces the versioned format', () => {
    expect(box.seal('x')).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]*$/);
  });

  it('detects tampering', () => {
    const [version, iv, tag, ciphertext] = box.seal('top secret').split('.');
    const flipped = `${ciphertext?.[0] === 'A' ? 'B' : 'A'}${ciphertext?.slice(1) ?? ''}`;
    expect(() => box.open([version, iv, tag, flipped].join('.'))).toThrow();
  });

  it('cannot be opened with another key', () => {
    expect(() => new SecretBox(randomBytes(32)).open(box.seal('top secret'))).toThrow();
  });

  it('rejects unknown formats and wrong key sizes', () => {
    expect(() => box.open('v2.a.b.c')).toThrow('Unrecognised secret format');
    expect(() => box.open('garbage')).toThrow('Unrecognised secret format');
    expect(() => new SecretBox(randomBytes(16))).toThrow('32 bytes');
  });
});
