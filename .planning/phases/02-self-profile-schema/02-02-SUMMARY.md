---
phase: 02-self-profile-schema
plan: 02
subsystem: profile-data
tags: [zod, validation, profile, experience, skills, evidence-linking, hierarchical]

# Dependency graph
requires:
  - phase: 02-01
    provides: Core profile schema with metadata, history tracking, profile loader
provides:
  - ExperienceEntrySchema with project-centric structure
  - ProjectSchema with optional metrics
  - RoleSchema for employment context
  - SkillSchema with hierarchical categories and evidence linking
  - Updated test fixtures with experience and skills data
affects: [02-03, phase-03, resume-generation, job-matching]

# Tech tracking
tech-stack:
  added: []
  patterns: [project-centric-experience, evidence-linked-skills, hierarchical-skills]

key-files:
  created: []
  modified:
    - schemas/profile.schema.js
    - schemas/profile.schema.test.js
    - test/fixtures/valid-profile.json
    - test/fixtures/invalid-profiles.json

key-decisions:
  - "Project-centric experience structure: projects are primary unit of achievement under roles"
  - "Skills require at least one evidence reference (min(1) constraint on evidence array)"
  - "Three-tier proficiency: familiar, proficient, expert"
  - "Source tracking: explicit (user-stated) vs inferred (derived from experience)"
  - "Skills reference projects by ID (one-way linking to avoid circular JSON)"

patterns-established:
  - "Project-centric experience: roles contain projects, projects are the primary unit of achievement"
  - "Evidence linking: every skill must reference at least one project demonstrating that skill"
  - "Hierarchical skills: category > subcategory > skill with proficiency levels"

# Metrics
duration: 3min
completed: 2026-01-30
---

# Phase 02 Plan 02: Experience & Skills Schemas Summary

**Project-centric experience with role context and hierarchical skills with mandatory evidence linking to projects**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-30T18:34:55Z
- **Completed:** 2026-01-30T18:37:40Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Experience schema with project-centric structure (projects as primary achievement unit under roles)
- Skills schema with hierarchical organization (category/subcategory) and evidence linking
- Evidence linking enforced via min(1) constraint on evidence array (per RESEARCH.md Pitfall 5)
- Test fixtures updated with valid experience/skills data and 4 new invalid skill cases
- 45 new tests covering experience, project, role, metrics, and skills validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add experience schema with project-centric structure** - `0165e25` (feat)
2. **Task 2: Add skills schema with evidence linking** - `b3b0743` (feat)

## Files Created/Modified

- `schemas/profile.schema.js` - Added MetricsSchema, ProjectSchema, RoleSchema, ExperienceEntrySchema, SkillSchema
- `schemas/profile.schema.test.js` - Added 45 new tests for experience and skills validation
- `test/fixtures/valid-profile.json` - Added experience entry with project and skill with evidence
- `test/fixtures/invalid-profiles.json` - Added 4 invalid skill cases (empty evidence, invalid proficiency, confidence boundaries)

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| 02-02-01 | Project-centric experience structure | Projects are reusable across resume versions; achievements live at project level, not role level |
| 02-02-02 | Skills require min(1) evidence | Per RESEARCH.md Pitfall 5 - skills without evidence cannot answer "show where you used X" queries |
| 02-02-03 | Three-tier proficiency (familiar/proficient/expert) | Simple, industry-standard levels; avoid over-granularity |
| 02-02-04 | Source tracking (explicit/inferred) | Distinguish user-stated skills from those derived from experience analysis |
| 02-02-05 | One-way skill-to-project linking | Avoid circular JSON references; skills reference projects by ID |

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 02-03: Summaries & Stories Schemas**

Foundation provides:
- Experience schema with project-centric structure
- Skills schema with evidence linking
- Valid fixture with experience and skill entries
- Test patterns for schema validation

Plan 02-03 will:
- Define SummaryBlockSchema for modular summary generation
- Define STARStorySchema for interview stories
- Add preferences schema (target roles, communication style)
- Complete the profile schema with all entity types

---
*Phase: 02-self-profile-schema*
*Completed: 2026-01-30*
