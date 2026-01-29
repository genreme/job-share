# Coding Conventions

**Analysis Date:** 2026-01-29

## Naming Patterns

**Files:**
- Descriptive lowercase with hyphens for multi-word names: `job-validator.js`, `cover-letter.html`
- Utility/module files use camelCase within tool directories: `loader.js`, `documents.js`, `jobs.js`, `updates.js`, `resume.js`
- HTML files use descriptive names: `index.html`, `popup.html`, `submit-job.html`

**Functions:**
- camelCase for all function names
- Descriptive verbs at start: `readJobsData()`, `checkDuplicate()`, `extractJobDetails()`, `calculateFitScore()`, `normalizeText()`
- Helper/utility functions documented with block comments
- Exported functions are primary (getters first, then mutations)

**Variables:**
- camelCase for all variables and constants
- UPPER_CASE for configuration objects and constants: `STORAGE_KEY`, `MIME_TYPES`, `FIT_CRITERIA`, `CAREERS_PATTERNS`, `corsHeaders`
- Descriptive names that reflect content: `extractedJob`, `serverRunning`, `duplicateJob`, `pendingJobs`, `allJobs`
- Prefixes indicate type: `has*` for booleans (`hasInterview`, `hasOffer`, `hasRejection`), `is*` for state (`isApplied`, `isActive`)

**Types:**
- No TypeScript - pure JavaScript
- JSDoc comments used for parameter types and return types
- Objects use descriptive property names: `{ jobId, title, company, status, fitScore, connections }`

## Code Style

**Formatting:**
- No formal linter configured (no `.eslintrc` or `.prettierrc`)
- Consistent 2-space indentation throughout
- Double quotes for strings (not single quotes)
- Semicolons used at end of statements
- Arrow functions used in callbacks: `(a, b) => { return ... }`
- Traditional `function` keyword for named functions and exports

**Linting:**
- Not configured - manual code review standard
- No pre-commit hooks detected
- Code review via manual inspection

## Import Organization

**Order:**
1. Built-in Node modules: `import http from 'http'`, `import fs from 'fs'`, `import path from 'path'`
2. External dependencies: `import { Server } from '@modelcontextprotocol/sdk/server/index.js'`
3. Local imports (tools, data, utilities): `import { loadJobsFromDashboard } from '../data/loader.js'`

**Path Aliases:**
- File-based path resolution using `import.meta.url` and `path.dirname(fileURLToPath())`
- Absolute paths computed at module load: `const __dirname = path.dirname(fileURLToPath(import.meta.url))`
- Relative paths using `..` for parent traversal: `join(__dirname, '..', '..', '..')`
- No babel aliases or import paths configured

## Error Handling

**Patterns:**
- Try-catch blocks for file I/O and JSON parsing: `try { ... } catch (err) { console.error(...); return defaultValue; }`
- Graceful degradation on error - return sensible defaults rather than throwing
- Error objects contain message property for debugging: `err.message`
- Errors logged to console with context: `console.error('Error reading jobs.json:', err.message)`

**API Response Pattern:**
```javascript
// Success responses
{ success: true, data: {...}, message: 'Description' }
{ id: ..., title: ..., company: ... }

// Error responses
{ error: 'Error message', timestamp: new Date().toISOString() }
{ error: 'Job with ID 123 not found' }
```

**Example from `server.js`:**
```javascript
function sendError(res, message, status = 500) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify({ error: message, timestamp: new Date().toISOString() }));
}
```

## Logging

**Framework:** `console` object only (no external logging library)

**Patterns:**
- `console.error()` for error conditions and informational logging: `console.error('Error reading jobs.json:', err.message)`
- `console.log()` not typically used - errors take precedence
- Logs include: error messages, file paths, counts of loaded data, extraction attempts
- All console calls in non-critical paths (development/debugging)

**Examples:**
```javascript
console.error('Jobs JSON not found. Run: cd mcp-server && node extract-jobs.js');
console.error(`Loaded ${data.jobs?.length || 0} jobs from jobs.json`);
console.log(`JSCC: Extraction attempt ${attempts}/${maxAttempts}`);
```

## Comments

**When to Comment:**
- Block comments (/* */) for section headers and major logical breaks
- Inline comments for non-obvious algorithms or complex logic
- Comments explain WHY, not WHAT (code structure is clear)

**Pattern:**
```javascript
// =====================================================
// SECTION NAME
// =====================================================

/**
 * Function description
 * @param {type} paramName - What it is
 * @returns {type} What it returns
 */
function myFunction(paramName) {
  // Implementation detail explanation here
}
```

**JSDoc/TSDoc:**
- Used for exported functions and public APIs
- Includes `@param` tags with type and description
- Includes `@returns` tag with type and description
- Example from `mcp-server/src/tools/updates.js`:
```javascript
/**
 * Update a job's fields
 * @param {number} jobId - The job ID to update
 * @param {object} updates - Object with field:value pairs to update
 * @returns {object} Result with updated job
 */
export function updateJob(jobId, updates) { ... }
```

## Function Design

**Size:**
- Functions typically 20-80 lines
- Longer functions broken down with clear section comments
- Utilities like `atomicWriteSync()` are focused single-purpose helpers (10-15 lines)

**Parameters:**
- Named parameters with defaults where applicable: `function getJobs(options = {})`
- Destructuring used for option objects: `const { status, minFitScore, maxResults = 50 } = options`
- Positional parameters for simple cases, objects for complex: `updateJob(jobId, updates)` vs `validateJob(jobUrl, existingJobs = [])`

**Return Values:**
- Consistent object shapes - always return object with `{ success, data, error }` or domain objects
- Return `null` for "not found" cases: `return findDuplicate(job, allJobs)` returns existing or `null`
- Return default structures on error: `return { jobs: [], searchHistory: [], settings: {} }`
- Prefer returning computed/enriched objects over mutation

**Example from `mcp-server/src/tools/jobs.js`:**
```javascript
export function getJobs(options = {}) {
  const { status, minFitScore, maxResults = 50 } = options;
  const data = loadJobsFromDashboard();

  let jobs = data.jobs || [];

  if (status) {
    jobs = jobs.filter(j => j.status === status);
  }

  if (minFitScore) {
    jobs = jobs.filter(j => (j.fitScore || 0) >= minFitScore);
  }

  jobs.sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0));
  jobs = jobs.slice(0, maxResults);

  return jobs.map(j => ({
    id: j.id,
    title: j.title,
    company: j.company,
    // ... mapped fields
  }));
}
```

## Module Design

**Exports:**
- Named exports for all public functions: `export function getJobs(options) { ... }`
- No default exports used
- Tool modules export multiple related functions: `jobs.js` exports `getJobs`, `getJobDetail`, `getJobsByCompany`, etc.

**Barrel Files:**
- Not used - each tool file imported explicitly
- Imports structured by semantic domain: `from './tools/jobs.js'`, `from './tools/resume.js'`, `from './tools/documents.js'`

## Shared Patterns

**Atomic File Operations:**
Used throughout for data safety - prevents corruption from crashes mid-write:
```javascript
function atomicWriteSync(filePath, data) {
  const tempPath = path.join(os.tmpdir(), `jscc-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  try {
    fs.writeFileSync(tempPath, data, 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    try { fs.unlinkSync(tempPath); } catch (e) { /* ignore */ }
    throw err;
  }
}
```

**Version Tracking:**
Applied to data structures on write:
```javascript
function saveJobsData(data) {
  data.lastUpdated = new Date().toISOString();
  data.version = (data.version || 0) + 1;
  atomicWriteSync(JOBS_JSON_PATH, JSON.stringify(data, null, 2));
  return data;
}
```

**Normalization Helpers:**
Text normalization for duplicate detection:
```javascript
function normalizeText(text) {
  return (text || '').toLowerCase().replace(/[^\w\s]/g, '').trim();
}
```

---

*Convention analysis: 2026-01-29*
