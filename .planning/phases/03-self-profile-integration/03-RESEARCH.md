# Phase 3: Self-Profile Integration - Research

**Researched:** 2026-01-30
**Domain:** Profile Data Integration, Scheduled Tasks, Conversation Learning, Gap Analysis, Document Generation
**Confidence:** HIGH

## Summary

Phase 3 connects the profile schema (built in Phase 2) to document generation (resume, cover letter, interview prep) and adds intelligent learning from conversations. This requires five key capabilities: (1) scheduled weekly cleanup routines, (2) profile gap detection and recommendation surfacing, (3) profile-driven document generation, (4) conversation-based learning with entity extraction, and (5) confirmation workflows for extracted insights.

The existing codebase provides solid foundations: profile schema with Zod validation, MCP tools for profile queries, atomic file writes, and Python PDF generators. This phase extends these with scheduling (node-cron), fuzzy matching for duplicate detection (string-similarity), and LLM-powered entity extraction (using Claude's structured JSON output capabilities).

**Primary recommendation:** Use node-cron for Saturday scheduled cleanup (simple, sufficient for single-user), string-similarity for duplicate detection with configurable threshold, and Claude's JSON mode for conversation entity extraction with user confirmation before profile updates.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-cron | ^3.x | Schedule weekly cleanup | Lightweight, pure JS cron syntax, sufficient for single-user local-first |
| string-similarity | ^4.x | Duplicate detection | Dice coefficient algorithm, simple API, well-maintained |
| Zod (existing) | ^4.x | Schema validation, gap detection | Already established for profile validation |
| date-fns (existing) | ^4.x | Date calculations for staleness | Already installed, handles age calculations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uuid (existing) | ^13.x | Generate IDs for learning entries | Already installed, needed for new profile entries |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node-cron | node-schedule | node-schedule offers date-based scheduling but overkill for fixed weekly cron |
| node-cron | Agenda (MongoDB) | Persistence is nice but adds MongoDB dependency for single-user app |
| string-similarity | Fuse.js | Fuse.js is for full-text search; string-similarity is simpler for exact comparison |
| Claude JSON extraction | Local NER model | Claude already available, better accuracy, no extra dependencies |

**Installation:**
```bash
npm install node-cron string-similarity
```

## Architecture Patterns

### Recommended Project Structure
```
mcp-server/
├── data/
│   ├── profile/
│   │   └── master-profile.json    # Profile storage (Phase 2)
│   └── learning-queue.json        # Pending confirmations queue
├── src/
│   ├── data/
│   │   ├── profile-loader.js      # Load/save profile (Phase 2)
│   │   └── learning-queue.js      # NEW: Queue for pending extractions
│   ├── services/
│   │   ├── cleanup.js             # NEW: Weekly cleanup logic
│   │   ├── gap-detector.js        # NEW: Gap analysis
│   │   ├── duplicate-detector.js  # NEW: Fuzzy matching
│   │   └── conversation-learner.js # NEW: Entity extraction
│   └── tools/
│       ├── profile.js             # Profile queries (Phase 2)
│       ├── profile-update.js      # NEW: Profile mutations with confirmation
│       ├── documents.js           # Document generation (exists)
│       └── learning.js            # NEW: Learning workflow tools
schemas/
├── profile.schema.js              # Profile schemas (Phase 2)
└── learning.schema.js             # NEW: Learning queue schemas
```

### Pattern 1: Non-Blocking Scheduled Cleanup
**What:** Weekly cleanup runs in background, surfaces findings without auto-changing data
**When to use:** Saturday late night scheduled routine
**Example:**
```javascript
// Source: node-cron docs + CONTEXT.md decisions
import cron from 'node-cron';
import { runCleanupAnalysis } from './services/cleanup.js';

// Schedule for Saturday 11:59 PM
cron.schedule('59 23 * * 6', async () => {
  console.error('[Cleanup] Starting weekly profile analysis...');
  try {
    const findings = await runCleanupAnalysis();
    // Save findings to dashboard queue - do NOT auto-modify profile
    await saveCleanupFindings(findings);
    console.error(`[Cleanup] Found ${findings.duplicates.length} potential duplicates, ${findings.stale.length} stale items`);
  } catch (error) {
    console.error('[Cleanup] Error:', error.message);
  }
}, {
  timezone: 'America/New_York' // User's timezone
});
```

### Pattern 2: Staleness Detection (Age + Usage)
**What:** Items are stale when BOTH old AND unused in recent documents
**When to use:** Weekly cleanup analysis
**Example:**
```javascript
// Source: CONTEXT.md decision: "triggered by BOTH age AND relevance"
import { differenceInDays } from 'date-fns';

const STALENESS_THRESHOLDS = {
  AGE_DAYS: 180,           // 6 months without update
  USAGE_DAYS: 90           // 3 months without appearing in generated docs
};

export function detectStaleItems(profile, documentHistory) {
  const now = new Date();
  const stale = [];

  // Check each skill
  for (const skill of profile.skills) {
    const ageInDays = differenceInDays(now, new Date(skill.updatedAt));
    const lastUsed = findLastUsageDate(skill.id, documentHistory);
    const unusedDays = lastUsed ? differenceInDays(now, lastUsed) : Infinity;

    // Stale only if BOTH conditions met
    if (ageInDays > STALENESS_THRESHOLDS.AGE_DAYS &&
        unusedDays > STALENESS_THRESHOLDS.USAGE_DAYS) {
      stale.push({
        type: 'skill',
        id: skill.id,
        name: skill.name,
        reason: `Not updated in ${ageInDays} days and not used in ${unusedDays} days`,
        suggestion: 'Review and update proficiency level or remove if no longer relevant'
      });
    }
  }

  // Similar checks for stories, experience, summaryBlocks...
  return stale;
}
```

### Pattern 3: Fuzzy Duplicate Detection
**What:** Find potential duplicates using configurable similarity threshold
**When to use:** Weekly cleanup, also before adding new profile entries
**Example:**
```javascript
// Source: string-similarity docs + CONTEXT.md "Claude's discretion on threshold"
import stringSimilarity from 'string-similarity';

const DEFAULT_SIMILARITY_THRESHOLD = 0.85; // 85% similar = potential duplicate

export function detectDuplicates(profile, threshold = DEFAULT_SIMILARITY_THRESHOLD) {
  const duplicates = [];

  // Check skills for duplicates
  const skillNames = profile.skills.map(s => s.name.toLowerCase());
  for (let i = 0; i < skillNames.length; i++) {
    for (let j = i + 1; j < skillNames.length; j++) {
      const similarity = stringSimilarity.compareTwoStrings(
        skillNames[i],
        skillNames[j]
      );
      if (similarity >= threshold) {
        duplicates.push({
          type: 'skill',
          items: [profile.skills[i], profile.skills[j]],
          similarity: Math.round(similarity * 100),
          suggestion: 'Consider merging or removing duplicate'
        });
      }
    }
  }

  // Similar for stories (compare titles + situations)
  // Similar for summaryBlocks (compare content)
  return duplicates;
}
```

### Pattern 4: Gap Detection with Contextual Recommendations
**What:** Identify missing or thin areas based on current task context
**When to use:** Before document generation, shown as warnings not blockers
**Example:**
```javascript
// Source: CONTEXT.md decisions on gap types and behavior
export function detectGaps(profile, jobContext = null) {
  const gaps = [];

  // Required field gaps
  if (!profile.preferences?.communication) {
    gaps.push({
      field: 'preferences.communication',
      severity: 'recommended',
      reason: 'Communication preferences help tailor tone in cover letters',
      suggestion: 'Add your preferred tone (formal/conversational) and phrases to avoid'
    });
  }

  // Thin evidence gaps
  for (const skill of profile.skills) {
    if (skill.evidence.length < 2) {
      gaps.push({
        field: `skills.${skill.id}`,
        severity: 'thin-evidence',
        reason: `${skill.name} only has ${skill.evidence.length} supporting project(s)`,
        suggestion: 'Link additional projects that demonstrate this skill'
      });
    }
  }

  // Contextual gaps (when job context provided)
  if (jobContext) {
    const hasLeadershipStory = profile.stories.some(s =>
      s.questionCategories.includes('leadership')
    );
    if (jobContext.title?.toLowerCase().includes('director') && !hasLeadershipStory) {
      gaps.push({
        field: 'stories',
        severity: 'contextual',
        reason: `Director role but no leadership STAR story found`,
        suggestion: 'Add a story demonstrating leadership for behavioral interviews',
        relevantTo: jobContext.title
      });
    }
  }

  return gaps;
}
```

### Pattern 5: Conversation Entity Extraction (Claude JSON Mode)
**What:** Use Claude to extract professional info from natural conversation
**When to use:** Passive learning during normal interactions
**Example:**
```javascript
// Source: Claude API best practices + CONTEXT.md decisions
// This happens in Claude's conversation, not in MCP server
// MCP tools receive extracted data for confirmation

// Claude extracts with structured output:
const EXTRACTION_PROMPT = `
Analyze this conversation excerpt for professional profile information.
Extract ONLY concrete facts, not opinions or hypotheticals.

Categories to detect:
- skills: New technical/soft skills mentioned with evidence
- achievements: Quantifiable accomplishments
- preferences: Work style, communication, or role preferences
- stories: Potential STAR story elements (situation, task, action, result)
- patterns: Recurring themes (product types, work approaches, growth areas)

Return JSON:
{
  "extractions": [
    {
      "category": "skill|achievement|preference|story|pattern",
      "content": "The extracted information",
      "confidence": "high|medium|low",
      "source_quote": "The exact text that supports this",
      "overlap_check": "description of any existing profile data this might duplicate or update"
    }
  ]
}

Return empty array if no professional information detected.
`;

// MCP tool receives extractions for confirmation
export function queueExtraction(extraction) {
  const queue = loadLearningQueue();
  queue.pending.push({
    id: uuidv4(),
    extraction,
    detectedAt: new Date().toISOString(),
    status: 'pending_confirmation'
  });
  saveLearningQueue(queue);
  return { queued: true, id: extraction.id };
}
```

### Pattern 6: Profile-Driven Document Generation
**What:** Resume/cover letter pulls from profile, not separate source files
**When to use:** Explicit generate command with job context
**Example:**
```javascript
// Source: CONTEXT.md "profile + current conversation + job context"
export async function generateResumeFromProfile(params) {
  const { jobContext, overrides } = params;
  const profile = loadProfile();

  // 1. Show what will be used (per CONTEXT.md)
  const sections = {
    summary: selectSummaryBlocks(profile, jobContext.audience),
    experience: selectRelevantExperience(profile, jobContext),
    skills: selectRelevantSkills(profile, jobContext),
    metrics: extractKeyMetrics(profile, jobContext)
  };

  // 2. Check for gaps (warn but don't block)
  const gaps = detectGaps(profile, jobContext);
  if (gaps.length > 0) {
    console.error(`[Generate] ${gaps.length} profile gaps detected:`, gaps);
    // Return gaps for user confirmation before proceeding
    return {
      status: 'gaps_detected',
      gaps,
      sections,
      message: 'Profile has gaps. Continue anyway?'
    };
  }

  // 3. Build document data from profile
  const documentData = buildDocumentFromProfile(profile, sections, jobContext);

  // 4. Generate PDF using existing Python generator
  // (migrating to profile-based data, keeping PDF generation)
  return generatePDF(documentData, params.outputPath);
}
```

### Anti-Patterns to Avoid
- **Auto-filling gaps:** Never automatically populate missing profile data; always surface and ask
- **Silent updates:** Never update profile without explicit user confirmation
- **Blocking on gaps:** Gaps warn but don't prevent document generation
- **Storing conversations:** Only store extracted insights, not raw conversation text
- **Scheduled auto-changes:** Weekly cleanup finds issues but never auto-fixes them

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom setInterval loop | node-cron | Handles cron syntax, timezone, missed jobs |
| String similarity | Character-by-character comparison | string-similarity | Optimized Dice coefficient, handles edge cases |
| Date age calculations | Manual date math | date-fns differenceInDays | Handles timezone, DST, edge cases |
| UUID generation | Math.random() IDs | uuid package | Already installed, RFC 4122 compliant |
| Entity extraction | Regex pattern matching | Claude structured JSON | Better accuracy for natural language |
| PDF generation | HTML-to-PDF conversion | Existing Python generators | Already working, proven output quality |

**Key insight:** This phase is about integration and flow, not building new infrastructure. Leverage existing profile schema, MCP patterns, and Python generators while adding scheduling, detection, and learning layers.

## Common Pitfalls

### Pitfall 1: Scheduled Job Not Running in MCP Context
**What goes wrong:** Cron job scheduled but MCP server doesn't run continuously
**Why it happens:** MCP servers are typically invoked on-demand, not persistent daemons
**How to avoid:** Two options: (a) Add scheduled task check to MCP startup that runs if overdue, or (b) Make cleanup an explicit tool rather than background job
**Warning signs:** Cleanup never runs despite being scheduled
**Recommended approach:** Make `run_weekly_cleanup` an MCP tool that Claude can call, plus add startup check

### Pitfall 2: Over-Aggressive Duplicate Detection
**What goes wrong:** False positives flag non-duplicates (e.g., "React" vs "React Native")
**Why it happens:** Threshold too low or not accounting for valid similar names
**How to avoid:** Start with 85% threshold, exclude category from comparison (same skill in different categories is valid), allow user to mark as "not duplicate"
**Warning signs:** Users constantly dismissing duplicate warnings

### Pitfall 3: Extraction Overload
**What goes wrong:** Every conversation triggers learning prompts, annoying user
**Why it happens:** Not batching minor extractions, confirming too frequently
**How to avoid:** Batch low-confidence extractions for weekly review, only inline-confirm high-confidence/high-impact items
**Warning signs:** User starts ignoring or declining all extractions
**Confirmation tiers:**
- HIGH importance (new achievement with metrics): Confirm inline
- MEDIUM importance (new skill mention): Queue for end-of-conversation batch
- LOW importance (preference nuance): Queue for weekly review

### Pitfall 4: Gaps Blocking Progress
**What goes wrong:** User can't generate resume because profile has gaps
**Why it happens:** Gap detection treats warnings as errors
**How to avoid:** Always allow "proceed anyway" - gaps inform, never block
**Warning signs:** Users frustrated they can't generate documents
**UX pattern:** "3 profile gaps found (missing leadership story, thin evidence for X). [Fill now] [Add to backlog] [Proceed anyway]"

### Pitfall 5: Profile-Resume Data Mismatch During Migration
**What goes wrong:** Old resume_data_v9_1.json has data not in profile, generation fails
**Why it happens:** Incomplete migration, profile not yet populated
**How to avoid:** Graceful fallback to old data during transition period, track migration status
**Warning signs:** Generated resumes missing content that exists in old JSON

### Pitfall 6: Conversation Learning Privacy Concerns
**What goes wrong:** User uncomfortable that Claude is "remembering" everything
**Why it happens:** Lack of transparency about what's stored
**How to avoid:** Only store extracted facts (not raw conversation), show pending queue visibly, allow easy deletion
**Warning signs:** User asks "what have you learned about me?"

## Code Examples

Verified patterns from official sources and project conventions:

### Learning Queue Schema
```javascript
// Source: Zod patterns from profile.schema.js
import { z } from 'zod';

export const ExtractionSchema = z.object({
  id: z.string().uuid(),
  category: z.enum(['skill', 'achievement', 'preference', 'story', 'pattern']),
  content: z.string().min(1),
  confidence: z.enum(['high', 'medium', 'low']),
  sourceQuote: z.string().optional(), // The text that supports this
  overlapWith: z.string().optional(), // ID of existing profile item if update
  detectedAt: z.string(), // ISO timestamp
  status: z.enum(['pending', 'confirmed', 'rejected', 'merged'])
});

export const LearningQueueSchema = z.object({
  pending: z.array(ExtractionSchema).default([]),
  lastProcessed: z.string().nullable().default(null)
});
```

### Cleanup Findings Schema
```javascript
// Source: Project patterns + CONTEXT.md decisions
export const CleanupFindingSchema = z.object({
  type: z.enum(['duplicate', 'stale', 'gap']),
  entityType: z.enum(['skill', 'story', 'experience', 'summary']),
  ids: z.array(z.string()), // Affected entity IDs
  similarity: z.number().optional(), // For duplicates
  reason: z.string(),
  suggestion: z.string(),
  createdAt: z.string()
});

export const CleanupResultSchema = z.object({
  runAt: z.string(),
  duplicates: z.array(CleanupFindingSchema),
  stale: z.array(CleanupFindingSchema),
  gaps: z.array(CleanupFindingSchema),
  status: z.enum(['complete', 'partial', 'error'])
});
```

### MCP Tool: Confirm Extraction
```javascript
// Source: MCP patterns from index.js + CONTEXT.md workflow
export function confirmExtraction({ extractionId, action, targetField }) {
  const queue = loadLearningQueue();
  const extraction = queue.pending.find(e => e.id === extractionId);

  if (!extraction) {
    return { error: `Extraction ${extractionId} not found` };
  }

  switch (action) {
    case 'confirm':
      // Add to profile based on category
      const profile = loadProfile();
      const updatedProfile = addExtractionToProfile(profile, extraction, targetField);
      saveProfile(updatedProfile);
      extraction.status = 'confirmed';
      break;

    case 'reject':
      extraction.status = 'rejected';
      break;

    case 'merge':
      // Update existing profile item
      if (!extraction.overlapWith) {
        return { error: 'No overlap target specified for merge' };
      }
      const profile2 = loadProfile();
      const merged = mergeWithExisting(profile2, extraction);
      saveProfile(merged);
      extraction.status = 'merged';
      break;

    default:
      return { error: `Unknown action: ${action}` };
  }

  saveLearningQueue(queue);
  return { success: true, extraction };
}
```

### Document Generation Preview
```javascript
// Source: CONTEXT.md "Quick summary of which profile sections will be used"
export function previewDocumentSources(jobContext) {
  const profile = loadProfile();

  // Analyze what will be pulled
  const preview = {
    summary: {
      blocks: profile.summaryBlocks
        .filter(b => b.audiences.includes(jobContext.audience || 'technical'))
        .map(b => ({ id: b.id, preview: b.content.substring(0, 50) + '...' })),
      count: profile.summaryBlocks.length
    },
    experience: {
      roles: profile.experience.map(e => ({
        id: e.id,
        title: e.role.title,
        company: e.role.company,
        projectCount: e.projects.length,
        relevantProjects: e.projects
          .filter(p => matchesJobContext(p, jobContext))
          .map(p => p.name)
      })),
      count: profile.experience.length
    },
    skills: {
      relevant: profile.skills
        .filter(s => matchesJobContext(s, jobContext))
        .map(s => ({ name: s.name, proficiency: s.proficiency })),
      total: profile.skills.length
    },
    stories: {
      matching: profile.stories
        .filter(s => matchesJobCategories(s, jobContext))
        .map(s => ({ id: s.id, title: s.title })),
      total: profile.stories.length
    },
    gaps: detectGaps(profile, jobContext)
  };

  return preview;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate resume JSON | Profile-driven generation | Phase 3 migration | Single source of truth |
| Manual skill tracking | Evidence-linked skills | Phase 2 schema | Provable proficiency |
| Static summaries | Audience-tagged blocks | Phase 2 schema | Dynamic tailoring |
| No learning | Conversation extraction | Phase 3 | Grows profile organically |
| Manual cleanup | Scheduled analysis | Phase 3 | Systematic maintenance |

**Deprecated/outdated:**
- `resume_data_v9_1.json` as primary source: Will be replaced by profile during Phase 3
- Manual duplicate checking: Automated with fuzzy matching

## Open Questions

Things that couldn't be fully resolved:

1. **MCP Server Persistence for Scheduling**
   - What we know: node-cron requires persistent process; MCP servers are invoked on-demand
   - What's unclear: Whether to run MCP server as daemon or make cleanup an explicit tool
   - Recommendation: Make `run_weekly_cleanup` a tool + add "overdue check" on MCP startup. If last cleanup > 7 days, prompt user.

2. **Extraction Confidence Calibration**
   - What we know: Need to distinguish high/medium/low confidence extractions
   - What's unclear: Exact criteria for each level
   - Recommendation: Start with: HIGH = explicit statement with metrics/specifics, MEDIUM = clear statement without metrics, LOW = implied or unclear

3. **Migration Strategy from Old Resume JSON**
   - What we know: Need to transition from resume_data_v9_1.json to profile
   - What's unclear: Manual vs automated migration, timing
   - Recommendation: Phase 3 Plan 1 should handle migration as explicit task, not automatic

4. **Dashboard Section for Cleanup Findings**
   - What we know: CONTEXT.md says "dedicated dashboard section"
   - What's unclear: Exact UI location and design
   - Recommendation: Defer dashboard UI to later phase; Phase 3 focuses on MCP tools that return findings

## Sources

### Primary (HIGH confidence)
- Phase 2 RESEARCH.md - Profile schema patterns, Zod validation
- Existing codebase - MCP tool patterns, profile-loader.js, documents.js
- CONTEXT.md - User decisions constraining implementation

### Secondary (MEDIUM confidence)
- [node-cron npm](https://www.npmjs.com/package/node-cron) - Scheduling API
- [string-similarity npm](https://npm-compare.com/similarity,string-similarity) - Fuzzy matching algorithms
- [LangChain Long-Term Memory](https://langchain-ai.github.io/langmem/concepts/conceptual_guide/) - LLM memory patterns
- [Serokell Design Patterns for LLM Memory](https://serokell.io/blog/design-patterns-for-long-term-memory-in-llm-powered-architectures) - Architecture patterns
- [Claude API structured extraction](https://community.databricks.com/t5/technical-blog/end-to-end-structured-extraction-with-llm-part-1-batch-entity/ba-p/98396) - Entity extraction patterns

### Tertiary (LOW confidence)
- WebSearch results on resume tailoring - General patterns, not verified for this system
- MCP specification discussions - Security best practices, evolving standard

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Libraries verified via npm docs, patterns match existing codebase
- Architecture: HIGH - Extends established Phase 2 patterns, decisions from CONTEXT.md
- Pitfalls: MEDIUM - Based on scheduler docs + LLM memory literature, not project-specific yet
- Conversation learning: MEDIUM - Based on Claude capabilities, needs validation in practice

**Research date:** 2026-01-30
**Valid until:** 2026-03-01 (30 days - involves scheduling and LLM patterns that may evolve)
