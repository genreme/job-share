# Phase 8: Interview Preparation - Research

**Researched:** 2026-02-02
**Domain:** Interview preparation tooling (research, question generation, practice, scoring)
**Confidence:** HIGH

## Summary

Phase 8 builds interview preparation capabilities following established codebase patterns from Phases 6-7. The core challenge is creating a complete interview preparation workflow that integrates multiple data sources (JD, profile, company/manager research) to generate personalized questions, supports practice sessions with text/voice input, and provides meaningful self-scoring against profile STAR stories.

The codebase already has strong foundations: `interview-prep.js` extracts STAR stories by relevance, `manager-research.js` captures interview style signals, and the research persistence pattern provides the template for session storage. The new services will extend these patterns to add interviewer research (distinct from hiring manager research), question generation with difficulty tagging, practice session persistence, and comprehensive answer evaluation.

**Primary recommendation:** Build on existing patterns - use Zod schemas for all new data structures, follow the template-then-populate research pattern from Phase 7, persist all practice sessions per-job using the atomic write pattern, and leverage the existing STAR story infrastructure for answer scoring.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 3.x | Schema validation | Already used throughout codebase (profile, research, learning schemas) |
| uuid | 9.x | Unique ID generation | Consistent with existing entity ID patterns |
| Node fs | Built-in | File persistence | Used by research-persistence.js, learning-queue.js |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Web Speech API | Browser API | Voice recording/transcription | For practice mode voice input (browser-side only) |
| MediaRecorder API | Browser API | Audio capture | Fallback for Web Speech API limitations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Web Speech API | External transcription service | Privacy/offline concerns vs. accuracy |
| Custom voice UI | Nothing (text-only) | Simpler but less natural practice |
| Complex scoring algorithm | LLM-assisted evaluation | Claude does evaluation - simpler, more flexible |

**Installation:**
```bash
# No new npm dependencies needed - use existing stack
# Voice functionality is browser-side using Web Speech API
```

## Architecture Patterns

### Recommended Project Structure
```
schemas/
  interview.schema.js          # All interview prep schemas (NEW)
mcp-server/src/services/
  interviewer-research.js      # Per-interviewer research (NEW)
  question-generator.js        # Question generation logic (NEW)
  practice-session.js          # Session management (NEW)
  answer-scorer.js             # Scoring and feedback (NEW)
  prep-progress.js             # Progress tracking (NEW)
mcp-server/src/tools/
  interview-prep.js            # MCP tools for all interview prep (NEW)
mcp-server/data/
  job-research/
    {jobId}-interviewer-{name}.json  # Per-interviewer research
    {jobId}-practice-sessions.json   # Practice session history per job
    {jobId}-prep-progress.json       # Progress tracking per job
```

### Pattern 1: Research Template Pattern (from Phase 7)
**What:** Return template structure for Claude to populate, then validate and persist
**When to use:** For interviewer research where Claude gathers data from multiple sources
**Example:**
```javascript
// Source: mcp-server/src/services/company-research.js pattern
export function researchInterviewer(jobId, interviewerName, interviewerTitle) {
  const research = {
    id: uuidv4(),
    jobId,
    interviewerName,
    interviewerTitle,
    researchedAt: new Date().toISOString(),
    background: { currentRole: interviewerTitle, previousRoles: [] },
    interviewStyle: { signals: [], expectedQuestionTypes: [], communicationPattern: null },
    talkingPoints: [],
    sharedInterests: [],
    sources: [],
    confidence: 'low'
  }

  return {
    status: 'template_ready',
    research,
    instructions: `Research ${interviewerName}...`
  }
}
```

### Pattern 2: Atomic Write Persistence (from learning-queue.js)
**What:** Write to temp file, then rename for corruption-safe persistence
**When to use:** All practice session and progress saves
**Example:**
```javascript
// Source: mcp-server/src/data/learning-queue.js
function atomicWriteSync(filePath, data) {
  const tempPath = join(tmpdir(), `session-${Date.now()}.tmp`)
  try {
    writeFileSync(tempPath, data, 'utf-8')
    renameSync(tempPath, filePath)
  } catch (err) {
    try { unlinkSync(tempPath) } catch (e) { /* ignore */ }
    throw err
  }
}
```

### Pattern 3: Story Relevance Scoring (from interview-prep.js)
**What:** Score stories by relevance to context (interview type, keywords, job)
**When to use:** Linking questions to suggested stories
**Example:**
```javascript
// Source: mcp-server/src/services/interview-prep.js
const scored = stories.map((story) => {
  let score = 0
  const categories = (story.questionCategories || []).map(c => c.toLowerCase())
  if (interviewType === 'behavioral') {
    if (categories.some(c => c.includes('conflict'))) score += 15
    if (categories.some(c => c.includes('leadership'))) score += 15
  }
  // ... keyword matching, project refs
  return { ...story, relevanceScore: score }
})
```

### Pattern 4: JSON + Markdown Dual Output (from company-research.js)
**What:** Save both structured JSON and human-readable markdown
**When to use:** Interviewer research outputs, practice session summaries
**Example:**
```javascript
// Source: mcp-server/src/services/company-research.js
atomicWriteSync(jsonPath, JSON.stringify(validatedData, null, 2))
const markdown = generateInterviewerMarkdown(validatedData)
atomicWriteSync(markdownPath, markdown)
```

### Anti-Patterns to Avoid
- **Timer-based pressure in practice:** CONTEXT.md explicitly says "No timer - focus on content quality over speed"
- **Auto-filling answers:** All scoring is self-assessment with Claude guidance, never auto-correction
- **Separate voice recording infrastructure:** Use browser Web Speech API, not server-side recording
- **Hard-coded question banks:** Generate questions from JD + profile + research, not static lists

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| STAR story extraction | Custom story parser | `interview-prep.js` getRelevantStories() | Already scores by interview type, keywords |
| Interview style signals | New style analysis | `manager-research.js` interviewStyle schema | Pattern already exists for HM research |
| Session persistence | Simple JSON writes | Atomic write pattern from learning-queue.js | Prevents data corruption |
| Question categorization | Manual categorization | Zod enum validation | Consistent with codebase patterns |
| Answer evaluation | Complex scoring algorithm | Claude conversation with structured prompts | More flexible, handles nuance |

**Key insight:** Phase 8 is largely about orchestrating existing patterns (research, story extraction, persistence) into a new domain (interview preparation), not building fundamentally new infrastructure.

## Common Pitfalls

### Pitfall 1: Over-engineering voice recording
**What goes wrong:** Building complex audio infrastructure with server-side storage
**Why it happens:** Treating voice recording as a core feature rather than optional enhancement
**How to avoid:** Use Web Speech API for transcription in browser, store only transcribed text
**Warning signs:** Adding audio file storage, transcription services, or audio processing libraries

### Pitfall 2: Rigid question generation
**What goes wrong:** Generating the same questions regardless of interview context
**Why it happens:** Not leveraging JD + profile + research inputs fully
**How to avoid:** Generate questions dynamically from: (1) JD keywords/requirements, (2) profile gaps, (3) profile strengths, (4) company/role research, (5) interviewer style
**Warning signs:** Static question lists, no personalization, questions not linked to stories

### Pitfall 3: Opaque scoring
**What goes wrong:** Numeric scores without actionable feedback
**Why it happens:** Focusing on the number rather than the improvement path
**How to avoid:** CONTEXT.md says "Specific rewrites showing how the answer could be improved with concrete examples"
**Warning signs:** Scores without explanations, vague feedback like "be more specific"

### Pitfall 4: Losing practice history
**What goes wrong:** Sessions not persisted, progress not tracked
**Why it happens:** Treating practice as ephemeral rather than learning data
**How to avoid:** Auto-save all sessions per job (CONTEXT.md requirement), track progress over time
**Warning signs:** No session retrieval functionality, no progress trends

### Pitfall 5: Interviewer vs. Hiring Manager confusion
**What goes wrong:** Conflating interviewer research with existing HM research
**Why it happens:** Similar data structures and purposes
**How to avoid:** Interviewer research is per-person in interview loop, HM research is for the role contact
**Warning signs:** Overwriting HM research with interviewer data, not handling multiple interviewers per job

## Code Examples

Verified patterns from official sources:

### InterviewerResearchSchema (extends manager-research.js pattern)
```javascript
// Source: Extending schemas/research.schema.js pattern
export const InterviewerResearchSchema = z.object({
  id: z.string().uuid(),
  jobId: z.number(),
  interviewerName: z.string(),
  interviewerTitle: z.string().optional(),
  interviewRound: z.string().optional(), // "phone screen", "onsite", "final"
  researchedAt: z.string(),

  // Professional background
  background: z.object({
    currentRole: z.string().optional(),
    company: z.string().optional(),
    previousRoles: z.array(z.string()).default([]),
    yearsInRole: z.number().optional(),
    linkedInUrl: z.string().optional()
  }).default({ previousRoles: [] }),

  // Interview style signals (PRIMARY focus per CONTEXT.md)
  interviewStyle: z.object({
    signals: z.array(z.string()).default([]), // From Glassdoor, etc.
    expectedQuestionTypes: z.array(z.enum([
      'behavioral', 'technical', 'system-design', 'culture-fit', 'case-study'
    ])).default([]),
    communicationPattern: z.string().optional(), // "Direct", "Collaborative"
    depthExpectation: z.enum(['surface', 'moderate', 'deep']).optional()
  }).default({ signals: [], expectedQuestionTypes: [] }),

  // Connection building
  talkingPoints: z.array(z.string()).default([]),
  sharedInterests: z.array(z.string()).default([]),

  // Research quality
  confidence: z.enum(['high', 'medium', 'low']),
  sources: z.array(z.string()).default([])
})
```

### InterviewQuestionSchema
```javascript
// Source: New schema following codebase patterns
export const InterviewQuestionSchema = z.object({
  id: z.string().uuid(),
  jobId: z.number(),
  questionText: z.string(),
  category: z.enum(['behavioral', 'technical', 'system-design', 'culture-fit']),
  difficulty: z.enum(['easy', 'medium', 'hard']),

  // Personalization context
  source: z.enum(['jd-requirement', 'profile-gap', 'profile-strength', 'company-research', 'interviewer-style']),
  sourceDetail: z.string().optional(), // e.g., "Missing: Kubernetes experience"

  // Suggested answers
  suggestedStories: z.array(z.object({
    storyId: z.string().uuid(),
    storyTitle: z.string(),
    relevanceScore: z.number()
  })).default([]),
  talkingPoints: z.array(z.string()).default([]),

  // Metadata
  generatedAt: z.string(),
  interviewerId: z.string().uuid().optional() // If generated for specific interviewer
})
```

### PracticeSessionSchema
```javascript
// Source: New schema following learning.schema.js patterns
export const PracticeAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answerText: z.string(), // Transcribed or typed
  inputMethod: z.enum(['text', 'voice']),
  answeredAt: z.string(),
  duration: z.number().optional(), // Seconds if voice

  // Self-scoring (CONTEXT.md: Comprehensive evaluation)
  score: z.object({
    overall: z.number().min(0).max(100),
    storyCoverage: z.number().min(0).max(100),
    starStructure: z.number().min(0).max(100),
    relevance: z.number().min(0).max(100),
    clarity: z.number().min(0).max(100)
  }).optional(),

  feedback: z.object({
    strengths: z.array(z.string()).default([]),
    improvements: z.array(z.string()).default([]),
    suggestedRewrite: z.string().optional() // Per CONTEXT.md: Specific rewrites
  }).optional()
})

export const PracticeSessionSchema = z.object({
  id: z.string().uuid(),
  jobId: z.number(),
  sessionType: z.enum(['full-interview', 'category-focus', 'single-question']),
  startedAt: z.string(),
  completedAt: z.string().optional(),

  answers: z.array(PracticeAnswerSchema).default([]),

  // Session settings (per CONTEXT.md)
  feedbackTiming: z.enum(['immediate', 'batched']),

  // Summary (calculated on completion)
  summary: z.object({
    questionsAttempted: z.number(),
    averageScore: z.number().optional(),
    strongCategories: z.array(z.string()).default([]),
    improvementAreas: z.array(z.string()).default([])
  }).optional()
})
```

### PrepProgressSchema
```javascript
// Source: New schema for CONTEXT.md "Overall trend dashboard"
export const PrepProgressSchema = z.object({
  jobId: z.number(),
  lastUpdated: z.string(),

  // Session history summary
  totalSessions: z.number().default(0),
  totalQuestionsAnswered: z.number().default(0),

  // Score trends
  scoreHistory: z.array(z.object({
    date: z.string(),
    category: z.string(),
    score: z.number()
  })).default([]),

  // Readiness assessment
  readiness: z.object({
    overall: z.number().min(0).max(100),
    byCategory: z.record(z.number()).default({}),
    confidenceLevel: z.enum(['not-ready', 'needs-work', 'ready', 'well-prepared'])
  }).optional(),

  // Areas needing attention
  focusAreas: z.array(z.object({
    category: z.string(),
    reason: z.string(),
    recommendedPractice: z.string()
  })).default([])
})
```

### Web Speech API Integration (Browser-side)
```javascript
// Source: MDN Web Speech API documentation
// Note: This runs in browser (extension popup or dashboard), not MCP server

function startVoiceRecording(onTranscript, onError) {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    onError('Speech recognition not supported in this browser')
    return null
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  const recognition = new SpeechRecognition()

  recognition.continuous = true  // Keep recording
  recognition.interimResults = true  // Show partial results
  recognition.lang = 'en-US'

  let finalTranscript = ''

  recognition.onresult = (event) => {
    let interimTranscript = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + ' '
      } else {
        interimTranscript += event.results[i][0].transcript
      }
    }
    onTranscript(finalTranscript, interimTranscript)
  }

  recognition.onerror = (event) => {
    onError(`Speech recognition error: ${event.error}`)
  }

  recognition.start()
  return recognition  // Return handle for stop()
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Memorize STAR stories | Prepare 3-5 adaptable stories | 2024+ | More natural, less scripted answers |
| Generic question banks | Personalized questions from JD/profile | Current best practice | Higher relevance, better prep |
| Timed practice | Content-focused practice | User preference driven | Less stress, deeper learning |
| Human-only evaluation | AI-assisted evaluation with specifics | 2024-2025 | Faster feedback, concrete rewrites |
| Text-only practice | Voice + text options | Browser API maturity | More realistic practice |

**Deprecated/outdated:**
- Static question lists: Replace with dynamic generation from multiple sources
- Score-only feedback: Must include qualitative breakdown and specific rewrites
- Single interviewer assumption: Support multiple interviewers in interview loop

## Open Questions

Things that couldn't be fully resolved:

1. **Web Speech API browser compatibility**
   - What we know: Chrome/Chromium-based browsers support it well; Safari partial; Firefox limited
   - What's unclear: Whether extension popup has full Web Speech API access
   - Recommendation: Implement text-first with voice as optional enhancement; graceful fallback

2. **Optimal question count per session**
   - What we know: MIT recommends 1.5-2 minute answers; typical interview is 45-60 minutes
   - What's unclear: Ideal practice session length for retention without fatigue
   - Recommendation: Default to 5-7 questions per session; let user customize

3. **Scoring calibration baseline**
   - What we know: Scores should be out of 100 per CONTEXT.md; need consistency
   - What's unclear: What constitutes a "good" score without real interview outcomes
   - Recommendation: Use rubric-based scoring; track relative improvement over absolute scores

## Sources

### Primary (HIGH confidence)
- mcp-server/src/services/company-research.js - Research template pattern
- mcp-server/src/services/manager-research.js - Interviewer style schema pattern
- mcp-server/src/services/interview-prep.js - STAR story extraction and relevance scoring
- mcp-server/src/data/learning-queue.js - Atomic write persistence pattern
- schemas/research.schema.js - Zod schema patterns for research
- schemas/learning.schema.js - Session/extraction schema patterns
- schemas/review.schema.js - Scoring/feedback schema patterns

### Secondary (MEDIUM confidence)
- [MDN Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) - Voice recording implementation
- [MIT STAR Method](https://capd.mit.edu/resources/the-star-method-for-behavioral-interviews/) - Evaluation structure (20% Situation, 10% Task, 60% Action, 10% Result)
- [Polymer Blog - Behavioral Interview Scoring](https://www.polymer.co/blog/behavioral-interview-scoring-matrix) - Scoring rubric patterns

### Tertiary (LOW confidence)
- Interview preparation trends 2026 - WebSearch results suggesting behavioral simulation emerging
- AI coaching platforms - Reference only for feature comparison

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, extends existing patterns
- Architecture: HIGH - Directly follows Phase 6-7 patterns
- Schemas: HIGH - Validated against existing schema patterns
- Voice implementation: MEDIUM - Browser API limitations to verify
- Scoring algorithm: MEDIUM - Claude-assisted evaluation avoids hard-coded scoring

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable domain, established patterns)
