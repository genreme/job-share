# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Present the best version of myself to the right opportunities, informed by a comprehensive understanding of who I am professionally
**Current focus:** Phase 5: Discovery Management - COMPLETE

## Current Position

Phase: 5 of 10 (Discovery Management) - COMPLETE
Plan: 3 of 3 in current phase
Status: Phase complete
Last activity: 2026-02-01 - Completed 05-03-PLAN.md

Progress: [======----] ~60% (18 of ~30 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 18
- Average duration: 6 min
- Total execution time: 104 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-qa-layer | 6 | 21 min | ~4 min |
| 02-self-profile-schema | 3 | 15 min | ~5 min |
| 03-self-profile-integration | 3 | 32 min | ~11 min |
| 04-discovery-core | 3 | 21 min | ~7 min |
| 05-discovery-management | 3 | 15 min | ~5 min |

**Recent Trend:**
- Last 10 plans: 02-03 (8min), 03-02 (10min), 03-01 (8min), 03-03 (14min), 04-01 (5min), 04-02 (12min), 04-03 (4min), 05-01 (5min), 05-02 (5min), 05-03 (5min)
- Trend: Schema/service plans complete faster (~5 min) than integration plans (~10-14 min)

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
- [04-01]: Inbox status is first in JobStatusSchema (arrival state before user review)
- [04-01]: No direct inbox->applied transition (must review and classify first)
- [04-01]: Fit scorer falls back to defaults with console.warn when profile empty
- [04-01]: Salary minimum uses highest across all targetRoles for conservative scoring
- [04-02]: Reasoning thresholds 90/80/70/60 for Excellent/Strong/Good/Moderate
- [04-02]: Worker fallback returns partial_research with requiresManualEntry flag
- [04-02]: writeJobsData added to loader.js with atomic write pattern
- [05-02]: Browser always closed in finally block (prevents resource leaks)
- [05-02]: PDF fallback to generated HTML when URL fetch fails
- [05-02]: Closed jobs marked with closedAt timestamp and closedReason
- [05-02]: Fit scores recalculated only when job data actually changes
- [05-02]: 30-second timeout for Worker requests
- [05-01]: Service key (not anon key) for server-side Supabase access to bypass RLS
- [05-01]: Lazy initialization with single warning log for missing config
- [05-01]: Friend context preserved as separate object in job data (friendContext field)
- [05-03]: Fit config cached for session performance with clearFitConfigCache() for testing
- [05-03]: Default dataCompleteness to 50% when not specified for boards
- [05-03]: blacklistBoard requires userConfirmed=true for safety

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-01
Stopped at: Completed 05-03-PLAN.md (Phase 5 complete)
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

## Phase 4 Completion Summary

**Phase 4: Discovery Core** — COMPLETE

- 3 plans executed
- 868 total tests passing (117 new in Phase 4)
- Complete discovery funnel from URL submission to dashboard confirmation
- Profile-based fit scoring with fallback to defaults
- Human-readable reasoning for fit scores

### Plans Completed:

- **Plan 04-01: Job Status Schema + Fit Scorer**
  - Inbox status added to JobStatusSchema
  - Status transition validation (inbox cannot go directly to applied)
  - Fit scorer service with profile-based scoring
  - Fallback to hardcoded defaults when profile empty
  - 60 new tests

- **Plan 04-02: Reasoning Generator + Discovery Tools**
  - Reasoning generator for fit score explanations
  - 4 MCP tools: research_job_url, get_inbox, confirm_job, defer_job
  - Graceful fallback when Cloudflare Worker unavailable
  - 50 new tests

- **Plan 04-03: Integration Tests + Human Verification**
  - Full workflow integration tests (research → inbox → confirm)
  - Reasoning wiring verification
  - Fallback behavior tests
  - Human verification checkpoint passed
  - 9 new tests

### New MCP Tools (Discovery):

| Tool | Purpose |
|------|---------|
| research_job_url | Research job URL, score, generate reasoning |
| get_inbox | List inbox jobs for Claude to present |
| confirm_job | Move inbox job to dashboard with status |
| defer_job | Defer job with reason and optional review date |

### Requirements Status:

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| DISC-01 Quick scan | Jobs arrive via extension or research_job_url | Complete |
| DISC-02 Filter | Fit scoring with profile integration | Complete |
| DISC-03 Deep research | research_job_url with Worker fallback | Complete |
| DISC-04 Shortlist | get_inbox + reasoning (Claude presents) | Complete |
| DISC-05 Confirm/defer | confirm_job, defer_job tools | Complete |
| DISC-06 Manual submission | research_job_url tool | Complete |
| DISC-06a With context | notes parameter preserved | Complete |
| DISC-06b Confirm flow | confirm_job moves to dashboard | Complete |

## Phase 5 Completion Summary

**Phase 5: Discovery Management** — COMPLETE

- 3 plans executed
- 147 new tests (27 + 56 + 64)
- Configurable fit criteria with evolution tracking
- Job board registry with quality-based prioritization
- Friend submissions, PDF archiving, staleness verification

### Plans Completed:

- **Plan 05-01: Friend Submissions via Supabase** (5 min)
  - Supabase server client with lazy initialization
  - Three MCP tools: getFriendSubmissions, processFriendSubmission, acceptFriendSubmission
  - Friend context preservation end-to-end
  - 27 new tests

- **Plan 05-02: PDF Archiving and Staleness Verification** (5 min)
  - Puppeteer-based PDF archiving for job descriptions
  - Worker-based job status verification
  - Automatic fit score refresh on data changes
  - 56 new tests

- **Plan 05-03: Configurable Fit Criteria and Board Registry** (6 min)
  - fit-config.json with criteria, weights, evolutionLog
  - job-boards.json with Lever, Greenhouse, LinkedIn, Indeed
  - MCP tools: getFitConfig, updateFitConfig, logJobOutcome
  - MCP tools: getJobBoards, addTestBoard, blacklistBoard, recordScanResults
  - 64 new tests

### New MCP Tools (Phase 5):

| Tool | Purpose |
|------|---------|
| get_friend_submissions | List pending friend submissions from Supabase |
| process_friend_submission | Research friend submission URL |
| accept_friend_submission | Accept and add to dashboard with context |
| archive_job | Archive job as PDF for pattern analysis |
| list_archives | List all archived job PDFs |
| verify_jobs | Verify active jobs, detect closed, refresh scores |
| getFitConfig | Get current fit criteria and weights |
| updateFitConfig | Update fit criteria with reason |
| logJobOutcome | Log outcome for evolution tracking |
| getJobBoards | Get active boards by quality |
| addTestBoard | Add new board for testing |
| blacklistBoard | Blacklist with confirmation |
| recordScanResults | Update board metrics |

### Requirements Status:

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| DISC-07 Friend submissions | get_friend_submissions tool | Complete |
| DISC-07a Friend context captured | processFriendSubmission extracts context | Complete |
| DISC-07b Friend context preserved | acceptFriendSubmission stores friendContext | Complete |
| DISC-08 Archive job descriptions | archive_job tool with Puppeteer | Complete |
| DISC-09 Staleness verification | verify_jobs detects closed jobs | Complete |
| DISC-09 Fit score refresh | Automatic on data changes | Complete |
| DISC-10 Configurable fit criteria | fit-config.json + updateFitConfig | Complete |
| DISC-11 Board registry | job-boards.json with quality ratings | Complete |
| DISC-12 Test new boards | addTestBoard tool | Complete |
| DISC-13 Prioritize quality boards | getBoardsForScan sorts by quality | Complete |
| DISC-14 Blacklist requires confirmation | blacklistBoard needs userConfirmed=true | Complete |
