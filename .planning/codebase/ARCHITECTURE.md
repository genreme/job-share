# Architecture

**Analysis Date:** 2026-01-29

## Pattern Overview

**Overall:** Multi-tier job search management system with three primary interfaces: dashboard (web UI), browser extension (data capture), and MCP server (Claude Chat integration).

**Key Characteristics:**
- File-based persistence (JSON data layer)
- Request/response HTTP API architecture
- Content script injection for multi-job-board support
- Claude MCP (Model Context Protocol) integration for AI-powered analysis
- Atomic file operations to prevent data corruption

## Layers

**Frontend Layer (UI/UX):**
- Purpose: Render job dashboard, display analytics, manage application workflow
- Location: `/Users/genre/Claude/Job Search Command Center/index.html`, `/Users/genre/Claude/Job Search Command Center/extension/popup.html`
- Contains: HTML/CSS/JavaScript UI components, tab-based interface, real-time status rendering
- Depends on: HTTP API (server.js endpoints)
- Used by: Users viewing dashboard, browsers rendering extension popup

**Extension Layer (Data Capture):**
- Purpose: Extract job data from multiple job boards, sync with dashboard
- Location: `/Users/genre/Claude/Job Search Command Center/extension/`
- Contains: `content.js` (board detection, data extraction), `background.js` (service worker, duplicate detection, server sync), `popup.js` (UI for captured jobs)
- Depends on: Chrome APIs, HTTP API for server sync and duplicate checking
- Used by: Runs in browser context on LinkedIn, Lever, Greenhouse, Workday, Ashby job boards

**API Server Layer (HTTP REST):**
- Purpose: Centralized HTTP API serving dashboard data, receiving updates, managing file I/O
- Location: `/Users/genre/Claude/Job Search Command Center/server.js`
- Contains: 20+ API endpoints (GET/POST/PUT), request routing, data validation, file atomicity
- Depends on: Node.js fs module, JSON data files
- Used by: Extension (POST updates), Dashboard (GET data), MCP server (reads data)

**Data Layer (Persistence):**
- Purpose: Store job data, learning preferences, analytics
- Location: `/Users/genre/Claude/Job Search Command Center/mcp-server/data/`
- Contains: `jobs.json` (job records, search history, settings), `learning-log.json` (AI preferences, suggestions, metrics)
- Depends on: Atomic file write patterns
- Used by: All other layers read/write through atomicWriteSync pattern

**MCP Tool Layer (Claude Integration):**
- Purpose: Expose job data and document generation to Claude Chat via Model Context Protocol
- Location: `/Users/genre/Claude/Job Search Command Center/mcp-server/src/`
- Contains: Tool implementations for job queries, resume operations, document generation
- Depends on: Data loader module, jobs.json
- Used by: Claude Chat accessing tools via MCP stdio transport

## Data Flow

**Job Capture Flow:**

1. User visits LinkedIn/Lever/Greenhouse job posting
2. `content.js` detects board type via URL pattern, extracts job fields using board-specific CSS selectors
3. Popup button triggers `chrome.runtime.sendMessage` to `background.js`
4. `background.js` calls `checkDuplicate()` against server jobs and pending queue
5. User confirms capture, job stored in Chrome local storage pending queue
6. Background worker attempts sync POST to `/api/jobs` if server running
7. Server receives POST, validates structure, atomically writes to `jobs.json`
8. Dashboard refreshes via polling or manual sync, displays new job with fit score

**Job Analysis Flow:**

1. User opens dashboard (index.html), loads from `/api/jobs`
2. Dashboard renders jobs with status (apply-now, maybe, probably-not, applied, archived)
3. User can manually update status via UI or click "Check All Status" button
4. Dashboard POST requests to `/api/jobs` with updated job records
5. Server updates `jobs.json` atomically, tracks version number
6. Learning log updated at `/api/learning/apply` or `/api/learning/reject`

**Claude Integration Flow:**

1. User runs `npm run mcp` to start MCP server
2. MCP server loads jobs.json via `loadJobsFromDashboard()`
3. Tools exposed: `get_jobs`, `getJobDetail`, `updateJob`, `generateResume`, `validateCoverLetter`, etc.
4. Claude executes tool calls via stdio, MCP server processes via tool implementations
5. Tools read/write to jobs.json using atomic operations
6. Results returned to Claude for analysis and response generation

**State Management:**

- Jobs state centralized in `jobs.json` (single source of truth)
- Extension maintains temporary pending queue in Chrome local storage
- Dashboard reads from API (which reads jobs.json)
- MCP tools directly read/write jobs.json with atomic patterns
- Learning log updated independently at `learning-log.json` for Claude preferences

## Key Abstractions

**Job Object:**
- Purpose: Represents a single job posting with metadata and application state
- Examples: See jobs.json structure with fields: id, title, company, location, salary, fitScore, status, url, applied, notes, connections, symbols, updates
- Pattern: Each job is identified by unique id, tracked through entire application lifecycle

**Board Detection System:**
- Purpose: Support multiple job boards (LinkedIn, Lever, Greenhouse, Workday, Ashby) with board-specific selectors
- Examples: `content.js` BOARDS object with LinkedIn, lever, greenhouse configurations
- Pattern: URL pattern matching + CSS selector fallbacks for resilient data extraction

**Atomic Write Pattern:**
- Purpose: Prevent data corruption if process crashes mid-write
- Examples: `atomicWriteSync()` in both server.js and updates.js, used for jobs.json and learning-log.json
- Pattern: Write to temp file in os.tmpdir(), then rename (atomic operation) to target path

**Tool System (MCP):**
- Purpose: Expose job/document operations as Claude-accessible functions
- Examples: `/mcp-server/src/tools/jobs.js`, `/mcp-server/src/tools/updates.js`, `/mcp-server/src/tools/documents.js`
- Pattern: Named export functions with consistent error handling, operate on jobs.json via loader.js

## Entry Points

**Server (Development):**
- Location: `npm start` → `/Users/genre/Claude/Job Search Command Center/server.js`
- Triggers: `npm start` or `npm run dev` (with auto-reload)
- Responsibilities: HTTP server on port 3000, serves dashboard, API endpoints, static files

**MCP Server (Claude Integration):**
- Location: `npm run mcp` → `/Users/genre/Claude/Job Search Command Center/mcp-server/src/index.js`
- Triggers: Explicit `npm run mcp` command
- Responsibilities: Initialize MCP server with tool definitions, listen on stdio, delegate to tool modules

**Extension Background (Ongoing):**
- Location: `extension/background.js`
- Triggers: Browser context activation (manifest background service worker)
- Responsibilities: Listen for messages from content script and popup, manage duplicate detection, handle server sync

**Dashboard:**
- Location: `http://localhost:3000` → serves `/Users/genre/Claude/Job Search Command Center/index.html`
- Triggers: User opens in browser after `npm start`
- Responsibilities: Display jobs, manage filtering/sorting, UI for status updates

## Error Handling

**Strategy:** Multi-level error handling with logging, fallback defaults, and user feedback

**Patterns:**

- **File Operations:** Try-catch around file reads with fallback to default structure (e.g., empty jobs array)
- **API Requests:** Validate request structure, return 400/500 with error messages, always include timestamp
- **Extension Sync:** Graceful degradation if server not running; jobs remain in local storage pending queue
- **Data Corruption:** Atomic write pattern with temp files prevents partial writes; version tracking allows rollback detection
- **Duplicate Detection:** Implement multiple matching strategies (exact title, similarity >80%, URL match) to catch edge cases

## Cross-Cutting Concerns

**Logging:**
- Server uses console.error() for errors, console.log() for successes
- Example: `console.log(\`✅ Saved ${savedData.jobs.length} jobs to jobs.json (v${savedData.version})\`)`
- No centralized logging framework; direct to console for development

**Validation:**
- Server validates incoming POST data structure (jobs array required)
- MCP tools validate inputs before processing (e.g., jobId must exist)
- Frontend optional: some fields may be partial/incomplete but are accepted

**Authentication:**
- No authentication layer; assumes local development environment
- CORS headers set to '*' allowing any origin access to `/api/` endpoints
- Extension has direct file system access on user machine

---

*Architecture analysis: 2026-01-29*
