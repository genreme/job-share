/**
 * Discovery MCP Tools
 *
 * Tools for the discovery funnel workflow:
 * - research_job_url: Research a job posting URL
 * - get_inbox: Review inbox jobs for Claude to present
 * - confirm_job: Confirm job to dashboard with status
 * - defer_job: Defer job for later review
 */

import { loadJobsFromDashboard, writeJobsData } from '../data/loader.js'
import { calculateFitScore } from '../services/fit-scorer.js'
import { generateReasoning } from '../services/reasoning-generator.js'

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Check if job URL already exists in the system
 * @param {string} url - URL to check
 * @param {object[]} jobs - Array of jobs to check against
 * @returns {object|null} Existing job if found, null otherwise
 */
function findDuplicateByUrl(url, jobs) {
  if (!url || !jobs) return null
  const normalizedUrl = url.toLowerCase().replace(/\/$/, '')
  return jobs.find(job => {
    if (!job.url) return false
    const jobUrl = job.url.toLowerCase().replace(/\/$/, '')
    return jobUrl === normalizedUrl
  }) || null
}

/**
 * Generate next job ID
 * @param {object[]} jobs - Existing jobs array
 * @returns {number} Next available ID
 */
function getNextJobId(jobs) {
  if (!jobs || jobs.length === 0) return 1
  const maxId = Math.max(...jobs.map(j => j.id || 0))
  return maxId + 1
}

/**
 * Research a job posting URL to extract details, calculate fit score, and generate reasoning
 * DISC-06, DISC-06a: Manual submission with full research flow
 *
 * @param {object} params - Tool parameters
 * @param {string} params.url - Full URL of the job posting
 * @param {string} [params.notes] - Optional notes about the submission
 * @returns {object} Research result with job data, reasoning, and next steps
 */
export async function researchJobUrl({ url, notes }) {
  // Validate URL format
  if (!isValidUrl(url)) {
    return {
      status: 'error',
      error: 'Invalid URL format. Please provide a valid job posting URL (http:// or https://)'
    }
  }

  // Load current jobs data
  const data = loadJobsFromDashboard()
  const jobs = data.jobs || []

  // Check for duplicate by URL
  const existingJob = findDuplicateByUrl(url, jobs)
  if (existingJob) {
    return {
      status: 'duplicate',
      existingJob: {
        id: existingJob.id,
        title: existingJob.title,
        company: existingJob.company,
        status: existingJob.status,
        fitScore: existingJob.fitScore
      },
      message: `This job already exists in your ${existingJob.status} list`
    }
  }

  // Check for Cloudflare Worker URL (deep research)
  const workerUrl = process.env.JOB_VALIDATOR_URL

  let jobData = null
  let research = { httpStatus: null, warnings: [], researchedAt: new Date().toISOString() }

  if (workerUrl) {
    try {
      // Call Cloudflare Worker for deep research
      const response = await fetch(`${workerUrl}?url=${encodeURIComponent(url)}`)
      const researchResult = await response.json()

      if (response.ok && researchResult.job) {
        jobData = {
          id: getNextJobId(jobs),
          title: researchResult.job.title || 'Unknown Title',
          company: researchResult.job.company || 'Unknown Company',
          location: researchResult.job.location || '',
          salary: researchResult.job.salary || '',
          industry: researchResult.job.industry || '',
          description: researchResult.job.description || '',
          url: url,
          found: new Date().toISOString().split('T')[0],
          status: 'inbox',
          source: 'manual',
          notes: notes || '',
          updates: [],
          symbols: []
        }
        research.httpStatus = response.status
        research.warnings = researchResult.warnings || []
      } else if (researchResult.status === 'job_closed') {
        return {
          status: 'job_closed',
          message: 'This job posting appears to be closed or no longer available',
          research
        }
      } else {
        // Worker returned error - partial research mode
        research.httpStatus = response.status
        research.warnings = [researchResult.error || 'Worker returned error']
      }
    } catch (e) {
      // Worker unavailable - partial research mode
      research.warnings = [`Worker request failed: ${e.message}`]
    }
  }

  // If no job data from Worker, return partial research result
  if (!jobData) {
    return {
      status: 'partial_research',
      requiresManualEntry: true,
      missingFields: ['title', 'company', 'description'],
      message: 'Could not fetch job details automatically. Please provide: title, company, description',
      url,
      notes,
      research,
      nextStep: 'Provide job details manually, then call research_job_url again with jobData'
    }
  }

  // Calculate fit score
  const fitResult = calculateFitScore(jobData)
  jobData.fitScore = fitResult.score
  jobData.fitBreakdown = fitResult.breakdown

  // Generate reasoning
  const reasoning = generateReasoning(jobData, fitResult)

  return {
    status: 'ready_for_review',
    job: {
      id: jobData.id,
      title: jobData.title,
      company: jobData.company,
      location: jobData.location,
      salary: jobData.salary,
      industry: jobData.industry,
      fitScore: jobData.fitScore,
      fitBreakdown: jobData.fitBreakdown,
      url: jobData.url
    },
    research,
    reasoning: {
      score: reasoning.score,
      summary: reasoning.summary,
      whyIncluded: reasoning.whyIncluded,
      considerations: reasoning.considerations,
      breakdown: reasoning.breakdown
    },
    requiresManualEntry: false,
    notes,
    nextStep: 'Call confirm_job to add to dashboard or defer_job to review later'
  }
}

/**
 * Get jobs awaiting review in the inbox
 * DISC-04: Present shortlist for review
 *
 * Note: Presentation happens via Claude - Claude calls this tool and formats
 * the response naturally in conversation. No dashboard UI involved.
 *
 * @param {object} params - Tool parameters
 * @param {string} [params.sortBy='fitScore'] - Sort order (fitScore or found)
 * @returns {object} Inbox jobs with summary stats
 */
export function getInboxForReview({ sortBy = 'fitScore' } = {}) {
  const data = loadJobsFromDashboard()
  const allJobs = data.jobs || []

  // Filter to inbox jobs only
  let inboxJobs = allJobs.filter(job => job.status === 'inbox')

  // Sort by requested field
  if (sortBy === 'fitScore') {
    inboxJobs.sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0))
  } else if (sortBy === 'found') {
    inboxJobs.sort((a, b) => new Date(b.found || 0) - new Date(a.found || 0))
  }

  // Calculate days pending for each job
  const now = new Date()
  const jobs = inboxJobs.map(job => {
    const foundDate = job.found ? new Date(job.found) : null
    const daysPending = foundDate ? Math.floor((now - foundDate) / (1000 * 60 * 60 * 24)) : null

    return {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      fitScore: job.fitScore || 0,
      daysPending,
      hasResearch: !!job.description || !!job.fitBreakdown,
      url: job.url,
      source: job.source || 'unknown'
    }
  })

  // Calculate summary stats
  const summary = {
    total: jobs.length,
    highFit: jobs.filter(j => j.fitScore >= 80).length,
    needsResearch: jobs.filter(j => !j.hasResearch).length,
    oldestDays: jobs.length > 0 ? Math.max(...jobs.map(j => j.daysPending || 0)) : 0
  }

  return {
    count: jobs.length,
    jobs,
    summary,
    presentationNote: 'Claude formats and presents this data in conversation'
  }
}

/**
 * Confirm an inbox job and add it to the dashboard with a status
 * DISC-05, DISC-06b: Confirm add to dashboard
 *
 * @param {object} params - Tool parameters
 * @param {number} params.jobId - ID of the job to confirm
 * @param {string} params.status - Target status (apply-now, maybe, probably-not)
 * @param {string} [params.notes] - Optional confirmation notes
 * @returns {object} Confirmation result
 */
export function confirmJobToDashboard({ jobId, status, notes }) {
  // Validate required parameters
  if (jobId === undefined || jobId === null) {
    return { success: false, error: 'jobId is required' }
  }

  // Validate status
  const validStatuses = ['apply-now', 'maybe', 'probably-not']
  if (!status || !validStatuses.includes(status)) {
    return {
      success: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    }
  }

  // Load current jobs data
  const data = loadJobsFromDashboard()
  const jobs = data.jobs || []

  // Find the job
  const jobIndex = jobs.findIndex(j => j.id === jobId)
  if (jobIndex === -1) {
    return { success: false, error: `Job with ID ${jobId} not found` }
  }

  const job = jobs[jobIndex]

  // Verify job is in inbox
  if (job.status !== 'inbox') {
    return {
      success: false,
      error: `Job must be in inbox status to confirm. Current status: ${job.status}`
    }
  }

  const previousStatus = job.status

  // Update job status
  job.status = status
  job.confirmedAt = new Date().toISOString()

  // Add update entry
  if (!job.updates) {
    job.updates = []
  }
  job.updates.push({
    date: new Date().toISOString().split('T')[0],
    type: 'Confirmed',
    notes: notes || `Moved from inbox to ${status}`
  })

  // Persist changes
  writeJobsData(data)

  return {
    success: true,
    jobId,
    previousStatus,
    newStatus: status,
    message: `Job '${job.title}' at ${job.company} moved to ${status}`
  }
}

/**
 * Defer an inbox job for later review
 * DISC-05: Defer with notes
 *
 * @param {object} params - Tool parameters
 * @param {number} params.jobId - ID of the job to defer
 * @param {string} params.reason - Why deferring (e.g., "waiting for more info")
 * @param {string} [params.reviewAfter] - ISO date to review again (optional)
 * @returns {object} Defer result
 */
export function deferJob({ jobId, reason, reviewAfter }) {
  // Validate required parameters
  if (jobId === undefined || jobId === null) {
    return { success: false, error: 'jobId is required' }
  }

  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    return { success: false, error: 'reason is required' }
  }

  // Load current jobs data
  const data = loadJobsFromDashboard()
  const jobs = data.jobs || []

  // Find the job
  const jobIndex = jobs.findIndex(j => j.id === jobId)
  if (jobIndex === -1) {
    return { success: false, error: `Job with ID ${jobId} not found` }
  }

  const job = jobs[jobIndex]

  // Set defer fields
  job.deferredAt = new Date().toISOString()
  job.deferredReason = reason.trim()

  if (reviewAfter) {
    job.reviewAfter = reviewAfter
  }

  // Add to notes
  const deferNote = reviewAfter
    ? `Deferred: ${reason.trim()} (review after ${reviewAfter})`
    : `Deferred: ${reason.trim()}`

  if (!job.notes) {
    job.notes = deferNote
  } else {
    job.notes = `${job.notes}\n${deferNote}`
  }

  // Add update entry
  if (!job.updates) {
    job.updates = []
  }
  job.updates.push({
    date: new Date().toISOString().split('T')[0],
    type: 'Deferred',
    notes: reason.trim()
  })

  // Persist changes
  writeJobsData(data)

  return {
    success: true,
    jobId,
    deferredUntil: reviewAfter || null,
    message: `Job deferred: ${reason.trim()}`
  }
}
