/** Two Jest projects: fast unit tests next to the code, and integration tests against MySQL + Redis. */
const base = {
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    { ...base, displayName: 'unit', rootDir: __dirname, testMatch: ['<rootDir>/src/**/*.spec.ts'] },
    {
      ...base,
      displayName: 'integration',
      rootDir: __dirname,
      testMatch: ['<rootDir>/test/integration/**/*.int-spec.ts'],
      globalSetup: '<rootDir>/test/global-setup.ts',
      setupFiles: ['<rootDir>/test/setup-env.ts'],
    },
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!src/healthcheck.ts',
    '!src/config/load-env.ts',
    '!src/**/*.module.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.dto.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'text', 'lcov', 'json-summary'],
  coverageThreshold: { global: { lines: 80, statements: 80, functions: 80, branches: 80 } },
};
