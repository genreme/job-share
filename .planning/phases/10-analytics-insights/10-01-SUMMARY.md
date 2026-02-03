---
phase: 10-analytics-insights
plan: 01
subsystem: analytics
tags: [sankey, statistics, aggregation, date-fns, percentiles, confidence]

# Dependency graph
requires:
  - phase: 01-qa-layer
    provides: Job schema validation (JobStatusSchema)
provides:
  - Funnel calculator for Sankey diagram visualization
  - Response rate analyzer with confidence levels
  - Time-in-stage metrics with bottleneck detection
affects: [10-02, 10-03, dashboard, analytics-tools]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Confidence-flagged statistics (n<5 very-low, n<10 low, n<30 medium)
    - Percentile calculation without external dependency
    - Dimension-based filtering for breakdown analysis

key-files:
  created:
    - mcp-server/src/services/funnel-calculator.js
    - mcp-server/src/services/funnel-calculator.test.js
    - mcp-server/src/services/response-rate-analyzer.js
    - mcp-server/src/services/response-rate-analyzer.test.js
    - mcp-server/src/services/time-in-stage.js
    - mcp-server/src/services/time-in-stage.test.js
  modified: []

key-decisions:
  - "Nodes represent current state counts, links show transitions (Sankey pattern)"
  - "Derive interviewing/offer stages from job.updates keywords, not schema statuses"
  - "Implement percentile calculation inline to avoid new dependency"
  - "Separate acknowledgment rate (any response) from positive response rate (interview/offer)"

patterns-established:
  - "Confidence thresholds: n<5 very-low, n<10 low, n<30 medium, n>=30 high"
  - "Display format for rates: 'X% (n=Y)' or 'X% (n=Y) low confidence'"
  - "Display format for time-to-response: 'X days avg, 80% within Y days'"
  - "Dimension filtering with 'Unknown' grouping for null values"

# Metrics
duration: 7min
completed: 2026-02-03
---

# Phase 10 Plan 01: Core Analytics Services Summary

**Sankey funnel calculator, response rate analyzer with confidence levels, and time-in-stage metrics with bottleneck detection**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-03T14:35:35Z
- **Completed:** 2026-02-03T14:42:30Z
- **Tasks:** 3
- **Files created:** 6

## Accomplishments
- Funnel calculator producing Sankey-ready nodes/links from job data with date range filtering
- Response rate analyzer with dimension breakdowns (industry, companySize, jobBoard, etc.) and confidence indicators
- Time-in-stage metrics with percentile distributions and actionable bottleneck recommendations
- 102 comprehensive tests covering edge cases, null handling, and statistical accuracy

## Task Commits

Each task was committed atomically:

1. **Task 1: Funnel Calculator Service** - `2345265` (feat)
2. **Task 2: Response Rate Analyzer Service** - `5b47ce6` (feat)
3. **Task 3: Time-in-Stage Service** - `fb26c26` (feat)

## Files Created

- `mcp-server/src/services/funnel-calculator.js` - Sankey diagram data generation with derived stages
- `mcp-server/src/services/funnel-calculator.test.js` - 40 tests for funnel calculations
- `mcp-server/src/services/response-rate-analyzer.js` - Dimension-based rate calculations with confidence
- `mcp-server/src/services/response-rate-analyzer.test.js` - 31 tests for rate analysis
- `mcp-server/src/services/time-in-stage.js` - Duration metrics and bottleneck detection
- `mcp-server/src/services/time-in-stage.test.js` - 31 tests for time metrics

## Decisions Made

1. **Nodes vs Links:** Sankey nodes represent where jobs currently ARE (counts), while links show flow transitions. A job in apply-now creates a link from inbox->apply-now but only an apply-now node.

2. **Derived Stages:** Interview and offer stages are derived from job.updates keywords rather than adding new schema statuses. Keywords like "phone screen", "assessment", "offer" trigger stage detection.

3. **Percentile Implementation:** Implemented linear interpolation percentile calculation inline to avoid adding simple-statistics dependency. Handles edge cases (single value, even counts) correctly.

4. **Dual Response Metrics:** Per CONTEXT.md, track both acknowledgment rate (any response including rejections) and positive response rate (interviews/offers only) separately.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all implementations followed research guidance and passed tests on first run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three services export clean APIs ready for MCP tool integration (10-02)
- Confidence levels and display formatting ready for dashboard consumption (10-03)
- Date range filtering enables time-based analytics views
- Bottleneck recommendations can be surfaced in dashboard badges

---
*Phase: 10-analytics-insights*
*Completed: 2026-02-03*
