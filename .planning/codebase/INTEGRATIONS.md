# External Integrations

**Analysis Date:** 2026-01-29

## APIs & External Services

**Job Board Integrations:**
- LinkedIn - Content script captures job data from `https://www.linkedin.com/jobs/*`
  - No SDK, direct DOM scraping via selectors in `extension/content.js`
- Lever - Content script scrapes `https://*.lever.co/*`
  - No SDK, direct DOM scraping via board detection in `extension/content.js`
- Greenhouse - Content script scrapes `https://boards.greenhouse.io/*` and custom domains
  - No SDK, direct DOM scraping with fallback selectors
- Workday - Content script scrapes `https://*.myworkdayjobs.com/*`
  - No SDK, direct DOM scraping
- Ashby - Content script scrapes `https://*.ashbyhq.com/*`
  - No SDK, direct DOM scraping

**Job Validation Service:**
- Cloudflare Worker: `https://job-validator.genreme.workers.dev`
  - SDK/Client: None (HTTP fetch in `index.html`)
  - Purpose: Validates job URLs, extracts job details, calculates fit scores, finds duplicate jobs
  - Implementation: Located at `worker/job-validator.js`
  - Deployment: Via wrangler CLI (`wrangler deploy`)
  - Fit criteria hardcoded in worker (titles, industries, locations, salary minimum)

## Data Storage

**Databases:**
- Supabase PostgreSQL - Remote SaaS provider
  - URL: `https://ivssytvekpfnaqcbhxkz.supabase.co`
  - Purpose: Friend job submissions inbox feature
  - Client: Supabase JS SDK v2 (loaded from CDN: `https://unpkg.com/@supabase/supabase-js@2`)
  - Auth: Anonymous (anon key embedded in `index.html`)
  - Tables referenced: Tables queried for pending submissions and recent entries

**File Storage:**
- Local filesystem only
  - Jobs database: `mcp-server/data/jobs.json`
  - Learning log: `mcp-server/data/learning-log.json`
  - Resume data: External path `/Users/genre/Claude/resume/`
  - Cover letters: External path `/Users/genre/Claude/resume/cover letter generator - claude/`

**Caching:**
- Chrome Storage API - Browser extension local cache
  - Key: `jobSearchExtensionData`
  - Used for pending jobs before sync to server
  - Persists across extension sessions

## Authentication & Identity

**Auth Provider:**
- Custom implementation
  - No OAuth/OIDC providers integrated
  - Browser extension: Uses Chrome Storage for local state
  - Server: No authentication layer (localhost only)
  - MCP Server: StdioServerTransport (direct Claude integration)
  - Supabase: Anonymous access (public anon key)

**Local Storage:**
- Chrome Storage API in extension (`chrome.storage.local.get/set`)
- localStorage/sessionStorage not used (Chrome Storage preferred for extension)

## Monitoring & Observability

**Error Tracking:**
- None detected
- Errors logged to browser console or Node.js stderr

**Logs:**
- Browser extension: `console.log()` calls (viewed in Chrome DevTools)
- Node.js server: `console.log()` and `console.error()` to stdout/stderr
- MCP server: Errors logged to stderr (format: `console.error()`)

**Analytics:**
- Local analytics calculated server-side: `/api/analytics`, `/api/analytics/funnel`, `/api/analytics/sources`, `/api/analytics/fit-accuracy`
- No remote analytics service integrated
- Dashboard tracks fit score accuracy and conversion funnels internally

## CI/CD & Deployment

**Hosting:**
- Local development: Node.js server on `localhost:3000`
- Browser extension: Chrome Web Store (manual deployment)
- Cloudflare Workers: Free tier (https://job-validator.genreme.workers.dev)
- Resume/documents: Local filesystem at `/Users/genre/Claude/resume/`

**CI Pipeline:**
- None detected
- Manual deployment via `wrangler deploy` for Cloudflare Worker
- No GitHub Actions, GitLab CI, or similar

**Package Management:**
- npm for Node.js dependencies
- Browser extension: Vanilla JS (no bundler)
- Cloudflare Worker: Single JS file, no build step

## Environment Configuration

**Required env vars:**
- `PORT` - Server port (defaults to 3000)

**Hardcoded Configuration:**
- Job Validator URL: `https://job-validator.genreme.workers.dev`
- Supabase URL: `https://ivssytvekpfnaqcbhxkz.supabase.co`
- Supabase Anon Key: Embedded in `index.html` (visible in page source)
- Resume root path: `/Users/genre/Claude/resume`
- Resume data file: `resume_data_v9_1.json`
- Cover letter data file: `cover_letter_data.json`

**Secrets location:**
- Supabase anon key: Hardcoded in `index.html` (line 7974)
- No .env file usage detected
- No secrets management system

## API Endpoints

**Local Server (localhost:3000):**

**Jobs Management:**
- `GET /api/jobs` - Fetch all jobs from jobs.json
- `POST /api/jobs` - Save updated jobs data (atomic writes)
- `POST /api/jobs/add-single` - Add single job from extension
- `POST /api/jobs/link-document` - Link resume/cover letter to job

**Document Management:**
- `GET /api/documents` - List all documents in resume folder
- `GET /api/documents/company/{company}` - Get documents for specific company
- `POST /api/documents/auto-link` - Auto-link documents to jobs by company name

**Analytics:**
- `GET /api/analytics` - Comprehensive application analytics
- `GET /api/analytics/funnel` - Conversion funnel/timeline data
- `GET /api/analytics/sources` - Source effectiveness analysis
- `GET /api/analytics/fit-accuracy` - Fit score accuracy analysis

**Learning & Insights:**
- `GET /api/learning` - Fetch learning preferences and history
- `GET /api/learning/suggestions` - Generate suggestions from data patterns
- `POST /api/learning/apply` - Apply approved suggestion
- `POST /api/learning/reject` - Reject suggestion
- `GET /api/learning/evolution` - Get evolution history
- `POST /api/learning/preferences` - Update preferences manually

**Health:**
- `GET /health` - Server health check

**Static Files:**
- `GET /` - Serves `index.html` (dashboard)

## MCP Server Tools

**Location:** `mcp-server/src/index.js` with tool implementations in `mcp-server/src/tools/`

**Job Management Tools:**
- `get_jobs` - Retrieve jobs filtered by status or fit score
- `get_job_detail` - Get detailed job information with history
- `get_jobs_by_company` - Filter jobs by company name
- `get_application_stats` - Application metrics and conversion rates
- `find_similar_jobs` - Find similar jobs by skills/requirements
- `get_search_history` - Retrieve search history
- `update_job` - Update job status/metadata
- `archive_job` / `archive_jobs` - Archive jobs
- `set_hiring_manager` - Set hiring manager contact info
- `add_job_note` - Add notes to jobs
- `bulk_update_jobs` - Batch update multiple jobs

**Resume Tools:**
- `get_resume_data` - Load resume sections
- `get_resume_sections` - Resume sections breakdown
- `get_cover_letter_template` - Cover letter templates
- `get_document_history` - Document generation history
- `get_documents_for_company` - Linked documents for company
- `get_experience_by_theme` - Experience grouped by theme
- `get_portfolio_highlights` - Portfolio/project highlights
- `get_key_metrics` - Career metrics and achievements
- `get_customization_suggestions` - Customization recommendations

**Document Generation Tools:**
- `generate_resume` - Generate customized resume for job
- `generate_cover_letter` - Generate cover letter
- `validate_resume` - Validate resume structure
- `validate_cover_letter` - Validate cover letter content
- `assess_page_fit` - Assess how well resume fits job

## Webhooks & Callbacks

**Incoming:**
- Browser extension → Server: HTTP POST to `/api/jobs/add-single` when capturing jobs
- Job Validator → Dashboard: Batch validation responses at `/batch` endpoint
- Supabase → Dashboard: Real-time subscriptions to job submissions table (websocket)

**Outgoing:**
- Dashboard → Job Validator: HTTP POST to `/batch` with job URLs
- Dashboard → Supabase: Submits/reads job data via Supabase client library
- Extension → Server: Sync pending jobs when extension popup opens

## Content Script Injection

**Chrome Extension:**
- Injects `extension/content.js` into job posting pages
- Runs on: LinkedIn, Lever, Greenhouse, Workday, Ashby job boards
- Communicates with background script (`extension/background.js`) via `chrome.runtime.sendMessage()`
- Detects board type and scrapes job data using board-specific selectors

---

*Integration audit: 2026-01-29*
