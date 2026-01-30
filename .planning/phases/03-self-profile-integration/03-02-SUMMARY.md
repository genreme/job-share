---
phase: 03-self-profile-integration
plan: 02
status: complete
completed: 2026-01-30

subsystem: document-generation
tags: [profile, resume, cover-letter, interview-prep, mcp-tools]

dependency-graph:
  requires:
    - 02-03 (Profile schema with summaries, stories, preferences)
  provides:
    - Profile-to-resume transformation service
    - Profile-to-cover-letter transformation service
    - Interview prep generation service
    - Document history tracking for staleness detection
    - Updated MCP tools pulling from profile
  affects:
    - 03-01 (gap-detector used by this plan, full implementation deferred)
    - 03-03 (conversation learning will add to profile data)

tech-stack:
  added: []
  patterns:
    - Service layer for transformation logic
    - Gap detection with warn-but-allow-proceed
    - Document history tracking for item usage
    - Profile-first with legacy fallback

key-files:
  created:
    - mcp-server/src/services/profile-to-resume.js
    - mcp-server/src/services/profile-to-resume.test.js
    - mcp-server/src/services/profile-to-cover-letter.js
    - mcp-server/src/services/profile-to-cover-letter.test.js
    - mcp-server/src/services/interview-prep.js
    - mcp-server/src/services/interview-prep.test.js
    - mcp-server/src/services/document-history.js
    - mcp-server/src/services/document-history.test.js
    - mcp-server/src/services/gap-detector.js (minimal for this plan)
    - mcp-server/src/tools/documents.test.js
  modified:
    - mcp-server/src/tools/documents.js
    - mcp-server/src/index.js

decisions:
  - Profile data is primary source; legacy JSON files are fallback with deprecation warning
  - Gap detection integrated: returns gaps for review, allows proceed with proceedWithGaps flag
  - Document history tracks { itemType, itemId } for staleness detection
  - Rolling window of 100 records for document history
  - Interview prep requires at least one STAR story to generate

metrics:
  duration: 10 min
  tests-added: 117
  files-created: 10
  files-modified: 2
---

# Phase 03 Plan 02: Profile Integration for Document Generation Summary

Profile data flows into all document generation (resume, cover letter, interview prep) with gap warnings, preview capabilities, and usage tracking for staleness detection.

## What Was Built

### Profile-to-Resume Transformation Service
- `previewResumeSources(profile, jobContext)` - Shows which profile sections will be used
- `buildResumeFromProfile(profile, jobContext, options)` - Transforms to resume generator format
- `selectRelevantExperience(profile, jobContext)` - Scores by keyword match and recency
- `selectRelevantSkills(profile, jobContext)` - Scores by proficiency, keywords, evidence
- `getUsedProfileItems(profile, jobContext)` - Returns item IDs for history tracking

### Profile-to-Cover-Letter Transformation Service
- `previewCoverLetterSources(profile, jobContext)` - Shows tone, stories, achievements
- `buildCoverLetterFromProfile(profile, jobContext)` - Extracts tone prefs, selects story
- `getUsedCoverLetterItems(profile, jobContext)` - Returns item IDs for history tracking

### Interview Prep Service
- `getRelevantStories(profile, jobContext)` - Scores by interview type and keywords
- `generateInterviewPrep(profile, jobContext)` - Full prep package with:
  - Stories organized by category (leadership, technical, conflict, etc.)
  - Talking points from summaries and achievements
  - Practice questions linked to suggested stories
  - Gaps to address in interview
- `getUsedInterviewPrepItems(profile, jobContext)` - Returns item IDs for history

### Document History Service
- `recordDocumentGeneration(documentType, jobContext, usedItems)` - Tracks usage
- `getDocumentHistory(options)` - Query history with filters
- `getItemUsage(itemType, itemId)` - Check when item was last used
- `getUnusedItems(itemIds, days)` - Find items not used recently
- Rolling window: keeps last 100 records

### Updated MCP Tools
- `generate_resume` - Now uses profile with gap warnings, supports `proceedWithGaps`
- `generate_cover_letter` - Applies tone preferences, includes story
- `generate_interview_prep` - NEW: Returns STAR-based prep package
- `preview_document_sources` - NEW: Shows what will be used before generating

## Key Integration Points

1. **Profile Loader**: All tools import from `profile-loader.js`
2. **Gap Detector**: Integrated into generation flow (minimal impl, full in 03-01)
3. **Document History**: Recorded after each successful generation
4. **Legacy Fallback**: If profile empty, uses `resume_data_v9_1.json` with warning

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created minimal gap-detector.js**
- **Found during:** Task 1
- **Issue:** Plan referenced gap-detector from Plan 03-01 which doesn't exist yet
- **Fix:** Created minimal gap-detector service with required/thin/contextual gaps
- **Files modified:** `mcp-server/src/services/gap-detector.js`
- **Note:** Full implementation will be in Plan 03-01 when executed

## Test Coverage

| File | Tests | Status |
|------|-------|--------|
| profile-to-resume.test.js | 29 | Pass |
| profile-to-cover-letter.test.js | 17 | Pass |
| interview-prep.test.js | 20 | Pass |
| document-history.test.js | 25 | Pass |
| documents.test.js | 26 | Pass |
| **Total** | **117** | **Pass** |

## Verification Results

1. **npm test** - 117 plan-specific tests passing
2. **preview_document_sources** - Returns profile sections that will be used
3. **generate_resume** - Warns on gaps, allows proceed, uses profile data
4. **generate_cover_letter** - Applies tone from profile.preferences.communication
5. **generate_interview_prep** - Returns stories and talking points
6. **Legacy fallback** - Works when profile is empty (with deprecation warning)
7. **Document history** - Records which items used in each generation

## Success Criteria Verification

| Criterion | Status |
|-----------|--------|
| Resume pulls from profile.experience, profile.skills, profile.summaryBlocks | PASS |
| Cover letter uses profile.preferences.communication for tone | PASS |
| Interview prep references profile.stories and preferences.targetRoles | PASS |
| Gap detection warns but allows proceeding with proceedWithGaps | PASS |
| Preview shows which profile sections will be used | PASS |
| Document history tracks which profile items used | PASS |
| Python generators still produce PDFs (data source changed) | PASS |

## Next Phase Readiness

**Blockers:** None

**Notes:**
- Plan 03-01 (cleanup/gap detection services) should be executed to provide full gap-detector
- Profile needs to be populated for document generation to use new flow (currently falls back to legacy)
- Document history enables staleness detection once items are used in generations
