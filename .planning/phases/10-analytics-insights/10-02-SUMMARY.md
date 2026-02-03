---
phase: 10-analytics-insights
plan: 02
subsystem: analytics
tags: [skill-gaps, criteria-evolution, recommendations, pattern-detection]

# Dependency graph
requires:
  - phase: 10-01
    provides: response rate analytics patterns
  - phase: 06-application-intelligence
    provides: resume-matcher.js with extractJobKeywords
  - phase: 06-application-intelligence
    provides: fit-config.js with loadFitConfig
provides:
  - Skill gap aggregation with frequency and context tracking
  - Gap trend analysis (new/closed/persistent/trending)
  - Criteria evolution recommendations with confidence levels
  - Preview impact of criteria changes on existing jobs
affects: [10-03, analytics-dashboard, criteria-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Minimum occurrence filter (3+) for statistical significance"
    - "Confidence levels based on sample size (very-low/low/medium/high)"
    - "Preview before apply for criteria changes"

key-files:
  created:
    - mcp-server/src/services/skill-gap-aggregator.js
    - mcp-server/src/services/skill-gap-aggregator.test.js
    - mcp-server/src/services/criteria-recommender.js
    - mcp-server/src/services/criteria-recommender.test.js
  modified: []

key-decisions:
  - "Minimum 3 occurrences for skill gaps to filter noise"
  - "Priority levels: high (10+), medium (5-9), low (3-4)"
  - "Minimum 5 outcomes before generating recommendations"
  - "Anomaly detection: high-score rejections and low-score acceptances"
  - "Preview shows exact score changes before applying criteria updates"

patterns-established:
  - "Pattern: Aggregation services reuse extractJobKeywords from resume-matcher"
  - "Pattern: Confidence calculation based on sample size thresholds"
  - "Pattern: Preview-before-apply for data-affecting changes"

# Metrics
duration: 5min
completed: 2026-02-03
---

# Phase 10 Plan 02: Skill Gap & Criteria Recommender Summary

**Skill gap aggregation from JD patterns with 3+ occurrence filter, criteria evolution recommendations with preview impact on existing job scores**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-03T14:35:37Z
- **Completed:** 2026-02-03T14:40:57Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- Skill gap aggregation that extracts gaps from JDs, filters by minimum occurrence, and tracks context (industries, roles)
- Gap trend analysis identifying new, closed, persistent, and trending skills across time periods
- Criteria recommender that correlates outcomes with fit scores and detects preference drift
- Preview system showing exactly how criteria changes would affect existing job scores

## Task Commits

Each task was committed atomically:

1. **Task 1: Skill Gap Aggregator Service** - `54f4ab7` (feat)
2. **Task 2: Criteria Recommender Service** - `13f0507` (feat)

## Files Created/Modified
- `mcp-server/src/services/skill-gap-aggregator.js` - Aggregates skill gaps from JDs with context tracking
- `mcp-server/src/services/skill-gap-aggregator.test.js` - 42 tests for gap aggregation
- `mcp-server/src/services/criteria-recommender.js` - Generates criteria evolution recommendations
- `mcp-server/src/services/criteria-recommender.test.js` - 43 tests for recommendations

## Decisions Made
- **Minimum occurrence threshold:** Set to 3 per RESEARCH.md Pitfall 5 to avoid skill gap explosion
- **Priority calculation:** High (10+), Medium (5-9), Low (3-4) occurrences for clear prioritization
- **Confidence thresholds:** Very-low (<5), Low (5-9), Medium (10-29), High (30+) per statistical best practices
- **Anomaly types:** Distinguish high-score-rejected vs low-score-accepted for targeted recommendations
- **Action types:** Learn (high priority), Highlight (medium, adjacent), Research (low priority)

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- Test for "closed gaps detection" initially failed due to logic checking against current profile instead of historical gaps - fixed by extracting all skills from previous period JDs first
- Pattern detection tests needed more jobs to meet MIN_SAMPLE_SIZE (5) threshold - adjusted test fixtures

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both services ready for MCP tool integration in 10-03
- aggregateSkillGaps, getGapTrends, getGapRecommendations exported
- analyzeOutcomes, generateRecommendations, previewCriteriaChange, applyCriteriaChange exported
- 85 total tests passing for both services

---
*Phase: 10-analytics-insights*
*Completed: 2026-02-03*
