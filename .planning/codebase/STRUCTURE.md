# Codebase Structure

**Analysis Date:** 2026-01-29

## Directory Layout

```
Job Search Command Center/
├── extension/                          # Chrome extension source
│   ├── background.js                   # Service worker (duplicate detection, sync)
│   ├── content.js                      # Content script (job board extraction)
│   ├── popup.js                        # Popup UI and logic
│   ├── popup.html                      # Popup template
│   ├── content.css                     # Content script styling
│   ├── manifest.json                   # Extension manifest
│   └── icons/                          # Extension icon assets
├── mcp-server/                         # Claude MCP server integration
│   ├── src/
│   │   ├── index.js                    # MCP server initialization
│   │   ├── data/
│   │   │   ├── loader.js               # Data loading from files and resume directories
│   │   │   └── schema.md               # Job/learning data structure documentation
│   │   └── tools/
│   │       ├── jobs.js                 # Job query tools (getJobs, getJobDetail, etc.)
│   │       ├── resume.js               # Resume data access tools
│   │       ├── documents.js            # Document generation tools
│   │       └── updates.js              # Job update tools (updateJob, archiveJob, etc.)
│   ├── data/
│   │   ├── jobs.json                   # Job records (primary data store)
│   │   ├── learning-log.json           # Claude preferences and learning history
│   │   └── learning.json               # Legacy learning data format
│   ├── extract-jobs.js                 # Extract jobs from index.html into jobs.json
│   └── node_modules/                   # Dependencies (generated)
├── worker/                             # Cloudflare Workers scripts
│   ├── job-validator.js                # Validation logic for job submissions
│   ├── wrangler.toml                   # Wrangler configuration
│   └── README.md                       # Worker documentation
├── docs/                               # Documentation files
├── data/                               # Local data exports/backups
├── backups/                            # Job data backups
├── archive/                            # Previous versions of UI
├── server.js                           # Main development server (HTTP API)
├── index.html                          # Dashboard main page (large embedded SPA)
├── job-submission-form.html            # Alternative submission form view
├── submit-job.html                     # Submission workflow page
├── package.json                        # NPM scripts and metadata
└── .planning/
    └── codebase/                       # GSD planning documents (this file here)
```

## Directory Purposes

**`extension/`:**
- Purpose: Chrome extension source code for job board integration
- Contains: Content scripts (extraction), background service worker, popup UI
- Key files: `content.js` (board detection and extraction logic), `background.js` (sync and duplicate detection), `manifest.json` (permissions and host matches)
- Connection: Posts jobs to `/api/jobs`, reads from server for duplicate checking

**`mcp-server/src/`:**
- Purpose: Claude MCP (Model Context Protocol) server exposing job tools to Claude Chat
- Contains: Tool implementations, data loaders, schema definitions
- Key files: `index.js` (server setup and tool routing), `tools/*.js` (tool implementations)
- Connection: Reads from data/jobs.json, exposes tools via stdio to Claude

**`mcp-server/data/`:**
- Purpose: Central job and learning data store
- Contains: `jobs.json` (primary job records), `learning-log.json` (Claude preferences)
- Key files: All JSON files are atomic-write protected
- Access pattern: Loaded by server.js, MCP tools, and extension sync layer

**`server.js`:**
- Purpose: HTTP REST API server serving dashboard and handling data updates
- Contains: 20+ endpoints for jobs, documents, analytics, learning
- Key responsibilities: Serve index.html, handle `/api/jobs` CRUD, manage file I/O
- Connection: Central hub for dashboard, extension, MCP server data access

**`index.html`:**
- Purpose: Single-page dashboard application (large embedded HTML file)
- Contains: All CSS and JavaScript inline; tab-based job interface
- Key features: Job filtering by status, fit score display, analytics, inbox management
- Connection: Loaded from server.js root path, calls `/api/*` endpoints

**`worker/`:**
- Purpose: Cloudflare Workers deployment (optional background validation)
- Contains: Validation logic for incoming job submissions
- Connection: Independent from main application, can validate jobs before server processing

## Key File Locations

**Entry Points:**
- `server.js`: Main HTTP server (run with `npm start`)
- `mcp-server/src/index.js`: MCP server for Claude integration (run with `npm run mcp`)
- `extension/manifest.json`: Browser extension definition
- `index.html`: Dashboard SPA (served at http://localhost:3000/)

**Configuration:**
- `package.json`: NPM scripts and project metadata
- `extension/manifest.json`: Chrome extension permissions and board matches
- `mcp-server/data/schema.md`: Job and learning data structure documentation

**Core Logic:**
- `extension/content.js`: Job board detection and extraction (multiple board handlers)
- `extension/background.js`: Duplicate detection algorithm, server sync logic
- `server.js`: API routing and file I/O (lines 200-850)
- `mcp-server/src/tools/*.js`: Tool implementations for Claude integration

**Data Access Layer:**
- `mcp-server/src/data/loader.js`: Centralized data loading (jobs, resume, learning data)
- `server.js`: Data read/write functions with atomic write pattern

**Testing:**
- `worker/job-validator.js`: Contains validation logic that could be unit tested
- No test suite currently present; validation is inline

## Naming Conventions

**Files:**
- Kebab-case for file names: `job-submission-form.html`, `job-validator.js`, `cover-letter.js`
- Camel case for JavaScript class/module files: `background.js`, `content.js`
- Snake_case for data files: `jobs.json`, `learning-log.json`, `resume_data_v9_1.json`

**Directories:**
- Lower-case, plural for logical groupings: `extension/`, `mcp-server/`, `worker/`, `docs/`
- Short, descriptive names reflecting purpose

**Functions:**
- Camel case: `readJobsData()`, `atomicWriteSync()`, `checkDuplicate()`, `extractJobData()`
- Verb prefix for actions: `get*`, `set*`, `check*`, `extract*`, `update*`, `save*`
- Boolean functions: `has*`, `is*`, `check*` prefix

**Variables:**
- Camel case: `jobId`, `fitScore`, `extractedJob`, `serverRunning`
- Constants in UPPER_SNAKE_CASE: `STORAGE_KEY`, `API_URL`, `JOBS_JSON_PATH`
- Collection variables typically plural: `jobs`, `connections`, `documents`

**Types/Interfaces:**
- Job objects standardized: `{ id, title, company, location, salary, fitScore, status, url, applied, notes, connections, updates }`
- Update objects: `{ jobId, updates, changedFields, timestamp }`

## Where to Add New Code

**New Feature (e.g., new job board support):**
- Board detection: Add entry to `extension/content.js` BOARDS object with URL pattern and CSS selectors
- Tests: Manual testing on job board (no test suite)
- If board needs special API calls: Add to `extension/background.js` sync logic

**New MCP Tool (e.g., interview prep):**
- Implementation: Create `mcp-server/src/tools/newfeature.js` with exported functions
- Registration: Add tool definition to TOOLS array in `mcp-server/src/index.js` (lines 70-300)
- Data access: Use `loadJobsFromDashboard()` or `loadResumeData()` from `mcp-server/src/data/loader.js`
- File updates: Use atomic write pattern for any data persistence

**New API Endpoint (e.g., export jobs as CSV):**
- Implementation: Add handler in `server.js` after line 200 (request routing section)
- Pattern: Check pathname and method, validate input, call existing data functions
- Response: Use `sendJSON()` helper (line 170) or `serveFile()` helper (line 181)
- Atomic operations: Use `atomicWriteSync()` if writing data (line 33)

**New Dashboard Tab or Feature:**
- UI: Add HTML section in `index.html` with class `tab-content`
- Logic: Add JavaScript event handlers in inline script section
- API calls: Use existing `/api/` endpoints or add new endpoint in server.js
- Example tab structure in index.html lines 193-200

**Utility Functions:**
- Shared helpers in extension: Add to `extension/background.js` (duplicate detection, normalization)
- Shared helpers in MCP: Add to `mcp-server/src/data/loader.js` or create new `mcp-server/src/utils.js`
- Data validation: Inline in relevant files (extension/background.js for duplicate checking, server.js for API input)

## Special Directories

**`mcp-server/data/`:**
- Purpose: Live job database and learning preferences
- Generated: Yes (via `npm run extract` or manual updates)
- Committed: Yes (included in version control)
- Write pattern: Always use atomicWriteSync to prevent corruption

**`extension/`:**
- Purpose: Chrome extension source
- Generated: No
- Committed: Yes
- Manifest v3 required (updating to v3 from older manifests)

**`archive/`:**
- Purpose: Previous versions of dashboard and forms
- Generated: No
- Committed: Yes (historical reference)
- Status: Deprecated; use index.html instead

**`worker/`:**
- Purpose: Cloudflare edge computing (optional)
- Generated: No
- Committed: Yes
- Status: Standalone validation service, optional integration

**`node_modules/` (not shown in layout):**
- Purpose: NPM dependencies
- Generated: Yes (from package.json)
- Committed: No (.gitignore)
- Install: `npm install` in mcp-server directory

## Import and Module Organization

**Extension (browser context):**
- No module system used; all scripts loaded via manifest
- Cross-file communication: Chrome messaging API (chrome.runtime.sendMessage)
- Scope: Global namespace within each script context

**Server (Node.js):**
- Module system: ES modules (import/export)
- Example: `import fs from 'fs'`, `import { fileURLToPath } from 'url'`
- Relative paths use `import.meta.url` to resolve `__dirname`

**MCP Server (Node.js):**
- Module system: ES modules
- Pattern: Tool functions imported in `index.js`, then registered in TOOLS array
- Example from line 18-54 of mcp-server/src/index.js showing tool imports

## Data Flow Between Components

**Extension → Server:**
```
content.js extracts job
→ background.js receives via chrome.runtime.sendMessage
→ background.js POST to /api/jobs
→ server.js receives, validates, atomicWriteSync to jobs.json
```

**Server ← Dashboard:**
```
index.html loaded from server.js
→ Dashboard JavaScript makes fetch() to /api/jobs
→ server.js reads jobs.json, returns JSON
→ Dashboard renders jobs with filtering/sorting
```

**Server ← MCP:**
```
mcp-server/src/index.js loads jobs via loader.js
→ loader.js reads jobs.json from disk
→ Claude Chat executes tool calls
→ Tool implementation reads/updates via loader/atomicWrite
→ Results returned to Claude
```

---

*Structure analysis: 2026-01-29*
