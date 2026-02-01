---
phase: "06"
plan: "04"
subsystem: mcp-server
tags: [gap-closure, mcp-tools, schema-reconciliation, phase6]

dependency_graph:
  requires: ["06-01", "06-02", "06-03"]
  provides: ["phase-6-tools-registered", "schema-conflict-resolved"]
  affects: ["07-communication"]

tech_stack:
  added: []
  patterns: ["union-schema-backward-compat", "mcp-tool-registration"]

file_tracking:
  key_files:
    created: []
    modified:
      - schemas/job.schema.js
      - mcp-server/src/index.js

decisions:
  - key: "triple-union-connection"
    choice: "z.union([string, EnhancedConnectionSchema, LegacyConnectionObjectSchema])"
    reason: "Support all three formats: legacy strings, legacy objects, and enhanced objects"
    alternatives: ["Migrate all data to enhanced format", "Keep schemas separate"]

metrics:
  duration: "5 min"
  completed: "2026-02-01"
---

# Phase 6 Plan 4: Gap Closure - MCP Tool Registration

**One-liner:** Registered all 9 Phase 6 MCP tools and reconciled ConnectionSchema conflict for full tool accessibility

## What Was Built

This gap closure plan addressed the critical issue identified in 06-VERIFICATION.md: all Phase 6 services and tools existed but were unreachable via MCP because they were never registered in the server's index.js.

### Schema Reconciliation

Updated `schemas/job.schema.js` to use EnhancedConnectionSchema from contact.schema.js while maintaining backward compatibility:

```javascript
// Connection can be:
// 1. Legacy string format: "Name (notes)"
// 2. Legacy object format: { name, role?, linkedIn?, ... }
// 3. Enhanced format: full EnhancedConnectionSchema
export const ConnectionSchema = z.union([
  z.string(),
  EnhancedConnectionSchema,
  LegacyConnectionObjectSchema
])
```

This triple-union approach ensures:
- Existing data (strings and simple objects) continues to validate
- New enhanced contacts (with id, interactions, lastInteraction, linkedInUrl, etc.) are now accepted
- No data migration required

### MCP Tool Registration

Added to `mcp-server/src/index.js`:

**Imports:**
```javascript
import { getResumeMatch, getMatchScoresForActiveJobs } from './tools/matching.js'
import { addJobContact, logContactInteraction, getJobContacts, addJobUpdate } from './tools/contacts.js'
import { getFollowups, getJobFollowupStatus, getFollowupSummary } from './tools/followup.js'
```

**9 New Tool Definitions:**

| Tool | Purpose | Requirement |
|------|---------|-------------|
| `get_resume_match` | Match score + gap analysis for single job | APPL-01, APPL-02 |
| `get_match_scores_for_active_jobs` | Batch match scores for prioritization | APPL-01 |
| `add_job_contact` | Add/update structured contact | APPL-03, APPL-04 |
| `log_contact_interaction` | Log email/call/meeting with contact | APPL-04 |
| `get_job_contacts` | List all contacts for a job | APPL-03 |
| `add_job_update` | Comprehensive update (note, contact, status) | APPL-07 |
| `get_followups` | Prioritized follow-up queue | APPL-05 |
| `get_job_followup_status` | Detailed follow-up for specific job | APPL-05, APPL-06 |
| `get_followup_summary` | Dashboard-level overview | APPL-05 |

**Case Handlers:** All 9 tools have corresponding case statements in the CallToolRequestSchema handler.

## Key Technical Decisions

### Triple-Union Schema Pattern

**Decision:** Use `z.union([string, EnhancedSchema, LegacySchema])` instead of migrating existing data.

**Rationale:**
- Backward compatibility is critical - existing jobs.json data must continue to work
- Enhanced contacts are now accepted for new data
- No breaking changes to existing workflows
- Clean upgrade path: new contacts get full features, old contacts still validate

## Verification

### Tests Passing
- `schemas/job.schema.test.js`: 44 tests passing (including mixed connection format tests)
- `schemas/contact.schema.test.js`: 43 tests passing
- `mcp-server/src/tools/matching.test.js`: 36 tests passing
- `mcp-server/src/tools/contacts.test.js`: 39 tests passing
- `mcp-server/src/tools/followup.test.js`: 23 tests passing
- Full suite: 1250 tests passing

### MCP Server Verification
- Syntax check: `node --check mcp-server/src/index.js` passes
- Import verification: All modules load successfully
- Server starts without errors

## Commits

| Hash | Type | Description |
|------|------|-------------|
| e558f36 | feat | Update job.schema.js to use EnhancedConnectionSchema |
| 471a96b | feat | Register Phase 6 tools in MCP server |

## Deviations from Plan

None - plan executed exactly as written.

## Gap Closure Status

This plan closes all gaps identified in 06-VERIFICATION.md:

| Gap | Status | Resolution |
|-----|--------|------------|
| Tools not imported in index.js | CLOSED | All 9 tools imported |
| Tools not registered in TOOLS array | CLOSED | All 9 tool definitions added |
| No case handlers for tools | CLOSED | All 9 case handlers added |
| Schema conflict between job.schema.js and contact.schema.js | CLOSED | Triple-union pattern |

## Phase 6 Complete

With this gap closure, Phase 6: Application Intelligence is now fully complete:

- 06-01: Resume-JD Matching Service (service + tools)
- 06-02: Contact Tracking and Job Updates (schema + tools)
- 06-03: Follow-up Engine with Smart Suggestions (engine + tools)
- 06-04: Gap Closure - MCP Tool Registration (wiring)

All APPL requirements (APPL-01 through APPL-07) are now satisfied and accessible via MCP protocol.
