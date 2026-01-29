# Codebase Concerns

**Analysis Date:** 2026-01-29

## Tech Debt

**Hardcoded absolute file paths:**
- Issue: Dashboard path hardcoded to user's personal directory
- Files: `extension/popup.js:3` (DASHBOARD_PATH), `server.js:23` (RESUME_ROOT)
- Impact: Extension/server unusable on any other machine; blocks sharing, deployment, testing
- Fix approach: Move paths to environment variables or configuration file; store relative to project root or user's home directory

**Server URL hardcoded to localhost:**
- Issue: All API endpoints hardcoded to `http://localhost:3000`
- Files: `extension/background.js:5-6`, `extension/popup.js:5`, `worker/job-validator.js` indirectly
- Impact: Cannot deploy to different environments; no support for staging/production servers
- Fix approach: Use environment variables (SERVER_URL env var) or configuration file; allow override via extension options

**Incomplete data tracking:**
- Issue: Document count not calculated; marked as TODO
- Files: `mcp-server/src/tools/jobs.js:67` (documentCount: 0 // TODO)
- Impact: Cannot track how many resume/cover letter versions exist for each job
- Fix approach: Scan document directory and count files matching job ID pattern

## Known Bugs

**Extension error handling doesn't distinguish between error types:**
- Symptoms: User sees "❌ Extension Error" or "❌ Error" without knowing if it's a network issue, server problem, or extension crash
- Files: `extension/content.js:603-607`, `extension/popup.js:422`
- Trigger: Extension crashes or throws exception; server is down; localhost not running
- Workaround: Check browser console to see actual error message

**Content script DOM mutation observer never cleaned up:**
- Symptoms: Observer accumulates memory; browser tab becomes sluggish on long sessions; mutation events fire repeatedly
- Files: `extension/content.js:707-715`
- Trigger: Navigating between job listings on LinkedIn/other boards; observer recreated each time without cleanup
- Workaround: Reload extension periodically or close/reopen job board tab

**Job data lost if server crashes during sync:**
- Symptoms: Pending jobs disappear; no record of what was synced vs. what failed
- Files: `extension/background.js:314-354`, `server.js` (atomic writes for server, but extension doesn't verify)
- Trigger: Restart server or extension while sync is in progress
- Workaround: Check pending queue in localStorage manually; jobs.json has backups

**Duplicate detection algorithm too permissive:**
- Symptoms: False negatives - same job at same company with slightly different titles treated as different jobs
- Files: `extension/background.js:46-80`, `worker/job-validator.js:668-693`
- Trigger: LinkedIn/job board changes title formatting; "Senior Creative Director" vs "Sr. Creative Director" treated as different
- Workaround: Manually flag duplicates and delete

## Security Considerations

**Unsafe innerHTML usage in popup and content script:**
- Risk: XSS vulnerability if job data contains malicious HTML; job titles/companies from job boards could be weaponized
- Files: `extension/content.js:191` (escapeHtml used in PDF), `extension/content.js:451,668` (toolbar), `extension/popup.js:291,384,434,457,479,499,600,624,672,702,819,839` (multiple locations)
- Current mitigation: HTML entity escaping used in PDF generation but not consistently in toolbar/popup; escapeHtml function exists but not always used before innerHTML assignment
- Recommendations:
  1. Use textContent instead of innerHTML where possible (e.g., button labels, connection counts)
  2. Ensure escapeHtml is used on ALL user-facing data before any innerHTML assignment
  3. Consider using a template library (lit-html, htm) that auto-escapes by default
  4. Test with job titles containing HTML: `<img src=x onerror=alert(1)>`, `</div><script>alert(1)</script>`

**CORS configured to allow any origin:**
- Risk: Any website can make requests to localhost:3000 and read/modify job data
- Files: `server.js:121`, `worker/job-validator.js:54-59` (corsHeaders with '*')
- Current mitigation: Server only accessible on localhost, but CORS header still '*'
- Recommendations:
  1. Change CORS origin to specific localhost URLs only
  2. Add CSRF token validation for write operations (POST/PUT)
  3. Add rate limiting to prevent abuse

**No authentication/authorization on API endpoints:**
- Risk: Any script can call update_job, archive_job, add_job_note without permission
- Files: `server.js` (entire /api/jobs endpoint), `mcp-server/src/index.js` tool handlers
- Current mitigation: Only accessible locally on localhost; no network exposure
- Recommendations:
  1. Add user session/token validation for MCP server tools
  2. Implement permission checks before allowing updates
  3. Add audit logging for all write operations

**Resumé path exposed in code:**
- Risk: Hardcoded path reveals user's home directory structure and file locations
- Files: `server.js:23` (RESUME_ROOT = '/Users/genre/Claude/resume')
- Current mitigation: Only on local machine
- Recommendations: Never hardcode personal paths; use environment variables

**Fetch operations lack timeout protection:**
- Risk: Long-running fetch calls can hang indefinitely; affects worker validation and background sync
- Files: `extension/background.js:279,298,336,422`, `worker/job-validator.js:143-149,755-813`, `extension/content.js:599`
- Current mitigation: None
- Recommendations: Add timeout parameter to all fetch calls (5-10 seconds for validation, 30s for full page loads)

## Performance Bottlenecks

**Levenshtein distance algorithm O(n*m) on every duplicate check:**
- Problem: Similarity calculation runs on EVERY job against EVERY existing job during duplicate detection
- Files: `extension/background.js:110-135`, `worker/job-validator.js:705-731` (duplicated implementation)
- Cause: Called in checkDuplicate → findDuplicate loop; no caching or early termination
- Improvement path:
  1. Add early termination for high-similarity matches (return as soon as > 0.8)
  2. Cache similarity results during single request
  3. Consider fuzzy matching library instead of custom implementation
  4. Only run on jobs from same company/same month posted

**MutationObserver on job board pages watches entire document body:**
- Problem: Observes all DOM changes in LinkedIn/Lever/Greenhouse page; fires on every ad, lazy-load, animation
- Files: `extension/content.js:707-715`
- Cause: `observer.observe(document.body, { childList: true, subtree: true })`
- Improvement path:
  1. Scope observer to job detail container only (not entire body)
  2. Debounce the init() callback to prevent repeated injections
  3. Use polling fallback for LinkedIn (mutation observer less reliable on SPA)
  4. Clean up observer when component is destroyed

**HTML extraction via regex on full page HTML:**
- Problem: Job validator runs regex patterns against entire 2MB+ HTML document repeatedly
- Files: `worker/job-validator.js:341-542` (extractJobDetails function)
- Cause: No early termination; tries all patterns even after finding data; processes full page for fallback attempts
- Improvement path:
  1. Use DOM parser instead of regex (safer and faster)
  2. Early return after finding required fields (title, company, location)
  3. Extract only job section of page, not entire HTML

**Batch validation processes 5 jobs in parallel, sequentially by batch:**
- Problem: Slower than needed for large job lists; workers idle while waiting for slowest job in batch
- Files: `worker/job-validator.js:253-278` (concurrency = 5 hardcoded)
- Cause: Static batch size; doesn't account for job board response times
- Improvement path:
  1. Increase concurrency to 10-15 for status checks (HEAD requests)
  2. Use adaptive concurrency based on response times
  3. Implement priority queue for high-value validations

## Fragile Areas

**Selector-based job data extraction:**
- Files: `extension/content.js:16-162` (BOARDS config with selectors), `worker/job-validator.js:341-542`
- Why fragile: LinkedIn/Greenhouse/Lever change CSS classes and structure frequently; fallback selectors prevent complete breakage but extraction becomes unreliable
- Safe modification:
  1. Test all selector chains in browser DevTools when updating
  2. Add fallback to JSON-LD if available (more stable across platforms)
  3. Create selector test suite that validates extraction on live pages
  4. Monitor error rates from field extraction failures
- Test coverage: Selector chains for each job board exist but no automated tests verify they work on current page structure

**Resume/document generation via Python subprocess:**
- Files: `mcp-server/src/tools/documents.js` (calls Python generator)
- Why fragile: Python subprocess failure silently returns empty result; no error propagation; relies on external Python environment
- Safe modification:
  1. Check Python process exit code and stderr
  2. Add timeout to subprocess execution
  3. Verify Python generator file exists before calling
  4. Return meaningful error messages instead of silent failures
- Test coverage: No tests for Python integration; failures only discovered when Claude tries to use tool

**Job board hardcoded regex patterns for salary/location extraction:**
- Files: `worker/job-validator.js:480-520` (location patterns), `extension/content.js:285-290` (location splitting)
- Why fragile: Assumes specific formatting (e.g., "Boston, MA" or "Boston·Remote"); fails on "Boston / Remote" or "Boston, USA"
- Safe modification:
  1. Test patterns against real job postings before deploying
  2. Add fallback that accepts partial matches
  3. Return "Unknown" instead of null for unparseable values
- Test coverage: No unit tests for regex patterns

**Inbox API endpoint integration:**
- Files: `extension/background.js:405-465`, `server.js` (inbox endpoint)
- Why fragile: Three different job add paths (pending queue, addJobToServer, addJobToInbox); fallback chains mean wrong status reported to user
- Safe modification:
  1. Consolidate to single code path
  2. Add explicit state machine for job routing (server running → inbox, server down → pending, error → show user)
  3. Test all three paths in automated suite
- Test coverage: Manual testing only; no automated tests for fallback chains

## Scaling Limits

**localStorage size limit for pending jobs queue:**
- Current capacity: Chrome allows 5-10MB; typical job is ~2KB = 2,500-5,000 jobs max
- Limit: Once hit, no more jobs can be captured by extension
- Scaling path: Migrate to IndexedDB (allows 50MB+); implement sync strategy for large queues

**Single JSON file for all job data (jobs.json):**
- Current capacity: File gets larger with each job; no archiving; loading all jobs on every server startup
- Limit: Performance degrades at 10,000+ jobs; file operations block requests
- Scaling path:
  1. Archive old jobs to separate files or compressed storage
  2. Implement pagination in API endpoints
  3. Add database layer (SQLite, PostgreSQL) instead of JSON files

**Synchronous file writes block all requests:**
- Current capacity: Node server blocks on `fs.writeFileSync` during every job update
- Limit: Response times become unacceptable under concurrent requests (10+ simultaneously)
- Scaling path: Switch to async fs operations (`writeFile` instead of `writeFileSync`)

**Worker validation doesn't handle large job lists:**
- Current capacity: Concurrency = 5; validates ~10-15 jobs/minute
- Limit: Would take 7+ hours to validate 10,000 jobs
- Scaling path: Increase concurrency to 20-30; implement priority queue for fresh postings

## Dependencies at Risk

**Custom string similarity implementation (Levenshtein distance):**
- Risk: Duplicated across codebase; not using proven library; edge cases possible (emoji, special chars)
- Impact: Duplicate detection unreliable; similar issues exist in extension and worker
- Migration plan: Use `string-similarity` npm package or `fuse.js` for fuzzy matching; removes 60+ lines of duplicated code

**No formal error tracking/logging:**
- Risk: Production bugs silently fail; users don't report issues; no metrics on failure rates
- Impact: Cannot diagnose why jobs fail to sync, validations fail, etc.
- Migration plan: Add Sentry or similar error tracking; store logs to files for debugging

**Browser extension API dependency on specific Chrome version features:**
- Risk: Service worker API, messaging API, storage API are Chrome-specific; breaks on Firefox/Edge without MV3 support
- Impact: Cannot port to other browsers without rewrite
- Migration plan: Use extension library (webextension-polyfill) for cross-browser support

## Missing Critical Features

**No backup/restore functionality:**
- Problem: Jobs data only stored in one place (jobs.json); no automatic backups; manual export only
- Blocks: Cannot recover from data corruption; no disaster recovery
- Recommendation: Implement daily auto-backup to secondary location (cloud sync, versioned JSON files)

**No audit log for job changes:**
- Problem: Cannot see who changed what when; no history of fit score adjustments, status changes
- Blocks: Cannot debug data inconsistencies; cannot track hiring manager conversation history
- Recommendation: Log all write operations with timestamp, user, old value, new value

**No alert/reminder system for interviews and deadlines:**
- Problem: Easy to miss interview dates; no notification when job application response due
- Blocks: Cannot rely on system for time-sensitive follow-ups
- Recommendation: Add browser notification API for interview dates; email reminders for old applications without response

## Test Coverage Gaps

**No automated tests for content script selectors:**
- What's not tested: Whether job data is correctly extracted from LinkedIn, Lever, Greenhouse, Workday
- Files: `extension/content.js:255-321` (extractJobData function)
- Risk: CSS class changes break extraction silently; user doesn't know job data is incomplete
- Priority: High - Core functionality depends on this

**No tests for duplicate detection algorithm:**
- What's not tested: Edge cases (different capitalization, unicode, special chars, very similar titles)
- Files: `extension/background.js:46-80`, `worker/job-validator.js:668-693`
- Risk: False negatives (missing duplicates) allow duplicate entries; false positives block legitimate jobs
- Priority: High - Data quality suffers

**No tests for extension-server communication:**
- What's not tested: Fallback chains (server down → pending queue); sync success/failure; concurrent requests
- Files: `extension/background.js:314-354`, `extension/popup.js` (sync logic)
- Risk: Jobs lost if sync fails during critical moments; no error recovery tested
- Priority: High - Data loss possible

**No tests for job board integration paths:**
- What's not tested: Each job board's selector chains; JSON-LD fallback; regex extraction
- Files: `extension/content.js`, `worker/job-validator.js`
- Risk: Breakage discovered only when user tries to capture from that board
- Priority: Medium - User-facing but affects specific boards only

**No tests for API endpoint security:**
- What's not tested: CORS headers, missing auth checks, SQL injection (if DB added later)
- Files: `server.js` (entire API), `mcp-server/src/index.js`
- Risk: Unintended data access; no authorization validation
- Priority: High - Security issue

---

*Concerns audit: 2026-01-29*
