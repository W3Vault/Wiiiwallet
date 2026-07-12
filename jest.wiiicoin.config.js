module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        diagnostics: true,
      },
    ],
  },
  testTimeout: 180000,
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
};
