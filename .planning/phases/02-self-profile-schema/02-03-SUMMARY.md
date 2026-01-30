---
phase: 02-self-profile-schema
plan: 03
completed: 2026-01-30
duration: 8 min

subsystem: profile-schema
tags: [zod, mcp-tools, profile, stories, summaries, preferences]

dependency-graph:
  requires: ["02-01", "02-02"]
  provides: ["complete-profile-schema", "mcp-profile-tools"]
  affects: ["03-profile-population", "04-resume-generation", "05-interview-prep"]

tech-stack:
  added: []
  patterns: ["mocked-loader-testing", "nullable-optional-schema", "audience-tagging"]

key-files:
  created:
    - mcp-server/src/tools/profile.js
    - mcp-server/src/tools/profile.test.js
  modified:
    - schemas/profile.schema.js
    - schemas/profile.schema.test.js
    - test/fixtures/valid-profile.json
    - mcp-server/src/index.js

decisions:
  - id: "02-03-01"
    description: "Summary blocks use audience enum (technical, leadership, executive, mission-driven)"
    rationale: "Predefined audiences enable consistent filtering and generation"

  - id: "02-03-02"
    description: "STAR stories have base components plus optional variants by audience"
    rationale: "Variants allow audience-specific emphasis while maintaining core story"

  - id: "02-03-03"
    description: "Target roles use enum for level and company stage"
    rationale: "Enumerated values enable filtering and job matching"

  - id: "02-03-04"
    description: "Communication prefs use nullable().optional() for backwards compatibility"
    rationale: "Existing profiles may have null communication field"

  - id: "02-03-05"
    description: "MCP tool tests use vi.mock for loader isolation"
    rationale: "File system state was causing test flakiness; mocking provides reliable isolation"

metrics:
  tests-added: 50
  tests-total: 375
  schemas-added: 5
  mcp-tools-added: 7
---

# Phase 2 Plan 3: Summaries, Stories, Preferences & MCP Tools Summary

**One-liner:** Complete profile schema with audience-tagged summaries, STAR stories with variants, job preferences, and 7 MCP tools for profile access.

## What Was Built

### Schemas Added (5 new)

1. **SummaryBlockSchema** - Modular paragraphs for audience-specific summary generation
   - `content`: The paragraph text
   - `audiences`: Array of enum values (technical, leadership, executive, mission-driven)
   - `themes`: Cross-reference tags for filtering

2. **StoryVariantSchema** - Audience-specific STAR adjustments
   - `audience`: Enum (technical, leadership, behavioral)
   - Optional overrides for situation, task, action, result

3. **STARStorySchema** - Interview stories with variants
   - Base STAR components (all required)
   - `questionCategories`: Maps to interview question types
   - `variants`: Array of audience-specific versions
   - `projectRef`: Optional link to experience project

4. **TargetRoleSchema** - Job search criteria
   - `title`, `level` (enum), `industries`, `companyStages` (enum)
   - `remotePref` (enum), `locations`, `salaryRange`
   - `priorities`, `dealbreakers`

5. **CommunicationPrefsSchema** - Tone and style
   - `tone`: formal, conversational, direct, warm
   - `verbosity`: concise, balanced, detailed
   - `emphasisAreas`, `avoidPhrases`, `customGuidelines`

### MCP Tools Added (7 new)

| Tool | Purpose | Parameters |
|------|---------|------------|
| `get_profile` | Returns full profile data | None |
| `get_experience_by_theme` | Filter experience by project tags | `theme` |
| `get_stories_by_category` | Filter STAR stories by question category | `category` |
| `get_skills_by_category` | Filter skills by category/subcategory | `category` |
| `get_summary_blocks_by_audience` | Filter summaries by audience | `audience` |
| `get_target_roles` | Get job search criteria | None |
| `get_communication_prefs` | Get tone/style preferences | None |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `dec72a0` | feat | Add summary blocks and STAR story schemas |
| `1c8d6e4` | feat | Add target role and communication preferences schemas |
| `42aa275` | feat | Create MCP tools for profile access |

## Test Coverage

- **Schema tests:** 133 total (50 new for summaries, stories, preferences)
- **MCP tool tests:** 34 new (mocked loader for isolation)
- **Total project tests:** 375 (all passing)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CommunicationPrefsSchema backwards compatibility**
- **Found during:** Task 3 (MCP tool tests)
- **Issue:** Existing profiles have `communication: null`, but `optional()` only accepts `undefined`
- **Fix:** Changed to `CommunicationPrefsSchema.nullable().optional()`
- **Files modified:** schemas/profile.schema.js
- **Commit:** 42aa275

**2. [Rule 3 - Blocking] Test isolation with file system**
- **Found during:** Task 3 (MCP tool tests failing)
- **Issue:** Profile loader was reading stale profile file instead of test fixture
- **Fix:** Used `vi.mock()` to mock the loadProfile function for test isolation
- **Files modified:** mcp-server/src/tools/profile.test.js
- **Commit:** 42aa275

## Requirements Coverage

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| PROF-01 (Core profile) | Complete | ProfileSchema with all sections |
| PROF-02 (Experience) | Complete | ExperienceEntrySchema (02-02) |
| PROF-03 (Skills) | Complete | SkillSchema with evidence linking (02-02) |
| PROF-04 (Summaries) | Complete | SummaryBlockSchema with audiences |
| PROF-05 (Stories) | Complete | STARStorySchema with variants |
| PROF-06 (Target roles) | Complete | TargetRoleSchema in preferences |
| PROF-07 (Communication) | Complete | CommunicationPrefsSchema |

## Phase 2 Completion Status

**Phase 2: Self-Profile Schema is now COMPLETE**

All 3 plans executed:
- 02-01: Core profile schema with metadata and history tracking
- 02-02: Experience entries (project-centric) and skills (evidence-linked)
- 02-03: Summaries, stories, preferences, and MCP tools

Total new tests: 173 (20 loader + 83 schema + 20 original + 50 summaries/stories/prefs)
Total project tests: 375

## Next Phase Readiness

**Ready for Phase 3: Profile Population**

The schema infrastructure is complete. Phase 3 will:
1. Import existing resume data into the profile
2. Create summary blocks from current content
3. Extract STAR stories from experience
4. Define target roles and communication preferences

**No blockers identified.**
