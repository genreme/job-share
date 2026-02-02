---
phase: 07-application-generation
plan: 03
subsystem: mcp-tools
tags: [mcp, tools, research, generation, review, email-variations]

# Dependency graph
requires:
  - phase: 07-application-generation
    plan: 01
    provides: research services (company-research.js, manager-research.js, research-persistence.js)
  - phase: 07-application-generation
    plan: 02
    provides: review services (document-review.js, keyword-optimizer.js)
provides:
  - Research MCP tools (start_company_research, save_company_research, start_manager_research, save_manager_research, get_research)
  - Generation MCP tools (generate_optimized_resume, generate_researched_cover_letter, generate_email_response)
  - Review MCP tools (review_generated_document, approve_document)
  - Email generator service with tone variations
affects: [08-automation-workflows, claude-chat-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - MCP tool pattern with service delegation
    - Tone variation templates for emails
    - Approval gate pattern for documents

key-files:
  created:
    - mcp-server/src/tools/research.js
    - mcp-server/src/tools/generation.js
    - mcp-server/src/tools/review.js
    - mcp-server/src/services/email-generator.js
  modified:
    - mcp-server/src/index.js

key-decisions:
  - "Email variations: 3 tones (professional, warm, direct) with template structure for Claude to fill"
  - "Research retrieval: highlights by default per CONTEXT.md, full research on explicit request"
  - "Review tools async: reviewGeneratedDocument uses await for LanguageTool API"

patterns-established:
  - "MCP tool wrapper: thin layer delegating to service functions with input validation"
  - "Email tone templates: structure + instructions for Claude to generate context-specific content"
  - "Approval gate: explicit approve_document call required before document marked ready"

# Metrics
duration: 14min
completed: 2026-02-02
---

# Phase 7 Plan 3: MCP Tools Wiring Summary

**10 MCP tools exposing research, generation, and review services with email tone variations and approval gates**

## Performance

- **Duration:** 14 min
- **Started:** 2026-02-02T05:41:20Z
- **Completed:** 2026-02-02T05:55:00Z
- **Tasks:** 3
- **Files created:** 7
- **Files modified:** 1

## Accomplishments

- Research tools: 5 tools for company/manager research lifecycle with existing research detection
- Generation tools: 3 tools for keyword-optimized resume, research-integrated cover letter, and email variations
- Review tools: 2 tools for document review and approval gate
- Email generator service with 3 tone variations (professional, warm, direct)
- All 10 tools registered in MCP server with definitions and case handlers
- 51 new tests passing, 1469 total tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Research MCP Tools** - `e4aff20` (feat)
2. **Task 2: Create Generation and Review MCP Tools** - `8b8bf1d` (feat)
3. **Task 3: Register All Phase 7 Tools in MCP Server** - `a132ff0` (feat)

## Files Created/Modified

### Created
- `mcp-server/src/tools/research.js` - Research tool wrappers (startCompanyResearch, saveCompanyResearch, startManagerResearch, saveManagerResearch, getResearch)
- `mcp-server/src/tools/research.test.js` - 23 tests for research tools
- `mcp-server/src/tools/generation.js` - Generation tool wrappers (generateOptimizedResume, generateResearchedCoverLetter, generateEmailResponse)
- `mcp-server/src/tools/generation.test.js` - 15 tests for generation tools
- `mcp-server/src/tools/review.js` - Review tool wrappers (reviewGeneratedDocument, approveDocument)
- `mcp-server/src/tools/review.test.js` - 13 tests for review tools
- `mcp-server/src/services/email-generator.js` - Email variation generator with 4 email types and 3 tones

### Modified
- `mcp-server/src/index.js` - Added imports, tool definitions, and case handlers for all 10 Phase 7 tools

## Decisions Made

1. **Email tone variations structure:** Templates with instructions for Claude to fill, rather than pre-written content. Allows contextual generation while maintaining consistent structure.

2. **Research retrieval default:** Returns highlights only per CONTEXT.md ("highlights shown when discussing job, full available on request"). User must explicitly request type='all' for complete research.

3. **Review tool async pattern:** reviewGeneratedDocument uses async/await since document-review.js calls external LanguageTool API.

4. **Approval gate separation:** approve_document is a separate tool rather than a flag on review. Enforces explicit approval step per CONTEXT.md.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 10 Phase 7 MCP tools functional and tested
- Research workflow complete: start -> save -> retrieve
- Generation workflow complete: optimize resume, generate cover letter, generate email variations
- Review workflow complete: review document, approve document
- Ready for Phase 8: Automation Workflows

---
*Phase: 07-application-generation*
*Completed: 2026-02-02*
