/** @type {import('jest').Config} */
module.exports = {
   moduleFileExtensions: ['js', 'json', 'ts'],
   rootDir: '.',
   testRegex: '.*\\.spec\\.ts$',
   transform: {
      '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }],
   },
   testEnvironment: 'node',
   testPathIgnorePatterns: ['\\.e2e-spec\\.ts$', '/dist/'],
   collectCoverageFrom: ['src/**/*.ts'],
   coveragePathIgnorePatterns: ['/node_modules/', '/graphql/@generated/'],
};
