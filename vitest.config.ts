import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [],
    testTimeout: 10000,
    // Clean output configuration
    reporters: ['verbose'],
    // Suppress logger output during tests
    env: {
      LOG_LEVEL: 'error',
      NODE_ENV: 'test'
    },
    coverage: {
      provider: 'v8',
      include: [
        'src/**/*.ts',
        '!src/**/*.test.ts',
        '!src/**/*.spec.ts',
        '!src/**/__tests__/**',
        '!src/types.ts',
        '!src/client-example.ts',
        '!src/undici-resilience/**/*.ts'
      ],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        '**/*.spec.ts',
        'src/client-example.ts',
        'src/types.ts',
        'src/undici-resilience/**'
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 80,
          statements: 80
        }
      },
      // Show coverage summary in a cleaner format
      reportOnFailure: true,
      all: true,
      // Enhanced coverage reporting
      reporter: [
        ['text', {
          skipFull: false,
          skipEmpty: true,
          file: undefined
        }],
        ['text-summary', {
          file: undefined
        }],
        'lcov',
        'html'
      ]
    }
  }
})
