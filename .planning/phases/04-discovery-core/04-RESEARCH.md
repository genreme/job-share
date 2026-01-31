# Phase 4: Discovery Core - Research

**Researched:** 2026-01-30
**Domain:** Job Discovery Funnel, Fit Scoring, Profile Matching, Status Verification, MCP Workflow Orchestration
**Confidence:** HIGH

## Summary

Phase 4 implements a structured discovery funnel that transforms bulk job sources into qualified candidates for the user's review. The system follows a multi-stage architecture: (1) Quick Scan ingests jobs from configured sources, (2) Filter Stage reduces volume using profile-based scoring, (3) Deep Research verifies activity status and enriches with company data, (4) Present Stage shows shortlist with reasoning, and (5) User confirms to add to dashboard or defer.

The existing codebase provides strong foundations: a Cloudflare Worker (`worker/job-validator.js`) already handles job URL validation, extraction, fit scoring, and duplicate detection. The MCP server has profile tools (`get_target_roles`, `get_skills_by_category`) that provide matching criteria. The browser extension captures jobs to an "inbox" status for review. Server.js already has `/api/inbox` endpoint (line 271) that sets status to 'inbox'. This phase extends these with profile-driven matching, reasoning generation, and a manual submission workflow.

**Critical Finding:** The `JobStatusSchema` in `schemas/job.schema.js` does NOT include 'inbox' as a valid status, but server.js uses it. This schema mismatch must be fixed as part of Phase 4 implementation.

**Primary recommendation:** Update JobStatusSchema first, then extend MCP tools to orchestrate funnel stages, implement profile-based fit scoring using `master-profile.json`, and add a `research_job_url` MCP tool for manual submissions.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | ^3.x | Schema validation | Already used for JobSchema, ProfileSchema |
| string-similarity | ^4.x | Duplicate detection | Already installed for profile cleanup |
| date-fns | ^4.x | Date calculations | Already installed, handles staleness |
| Cloudflare Worker | - | Remote job validation | Already deployed at `worker/job-validator.js` |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| MCP SDK | ^1.x | Tool orchestration | Existing MCP server pattern |
| uuid | ^13.x | ID generation | Already installed |
| fetch (native) | - | HTTP requests | For calling Cloudflare Worker |

### No New Dependencies Needed

Phase 4 can be implemented entirely with existing dependencies. The Cloudflare Worker handles external HTTP fetching and HTML parsing. MCP tools orchestrate the workflow.

**Installation:**
```bash
# No new packages needed - use existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
mcp-server/
├── data/
│   ├── jobs.json                    # Existing - 'inbox' status already in use
│   ├── profile/
│   │   └── master-profile.json      # Source for matching criteria (Phase 2-3)
│   └── discovery/
│       └── pending-research.json    # NEW: Queue for jobs awaiting deep research
├── src/
│   ├── services/
│   │   ├── fit-scorer.js            # NEW: Profile-based fit scoring
│   │   ├── job-matcher.js           # NEW: Profile-to-job matching logic
│   │   └── reasoning-generator.js   # NEW: Generate shortlist explanations
│   └── tools/
│       ├── discovery.js             # NEW: Funnel stage tools
│       ├── jobs.js                  # Existing - extend with inbox operations
│       └── profile.js               # Existing - used for matching criteria
worker/
└── job-validator.js                 # Existing - deep research endpoint
schemas/
├── job.schema.js                    # UPDATE: Add 'inbox' status
└── discovery.schema.js              # NEW: Discovery stage schemas
```

### Pattern 1: Discovery Funnel Stages
**What:** Jobs flow through defined stages with clear transitions
**When to use:** All job discovery workflows
**Example:**
```javascript
// Source: Requirements DISC-01 through DISC-05
const DISCOVERY_STAGES = {
  // Stage 1: Quick Scan - bulk ingest from sources
  SCAN: {
    actions: ['extract_basic_info', 'check_duplicate'],
    output: 'candidates',
    nextStage: 'FILTER'
  },
  // Stage 2: Filter - reduce to top candidates
  FILTER: {
    actions: ['calculate_fit_score', 'apply_threshold'],
    threshold: 70, // Configurable minimum fit score
    output: 'shortlist',
    nextStage: 'RESEARCH'
  },
  // Stage 3: Deep Research - verify and enrich
  RESEARCH: {
    actions: ['verify_active', 'extract_full_details', 'enrich_company'],
    output: 'verified_shortlist',
    nextStage: 'PRESENT'
  },
  // Stage 4: Present - show with reasoning
  PRESENT: {
    actions: ['generate_reasoning', 'format_for_review'],
    output: 'review_queue',
    nextStage: 'CONFIRM'
  },
  // Stage 5: User Confirm
  CONFIRM: {
    actions: ['add_to_dashboard', 'defer_with_notes'],
    output: 'dashboard_or_deferred'
  }
};
```

### Pattern 2: Profile-Based Fit Scoring
**What:** Calculate fit score using profile data instead of hardcoded criteria
**When to use:** All fit score calculations
**Note:** Profile's `preferences.targetRoles` is currently empty - will need population
**Example:**
```javascript
// Source: Profile tools + existing FIT_CRITERIA in job-validator.js
import { loadProfile } from '../data/profile-loader.js';

export function calculateProfileBasedFitScore(jobData) {
  const profile = loadProfile();
  const targetRoles = profile.preferences?.targetRoles || [];

  // Fallback to hardcoded defaults if profile is empty
  if (targetRoles.length === 0) {
    console.warn('Profile targetRoles is empty - using defaults');
    return calculateDefaultFitScore(jobData);
  }

  let score = 50; // Base score
  const breakdown = { role: 0, industry: 0, location: 0, salary: 0, skills: 0 };

  // Role fit (max +25) - from targetRoles preferences
  for (const targetRole of targetRoles) {
    const titleMatch = matchTitle(jobData.title, targetRole.titles);
    if (titleMatch.exact) {
      breakdown.role = 25;
      break;
    } else if (titleMatch.partial) {
      breakdown.role = Math.max(breakdown.role, 15);
    }
  }

  // Industry fit (max +20) - from targetRoles.industries
  const preferredIndustries = targetRoles.flatMap(r => r.industries?.preferred || []);
  const acceptableIndustries = targetRoles.flatMap(r => r.industries?.acceptable || []);

  if (matchesAny(jobData.industry, preferredIndustries)) {
    breakdown.industry = 20;
  } else if (matchesAny(jobData.industry, acceptableIndustries)) {
    breakdown.industry = 10;
  }

  // Location fit (max +15) - from targetRoles.locations
  const preferredLocations = targetRoles.flatMap(r => r.locations?.preferred || []);
  if (matchesAny(jobData.location, preferredLocations)) {
    breakdown.location = 15;
  }

  // Salary fit (max +15) - from targetRoles.salary
  const salaryMin = targetRoles[0]?.salary?.minimum || 120000;
  if (parseSalary(jobData.salary) >= salaryMin) {
    breakdown.salary = 15;
  }

  // Skills alignment (max +10) - NEW: match job requirements to profile skills
  const profileSkills = profile.skills || [];
  const matchedSkills = countMatchedSkills(jobData.description, profileSkills);
  breakdown.skills = Math.min(10, matchedSkills * 2);

  score += breakdown.role + breakdown.industry + breakdown.location +
           breakdown.salary + breakdown.skills;

  return {
    score: Math.min(100, score),
    breakdown,
    reasoning: generateFitReasoning(breakdown, jobData, profile)
  };
}
```

### Pattern 3: Deep Research via Cloudflare Worker
**What:** Use existing Worker for URL validation, extraction, company enrichment
**When to use:** Research stage of funnel, manual URL submissions
**Example:**
```javascript
// Source: Existing worker/job-validator.js patterns
const WORKER_URL = process.env.JOB_VALIDATOR_URL || 'https://job-validator.<account>.workers.dev';

export async function deepResearchJob(jobUrl, existingJobs = []) {
  try {
    const response = await fetch(`${WORKER_URL}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: jobUrl, existingJobs })
    });

    const result = await response.json();

    // Worker returns: status, title, company, location, salary,
    // fitScore, fitBreakdown, isDuplicate, originalPosting, warnings

    return {
      ...result,
      researchedAt: new Date().toISOString(),
      // Override fitScore with profile-based calculation
      fitScore: await calculateProfileBasedFitScore(result),
      stage: 'RESEARCH_COMPLETE'
    };
  } catch (error) {
    return {
      url: jobUrl,
      status: 'error',
      error: error.message,
      stage: 'RESEARCH_FAILED'
    };
  }
}
```

### Pattern 4: Manual Submission Flow (DISC-06)
**What:** User submits URL, goes through full research -> score -> reasoning
**When to use:** Manual job submission via MCP tool or extension
**Example:**
```javascript
// Source: DISC-06, DISC-06a, DISC-06b requirements
export async function submitJobUrl({ url, submitterNotes }) {
  // 1. Validate URL format
  if (!isValidJobUrl(url)) {
    return { error: 'Invalid job URL format' };
  }

  // 2. Check for duplicates against existing jobs
  const existingJobs = loadJobsFromDashboard().jobs;
  const duplicate = findDuplicateByUrl(url, existingJobs);
  if (duplicate) {
    return {
      status: 'duplicate',
      existingJob: duplicate,
      message: `This job already exists: "${duplicate.title}" at ${duplicate.company}`
    };
  }

  // 3. Deep research (calls Cloudflare Worker)
  const research = await deepResearchJob(url, existingJobs);

  if (research.status === 'error') {
    return {
      status: 'research_failed',
      error: research.error,
      suggestion: 'Try again later or add manually with basic info'
    };
  }

  if (research.status === 'closed') {
    return {
      status: 'job_closed',
      warnings: research.warnings,
      message: 'This job posting appears to be closed or filled'
    };
  }

  // 4. Profile-based fit scoring
  const fitResult = await calculateProfileBasedFitScore(research);

  // 5. Generate reasoning
  const reasoning = generateShortlistReasoning(research, fitResult);

  // 6. Present for user confirmation
  return {
    status: 'pending_confirmation',
    job: {
      title: research.title,
      company: research.company,
      location: research.location,
      salary: research.salary,
      url: url,
      fitScore: fitResult.score,
      fitBreakdown: fitResult.breakdown,
      industry: detectIndustry(research),
      source: detectSource(url)
    },
    research: {
      status: research.status,
      httpStatus: research.httpStatus,
      originalPosting: research.originalPosting,
      warnings: research.warnings,
      researchedAt: research.researchedAt
    },
    reasoning,
    submitterNotes,
    message: 'Review job details and confirm to add to dashboard'
  };
}
```

### Pattern 5: Shortlist Reasoning Generation
**What:** Explain why each job was included in shortlist
**When to use:** Present stage, user review
**Example:**
```javascript
// Source: DISC-04 "presented with reasoning"
export function generateShortlistReasoning(job, fitResult) {
  const reasons = [];
  const concerns = [];
  const breakdown = fitResult.breakdown;

  // Positive signals
  if (breakdown.role >= 20) {
    reasons.push(`Strong role match: "${job.title}" aligns with your target Creative Director positions`);
  }
  if (breakdown.industry >= 15) {
    reasons.push(`Target industry: ${job.industry} is in your preferred sectors`);
  }
  if (breakdown.location >= 10) {
    reasons.push(`Good location fit: ${job.location} matches your preferences`);
  }
  if (breakdown.salary >= 10) {
    reasons.push(`Meets salary threshold: ${job.salary}`);
  }
  if (breakdown.skills >= 5) {
    reasons.push(`Skills alignment: Job mentions several of your documented skills`);
  }

  // Concerns
  if (breakdown.role < 10) {
    concerns.push(`Title "${job.title}" may not be a direct match for your target roles`);
  }
  if (breakdown.salary === 0 && job.salary === 'Not listed') {
    concerns.push('Salary not disclosed - may need negotiation conversation early');
  }
  if (job.warnings?.length > 0) {
    concerns.push(...job.warnings.map(w => `Note: ${w}`));
  }

  return {
    score: fitResult.score,
    summary: generateSummary(fitResult.score, reasons, concerns),
    whyIncluded: reasons,
    considerations: concerns,
    scoreBreakdown: {
      role: `${breakdown.role}/25 points`,
      industry: `${breakdown.industry}/20 points`,
      location: `${breakdown.location}/15 points`,
      salary: `${breakdown.salary}/15 points`,
      skills: `${breakdown.skills}/10 points`
    }
  };
}

function generateSummary(score, reasons, concerns) {
  if (score >= 90) {
    return `Excellent match (${score}/100). ${reasons[0]}`;
  } else if (score >= 80) {
    return `Strong match (${score}/100). ${reasons[0]}${concerns.length ? ` Note: ${concerns[0]}` : ''}`;
  } else if (score >= 70) {
    return `Good potential (${score}/100). Worth reviewing: ${reasons[0]}`;
  } else {
    return `Moderate fit (${score}/100). Consider: ${reasons[0] || 'May be stretch role'}`;
  }
}
```

### Pattern 6: Inbox Management
**What:** Jobs in inbox status await user review/confirmation
**When to use:** After extension capture, after manual submission research
**Note:** Server.js already has `/api/inbox` endpoint at line 271
**Example:**
```javascript
// Source: Existing server.js /api/inbox pattern
export function getInboxJobs() {
  const data = loadJobsFromDashboard();
  return data.jobs
    .filter(j => j.status === 'inbox')
    .sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0))
    .map(j => ({
      ...j,
      daysSinceFound: calculateDaysSince(j.found),
      needsResearch: !j.researchedAt
    }));
}

export function confirmInboxJob(jobId, { status, notes }) {
  const data = loadJobsFromDashboard();
  const job = data.jobs.find(j => j.id === jobId);

  if (!job) {
    return { error: `Job ${jobId} not found` };
  }
  if (job.status !== 'inbox') {
    return { error: `Job ${jobId} is not in inbox (status: ${job.status})` };
  }

  // Valid transitions from inbox
  const validStatuses = ['apply-now', 'maybe', 'probably-not', 'archived'];
  if (!validStatuses.includes(status)) {
    return { error: `Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}` };
  }

  job.status = status;
  job.confirmedAt = new Date().toISOString();
  if (notes) {
    job.notes = (job.notes ? job.notes + '\n\n' : '') + `[Confirmed ${status}] ${notes}`;
  }

  job.updates.push({
    date: new Date().toISOString().split('T')[0],
    type: 'Inbox Confirmed',
    notes: `Moved to ${status}${notes ? ': ' + notes : ''}`
  });

  writeJobsData(data);
  return { success: true, job };
}

export function deferInboxJob(jobId, { reason, reviewAfter }) {
  const data = loadJobsFromDashboard();
  const job = data.jobs.find(j => j.id === jobId);

  if (!job) {
    return { error: `Job ${jobId} not found` };
  }

  job.deferredAt = new Date().toISOString();
  job.deferredReason = reason;
  job.reviewAfter = reviewAfter; // ISO date for reminder
  job.notes = (job.notes ? job.notes + '\n\n' : '') + `[Deferred] ${reason}`;

  job.updates.push({
    date: new Date().toISOString().split('T')[0],
    type: 'Deferred',
    notes: `${reason}. Review after: ${reviewAfter || 'unspecified'}`
  });

  writeJobsData(data);
  return { success: true, job };
}
```

### Anti-Patterns to Avoid
- **Hardcoded fit criteria:** Don't duplicate FIT_CRITERIA from worker - use profile data
- **Auto-adding to dashboard:** Always require user confirmation before adding
- **Blocking on research failures:** Failed research shouldn't block - offer manual entry fallback
- **Over-fetching:** Don't deep research every job - filter first to reduce Worker calls
- **Ignoring existing patterns:** Use atomic writes, MCP tool patterns from existing code
- **Schema mismatch:** Ensure JobStatusSchema matches statuses used in code

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML extraction | Regex parsing | Cloudflare Worker extractJobDetails() | Already handles JSON-LD, Open Graph, board-specific selectors |
| Job status checking | HEAD request logic | Cloudflare Worker /status endpoint | Already handles closed indicators, 404 detection |
| Duplicate detection | Simple title match | string-similarity + existing findDuplicateJob() | Handles fuzzy matching, URL matching |
| Fit scoring weights | Manual point system | Profile-driven weights from targetRoles | Evolves with profile, not hardcoded |
| Company detection | Domain guessing | Worker findCompanyCareersPage() | Already searches common patterns |
| Source detection | URL regex | Worker detectSource() | Already handles LinkedIn, Lever, Greenhouse, etc. |
| Levenshtein distance | Custom implementation | Existing in worker/job-validator.js and server.js | Already implemented twice in codebase |

**Key insight:** The Cloudflare Worker already implements most research functionality. Phase 4 is about orchestrating calls to it and adding profile-based scoring.

## Common Pitfalls

### Pitfall 1: Schema Status Mismatch (CRITICAL)
**What goes wrong:** Server.js uses 'inbox' status but JobStatusSchema doesn't include it
**Why it happens:** Server was updated to add inbox functionality without updating schema
**How to avoid:** Update `schemas/job.schema.js` FIRST in Phase 4 implementation
**Warning signs:** Zod validation errors when status is 'inbox'
```javascript
// Current (broken):
export const JobStatusSchema = z.enum([
  'apply-now', 'maybe', 'probably-not', 'applied', 'archived'
])

// Required (fix):
export const JobStatusSchema = z.enum([
  'inbox',           // NEW: Awaiting user review
  'apply-now',
  'maybe',
  'probably-not',
  'applied',
  'archived'
])
```

### Pitfall 2: Empty Profile targetRoles
**What goes wrong:** Profile-based scoring fails silently when profile is empty
**Why it happens:** Profile was just created, targetRoles not populated
**How to avoid:** Add fallback to hardcoded defaults when profile is empty, log warning
**Warning signs:** All jobs get 50 fit score (base only), no breakdown
```javascript
// Good: Fallback with warning
export function calculateProfileBasedFitScore(jobData) {
  const profile = loadProfile();
  const targetRoles = profile.preferences?.targetRoles || [];

  if (targetRoles.length === 0) {
    console.warn('Profile targetRoles is empty - using default criteria');
    // Fall back to existing FIT_CRITERIA pattern from job-validator.js
    return calculateDefaultFitScore(jobData);
  }
  // ... profile-based calculation
}
```

### Pitfall 3: Worker Rate Limiting
**What goes wrong:** Too many parallel requests to Cloudflare Worker get throttled
**Why it happens:** Batch processing all candidates at once
**How to avoid:** Implement concurrency limit (existing pattern in Worker uses 5-10 parallel)
**Warning signs:** 429 errors, timeouts, incomplete batch results
```javascript
// Good: Sequential batches with concurrency limit
const CONCURRENCY = 5;
for (let i = 0; i < urls.length; i += CONCURRENCY) {
  const batch = urls.slice(i, i + CONCURRENCY);
  const results = await Promise.all(batch.map(url => deepResearchJob(url)));
  allResults.push(...results);
}
```

### Pitfall 4: Stale Profile Data
**What goes wrong:** Fit scores calculated with outdated profile preferences
**Why it happens:** Profile loaded once at startup, cached
**How to avoid:** Load profile fresh for each scoring operation (it's just a JSON read)
**Warning signs:** Fit scores don't reflect recent profile updates
```javascript
// Good: Fresh load each time
export function calculateProfileBasedFitScore(jobData) {
  const profile = loadProfile(); // Fresh read, not cached
  // ...
}
```

### Pitfall 5: Reasoning Without Context
**What goes wrong:** Generic reasoning like "Good fit score" doesn't help user decide
**Why it happens:** Not connecting score components to specific job/profile data
**How to avoid:** Reference actual job details and profile preferences in reasoning
**Warning signs:** User asks "why is this 85 and that one 82?"
```javascript
// Bad: "Score: 85/100. Good match."
// Good: "Score: 85/100. 'Senior Creative Director' matches your target title (25pts).
//        Nonprofit industry is your preferred sector (20pts). Boston location (15pts)."
```

### Pitfall 6: Lost Submissions During Research Failures
**What goes wrong:** User submits URL, research fails, no record kept
**Why it happens:** Only saving after successful research
**How to avoid:** Save to pending-research.json immediately, update status after research
**Warning signs:** User submits same URL multiple times, confusion about what was submitted
```javascript
// Good: Save immediately, research async
export async function submitJobUrl({ url }) {
  // 1. Save to pending immediately
  const pending = { url, submittedAt: new Date().toISOString(), status: 'researching' };
  savePendingResearch(pending);

  // 2. Research (may fail)
  try {
    const result = await deepResearchJob(url);
    updatePendingResearch(url, { status: 'complete', result });
    return result;
  } catch (error) {
    updatePendingResearch(url, { status: 'failed', error: error.message });
    return { status: 'error', error: error.message, pendingSaved: true };
  }
}
```

### Pitfall 7: Hardcoded Industry Detection
**What goes wrong:** detectIndustry() in server.js uses hardcoded keywords
**Why it happens:** Quick implementation without profile integration
**How to avoid:** Use profile's targetRoles.industries for preferred/acceptable, extend with general detection
**Warning signs:** Jobs mis-categorized, profile industries not recognized

## Code Examples

Verified patterns from existing codebase and official sources:

### MCP Tool: Research Job URL
```javascript
// Source: MCP patterns from index.js + DISC-06 requirements
// File: mcp-server/src/tools/discovery.js

import { loadJobsFromDashboard, writeJobsData } from '../data/loader.js';
import { loadProfile } from '../data/profile-loader.js';

const WORKER_URL = process.env.JOB_VALIDATOR_URL || 'https://job-validator.workers.dev';

/**
 * Research a job URL and present for user confirmation
 *
 * @param {object} params - Parameters
 * @param {string} params.url - Job posting URL
 * @param {string} params.notes - Optional submitter notes
 * @returns {object} Research results with fit score and reasoning
 */
export async function researchJobUrl({ url, notes }) {
  if (!url) {
    return { error: 'url parameter is required' };
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (e) {
    return { error: `Invalid URL format: ${url}` };
  }

  // Load existing jobs for duplicate check
  const data = loadJobsFromDashboard();
  const existingJobs = data.jobs || [];

  // Check for URL-based duplicate
  const cleanUrl = url.split('?')[0].toLowerCase();
  const urlDuplicate = existingJobs.find(j =>
    j.url && j.url.split('?')[0].toLowerCase() === cleanUrl
  );
  if (urlDuplicate) {
    return {
      status: 'duplicate',
      existingJob: {
        id: urlDuplicate.id,
        title: urlDuplicate.title,
        company: urlDuplicate.company,
        status: urlDuplicate.status,
        fitScore: urlDuplicate.fitScore
      },
      message: `This URL is already tracked: "${urlDuplicate.title}" at ${urlDuplicate.company}`
    };
  }

  // Call Cloudflare Worker for deep research
  try {
    const response = await fetch(`${WORKER_URL}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        existingJobs: existingJobs.map(j => ({
          id: j.id, title: j.title, company: j.company
        }))
      })
    });

    if (!response.ok) {
      return {
        status: 'research_failed',
        error: `Worker returned ${response.status}`,
        suggestion: 'The job validator service may be temporarily unavailable'
      };
    }

    const research = await response.json();

    // Handle closed/error status
    if (research.status === 'closed') {
      return {
        status: 'job_closed',
        title: research.title,
        company: research.company,
        warnings: research.warnings,
        message: 'This job posting appears to be closed or filled'
      };
    }

    if (research.status === 'error') {
      return {
        status: 'research_failed',
        error: research.warnings?.join('; ') || 'Unknown error',
        suggestion: 'Try again later or add job manually'
      };
    }

    // Calculate profile-based fit score
    const fitResult = calculateFitScore(research);

    // Generate reasoning
    const reasoning = generateReasoning(research, fitResult);

    return {
      status: 'ready_for_review',
      job: {
        title: research.title || 'Unknown Title',
        company: research.company || 'Unknown Company',
        location: research.location || 'Not specified',
        salary: research.salary || 'Not listed',
        industry: research.industry || detectIndustry(research),
        url: url,
        fitScore: fitResult.score,
        fitBreakdown: fitResult.breakdown,
        source: research.source || 'Manual Submission'
      },
      research: {
        httpStatus: research.httpStatus,
        originalPosting: research.originalPosting,
        warnings: research.warnings || [],
        researchedAt: new Date().toISOString()
      },
      reasoning,
      notes,
      nextStep: 'Call confirm_job_to_dashboard or defer_job to proceed'
    };

  } catch (error) {
    return {
      status: 'research_failed',
      error: error.message,
      suggestion: 'Network error - check if Worker is deployed and accessible'
    };
  }
}

/**
 * Calculate fit score using profile preferences
 * Falls back to hardcoded defaults if profile is empty
 */
function calculateFitScore(jobData) {
  const profile = loadProfile();
  const targetRoles = profile.preferences?.targetRoles || [];

  // Fallback to defaults if profile is empty
  if (targetRoles.length === 0) {
    return calculateDefaultFitScore(jobData);
  }

  let score = 50;
  const breakdown = { role: 0, industry: 0, location: 0, salary: 0, skills: 0 };

  const title = (jobData.title || '').toLowerCase();
  const description = (jobData.description || '').toLowerCase();
  const location = (jobData.location || '').toLowerCase();

  // Role fit from targetRoles (max 25)
  for (const target of targetRoles) {
    for (const exactTitle of (target.titles?.exact || [])) {
      if (title.includes(exactTitle.toLowerCase())) {
        breakdown.role = 25;
        break;
      }
    }
    if (breakdown.role === 0) {
      for (const partial of (target.titles?.partial || [])) {
        if (title.includes(partial.toLowerCase())) {
          breakdown.role = 15;
          break;
        }
      }
    }
  }

  // Industry fit (max 20)
  for (const target of targetRoles) {
    for (const industry of (target.industries?.preferred || [])) {
      if (description.includes(industry.toLowerCase())) {
        breakdown.industry = 20;
        break;
      }
    }
    if (breakdown.industry === 0) {
      for (const industry of (target.industries?.acceptable || [])) {
        if (description.includes(industry.toLowerCase())) {
          breakdown.industry = 10;
          break;
        }
      }
    }
  }

  // Location fit (max 15)
  for (const target of targetRoles) {
    for (const loc of (target.locations?.preferred || [])) {
      if (location.includes(loc.toLowerCase())) {
        breakdown.location = 15;
        break;
      }
    }
    if (breakdown.location === 0) {
      for (const loc of (target.locations?.acceptable || [])) {
        if (location.includes(loc.toLowerCase())) {
          breakdown.location = 8;
          break;
        }
      }
    }
  }

  // Salary fit (max 15)
  const salaryMin = targetRoles[0]?.salary?.minimum || 120000;
  const parsedSalary = parseSalaryFromText(jobData.salary);
  if (parsedSalary >= salaryMin) {
    breakdown.salary = 15;
  } else if (parsedSalary >= salaryMin * 0.9) {
    breakdown.salary = 8;
  }

  // Skills alignment (max 10) - check profile skills against description
  const skills = profile.skills || [];
  let matchedCount = 0;
  for (const skill of skills.slice(0, 20)) { // Top 20 skills
    if (description.includes(skill.name.toLowerCase())) {
      matchedCount++;
    }
  }
  breakdown.skills = Math.min(10, matchedCount * 2);

  score += breakdown.role + breakdown.industry + breakdown.location +
           breakdown.salary + breakdown.skills;

  return { score: Math.min(100, score), breakdown };
}

/**
 * Default fit scoring when profile is empty
 * Uses patterns from existing job-validator.js
 */
function calculateDefaultFitScore(jobData) {
  // Mirrors FIT_CRITERIA from worker/job-validator.js
  const FIT_CRITERIA = {
    titles: {
      exact: ['Creative Director', 'VP of Creative', 'Design Director', 'Head of Creative'],
      partial: ['Creative', 'Design', 'Brand', 'Art Director']
    },
    industries: {
      preferred: ['healthcare', 'nonprofit', 'education', 'mission-driven'],
      acceptable: ['technology', 'saas', 'startup']
    },
    locations: {
      preferred: ['boston', 'remote', 'hybrid'],
      acceptable: ['new york', 'northeast']
    },
    salaryMin: 120000
  };

  let score = 50;
  const breakdown = { role: 0, industry: 0, location: 0, salary: 0, skills: 0 };

  const title = (jobData.title || '').toLowerCase();
  const description = (jobData.description || '').toLowerCase();
  const location = (jobData.location || '').toLowerCase();

  // Role fit
  for (const exactTitle of FIT_CRITERIA.titles.exact) {
    if (title.includes(exactTitle.toLowerCase())) {
      breakdown.role = 25;
      break;
    }
  }
  if (breakdown.role === 0) {
    for (const partialTitle of FIT_CRITERIA.titles.partial) {
      if (title.includes(partialTitle.toLowerCase())) {
        breakdown.role = 15;
        break;
      }
    }
  }

  // Industry fit
  for (const industry of FIT_CRITERIA.industries.preferred) {
    if (description.includes(industry)) {
      breakdown.industry = 20;
      break;
    }
  }
  if (breakdown.industry === 0) {
    for (const industry of FIT_CRITERIA.industries.acceptable) {
      if (description.includes(industry)) {
        breakdown.industry = 10;
        break;
      }
    }
  }

  // Location fit
  for (const loc of FIT_CRITERIA.locations.preferred) {
    if (location.includes(loc)) {
      breakdown.location = 15;
      break;
    }
  }
  if (breakdown.location === 0) {
    for (const loc of FIT_CRITERIA.locations.acceptable) {
      if (location.includes(loc)) {
        breakdown.location = 8;
        break;
      }
    }
  }

  // Salary fit
  const parsedSalary = parseSalaryFromText(jobData.salary);
  if (parsedSalary >= FIT_CRITERIA.salaryMin) {
    breakdown.salary = 15;
  }

  score += breakdown.role + breakdown.industry + breakdown.location + breakdown.salary;

  return { score: Math.min(100, score), breakdown, usingDefaults: true };
}

function parseSalaryFromText(salaryText) {
  if (!salaryText) return 0;
  const match = salaryText.match(/\$?(\d{2,3}),?(\d{3})/);
  if (match) {
    return parseInt(match[1] + match[2]);
  }
  return 0;
}

function detectIndustry(jobData) {
  const text = `${jobData.title || ''} ${jobData.company || ''} ${jobData.description || ''}`.toLowerCase();

  if (text.includes('nonprofit') || text.includes('non-profit') || text.includes('foundation')) return 'Nonprofit';
  if (text.includes('healthcare') || text.includes('health') || text.includes('medical')) return 'Healthcare';
  if (text.includes('education') || text.includes('university') || text.includes('edtech')) return 'Education';
  if (text.includes('tech') || text.includes('software') || text.includes('saas')) return 'Technology';

  return 'Unknown';
}

function generateReasoning(job, fitResult) {
  const reasons = [];
  const concerns = [];
  const b = fitResult.breakdown;

  if (b.role >= 20) reasons.push(`"${job.title}" matches your target roles`);
  else if (b.role >= 10) reasons.push(`Title has partial alignment with your targets`);
  else concerns.push(`Title may not directly match your target roles`);

  if (b.industry >= 15) reasons.push(`Industry aligns with your preferences`);
  if (b.location >= 10) reasons.push(`Location (${job.location}) is preferred`);
  if (b.salary >= 10) reasons.push(`Salary meets your threshold`);
  else if (!job.salary || job.salary === 'Not listed') concerns.push(`Salary not disclosed`);
  if (b.skills >= 5) reasons.push(`Multiple skill matches found`);

  if (fitResult.usingDefaults) {
    concerns.push('Using default fit criteria - populate profile targetRoles for personalized scoring');
  }

  return {
    score: fitResult.score,
    summary: fitResult.score >= 80
      ? `Strong match (${fitResult.score}/100): ${reasons[0] || 'Good overall fit'}`
      : `Moderate fit (${fitResult.score}/100): ${reasons[0] || 'Worth reviewing'}`,
    whyIncluded: reasons,
    considerations: concerns,
    breakdown: b
  };
}
```

### MCP Tool: Confirm Job to Dashboard
```javascript
// Source: DISC-05, DISC-06b requirements
export function confirmJobToDashboard({ jobId, status, notes }) {
  if (!jobId) {
    return { error: 'jobId is required' };
  }

  const validStatuses = ['apply-now', 'maybe', 'probably-not'];
  if (!validStatuses.includes(status)) {
    return { error: `status must be one of: ${validStatuses.join(', ')}` };
  }

  const data = loadJobsFromDashboard();
  const job = data.jobs.find(j => j.id === jobId);

  if (!job) {
    return { error: `Job ${jobId} not found` };
  }

  if (job.status !== 'inbox') {
    return { error: `Job is not in inbox (current status: ${job.status})` };
  }

  const previousStatus = job.status;
  job.status = status;
  job.confirmedAt = new Date().toISOString();

  if (notes) {
    job.notes = (job.notes || '') + `\n\n[Confirmed] ${notes}`;
  }

  if (!job.updates) job.updates = [];
  job.updates.push({
    date: new Date().toISOString().split('T')[0],
    type: 'Confirmed from Inbox',
    notes: `Status: ${status}${notes ? ' - ' + notes : ''}`
  });

  writeJobsData(data);

  return {
    success: true,
    jobId,
    previousStatus,
    newStatus: status,
    message: `Job "${job.title}" at ${job.company} moved to ${status}`
  };
}
```

### MCP Tool: Get Inbox for Review
```javascript
// Source: Inbox management patterns
export function getInboxForReview({ includeResearchStatus = false }) {
  const data = loadJobsFromDashboard();

  const inboxJobs = data.jobs
    .filter(j => j.status === 'inbox')
    .sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0))
    .map(j => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      salary: j.salary,
      fitScore: j.fitScore,
      fitBreakdown: j.fitBreakdown,
      url: j.url,
      source: j.sources?.[0] || 'Unknown',
      found: j.found,
      daysPending: Math.floor((Date.now() - new Date(j.found)) / (1000 * 60 * 60 * 24)),
      hasResearch: !!j.researchedAt,
      notes: j.notes?.substring(0, 200)
    }));

  return {
    count: inboxJobs.length,
    jobs: inboxJobs,
    summary: {
      total: inboxJobs.length,
      highFit: inboxJobs.filter(j => j.fitScore >= 80).length,
      needsResearch: inboxJobs.filter(j => !j.hasResearch).length,
      oldestDays: inboxJobs.length > 0 ? Math.max(...inboxJobs.map(j => j.daysPending)) : 0
    }
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded FIT_CRITERIA | Profile-based scoring | Phase 4 | Personalized matching |
| Manual URL checking | Cloudflare Worker validation | Existing | Automated research |
| Extension captures to dashboard | Extension captures to inbox | Server.js exists | User review before commit |
| Generic fit scores | Fit scores with reasoning | Phase 4 | Transparent decision support |
| No manual submission | MCP tool for URL submission | Phase 4 | Supports multiple input channels |

**Deprecated/outdated:**
- Direct extension-to-dashboard adds: Should go through inbox first
- Hardcoded industry keywords: Should use profile targetRoles.industries

**Schema Update Required:**
- `schemas/job.schema.js` JobStatusSchema must include 'inbox'

## Open Questions

Things that couldn't be fully resolved:

1. **Cloudflare Worker URL Configuration**
   - What we know: Worker exists at `worker/job-validator.js`, needs deployment
   - What's unclear: Exact deployed URL, environment variable setup
   - Recommendation: Use `process.env.JOB_VALIDATOR_URL` with sensible default

2. **Profile targetRoles Population**
   - What we know: Profile schema exists but targetRoles is currently empty
   - What's unclear: When will user populate profile? What's fallback behavior?
   - Recommendation: Implement fallback to hardcoded defaults with warning message

3. **Batch Quick Scan Sources**
   - What we know: Requirements mention "configured job boards" for quick scan
   - What's unclear: What sources to scan, how to configure
   - Recommendation: Defer automated board scanning to Phase 5 (DISC-07+); Phase 4 focuses on manual submission and extension capture

4. **Fit Score Threshold for Filter Stage**
   - What we know: Filter stage should "reduce hundreds to top candidates"
   - What's unclear: What threshold (70? 80?) or how many to keep
   - Recommendation: Make configurable, default 70, keep top 20

## Sources

### Primary (HIGH confidence)
- Existing codebase: `worker/job-validator.js` - Full validation, extraction, scoring implementation (882 lines)
- Existing codebase: `mcp-server/src/tools/profile.js` - Profile query tools (180 lines)
- Existing codebase: `server.js` - Inbox API (line 271), duplicate detection, analytics patterns (1867 lines)
- Existing codebase: `schemas/job.schema.js` - Job data structure, **missing 'inbox' status** (148 lines)
- Existing codebase: `mcp-server/src/index.js` - MCP tool registration patterns (1123 lines)
- Existing codebase: `mcp-server/data/profile/master-profile.json` - Profile structure (empty targetRoles)
- Requirements DISC-01 through DISC-06b - Feature specifications

### Secondary (MEDIUM confidence)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/docs/develop/connect-local-servers) - Tool orchestration patterns

### Tertiary (LOW confidence)
- WebSearch results on job funnel patterns - General approaches, not project-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing dependencies only, verified in package.json
- Architecture: HIGH - Extends existing patterns (Worker, MCP tools, atomic writes)
- Fit scoring: HIGH - Profile schema exists, fallback pattern established
- Schema update: HIGH - Confirmed 'inbox' missing from JobStatusSchema
- Pitfalls: MEDIUM - Based on existing code patterns and requirements analysis
- Open questions: Noted for planner consideration

**Research date:** 2026-01-30
**Valid until:** 2026-03-01 (30 days - stable domain, existing infrastructure)
