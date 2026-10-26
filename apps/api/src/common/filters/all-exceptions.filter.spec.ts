import { BadRequestException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ZodValidationException } from 'nestjs-zod';
import { z } from 'zod';
import { AllExceptionsFilter, mapException } from './all-exceptions.filter';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('db error', { code, clientVersion: 'test' });

describe('mapException', () => {
  it('maps zod validation errors to 400 with field paths', () => {
    const result = z
      .object({ name: z.string().min(1), nested: z.object({ n: z.number() }) })
      .safeParse({ name: '', nested: { n: 'x' } });
    if (result.success) throw new Error('expected failure');
    expect(mapException(new ZodValidationException(result.error))).toEqual({
      statusCode: 400,
      message: 'Validation failed',
      errors: [
        { path: 'name', message: expect.any(String) },
        { path: 'nested.n', message: expect.any(String) },
      ],
    });
  });

  it.each([
    [new NotFoundException('Project not found'), 404, 'Project not found'],
    [new ForbiddenException(), 403, 'Forbidden'],
    [new HttpException('Plain string', 418), 418, 'Plain string'],
  ])('keeps HttpException status and message (%#)', (exception, statusCode, message) => {
    expect(mapException(exception)).toEqual({ statusCode, message });
  });

  it('turns message arrays into an errors list', () => {
    expect(mapException(new BadRequestException(['first problem', 'second problem']))).toEqual({
      statusCode: 400,
      message: 'first problem',
      errors: [
        { path: '', message: 'first problem' },
        { path: '', message: 'second problem' },
      ],
    });
  });

  it.each([
    ['P2025', 404],
    ['P2002', 409],
    ['P2003', 400],
  ])('maps Prisma %s to %i', (code, statusCode) => {
    expect(mapException(prismaError(code)).statusCode).toBe(statusCode);
  });

  it('exposes safe client errors from Express middleware', () => {
    const tooLarge = Object.assign(new Error('request entity too large'), { status: 413, expose: true });
    expect(mapException(tooLarge)).toEqual({ statusCode: 413, message: 'request entity too large' });
  });

  it.each([
    ['unknown errors', new Error('connection string with password=hunter2')],
    ['unknown Prisma codes', prismaError('P1001')],
    ['non-exposed http errors', Object.assign(new Error('internal detail'), { status: 400, expose: false })],
    ['thrown strings', 'boom'],
  ])('hides details of %s behind a generic 500', (_label, exception) => {
    expect(mapException(exception)).toEqual({ statusCode: 500, message: 'Internal server error' });
  });
});

describe('AllExceptionsFilter', () => {
  it('writes the standard error body with path and request id', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({
          id: 'req-123',
          originalUrl: '/api/projects/abc?x=1',
          url: '/api/projects/abc?x=1',
        }),
        getResponse: () => ({ status }),
      }),
    };
    new AllExceptionsFilter().catch(new NotFoundException('Project not found'), host as never);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Project not found',
      path: '/api/projects/abc',
      requestId: 'req-123',
      timestamp: expect.any(String),
    });
  });

  it('logs 5xx errors', () => {
    const filter = new AllExceptionsFilter();
    const logSpy = jest
      .spyOn((filter as unknown as { logger: { error: () => void } }).logger, 'error')
      .mockImplementation(() => undefined);
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ originalUrl: '/api/x', url: '/api/x' }),
        getResponse: () => ({ status: () => ({ json: jest.fn() }) }),
      }),
    };
    filter.catch(new Error('kaboom'), host as never);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});
