# Phase 1: QA Layer Foundation - Research

**Researched:** 2026-01-29
**Domain:** JavaScript testing frameworks, schema validation, UI testing, CI/CD integration
**Confidence:** HIGH

## Summary

This phase establishes a self-testing framework for the Job Search Command Center using Vitest as the test runner. The codebase is a vanilla JavaScript ES modules project with Node.js backend (server.js, MCP server), a Chrome extension, and a single-page HTML dashboard. There are currently no tests in place.

The standard approach is to use Vitest with v8 coverage, happy-dom for DOM testing, and Zod for schema validation. Vitest offers native ESM support (critical since the project uses `"type": "module"`), fast execution, Jest-compatible API, and built-in coverage via v8. The HTML reporter with @vitest/ui provides browsable test results as required.

**Primary recommendation:** Install Vitest with @vitest/ui and @vitest/coverage-v8, configure colocated test files (*.test.js next to source files), set coverage thresholds at 70% for initial baseline, and create a GitHub Actions workflow that blocks PRs on test failure.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^3.0.0 | Test runner | Native ESM, fast, Vite-powered, Jest-compatible API |
| @vitest/ui | ^3.0.0 | HTML reports | Interactive test results browser, required for html reporter |
| @vitest/coverage-v8 | ^3.0.0 | Code coverage | Fast v8-based coverage with AST remapping (accurate since v3.2.0) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| happy-dom | ^17.0.0 | DOM simulation | Fast DOM testing for dashboard UI components |
| zod | ^3.24.0 | Schema validation | Runtime validation of job data, MCP inputs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | Jest | Jest has broader ecosystem but slower, no native ESM |
| happy-dom | jsdom | jsdom more complete but 5-10x slower |
| v8 coverage | istanbul | istanbul works everywhere but slower execution |
| Zod | Joi/Yup | Zod has better TypeScript inference, smaller bundle |

**Installation:**
```bash
npm install -D vitest @vitest/ui @vitest/coverage-v8 happy-dom zod
```

## Architecture Patterns

### Recommended Project Structure
```
job-search-command-center/
├── vitest.config.js         # Test configuration
├── package.json             # Add test scripts
├── .github/
│   └── workflows/
│       └── ci.yml           # GitHub Actions workflow
├── mcp-server/
│   └── src/
│       ├── tools/
│       │   ├── jobs.js
│       │   ├── jobs.test.js       # Colocated tests
│       │   ├── updates.js
│       │   └── updates.test.js
│       └── data/
│           ├── loader.js
│           └── loader.test.js
├── server.js
├── server.test.js                   # Server endpoint tests
├── schemas/                         # NEW: Validation schemas
│   ├── job.schema.js
│   └── job.schema.test.js
└── test/
    ├── fixtures/                    # Shared test data
    │   ├── valid-job.json
    │   └── invalid-jobs.json
    └── setup.js                     # Global test setup
```

### Pattern 1: Colocated Test Files
**What:** Place test files adjacent to source files with `.test.js` suffix
**When to use:** Default for all unit and integration tests
**Example:**
```javascript
// mcp-server/src/tools/jobs.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getJobs, getJobDetail, getApplicationStats } from './jobs.js'

// Mock the loader to avoid file system dependencies
vi.mock('../data/loader.js', () => ({
  loadJobsFromDashboard: vi.fn()
}))

import { loadJobsFromDashboard } from '../data/loader.js'

describe('getJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when no jobs exist', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: [] })
    const result = getJobs()
    expect(result).toEqual([])
  })

  it('filters by status', () => {
    loadJobsFromDashboard.mockReturnValue({
      jobs: [
        { id: 1, status: 'apply-now', fitScore: 90 },
        { id: 2, status: 'applied', fitScore: 80 }
      ]
    })
    const result = getJobs({ status: 'apply-now' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
  })
})
```

### Pattern 2: Schema Validation with Zod
**What:** Define schemas for job data structure, validate at boundaries
**When to use:** Validating data from JSON files, API inputs, extension messages
**Example:**
```javascript
// schemas/job.schema.js
import { z } from 'zod'

export const JobStatusSchema = z.enum([
  'apply-now',
  'maybe',
  'probably-not',
  'applied',
  'archived'
])

export const ConnectionSchema = z.union([
  z.string(), // Legacy format: "Name (notes)"
  z.object({
    name: z.string(),
    role: z.string().optional(),
    linkedIn: z.string().optional(),
    notes: z.string().optional(),
    isPrimary: z.boolean().optional(),
    reachedOut: z.boolean().optional()
  })
])

export const JobSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  company: z.string().min(1),
  industry: z.string().optional(),
  location: z.string().optional(),
  salary: z.string().optional(),
  fitScore: z.number().min(0).max(100),
  status: JobStatusSchema,
  posted: z.string().optional(),
  found: z.string().optional(),
  applied: z.string().nullable().optional(),
  followup: z.string().nullable().optional(),
  url: z.string().url(),
  symbols: z.array(z.string()).optional(),
  connections: z.array(ConnectionSchema).optional(),
  sources: z.array(z.string()).optional(),
  notes: z.string().optional(),
  updates: z.array(z.object({
    date: z.string().optional(),
    timestamp: z.string().optional(),
    type: z.string(),
    notes: z.string().optional(),
    text: z.string().optional()
  })).optional()
})

export const JobsDataSchema = z.object({
  jobs: z.array(JobSchema),
  searchHistory: z.array(z.any()).optional(),
  settings: z.object({}).passthrough().optional(),
  version: z.number().optional(),
  lastUpdated: z.string().optional()
})

// Advisory validation function (warn and continue)
export function validateJobsData(data, options = { mode: 'advisory' }) {
  const result = JobsDataSchema.safeParse(data)
  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      received: issue.received
    }))

    if (options.mode === 'advisory') {
      console.warn('Schema validation warnings:', errors)
      return { valid: false, errors, data } // Return original data
    }
    throw new Error(`Schema validation failed: ${JSON.stringify(errors)}`)
  }
  return { valid: true, errors: [], data: result.data }
}
```

### Pattern 3: DOM Testing with happy-dom
**What:** Test UI rendering without a browser using happy-dom environment
**When to use:** Testing dashboard rendering logic, component behavior
**Example:**
```javascript
// dashboard.test.js
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'

describe('Dashboard Rendering', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="job-table-body"></div>
      <div class="stat-value" id="total-jobs">0</div>
    `
  })

  it('renders job row with correct status class', () => {
    const job = {
      id: 1,
      title: 'Creative Director',
      company: 'Acme Corp',
      status: 'apply-now',
      fitScore: 95
    }

    // Simulate the rendering logic from index.html
    const row = document.createElement('tr')
    row.className = `status-${job.status}`
    row.innerHTML = `<td>${job.title}</td><td>${job.company}</td>`
    document.getElementById('job-table-body').appendChild(row)

    expect(row.classList.contains('status-apply-now')).toBe(true)
  })
})
```

### Pattern 4: Snapshot Testing for UI
**What:** Capture and compare HTML output over time
**When to use:** Detecting unintended UI changes, regression testing
**Example:**
```javascript
// ui-snapshots.test.js
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'

describe('Job Card Rendering', () => {
  it('matches snapshot for high-fit job', () => {
    const job = {
      id: 1,
      title: 'VP, Creative',
      company: 'Media Cause',
      fitScore: 98,
      status: 'apply-now',
      symbols: ['🔥', '💰']
    }

    const html = renderJobCard(job)
    expect(html).toMatchSnapshot()
  })
})
```

### Anti-Patterns to Avoid
- **Testing implementation details:** Test behavior, not internal state. If refactoring breaks tests but not functionality, tests are too coupled.
- **Mocking too much:** Only mock I/O boundaries (file system, network). Test real logic.
- **Snapshot overuse:** Don't snapshot large dynamic objects. Use for stable UI structures only.
- **Shared mutable state:** Reset mocks and DOM between tests with beforeEach.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | Custom if/typeof checks | Zod | Handles nested objects, arrays, unions, error messages |
| DOM testing | Manual innerHTML assertions | happy-dom + Testing Library patterns | Handles events, async updates, accessibility |
| Coverage tracking | Line counting scripts | @vitest/coverage-v8 | Source map aware, threshold enforcement built-in |
| Test isolation | Manual cleanup | Vitest isolation modes | Handles module cache, global state automatically |
| HTML reports | Custom report generator | @vitest/ui html reporter | Interactive, filterable, includes coverage iframe |

**Key insight:** The testing ecosystem has solved these problems with edge cases you won't anticipate. Schema validation alone has 20+ edge cases (null vs undefined, array length, nested errors, custom error messages) that Zod handles.

## Common Pitfalls

### Pitfall 1: ES Module Mocking
**What goes wrong:** `vi.mock()` doesn't work as expected with ES modules
**Why it happens:** ES modules are statically analyzed; hoisting behavior differs from CommonJS
**How to avoid:** Always put `vi.mock()` at top of file (before imports), use `vi.fn()` for individual function mocks
**Warning signs:** "Cannot access X before initialization" errors, mocks not being applied

### Pitfall 2: Async Test Timing
**What goes wrong:** Tests pass/fail intermittently, "Cannot read property of undefined"
**Why it happens:** Not awaiting async operations, DOM updates not flushed
**How to avoid:** Always `await` async calls, use `vi.waitFor()` for DOM updates
**Warning signs:** Tests pass locally but fail in CI, different results on re-run

### Pitfall 3: File System Tests Without Isolation
**What goes wrong:** Tests corrupt real data files, tests depend on order
**Why it happens:** Testing against actual jobs.json instead of fixtures
**How to avoid:** Mock file system operations, use temp directories, reset state in beforeEach
**Warning signs:** Tests fail when run individually, data files modified after test run

### Pitfall 4: Coverage Threshold Too Aggressive
**What goes wrong:** Developers skip writing tests for edge cases, disable coverage
**Why it happens:** 100% coverage requirement creates perverse incentives
**How to avoid:** Start at 70%, increase as codebase stabilizes, exclude generated/config files
**Warning signs:** Tests that just call functions without meaningful assertions

### Pitfall 5: Snapshot Blindness
**What goes wrong:** Snapshots updated without review, bugs slip through
**Why it happens:** Pressing "u" to update all snapshots without reading diffs
**How to avoid:** Review diffs in PRs, use small focused snapshots, prefer explicit assertions
**Warning signs:** Snapshot files with thousands of lines, frequent snapshot updates

## Code Examples

Verified patterns from official sources:

### Vitest Configuration
```javascript
// vitest.config.js
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
        branches: 60,
        statements: 70
      }
    },

    // Watch mode settings
    watch: true,
    watchExclude: ['**/node_modules/**', '**/test-reports/**'],

    // Globals (optional - require explicit imports is safer)
    globals: false
  }
})
```

### GitHub Actions CI Workflow
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: npm run test:ci

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: test-reports/coverage/
          retention-days: 7

      - name: Upload HTML report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-report
          path: test-reports/index.html
          retention-days: 7
```

### Package.json Scripts
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:ci": "vitest run --coverage --reporter=default --reporter=github-actions",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

### MCP Tool Test Example
```javascript
// mcp-server/src/tools/updates.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { updateJob, archiveJob, addJobNote } from './updates.js'
import * as fs from 'fs'
import * as os from 'os'

// Mock file system
vi.mock('fs')
vi.mock('os', () => ({
  tmpdir: vi.fn(() => '/tmp')
}))

describe('updateJob', () => {
  const mockJobsData = {
    jobs: [
      { id: 1, title: 'Test Job', company: 'Test Co', status: 'apply-now', fitScore: 80 }
    ],
    version: 1
  }

  beforeEach(() => {
    vi.clearAllMocks()
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify(mockJobsData))
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})
  })

  it('updates job fields and increments version', () => {
    const result = updateJob(1, { fitScore: 90, salary: '$150k' })

    expect(result.success).toBe(true)
    expect(result.changedFields).toHaveLength(2)
    expect(result.job.fitScore).toBe(90)
    expect(result.job.salary).toBe('$150k')
  })

  it('returns error for non-existent job', () => {
    const result = updateJob(999, { fitScore: 90 })

    expect(result.error).toContain('not found')
  })

  it('returns no changes when values are same', () => {
    const result = updateJob(1, { fitScore: 80 })

    expect(result.success).toBe(true)
    expect(result.message).toBe('No changes needed')
  })

  it('adds update entry to job history', () => {
    const result = updateJob(1, { notes: 'Updated notes' })

    expect(result.job.updates).toBeDefined()
    expect(result.job.updates[0].type).toBe('MCP Update')
  })
})

describe('archiveJob', () => {
  it('changes status to archived and adds history entry', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify({
      jobs: [{ id: 1, status: 'apply-now', updates: [] }],
      version: 1
    }))

    const result = archiveJob(1, 'Position filled')

    expect(result.success).toBe(true)
    expect(result.previousStatus).toBe('apply-now')
    expect(result.job.status).toBe('archived')
  })
})
```

### Workflow Logic Tests (Status Transitions)
```javascript
// schemas/workflow.test.js
import { describe, it, expect } from 'vitest'

// Valid status transitions for the job workflow
const VALID_TRANSITIONS = {
  'apply-now': ['maybe', 'probably-not', 'applied', 'archived'],
  'maybe': ['apply-now', 'probably-not', 'applied', 'archived'],
  'probably-not': ['maybe', 'apply-now', 'archived'],
  'applied': ['archived'], // Can only archive after applying
  'archived': [] // Terminal state
}

function isValidTransition(fromStatus, toStatus) {
  return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false
}

describe('Job Status Workflow', () => {
  describe('valid transitions', () => {
    it('allows apply-now to applied', () => {
      expect(isValidTransition('apply-now', 'applied')).toBe(true)
    })

    it('allows maybe to apply-now (promotion)', () => {
      expect(isValidTransition('maybe', 'apply-now')).toBe(true)
    })

    it('allows applied to archived', () => {
      expect(isValidTransition('applied', 'archived')).toBe(true)
    })
  })

  describe('invalid transitions', () => {
    it('blocks archived to any other state', () => {
      expect(isValidTransition('archived', 'apply-now')).toBe(false)
      expect(isValidTransition('archived', 'applied')).toBe(false)
    })

    it('blocks applied to non-archived states', () => {
      expect(isValidTransition('applied', 'maybe')).toBe(false)
      expect(isValidTransition('applied', 'apply-now')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('handles unknown status gracefully', () => {
      expect(isValidTransition('unknown', 'applied')).toBe(false)
    })

    it('handles self-transition', () => {
      expect(isValidTransition('apply-now', 'apply-now')).toBe(false)
    })
  })
})
```

### Phase Gating via npm Scripts
```json
{
  "scripts": {
    "preversion": "npm run test:ci",
    "phase:complete": "npm run test:ci && echo 'Phase complete - all tests passed'"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest for testing | Vitest for Vite/ESM projects | 2022-2023 | 10x faster, native ESM |
| istanbul coverage | v8 coverage with AST remapping | Vitest v3.2.0 (2025) | Same accuracy, faster execution |
| jsdom for all DOM tests | happy-dom for speed, jsdom for completeness | 2023 | Significant test suite speedup |
| Separate test folders | Colocated tests | Current convention | Better discoverability, easier maintenance |

**Deprecated/outdated:**
- Jest with experimental ESM: Vitest handles ESM natively without flags
- Manual coverage scripts: Built-in coverage with v8 provider
- Karma/Mocha for browser testing: Vitest browser mode or happy-dom

## Open Questions

Things that couldn't be fully resolved:

1. **Extension testing approach**
   - What we know: Extension code uses Chrome APIs (chrome.storage, chrome.runtime)
   - What's unclear: Best approach for mocking Chrome APIs in Vitest vs testing in real browser
   - Recommendation: Exclude extension from Phase 1 coverage; consider webextension-polyfill for future

2. **Dashboard snapshot granularity**
   - What we know: Dashboard is a single large HTML file with embedded JS
   - What's unclear: How to extract testable functions vs testing full HTML rendering
   - Recommendation: Start with snapshot tests for rendered job rows; refactor if needed

3. **MCP Server integration testing**
   - What we know: MCP uses stdio transport, difficult to test end-to-end
   - What's unclear: Whether to test through MCP protocol or just unit test tool functions
   - Recommendation: Unit test tool functions directly; integration tests optional

## Sources

### Primary (HIGH confidence)
- [Vitest Official Guide](https://vitest.dev/guide/) - Getting started, configuration
- [Vitest Config Reference](https://vitest.dev/config/) - Configuration options
- [Vitest Coverage Guide](https://vitest.dev/guide/coverage) - Coverage setup
- [Vitest Reporters Guide](https://vitest.dev/guide/reporters) - HTML reporter setup
- [Vitest Snapshot Guide](https://vitest.dev/guide/snapshot) - Snapshot testing
- [Zod Documentation](https://zod.dev/) - Schema validation

### Secondary (MEDIUM confidence)
- [GitHub vitest-dev/vitest](https://github.com/vitest-dev/vitest) - Source, issues, discussions
- [npm-version Documentation](https://docs.npmjs.com/cli/v6/commands/npm-version/) - Preversion scripts
- [MCP Best Practices](https://modelcontextprotocol.info/docs/best-practices/) - Testing strategies

### Tertiary (LOW confidence)
- Various blog posts on Vitest configuration (cross-referenced with official docs)
- Community discussions on jsdom vs happy-dom performance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vitest is established, well-documented, actively maintained
- Architecture: HIGH - Colocated tests and Zod schemas are industry standard
- Pitfalls: MEDIUM - Based on general testing experience, some Vitest-specific from GitHub issues

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (Vitest evolves quickly; check for major version changes)
