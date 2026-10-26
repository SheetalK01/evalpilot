/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.module.ts',
    '!src/index.ts',
    '!src/config/load-env.ts',
  ],
  coverageReporters: ['text-summary', 'text', 'lcov', 'json-summary'],
  coverageThreshold: { global: { lines: 80, statements: 80, functions: 80, branches: 80 } },
};
