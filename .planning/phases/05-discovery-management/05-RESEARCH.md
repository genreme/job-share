# Phase 5: Discovery Management - Research

**Researched:** 2026-02-01
**Domain:** Friend Submissions, PDF Archiving, Job Staleness Detection, Configurable Fit Criteria, Job Board Registry
**Confidence:** HIGH

## Summary

Phase 5 extends the Discovery Core (Phase 4) with advanced management capabilities: friend job submissions with context preservation, PDF archiving for pattern analysis, periodic staleness detection, configurable fit criteria that evolve with outcomes, and a job board quality registry. This phase builds entirely on existing infrastructure: Supabase integration already handles friend submissions in the dashboard UI, Cloudflare Worker already validates job URLs, and the fit scoring system is in place.

The primary work focuses on: (1) Extending the MCP tool layer to process friend submissions from Supabase with their context preserved, (2) Adding PDF generation for archiving job descriptions, (3) Implementing periodic verification using the existing Worker `/status` endpoint, (4) Making fit criteria configurable and persisting outcome feedback, and (5) Creating a job board registry that tracks quality metrics over time.

**Primary recommendation:** Leverage existing Supabase integration (already in index.html), Cloudflare Worker status endpoint, and fit-scorer.js patterns. Add MCP tools to orchestrate these capabilities programmatically.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed - No New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.x | Friend submissions database | Already integrated in index.html |
| Cloudflare Worker | - | URL validation, status checking | Existing `/status` endpoint |
| Zod | ^3.x | Schema validation | Already used throughout |
| date-fns | ^4.x | Date calculations for staleness | Already installed |

### Supporting (May Need Adding)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| puppeteer | ^22.x | PDF generation from HTML | For DISC-08 job description archiving |
| @supabase/supabase-js | ^2.x | Server-side Supabase access | For MCP tools to access friend submissions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Puppeteer | pdfmake | pdfmake is lighter but needs layout code; Puppeteer renders actual HTML |
| Puppeteer | jsPDF | jsPDF is browser-only; server needs Puppeteer |
| Server Supabase SDK | Direct REST | SDK provides better auth, types, realtime |

**Installation:**
```bash
cd mcp-server
npm install @supabase/supabase-js puppeteer
```

## Architecture Patterns

### Recommended Project Structure
```
mcp-server/
├── data/
│   ├── jobs.json                    # Existing - job data
│   ├── profile/                     # Existing - profile data
│   ├── fit-config.json              # NEW: Configurable fit criteria
│   └── job-boards.json              # NEW: Board registry with quality ratings
├── data/archives/                   # NEW: PDF archives of job descriptions
│   └── {company}-{job-id}.pdf
├── src/
│   ├── services/
│   │   ├── fit-scorer.js            # EXTEND: Load criteria from config
│   │   ├── staleness-detector.js    # Existing - extend for periodic checks
│   │   ├── pdf-archiver.js          # NEW: Generate PDF from job description
│   │   └── board-registry.js        # NEW: Track board quality metrics
│   └── tools/
│       ├── discovery.js             # EXTEND: Add friend submission processing
│       ├── config.js                # NEW: Fit criteria configuration tools
│       └── boards.js                # NEW: Job board registry tools
schemas/
└── config.schema.js                 # NEW: Fit config, board registry schemas
```

### Pattern 1: Friend Submission Flow (DISC-07)
**What:** Friends submit jobs via Supabase form, context preserved, flows through research process
**When to use:** Processing friend submissions from Supabase into jobs.json
**Example:**
```javascript
// Source: Existing Supabase integration in index.html + DISC-07 requirements
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // Use service key for server-side
)

/**
 * Get pending friend submissions from Supabase
 */
export async function getFriendSubmissions() {
  const { data, error } = await supabase
    .from('job_submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error

  return data.map(sub => ({
    id: sub.id,
    url: sub.url,
    title: sub.title,
    company: sub.company,
    submittedBy: sub.submitted_by,
    submittedAt: sub.created_at,
    // Friend context (DISC-07a, DISC-07b)
    friendContext: {
      name: sub.submitted_by,
      connection: sub.connection_notes,  // How they know you
      benefits: sub.benefits_notes,       // Why they think it's good
      whyTheyThoughtOfYou: sub.reasoning  // Personal recommendation
    },
    fitScore: sub.fit_score
  }))
}

/**
 * Process friend submission through research pipeline
 * Preserves friend context alongside research findings
 */
export async function processFriendSubmission({ submissionId }) {
  const sub = await getFriendSubmissionById(submissionId)
  if (!sub) return { error: 'Submission not found' }

  // Research the job (uses existing research flow)
  const research = await researchJobUrl({ url: sub.url })

  if (research.status === 'error') {
    return { ...research, submissionId, friendContext: sub.friendContext }
  }

  // Combine research with friend context for presentation
  return {
    status: 'ready_for_review',
    job: research.job,
    research: research.research,
    reasoning: research.reasoning,
    // Friend context displayed alongside (DISC-07b)
    friendContext: sub.friendContext,
    submittedBy: sub.submittedBy,
    submittedAt: sub.submittedAt,
    nextStep: 'Call confirm_job to add to dashboard with friend context preserved'
  }
}
```

### Pattern 2: PDF Archiving (DISC-08)
**What:** Archive job descriptions as PDFs for pattern analysis
**When to use:** When job is added to dashboard or periodically for all active jobs
**Example:**
```javascript
// Source: Puppeteer documentation + DISC-08 requirements
import puppeteer from 'puppeteer'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

const ARCHIVE_DIR = join(process.cwd(), 'mcp-server', 'data', 'archives')

/**
 * Generate PDF archive of job description
 * Preserves full job posting for pattern analysis
 */
export async function archiveJobAsPdf(jobUrl, jobData) {
  // Ensure archive directory exists
  if (!existsSync(ARCHIVE_DIR)) {
    mkdirSync(ARCHIVE_DIR, { recursive: true })
  }

  const filename = `${sanitizeFilename(jobData.company)}-${jobData.id}-${Date.now()}.pdf`
  const pdfPath = join(ARCHIVE_DIR, filename)

  let browser
  try {
    browser = await puppeteer.launch({ headless: 'new' })
    const page = await browser.newPage()

    // Try to fetch actual job page
    try {
      await page.goto(jobUrl, { waitUntil: 'networkidle0', timeout: 30000 })
    } catch (e) {
      // If page fetch fails, create archive from stored data
      const html = generateArchiveHtml(jobData)
      await page.setContent(html)
    }

    // Generate PDF
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    })

    return {
      success: true,
      path: pdfPath,
      filename,
      archivedAt: new Date().toISOString()
    }
  } finally {
    if (browser) await browser.close()
  }
}

function generateArchiveHtml(job) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${job.title} at ${job.company}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; }
        h1 { color: #333; margin-bottom: 10px; }
        .meta { color: #666; margin-bottom: 20px; }
        .description { line-height: 1.6; }
        .archived-notice { background: #f0f0f0; padding: 10px; margin-top: 30px; font-size: 12px; }
      </style>
    </head>
    <body>
      <h1>${job.title}</h1>
      <div class="meta">
        <strong>${job.company}</strong> | ${job.location || 'Location not specified'}<br>
        ${job.salary || ''}<br>
        Fit Score: ${job.fitScore}/100
      </div>
      <div class="description">
        ${job.description || job.notes || 'No description archived'}
      </div>
      <div class="archived-notice">
        Archived: ${new Date().toISOString()}<br>
        Original URL: ${job.url}
      </div>
    </body>
    </html>
  `
}

function sanitizeFilename(str) {
  return str.replace(/[^a-zA-Z0-9-_]/g, '-').substring(0, 50)
}
```

### Pattern 3: Periodic Staleness Verification (DISC-09)
**What:** Check job status periodically, refresh fit scores, detect closed positions
**When to use:** Weekly scan of active (non-archived) jobs
**Example:**
```javascript
// Source: Existing Worker /status endpoint + staleness-detector.js patterns
const WORKER_URL = process.env.JOB_VALIDATOR_URL

/**
 * Verify status of active jobs and refresh fit scores
 * DISC-09: Periodic job status verification
 */
export async function verifyActiveJobs() {
  const data = loadJobsFromDashboard()
  const activeJobs = data.jobs.filter(j =>
    !['archived'].includes(j.status) && j.url
  )

  if (activeJobs.length === 0) {
    return { checked: 0, active: 0, closed: 0, updated: 0 }
  }

  // Batch check status via Worker
  const urls = activeJobs.map(j => j.url)
  let statusResults = []

  if (WORKER_URL) {
    try {
      const response = await fetch(`${WORKER_URL}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls })
      })
      statusResults = await response.json()
    } catch (e) {
      console.warn('Worker status check failed:', e.message)
    }
  }

  const results = {
    checked: activeJobs.length,
    active: 0,
    closed: 0,
    uncertain: 0,
    updated: 0,
    details: []
  }

  for (const job of activeJobs) {
    const statusResult = statusResults.find(r => r.url === job.url)

    if (statusResult?.status === 'closed') {
      results.closed++
      results.details.push({
        id: job.id,
        title: job.title,
        company: job.company,
        status: 'closed',
        reason: statusResult.reason || 'Job posting no longer available'
      })
    } else if (statusResult?.status === 'active') {
      results.active++

      // Refresh fit score if job data changed
      if (statusResult.title || statusResult.salary) {
        const newFit = calculateFitScore({
          ...job,
          title: statusResult.title || job.title,
          salary: statusResult.salary || job.salary
        })
        if (newFit.score !== job.fitScore) {
          job.fitScore = newFit.score
          job.fitBreakdown = newFit.breakdown
          job.lastVerified = new Date().toISOString()
          results.updated++
        }
      }
    } else {
      results.uncertain++
      results.details.push({
        id: job.id,
        title: job.title,
        company: job.company,
        status: 'uncertain',
        reason: 'Could not verify status'
      })
    }
  }

  // Save updated jobs
  if (results.updated > 0) {
    writeJobsData(data)
  }

  return results
}
```

### Pattern 4: Configurable Fit Criteria (DISC-10)
**What:** Fit criteria loaded from config file, can be updated based on outcomes
**When to use:** All fit scoring, learning from application outcomes
**Example:**
```javascript
// Source: Existing fit-scorer.js + DISC-10 requirements
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const FIT_CONFIG_PATH = join(process.cwd(), 'mcp-server', 'data', 'fit-config.json')

// Default config (used if file doesn't exist)
const DEFAULT_FIT_CONFIG = {
  version: 1,
  lastUpdated: null,
  criteria: {
    titles: {
      exact: ['Creative Director', 'VP of Creative', 'Design Director'],
      partial: ['Creative', 'Design', 'Brand']
    },
    industries: {
      preferred: ['healthcare', 'nonprofit', 'education'],
      acceptable: ['technology', 'saas']
    },
    locations: {
      preferred: ['boston', 'remote', 'hybrid'],
      acceptable: ['new york', 'northeast']
    },
    salaryMin: 120000
  },
  weights: {
    role: { exact: 25, partial: 15 },
    industry: { preferred: 20, acceptable: 10 },
    location: { preferred: 15, acceptable: 8 },
    salary: 15,
    skills: { perMatch: 2, max: 10 }
  },
  evolutionLog: []  // Track changes over time
}

/**
 * Load fit criteria from config file
 * Falls back to defaults if not configured
 */
export function loadFitConfig() {
  if (!existsSync(FIT_CONFIG_PATH)) {
    return DEFAULT_FIT_CONFIG
  }

  try {
    const content = readFileSync(FIT_CONFIG_PATH, 'utf-8')
    return JSON.parse(content)
  } catch (e) {
    console.warn('Failed to load fit config, using defaults:', e.message)
    return DEFAULT_FIT_CONFIG
  }
}

/**
 * Update fit criteria based on outcome feedback
 * DISC-10: Criteria evolve based on outcomes
 */
export function updateFitCriteria({ feedbackType, jobId, adjustment, reason }) {
  const config = loadFitConfig()

  const entry = {
    timestamp: new Date().toISOString(),
    feedbackType,  // 'interview_success', 'rejection', 'offer', etc.
    jobId,
    adjustment,    // What was changed
    reason         // Why
  }

  config.evolutionLog.push(entry)
  config.lastUpdated = new Date().toISOString()
  config.version++

  // Apply adjustment (example: boost weight for successful patterns)
  if (adjustment.boost) {
    // e.g., { boost: 'industries.preferred', value: 'healthtech' }
    const path = adjustment.boost.split('.')
    if (path[0] === 'industries' && path[1] === 'preferred') {
      if (!config.criteria.industries.preferred.includes(adjustment.value)) {
        config.criteria.industries.preferred.push(adjustment.value)
      }
    }
  }

  saveFitConfig(config)
  return { success: true, config }
}
```

### Pattern 5: Job Board Registry (DISC-11 through DISC-14)
**What:** Track job boards with quality ratings, prioritize high-quality, blacklist low-quality
**When to use:** Discovery scans, adding new boards, quality assessment
**Example:**
```javascript
// Source: DISC-11 through DISC-14 requirements
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const BOARDS_PATH = join(process.cwd(), 'mcp-server', 'data', 'job-boards.json')

const INITIAL_BOARDS = {
  version: 1,
  boards: [
    {
      id: 'lever',
      name: 'Lever',
      urlPattern: 'jobs.lever.co',
      tier: 1,
      qualityRating: 0.85,
      metrics: { found: 0, valid: 0, stale: 0, lastScanned: null },
      status: 'active'
    },
    {
      id: 'greenhouse',
      name: 'Greenhouse',
      urlPattern: 'boards.greenhouse.io',
      tier: 1,
      qualityRating: 0.82,
      metrics: { found: 0, valid: 0, stale: 0, lastScanned: null },
      status: 'active'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      urlPattern: 'linkedin.com/jobs',
      tier: 2,
      qualityRating: 0.65,
      metrics: { found: 0, valid: 0, stale: 0, lastScanned: null },
      status: 'active'
    }
  ],
  blacklist: [],
  pendingReview: []
}

/**
 * Load job board registry
 */
export function loadBoardRegistry() {
  if (!existsSync(BOARDS_PATH)) {
    return INITIAL_BOARDS
  }
  return JSON.parse(readFileSync(BOARDS_PATH, 'utf-8'))
}

/**
 * Get boards prioritized by quality for scanning
 * DISC-13: High-quality boards prioritized
 */
export function getBoardsForScan() {
  const registry = loadBoardRegistry()

  return registry.boards
    .filter(b => b.status === 'active')
    .sort((a, b) => {
      // Sort by tier first, then quality rating
      if (a.tier !== b.tier) return a.tier - b.tier
      return b.qualityRating - a.qualityRating
    })
}

/**
 * Add new board for testing
 * DISC-12: New job boards can be tested and quality-assessed
 */
export function addBoardForTesting({ name, urlPattern }) {
  const registry = loadBoardRegistry()

  const newBoard = {
    id: urlPattern.replace(/[^a-z0-9]/gi, '-').toLowerCase(),
    name,
    urlPattern,
    tier: 3,  // Start in lowest tier
    qualityRating: 0.5,  // Neutral starting rating
    metrics: { found: 0, valid: 0, stale: 0, lastScanned: null },
    status: 'testing'
  }

  registry.boards.push(newBoard)
  registry.pendingReview.push(newBoard.id)

  saveBoardRegistry(registry)
  return newBoard
}

/**
 * Update board quality metrics after scan
 */
export function updateBoardMetrics({ boardId, found, valid, stale }) {
  const registry = loadBoardRegistry()
  const board = registry.boards.find(b => b.id === boardId)

  if (!board) return { error: 'Board not found' }

  // Update metrics
  board.metrics.found += found
  board.metrics.valid += valid
  board.metrics.stale += stale
  board.metrics.lastScanned = new Date().toISOString()

  // Recalculate quality rating
  const totalChecked = board.metrics.valid + board.metrics.stale
  if (totalChecked > 0) {
    board.qualityRating = board.metrics.valid / totalChecked
  }

  // Adjust tier based on quality
  if (board.qualityRating >= 0.8 && board.tier > 1) {
    board.tier = 1  // Promote to tier 1
  } else if (board.qualityRating < 0.5 && board.tier < 3) {
    board.tier = 3  // Demote to tier 3
  }

  saveBoardRegistry(registry)
  return { success: true, board }
}

/**
 * Blacklist a board after user confirmation
 * DISC-14: Low-quality boards can be blacklisted
 */
export function blacklistBoard({ boardId, reason, confirmedByUser }) {
  if (!confirmedByUser) {
    return { error: 'User confirmation required to blacklist board' }
  }

  const registry = loadBoardRegistry()
  const boardIndex = registry.boards.findIndex(b => b.id === boardId)

  if (boardIndex === -1) return { error: 'Board not found' }

  const board = registry.boards[boardIndex]
  board.status = 'blacklisted'
  board.blacklistedAt = new Date().toISOString()
  board.blacklistReason = reason

  registry.blacklist.push({
    id: board.id,
    name: board.name,
    reason,
    blacklistedAt: board.blacklistedAt
  })

  saveBoardRegistry(registry)
  return { success: true, message: `${board.name} has been blacklisted` }
}
```

### Anti-Patterns to Avoid
- **Supabase in browser only:** Don't rely solely on browser-side Supabase; MCP tools need server-side access
- **PDF generation on every action:** Only archive when explicitly requested or at key milestones
- **Ignoring friend context:** Don't strip friend context when importing - it's valuable for decision-making
- **Auto-blacklisting boards:** Always require user confirmation before blacklisting (DISC-14)
- **Hardcoded fit criteria:** Load from config file, not hardcoded (already partially done in Phase 4)
- **Synchronous PDF generation:** PDF generation is slow; consider async with job queue if needed

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Friend submissions storage | Custom database | Supabase (already set up) | Already integrated in dashboard |
| URL status checking | Custom HTTP HEAD logic | Worker `/status` endpoint | Already handles edge cases |
| PDF from HTML | Custom HTML-to-PDF | Puppeteer | Chrome rendering quality |
| Fit scoring logic | New scoring system | Extend fit-scorer.js | Already has profile integration |
| Staleness detection | Custom date logic | staleness-detector.js | Already exists |
| Atomic file writes | Manual temp/rename | Existing atomicWriteSync | Already in loader.js |

**Key insight:** Most Phase 5 features extend existing Phase 4 patterns. The main new additions are PDF generation (Puppeteer), server-side Supabase, and configuration persistence.

## Common Pitfalls

### Pitfall 1: Supabase Auth for Server-Side
**What goes wrong:** Using anon key for MCP server access to Supabase
**Why it happens:** Dashboard uses anon key; copying that pattern
**How to avoid:** Use service role key for server-side, store in environment variable
**Warning signs:** "permission denied" errors, RLS blocking access
```javascript
// Bad: Using anon key
const supabase = createClient(url, 'eyJ..anon_key...')

// Good: Use service role key for server
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // Has bypass RLS access
)
```

### Pitfall 2: Puppeteer Resource Leaks
**What goes wrong:** Browser instances not closed, memory grows over time
**Why it happens:** Error paths don't close browser
**How to avoid:** Use try/finally pattern, always close browser
**Warning signs:** Node process memory growing, "too many open files" errors
```javascript
// Good: Always close browser
let browser
try {
  browser = await puppeteer.launch()
  // ... do work
} finally {
  if (browser) await browser.close()
}
```

### Pitfall 3: Friend Context Lost on Import
**What goes wrong:** Friend's recommendation notes disappear after importing job
**Why it happens:** Only copying basic job fields, not friend context
**How to avoid:** Store friend context in job's notes or dedicated field
**Warning signs:** User asks "why did Sarah recommend this?" - no record
```javascript
// Good: Preserve friend context
const newJob = {
  ...jobData,
  submittedBy: friendSubmission.submittedBy,
  friendContext: friendSubmission.friendContext,
  notes: `Submitted by ${friendSubmission.submittedBy}: "${friendSubmission.friendContext.whyTheyThoughtOfYou}"\n\n${jobData.notes || ''}`
}
```

### Pitfall 4: Over-Archiving to PDF
**What goes wrong:** Creating PDFs for every job action, filling disk
**Why it happens:** Unclear when to archive
**How to avoid:** Archive only on explicit request or when moving to "applied" status
**Warning signs:** Hundreds of PDFs, slow disk, storage costs
```javascript
// Good: Archive at meaningful moments
export async function confirmJobToDashboard({ jobId, status, archivePdf = false }) {
  // Only archive if requested OR if applied
  if (archivePdf || status === 'applied') {
    await archiveJobAsPdf(job.url, job)
  }
}
```

### Pitfall 5: Blocking Status Verification
**What goes wrong:** UI freezes while checking 50+ job statuses
**Why it happens:** Synchronous verification in request handler
**How to avoid:** Use background job or return immediately with "verification started"
**Warning signs:** Request timeouts, unresponsive interface
```javascript
// Good: Return immediately, verify in background
export function startStatusVerification() {
  const verificationId = uuid()

  // Start background verification
  setImmediate(async () => {
    const results = await verifyActiveJobs()
    // Store results for later retrieval
    saveVerificationResults(verificationId, results)
  })

  return { verificationId, message: 'Verification started', checkBack: '30 seconds' }
}
```

### Pitfall 6: Quality Rating Cold Start
**What goes wrong:** New boards have no quality data, can't be prioritized
**Why it happens:** Quality rating requires historical data
**How to avoid:** Start with neutral rating (0.5), require minimum samples before adjusting tier
**Warning signs:** New boards stuck in tier 3, never promoted
```javascript
// Good: Minimum samples before tier adjustment
if (totalChecked >= 10 && board.qualityRating >= 0.8 && board.tier > 1) {
  board.tier = 1  // Only promote after 10+ jobs checked
}
```

## Code Examples

Verified patterns from existing codebase and official sources:

### MCP Tool: Process Friend Submissions
```javascript
// File: mcp-server/src/tools/discovery.js (extend existing)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

/**
 * Get pending friend submissions
 * DISC-07: Friend job submission flows through research process
 */
export async function getFriendSubmissions() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return { error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY' }
  }

  const { data, error } = await supabase
    .from('job_submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    return { error: `Supabase error: ${error.message}` }
  }

  return {
    count: data.length,
    submissions: data.map(sub => ({
      id: sub.id,
      url: sub.url,
      title: sub.title,
      company: sub.company,
      submittedBy: sub.submitted_by,
      submittedAt: sub.created_at,
      friendContext: {
        connection: sub.connection_notes,
        benefits: sub.benefits_notes,
        reasoning: sub.reasoning
      },
      fitScore: sub.fit_score
    }))
  }
}

/**
 * Accept friend submission and add to dashboard
 * DISC-07b: Friend context displayed alongside research findings
 */
export async function acceptFriendSubmission({ submissionId, status }) {
  // Get submission from Supabase
  const { data: sub, error } = await supabase
    .from('job_submissions')
    .select('*')
    .eq('id', submissionId)
    .single()

  if (error || !sub) {
    return { error: 'Submission not found' }
  }

  // Research the job
  const research = await researchJobUrl({ url: sub.url })

  if (research.status === 'duplicate') {
    // Mark as accepted in Supabase but don't add duplicate
    await supabase
      .from('job_submissions')
      .update({ status: 'accepted', reviewed_at: new Date().toISOString() })
      .eq('id', submissionId)

    return { status: 'duplicate', existingJob: research.existingJob }
  }

  // Load jobs data
  const data = loadJobsFromDashboard()

  // Create new job with friend context preserved
  const newJob = {
    id: getNextJobId(data.jobs),
    title: sub.title || research.job?.title || 'Unknown Title',
    company: sub.company || research.job?.company || 'Unknown Company',
    location: sub.location || research.job?.location || '',
    salary: sub.salary || research.job?.salary || '',
    url: sub.url,
    status: status || 'maybe',
    found: new Date().toISOString().split('T')[0],
    fitScore: research.job?.fitScore || sub.fit_score || 50,
    fitBreakdown: research.job?.fitBreakdown || {},
    source: 'friend-submission',
    submittedBy: sub.submitted_by,
    // Preserve friend context (DISC-07b)
    friendContext: {
      submittedBy: sub.submitted_by,
      connection: sub.connection_notes,
      benefits: sub.benefits_notes,
      reasoning: sub.reasoning,
      submittedAt: sub.created_at
    },
    notes: `Submitted by ${sub.submitted_by}${sub.reasoning ? `: "${sub.reasoning}"` : ''}`,
    updates: [{
      date: new Date().toISOString().split('T')[0],
      type: 'Friend Submission',
      notes: `Submitted by ${sub.submitted_by}`
    }]
  }

  data.jobs.push(newJob)
  writeJobsData(data)

  // Update Supabase status
  await supabase
    .from('job_submissions')
    .update({ status: 'accepted', reviewed_at: new Date().toISOString() })
    .eq('id', submissionId)

  return {
    success: true,
    job: newJob,
    friendContext: newJob.friendContext
  }
}
```

### MCP Tool: Archive Job as PDF
```javascript
// File: mcp-server/src/tools/archives.js (new file)

import puppeteer from 'puppeteer'
import { join } from 'path'
import { existsSync, mkdirSync, readdirSync } from 'fs'
import { loadJobsFromDashboard } from '../data/loader.js'

const ARCHIVE_DIR = join(process.cwd(), 'mcp-server', 'data', 'archives')

/**
 * Archive a job description as PDF
 * DISC-08: Job descriptions archived in PDF format for pattern analysis
 */
export async function archiveJobAsPdf({ jobId }) {
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job ${jobId} not found` }
  }

  if (!existsSync(ARCHIVE_DIR)) {
    mkdirSync(ARCHIVE_DIR, { recursive: true })
  }

  const filename = `${sanitize(job.company)}-${job.id}-${Date.now()}.pdf`
  const pdfPath = join(ARCHIVE_DIR, filename)

  let browser
  try {
    browser = await puppeteer.launch({ headless: 'new' })
    const page = await browser.newPage()

    if (job.url) {
      try {
        await page.goto(job.url, { waitUntil: 'networkidle0', timeout: 30000 })
      } catch (e) {
        // Fallback to generated HTML
        await page.setContent(generateArchiveHtml(job))
      }
    } else {
      await page.setContent(generateArchiveHtml(job))
    }

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
    })

    // Update job with archive info
    job.archivedAt = new Date().toISOString()
    job.archivePath = filename
    writeJobsData(data)

    return {
      success: true,
      filename,
      path: pdfPath,
      archivedAt: job.archivedAt
    }
  } catch (e) {
    return { error: `PDF generation failed: ${e.message}` }
  } finally {
    if (browser) await browser.close()
  }
}

/**
 * List archived job PDFs
 */
export function listArchivedJobs() {
  if (!existsSync(ARCHIVE_DIR)) {
    return { archives: [] }
  }

  const files = readdirSync(ARCHIVE_DIR)
    .filter(f => f.endsWith('.pdf'))
    .map(f => ({
      filename: f,
      path: join(ARCHIVE_DIR, f)
    }))

  return { count: files.length, archives: files }
}

function sanitize(str) {
  return (str || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '-').substring(0, 50)
}

function generateArchiveHtml(job) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${job.title} at ${job.company}</title>
<style>body{font-family:system-ui;padding:40px;line-height:1.6}
h1{margin-bottom:10px}.meta{color:#666;margin-bottom:20px}
.section{margin-top:20px}.footer{margin-top:40px;font-size:12px;color:#999}</style>
</head><body>
<h1>${job.title}</h1>
<div class="meta"><strong>${job.company}</strong> | ${job.location || 'Location N/A'}<br>
${job.salary || 'Salary not listed'} | Fit Score: ${job.fitScore}/100</div>
${job.description ? `<div class="section"><h3>Description</h3><p>${job.description}</p></div>` : ''}
${job.notes ? `<div class="section"><h3>Notes</h3><p>${job.notes}</p></div>` : ''}
${job.friendContext ? `<div class="section"><h3>Friend Recommendation</h3>
<p>Submitted by: ${job.friendContext.submittedBy}</p>
<p>${job.friendContext.reasoning || ''}</p></div>` : ''}
<div class="footer">Archived: ${new Date().toISOString()}<br>Original URL: ${job.url || 'N/A'}</div>
</body></html>`
}
```

### MCP Tool: Board Registry Management
```javascript
// File: mcp-server/src/tools/boards.js (new file)

import { loadBoardRegistry, saveBoardRegistry, getBoardsForScan } from '../services/board-registry.js'

/**
 * Get job boards prioritized for scanning
 * DISC-13: High-quality boards prioritized in scans
 */
export function getJobBoards({ includeBlacklisted = false }) {
  const registry = loadBoardRegistry()

  const boards = includeBlacklisted
    ? registry.boards
    : registry.boards.filter(b => b.status !== 'blacklisted')

  return {
    boards: boards.sort((a, b) => a.tier - b.tier || b.qualityRating - a.qualityRating),
    blacklisted: registry.blacklist,
    pendingReview: registry.pendingReview
  }
}

/**
 * Add a new board for quality testing
 * DISC-12: New job boards can be tested and quality-assessed
 */
export function addTestBoard({ name, urlPattern }) {
  if (!name || !urlPattern) {
    return { error: 'name and urlPattern are required' }
  }

  const registry = loadBoardRegistry()

  // Check for duplicate
  if (registry.boards.some(b => b.urlPattern === urlPattern)) {
    return { error: 'Board with this URL pattern already exists' }
  }

  const newBoard = {
    id: urlPattern.replace(/[^a-z0-9]/gi, '-').toLowerCase(),
    name,
    urlPattern,
    tier: 3,
    qualityRating: 0.5,
    metrics: { found: 0, valid: 0, stale: 0, lastScanned: null },
    status: 'testing',
    addedAt: new Date().toISOString()
  }

  registry.boards.push(newBoard)
  registry.pendingReview.push(newBoard.id)
  saveBoardRegistry(registry)

  return {
    success: true,
    board: newBoard,
    message: `${name} added for testing. Quality will be assessed over time.`
  }
}

/**
 * Blacklist a low-quality board
 * DISC-14: Low-quality boards can be blacklisted after user confirmation
 */
export function blacklistBoard({ boardId, reason, userConfirmed }) {
  if (!userConfirmed) {
    return {
      error: 'User confirmation required',
      message: 'Please confirm you want to blacklist this board. This will exclude it from all future scans.'
    }
  }

  const registry = loadBoardRegistry()
  const board = registry.boards.find(b => b.id === boardId)

  if (!board) {
    return { error: 'Board not found' }
  }

  board.status = 'blacklisted'
  board.blacklistedAt = new Date().toISOString()
  board.blacklistReason = reason

  registry.blacklist.push({
    id: board.id,
    name: board.name,
    reason,
    qualityRating: board.qualityRating,
    blacklistedAt: board.blacklistedAt
  })

  saveBoardRegistry(registry)

  return {
    success: true,
    message: `${board.name} has been blacklisted. Reason: ${reason}`
  }
}

/**
 * Record scan results for quality tracking
 */
export function recordScanResults({ boardId, found, valid, stale }) {
  const registry = loadBoardRegistry()
  const board = registry.boards.find(b => b.id === boardId)

  if (!board) {
    return { error: 'Board not found' }
  }

  board.metrics.found += found
  board.metrics.valid += valid
  board.metrics.stale += stale
  board.metrics.lastScanned = new Date().toISOString()

  // Recalculate quality rating
  const totalChecked = board.metrics.valid + board.metrics.stale
  if (totalChecked >= 5) {
    board.qualityRating = Math.round((board.metrics.valid / totalChecked) * 100) / 100
  }

  // Tier adjustments (only after sufficient samples)
  if (totalChecked >= 10) {
    if (board.qualityRating >= 0.8 && board.tier > 1) {
      board.tier = 1
      board.status = 'active'
    } else if (board.qualityRating >= 0.6 && board.tier > 2) {
      board.tier = 2
      board.status = 'active'
    } else if (board.qualityRating < 0.4) {
      // Flag for review, don't auto-blacklist
      if (!registry.pendingReview.includes(board.id)) {
        registry.pendingReview.push(board.id)
      }
    }
  }

  saveBoardRegistry(registry)

  return {
    success: true,
    board: {
      id: board.id,
      name: board.name,
      qualityRating: board.qualityRating,
      tier: board.tier,
      status: board.status
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Friend submissions browser-only | Server-side Supabase processing | Phase 5 | MCP tools can process friend submissions |
| No job archiving | PDF archiving of job descriptions | Phase 5 | Pattern analysis possible |
| Manual status checking | Periodic automated verification | Phase 5 | Stale jobs detected automatically |
| Hardcoded fit criteria | Configurable, outcome-driven criteria | Phase 5 | Criteria evolve with user |
| No board tracking | Quality registry with ratings | Phase 5 | Better scan prioritization |

**Deprecated/outdated:**
- Browser-only friend submission handling: MCP tools now handle server-side
- Manual job staleness checking: Automated verification replaces

## Open Questions

Things that couldn't be fully resolved:

1. **Supabase Service Key Access**
   - What we know: Dashboard uses anon key, server needs service key
   - What's unclear: Is service key already configured? Environment setup?
   - Recommendation: Check Supabase project settings, add SUPABASE_SERVICE_KEY to environment

2. **PDF Storage Location**
   - What we know: Local file storage in `mcp-server/data/archives/`
   - What's unclear: Is this suitable long-term? Cloud storage needed?
   - Recommendation: Start with local, add cloud option later if needed

3. **Staleness Check Frequency**
   - What we know: DISC-09 says "periodic" verification
   - What's unclear: How often? Weekly? Daily?
   - Recommendation: Weekly for active jobs, configurable via MCP tool

4. **Board Quality Thresholds**
   - What we know: Need thresholds for tier promotion/demotion
   - What's unclear: Exact numbers (80%? 60%? 40%?)
   - Recommendation: Start with 80%/60%/40% for tier 1/2/flag thresholds

## Sources

### Primary (HIGH confidence)
- Existing codebase: `index.html` lines 7966-8650 - Supabase integration already implemented
- Existing codebase: `mcp-server/src/tools/discovery.js` - Phase 4 research flow (396 lines)
- Existing codebase: `mcp-server/src/services/fit-scorer.js` - Scoring patterns (316 lines)
- Existing codebase: `worker/job-validator.js` - Status checking via `/status` endpoint (880+ lines)
- Existing codebase: `mcp-server/src/data/loader.js` - Atomic write patterns (197 lines)
- Requirements DISC-07 through DISC-14 - Feature specifications

### Secondary (MEDIUM confidence)
- [Puppeteer Documentation](https://pptr.dev/) - PDF generation patterns
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction) - Server-side usage
- [RisingStack Blog](https://blog.risingstack.com/pdf-from-html-node-js-puppeteer/) - Puppeteer best practices

### Tertiary (LOW confidence)
- WebSearch results on job board aggregation patterns - General approaches

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing dependencies except Puppeteer (well-documented)
- Friend submissions: HIGH - Supabase already integrated in dashboard
- PDF archiving: MEDIUM - Puppeteer is standard but adds complexity
- Staleness detection: HIGH - Extends existing Worker endpoint
- Fit configuration: HIGH - Extends existing fit-scorer patterns
- Board registry: MEDIUM - New concept, straightforward implementation

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable domain, builds on Phase 4)
