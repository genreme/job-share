---
phase: 08-interview-preparation
plan: 02
subsystem: interview-prep
tags: [question-generation, practice-sessions, story-linking, interview-simulation]

# Dependency graph
requires:
  - phase: 08-01
    provides: interview.schema.js with 5 schemas, interviewer-research.js
provides:
  - Question generation from 5 sources (JD, gaps, strengths, company, interviewer)
  - Practice session lifecycle management with persistence
  - Story linking for personalized interview preparation
affects: [08-03 scoring service, 08-04 MCP tools wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Multi-source question generation with source tracking
    - Session lifecycle: create -> submit answers -> complete
    - Atomic writes for session persistence per job

key-files:
  created:
    - mcp-server/src/services/question-generator.js
    - mcp-server/src/services/practice-session.js
    - mcp-server/src/services/question-generator.test.js
    - mcp-server/src/services/practice-session.test.js
  modified:
    - (none)

key-decisions:
  - "5 question sources: jd-requirement, profile-gap, profile-strength, company-research, interviewer-style"
  - "Difficulty mapping by source: gaps=hard (weaker areas), strengths=easy (let them shine)"
  - "linkQuestionToStories uses getRelevantStories with keywords extracted from question text"
  - "Session schema uses optional completedAt/summary (undefined until completed)"
  - "UUID validation for questionId enforces proper format in PracticeAnswerSchema"
  - "No timer implementation per CONTEXT.md - focus on content quality over speed"

patterns-established:
  - "Question generation pattern: load profile + job + research -> generate from multiple sources -> link stories -> persist"
  - "Session lifecycle: create (full-interview/category-focus/single-question) -> submit answers -> complete with summary"
  - "feedbackTiming option: immediate vs batched (user chooses at session start)"

# Metrics
duration: 10min
completed: 2026-02-02
---

# Phase 8 Plan 2: Question Generation & Practice Session Services Summary

**Multi-source question generation with STAR story linking and practice session lifecycle management with configurable feedback timing**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-02T21:16:49Z
- **Completed:** 2026-02-02T21:35:00Z
- **Tasks:** 3
- **Files created:** 4

## Accomplishments

- Question generator service producing questions from 5 sources (JD requirements, profile gaps, profile strengths, company research, interviewer style)
- Each question links to top 3 relevant STAR stories with relevance scores
- Practice session service with full lifecycle: create, submit answers, complete
- Session types: full-interview, category-focus, single-question
- User-controlled feedback timing (immediate vs batched)
- 68 new tests covering both services (28 question generator, 40 practice session)
- All 1663 project tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create question-generator.js service** - `7a24a7a` (feat)
2. **Task 2: Create practice-session.js service** - `c0ea408` (feat)
3. **Task 3: Create unit tests for both services** - `a302ecb` (test)

## Files Created

- `mcp-server/src/services/question-generator.js` - generateInterviewQuestions, getQuestionsForJob, linkQuestionToStories
- `mcp-server/src/services/practice-session.js` - createPracticeSession, submitAnswer, completeSession, getSessionsForJob, getSession
- `mcp-server/src/services/question-generator.test.js` - 28 tests for question generation
- `mcp-server/src/services/practice-session.test.js` - 40 tests for session lifecycle

## Decisions Made

1. **5 question sources with difficulty mapping:**
   - jd-requirement: medium (job-relevant keywords)
   - profile-gap: hard (weaker areas need preparation)
   - profile-strength: easy (let candidate shine)
   - company-research: medium (culture fit)
   - interviewer-style: varies by depthExpectation

2. **Story linking approach:** Extract keywords from question text, use getRelevantStories with keywords, return top 3 with relevance scores capped at 100

3. **Session schema constraints:** Used optional fields (undefined) instead of null for completedAt and summary to satisfy Zod validation

4. **UUID validation:** Tests use valid UUID v4 format (third segment starts with 4, fourth segment starts with 8/9/a/b)

5. **No timer implementation:** Per CONTEXT.md, focus on content quality over speed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed findSession using require() instead of imported readdirSync**
- **Found during:** Task 3 (tests revealed session not found errors)
- **Issue:** `require('fs').readdirSync` not available in ES modules
- **Fix:** Import `readdirSync` at top and use directly
- **Files modified:** mcp-server/src/services/practice-session.js
- **Commit:** c0ea408

**2. [Rule 1 - Bug] Fixed session schema null vs undefined**
- **Found during:** Task 3 (validation errors)
- **Issue:** Setting `completedAt: null` and `summary: null` failed Zod validation (expects string | undefined)
- **Fix:** Removed null assignments, let fields be undefined until set
- **Files modified:** mcp-server/src/services/practice-session.js
- **Commit:** c0ea408

**3. [Rule 1 - Bug] Fixed test UUIDs to be valid format**
- **Found during:** Task 3 (UUID validation failures)
- **Issue:** Test UUIDs like `11111111-1111-1111-1111-111111111111` fail Zod UUID validation
- **Fix:** Use valid UUID v4 format: `11111111-1111-4111-a111-111111111111`
- **Files modified:** mcp-server/src/services/practice-session.test.js, mcp-server/src/services/question-generator.test.js
- **Commit:** a302ecb

---

**Total deviations:** 3 auto-fixed (all bug fixes)
**Impact on plan:** Minor fixes. No scope creep.

## Issues Encountered

None - execution proceeded smoothly after fixing the minor bugs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Question generator ready for use by MCP tools (Plan 04)
- Practice session lifecycle ready for scoring integration (Plan 03)
- Both services use atomic writes for data integrity
- Questions persist to `{jobId}-questions.json`
- Sessions persist to `{jobId}-practice-sessions.json`

---
*Phase: 08-interview-preparation*
*Completed: 2026-02-02*
