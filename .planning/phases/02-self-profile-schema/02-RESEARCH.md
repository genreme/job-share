# Phase 2: Self-Profile Schema - Research

**Researched:** 2026-01-30
**Domain:** JSON Schema Validation, Professional Profile Data Structures, History Tracking
**Confidence:** HIGH

## Summary

This phase creates a centralized data structure (`master-profile.json`) for storing professional identity information. The existing codebase uses Zod for schema validation (as established in Phase 1), which should continue for consistency. The schema must support hierarchical skills, project-level experience entries, STAR-format interview stories, and version history tracking.

Research confirms that Zod provides excellent TypeScript integration and advisory validation mode already used in the job schema. The user decisions from CONTEXT.md lock several structural choices: project-level as primary unit, hierarchical skills with evidence linking, and on-demand summary generation from building blocks.

**Primary recommendation:** Continue using Zod (consistent with Phase 1), implement append-only history tracking for profile changes, and structure experience around projects nested under roles.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^3.x (installed) | Schema validation with TypeScript inference | Already used in Phase 1 for job schema; provides advisory mode, excellent DX |
| Node.js fs | Built-in | File operations for profile storage | Local-first requirement; atomic writes already established |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uuid | ^9.x | Generate unique IDs for entries | Projects, stories, skills need stable identifiers for cross-referencing |
| date-fns | ^3.x | Date manipulation for history timestamps | ISO date handling, version timestamps |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zod | Ajv + JSON Schema | Ajv is 5-18x faster but Zod already established; consistency > micro-optimization |
| Single JSON file | Multiple JSON files (modular) | Modular adds complexity for limited benefit; single file simpler for local-first |
| Full event sourcing | Append-only history array | Event sourcing overkill for single-user profile; simple history sufficient |

**Installation:**
```bash
npm install uuid date-fns
```

## Architecture Patterns

### Recommended Project Structure
```
mcp-server/
├── data/
│   └── profile/
│       └── master-profile.json    # Primary profile storage
├── src/
│   ├── data/
│   │   └── profile-loader.js      # Load/save profile with validation
│   └── tools/
│       └── profile.js             # MCP tool implementations
schemas/
├── profile.schema.js              # Zod schemas for profile data
├── profile.schema.test.js         # Schema validation tests
test/fixtures/
├── valid-profile.json             # Test fixture
└── invalid-profiles.json          # Invalid cases for testing
```

### Pattern 1: Project-Centric Experience Structure
**What:** Experience organized as roles containing projects, with projects as the primary unit of achievement
**When to use:** When accomplishments need to be reused across different resume versions
**Example:**
```javascript
// Source: CONTEXT.md decisions
const ExperienceEntrySchema = z.object({
  id: z.string().uuid(),
  role: z.object({
    title: z.string().min(1),
    company: z.string().min(1),
    location: z.string().optional(),
    startDate: z.string(),  // ISO date
    endDate: z.string().nullable(), // null = current
  }),
  projects: z.array(ProjectSchema),
  version: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),  // Human-readable narrative
  metrics: z.object({       // Optional structured metrics
    value: z.union([z.number(), z.string()]),
    unit: z.string(),
    context: z.string().optional(),
  }).optional(),
  tags: z.array(z.string()),  // Core + custom tags
  skills: z.array(z.string()), // References to skill IDs
})
```

### Pattern 2: Hierarchical Skills with Evidence Linking
**What:** Skills organized in categories > subcategories > skills, each skill requiring evidence
**When to use:** Skills inventory with confidence tracking based on evidence strength
**Example:**
```javascript
// Source: CONTEXT.md decisions
const SkillSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  category: z.string(),      // e.g., "Technical"
  subcategory: z.string(),   // e.g., "Design Systems"
  proficiency: z.enum(['familiar', 'proficient', 'expert']),
  source: z.enum(['explicit', 'inferred']), // User-stated vs derived from experience
  confidence: z.number().min(0).max(100),   // Evidence strength
  evidence: z.array(z.string()).min(1),     // Project IDs demonstrating this skill
  createdAt: z.string(),
  updatedAt: z.string(),
})
```

### Pattern 3: Building Block Summaries
**What:** Modular paragraphs that can be mixed/matched for different audiences
**When to use:** Generating audience-specific summaries on demand
**Example:**
```javascript
const SummaryBlockSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1),
  audiences: z.array(z.enum(['technical', 'leadership', 'executive', 'mission-driven'])),
  themes: z.array(z.string()), // e.g., ['team-scaling', 'revenue-impact']
  createdAt: z.string(),
  updatedAt: z.string(),
})
```

### Pattern 4: STAR Stories with Audience Variants
**What:** Interview stories in STAR format with multiple versions per audience
**When to use:** Interview prep and behavioral question responses
**Example:**
```javascript
const STARStorySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),  // Short identifier
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  questionCategories: z.array(z.string()), // Maps to interview question types
  themes: z.array(z.string()),  // e.g., ['leadership', 'conflict-resolution']
  variants: z.array(z.object({
    audience: z.enum(['technical', 'leadership', 'behavioral']),
    situation: z.string().optional(),
    task: z.string().optional(),
    action: z.string().optional(),
    result: z.string().optional(),
  })).optional(),
  projectRef: z.string().optional(), // Link to project ID
  createdAt: z.string(),
  updatedAt: z.string(),
})
```

### Pattern 5: Append-Only History Tracking
**What:** Keep previous versions of entries in a history array
**When to use:** Full history tracking per user decision
**Example:**
```javascript
const ProfileHistorySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string(),  // ISO timestamp
  action: z.enum(['create', 'update', 'delete']),
  entityType: z.enum(['experience', 'skill', 'summary', 'story', 'preference']),
  entityId: z.string(),
  previousValue: z.unknown().nullable(),  // Snapshot before change
  newValue: z.unknown().nullable(),       // Snapshot after change
  reason: z.string().optional(),          // Why the change was made
})
```

### Anti-Patterns to Avoid
- **Pre-written summary variants:** Don't store multiple full summaries; use building blocks instead
- **Skills without evidence:** Every skill MUST link to at least one project/experience
- **Flat experience lists:** Projects should nest under roles, not exist at top level
- **Mutable history:** History entries must be append-only, never edited or deleted

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom random ID generator | `uuid` package | Guaranteed uniqueness, RFC 4122 compliant |
| Date handling | Manual ISO string manipulation | `date-fns` | Timezone safety, parsing robustness |
| Schema validation | Custom if/else validation | Zod | Already established, TypeScript inference, descriptive errors |
| Atomic file writes | Direct fs.writeFileSync | Existing pattern from Phase 1 | Already handles write-then-rename for corruption prevention |

**Key insight:** Profile data is critical (corruption = lost professional history). Use established patterns from Phase 1 rather than inventing new approaches.

## Common Pitfalls

### Pitfall 1: Schema Evolution Breaking Existing Data
**What goes wrong:** Adding required fields breaks existing profile files
**Why it happens:** Zod throws on missing required fields
**How to avoid:** Use `.optional()` with `.default()` for new fields; migrate existing data
**Warning signs:** Tests pass on new fixture but fail on real profile

### Pitfall 2: Circular References in Evidence Linking
**What goes wrong:** Skill references project, project references skill = circular JSON
**Why it happens:** Over-eager bidirectional linking
**How to avoid:** Skills reference projects by ID (one-way); projects list skill IDs separately
**Warning signs:** JSON.stringify fails or produces unexpected output

### Pitfall 3: History Explosion
**What goes wrong:** History grows unbounded, file becomes huge
**Why it happens:** Every keystroke creates history entry
**How to avoid:** Batch changes into logical units; consider history pruning after N months
**Warning signs:** Profile file exceeds 1MB

### Pitfall 4: Advisory Mode Hides Invalid Data
**What goes wrong:** Validation warns but allows corrupt data to save
**Why it happens:** Advisory mode returns original data on failure (per Phase 1 pattern)
**How to avoid:** Log warnings prominently; consider "confirm save anyway?" UX in Phase 3
**Warning signs:** Profile loads but queries return unexpected results

### Pitfall 5: Missing Evidence for Inferred Skills
**What goes wrong:** Skills marked "inferred" but no evidence array
**Why it happens:** Extracting skills from text without linking to source
**How to avoid:** Schema requires `evidence.min(1)` for ALL skills
**Warning signs:** Skill queries return items with empty evidence arrays

## Code Examples

Verified patterns from official sources and project conventions:

### Profile Loader with Validation
```javascript
// Source: Phase 1 loader.js pattern + Zod docs
import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { join } from 'path';
import { validateProfile } from '../../../schemas/profile.schema.js';

const PROFILE_PATH = join(process.cwd(), 'mcp-server', 'data', 'profile', 'master-profile.json');

export function loadProfile() {
  if (!existsSync(PROFILE_PATH)) {
    return createEmptyProfile();
  }

  const content = readFileSync(PROFILE_PATH, 'utf-8');
  const data = JSON.parse(content);

  const validation = validateProfile(data);
  if (!validation.valid) {
    console.error('Profile validation warnings:', validation.errors);
  }

  return validation.data;
}

export function saveProfile(profile) {
  const validation = validateProfile(profile);
  if (!validation.valid) {
    console.error('Profile validation warnings:', validation.errors);
    // Advisory mode: warn but allow save
  }

  // Atomic write: write to temp, then rename
  const tempPath = PROFILE_PATH + '.tmp';
  writeFileSync(tempPath, JSON.stringify(profile, null, 2));
  renameSync(tempPath, PROFILE_PATH);

  return { success: true, warnings: validation.errors };
}
```

### Zod Schema with Metadata
```javascript
// Source: Zod v4 metadata docs (zod.dev/metadata)
import { z } from 'zod';

const SkillSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).meta({ description: 'Display name of the skill' }),
  proficiency: z.enum(['familiar', 'proficient', 'expert']).meta({
    description: 'Self-assessed proficiency level',
    examples: ['proficient']
  }),
  evidence: z.array(z.string()).min(1).meta({
    description: 'Project IDs demonstrating this skill'
  }),
}).meta({ description: 'A professional skill with evidence linking' });
```

### Adding History Entry
```javascript
// Source: Event sourcing patterns + project conventions
import { v4 as uuidv4 } from 'uuid';

export function addHistoryEntry(profile, action, entityType, entityId, previousValue, newValue, reason) {
  const entry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    action,
    entityType,
    entityId,
    previousValue,
    newValue,
    reason,
  };

  profile.history = profile.history || [];
  profile.history.push(entry);

  return entry;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON Schema + Ajv | Zod | 2020-2023 adoption | Better TypeScript DX, no need for separate type definitions |
| Pre-written summary variants | Building block composition | Industry trend 2024+ | More flexible, less maintenance |
| Skills as flat list | Hierarchical with evidence | Modern skills taxonomies | Enables "show where you used X" queries |
| Full event sourcing | Simple append-only history | For single-user apps | Sufficient for audit trail without ES complexity |

**Deprecated/outdated:**
- Ajv-only validation: Works but requires extra TypeScript setup; Zod preferred for new code
- Static resume sections: Modern approach uses modular blocks for audience adaptation

## Open Questions

Things that couldn't be fully resolved:

1. **History Pruning Strategy**
   - What we know: History will grow over time
   - What's unclear: When/how to prune old entries without losing audit value
   - Recommendation: Defer to Phase 3; start with unlimited history, evaluate after 3 months usage

2. **Skill Category Hierarchy Depth**
   - What we know: Categories > subcategories > skills is decided
   - What's unclear: Exact predefined categories; how deep hierarchy should go
   - Recommendation: Start with common categories (Technical, Leadership, Domain, Soft Skills), allow custom subcategories, max 3 levels

3. **Migration from Existing Resume Data**
   - What we know: Current `resume_data_v9_1.json` has experience/skills in different format
   - What's unclear: Automated vs manual migration path
   - Recommendation: Phase 3 handles profile population; this phase builds empty schema first

## Sources

### Primary (HIGH confidence)
- Zod documentation (zod.dev) - Schema definition, validation, metadata
- Phase 1 codebase - Existing patterns for Zod, file handling, test structure
- CONTEXT.md - User decisions constraining schema design

### Secondary (MEDIUM confidence)
- JSON Resume schema (jsonresume.org) - Standard resume field structure
- Snowplow schema versioning - Best practices for version tracking
- Event sourcing patterns - History tracking approaches

### Tertiary (LOW confidence)
- Community discussions on skills taxonomies - General patterns, not verified for this use case

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Zod established in Phase 1, patterns verified
- Architecture: HIGH - User decisions from CONTEXT.md provide clear constraints
- Pitfalls: MEDIUM - Based on general JSON/schema patterns, not project-specific data yet

**Research date:** 2026-01-30
**Valid until:** 2026-03-01 (60 days - stable domain, no fast-moving dependencies)
