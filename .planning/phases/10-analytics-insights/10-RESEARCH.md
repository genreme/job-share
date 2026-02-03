# Phase 10: Analytics & Insights - Research

**Researched:** 2026-02-02
**Domain:** Data visualization, analytics aggregation, statistical analysis
**Confidence:** MEDIUM

## Summary

This phase builds an analytics dashboard that visualizes job search patterns and provides actionable insights for strategy evolution. The primary visualization is a Sankey diagram showing job flow through pipeline stages (inbox -> researching -> applied -> interviewing -> offer -> accepted/rejected/withdrawn). Response rate breakdowns, skill gap aggregation, and criteria evolution recommendations round out the analytics suite.

Research confirms D3.js with d3-sankey is the standard approach for Sankey diagrams in vanilla JS environments. Chart.js with chartjs-adapter-date-fns handles time-series visualization for trends. Statistical confidence calculations for small sample sizes follow the n < 30 rule for t-distribution, with thresholds at n=5 (very low) and n=10 (low confidence flags).

The existing codebase already has patterns for: fit scoring evolution (fit-config.js with evolutionLog), skill gap detection (resume-matcher.js with keyword extraction), and time-series tracking (job updates with timestamps). Analytics services will aggregate these existing data sources.

**Primary recommendation:** Use d3-sankey for the funnel Sankey diagram, aggregate data from existing jobs.json with derived timestamps, store historical snapshots in a new analytics-snapshots.json file for trend analysis, and surface recommendations via a dashboard badge/panel (not toast notifications).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| d3-sankey | 0.12+ | Sankey diagram rendering | Official D3 module, well-documented, mature |
| d3 | 7.x | DOM manipulation for SVG | Required dependency for d3-sankey |
| Chart.js | 4.x | Line/bar charts for trends | Already lightweight, works with vanilla JS |
| chartjs-adapter-date-fns | 3.x | Date axis support | Required for time-series in Chart.js |
| date-fns | 2.x | Date manipulation | Already in project (from Phase 2) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| simple-statistics | 7.x | Statistical calculations | Confidence intervals, averages, percentiles |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| d3-sankey | skd3 | Simpler API but less control; stick with d3-sankey for flexibility |
| Chart.js | Plotly.js | Plotly more powerful but heavier; Chart.js sufficient for trends |
| simple-statistics | hand-rolled | Statistical edge cases are tricky; library handles them correctly |

**Installation:**
```bash
npm install d3 d3-sankey simple-statistics
# Chart.js and chartjs-adapter-date-fns via CDN in index.html
```

## Architecture Patterns

### Recommended Project Structure
```
mcp-server/
├── src/
│   ├── services/
│   │   ├── analytics-aggregator.js     # Core aggregation logic
│   │   ├── funnel-calculator.js        # Sankey node/link calculations
│   │   ├── response-rate-analyzer.js   # Dimension breakdowns
│   │   ├── skill-gap-aggregator.js     # JD pattern accumulation
│   │   └── criteria-recommender.js     # Evolution suggestions
│   └── tools/
│       └── analytics.js                # MCP tool handlers
├── data/
│   ├── analytics-snapshots.json        # Historical snapshots for trends
│   └── skill-gap-cache.json            # Aggregated skill gap data
```

### Pattern 1: Aggregation Service Pattern
**What:** Service that computes metrics from existing data sources on-demand
**When to use:** Dashboard data requests, computing funnel metrics
**Example:**
```javascript
// Source: Existing codebase pattern from fit-config.js
export function calculateFunnelMetrics(jobs, dateRange) {
  const { start, end } = dateRange

  // Filter jobs by date range
  const filteredJobs = jobs.filter(job => {
    const foundDate = job.found ? new Date(job.found) : null
    return foundDate && foundDate >= start && foundDate <= end
  })

  // Count by status (derive from current status + timestamp history)
  const nodes = [
    { id: 'inbox', name: 'Inbox' },
    { id: 'researching', name: 'Researching' },
    { id: 'applied', name: 'Applied' },
    { id: 'interviewing', name: 'Interviewing' },
    { id: 'offer', name: 'Offer' },
    { id: 'accepted', name: 'Accepted' },
    { id: 'rejected', name: 'Rejected' },
    { id: 'withdrawn', name: 'Withdrawn' }
  ]

  // Calculate flows between stages
  const links = calculateFlows(filteredJobs)

  return { nodes, links, totalJobs: filteredJobs.length }
}
```

### Pattern 2: Snapshot-Based Trend Storage
**What:** Store periodic snapshots to enable historical trend analysis
**When to use:** Tracking metrics over time without recomputing from raw data
**Example:**
```javascript
// analytics-snapshots.json structure
{
  "version": "1.0",
  "snapshots": [
    {
      "date": "2026-02-01",
      "metrics": {
        "totalJobs": 150,
        "byStatus": { "inbox": 20, "applied": 45, "interviewing": 10 },
        "responseRate": 0.35,
        "avgTimeToResponse": 7.2
      }
    }
  ],
  "lastSnapshot": "2026-02-01T00:00:00Z"
}
```

### Pattern 3: Confidence-Flagged Statistics
**What:** Include sample size and confidence level with all rate calculations
**When to use:** Any percentage or average displayed to user
**Example:**
```javascript
// Per CONTEXT.md: Full confidence display
function calculateRateWithConfidence(successes, total) {
  const rate = total > 0 ? successes / total : 0

  // Confidence thresholds per statistical research:
  // n < 5: very low (too small for meaningful inference)
  // n < 10: low (flag for user)
  // n < 30: medium (use t-distribution)
  // n >= 30: high (normal distribution)

  let confidence = 'high'
  if (total < 5) confidence = 'very-low'
  else if (total < 10) confidence = 'low'
  else if (total < 30) confidence = 'medium'

  return {
    rate: Math.round(rate * 100),
    sampleSize: total,
    confidence,
    display: `${Math.round(rate * 100)}% (n=${total})${confidence === 'low' || confidence === 'very-low' ? ' low confidence' : ''}`
  }
}
```

### Anti-Patterns to Avoid
- **Computing metrics on every render:** Cache aggregations, update on data change
- **Storing derived data in jobs.json:** Keep analytics separate from source data
- **Displaying percentages without sample size:** Always show n=X for transparency
- **Hard-coding stage names:** Use JobStatusSchema as source of truth

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sankey layout algorithm | Custom flow positioning | d3-sankey | Node positioning, link routing, iteration refinement are complex |
| Statistical confidence intervals | Manual z/t calculations | simple-statistics | Edge cases for small samples, t-distribution tables |
| Date range handling | Manual date math | date-fns | Timezone handling, DST, leap years |
| SVG path generation | Manual Bezier curves | d3.sankeyLinkHorizontal() | Correct curve interpolation, stroke-width handling |
| Percentile calculations | Sorting + index math | simple-statistics.quantile() | Handles edge cases, interpolation options |

**Key insight:** Statistical calculations and visualization layouts have subtle edge cases that take weeks to discover through testing. Libraries encode years of production experience.

## Common Pitfalls

### Pitfall 1: Status History Not Captured
**What goes wrong:** Jobs only have current status, cannot reconstruct flow path
**Why it happens:** Original schema focused on current state, not history
**How to avoid:** Derive stage transitions from: (1) job.updates array timestamps, (2) status-specific date fields (applied, posted, found), (3) current status as final state
**Warning signs:** Sankey shows all jobs going directly from inbox to current status

### Pitfall 2: Small Sample Statistical Overconfidence
**What goes wrong:** "45% response rate" displayed from n=2 samples misleads user
**Why it happens:** Developers focus on calculation, not statistical validity
**How to avoid:** Always display sample size, flag n < 10, use t-distribution for intervals with n < 30
**Warning signs:** Wildly varying rates between similar categories

### Pitfall 3: Stale Aggregations
**What goes wrong:** Dashboard shows outdated metrics after data changes
**Why it happens:** Caching without invalidation
**How to avoid:** Compute on-demand for small datasets, or invalidate cache when jobs.json changes (check mtime or version field)
**Warning signs:** User adds job but funnel numbers don't change

### Pitfall 4: Date Range Boundary Errors
**What goes wrong:** Jobs at exactly midnight excluded, timezone confusion
**Why it happens:** String comparison vs Date comparison, local vs UTC
**How to avoid:** Always parse to Date objects, use date-fns for comparison, store and compare in UTC
**Warning signs:** Off-by-one in daily counts

### Pitfall 5: Skill Gap Explosion
**What goes wrong:** Hundreds of "missing skills" listed (every JD keyword)
**Why it happens:** Raw keyword extraction without aggregation/filtering
**How to avoid:** Aggregate by frequency (count across JDs), filter by minimum occurrence (n >= 3), group by category
**Warning signs:** Skill gap list longer than actual JDs analyzed

### Pitfall 6: Criteria Recommendations Without Impact Preview
**What goes wrong:** User applies recommendation, scores change unexpectedly
**Why it happens:** Recommendation generated without calculating effect
**How to avoid:** Per CONTEXT.md, always preview impact on existing job scores before applying
**Warning signs:** User asks "why did my job X score drop?"

## Code Examples

Verified patterns from official sources:

### Sankey Diagram Setup (d3-sankey)
```javascript
// Source: https://github.com/d3/d3-sankey
import * as d3 from 'd3'
import { sankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey'

function renderFunnelSankey(container, data) {
  const width = 960
  const height = 500

  // Create Sankey generator
  const sankeyGenerator = sankey()
    .nodeId(d => d.id)
    .nodeAlign(sankeyJustify)
    .nodeWidth(20)
    .nodePadding(10)
    .extent([[1, 1], [width - 1, height - 5]])

  // Process data
  const { nodes, links } = sankeyGenerator({
    nodes: data.nodes.map(d => ({ ...d })),
    links: data.links.map(d => ({ ...d }))
  })

  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', [0, 0, width, height])

  // Draw links
  svg.append('g')
    .attr('fill', 'none')
    .selectAll('path')
    .data(links)
    .join('path')
    .attr('d', sankeyLinkHorizontal())
    .attr('stroke', d => getStatusColor(d.source.id))
    .attr('stroke-opacity', 0.5)
    .attr('stroke-width', d => Math.max(1, d.width))

  // Draw nodes
  svg.append('g')
    .selectAll('rect')
    .data(nodes)
    .join('rect')
    .attr('x', d => d.x0)
    .attr('y', d => d.y0)
    .attr('height', d => d.y1 - d.y0)
    .attr('width', d => d.x1 - d.x0)
    .attr('fill', d => getStatusColor(d.id))

  // Add labels
  svg.append('g')
    .selectAll('text')
    .data(nodes)
    .join('text')
    .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
    .attr('y', d => (d.y1 + d.y0) / 2)
    .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
    .text(d => `${d.name}: ${d.value}`)
}
```

### Time-Series Chart (Chart.js)
```javascript
// Source: https://www.chartjs.org/docs/latest/axes/cartesian/timeseries.html
// Requires: chartjs-adapter-date-fns

function renderTrendChart(canvas, snapshots, metric) {
  const data = snapshots.map(s => ({
    x: new Date(s.date),
    y: s.metrics[metric]
  }))

  new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [{
        label: metric,
        data: data,
        borderColor: '#667eea',
        tension: 0.1
      }]
    },
    options: {
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'day',
            displayFormats: { day: 'MMM d' }
          }
        },
        y: {
          beginAtZero: true
        }
      }
    }
  })
}
```

### Response Rate Calculation with Confidence
```javascript
// Source: Statistical best practices for small samples
// Reference: https://sphweb.bumc.bu.edu/otlt/MPH-Modules/PH717-QuantCore/PH717-Module6-RandomError/PH717-Module6-RandomError11.html

function calculateResponseRate(jobs, dimension, value) {
  // Filter jobs by dimension
  const filtered = jobs.filter(job => {
    switch(dimension) {
      case 'companySize': return job.companySize === value
      case 'industry': return job.industry === value
      case 'applicationMethod': return job.applicationMethod === value
      case 'jobBoard': return job.sources?.includes(value)
      case 'roleType': return job.roleType === value
      default: return true
    }
  })

  // Count responses (any status beyond applied)
  const applied = filtered.filter(j => j.status === 'applied' || j.appliedDate)
  const responded = applied.filter(j =>
    j.status === 'interviewing' ||
    j.status === 'offer' ||
    j.updates?.some(u => u.type === 'response')
  )

  const total = applied.length
  const positives = responded.length

  // Calculate with confidence
  return {
    dimension,
    value,
    rate: total > 0 ? Math.round((positives / total) * 100) : 0,
    sampleSize: total,
    confidence: total < 5 ? 'very-low' : total < 10 ? 'low' : total < 30 ? 'medium' : 'high',
    positiveResponses: positives
  }
}
```

### Skill Gap Aggregation
```javascript
// Build on existing resume-matcher.js pattern
import { extractJobKeywords, SKILL_PATTERNS } from './resume-matcher.js'

function aggregateSkillGaps(jobs, profile) {
  const gapCounts = new Map()
  const gapContext = new Map()

  // Process each job with description
  for (const job of jobs) {
    if (!job.description && !job.notes) continue

    const { skills } = extractJobKeywords(job.description || job.notes)
    const profileSkills = (profile?.skills || []).map(s => s.name.toLowerCase())

    for (const skill of skills) {
      // Check if profile has this skill
      const hasSkill = profileSkills.some(ps =>
        ps.includes(skill) || skill.includes(ps)
      )

      if (!hasSkill) {
        // Increment gap count
        gapCounts.set(skill, (gapCounts.get(skill) || 0) + 1)

        // Track context (which industries/roles request this)
        if (!gapContext.has(skill)) {
          gapContext.set(skill, { industries: new Set(), roles: new Set() })
        }
        if (job.industry) gapContext.get(skill).industries.add(job.industry)
        if (job.title) gapContext.get(skill).roles.add(job.title)
      }
    }
  }

  // Sort by frequency, filter minimum occurrences
  const gaps = [...gapCounts.entries()]
    .filter(([_, count]) => count >= 3) // Minimum 3 occurrences
    .sort((a, b) => b[1] - a[1])
    .map(([skill, count]) => ({
      skill,
      count,
      industries: [...(gapContext.get(skill)?.industries || [])],
      roles: [...(gapContext.get(skill)?.roles || [])]
    }))

  return gaps
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static funnel charts | Interactive Sankey with flow paths | 2024+ | Shows WHERE jobs go at each stage, not just counts |
| Percentages only | Rate + confidence indicators | Always best practice | Users understand data limitations |
| Manual skill review | Aggregated pattern detection | AI era | Scales to hundreds of JDs |
| Annual criteria review | Continuous background analysis | 2025+ | Real-time strategy adaptation |

**Deprecated/outdated:**
- D3 v3 Sankey: Use v7 d3-sankey module (standalone import)
- Chart.js v2 time axis: v4 requires adapter, different config structure

## Open Questions

Things that couldn't be fully resolved:

1. **Snapshot frequency for trend analysis**
   - What we know: Daily snapshots sufficient for weekly/monthly trends
   - What's unclear: Performance impact of computing snapshot, best time to trigger
   - Recommendation: Compute snapshot on demand when dashboard loads if last snapshot > 24h old

2. **Recommendation surfacing mechanism**
   - What we know: CONTEXT.md says "continuous analysis, surfaces when confident"
   - What's unclear: How to present without interrupting workflow
   - Recommendation: Dashboard badge showing "3 recommendations" that opens panel; avoid toasts

3. **Interviewing/offer stage granularity**
   - What we know: CONTEXT.md mentions statuses "inbox, researching, applied, interviewing, offer, accepted, rejected, withdrawn" but current JobStatusSchema has different statuses
   - What's unclear: Whether to add new statuses or derive from updates
   - Recommendation: Derive interview/offer from job.updates array entries rather than adding schema statuses

4. **Historical data bootstrapping**
   - What we know: Existing jobs have minimal timestamp history
   - What's unclear: How to show trends without historical snapshots
   - Recommendation: Start collecting snapshots now; show "insufficient data" for trends until 7+ days of snapshots

## Sources

### Primary (HIGH confidence)
- [d3/d3-sankey GitHub](https://github.com/d3/d3-sankey) - API documentation, data format
- [Chart.js Time Scale](https://www.chartjs.org/docs/latest/axes/cartesian/timeseries.html) - Time series configuration
- [Chart.js Line Chart](https://www.chartjs.org/docs/latest/charts/line.html) - Styling and options

### Secondary (MEDIUM confidence)
- [D3 Graph Gallery Sankey](https://d3-graph-gallery.com/sankey.html) - Implementation examples
- [BU School of Public Health - Confidence Intervals](https://sphweb.bumc.bu.edu/otlt/MPH-Modules/PH717-QuantCore/PH717-Module6-RandomError/PH717-Module6-RandomError11.html) - Small sample statistics
- [Statology - Tests for Small Sample Sizes](https://www.statology.org/5-statistical-tests-for-small-sample-sizes-when-n-30/) - n < 30 threshold

### Tertiary (LOW confidence)
- WebSearch results for analytics dashboard patterns - general guidance, needs validation
- WebSearch results for skill gap analysis algorithms - AI/ML approaches beyond scope, regex approach validated by existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - d3-sankey well-documented but integration with vanilla JS dashboard needs verification
- Architecture: HIGH - Patterns match existing codebase (fit-config.js, resume-matcher.js)
- Pitfalls: MEDIUM - Derived from statistical best practices and experience patterns
- Code examples: HIGH - Sourced from official documentation

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable domain, libraries mature)
