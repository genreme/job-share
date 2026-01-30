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
      // Coverage thresholds - baseline set 2026-01-29
      // Gap closure: Phase 1 verification found 70% unreachable with current untested files
      // Current coverage: ~21% statements, ~17% branches, ~36% functions, ~21% lines
      // Target: Increase to 70% by end of Phase 3 as more files get tested
      // Note: Increase thresholds after each phase that adds significant test coverage
      thresholds: {
        lines: 20,
        functions: 35,
        branches: 15,
        statements: 20
      }
    },

    // Watch mode settings
    watch: true,
    watchExclude: ['**/node_modules/**', '**/test-reports/**'],

    // Globals (require explicit imports for safety)
    globals: false
  }
})
