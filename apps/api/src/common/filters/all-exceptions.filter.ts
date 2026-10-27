import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApiErrorBody } from '@evalpilot/shared';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { requestIdOf } from '../request-id';

interface MappedError {
  statusCode: number;
  message: string;
  errors?: ApiErrorBody['errors'];
}

interface IssueLike {
  path: PropertyKey[];
  message: string;
}

function hasIssues(value: unknown): value is { issues: IssueLike[] } {
  return typeof value === 'object' && value !== null && Array.isArray((value as { issues?: unknown }).issues);
}

function fromHttpException(exception: HttpException): MappedError {
  const statusCode = exception.getStatus();
  const response = exception.getResponse();
  if (typeof response === 'string') return { statusCode, message: response };
  const body = response as { message?: unknown };
  if (Array.isArray(body.message)) {
    const messages = body.message.map(String);
    return {
      statusCode,
      message: messages[0] ?? exception.message,
      errors: messages.map((message) => ({ path: '', message })),
    };
  }
  return { statusCode, message: typeof body.message === 'string' ? body.message : exception.message };
}

/**
 * Errors from Express middleware (body-parser: 413 too large, 400 malformed JSON, 415) use the
 * http-errors convention: a 4xx `status` and `expose: true` when the message is safe to show.
 */
function isExposedClientError(value: unknown): value is { status: number; message: string } {
  if (typeof value !== 'object' || value === null) return false;
  const { status, expose, message } = value as { status?: unknown; expose?: unknown; message?: unknown };
  return (
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    expose === true &&
    typeof message === 'string'
  );
}

const PRISMA_ERRORS: Record<string, MappedError> = {
  P2025: { statusCode: HttpStatus.NOT_FOUND, message: 'Not found' },
  P2002: { statusCode: HttpStatus.CONFLICT, message: 'Already exists' },
  P2003: { statusCode: HttpStatus.BAD_REQUEST, message: 'Related resource not found' },
};

/** Maps any thrown error to the API error format and makes sure 5xx details never leak. */
export function mapException(exception: unknown): MappedError {
  if (exception instanceof ZodValidationException) {
    const zodError = exception.getZodError();
    const errors = hasIssues(zodError)
      ? zodError.issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message }))
      : [];
    return { statusCode: HttpStatus.BAD_REQUEST, message: 'Validation failed', errors };
  }
  if (exception instanceof HttpException) return fromHttpException(exception);
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = PRISMA_ERRORS[exception.code];
    if (mapped) return mapped;
  }
  if (isExposedClientError(exception)) return { statusCode: exception.status, message: exception.message };
  return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const mapped = mapException(exception);
    const requestId = requestIdOf(request);

    if (mapped.statusCode >= 500) {
      this.logger.error({ err: exception, requestId }, 'Unhandled error');
    }

    const body: ApiErrorBody = {
      statusCode: mapped.statusCode,
      message: mapped.message,
      ...(mapped.errors ? { errors: mapped.errors } : {}),
      path: request.originalUrl.split('?')[0] ?? request.url,
      requestId,
      timestamp: new Date().toISOString(),
    };
    response.status(mapped.statusCode).json(body);
  }
}
