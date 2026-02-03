# Phase 10: Analytics & Insights - Context Document

## Overview

This document captures user decisions from the discuss-phase session for Phase 10.
Created: 2026-02-02

## Gray Areas Discussed

### 1. Funnel Visualization

**Chart Type**
- Decision: **Sankey diagram**
- Rationale: Shows where jobs go at each stage with flow visualization, more informative than simple bar chart or stacked funnel

**Funnel Stages**
- Decision: **Match existing JobStatusSchema**
- Stages: inbox → researching → applied → interviewing → offer → accepted/rejected/withdrawn
- Rationale: Consistency with existing data model, no separate "analytics stages" to maintain

**Time Ranges**
- Decision: **Both fixed presets and custom date picker**
- Presets: Last 7 days, 30 days, 90 days, All time
- Custom: Date range picker for specific analysis periods

**Metrics Display**
- Decision: **Both absolute numbers and percentages**
- Format: Show counts with conversion rates (e.g., "50 applied → 20 screened (40%)")
- Rationale: Full picture of volume and conversion efficiency

### 2. Response Rate Breakdowns

**Dimensions**
- Decision: **All dimensions**
- Breakdowns include:
  - Company size (startup, mid-size, enterprise)
  - Industry
  - Application method (direct apply, referral, recruiter, cold outreach)
  - Job board source
  - Role type

**Response Definition**
- Decision: **Both metrics tracked separately**
- Acknowledgment rate: Any response including rejections
- Positive response rate: Screen/interview requests only
- Rationale: Measures both "did they see it?" and "did they want me?"

**Statistical Indicators**
- Decision: **Full confidence display**
- Show: Rate percentage, sample size (n=X), low-confidence flag for small samples
- Example: "35% (n=20)" or "40% (n=3) ⚠️ low confidence"

**Time-to-Response**
- Decision: **Distribution tracking**
- Show: Average days + distribution percentiles
- Example: "7 days avg, 80% within 14 days"
- Rationale: Helps set realistic expectations

### 3. Skill Gap Insights

**Gap Detection Method**
- Decision: **Both keyword and semantic matching**
- Keyword: Extract explicit skill mentions from JDs
- Semantic: AI understanding of requirements vs experience
- Rationale: Comprehensive gap analysis catching both explicit and implied requirements

**Aggregation**
- Decision: **Full context with trends**
- Show:
  - Counts (how many JDs mention each skill)
  - Trends (increasing/decreasing demand over time)
  - Context (which job types/industries request each skill)

**Recommendations**
- Decision: **Full guidance**
- Provide:
  - Priority ranking based on frequency and impact
  - Suggestions aligned to target roles
  - Actionable guidance on which gaps to address first

**Progress Tracking**
- Decision: **Full gap evolution history**
- Track:
  - Closed gaps (skills added that addressed gaps)
  - New gaps (emerging skill requirements)
  - Persistent gaps (long-standing unaddressed areas)

### 4. Criteria Evolution

**Triggers**
- Decision: **Both outcome and pattern triggers**
- Outcome-based: Correlate criteria with rejections/offers
- Pattern-based: Analyze what you apply to vs. fit scores
- Rationale: Multi-signal approach for robust recommendations

**Application Method**
- Decision: **Preview before apply**
- Flow:
  1. System suggests criteria changes
  2. Shows impact preview (how existing job scores would change)
  3. User reviews and applies with one click
- Rationale: Informed decision-making with clear impact visibility

**History**
- Decision: **Full audit trail**
- Track:
  - What changed and when
  - Why it was recommended
  - Outcomes after each change (did results improve?)
- Rationale: Learn what criteria adjustments actually help

**Frequency**
- Decision: **Continuous analysis**
- System always analyzing in background
- Surfaces recommendations when confidence is high enough
- No manual triggering required

## Implementation Notes

### Data Sources
- Job data from jobs.json (status, dates, company info)
- Fit scores from existing scoring service
- Interview data from Phase 8-9 (outcomes, learnings)
- Profile skills from master-profile.json

### Dashboard Components
1. **Funnel View**: Sankey diagram with stage counts and percentages
2. **Response Rates**: Tabular breakdowns with confidence indicators
3. **Skill Gaps**: Card-based display with trends and recommendations
4. **Criteria Evolution**: Timeline view with change impact

### Technical Considerations
- Time-series data for trends (need historical snapshots or derive from timestamps)
- Confidence calculations (sample size thresholds)
- Sankey diagram library (D3.js sankey or similar)
- Caching for expensive aggregations

## Requirements Mapping

| Requirement | Decision Coverage |
|-------------|-------------------|
| ANLT-01: Funnel visualization | Sankey diagram, match job statuses, counts+percentages |
| ANLT-02: Response rates | All dimensions, both metrics, confidence indicators |
| ANLT-03: Skill gaps | Keyword+semantic, trends, priority guidance |
| ANLT-04: Criteria evolution | Outcome+pattern triggers, preview, audit trail |
| ANLT-05: Time-in-stage | Covered by response time distribution |

## Open Questions for Planning

1. Where to store historical snapshots for trend analysis?
2. What D3/charting library for Sankey diagram?
3. Confidence threshold for "low sample" warning (n < 5? n < 10?)
4. How to surface continuous recommendations (toast? dashboard badge?)
