/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@app/(.*)$': '<rootDir>/src/app/$1',
    '^@ui/(.*)$': '<rootDir>/src/ui/$1',
  },
  clearMocks: true,
}
