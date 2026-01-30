---
phase: 03-self-profile-integration
plan: 01
subsystem: cleanup-detection
tags: [cleanup, duplicate-detection, staleness, gap-analysis, mcp-tools]

dependency-graph:
  requires:
    - "02-01: Profile schema and loader"
    - "02-02: Experience and skills schemas"
    - "02-03: Stories, summaries, preferences schemas"
  provides:
    - "Duplicate detector with fuzzy matching"
    - "Staleness detector with age+usage conditions"
    - "Gap detector for required fields and thin evidence"
    - "Cleanup orchestrator service"
    - "MCP tools: run_weekly_cleanup, get_cleanup_findings, dismiss_finding"
  affects:
    - "03-02: Document generation will use gap detection"
    - "Future: Dashboard cleanup section"

tech-stack:
  added:
    - string-similarity (4.0.4 - fuzzy matching)
  patterns:
    - Service orchestrator pattern (cleanup.js coordinates detectors)
    - Finding hash for dismissal tracking
    - Graceful degradation when document-history.json missing

key-files:
  created:
    - schemas/learning.schema.js
    - schemas/learning.schema.test.js
    - mcp-server/src/services/duplicate-detector.js
    - mcp-server/src/services/duplicate-detector.test.js
    - mcp-server/src/services/staleness-detector.js
    - mcp-server/src/services/staleness-detector.test.js
    - mcp-server/src/services/cleanup.js
    - mcp-server/src/services/cleanup.test.js
    - mcp-server/src/tools/cleanup.js
    - mcp-server/src/tools/cleanup.test.js
  modified:
    - package.json (added string-similarity)
    - mcp-server/src/services/gap-detector.js (updated to CleanupFinding structure)
    - mcp-server/src/index.js (registered cleanup tools)

decisions:
  - "DEFAULT_THRESHOLD=0.85 for duplicate detection (85% similarity)"
  - "STALENESS_THRESHOLDS: AGE_DAYS=180, USAGE_DAYS=90 (both conditions required)"
  - "MIN_EVIDENCE_COUNT=2 for skills (thin evidence detection)"
  - "Findings stored in cleanup-findings.json with 4-run history"
  - "Graceful degradation: treat items as unused when document-history.json missing"

metrics:
  duration: "8 min"
  tests-added: 178
  completed: 2026-01-30
---

# Phase 3 Plan 1: Cleanup and Gap Detection Services Summary

**One-liner:** Cleanup detection services with fuzzy duplicate matching (85%), dual-condition staleness (180d age + 90d usage), and gap detection for required fields and thin evidence, orchestrated via MCP tools.

## What Was Built

### 1. Cleanup Finding Schemas (schemas/learning.schema.js)
- **CleanupFindingSchema**: Validates findings with type, entityType, ids, reason, suggestion
- **CleanupResultSchema**: Full analysis result with duplicates/stale/gaps arrays
- **DismissedFindingSchema**: Tracks dismissed findings by hash
- **StoredCleanupFindingsSchema**: Persisted findings with max 4 runs history

### 2. Duplicate Detector (duplicate-detector.js)
- **Skills**: Compare names case-insensitively using string-similarity
- **Stories**: Weighted comparison - 40% title, 60% situation
- **Summaries**: Compare first 100 characters of content
- **Default threshold**: 85% (configurable via options)
- **Smart suggestions**: Different based on similarity level, categories, evidence count

### 3. Staleness Detector (staleness-detector.js)
- **BOTH conditions required** (per CONTEXT.md):
  - Not updated in 180 days AND
  - Not used in documents for 90 days
- **Document history integration**: Scans document-history.json for usage tracking
- **Graceful degradation**: Works when document-history.json doesn't exist yet
- **Covers**: skills, stories, summaries, experience entries

### 4. Gap Detector (gap-detector.js - updated)
- **Required field gaps**: experience, skills, summaryBlocks, stories, targetRoles, communication prefs
- **Thin evidence gaps**: Skills with < 2 evidence links, projects without metrics, stories without projectRef
- **Contextual gaps**: Leadership roles need leadership stories/skills, technical roles need technical skills, design roles need design skills
- **Each finding includes**: reason (WHY) and suggestion (HOW) per PROF-08b

### 5. Cleanup Orchestrator (cleanup.js)
- **runCleanupAnalysis()**: Coordinates all detectors, saves results
- **checkCleanupOverdue()**: Returns true if > 7 days since last run
- **saveCleanupFindings()**: Atomic write, preserves last 4 runs
- **dismissFinding()**: Mark findings as acknowledged by user
- **generateFindingHash()**: Deterministic hash for tracking dismissals

### 6. MCP Tools (cleanup.js tools)
- **run_weekly_cleanup**: Triggers analysis, returns summary with counts and detailed findings
- **get_cleanup_findings**: Retrieves stored findings with optional type filter, excludes dismissed
- **dismiss_finding**: Marks finding as acknowledged (won't show in future results)

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| 85% default threshold | Balance between catching variants (React/ReactJS) and avoiding false positives |
| BOTH conditions for staleness | Prevents flagging actively-used content that just hasn't been edited |
| Per-item findings | Rather than aggregated "N skills have thin evidence", each finding has specific ID and actionable suggestion |
| Finding hashes | Stable identification across runs for dismissal tracking |
| Graceful degradation | Staleness detector works before document-history.json exists |

## Verification Results

1. **npm test passes**: 751 tests (178 new in this plan)
2. **Findings include reason (WHY)** and **suggestion (HOW)** per PROF-08b
3. **Duplicates use 85% threshold** with string-similarity
4. **Staleness requires BOTH conditions**: age AND usage

## Deviations from Plan

None - plan executed exactly as written.

## Test Coverage

| Component | Tests |
|-----------|-------|
| learning.schema.test.js | 39 |
| duplicate-detector.test.js | 27 |
| staleness-detector.test.js | 25 |
| gap-detector.test.js | 41 |
| cleanup.test.js (service) | 25 |
| cleanup.test.js (tools) | 21 |
| **Total New** | **178** |

## Commits

| Hash | Message |
|------|---------|
| b4a5c88 | feat(03-01): add cleanup finding schemas and string-similarity |
| a038c17 | feat(03-01): add duplicate, staleness, and gap detection services |
| 7e6217f | feat(03-01): add cleanup orchestrator and MCP tools |

## Next Phase Readiness

Plan 03-02 (Document Generation from Profile) can proceed:
- Gap detection is available for pre-generation checks
- Document history service will enable full staleness tracking
- Cleanup tools ready for user-facing workflow
