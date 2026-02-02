---
phase: 07-application-generation
plan: 01
subsystem: research
tags: [zod, research, company-research, manager-research, persistence, json, markdown]

# Dependency graph
requires:
  - phase: 06-application-intelligence
    provides: resume matching, contact tracking, follow-up engine
provides:
  - CompanyResearchSchema and HiringManagerResearchSchema for structured research
  - Company research service with template, save, and existing research detection
  - Manager research service focused on style and connection per CONTEXT.md
  - Research persistence service for loading and highlights extraction
  - Per-job research storage in JSON + markdown formats
affects: [07-02-PLAN, 07-03-PLAN, document-generation, interview-prep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Research template pattern (return template for Claude to populate)
    - Dual persistence (JSON for programmatic access, markdown for human readability)
    - Company reuse detection (prompt to reuse research for same company)
    - Highlights extraction (top 5 key points for quick surfacing)

key-files:
  created:
    - schemas/research.schema.js
    - mcp-server/src/services/company-research.js
    - mcp-server/src/services/company-research.test.js
    - mcp-server/src/services/manager-research.js
    - mcp-server/src/services/manager-research.test.js
    - mcp-server/src/services/research-persistence.js
    - mcp-server/src/services/research-persistence.test.js
    - mcp-server/data/job-research/.gitkeep
  modified: []

key-decisions:
  - "Research template pattern: services return templates for Claude to populate via conversation"
  - "Dual persistence: JSON (structured) + markdown (human-readable) per job"
  - "Highlights limited to 5 for quick surfacing, full research on request"
  - "Manager research prioritizes style and connection over background"
  - "30-day threshold for suggesting research refresh vs reuse"
  - "Unique test job ID ranges (10000/20000/30000) for parallel test isolation"

patterns-established:
  - "Research template: researchX returns { status, research, instructions } for Claude"
  - "Research save: updateXResearch validates, saves JSON, generates and saves markdown"
  - "Research load: getJobResearch(jobId, type) loads persisted data"
  - "Highlights extraction: getResearchHighlights(jobId) returns top 5 for surfacing"

# Metrics
duration: 10min
completed: 2026-02-02
---

# Phase 7 Plan 1: Research Infrastructure Summary

**Zod schemas for company/manager research with template-based services for Claude to populate and dual JSON+markdown persistence per job**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-02T05:28:13Z
- **Completed:** 2026-02-02T05:38:45Z
- **Tasks:** 3
- **Files created:** 8

## Accomplishments
- CompanyResearchSchema with firmographics, funding, culture, news, challenges, competitors, products
- HiringManagerResearchSchema focused on interview style, communication patterns, shared interests, talking points
- Company research service with template generation, validation, atomic persistence, and existing research detection
- Manager research service with style-first priority per CONTEXT.md guidance
- Research persistence service with type-filtered loading and highlights extraction

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Research Schemas** - `379dad2` (feat)
2. **Task 2: Create Company Research Service** - `3f28a3a` (feat)
3. **Task 3: Create Manager Research and Persistence Services** - `b8633d6` (feat)

**Test isolation fix:** `67d8342` (test: unique job ID ranges per test file)

## Files Created/Modified

- `schemas/research.schema.js` - CompanyResearchSchema, HiringManagerResearchSchema with confidence levels
- `mcp-server/src/services/company-research.js` - researchCompany, updateCompanyResearch, checkForExistingCompanyResearch
- `mcp-server/src/services/company-research.test.js` - 27 tests covering template, validation, persistence, reuse detection
- `mcp-server/src/services/manager-research.js` - researchHiringManager, updateManagerResearch with style-first focus
- `mcp-server/src/services/manager-research.test.js` - 23 tests covering template, validation, markdown generation
- `mcp-server/src/services/research-persistence.js` - getJobResearch, getResearchHighlights, hasResearch, loadResearch
- `mcp-server/src/services/research-persistence.test.js` - 23 tests covering load, highlights, type filtering
- `mcp-server/data/job-research/.gitkeep` - Directory for per-job research storage

## Decisions Made

1. **Research template pattern:** Services return template structures with instructions for Claude to populate through conversation, then call update functions to persist
2. **Dual persistence format:** JSON for programmatic access, markdown for human readability - both generated on save
3. **Manager research priority:** Style and connection (interview signals, communication patterns, talking points) are primary; background is secondary per CONTEXT.md
4. **Highlights limit:** Top 5 highlights extracted for quick surfacing, full research available on request
5. **Company reuse threshold:** 30 days - recent research suggests reuse, older research suggests refresh
6. **Test isolation:** Unique job ID ranges per test file (10000s, 20000s, 30000s) to prevent parallel test conflicts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test isolation for parallel execution**
- **Found during:** Task 2-3 (running all research tests together)
- **Issue:** Tests using same job IDs (123, 456, 999) across files caused file conflicts when tests ran in parallel
- **Fix:** Assigned unique job ID ranges per test file (company: 10000s, manager: 20000s, persistence: 30000s)
- **Files modified:** company-research.test.js, manager-research.test.js, research-persistence.test.js
- **Verification:** All 73 tests pass when running in parallel
- **Committed in:** `67d8342`

---

**Total deviations:** 1 auto-fixed (blocking issue)
**Impact on plan:** Test isolation fix was necessary for reliable parallel test execution. No scope creep.

## Issues Encountered
None beyond the test isolation issue which was auto-fixed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Research schemas and services ready for MCP tool integration (07-02)
- Template pattern established for Claude conversation workflow
- Persistence layer ready for document generation to read research data
- Highlights extraction ready for surfacing in job discussions

---
*Phase: 07-application-generation*
*Completed: 2026-02-02*
