const base = require('../jest.config');

module.exports = {
  ...base,
  testEnvironment: 'node',
  reporters: ['default'],
  setupFiles: [],
  testMatch: ['<rootDir>/tests/unit/wiiicoin-network.test.ts', '<rootDir>/tests/integration/wiiicoin-live-smoke.test.ts'],
};
