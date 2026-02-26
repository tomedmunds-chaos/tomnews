import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testRegex: '.*\\.test\\.ts$',
  globals: {
    'ts-jest': {
      tsconfig: './tsconfig.test.json',
    },
  },
}

export default config
