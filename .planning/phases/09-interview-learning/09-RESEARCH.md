# Phase 9: Interview Learning - Research

**Researched:** 2026-02-02
**Domain:** Interview feedback capture, learning extraction, and profile feedback loop
**Confidence:** HIGH

## Summary

Phase 9 builds the feedback loop that captures interview experiences (practice and real) and feeds learnings back into the profile. The core challenge is capturing unstructured interview transcripts, extracting actionable learnings from them, and connecting those learnings to existing profile items (stories, skills, summaries) while maintaining user control over all profile updates.

The codebase already has strong foundations for this work: the learning queue pattern (`learning-queue.js`) handles extraction queuing with overlap detection, the practice session infrastructure (`practice-session.js`) provides session persistence patterns, and the follow-up engine (`followup-engine.js`) demonstrates time-based reminder logic. The profile schema already tracks history entries and supports confidence scores on skills and stories.

**Primary recommendation:** Extend the learning queue pattern to handle interview-sourced learnings with dual tagging (topic + outcome), use the followup-engine time calculation for 24h interview reminders, and store transcripts in job-research directory alongside practice sessions with full-text search via simple string matching.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 3.x | Schema validation | Already used throughout codebase |
| uuid | 9.x | Unique ID generation | Consistent with existing entity ID patterns |
| date-fns | 3.x | Date manipulation | Already used in followup-engine for day calculations |
| Node fs | Built-in | File persistence | Used by all existing services |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| learning-queue.js | Internal | Learning extraction queue | Extend for interview learnings |
| followup-engine.js | Internal | Time-based reminders | Pattern for 24h interview reminder |
| document-history.js | Internal | Usage tracking | Pattern for learning history |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Simple string search | Full-text search library (lunr.js) | Added complexity vs. sufficient performance for < 1000 transcripts |
| Per-job transcript files | Single transcripts.json | Grouping by job aligns with CONTEXT.md primary organization |
| Complex NLP extraction | Claude-assisted extraction | Simpler, more flexible, handles nuance |

**Installation:**
```bash
# No new npm dependencies needed - use existing stack
# date-fns already installed for followup-engine
```

## Architecture Patterns

### Recommended Project Structure
```
schemas/
  learning.schema.js           # EXTEND: Add InterviewTranscript, InterviewLearning schemas
mcp-server/src/services/
  interview-capture.js         # NEW: Transcript capture, reminder logic
  learning-extractor.js        # NEW: Extract learnings from transcripts
  profile-feedback.js          # NEW: Connect learnings to profile items
mcp-server/src/tools/
  interview-learning-tools.js  # NEW: MCP tools for Phase 9
mcp-server/data/
  job-research/
    {jobId}-transcripts.json   # Interview transcripts per job
    {jobId}-learnings.json     # Extracted learnings per job
  learning-log.json            # Cross-job learning history for patterns
```

### Pattern 1: Dual-Tagged Learning (from CONTEXT.md)
**What:** Each learning tagged with BOTH topic (technical, behavioral, company-specific, compensation) AND outcome (worked, needs-work, neutral)
**When to use:** All learning extraction
**Example:**
```javascript
// Source: CONTEXT.md requirement
export const InterviewLearningSchema = z.object({
  id: z.string().uuid(),
  jobId: z.number(),
  transcriptId: z.string().uuid(),
  extractedAt: z.string(), // ISO date

  // Content
  content: z.string(),
  sourceQuote: z.string().optional(), // Supporting transcript excerpt

  // Dual tagging per CONTEXT.md
  topic: z.enum(['technical', 'behavioral', 'company-specific', 'compensation']),
  outcome: z.enum(['worked', 'needs-work', 'neutral']),

  // Profile linking
  suggestedProfileLinks: z.array(z.object({
    entityType: z.enum(['story', 'skill', 'summary']),
    entityId: z.string().uuid(),
    linkReason: z.string()
  })).default([]),
  confirmedProfileLinks: z.array(z.object({
    entityType: z.enum(['story', 'skill', 'summary']),
    entityId: z.string().uuid(),
    linkedAt: z.string()
  })).default([]),

  // User review
  status: z.enum(['proposed', 'accepted', 'rejected']),
  reviewedAt: z.string().optional()
})
```

### Pattern 2: Time-Based Reminder (from followup-engine.js)
**What:** Calculate days since interview, trigger reminder after threshold
**When to use:** 24h reminder for transcript capture
**Example:**
```javascript
// Source: Adapting mcp-server/src/services/followup-engine.js pattern
import { differenceInDays, differenceInHours, parseISO } from 'date-fns'

export function checkTranscriptReminder(interview) {
  const now = new Date()
  const interviewDate = parseISO(interview.interviewDate)
  const hoursSince = differenceInHours(now, interviewDate)

  // No transcript captured yet and > 24 hours
  if (!interview.transcriptCaptured && hoursSince > 24) {
    return {
      needsReminder: true,
      priority: 'medium',
      hoursSince,
      message: `Interview with ${interview.company} was ${Math.floor(hoursSince / 24)} days ago - capture notes before details fade`
    }
  }

  return { needsReminder: false }
}
```

### Pattern 3: Confidence Score Tracking (from profile.schema.js)
**What:** Track visible confidence scores showing how often stories/skills work in interviews
**When to use:** Profile items used in interviews
**Example:**
```javascript
// Source: Extending schemas/profile.schema.js SkillSchema pattern
// Skills already have: confidence: z.number().min(0).max(100)

// Add interview-derived confidence updates
export function updateProfileConfidence(profileItemId, itemType, learningOutcome) {
  const profile = loadProfile()
  const item = findProfileItem(profile, itemType, profileItemId)

  if (!item) return { updated: false, reason: 'Item not found' }

  // Track interview usage
  if (!item.interviewUsage) {
    item.interviewUsage = { totalUses: 0, workedCount: 0, needsWorkCount: 0 }
  }

  item.interviewUsage.totalUses++
  if (learningOutcome === 'worked') {
    item.interviewUsage.workedCount++
  } else if (learningOutcome === 'needs-work') {
    item.interviewUsage.needsWorkCount++
  }

  // Calculate interview-derived confidence
  const successRate = item.interviewUsage.workedCount / item.interviewUsage.totalUses
  item.interviewConfidence = Math.round(successRate * 100)

  return { updated: true, newConfidence: item.interviewConfidence }
}
```

### Pattern 4: Grouped History with Secondary Views (from CONTEXT.md)
**What:** Primary grouping by job with secondary chronological view
**When to use:** Transcript storage and retrieval
**Example:**
```javascript
// Primary: by job (all interview rounds grouped)
function getTranscriptsForJob(jobId) {
  const path = join(RESEARCH_DIR, `${jobId}-transcripts.json`)
  if (!existsSync(path)) return { interviews: [] }
  return JSON.parse(readFileSync(path, 'utf-8'))
}

// Secondary: chronological timeline across all jobs
function getTranscriptsChronological(options = { limit: 50 }) {
  const files = readdirSync(RESEARCH_DIR).filter(f => f.endsWith('-transcripts.json'))

  const allInterviews = []
  for (const file of files) {
    const jobId = parseInt(file.split('-')[0], 10)
    const data = JSON.parse(readFileSync(join(RESEARCH_DIR, file), 'utf-8'))
    for (const interview of data.interviews) {
      allInterviews.push({ ...interview, jobId })
    }
  }

  // Sort by date descending
  allInterviews.sort((a, b) =>
    new Date(b.interviewDate) - new Date(a.interviewDate)
  )

  return allInterviews.slice(0, options.limit)
}
```

### Anti-Patterns to Avoid
- **Auto-linking learnings to profile:** CONTEXT.md says "user confirms before link is made" - always propose, never auto-apply
- **Separate storage for practice vs real:** CONTEXT.md says "stored alongside real interviews, tagged differently"
- **Complex NLP for learning extraction:** Claude handles extraction - keep services focused on validation and persistence
- **Deleting old transcripts:** CONTEXT.md says "retain history forever (no auto-archiving)"

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date calculations | Custom date math | date-fns differenceInDays/Hours | Already used, handles edge cases |
| Learning queue management | New queue system | Extend learning-queue.js | Pattern for extraction + overlap detection exists |
| String similarity for overlaps | Custom algorithm | stringSimilarity() from learning-queue.js | Already implemented, tested |
| Atomic file writes | Simple writeFileSync | atomicWriteSync pattern | Prevents corruption on crash |
| Profile item lookup | Inline search | Extend profile-loader.js | Centralized profile access |
| UUID generation | Custom IDs | uuid v4 | Consistent with codebase |

**Key insight:** Phase 9's complexity is in the workflow (capture -> extract -> propose -> confirm -> link), not in the infrastructure. Reuse existing patterns and focus on the learning-specific logic.

## Common Pitfalls

### Pitfall 1: Auto-Applying Learnings to Profile
**What goes wrong:** Learnings automatically update profile items without user review
**Why it happens:** Trying to be helpful by reducing user clicks
**How to avoid:** CONTEXT.md explicitly requires "Claude proposes learnings for user review (user accepts/rejects)" and "user confirms before link is made"
**Warning signs:** Any code path that modifies profile without user confirmation

### Pitfall 2: Losing Transcript Context
**What goes wrong:** Extracted learnings lose connection to original transcript
**Why it happens:** Storing learnings separately without source linking
**How to avoid:** Store both raw transcript AND extracted highlights (per CONTEXT.md), link learnings to transcriptId + optional sourceQuote
**Warning signs:** Learnings without transcriptId, no way to "show me where this came from"

### Pitfall 3: Mixing Practice and Real Interview Data
**What goes wrong:** Practice session insights mixed with real interview outcomes
**Why it happens:** Not differentiating session types in storage
**How to avoid:** Tag with sessionType: 'practice' | 'real-interview', store in same place but filter appropriately
**Warning signs:** Progress calculations including practice when only real interviews should count

### Pitfall 4: Aggressive Reminder Timing
**What goes wrong:** Annoying users with constant reminders
**Why it happens:** Checking reminder status on every interaction
**How to avoid:** CONTEXT.md says remind if ">24h since interview with no notes captured" - once per day maximum, not on every API call
**Warning signs:** Multiple reminders per day, reminder showing when transcript already captured

### Pitfall 5: Pattern Detection Without Sufficient Data
**What goes wrong:** Claiming "this question comes up a lot" after 2 occurrences
**Why it happens:** Premature pattern detection
**How to avoid:** Set minimum thresholds for pattern claims (e.g., 3+ occurrences across different companies)
**Warning signs:** Pattern alerts after single or double occurrences

### Pitfall 6: Ignoring Conflict Resolution
**What goes wrong:** Learning contradicts existing profile content without flagging
**Why it happens:** Only checking for additions, not conflicts
**How to avoid:** CONTEXT.md says "Conflicts between learning and existing profile content: flag for user review"
**Warning signs:** Overwriting profile content, contradictory information coexisting

## Code Examples

Verified patterns from official sources:

### InterviewTranscriptSchema (NEW)
```javascript
// Source: Following learning.schema.js patterns
export const InterviewTranscriptSchema = z.object({
  // Identification
  id: z.string().uuid(),
  jobId: z.number(),

  // Session type per CONTEXT.md
  sessionType: z.enum(['practice', 'real-interview']),

  // Metadata per CONTEXT.md
  interviewDate: z.string(), // ISO date
  interviewerName: z.string().optional(),
  interviewType: z.enum(['phone', 'video', 'onsite']),
  confidenceLevel: z.enum(['high', 'medium', 'low']).optional(),
  overallVibe: z.enum(['went-well', 'neutral', 'rough']).optional(),

  // Content per CONTEXT.md: "Store both raw transcript AND extracted highlights"
  rawTranscript: z.string(),
  highlights: z.array(z.string()).default([]),

  // Metadata
  capturedAt: z.string(), // ISO date
  duration: z.number().optional(), // minutes

  // Linking
  practiceSessionId: z.string().uuid().optional(), // If from Phase 8 practice
  interviewerResearchId: z.string().uuid().optional()
})
```

### Full-Text Search Pattern
```javascript
// Source: Simple search pattern (no external library needed for <1000 transcripts)
export function searchTranscripts(query, options = {}) {
  const { jobId, sessionType, limit = 20 } = options
  const normalizedQuery = query.toLowerCase().trim()
  const words = normalizedQuery.split(/\s+/)

  const results = []
  const files = readdirSync(RESEARCH_DIR).filter(f => f.endsWith('-transcripts.json'))

  for (const file of files) {
    const fileJobId = parseInt(file.split('-')[0], 10)
    if (jobId && fileJobId !== jobId) continue

    const data = JSON.parse(readFileSync(join(RESEARCH_DIR, file), 'utf-8'))

    for (const interview of data.interviews) {
      if (sessionType && interview.sessionType !== sessionType) continue

      const content = interview.rawTranscript.toLowerCase()

      // All words must appear
      const allMatch = words.every(word => content.includes(word))
      if (allMatch) {
        // Find context around first match
        const firstWord = words[0]
        const matchIndex = content.indexOf(firstWord)
        const contextStart = Math.max(0, matchIndex - 50)
        const contextEnd = Math.min(content.length, matchIndex + 200)

        results.push({
          jobId: fileJobId,
          interviewId: interview.id,
          interviewDate: interview.interviewDate,
          sessionType: interview.sessionType,
          matchContext: interview.rawTranscript.substring(contextStart, contextEnd),
          company: interview.company
        })
      }
    }
  }

  // Sort by date descending
  results.sort((a, b) => new Date(b.interviewDate) - new Date(a.interviewDate))

  return results.slice(0, limit)
}
```

### Learning Extraction Service Pattern
```javascript
// Source: Following learning-queue.js queueExtraction pattern
import { getOverlapCandidates, stringSimilarity } from '../data/learning-queue.js'

export function queueInterviewLearning(learning) {
  const id = learning.id || uuidv4()

  const fullLearning = {
    ...learning,
    id,
    status: 'proposed',
    extractedAt: learning.extractedAt || new Date().toISOString()
  }

  // Check for similar existing learnings (dedup)
  const existingLearnings = loadLearningsForJob(learning.jobId)
  const isDuplicate = existingLearnings.learnings.some(existing =>
    stringSimilarity(existing.content, learning.content) > 0.85
  )

  if (isDuplicate) {
    return { queued: false, reason: 'Similar learning already exists' }
  }

  // Find potential profile links
  const candidates = getOverlapCandidates({
    category: learning.topic === 'behavioral' ? 'story' : 'skill',
    content: learning.content
  })

  if (candidates.length > 0) {
    fullLearning.suggestedProfileLinks = candidates.map(c => ({
      entityType: c.field.includes('stories') ? 'story' : 'skill',
      entityId: c.profileItemId,
      linkReason: `${Math.round(c.similarity * 100)}% content match`
    }))
  }

  // Save to job learnings
  const learningsData = loadLearningsForJob(learning.jobId)
  learningsData.learnings.push(fullLearning)
  saveLearningsForJob(learning.jobId, learningsData)

  return { queued: true, id, hasSuggestedLinks: candidates.length > 0 }
}
```

### Profile Update Suggestion Pattern
```javascript
// Source: Following CONTEXT.md "Claude decides when to present updates"
export function getProfileUpdateSuggestions(options = {}) {
  const { mode = 'batch' } = options // 'batch' (after interview) or 'aggregate' (weekly review)

  const allLearnings = loadAllAcceptedLearnings()
  const suggestions = []

  // Group by profile item
  const byProfileItem = new Map()
  for (const learning of allLearnings) {
    for (const link of learning.confirmedProfileLinks) {
      const key = `${link.entityType}:${link.entityId}`
      if (!byProfileItem.has(key)) {
        byProfileItem.set(key, [])
      }
      byProfileItem.get(key).push(learning)
    }
  }

  // Generate suggestions
  for (const [key, learnings] of byProfileItem) {
    const [entityType, entityId] = key.split(':')
    const profileItem = findProfileItem(entityType, entityId)

    if (!profileItem) continue

    const workedCount = learnings.filter(l => l.outcome === 'worked').length
    const needsWorkCount = learnings.filter(l => l.outcome === 'needs-work').length

    // Check for conflicts
    const hasConflict = workedCount > 0 && needsWorkCount > 0

    suggestions.push({
      entityType,
      entityId,
      entityName: profileItem.title || profileItem.name,
      workedCount,
      needsWorkCount,
      learnings: learnings.map(l => ({
        id: l.id,
        content: l.content,
        outcome: l.outcome,
        interviewDate: l.interviewDate
      })),
      recommendation: hasConflict
        ? 'Review: Mixed results in interviews'
        : workedCount > needsWorkCount
          ? 'This is working well - consider strengthening'
          : 'Consider revising based on feedback',
      hasConflict
    })
  }

  return suggestions
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual note-taking | Paste transcripts from Otter.ai etc. | 2024+ | Better capture, searchable history |
| Review notes once | Pattern detection across interviews | 2025+ | Identify recurring themes/questions |
| Gut feel on story effectiveness | Track worked/needs-work outcomes | 2025+ | Data-driven story refinement |
| Static profile | Feedback-loop profile evolution | 2025+ | Continuous improvement |

**Deprecated/outdated:**
- Manual interview journaling: Replace with structured transcript capture
- One-time learning review: Replace with ongoing aggregation and pattern detection
- Isolated practice and real interview data: Combine for comprehensive view

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal batch vs aggregate timing**
   - What we know: CONTEXT.md says "Claude decides when to present updates (batch after interview vs aggregate during weekly review)"
   - What's unclear: Exact heuristics for when to batch vs aggregate
   - Recommendation: Default to batch after interview, aggregate weekly for items with 3+ learnings

2. **Pattern detection thresholds**
   - What we know: Need to detect "recurring patterns across interviews"
   - What's unclear: Minimum occurrences before claiming a pattern
   - Recommendation: 3+ occurrences across 2+ different companies for confident pattern claims

3. **Conflict resolution priority**
   - What we know: Flag conflicts for user review
   - What's unclear: How to prioritize which conflicts to surface first
   - Recommendation: Sort by recency (newer learnings first), then by outcome severity (needs-work before neutral)

4. **Transcript storage size limits**
   - What we know: "Retain history forever (no auto-archiving)"
   - What's unclear: Practical size limits for JSON files
   - Recommendation: Monitor file sizes; consider archiving to separate files if > 10MB per job

## Sources

### Primary (HIGH confidence)
- mcp-server/src/data/learning-queue.js - Learning extraction pattern with overlap detection
- mcp-server/src/services/followup-engine.js - Time-based reminder pattern
- mcp-server/src/services/document-history.js - History tracking pattern
- mcp-server/src/services/practice-session.js - Session persistence pattern
- schemas/learning.schema.js - Extraction schema patterns
- schemas/profile.schema.js - Profile structure with confidence scores

### Secondary (MEDIUM confidence)
- [Insight7 - Transcript Analysis](https://insight7.io/transcript-analysis-top-methods-and-practices/) - Extraction best practices
- [Looppanel - Transcript Analysis Guide](https://www.looppanel.com/blog/transcript-analysis) - AI-assisted analysis patterns

### Tertiary (LOW confidence)
- Web search results on conversational analytics 2026 - General trends only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, extends existing patterns
- Architecture: HIGH - Directly follows Phase 8 and learning-queue patterns
- Schemas: HIGH - Validated against existing schema patterns
- Learning extraction: MEDIUM - Claude-assisted extraction avoids complex NLP
- Pattern detection: MEDIUM - Thresholds need validation in practice

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable domain, established patterns)
