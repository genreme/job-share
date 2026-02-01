# Phase 6: Application Intelligence - Research

**Researched:** 2026-02-01
**Domain:** Resume-JD Matching, Contact Tracking, Follow-up Reminders, Smart Suggestions
**Confidence:** HIGH

## Summary

Phase 6 adds intelligence to the application process through three integrated capabilities: resume-job description matching that identifies gaps before applying, contact tracking that persists recruiter and hiring manager information per job, and time-aware follow-up reminders with smart suggestions based on application stage. This phase builds entirely on existing infrastructure: the profile schema already has skills with evidence linking, the job schema already supports connections and status tracking, and MCP tool patterns are well-established.

The primary work focuses on: (1) Creating a matching service that compares profile skills/experience against job description requirements using keyword extraction and similarity scoring, (2) Extending the existing ConnectionSchema to support richer contact metadata including LinkedIn URLs and interaction history, and (3) Implementing a follow-up engine that calculates days elapsed and suggests stage-appropriate actions.

**Primary recommendation:** Use lightweight keyword extraction (no external ML models) combined with existing profile skill data. Extend job schema minimally to support enhanced contacts. Calculate follow-up timing dynamically from existing date fields rather than storing reminder dates.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed - No New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | ^3.x | Schema validation | Already used throughout codebase |
| date-fns | ^4.x | Date calculations | Already installed, used for staleness |
| uuid | ^9.x | Generate contact IDs | Already installed for profile IDs |

### Supporting (May Need Adding)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| wink-nlp | ^2.x | Lightweight NLP for keyword extraction | If basic string matching insufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| wink-nlp | string-similarity | string-similarity is simpler but no keyword extraction |
| wink-nlp | tensorflow.js | TF.js provides embeddings but heavy (100MB+), overkill for single-user |
| Custom keyword extraction | OpenAI/Claude API | External API adds latency, cost; prefer local processing |
| Custom keyword extraction | spaCy (Python) | Requires Python runtime; keeping stack pure Node.js |

**Installation (if wink-nlp needed):**
```bash
cd mcp-server
npm install wink-nlp wink-eng-lite-web-model
```

**Recommendation:** Start with basic keyword matching using existing fit-scorer patterns. Add wink-nlp only if basic matching proves insufficient.

## Architecture Patterns

### Recommended Project Structure
```
mcp-server/
├── data/
│   ├── jobs.json                      # Existing - job data with enhanced contacts
│   └── profile/master-profile.json    # Existing - skills for matching
├── src/
│   ├── services/
│   │   ├── fit-scorer.js              # Existing - extend for gap analysis
│   │   ├── resume-matcher.js          # NEW: Resume-JD matching with gap detection
│   │   └── followup-engine.js         # NEW: Calculate reminders, suggest actions
│   └── tools/
│       ├── updates.js                 # EXTEND: Enhanced contact management
│       ├── matching.js                # NEW: MCP tools for resume-JD matching
│       └── followup.js                # NEW: MCP tools for reminders/suggestions
schemas/
├── job.schema.js                      # EXTEND: Enhanced ConnectionSchema
└── contact.schema.js                  # NEW: Detailed contact validation
```

### Pattern 1: Resume-JD Matching (APPL-01, APPL-02)
**What:** Compare profile skills against job description keywords to produce match score and gap analysis
**When to use:** Before applying, when reviewing a job for fit
**Example:**
```javascript
// Source: Existing fit-scorer.js patterns + profile.schema.js skill structure
import { loadProfile } from '../data/profile-loader.js'

/**
 * Extract keywords from job description
 * Uses simple tokenization + stopword removal
 */
export function extractJobKeywords(description) {
  if (!description) return { skills: [], tools: [], other: [] }

  // Normalize text
  const text = description.toLowerCase()

  // Common tech/skill patterns to extract
  const skillPatterns = [
    // Tools and technologies
    /\b(figma|sketch|adobe\s*(xd|photoshop|illustrator)|invision)\b/gi,
    /\b(react|angular|vue|node\.?js|typescript|javascript)\b/gi,
    /\b(python|java|sql|html|css|sass|less)\b/gi,
    // Methodologies
    /\b(agile|scrum|kanban|lean|design\s*thinking)\b/gi,
    // Soft skills - extract contextually
    /\b(leadership|management|collaboration|communication)\b/gi,
    // Domain keywords
    /\b(ux|ui|brand|creative|visual|product\s*design)\b/gi
  ]

  const skills = []
  for (const pattern of skillPatterns) {
    const matches = text.match(pattern) || []
    skills.push(...matches.map(m => m.toLowerCase()))
  }

  return {
    skills: [...new Set(skills)],  // Deduplicate
    rawText: text
  }
}

/**
 * Match profile skills against job requirements
 * Returns score (0-100) and specific gaps
 */
export function matchResumeToJob(profile, jobDescription) {
  const jobKeywords = extractJobKeywords(jobDescription)
  const profileSkills = (profile.skills || []).map(s => s.name.toLowerCase())
  const profileExperience = extractExperienceKeywords(profile.experience)

  const allProfileKeywords = new Set([...profileSkills, ...profileExperience])

  // Calculate matches
  const matched = []
  const missing = []

  for (const keyword of jobKeywords.skills) {
    if (allProfileKeywords.has(keyword)) {
      matched.push(keyword)
    } else {
      // Check partial matches
      const partialMatch = [...allProfileKeywords].find(pk =>
        pk.includes(keyword) || keyword.includes(pk)
      )
      if (partialMatch) {
        matched.push({ keyword, via: partialMatch })
      } else {
        missing.push(keyword)
      }
    }
  }

  const totalKeywords = jobKeywords.skills.length
  const matchCount = matched.length
  const score = totalKeywords > 0
    ? Math.round((matchCount / totalKeywords) * 100)
    : 50  // No keywords extracted = neutral score

  return {
    score,
    matched,
    missing,  // These are the gaps (APPL-02)
    suggestions: missing.map(m => ({
      keyword: m,
      suggestion: `Consider adding "${m}" to your resume if you have this skill`
    })),
    totalJobKeywords: totalKeywords,
    confidence: totalKeywords >= 5 ? 'high' : totalKeywords >= 2 ? 'medium' : 'low'
  }
}

function extractExperienceKeywords(experience) {
  const keywords = []
  for (const exp of experience || []) {
    for (const project of exp.projects || []) {
      // Extract from tags and description
      keywords.push(...(project.tags || []))
      // Simple extraction from description
      const words = (project.description || '').toLowerCase().split(/\s+/)
      keywords.push(...words.filter(w => w.length > 3))
    }
  }
  return keywords.map(k => k.toLowerCase())
}
```

### Pattern 2: Enhanced Contact Tracking (APPL-03, APPL-04)
**What:** Store recruiter, hiring manager, and other contacts per job with structured metadata
**When to use:** When adding contacts, tracking outreach
**Example:**
```javascript
// Source: Existing ConnectionSchema + APPL-03/04 requirements
import { z } from 'zod'

// Enhanced connection schema for Phase 6
export const EnhancedConnectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  role: z.enum(['recruiter', 'hiring_manager', 'referral', 'internal_contact', 'other']),
  title: z.string().optional(),          // "Senior Technical Recruiter"
  company: z.string().optional(),         // For external recruiters
  linkedInUrl: z.string().url().optional(), // APPL-04
  email: z.string().email().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  // Tracking fields
  isPrimary: z.boolean().default(false),
  reachedOut: z.boolean().default(false),
  // Interaction history (APPL-04: last interaction)
  lastInteraction: z.object({
    date: z.string(),       // ISO date
    type: z.enum(['email', 'linkedin', 'call', 'meeting', 'other']),
    notes: z.string().optional()
  }).optional(),
  interactions: z.array(z.object({
    date: z.string(),
    type: z.string(),
    notes: z.string().optional()
  })).default([]),
  createdAt: z.string(),
  updatedAt: z.string()
})

// Backward compatibility: still accept legacy string format
export const ConnectionSchema = z.union([
  z.string(),  // Legacy: "Name (notes)"
  EnhancedConnectionSchema
])

/**
 * Add or update a contact for a job
 */
export function addContact(jobId, contact) {
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job ${jobId} not found` }
  }

  // Initialize connections if needed
  if (!job.connections) {
    job.connections = []
  }

  // Check for duplicate (by name or LinkedIn URL)
  const existing = job.connections.find(c =>
    (typeof c === 'object' && c.name === contact.name) ||
    (typeof c === 'object' && c.linkedInUrl && c.linkedInUrl === contact.linkedInUrl)
  )

  if (existing && typeof existing === 'object') {
    // Update existing contact
    Object.assign(existing, {
      ...contact,
      updatedAt: new Date().toISOString()
    })

    writeJobsData(data)
    return { success: true, updated: true, contact: existing }
  }

  // Add new contact
  const newContact = {
    id: uuidv4(),
    ...contact,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  job.connections.push(newContact)

  // Add update entry to job history
  job.updates = job.updates || []
  job.updates.push({
    date: new Date().toISOString().split('T')[0],
    type: 'Contact Added',
    notes: `${contact.name} (${contact.role})`
  })

  writeJobsData(data)

  return { success: true, contact: newContact }
}

/**
 * Log an interaction with a contact
 */
export function logContactInteraction(jobId, contactId, interaction) {
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) return { error: `Job ${jobId} not found` }

  const contact = job.connections?.find(c =>
    typeof c === 'object' && c.id === contactId
  )

  if (!contact) return { error: `Contact ${contactId} not found` }

  const interactionEntry = {
    date: new Date().toISOString(),
    type: interaction.type,
    notes: interaction.notes
  }

  // Add to interactions array
  contact.interactions = contact.interactions || []
  contact.interactions.push(interactionEntry)

  // Update last interaction
  contact.lastInteraction = interactionEntry
  contact.reachedOut = true
  contact.updatedAt = new Date().toISOString()

  writeJobsData(data)

  return { success: true, contact, interaction: interactionEntry }
}
```

### Pattern 3: Follow-up Engine (APPL-05, APPL-06)
**What:** Calculate follow-up timing based on days elapsed and stage, generate smart suggestions
**When to use:** Dashboard review, daily check-ins, MCP queries
**Example:**
```javascript
// Source: Existing date handling patterns + APPL-05/06 requirements
import { differenceInDays, parseISO } from 'date-fns'

// Follow-up rules by status and days elapsed
const FOLLOWUP_RULES = {
  'applied': [
    { minDays: 7, maxDays: 14, priority: 'low', suggestion: 'Consider a brief check-in if you have a contact' },
    { minDays: 14, maxDays: 21, priority: 'medium', suggestion: 'Good time to follow up - reference your application date' },
    { minDays: 21, maxDays: null, priority: 'high', suggestion: 'Follow up now - restate interest and key qualifications' }
  ],
  'inbox': [
    { minDays: 3, maxDays: 7, priority: 'low', suggestion: 'Review and decide - apply or archive' },
    { minDays: 7, maxDays: null, priority: 'medium', suggestion: 'Job may become stale - decide soon' }
  ],
  'apply-now': [
    { minDays: 2, maxDays: 5, priority: 'medium', suggestion: 'Apply soon - this was marked high priority' },
    { minDays: 5, maxDays: null, priority: 'high', suggestion: 'Apply immediately or reconsider priority' }
  ],
  'maybe': [
    { minDays: 7, maxDays: 14, priority: 'low', suggestion: 'Review again - still interested?' },
    { minDays: 14, maxDays: null, priority: 'medium', suggestion: 'Decide: apply or archive' }
  ]
}

// Interview-specific follow-up rules
const INTERVIEW_FOLLOWUP = {
  'after_interview': {
    days: 1,
    suggestion: 'Send thank-you email within 24 hours'
  },
  'awaiting_decision': {
    minDays: 5,
    maxDays: 7,
    suggestion: 'Follow up on decision timeline if not heard back'
  }
}

/**
 * Calculate follow-up status for a job
 * APPL-05: Trigger based on days elapsed and stage
 */
export function calculateFollowupStatus(job) {
  const now = new Date()

  // Determine reference date based on status
  let referenceDate = null
  let referenceEvent = null

  if (job.status === 'applied' && job.applied) {
    referenceDate = parseISO(job.applied)
    referenceEvent = 'application'
  } else if (job.found) {
    referenceDate = parseISO(job.found)
    referenceEvent = 'found'
  }

  if (!referenceDate) {
    return { needsFollowup: false, reason: 'No reference date available' }
  }

  const daysElapsed = differenceInDays(now, referenceDate)

  // Check for recent interview in updates
  const recentInterview = job.updates?.find(u =>
    u.type?.toLowerCase().includes('interview') &&
    differenceInDays(now, parseISO(u.timestamp || u.date)) <= 2
  )

  if (recentInterview) {
    const daysSinceInterview = differenceInDays(
      now,
      parseISO(recentInterview.timestamp || recentInterview.date)
    )

    if (daysSinceInterview === 0 || daysSinceInterview === 1) {
      return {
        needsFollowup: true,
        priority: 'high',
        daysElapsed: daysSinceInterview,
        referenceEvent: 'interview',
        suggestion: INTERVIEW_FOLLOWUP.after_interview.suggestion
      }
    }
  }

  // Check rules for current status
  const rules = FOLLOWUP_RULES[job.status] || []

  for (const rule of rules) {
    const meetsMin = daysElapsed >= rule.minDays
    const meetsMax = rule.maxDays === null || daysElapsed <= rule.maxDays

    if (meetsMin && meetsMax) {
      return {
        needsFollowup: true,
        priority: rule.priority,
        daysElapsed,
        referenceEvent,
        referenceDate: referenceDate.toISOString().split('T')[0],
        suggestion: rule.suggestion
      }
    }
  }

  return {
    needsFollowup: false,
    daysElapsed,
    referenceEvent,
    reason: 'No follow-up needed yet'
  }
}

/**
 * Generate smart follow-up suggestion based on context
 * APPL-06: Suggestions adapt based on time and stage
 */
export function generateFollowupSuggestion(job, followupStatus) {
  const suggestions = []

  // Base suggestion from rules
  if (followupStatus.suggestion) {
    suggestions.push({
      type: 'action',
      text: followupStatus.suggestion,
      priority: followupStatus.priority
    })
  }

  // Contact-specific suggestions
  const contacts = (job.connections || []).filter(c => typeof c === 'object')
  const primaryContact = contacts.find(c => c.isPrimary)
  const uncontactedPrimary = contacts.find(c => c.isPrimary && !c.reachedOut)

  if (uncontactedPrimary) {
    suggestions.push({
      type: 'contact',
      text: `Reach out to ${uncontactedPrimary.name} (${uncontactedPrimary.role})`,
      priority: 'high',
      contactId: uncontactedPrimary.id
    })
  }

  // Connection suggestions for applied jobs
  if (job.status === 'applied' && contacts.length === 0) {
    suggestions.push({
      type: 'research',
      text: 'Find a recruiter or hiring manager to follow up with',
      priority: 'medium'
    })
  }

  // Check if any contacts haven't been contacted in a while
  const staleContacts = contacts.filter(c => {
    if (!c.lastInteraction) return false
    const daysSince = differenceInDays(new Date(), parseISO(c.lastInteraction.date))
    return daysSince > 14 && c.reachedOut
  })

  if (staleContacts.length > 0) {
    suggestions.push({
      type: 'reconnect',
      text: `Re-engage with ${staleContacts[0].name} - last contact ${differenceInDays(new Date(), parseISO(staleContacts[0].lastInteraction.date))} days ago`,
      priority: 'low'
    })
  }

  return suggestions
}

/**
 * Get all jobs needing follow-up, sorted by priority
 */
export function getFollowupQueue() {
  const data = loadJobsFromDashboard()
  const queue = []

  for (const job of data.jobs || []) {
    // Skip archived
    if (job.status === 'archived') continue

    const followupStatus = calculateFollowupStatus(job)

    if (followupStatus.needsFollowup) {
      const suggestions = generateFollowupSuggestion(job, followupStatus)

      queue.push({
        jobId: job.id,
        title: job.title,
        company: job.company,
        status: job.status,
        ...followupStatus,
        suggestions
      })
    }
  }

  // Sort by priority (high > medium > low), then by days elapsed
  const priorityOrder = { high: 0, medium: 1, low: 2 }

  return queue.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    return b.daysElapsed - a.daysElapsed  // More days = higher in queue
  })
}
```

### Pattern 4: Job Update/Note Management (APPL-07)
**What:** User can add notes, connections, and status updates to any job entry
**When to use:** Tracking progress, recording interactions
**Example:**
```javascript
// Source: Existing updates.js patterns + APPL-07 requirements
// This extends the existing addJobNote function

/**
 * Add comprehensive update to a job
 * Combines note, connection, and status tracking
 */
export function addJobUpdate(jobId, update) {
  const data = readJobsData()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job ${jobId} not found` }
  }

  const changes = []

  // Add note if provided
  if (update.note) {
    if (!job.updates) job.updates = []

    job.updates.push({
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      type: update.type || 'Note',
      notes: update.note
    })
    changes.push('note added')
  }

  // Add connection if provided
  if (update.connection) {
    const contactResult = addContact(jobId, update.connection)
    if (contactResult.success) {
      changes.push(`contact added: ${update.connection.name}`)
    }
  }

  // Update status if provided
  if (update.status && job.status !== update.status) {
    const transitionResult = validateStatusTransition(job.status, update.status)
    if (transitionResult.valid) {
      const previousStatus = job.status
      job.status = update.status

      // Set applied date if transitioning to applied
      if (update.status === 'applied' && !job.applied) {
        job.applied = new Date().toISOString().split('T')[0]
      }

      if (!job.updates) job.updates = []
      job.updates.push({
        date: new Date().toISOString().split('T')[0],
        type: 'Status Change',
        notes: `${previousStatus} -> ${update.status}`
      })

      changes.push(`status: ${previousStatus} -> ${update.status}`)
    } else {
      return { error: transitionResult.error }
    }
  }

  // Append to notes field if provided
  if (update.appendToNotes) {
    const timestamp = new Date().toISOString().split('T')[0]
    const separator = job.notes ? '\n\n' : ''
    job.notes = `${job.notes || ''}${separator}[${timestamp}] ${update.appendToNotes}`
    changes.push('notes appended')
  }

  writeJobsData(data)

  return {
    success: true,
    jobId,
    changes,
    job
  }
}

/**
 * Get job with full context for updates
 */
export function getJobContext(jobId) {
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job ${jobId} not found` }
  }

  // Calculate follow-up status
  const followupStatus = calculateFollowupStatus(job)
  const suggestions = generateFollowupSuggestion(job, followupStatus)

  // Enrich contacts with structured data
  const contacts = (job.connections || []).map(c => {
    if (typeof c === 'string') {
      return { legacy: true, value: c }
    }
    return c
  })

  return {
    ...job,
    enriched: {
      daysSinceFound: job.found ? differenceInDays(new Date(), parseISO(job.found)) : null,
      daysSinceApplied: job.applied ? differenceInDays(new Date(), parseISO(job.applied)) : null,
      followup: followupStatus,
      suggestions,
      contactCount: contacts.filter(c => !c.legacy).length,
      hasUncontactedPrimary: contacts.some(c => c.isPrimary && !c.reachedOut)
    }
  }
}
```

### Anti-Patterns to Avoid
- **Over-engineering keyword matching:** Don't build ML-based semantic matching; simple keyword extraction is sufficient for single-user
- **Storing reminder dates:** Calculate follow-ups dynamically; don't duplicate date data
- **Ignoring legacy connections:** Many jobs have string-format connections; maintain backward compatibility
- **Auto-sending follow-ups:** User controls all outreach; system only suggests
- **Breaking existing job structure:** Extend job schema minimally; don't migrate all existing data
- **External API calls for matching:** Keep matching local for speed and privacy

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date calculations | Custom day-counting | date-fns differenceInDays | Already installed, handles edge cases |
| Schema validation | Manual type checks | Zod schemas | Already used throughout, consistent patterns |
| Atomic writes | Manual temp/rename | Existing atomicWriteSync | Already in loader.js |
| UUID generation | Custom ID patterns | uuid package | Already installed for profile |
| Status transitions | Custom validation | Existing validateStatusTransition | Already handles allowed paths |
| Job loading | New data access | Existing loadJobsFromDashboard | Already handles validation |

**Key insight:** Phase 6 extends existing patterns rather than introducing new infrastructure. The main additions are the matching service and follow-up engine, both using already-installed dependencies.

## Common Pitfalls

### Pitfall 1: Over-Complex Keyword Extraction
**What goes wrong:** Building NLP pipeline when simple patterns suffice
**Why it happens:** Research shows ML models perform better (they do, at scale)
**How to avoid:** Single-user system doesn't need 95% vs 90% accuracy; start simple
**Warning signs:** Adding TensorFlow, BERT, or external APIs
```javascript
// Bad: Complex NLP pipeline
import * as tf from '@tensorflow/tfjs'
import { pipeline } from '@xenova/transformers'
const extractor = await pipeline('feature-extraction', 'bert-base-uncased')

// Good: Simple pattern matching
const keywords = description.match(/\b(figma|react|leadership|agile)\b/gi)
```

### Pitfall 2: Breaking Legacy Connection Format
**What goes wrong:** New contact structure breaks existing job data
**Why it happens:** Forgetting to handle string-format connections
**How to avoid:** Schema supports union of string | object; code handles both
**Warning signs:** "Cannot read property 'name' of undefined" errors
```javascript
// Good: Handle both formats
const contacts = job.connections?.map(c => {
  if (typeof c === 'string') {
    // Parse legacy format: "Name (notes)"
    const match = c.match(/^([^(]+)(?:\((.+)\))?$/)
    return { name: match?.[1]?.trim() || c, notes: match?.[2], legacy: true }
  }
  return c
})
```

### Pitfall 3: Storing Reminder Dates
**What goes wrong:** Reminder dates get stale, need constant maintenance
**Why it happens:** Seems simpler to store "remind on 2026-02-10"
**How to avoid:** Calculate from existing dates (found, applied, last interaction)
**Warning signs:** followup field always null or outdated
```javascript
// Bad: Store reminder date
job.reminderDate = '2026-02-10'

// Good: Calculate dynamically
const daysSinceApplied = differenceInDays(new Date(), parseISO(job.applied))
const needsFollowup = daysSinceApplied >= 14
```

### Pitfall 4: Matching Against Raw Description
**What goes wrong:** Low match scores because of formatting differences
**Why it happens:** Job descriptions have bullets, HTML entities, inconsistent casing
**How to avoid:** Normalize text before matching (lowercase, remove bullets, etc.)
**Warning signs:** Skills in both profile and JD but not matching
```javascript
// Good: Normalize before matching
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[•\-\*]/g, ' ')        // Remove bullets
    .replace(/&[^;]+;/g, ' ')        // Remove HTML entities
    .replace(/\s+/g, ' ')            // Collapse whitespace
    .trim()
}
```

### Pitfall 5: Priority Queue Without Limits
**What goes wrong:** Follow-up queue returns 100+ items, overwhelming
**Why it happens:** Every old job needs "follow-up"
**How to avoid:** Limit to top 10, exclude archived/probably-not
**Warning signs:** Queue dominated by old "maybe" jobs
```javascript
// Good: Filter and limit
export function getFollowupQueue(options = { limit: 10 }) {
  const jobs = data.jobs.filter(j =>
    !['archived', 'probably-not'].includes(j.status)
  )
  // ... calculate and sort ...
  return queue.slice(0, options.limit)
}
```

### Pitfall 6: Missing Contact Deduplication
**What goes wrong:** Same person added multiple times to job
**Why it happens:** No check for existing contact by name or LinkedIn
**How to avoid:** Check before adding; update if exists
**Warning signs:** 3 entries for "Sarah Smith" with slight variations
```javascript
// Good: Check for duplicates
const existing = job.connections.find(c =>
  (typeof c === 'object' && c.name?.toLowerCase() === contact.name.toLowerCase()) ||
  (typeof c === 'object' && c.linkedInUrl && c.linkedInUrl === contact.linkedInUrl)
)
if (existing) {
  return updateContact(jobId, existing.id, contact)
}
```

## Code Examples

Verified patterns from existing codebase:

### MCP Tool: Get Resume Match Score
```javascript
// File: mcp-server/src/tools/matching.js (new file)

import { loadProfile } from '../data/profile-loader.js'
import { loadJobsFromDashboard } from '../data/loader.js'
import { matchResumeToJob } from '../services/resume-matcher.js'

/**
 * Get resume-JD match score for a job
 * APPL-01: Match score shows before applying
 * APPL-02: Identifies gaps and keywords to add
 */
export function getResumeMatch({ jobId, jobDescription }) {
  // Load profile for matching
  let profile
  try {
    profile = loadProfile()
  } catch (e) {
    return { error: 'Failed to load profile', details: e.message }
  }

  // Get job description from job if not provided
  let description = jobDescription
  if (!description && jobId) {
    const data = loadJobsFromDashboard()
    const job = data.jobs.find(j => j.id === jobId)
    if (!job) {
      return { error: `Job ${jobId} not found` }
    }
    description = job.notes || job.description || ''
  }

  if (!description) {
    return {
      error: 'No job description available',
      suggestion: 'Provide job description text or ensure job has notes/description'
    }
  }

  const match = matchResumeToJob(profile, description)

  return {
    score: match.score,
    confidence: match.confidence,
    matched: match.matched,
    gaps: match.missing,  // APPL-02
    suggestions: match.suggestions,
    summary: `${match.score}% match - ${match.matched.length} skills matched, ${match.missing.length} gaps identified`
  }
}

/**
 * Get match scores for all active jobs
 */
export function getMatchScoresForActiveJobs() {
  const profile = loadProfile()
  const data = loadJobsFromDashboard()

  const activeJobs = data.jobs.filter(j =>
    ['apply-now', 'maybe', 'inbox'].includes(j.status)
  )

  return activeJobs.map(job => {
    const description = job.notes || job.description || ''
    const match = description
      ? matchResumeToJob(profile, description)
      : { score: null, confidence: 'no-data' }

    return {
      jobId: job.id,
      title: job.title,
      company: job.company,
      fitScore: job.fitScore,
      resumeMatch: match.score,
      topGaps: (match.missing || []).slice(0, 3)
    }
  }).sort((a, b) => (b.resumeMatch || 0) - (a.resumeMatch || 0))
}
```

### MCP Tool: Manage Contacts
```javascript
// File: mcp-server/src/tools/updates.js (extend existing)

import { v4 as uuidv4 } from 'uuid'

/**
 * Add a contact to a job
 * APPL-03: Contact tracking per job
 * APPL-04: Includes name, title, LinkedIn URL, last interaction
 */
export function addJobContact(jobId, contactData) {
  const data = readJobsData()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job ${jobId} not found` }
  }

  // Validate required fields
  if (!contactData.name) {
    return { error: 'Contact name is required' }
  }

  // Initialize connections array
  if (!job.connections) {
    job.connections = []
  }

  // Check for duplicate
  const existingIndex = job.connections.findIndex(c => {
    if (typeof c === 'string') return false
    return c.name?.toLowerCase() === contactData.name.toLowerCase() ||
           (c.linkedInUrl && c.linkedInUrl === contactData.linkedInUrl)
  })

  const now = new Date().toISOString()

  if (existingIndex !== -1) {
    // Update existing
    const existing = job.connections[existingIndex]
    job.connections[existingIndex] = {
      ...existing,
      ...contactData,
      updatedAt: now
    }

    writeJobsData(data)
    return { success: true, action: 'updated', contact: job.connections[existingIndex] }
  }

  // Add new contact
  const newContact = {
    id: uuidv4(),
    name: contactData.name,
    role: contactData.role || 'other',
    title: contactData.title || '',
    linkedInUrl: contactData.linkedInUrl || '',
    email: contactData.email || '',
    notes: contactData.notes || '',
    isPrimary: contactData.isPrimary || false,
    reachedOut: false,
    interactions: [],
    createdAt: now,
    updatedAt: now
  }

  job.connections.push(newContact)

  // Add to job updates history
  if (!job.updates) job.updates = []
  job.updates.push({
    date: now.split('T')[0],
    type: 'Contact Added',
    notes: `${newContact.name}${newContact.role !== 'other' ? ` (${newContact.role})` : ''}`
  })

  writeJobsData(data)

  return { success: true, action: 'added', contact: newContact }
}

/**
 * Log an interaction with a contact
 */
export function logContactInteraction(jobId, contactId, interactionData) {
  const data = readJobsData()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) return { error: `Job ${jobId} not found` }

  const contact = job.connections?.find(c =>
    typeof c === 'object' && c.id === contactId
  )

  if (!contact) return { error: `Contact ${contactId} not found` }

  const now = new Date().toISOString()

  const interaction = {
    date: now,
    type: interactionData.type || 'other',  // email, linkedin, call, meeting
    notes: interactionData.notes || ''
  }

  // Add to interactions array
  if (!contact.interactions) contact.interactions = []
  contact.interactions.push(interaction)

  // Update last interaction and reached out flag
  contact.lastInteraction = interaction
  contact.reachedOut = true
  contact.updatedAt = now

  writeJobsData(data)

  return { success: true, contact, interaction }
}

/**
 * Get all contacts for a job
 */
export function getJobContacts(jobId) {
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) return { error: `Job ${jobId} not found` }

  const contacts = (job.connections || []).map((c, index) => {
    if (typeof c === 'string') {
      // Parse legacy format
      const match = c.match(/^([^(]+)(?:\((.+)\))?$/)
      return {
        index,
        legacy: true,
        name: match?.[1]?.trim() || c,
        notes: match?.[2] || '',
        suggestion: 'Convert to structured format for full tracking'
      }
    }
    return { ...c, legacy: false }
  })

  return {
    jobId,
    title: job.title,
    company: job.company,
    totalContacts: contacts.length,
    structuredContacts: contacts.filter(c => !c.legacy),
    legacyContacts: contacts.filter(c => c.legacy),
    hasUncontacted: contacts.some(c => !c.legacy && !c.reachedOut)
  }
}
```

### MCP Tool: Follow-up Queue
```javascript
// File: mcp-server/src/tools/followup.js (new file)

import { getFollowupQueue, calculateFollowupStatus, generateFollowupSuggestion } from '../services/followup-engine.js'
import { loadJobsFromDashboard } from '../data/loader.js'

/**
 * Get prioritized follow-up queue
 * APPL-05: Reminders trigger based on days elapsed and stage
 */
export function getFollowups({ limit = 10 } = {}) {
  const queue = getFollowupQueue()

  return {
    count: queue.length,
    showing: Math.min(queue.length, limit),
    followups: queue.slice(0, limit).map(item => ({
      jobId: item.jobId,
      title: item.title,
      company: item.company,
      status: item.status,
      priority: item.priority,
      daysElapsed: item.daysElapsed,
      referenceEvent: item.referenceEvent,
      primarySuggestion: item.suggestions[0]?.text || item.suggestion,
      allSuggestions: item.suggestions
    }))
  }
}

/**
 * Get follow-up status for a specific job
 * APPL-06: Smart suggestions based on time and stage
 */
export function getJobFollowupStatus(jobId) {
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) return { error: `Job ${jobId} not found` }

  const status = calculateFollowupStatus(job)
  const suggestions = generateFollowupSuggestion(job, status)

  return {
    jobId,
    title: job.title,
    company: job.company,
    currentStatus: job.status,
    followup: {
      ...status,
      suggestions
    },
    contacts: (job.connections || []).filter(c => typeof c === 'object').map(c => ({
      name: c.name,
      role: c.role,
      reachedOut: c.reachedOut,
      lastInteraction: c.lastInteraction?.date
    }))
  }
}

/**
 * Get summary of all follow-up needs
 */
export function getFollowupSummary() {
  const queue = getFollowupQueue()

  const byPriority = {
    high: queue.filter(q => q.priority === 'high').length,
    medium: queue.filter(q => q.priority === 'medium').length,
    low: queue.filter(q => q.priority === 'low').length
  }

  const byStatus = {}
  for (const item of queue) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1
  }

  const topPriority = queue.slice(0, 3)

  return {
    totalNeedingFollowup: queue.length,
    byPriority,
    byStatus,
    topActions: topPriority.map(item => ({
      job: `${item.title} at ${item.company}`,
      action: item.suggestions[0]?.text || item.suggestion,
      priority: item.priority
    })),
    summary: byPriority.high > 0
      ? `${byPriority.high} high priority follow-ups needed`
      : byPriority.medium > 0
        ? `${byPriority.medium} medium priority items`
        : 'No urgent follow-ups'
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual keyword comparison | Automated resume-JD matching | Phase 6 | Pre-apply gap analysis |
| String-format connections | Structured contact objects | Phase 6 | LinkedIn URLs, interaction tracking |
| Manual follow-up tracking | Automatic reminder queue | Phase 6 | Time-aware suggestions |
| Notes only for job updates | Structured update entries | Phase 6 | Richer history, better querying |

**Deprecated/outdated:**
- Legacy string connections: Still supported for backward compatibility, but new contacts should use structured format
- Static fit scores: Now complemented by resume-specific match scores

## Open Questions

Things that couldn't be fully resolved:

1. **Keyword Extraction Accuracy**
   - What we know: Simple pattern matching works for common skills
   - What's unclear: How well it handles niche/industry-specific terms
   - Recommendation: Start simple, add wink-nlp if gaps appear in testing

2. **Follow-up Timing Thresholds**
   - What we know: 7/14/21 day thresholds are common wisdom
   - What's unclear: May need user-specific adjustments
   - Recommendation: Make thresholds configurable in future, start with defaults

3. **Contact Data Migration**
   - What we know: Many jobs have legacy string connections
   - What's unclear: Should we auto-migrate or leave as-is?
   - Recommendation: Don't auto-migrate; convert on access, new additions use structured format

4. **Match Score vs Fit Score**
   - What we know: Both provide value (fit = preferences, match = skills)
   - What's unclear: How to present both to user
   - Recommendation: Show both; fit score for discovery, match score for application prep

## Sources

### Primary (HIGH confidence)
- Existing codebase: `schemas/job.schema.js` - ConnectionSchema, UpdateSchema patterns
- Existing codebase: `mcp-server/src/services/fit-scorer.js` - Keyword matching patterns
- Existing codebase: `mcp-server/src/tools/updates.js` - Job update patterns
- Existing codebase: `schemas/profile.schema.js` - SkillSchema structure
- Requirements APPL-01 through APPL-07 - Feature specifications

### Secondary (MEDIUM confidence)
- [winkNLP Documentation](https://winkjs.org/wink-nlp/) - NLP library patterns
- [string-similarity npm](https://www.npmjs.com/package/string-similarity) - Simple similarity metrics
- [date-fns Documentation](https://date-fns.org/) - Date calculation patterns

### Tertiary (LOW confidence)
- WebSearch results on resume-JD matching algorithms - General NLP approaches
- WebSearch results on follow-up timing best practices - Industry conventions

## Metadata

**Confidence breakdown:**
- Resume matching: MEDIUM - Simple approach, may need iteration
- Contact tracking: HIGH - Clear extension of existing schema
- Follow-up engine: HIGH - Straightforward date calculations
- MCP tools: HIGH - Follows established patterns

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable domain, extends existing patterns)
