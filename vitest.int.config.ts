import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    passWithNoTests: true,
    include: ['tests/**/*.int.test.ts'],
    testTimeout: 180000,
    hookTimeout: 180000,
    fileParallelism: false,
  },
})

