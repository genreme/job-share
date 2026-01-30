import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Test discovery
    include: ['**/*.test.js'],
    exclude: ['**/node_modules/**', '**/extension/**'],

    // Environment
    environment: 'node', // Default; override per-file with @vitest-environment

    // Reporting
    reporters: ['default', 'html'],
    outputFile: {
      html: './test-reports/index.html'
    },

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './test-reports/coverage',
      include: [
        'mcp-server/src/**/*.js',
        'server.js',
        'schemas/**/*.js'
      ],
      exclude: [
        '**/*.test.js',
        '**/node_modules/**',
        'extension/**'
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70
      }
    },

    // Watch mode settings
    watch: true,
    watchExclude: ['**/node_modules/**', '**/test-reports/**'],

    // Globals (require explicit imports for safety)
    globals: false
  }
})
