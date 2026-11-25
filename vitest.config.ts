import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    passWithNoTests: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/**/*.int.test.ts', 'node_modules/**'],
    testTimeout: 30000,
  },
})

