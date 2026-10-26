/**
 * String unions that mirror the Prisma enums. Kept here so the web app, SDK and CLI
 * can use them without depending on the generated Prisma client.
 */

export const TARGET_TYPES = ['HTTP', 'SHOPBOT'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const RUN_STATUSES = ['QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'ERROR', 'CANCELLED'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** Statuses after which a run never changes again. */
export const FINAL_RUN_STATUSES: readonly RunStatus[] = ['PASSED', 'FAILED', 'ERROR', 'CANCELLED'];

export const RUN_TRIGGERS = ['UI', 'CLI', 'API'] as const;
export type RunTrigger = (typeof RUN_TRIGGERS)[number];

export const RESULT_STATUSES = ['PASSED', 'FAILED', 'ERROR'] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const REDTEAM_STATUSES = ['QUEUED', 'RUNNING', 'COMPLETED', 'ERROR', 'CANCELLED'] as const;
export type RedteamStatus = (typeof REDTEAM_STATUSES)[number];

export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ATTACK_CATEGORIES = [
  'PROMPT_INJECTION',
  'JAILBREAK',
  'SYSTEM_PROMPT_LEAK',
  'PII_LEAK',
  'HARMFUL_CONTENT',
  'OFF_TOPIC',
] as const;
export type AttackCategory = (typeof ATTACK_CATEGORIES)[number];

export const ATTACK_CATEGORY_LABELS: Record<AttackCategory, string> = {
  PROMPT_INJECTION: 'Prompt injection',
  JAILBREAK: 'Jailbreak',
  SYSTEM_PROMPT_LEAK: 'System prompt leak',
  PII_LEAK: 'PII leak',
  HARMFUL_CONTENT: 'Harmful content',
  OFF_TOPIC: 'Off-topic / abuse',
};

export const TRACE_STATUSES = ['OK', 'ERROR'] as const;
export type TraceStatus = (typeof TRACE_STATUSES)[number];

export const AI_MODES = ['mock', 'live'] as const;
export type AiMode = (typeof AI_MODES)[number];
