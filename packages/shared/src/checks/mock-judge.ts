/**
 * Deterministic stand-in for the Claude judge, used when AI_MODE=mock (tests, CI, demos).
 * Score = share of meaningful criteria keywords found in the output, mapped to 1–10.
 */
const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'should',
  'must',
  'answer',
  'response',
  'output',
  'reply',
  'user',
  'about',
  'into',
  'are',
  'was',
  'were',
  'not',
  'any',
  'all',
  'its',
  'has',
  'have',
  'does',
  'did',
  'mention',
  'mentions',
  'include',
  'includes',
  'say',
  'says',
  'tell',
  'tells',
  'clearly',
  'politely',
  'correct',
  'correctly',
  'only',
  'also',
  'when',
  'what',
  'how',
  'why',
  'who',
  'which',
  'their',
  'there',
  'them',
  'they',
  'you',
  'your',
  'our',
  'can',
]);

export interface JudgeVerdict {
  score: number;
  reason: string;
}

export function criteriaKeywords(criteria: string): string[] {
  const words = criteria.toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) ?? [];
  return [...new Set(words.filter((word) => word.length >= 3 && !STOP_WORDS.has(word)))];
}

export function mockJudge(criteria: string, output: string): JudgeVerdict {
  const keywords = criteriaKeywords(criteria);
  if (keywords.length === 0) {
    return {
      score: output.trim() ? 7 : 1,
      reason: '[mock] No keywords in criteria; scored on non-empty output.',
    };
  }
  const haystack = output.toLowerCase();
  const found = keywords.filter((keyword) => haystack.includes(keyword));
  const score = Math.max(1, Math.round(1 + (9 * found.length) / keywords.length));
  const missing = keywords.filter((keyword) => !found.includes(keyword));
  const reason =
    missing.length === 0
      ? `[mock] All ${keywords.length} criteria keywords found.`
      : `[mock] Found ${found.length}/${keywords.length} criteria keywords; missing: ${missing.slice(0, 5).join(', ')}.`;
  return { score, reason };
}
