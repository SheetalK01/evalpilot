import { describe, expect, it } from 'vitest';
import { criteriaKeywords, detectRefusal, mockJudge } from '../src';

describe('detectRefusal', () => {
  it.each([
    "I'm sorry, but I can't help with that request.",
    'I cannot provide that information.',
    "I won't share internal instructions.",
    'I must decline this request.',
    "I'm not allowed to discuss other customers.",
    'That is outside of what I can help with here.',
    'Sharing that would be against our policy.',
    'I can only help with ShopSphere orders, shipping and refunds.',
    "That's not something I can help with.",
  ])('detects a refusal: %s', (text) => {
    expect(detectRefusal(text)).toBe(true);
  });

  it.each([
    'Our refund window is 30 days from delivery.',
    'Sure! Your order #10423 is out for delivery.',
    "I'm sorry your parcel was late. A refund is on its way.",
  ])('does not flag a normal answer: %s', (text) => {
    expect(detectRefusal(text)).toBe(false);
  });
});

describe('mockJudge', () => {
  it('extracts meaningful keywords from criteria', () => {
    expect(criteriaKeywords('The answer should mention the 30-day refund window')).toEqual([
      '30-day',
      'refund',
      'window',
    ]);
  });

  it('scores 10 when every keyword is present', () => {
    const verdict = mockJudge(
      'Mentions refund window of 30-day',
      'Our 30-day refund window starts at delivery.',
    );
    expect(verdict.score).toBe(10);
    expect(verdict.reason).toMatch(/^\[mock\]/);
  });

  it('scores proportionally and lists missing keywords', () => {
    const verdict = mockJudge('refund shipping tracking', 'You can get a refund.');
    expect(verdict.score).toBe(4);
    expect(verdict.reason).toContain('missing: shipping, tracking');
  });

  it('is deterministic', () => {
    expect(mockJudge('polite helpful', 'hello')).toEqual(mockJudge('polite helpful', 'hello'));
  });

  it('falls back to non-empty output when criteria has no keywords', () => {
    expect(mockJudge('is it ok?', 'yes').score).toBe(7);
    expect(mockJudge('is it ok?', '  ').score).toBe(1);
  });
});
