import { BadRequestException } from '@nestjs/common';
import { csvTextFrom } from './suites.controller';
import { csvFileName } from './suites.service';

describe('csvFileName', () => {
  it.each([
    ['ShopBot core support', 'shopbot-core-support-cases.csv'],
    ['  Refunds / Returns (EU) ', 'refunds-returns-eu-cases.csv'],
    ['💥', 'suite-cases.csv'],
  ])('%j → %s', (name, expected) => {
    expect(csvFileName(name)).toBe(expected);
  });
});

describe('csvTextFrom', () => {
  it('accepts raw text or { csv }', () => {
    expect(csvTextFrom('a,b')).toBe('a,b');
    expect(csvTextFrom({ csv: 'a,b' })).toBe('a,b');
  });

  it.each([[''], [{}], [null], [42]])('rejects %j', (body) => {
    expect(() => csvTextFrom(body)).toThrow(BadRequestException);
  });
});
