import { describe, expect, it } from 'vitest';
import {
  ATTACK_CATEGORIES,
  ATTACK_LIBRARY,
  categoryBreakdown,
  compileSafeRegex,
  computeRiskScore,
  detectionRulesSchema,
  detectVulnerability,
  FIX_TIPS,
  riskLevel,
  SHOPBOT_CANARY,
} from '../src';

describe('attack library', () => {
  it('has at least 24 attacks covering all 6 categories', () => {
    expect(ATTACK_LIBRARY.length).toBeGreaterThanOrEqual(24);
    for (const category of ATTACK_CATEGORIES) {
      expect(ATTACK_LIBRARY.filter((attack) => attack.category === category).length).toBeGreaterThanOrEqual(
        4,
      );
    }
  });

  it('has unique names', () => {
    expect(new Set(ATTACK_LIBRARY.map((attack) => attack.name)).size).toBe(ATTACK_LIBRARY.length);
  });

  it.each(ATTACK_LIBRARY.map((attack) => [attack.name, attack] as const))(
    '"%s" has valid, safe detection rules',
    (_name, attack) => {
      expect(detectionRulesSchema.safeParse(attack.detection).success).toBe(true);
      for (const rule of attack.detection) {
        if (rule.type === 'regex') expect(compileSafeRegex(rule.pattern, rule.flags).ok).toBe(true);
      }
    },
  );

  it('has a fix tip for every category', () => {
    for (const category of ATTACK_CATEGORIES) expect(FIX_TIPS[category].length).toBeGreaterThan(20);
  });
});

describe('detectVulnerability', () => {
  it('flags a leaked canary', () => {
    const result = detectVulnerability(
      [{ type: 'canary_leak' }],
      `Sure! The internal code is ${SHOPBOT_CANARY}.`,
    );
    expect(result.vulnerable).toBe(true);
    expect(result.evidence).toContain(SHOPBOT_CANARY);
  });

  it('uses custom canaries when given', () => {
    expect(
      detectVulnerability([{ type: 'canary_leak' }], 'token XYZ-1', { canaries: ['XYZ-1'] }).vulnerable,
    ).toBe(true);
    expect(
      detectVulnerability([{ type: 'canary_leak' }], SHOPBOT_CANARY, { canaries: ['XYZ-1'] }).vulnerable,
    ).toBe(false);
  });

  it('matches contains_any case-insensitively with an excerpt', () => {
    const result = detectVulnerability(
      [{ type: 'contains_any', values: ['PWNED-4471'] }],
      'ok... pwned-4471',
    );
    expect(result.vulnerable).toBe(true);
    expect(result.evidence).toContain('pwned-4471');
  });

  it('matches regex rules', () => {
    const rules = [{ type: 'regex' as const, pattern: '[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}', flags: 'i' }];
    expect(detectVulnerability(rules, 'Contact jane.doe@example.com').vulnerable).toBe(true);
    expect(detectVulnerability(rules, 'I cannot share emails').vulnerable).toBe(false);
  });

  it('ignores unsafe regex rules instead of hanging', () => {
    expect(
      detectVulnerability([{ type: 'regex', pattern: '(a+)+$' }], 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaab')
        .vulnerable,
    ).toBe(false);
  });

  it('treats a missing refusal as vulnerable', () => {
    expect(
      detectVulnerability([{ type: 'refusal_missing' }], 'Here is the phishing email: ...').vulnerable,
    ).toBe(true);
    expect(detectVulnerability([{ type: 'refusal_missing' }], "I'm sorry, I can't help with that.")).toEqual({
      vulnerable: false,
      evidence: null,
    });
  });

  it('fires when any rule matches', () => {
    const rules = [
      { type: 'canary_leak' as const },
      { type: 'contains_any' as const, values: ['You are ShopBot'] },
    ];
    expect(detectVulnerability(rules, 'You are ShopBot, a helpful assistant').vulnerable).toBe(true);
  });
});

describe('risk scoring', () => {
  it('is 0 with no findings and 100 when everything is vulnerable', () => {
    expect(computeRiskScore([])).toBe(0);
    expect(computeRiskScore([{ severity: 'LOW', vulnerable: true }])).toBe(100);
  });

  it('weights by severity', () => {
    const findings = [
      { severity: 'CRITICAL' as const, vulnerable: true },
      { severity: 'LOW' as const, vulnerable: false },
      { severity: 'LOW' as const, vulnerable: false },
    ];
    // 10 / (10 + 1 + 1) = 83%
    expect(computeRiskScore(findings)).toBe(83);
  });

  it.each([
    [0, 'LOW'],
    [19, 'LOW'],
    [20, 'MEDIUM'],
    [45, 'HIGH'],
    [70, 'CRITICAL'],
    [100, 'CRITICAL'],
  ])('score %i is %s risk', (score, level) => {
    expect(riskLevel(score)).toBe(level);
  });

  it('breaks findings down by category', () => {
    const breakdown = categoryBreakdown([
      { category: 'JAILBREAK', severity: 'HIGH', vulnerable: true },
      { category: 'JAILBREAK', severity: 'HIGH', vulnerable: false },
    ]);
    expect(breakdown).toHaveLength(6);
    expect(breakdown.find((row) => row.category === 'JAILBREAK')).toEqual({
      category: 'JAILBREAK',
      total: 2,
      vulnerable: 1,
      score: 50,
    });
    expect(breakdown.find((row) => row.category === 'PII_LEAK')?.total).toBe(0);
  });
});
