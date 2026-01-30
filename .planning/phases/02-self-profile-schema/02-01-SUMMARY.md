---
phase: 02-self-profile-schema
plan: 01
subsystem: profile-data
tags: [zod, validation, profile, history-tracking, atomic-writes]
requires: [01-qa-layer]
provides: [profile-schema, profile-loader, history-tracking]
affects: [02-02, 02-03, phase-03]
tech-stack:
  added: [uuid, date-fns]
  patterns: [zod-validation, atomic-writes, immutable-history]
key-files:
  created:
    - schemas/profile.schema.js
    - schemas/profile.schema.test.js
    - mcp-server/src/data/profile-loader.js
    - mcp-server/src/data/profile-loader.test.js
    - mcp-server/data/profile/master-profile.json
    - test/fixtures/valid-profile.json
    - test/fixtures/invalid-profiles.json
  modified:
    - package.json
    - package-lock.json
decisions:
  - id: 02-01-01
    decision: "Schema version literal '1.0' for future migration support"
    rationale: "Enables schema evolution detection and migration paths"
  - id: 02-01-02
    decision: "Advisory mode as default for validation consistency with Phase 1"
    rationale: "Non-breaking validation logs warnings but allows operations to proceed"
  - id: 02-01-03
    decision: "Immutable history tracking via addHistoryEntry returning new object"
    rationale: "Prevents accidental mutation, enables safe append-only audit trail"
metrics:
  duration: "4 min"
  completed: "2026-01-30"
---

# Phase 02 Plan 01: Core Profile Schema Summary

**One-liner:** Zod profile schema with metadata versioning, atomic file persistence, and immutable append-only history tracking

## What Was Built

### Profile Schema (schemas/profile.schema.js)

Core Zod schemas for validating profile data:

- **ProfileMetadataSchema**: Version tracking with `version`, `createdAt`, `updatedAt`, and `schemaVersion: '1.0'` literal for future migrations
- **HistoryEntrySchema**: Change tracking with UUID, timestamp, action (create/update/delete), entityType (experience/skill/summary/story/preference), and optional reason
- **ProfileSchema**: Main structure with metadata, experience[], skills[], summaryBlocks[], stories[], preferences, and history[]

Validation functions matching job.schema.js patterns:
- `validateProfile(data, { mode: 'advisory' | 'strict' })` - Full profile validation
- `validateHistoryEntry(entry, options)` - Single history entry validation

### Profile Loader (mcp-server/src/data/profile-loader.js)

Profile persistence with validation and history:

- **loadProfile()**: Loads from `mcp-server/data/profile/master-profile.json`, creates empty profile if none exists, validates on load with warnings
- **saveProfile(profile)**: Atomic write using write-to-temp-then-rename pattern, validates before save with advisory warnings
- **addHistoryEntry(profile, ...)**: Creates immutable history entry, returns new profile object without mutation
- **createEmptyProfile()**: Generates valid empty profile structure with current timestamp

### Test Fixtures

- `test/fixtures/valid-profile.json`: Complete valid empty profile for testing
- `test/fixtures/invalid-profiles.json`: 7 invalid cases covering: missing metadata, wrong schema version, invalid history action/entityType/uuid, missing required fields, negative version

## Test Coverage

| File | Tests | Status |
|------|-------|--------|
| schemas/profile.schema.test.js | 38 | Pass |
| mcp-server/src/data/profile-loader.test.js | 20 | Pass |
| **Total** | **58** | **Pass** |

Test categories:
- Schema validation (valid/invalid profiles)
- Metadata validation (version, timestamps, schema version)
- History entry validation (all actions, entity types, UUIDs)
- Advisory vs strict mode behavior
- Loader create/load/save operations
- Atomic write verification
- History immutability (no mutation)

## Dependencies Added

```json
{
  "uuid": "^11.1.0",
  "date-fns": "^4.1.0"
}
```

- **uuid**: RFC 4122 compliant UUIDs for history entry IDs
- **date-fns**: Date manipulation (available for future use, primarily using native Date.toISOString())

## Deviations from Plan

None - plan executed exactly as written.

## Key Patterns Established

### 1. Advisory Mode Validation
```javascript
const validation = validateProfile(data)
if (!validation.valid) {
  console.error('Validation warnings:', validation.errors)
}
// Continue with validation.data regardless
```

### 2. Atomic File Writes
```javascript
const tempPath = PROFILE_PATH + '.tmp'
writeFileSync(tempPath, JSON.stringify(profile, null, 2))
renameSync(tempPath, PROFILE_PATH)
```

### 3. Immutable History Tracking
```javascript
function addHistoryEntry(profile, ...) {
  const entry = { id: uuidv4(), timestamp: new Date().toISOString(), ... }
  return {
    entry,
    profile: { ...profile, history: [...profile.history, entry] }
  }
}
```

## Commits

| Hash | Message |
|------|---------|
| 5040c1d | feat(02-01): create core profile schema with Zod validation |
| 6d41cd8 | feat(02-01): create profile loader with atomic writes and history tracking |

## Next Phase Readiness

**Ready for Plan 02-02: Experience & Skills Schemas**

Foundation provides:
- Profile schema with placeholder arrays for experience/skills (z.array(z.unknown()))
- Profile loader for persistence
- History tracking for change auditing
- Test patterns and fixtures to extend

Plan 02-02 will:
- Define ExperienceEntrySchema and ProjectSchema
- Define SkillSchema with evidence linking
- Add validation exports to profile schema
- Extend test fixtures
