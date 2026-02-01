---
phase: 04-discovery-core
plan: 02
subsystem: discovery
tags: [mcp-tools, reasoning, inbox-workflow, job-submission]

dependency-graph:
  requires: [04-01]
  provides: [research-job-url-tool, get-inbox-tool, confirm-job-tool, defer-job-tool, reasoning-generator]
  affects: [04-03]

tech-stack:
  added: []
  patterns:
    - reasoning-generation
    - graceful-worker-fallback
    - atomic-job-writes

key-files:
  created:
    - mcp-server/src/services/reasoning-generator.js
    - mcp-server/src/services/reasoning-generator.test.js
    - mcp-server/src/tools/discovery.js
    - mcp-server/src/tools/discovery.test.js
  modified:
    - mcp-server/src/data/loader.js
    - mcp-server/src/index.js

decisions:
  - id: REASONING-THRESHOLDS
    choice: Score thresholds 90/80/70/60 for Excellent/Strong/Good/Moderate
    reason: Provides clear tiers for user understanding
  - id: WORKER-FALLBACK
    choice: Return partial_research with requiresManualEntry when Worker unavailable
    reason: Graceful degradation over hard failure
  - id: WRITE-JOBS-LOCATION
    choice: Add writeJobsData to loader.js with atomic write pattern
    reason: Centralized data access following existing pattern

metrics:
  duration: 12 min
  completed: 2026-01-31
---

# Phase 4 Plan 2: Reasoning Generator + Discovery MCP Tools Summary

Reasoning generator service explains fit scores with human-readable text; 4 discovery MCP tools enable manual job submission, inbox review, confirmation, and deferral workflows.

## What Was Done

### Task 1: Create reasoning-generator service
- Created `mcp-server/src/services/reasoning-generator.js` with two exports:
  - `generateReasoning(job, fitResult)` - Full reasoning with breakdown
  - `generateSummary(score, reasons, concerns)` - One-liner summary
- Generates `whyIncluded` reasons based on breakdown scores
- Generates `considerations` for concerns (salary not disclosed, using defaults, etc.)
- Provides human-readable breakdown explanations for each scoring category
- Created 28 comprehensive tests covering all score ranges and edge cases

### Task 2: Create discovery.js MCP tools
- Created `mcp-server/src/tools/discovery.js` with 4 tool functions:
  - `researchJobUrl({ url, notes })` - Research job URL, calculate fit, generate reasoning
  - `getInboxForReview({ sortBy })` - Get inbox jobs sorted by fitScore or found date
  - `confirmJobToDashboard({ jobId, status, notes })` - Move inbox job to dashboard
  - `deferJob({ jobId, reason, reviewAfter })` - Defer job for later review
- Added `writeJobsData()` to loader.js for persisting job changes
- Graceful fallback when Cloudflare Worker unavailable (returns partial_research)
- All write operations use atomic write pattern (temp file + rename)

### Task 3: Wire tools into index.js and add tests
- Added discovery tool imports to index.js
- Registered 4 new tool definitions with inputSchema
- Added switch case handlers for all 4 tools
- Fixed `getExperienceByTheme` naming conflict (aliased profile version)
- Created 22 comprehensive tests for discovery tools

## Tools Registered

| Tool | Description | Key Params |
|------|-------------|------------|
| `research_job_url` | Research job URL, score, generate reasoning | url, notes |
| `get_inbox` | List inbox jobs for Claude to present | sortBy |
| `confirm_job` | Move inbox job to dashboard with status | jobId, status |
| `defer_job` | Defer job with reason and optional review date | jobId, reason, reviewAfter |

## Reasoning Output Structure

```javascript
{
  score: 85,
  summary: "Strong match (85/100). 'Creative Director' matches your target roles",
  whyIncluded: ["Title matches your target roles", "Industry aligns..."],
  considerations: ["Salary not disclosed"],
  breakdown: {
    role: "25/25 points - 'Creative Director' is an exact match",
    industry: "20/20 points - 'Healthcare' is preferred",
    location: "15/15 points - 'Boston' is preferred",
    salary: "0/15 points - Salary not disclosed",
    skills: "10/10 points - 5+ skills matched"
  }
}
```

## Test Results

- Reasoning generator tests: 28 passing (all new)
- Discovery tool tests: 22 passing (all new)
- Total new tests: 50
- Total suite: 859 passing (no regressions)

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Reasoning thresholds | 90/80/70/60 | Clear tiers: Excellent/Strong/Good/Moderate |
| Worker fallback | Return partial_research | Graceful degradation over failure |
| Summary length | One-liner with first reason | Concise for quick scanning |
| Inbox validation | Only inbox status can confirm | Enforces workflow stages |
| Defer persistence | Sets deferredAt, reason, reviewAfter | Full audit trail for deferred jobs |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed getExperienceByTheme naming conflict**
- **Found during:** Task 3
- **Issue:** Both resume.js and profile.js export `getExperienceByTheme`
- **Fix:** Aliased profile.js version as `getProfileExperienceByTheme`
- **Files modified:** mcp-server/src/index.js
- **Commit:** 3f1cae7

## Files Changed

| File | Change |
|------|--------|
| mcp-server/src/services/reasoning-generator.js | Created (159 lines) |
| mcp-server/src/services/reasoning-generator.test.js | Created (245 lines) |
| mcp-server/src/tools/discovery.js | Created (320 lines) |
| mcp-server/src/tools/discovery.test.js | Created (293 lines) |
| mcp-server/src/data/loader.js | Added writeJobsData with atomic write |
| mcp-server/src/index.js | Registered 4 discovery tools |

## Commits

| Hash | Message |
|------|---------|
| d269767 | feat(04-02): create reasoning-generator service |
| 60a9b5c | feat(04-02): create discovery MCP tools |
| 3f1cae7 | feat(04-02): wire discovery tools into index.js and add tests |

## Next Phase Readiness

Ready for 04-03 (Extension Integration) with:
- `research_job_url` tool available for manual job submission
- `get_inbox` tool available for Claude to present inbox jobs
- `confirm_job` tool available for moving jobs to dashboard
- `defer_job` tool available for deferring jobs
- Reasoning generator provides human-readable fit explanations
