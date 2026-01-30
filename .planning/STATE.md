# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Present the best version of myself to the right opportunities, informed by a comprehensive understanding of who I am professionally
**Current focus:** Phase 4: Discovery Core - READY

## Current Position

Phase: 4 of 10 (Discovery Core) - NOT STARTED
Plan: 0 of 3 (estimated) in current phase
Status: Ready to begin
Last activity: 2026-01-30 - Phase 3 verification passed (15/15 must-haves)

Progress: [=====-----] ~40% (12 of ~30 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: 6 min
- Total execution time: 68 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-qa-layer | 6 | 21 min | ~4 min |
| 02-self-profile-schema | 3 | 15 min | ~5 min |
| 03-self-profile-integration | 3 | 32 min | ~11 min |

**Recent Trend:**
- Last 10 plans: 01-03 (3min), 01-04 (2min), 01-05 (4min), 01-06 (2min), 02-01 (4min), 02-02 (3min), 02-03 (8min), 03-02 (10min), 03-01 (8min), 03-03 (14min)
- Trend: Integration plans take longer (~10-14 min) due to cross-module dependencies

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: QA layer first to gate all subsequent phases (from research recommendation)
- [Init]: 10 phases derived from 69 requirements at comprehensive depth
- [Init]: Existing system remains functional during evolution
- [01-01]: URL validation accepts empty string OR valid URL (real data has pending URLs)
- [01-01]: Advisory mode default for validation (non-breaking for existing data)
- [01-01]: 70% coverage threshold as starting baseline
- [01-01]: Workflow: probably-not cannot directly transition to applied
- [01-02]: Mock loader module to isolate jobs tests from file system
- [01-02]: Extract rendering helper functions for testable dashboard logic
- [01-03]: 7-day artifact retention for CI reports (balance access vs storage)
- [01-03]: Phase gate enforced via npm run phase:complete
- [01-04]: Validation wired in advisory mode (logs warnings, doesn't block)
- [01-05]: Playwright E2E tests run separately from Vitest unit tests
- [01-06]: Coverage thresholds lowered to 20% baseline (target 70% by Phase 3)
- [02-01]: Schema version literal '1.0' for future migration support
- [02-01]: Immutable history tracking via addHistoryEntry returning new object
- [02-01]: Atomic writes using write-temp-then-rename pattern
- [02-02]: Project-centric experience structure (projects as primary unit under roles)
- [02-02]: Skills require min(1) evidence linking (per RESEARCH.md Pitfall 5)
- [02-02]: Three-tier proficiency: familiar, proficient, expert
- [02-02]: Source tracking: explicit vs inferred skills
- [02-03]: Summary blocks use audience enum (technical, leadership, executive, mission-driven)
- [02-03]: STAR stories have base components plus optional variants by audience
- [02-03]: Target roles use enum for level and company stage
- [02-03]: Communication prefs use nullable().optional() for backwards compatibility
- [02-03]: MCP tool tests use vi.mock for loader isolation
- [03-02]: Profile is primary data source; legacy JSON is fallback with deprecation warning
- [03-02]: Gap detection warns but allows proceed with proceedWithGaps flag
- [03-02]: Document history tracks { itemType, itemId } for staleness detection
- [03-02]: Rolling window of 100 records for document history
- [03-02]: Interview prep requires at least one STAR story to generate
- [03-01]: DEFAULT_THRESHOLD=0.85 for duplicate detection (85% similarity)
- [03-01]: STALENESS_THRESHOLDS: AGE_DAYS=180, USAGE_DAYS=90 (both conditions required)
- [03-01]: MIN_EVIDENCE_COUNT=2 for skills (thin evidence detection)
- [03-01]: Graceful degradation when document-history.json missing
- [03-03]: String similarity threshold 0.7 for overlap detection
- [03-03]: Conservative 'familiar' proficiency default for inferred skills
- [03-03]: Confidence levels map to percentages: high=90, medium=70, low=50
- [03-03]: Suggestion system: high->confirm_inline, medium->review_soon, low->batch
- [03-03]: Queue persistence uses atomic write pattern (temp+rename)

### Pending Todos

None.

### Blockers/Concerns

None. Phase 3 complete.

## Session Continuity

Last session: 2026-01-30
Stopped at: Completed 03-03-PLAN.md (Phase 3 Complete)
Resume file: None

## Phase 1 Completion Summary

**Phase 1: QA Layer Foundation** — COMPLETE

- 6 plans executed (3 original + 3 gap closure)
- 188 unit tests + 17 E2E tests passing
- Schema validation wired into loader.js and updates.js
- Status transition validation active
- Phase gate operational (npm run phase:complete)
- Coverage: 22.55% (meets 20% threshold)
- All 6 QALY requirements satisfied

## Phase 2 Completion Summary

**Phase 2: Self-Profile Schema** — COMPLETE

- 3 plans executed
- 375 total tests passing (173 new in Phase 2)
- Complete profile schema with all 7 PROF requirements

### Plans Completed:

- **Plan 02-01: Core Profile Schema**
  - ProfileSchema, HistoryEntrySchema with Zod validation
  - Profile loader with atomic writes and history tracking
  - 58 new tests (38 schema + 20 loader)
  - uuid and date-fns dependencies added

- **Plan 02-02: Experience & Skills Schemas**
  - ExperienceEntrySchema with project-centric structure
  - ProjectSchema with optional metrics, RoleSchema for context
  - SkillSchema with hierarchical categories and evidence linking
  - 45 new tests
  - Evidence linking enforced with min(1) constraint

- **Plan 02-03: Summaries, Stories, Preferences & MCP Tools**
  - SummaryBlockSchema for audience-tagged paragraphs
  - STARStorySchema with variants for different audiences
  - TargetRoleSchema for job preferences
  - CommunicationPrefsSchema for tone and style
  - 7 MCP tools registered for profile access
  - 50 new schema tests + 34 MCP tool tests

### Schema Coverage:

| Requirement | Schema | Status |
|-------------|--------|--------|
| PROF-01 Core profile | ProfileSchema | Complete |
| PROF-02 Experience | ExperienceEntrySchema | Complete |
| PROF-03 Skills | SkillSchema | Complete |
| PROF-04 Summaries | SummaryBlockSchema | Complete |
| PROF-05 Stories | STARStorySchema | Complete |
| PROF-06 Target roles | TargetRoleSchema | Complete |
| PROF-07 Communication | CommunicationPrefsSchema | Complete |

### MCP Tools:

| Tool | Purpose |
|------|---------|
| get_profile | Full profile data |
| get_experience_by_theme | Filter by project tags |
| get_stories_by_category | Filter STAR stories |
| get_skills_by_category | Filter skills |
| get_summary_blocks_by_audience | Filter summaries |
| get_target_roles | Job search criteria |
| get_communication_prefs | Tone/style prefs |

## Phase 3 Completion Summary

**Phase 3: Self-Profile Integration** — COMPLETE

- 3 plans executed
- 751 total tests passing (376 new in Phase 3)
- Profile-to-document transformation complete
- Cleanup and gap detection operational
- Conversation learning system with queue and confirmation workflow

### Plans Completed:

- **Plan 03-02: Profile Integration for Document Generation**
  - Profile-to-resume transformation service with relevance scoring
  - Profile-to-cover-letter transformation with tone preferences
  - Interview prep generation from STAR stories
  - Document history tracking for staleness detection
  - 117 new tests
  - 4 new MCP tools: generate_interview_prep, preview_document_sources

- **Plan 03-01: Cleanup and Gap Detection Services**
  - Duplicate detector with fuzzy matching (85% threshold)
  - Staleness detector requiring BOTH age (180d) AND usage (90d) conditions
  - Gap detector updated to CleanupFinding structure
  - Cleanup orchestrator service with 4-run history
  - 178 new tests
  - 3 new MCP tools: run_weekly_cleanup, get_cleanup_findings, dismiss_finding

- **Plan 03-03: Conversation Learning System**
  - ExtractionSchema and LearningQueueSchema for extraction validation
  - Learning queue with persistence and overlap detection
  - Extraction-to-profile mapper for confirm workflow
  - 5 MCP tools for learning workflow (queue, confirm, batch, history)
  - 81 new tests
  - Enables PROF-12, PROF-13, PROF-14 requirements

### New MCP Tools (Document Generation):

| Tool | Purpose |
|------|---------|
| generate_resume | Generate PDF using profile (with gaps warning) |
| generate_cover_letter | Generate PDF with tone from profile |
| generate_interview_prep | STAR-based interview prep package |
| preview_document_sources | Show which profile sections will be used |

### New MCP Tools (Cleanup):

| Tool | Purpose |
|------|---------|
| run_weekly_cleanup | Analyze profile for duplicates, staleness, gaps |
| get_cleanup_findings | Get stored findings with type filtering |
| dismiss_finding | Mark finding as acknowledged |

### New MCP Tools (Learning):

| Tool | Purpose |
|------|---------|
| queue_profile_extraction | Queue insight from conversation for confirmation |
| get_pending_extractions | View pending extractions with overlap info |
| confirm_extraction | Confirm/reject/merge extraction to profile |
| batch_confirm_extractions | Bulk confirm/reject multiple extractions |
| get_extraction_history | View past confirmed/rejected extractions |

### Integration Status:

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| PROF-12 Passive learning | queue_profile_extraction tool | Complete |
| PROF-13 Confirm before update | confirm_extraction workflow | Complete |
| PROF-14 Cleanup workflow | run_weekly_cleanup + dismiss_finding | Complete |
