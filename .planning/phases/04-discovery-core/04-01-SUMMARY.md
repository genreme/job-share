---
phase: 04-discovery-core
plan: 01
subsystem: discovery
tags: [schema, validation, scoring, profile-integration]

dependency-graph:
  requires: [02-self-profile-schema, 03-self-profile-integration]
  provides: [inbox-status, status-transitions, fit-scoring-service]
  affects: [04-02, 04-03]

tech-stack:
  added: []
  patterns:
    - profile-based-scoring
    - fallback-to-defaults

key-files:
  created:
    - mcp-server/src/services/fit-scorer.js
    - mcp-server/src/services/fit-scorer.test.js
  modified:
    - schemas/job.schema.js
    - schemas/job.schema.test.js

decisions:
  - id: INBOX-STATUS
    choice: inbox as first status before user review
    reason: Jobs from extension arrive before user classification
  - id: TRANSITION-VALIDATION
    choice: No direct inbox->applied transition
    reason: Jobs must be reviewed and classified before marking as applied
  - id: PROFILE-FALLBACK
    choice: Fallback to hardcoded defaults when targetRoles empty
    reason: System should work even without profile preferences configured

metrics:
  duration: 5 min
  completed: 2026-01-31
---

# Phase 4 Plan 1: Job Status Schema + Fit Scorer Summary

Inbox status added to JobStatusSchema with status transition validation; fit-scorer service calculates profile-based scores with fallback to hardcoded defaults when profile is empty.

## What Was Done

### Task 1: Update JobStatusSchema with inbox status
- Added `inbox` as first status in `JobStatusSchema` enum
- Created `VALID_TRANSITIONS` map defining allowed status transitions
- Added `isValidTransition()` helper function for transition validation
- Key constraint: `inbox` cannot transition directly to `applied` (must go through `apply-now`)
- Added 13 new tests for status validation and transitions

### Task 2: Create fit-scorer service with profile integration
- Created `mcp-server/src/services/fit-scorer.js` with three exports:
  - `calculateFitScore(job)` - Main function, uses profile or defaults
  - `calculateDefaultFitScore(job)` - Hardcoded criteria matching worker/job-validator.js
  - `parseSalaryFromText(salaryText)` - Parses "$120K", "$120,000 - $150,000", etc.
- Profile-based scoring when `profile.preferences.targetRoles` is populated
- Falls back to defaults with console warning when profile empty
- Returns `{ score, breakdown, usingDefaults }` structure

### Task 3: Add comprehensive tests for fit scorer
- Created `mcp-server/src/services/fit-scorer.test.js` with 47 tests
- Uses `vi.mock` pattern to mock profile-loader
- Tests cover:
  - Salary parsing (various formats, edge cases)
  - Default scoring (all criteria categories)
  - Profile-based scoring (targetRoles integration)
  - Fallback behavior (empty profile, load errors)
  - Edge cases (null fields, missing descriptions, multiple roles)

## Scoring Breakdown

| Category | Max Points | Matching Logic |
|----------|------------|----------------|
| Base | 50 | Always applied |
| Role | 25 | Exact title match = 25, partial = 15 |
| Industry | 20 | Preferred = 20, acceptable = 10 |
| Location | 15 | Preferred = 15, acceptable = 8 |
| Salary | 15 | Meets minimum requirement |
| Skills | 10 | 2 points per match (max 5 matches) |
| **Max Total** | **100** | Capped at 100 |

## Test Results

- Schema tests: 44 passing (13 new)
- Fit scorer tests: 47 passing (all new)
- Total suite: 809 passing (no regressions)

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Inbox status position | First in enum | Represents arrival state before user review |
| Inbox transitions | Cannot go directly to applied | Ensures user reviews and classifies jobs |
| Fallback warning | console.warn | Visible but non-blocking for empty profiles |
| Salary minimum | Use highest across all targetRoles | Conservative approach for multi-role profiles |
| Skills matching cap | 5 skills max (10 points) | Prevents skill-heavy jobs from dominating score |

## Deviations from Plan

None - plan executed exactly as written.

## Files Changed

| File | Change |
|------|--------|
| schemas/job.schema.js | Added inbox status, VALID_TRANSITIONS, isValidTransition() |
| schemas/job.schema.test.js | Added 13 tests for inbox and transitions |
| mcp-server/src/services/fit-scorer.js | Created (316 lines) |
| mcp-server/src/services/fit-scorer.test.js | Created (607 lines) |

## Commits

| Hash | Message |
|------|---------|
| 3b0ca7d | feat(04-01): add inbox status and status transition validation |
| 4fd8827 | feat(04-01): create profile-based fit scoring service |
| 450c387 | test(04-01): add comprehensive fit scorer tests |

## Next Phase Readiness

Ready for 04-02 (Job Discovery Tools) with:
- `inbox` status available for new jobs from extension
- `isValidTransition()` available for status change validation
- `calculateFitScore()` available for scoring jobs against profile preferences
