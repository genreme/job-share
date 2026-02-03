---
phase: 10-analytics-insights
plan: 03
subsystem: analytics-tools
tags: [mcp, analytics, funnel, response-rates, skill-gaps, criteria-evolution, snapshots]

dependency-graph:
  requires: [10-01, 10-02]
  provides: [analytics-mcp-tools, snapshot-persistence]
  affects: []

tech-stack:
  added: []
  patterns: [mcp-tool-handlers, snapshot-persistence, service-delegation]

key-files:
  created:
    - mcp-server/src/tools/analytics.js
    - mcp-server/src/tools/analytics.test.js
    - mcp-server/data/analytics-snapshots.json
  modified:
    - mcp-server/src/index.js

decisions:
  - key: tool-names-match-services
    choice: MCP tool names mirror service function names for clarity
    reason: Easy to trace tool calls to implementations
  - key: snapshot-rolling-window
    choice: 90-day rolling window for snapshot retention
    reason: Per RESEARCH.md, keeps storage bounded while enabling trends

metrics:
  duration: 4m32s
  completed: 2026-02-03
---

# Phase 10 Plan 03: MCP Tools & Snapshot Persistence Summary

**One-liner:** 12 MCP tools exposing analytics to Claude with 90-day snapshot persistence for trend analysis.

## What Was Done

### Task 1: Analytics MCP Tools (12 handlers)

Created `mcp-server/src/tools/analytics.js` with handlers for all analytics functionality:

**Funnel Tools (ANLT-01):**
1. `get_funnel_metrics` - Sankey diagram data with date presets (7d/30d/90d/all) or custom range

**Response Rate Tools (ANLT-02):**
2. `get_response_rates` - Dimension-based rates (companySize, industry, applicationMethod, jobBoard, roleType) with confidence
3. `get_time_to_response` - Response time distribution with percentiles and display format

**Time-in-Stage Tools (ANLT-05):**
4. `get_time_in_stage` - Duration metrics per status or all stages
5. `get_bottlenecks` - Process bottlenecks exceeding threshold with recommendations

**Skill Gap Tools (ANLT-03):**
6. `get_skill_gaps` - Aggregated gaps with frequency, context, and priority
7. `get_skill_gap_recommendations` - Actionable recommendations (learn/highlight/research)

**Criteria Evolution Tools (ANLT-04):**
8. `get_criteria_recommendations` - Fit criteria evolution suggestions from outcome analysis
9. `preview_criteria_change` - Impact preview showing affected jobs and score deltas
10. `apply_criteria_change` - Apply changes with audit trail

**Snapshot Tools:**
11. `get_analytics_snapshot` - Current or historical snapshot by date
12. `save_analytics_snapshot` - Persist current state with 90-day rolling window

55 tests covering all handlers with edge cases and error handling.

### Task 2: Snapshot Persistence and Server Registration

**Snapshot File:**
- Created `analytics-snapshots.json` with `{ version, snapshots: [], lastSnapshot }` structure
- Implemented `loadSnapshots()`, `saveSnapshots()`, `cleanOldSnapshots()` functions
- 90-day rolling window keeps storage bounded

**MCP Server Registration:**
- Added Phase 10 imports in `index.js`
- Added 12 tool definitions with input schemas
- Added 12 case handlers in switch statement
- Fixed import: `calculateTimeToResponse` is from `time-in-stage.js`

## Technical Patterns

### Tool Handler Pattern
```javascript
export function getSkillGaps(args = {}) {
  const jobs = loadJobsData()
  const profile = loadProfileData()
  const minOccurrences = args.minOccurrences || 3
  const gaps = aggregateSkillGaps(jobs, profile)
  return { gaps: gaps.filter(g => g.count >= minOccurrences), total: gaps.length }
}
```

### Snapshot Persistence Pattern
```javascript
function saveSnapshots(data) {
  try {
    writeFileSync(SNAPSHOTS_FILE, JSON.stringify(data, null, 2))
    return true
  } catch (e) {
    console.error('Error saving snapshots:', e.message)
    return false
  }
}
```

## Verification Results

- `npm test -- --run mcp-server/src/tools/analytics.test.js`: 55 tests pass
- `npm test -- --run`: 2277 of 2279 tests pass (2 pre-existing failures unrelated)
- MCP server imports successfully without errors
- All 12 tools registered and callable

## Files Changed

| File | Change |
|------|--------|
| `mcp-server/src/tools/analytics.js` | Created - 12 tool handlers |
| `mcp-server/src/tools/analytics.test.js` | Created - 55 tests |
| `mcp-server/data/analytics-snapshots.json` | Created - Initial structure |
| `mcp-server/src/index.js` | Modified - Tool registration |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed incorrect import path**
- **Found during:** Task 2
- **Issue:** `calculateTimeToResponse` was incorrectly imported from `response-rate-analyzer.js`
- **Fix:** Changed import to source from `time-in-stage.js` where the function is actually exported
- **Files modified:** `mcp-server/src/tools/analytics.js`
- **Commit:** c81b4fb

## Commits

| Commit | Description |
|--------|-------------|
| ffc79a9 | feat(10-03): add analytics MCP tools with 12 handlers |
| c81b4fb | feat(10-03): register analytics tools in MCP server |

## Phase Completion

This was the **FINAL plan of the FINAL phase**.

**Phase 10: Analytics & Insights - COMPLETE**
- 10-01: Funnel Calculator & Response Rate Analyzer
- 10-02: Skill Gap Aggregator & Criteria Recommender
- 10-03: MCP Tools & Snapshot Persistence (this plan)

**Milestone M1: Job Search Command Center - COMPLETE**
- 10 phases, 35 plans, all requirements implemented
- Full MCP integration enabling Claude to:
  - Manage job pipeline with fit scoring
  - Generate tailored resumes and cover letters
  - Prepare for interviews with practice sessions
  - Learn from interview outcomes
  - Analyze application funnel and skill gaps
  - Evolve fit criteria based on outcomes
