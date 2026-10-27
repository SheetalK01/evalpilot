import { describe, expect, it } from 'vitest';
import { parseCliArgs } from '../src/args';

describe('parseCliArgs', () => {
  it('parses a full run command', () => {
    expect(
      parseCliArgs([
        'run',
        '--suite',
        's1',
        '--threshold',
        '0.85',
        '--json',
        '--commit',
        'ABCDEF1',
        '--timeout',
        '120',
      ]),
    ).toEqual({
      command: 'run',
      suiteId: 's1',
      threshold: 0.85,
      wait: true,
      json: true,
      commitSha: 'abcdef1',
      timeoutSeconds: 120,
    });
  });

  it('uses defaults, --no-wait and GITHUB_SHA', () => {
    expect(parseCliArgs(['run', '--suite', 's1', '--no-wait'], { GITHUB_SHA: 'a'.repeat(40) })).toMatchObject(
      {
        threshold: null,
        wait: false,
        json: false,
        commitSha: 'a'.repeat(40),
        timeoutSeconds: 600,
      },
    );
  });

  it('ignores a commit that is not a SHA', () => {
    expect(parseCliArgs(['run', '--suite', 's1', '--commit', 'main'])).toMatchObject({ commitSha: null });
  });

  it.each([
    [['--help'], 'help'],
    [['-h'], 'help'],
    [['-v'], 'version'],
  ])('%j → %s', (argv, command) => {
    expect(parseCliArgs(argv).command).toBe(command);
  });

  it.each([
    [[], 'Missing command'],
    [['deploy'], 'Unknown command "deploy"'],
    [['run'], '--suite is required'],
    [['run', '--suite', 's', 'extra'], 'Unexpected argument "extra"'],
    [['run', '--suite', 's', '--threshold', '1.5'], '--threshold must be a number from 0 to 1'],
    [['run', '--suite', 's', '--threshold', 'high'], '--threshold must be a number from 0 to 1'],
    [['run', '--suite', 's', '--timeout', '0'], '--timeout must be a positive whole number of seconds'],
  ])('rejects %j: %s', (argv, message) => {
    expect(parseCliArgs(argv)).toEqual({ command: 'invalid', message });
  });

  it('reports unknown flags', () => {
    expect(parseCliArgs(['run', '--suite', 's', '--bogus'])).toMatchObject({
      command: 'invalid',
      message: expect.stringContaining('--bogus'),
    });
  });
});
