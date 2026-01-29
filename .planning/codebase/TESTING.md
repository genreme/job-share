# Testing Patterns

**Analysis Date:** 2026-01-29

## Test Framework

**Runner:**
- No test framework configured
- Project uses: Node.js v18+ (ES modules)
- Scripts in `package.json` and `mcp-server/package.json` do not include test commands

**Assertion Library:**
- Not detected - no assertions library installed

**Run Commands:**
```bash
# No test commands configured
# Development uses manual testing and console logging
npm start              # Run server for manual testing
npm run dev            # Run with auto-reload
npm run mcp            # Run MCP server
npm run extract        # Extract jobs from dashboard
```

**Status:** Testing not yet formalized in this codebase. Development workflow appears to be manual testing through browser extension, server endpoints, and CLI tools.

## Test File Organization

**Location:**
- No test files exist in the codebase
- All test files in `node_modules/` are from dependencies (e.g., zod package tests)
- Project root has no `__tests__`, `tests/`, `spec/`, or `.test.js` files

**Naming Convention:**
- Not applicable (no tests)

**Structure:**
```
# Current structure (no tests):
job-search-command-center/
├── extension/          # Browser extension code
├── mcp-server/
│   └── src/
│       ├── tools/      # Tool implementations
│       ├── data/       # Data loaders
│       └── index.js    # Server entry
├── worker/             # Cloudflare worker code
├── server.js           # Local dev server
└── index.html          # Dashboard
```

## Code Testing Approaches Observed

**Manual Testing Patterns:**

1. **CLI-based Data Validation** (`mcp-server/extract-jobs.js`):
   - Script runs to extract jobs from HTML dashboard
   - Validates output by writing to JSON
   - Manual verification of JSON structure

2. **Browser Extension Testing** (`extension/`):
   - Manual testing by installing extension in Chrome
   - Content script extraction tested by navigating to job boards
   - DOM selector verification through browser console
   - Duplicate detection tested by adding same job multiple times

3. **Server Endpoint Testing** (`server.js`):
   - Local server runs on `http://localhost:3000`
   - Endpoints accessible via `curl` or browser requests
   - Manual verification of JSON responses
   - File sync tested by modifying `jobs.json` and checking refresh

4. **Worker Validation** (`worker/job-validator.js`):
   - Cloudflare Worker deployed and tested via HTTP
   - POST endpoints accept batch job URLs
   - Response structure validated manually
   - Status checking works for active/inactive postings

## Mocking

**Framework:**
- No mocking library installed (no `jest.mock()`, `sinon`, `testdouble`, etc.)
- Manual mocking would be needed for Chrome API, fetch, file system

**Patterns Observed in Code:**
- Fallback values used instead of mocks: `const data = await chrome.storage.local.get(STORAGE_KEY); const pending = (data[STORAGE_KEY] || {}).pendingJobs || [];`
- Default return values on error prevent crashes: `return { jobs: [], searchHistory: [], settings: {} }`
- No spies or stubs currently used

**What to Mock (if testing were added):**
- Chrome Storage API: `chrome.storage.local.get()`, `chrome.storage.local.set()`
- Chrome Runtime: `chrome.runtime.sendMessage()`, `chrome.tabs.query()`
- File System: `fs.readFileSync()`, `fs.writeFileSync()`, `fs.existsSync()`
- Network: `fetch()` calls to server and job board APIs
- DOM: Selectors in content scripts

**What NOT to Mock (test real interactions):**
- JSON parsing/stringification (core logic)
- Text normalization and similarity calculations
- File I/O patterns (atomic writes, temp files)
- Object transformations and filters

## Fixtures and Factories

**Test Data:**
- No fixture files exist currently
- Hard-coded configuration used instead: `FIT_CRITERIA` in `worker/job-validator.js`, job templates in `extension/background.js`

**Example of Current Inline Data (from `worker/job-validator.js`):**
```javascript
const FIT_CRITERIA = {
  titles: {
    exact: ['Creative Director', 'VP of Creative', 'VP Creative Services', ...],
    partial: ['Creative', 'Design', 'Brand', 'Visual', 'Art Director', ...]
  },
  industries: {
    preferred: ['healthcare', 'health', 'nonprofit', ...],
    acceptable: ['technology', 'saas', 'startup', ...]
  },
  locations: {
    preferred: ['boston', 'massachusetts', 'ma', 'remote', 'hybrid'],
    acceptable: ['new york', 'ny', 'northeast', ...]
  },
  salaryMin: 120000
};
```

**Location:**
- Configuration embedded in source files, not separated
- Would benefit from extraction to `test/fixtures/` if testing were formalized

## Coverage

**Requirements:**
- Not enforced - no coverage tooling installed
- Recommendation: Install coverage baseline (currently 0%)

**View Coverage:**
```bash
# Not currently possible - no test framework configured
# To add: npm install --save-dev jest
# Then: jest --coverage
```

## Test Types

**Unit Tests (not yet implemented):**
- Scope: Individual functions like `normalizeText()`, `calculateSimilarity()`, `extractJobDetails()`
- Approach: Test with known inputs, verify output shape and values
- Example candidates from `extension/background.js`:
  - `normalizeText()` - normalize various company/job formats
  - `calculateSimilarity()` - string similarity edge cases
  - `levenshteinDistance()` - edit distance calculation

**Integration Tests (not yet implemented):**
- Scope: File I/O with atomic writes, job data flow through system
- Approach: Create temp files, test read/write cycles, verify version tracking
- Example candidates from `mcp-server/src/tools/`:
  - `loadJobsFromDashboard()` + `updateJob()` + write cycle
  - `generateResume()` spawning Python process and creating PDF
  - Server endpoints receiving data, updating JSON, returning modified data

**E2E Tests (manual workflow currently):**
- Browser Extension: Install extension → Navigate to job board → Extract job → Check duplicate → Add to tracker
- MCP Server: Run server → Query jobs → Modify job → Verify in dashboard
- Worker: POST batch validation → Get fit scores → Check duplicates

## Common Patterns

**Async Testing:**
- Currently tested manually by waiting for operations
- If formalized, would test async patterns like:

```javascript
// Pattern in extension/popup.js - retrying with delays
let extractedData = null;
let attempts = 0;
const maxAttempts = 3;

while (!extractedData && attempts < maxAttempts) {
  attempts++;
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: extractJobData
  });

  if (results && results[0] && results[0].result) {
    extractedData = results[0].result;
    break;
  }

  if (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

**Error Testing:**
- Currently done by observing console errors and return values
- Pattern from `mcp-server/src/data/loader.js`:

```javascript
if (!existsSync(jsonPath)) {
  console.error('Jobs JSON not found. Run: cd mcp-server && node extract-jobs.js');
  return { jobs: [], searchHistory: [], settings: {} };
}

try {
  const content = readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(content);
  return data;
} catch (e) {
  console.error('Error loading jobs.json:', e.message);
  return { jobs: [], searchHistory: [], settings: {} };
}
```

If testing were formalized, would test:
- Missing files return default structure (not error throw)
- Invalid JSON returns default structure + error log
- Valid JSON parses correctly

## Recommended Testing Strategy

**Phase 1 - Foundation:**
```bash
npm install --save-dev jest @jest/globals
```

**Phase 2 - Core Utilities:**
- Test text normalization (`normalizeText()`)
- Test similarity calculation (`calculateSimilarity()`, `levenshteinDistance()`)
- Test fit score calculation (`calculateFitScore()`)
- Test duplicate detection logic

**Phase 3 - Data Layer:**
- Test file loading with various corrupted states
- Test atomic write safety
- Test version tracking
- Test job data transformations

**Phase 4 - Integration:**
- Test MCP tool functions with mock data
- Test server endpoint responses
- Test Chrome extension message passing (mock Chrome API)

**Test File Location:**
```
mcp-server/
├── src/
│   ├── tools/
│   │   ├── jobs.js
│   │   ├── jobs.test.js       # Add here
│   │   └── ...
│   └── __tests__/             # Or here for shared utilities
├── package.json               # Add "test": "jest"
```

## Validation & Quality Checks (Current)

**Manual Verification:**
1. Dashboard loads without errors (visual check)
2. Extension populates jobs without crashes (console.error check)
3. MCP server responds to tool calls (manual Claude Chat testing)
4. Server endpoints return valid JSON (curl/browser test)
5. Worker validates job URLs (Cloudflare dashboard logs)

**Logging for Debugging:**
- All errors logged to console with context
- `console.error()` used throughout for observability
- Extraction attempts logged with attempt number
- Data counts logged on load: `Loaded ${data.jobs?.length || 0} jobs from jobs.json`

---

*Testing analysis: 2026-01-29*
