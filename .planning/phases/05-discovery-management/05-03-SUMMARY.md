---
phase: "05"
plan: "03"
subsystem: discovery
tags: [fit-scoring, job-boards, config, mcp-tools]
requires: [04-01]
provides: [configurable-fit-criteria, board-registry, board-quality-tracking]
affects: [future-scanning, fit-evolution]
tech-stack:
  added: []
  patterns: [config-driven-scoring, quality-prioritization, safety-confirmation]
key-files:
  created:
    - mcp-server/data/fit-config.json
    - mcp-server/data/job-boards.json
    - mcp-server/src/services/fit-config.js
    - mcp-server/src/services/board-registry.js
    - mcp-server/src/tools/config.js
    - mcp-server/src/tools/boards.js
    - mcp-server/src/services/fit-config.test.js
    - mcp-server/src/services/board-registry.test.js
  modified:
    - mcp-server/src/services/fit-scorer.js
decisions:
  - id: fit-config-caching
    choice: Cache config for session performance with clearFitConfigCache() for testing
    reason: Avoid repeated file reads during scoring
  - id: default-completeness-50
    choice: Default dataCompleteness to 50% when not specified
    reason: Conservative middle ground for unknown board quality
  - id: blacklist-safety
    choice: Require userConfirmed=true for blacklistBoard
    reason: Prevent accidental removal of boards from scan rotation
metrics:
  duration: 6min
  completed: "2026-02-01"
---

# Phase 5 Plan 3: Configurable Fit Criteria and Board Registry Summary

**One-liner:** Configurable fit scoring with JSON-based criteria and job board registry with quality-based prioritization

## What Was Built

### Task 1: Fit Config System

Created a configurable fit criteria system that allows the fit scoring logic to evolve over time:

**fit-config.json**
- Initial config with criteria (titles, industries, locations, salaryMin)
- Scoring weights (BASE, ROLE_EXACT, INDUSTRY_PREFERRED, etc.)
- Evolution log for tracking criteria changes and job outcomes

**fit-config.js service**
- `loadFitConfig()` - Load from JSON or return defaults
- `saveFitConfig()` - Atomic write with temp-then-rename
- `updateFitCriteria()` - Update specific fields with optional reason logging
- `logOutcome()` - Track job outcomes (positive/negative/neutral) for evolution
- Evolution log capped at 100 entries

**fit-scorer.js updates**
- Now loads criteria and weights from fit-config.json
- Falls back to hardcoded defaults if config missing
- Config cached for performance with `clearFitConfigCache()` for testing
- Full backward compatibility maintained

### Task 2: Board Registry System

Created a job board quality registry for tracking and prioritizing boards:

**job-boards.json**
- Initial boards: Lever (95), Greenhouse (90), LinkedIn (75), Indeed (70)
- Each board has: status, quality rating, data completeness, metrics, CSS selectors
- Separate arrays for active boards, blacklist, and testing boards

**board-registry.js service**
- `loadBoardRegistry()` / `saveBoardRegistry()` - Registry persistence
- `getBoardsForScan()` - Active boards sorted by quality rating
- `addBoardForTesting()` - Add new board to testing queue
- `updateBoardMetrics()` - Update metrics and recalculate quality
- `blacklistBoard()` - Requires `userConfirmed=true` for safety
- `promoteBoardToActive()` - Move tested board to active rotation

### Task 3: MCP Tools and Tests

**config.js MCP tools**
- `getFitConfig` - Get current criteria and weights
- `updateFitConfig` - Update criteria with reason logging
- `logJobOutcome` - Record job outcome for evolution

**boards.js MCP tools**
- `getJobBoards` - Get active boards sorted by quality
- `addTestBoard` - Add new board for testing
- `blacklistBoard` - Blacklist with safety confirmation
- `recordScanResults` - Update metrics after scanning

**Tests**
- fit-config.test.js: 23 tests covering config loading, saving, evolution
- board-registry.test.js: 41 tests including blacklist safety, quality prioritization

## Requirements Satisfied

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| DISC-10 | Fit criteria configurable via fit-config.json, evolvable via logOutcome | Complete |
| DISC-11 | Job board registry with quality ratings in job-boards.json | Complete |
| DISC-12 | New boards tested via addBoardForTesting | Complete |
| DISC-13 | getBoardsForScan returns boards sorted by quality (highest first) | Complete |
| DISC-14 | blacklistBoard requires userConfirmed=true | Complete |

## MCP Tools Added

| Tool | Purpose |
|------|---------|
| getFitConfig | Get current fit criteria and weights |
| updateFitConfig | Update fit criteria with reason |
| logJobOutcome | Log outcome for evolution tracking |
| getJobBoards | Get active boards by quality |
| addTestBoard | Add new board for testing |
| blacklistBoard | Blacklist with confirmation |
| recordScanResults | Update board metrics |

## Decisions Made

1. **Config Caching**: Cache fit config in memory for session performance. Call `clearFitConfigCache()` in tests to reset.

2. **Default Data Completeness**: When board has no dataCompleteness set, default to 50% (conservative middle ground).

3. **Blacklist Safety**: Require `userConfirmed: true` parameter to blacklist a board. Returns confirmation prompt if not provided.

4. **Quality Calculation**: Board quality = (success rate * 70%) + (base completeness * 30%). Recalculated on each metrics update.

5. **Evolution Log Cap**: Limit evolution log to 100 entries (rolling window) to prevent unbounded growth.

## Test Coverage

- 64 new tests added
- fit-config.test.js: Config loading, saving, criteria updates, outcome logging
- board-registry.test.js: Registry operations, quality sorting, blacklist safety

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Ready for Phase 5 Plan 4 (if any) or Phase 6. The configurable fit criteria and board registry provide:
- Foundation for fit criteria evolution based on outcomes
- Quality-prioritized board scanning
- Safe board blacklisting workflow
