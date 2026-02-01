---
phase: 06-application-intelligence
plan: 03
subsystem: followup
tags: [followup, reminders, suggestions, mcp-tools, date-fns]

dependency-graph:
  requires: [06-01, 06-02]
  provides: [followup-engine, followup-tools, time-based-reminders, smart-suggestions]
  affects: [07]

tech-stack:
  added: []
  patterns: [time-based-rules, priority-sorting, contact-aware-suggestions]

key-files:
  created:
    - mcp-server/src/services/followup-engine.js
    - mcp-server/src/services/followup-engine.test.js
    - mcp-server/src/tools/followup.js
    - mcp-server/src/tools/followup.test.js
  modified: []

decisions:
  - id: boundary-exclusivity
    choice: "Rule boundaries use exclusive upper bounds (7-13 for low, 14-20 for medium)"
    reason: "Prevents overlap at boundaries ensuring each day maps to exactly one priority"
  - id: interview-detection
    choice: "Recent interview detection triggers within 2 days for thank-you reminder"
    reason: "24-48 hour window captures standard thank-you timing best practice"
  - id: queue-limit-default
    choice: "Default limit of 10 for getFollowupQueue, 1000 for summary"
    reason: "Daily review benefits from focused list, summary needs full data for stats"
  - id: contact-filtering
    choice: "Suggestions only consider structured contacts, not legacy strings"
    reason: "Legacy strings lack reachedOut/lastInteraction fields needed for suggestions"

metrics:
  duration: 5 min
  completed: 2026-02-01
---

# Phase 6 Plan 3: Follow-up Engine with Smart Suggestions Summary

**Time-based follow-up reminders with priority queue and context-aware suggestions based on application stage and contacts.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-01T16:47:00Z
- **Completed:** 2026-02-01T16:52:00Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments

- Follow-up rules define timing thresholds by status (applied: 7/14/21 days, inbox: 3/7 days)
- calculateFollowupStatus determines priority based on days elapsed and stage (APPL-05)
- generateFollowupSuggestion provides contact-aware recommendations (APPL-06)
- Three MCP tools expose follow-up data for daily review workflow

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Follow-up Engine Service** - `f3b1614` (feat)
2. **Task 2: Create Follow-up MCP Tools** - `0c0d8c6` (feat)

## Files Created

| File | Purpose |
|------|---------|
| `mcp-server/src/services/followup-engine.js` | Follow-up calculation and suggestion generation |
| `mcp-server/src/services/followup-engine.test.js` | 47 tests for followup engine |
| `mcp-server/src/tools/followup.js` | MCP tools for follow-up management |
| `mcp-server/src/tools/followup.test.js` | 23 tests for MCP tools |

## Key Features

### Follow-up Rules by Status

```javascript
FOLLOWUP_RULES = {
  'applied': [
    { minDays: 7, maxDays: 13, priority: 'low' },
    { minDays: 14, maxDays: 20, priority: 'medium' },
    { minDays: 21, maxDays: null, priority: 'high' }
  ],
  'inbox': [
    { minDays: 3, maxDays: 6, priority: 'low' },
    { minDays: 7, maxDays: null, priority: 'medium' }
  ],
  'apply-now': [
    { minDays: 2, maxDays: 4, priority: 'medium' },
    { minDays: 5, maxDays: null, priority: 'high' }
  ],
  'maybe': [
    { minDays: 7, maxDays: 13, priority: 'low' },
    { minDays: 14, maxDays: null, priority: 'medium' }
  ]
}
```

### Suggestion Types

| Type | When Generated | Example |
|------|----------------|---------|
| `action` | Base suggestion from rules | "Follow up now - restate interest" |
| `contact` | Uncontacted primary contact | "Reach out to Jane (recruiter)" |
| `research` | Applied job without contacts | "Find recruiter or hiring manager" |
| `reconnect` | Contact not reached in >14 days | "Re-engage with Bob - 20 days ago" |

### MCP Tools

| Tool | Purpose | Response |
|------|---------|----------|
| `getFollowups` | Prioritized queue for daily review | count, showing, followups[] |
| `getJobFollowupStatus` | Detailed status for specific job | followup details + contacts |
| `getFollowupSummary` | Dashboard-level overview | byPriority, byStatus, topActions |

## Test Coverage

| File | Tests | Coverage |
|------|-------|----------|
| followup-engine.test.js | 47 | Rules, status calc, suggestions, queue |
| followup.test.js | 23 | MCP tools, edge cases |
| **Total** | **70** | All functionality covered |

## Requirements Addressed

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| APPL-05 | calculateFollowupStatus with time-based rules | Complete |
| APPL-06 | generateFollowupSuggestion with context awareness | Complete |

## Decisions Made

1. **Boundary Exclusivity:** Rule boundaries use exclusive upper bounds (7-13 for low) to prevent overlap
2. **Interview Detection:** 2-day window for thank-you reminders matches best practice timing
3. **Queue Limits:** Default 10 for daily review, 1000 for summary calculations
4. **Contact Filtering:** Only structured contacts considered for suggestions (legacy strings lack required fields)

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Phase 6 (Application Intelligence) is now complete with all 3 plans:
- 06-01: Resume-JD matching with gap analysis
- 06-02: Contact tracking and job updates
- 06-03: Follow-up engine with smart suggestions

Ready for Phase 7 (Application Generation):
- Follow-up engine provides timing context for application prioritization
- Contact tracking ready to inform outreach suggestions
- Matching scores can guide resume customization
