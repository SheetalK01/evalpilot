import type { Target } from '@prisma/client';
import { INPUT_PLACEHOLDER, renderBodyTemplate, renderUrlTemplate } from '@evalpilot/shared';

export interface TargetRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
  responsePath: string;
  /** False for the built-in ShopBot, whose URL comes from server config, not from a user. */
  userDefined: boolean;
}

/** Builds the HTTP request for one test input. Pure, so it is easy to unit-test. */
export function buildTargetRequest(
  target: Pick<Target, 'type' | 'url' | 'method' | 'bodyTemplate' | 'responsePath'>,
  headers: Record<string, string>,
  input: string,
  shopbotUrl: string,
): TargetRequest {
  if (target.type === 'SHOPBOT') {
    return {
      url: `${shopbotUrl.replace(/\/$/, '')}/chat`,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: input }),
      responsePath: '$.reply',
      userDefined: false,
    };
  }
  if (!target.url) throw new Error('HTTP target has no URL');
  const isGet = target.method === 'GET';
  const body = isGet
    ? undefined
    : renderBodyTemplate(target.bodyTemplate ?? `{"input":"${INPUT_PLACEHOLDER}"}`, input);
  const hasContentType = Object.keys(headers).some((name) => name.toLowerCase() === 'content-type');
  return {
    url: renderUrlTemplate(target.url, input),
    method: target.method,
    headers:
      body !== undefined && !hasContentType ? { 'content-type': 'application/json', ...headers } : headers,
    body,
    responsePath: target.responsePath ?? '$',
    userDefined: true,
  };
}
