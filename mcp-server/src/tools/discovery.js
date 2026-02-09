/**
 * Discovery MCP Tools
 *
 * Tools for the discovery funnel workflow:
 * - get_existing_jobs: Check what jobs are already tracked (call FIRST before researching)
 * - research_job_url: Research a job posting URL
 * - add_job_manual: Add job with extracted data (for auth-required pages)
 * - get_inbox: Review inbox jobs for Claude to present
 * - confirm_job: Confirm job to dashboard with status
 * - defer_job: Defer job for later review
 * - get_friend_submissions: List friend-submitted jobs from Supabase
 * - process_friend_submission: Research a friend submission
 * - accept_friend_submission: Accept and add to dashboard
 */

import { loadJobsFromDashboard, writeJobsData } from '../data/loader.js'
import { calculateFitScore } from '../services/fit-scorer.js'
import { generateReasoning } from '../services/reasoning-generator.js'
import { getSupabaseClient, isSupabaseConfigured } from '../services/supabase-client.js'

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
 * Detect job board from URL
 * @param {string} url - Job URL
 * @returns {string} Board ID
 */
function detectBoardFromUrl(url) {
  if (!url) return 'unknown'
  const lower = url.toLowerCase()

  // Major job boards
  if (lower.includes('linkedin.com')) return 'linkedin'
  if (lower.includes('indeed.com')) return 'indeed'
  if (lower.includes('glassdoor.com')) return 'glassdoor'
  if (lower.includes('ziprecruiter.com')) return 'ziprecruiter'
  if (lower.includes('monster.com')) return 'monster'

  // ATS platforms (often direct-to-company)
  if (lower.includes('greenhouse.io') || lower.includes('boards.greenhouse')) return 'greenhouse'
  if (lower.includes('lever.co')) return 'lever'
  if (lower.includes('myworkday') || lower.includes('wd5.myworkday')) return 'workday'
  if (lower.includes('ashbyhq.com')) return 'ashby'
  if (lower.includes('smartrecruiters.com')) return 'smartrecruiters'
  if (lower.includes('icims.com')) return 'icims'
  if (lower.includes('jobvite.com')) return 'jobvite'
  if (lower.includes('taleo.net')) return 'taleo'
  if (lower.includes('breezy.hr')) return 'breezy'
  if (lower.includes('jazz.co') || lower.includes('applytojob.com')) return 'jazzhr'
  if (lower.includes('bamboohr.com')) return 'bamboohr'

  // Tech-specific
  if (lower.includes('angel.co') || lower.includes('wellfound.com')) return 'wellfound'
  if (lower.includes('builtin.com')) return 'builtin'
  if (lower.includes('dice.com')) return 'dice'
  if (lower.includes('hired.com')) return 'hired'

  // Company careers pages (generic detection)
  if (lower.includes('/careers') || lower.includes('/jobs') || lower.includes('jobs.')) {
    return 'company-direct'
  }

  return 'unknown'
}

/**
 * Check if URL is a direct company career page (not an aggregator)
 * @param {string} url - Job URL
 * @returns {boolean} True if URL is likely a company's own career site
 */
function isDirectCompanyUrl(url) {
  if (!url) return false
  const lower = url.toLowerCase()

  // ATS platforms are typically "direct" - they host company's actual job
  const directPlatforms = [
    'greenhouse.io', 'boards.greenhouse',
    'lever.co',
    'myworkday', 'wd5.myworkday',
    'ashbyhq.com',
    'smartrecruiters.com',
    'icims.com',
    'jobvite.com',
    'taleo.net',
    'breezy.hr',
    'jazz.co', 'applytojob.com',
    'bamboohr.com'
  ]

  // Check if URL is from a direct platform
  for (const platform of directPlatforms) {
    if (lower.includes(platform)) return true
  }

  // Aggregators are NOT direct
  const aggregators = [
    'linkedin.com',
    'indeed.com',
    'glassdoor.com',
    'ziprecruiter.com',
    'monster.com',
    'dice.com',
    'careerbuilder.com'
  ]

  for (const agg of aggregators) {
    if (lower.includes(agg)) return false
  }

  // If it has /careers or /jobs in the path and isn't an aggregator, likely direct
  if (lower.includes('/careers') || lower.includes('/jobs/')) {
    return true
  }

  return false
}

/**
 * Get existing jobs to avoid duplicates during research
 * Call this FIRST before browsing job boards so you know what to skip
 *
 * @returns {object} Summary of existing jobs with URLs and companies
 */
export function getExistingJobs() {
  const data = loadJobsFromDashboard()
  const jobs = data.jobs || []

  // Group by status
  const byStatus = {}
  jobs.forEach(job => {
    const status = job.status || 'unknown'
    if (!byStatus[status]) byStatus[status] = []
    byStatus[status].push({
      id: job.id,
      title: job.title,
      company: job.company,
      url: job.url
    })
  })

  // Extract just company names and URLs for quick duplicate checking
  const companies = [...new Set(jobs.map(j => j.company).filter(Boolean))]
  const urls = jobs.map(j => j.url).filter(Boolean)

  return {
    total: jobs.length,
    byStatus: Object.fromEntries(
      Object.entries(byStatus).map(([status, list]) => [status, list.length])
    ),
    companies,
    urls,
    jobs: jobs.map(j => ({
      id: j.id,
      title: j.title,
      company: j.company,
      status: j.status,
      url: j.url
    })),
    message: `You have ${jobs.length} jobs tracked. Skip any URLs in the 'urls' list and companies in the 'companies' list unless it's a different role.`
  }
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
    const isLinkedIn = url.includes('linkedin.com')
    const isAuthRequired = isLinkedIn || research.warnings.some(w =>
      w.includes('401') || w.includes('403') || w.includes('login') || w.includes('auth')
    )

    return {
      status: 'partial_research',
      requiresManualEntry: true,
      missingFields: ['title', 'company', 'description'],
      message: isAuthRequired
        ? 'This page requires authentication. Use add_job_manual instead - browse the page and extract the job details directly.'
        : 'Could not fetch job details automatically. Use add_job_manual with the job details you can see on the page.',
      url,
      notes,
      research,
      nextStep: 'Use add_job_manual tool with: title, company, url, and optionally location, salary, industry, description, notes',
      suggestedTool: 'add_job_manual',
      exampleCall: {
        tool: 'add_job_manual',
        params: {
          title: '[extract from page]',
          company: '[extract from page]',
          url: url,
          location: '[if visible]',
          description: '[job description text]'
        }
      }
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
 * Add a job manually with extracted data (bypasses URL fetching)
 * Use when Claude is browsing a job page and can extract data directly
 *
 * @param {object} params - Job data extracted from page
 * @param {string} params.title - Job title
 * @param {string} params.company - Company name
 * @param {string} params.url - Job posting URL
 * @param {string} [params.location] - Location
 * @param {string} [params.salary] - Salary range
 * @param {string} [params.industry] - Industry
 * @param {string} [params.description] - Job description
 * @param {string} [params.notes] - Notes about the job
 * @returns {object} Result with job ID and fit analysis
 */
export function addJobManual({ title, company, url, location, salary, industry, description, notes, sourceBoard, extractionQuality }) {
  // Validate required fields
  if (!title || typeof title !== 'string' || !title.trim()) {
    return { status: 'error', error: 'title is required' }
  }
  if (!company || typeof company !== 'string' || !company.trim()) {
    return { status: 'error', error: 'company is required' }
  }
  if (!url || !isValidUrl(url)) {
    return { status: 'error', error: 'Valid url is required' }
  }

  // Load current jobs
  const data = loadJobsFromDashboard()
  const jobs = data.jobs || []

  // Check for duplicate
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

  // Detect source board from URL if not provided
  const detectedBoard = sourceBoard || detectBoardFromUrl(url)

  // Create job object
  const jobData = {
    id: getNextJobId(jobs),
    title: title.trim(),
    company: company.trim(),
    location: location || '',
    salary: salary || '',
    industry: industry || '',
    description: description || '',
    url: url,
    found: new Date().toISOString().split('T')[0],
    status: 'inbox',
    notes: notes || '',
    updates: [],
    symbols: [],

    // Source tracking for board quality analysis
    sourceBoard: detectedBoard,
    sourceUrl: url,
    extractionQuality: extractionQuality || (title && company && location ? 'complete' : 'partial'),
    isDirectToCompany: isDirectCompanyUrl(url)
  }

  // Calculate fit score
  const fitResult = calculateFitScore(jobData)
  jobData.fitScore = fitResult.score
  jobData.fitBreakdown = fitResult.breakdown

  // Generate reasoning
  const reasoning = generateReasoning(jobData, fitResult)

  // Add to jobs array and save
  jobs.push(jobData)
  data.jobs = jobs
  writeJobsData(data)

  return {
    status: 'added_to_inbox',
    job: {
      id: jobData.id,
      title: jobData.title,
      company: jobData.company,
      location: jobData.location,
      salary: jobData.salary,
      fitScore: jobData.fitScore,
      url: jobData.url
    },
    reasoning: {
      score: reasoning.score,
      summary: reasoning.summary,
      whyIncluded: reasoning.whyIncluded,
      considerations: reasoning.considerations
    },
    message: `Added "${jobData.title}" at ${jobData.company} to inbox with fit score ${jobData.fitScore}`,
    nextStep: 'Review in inbox or call confirm_job to move to dashboard'
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

// =============================================================================
// Friend Submission Tools (DISC-07)
// =============================================================================

/**
 * Get pending friend submissions from Supabase
 * DISC-07: Friend submissions accessible via MCP tools
 *
 * @returns {object} List of pending submissions with friend context
 */
export async function getFriendSubmissions() {
  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    return {
      status: 'not_configured',
      error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.',
      submissions: [],
      count: 0
    }
  }

  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return {
        status: 'error',
        error: 'Failed to initialize Supabase client',
        submissions: [],
        count: 0
      }
    }
    const { data, error } = await supabase
      .from('job_submissions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      return {
        status: 'error',
        error: `Supabase query failed: ${error.message}`,
        submissions: [],
        count: 0
      }
    }

    // Map results to include friendContext object
    const submissions = (data || []).map(sub => ({
      id: sub.id,
      url: sub.job_url,
      createdAt: sub.created_at,
      friendContext: {
        submittedBy: sub.submitted_by,
        connection: sub.connection_notes,
        benefits: sub.benefits_notes,
        reasoning: sub.reasoning
      }
    }))

    return {
      status: 'success',
      count: submissions.length,
      submissions,
      message: submissions.length > 0
        ? `${submissions.length} friend submission(s) pending review`
        : 'No pending friend submissions'
    }
  } catch (e) {
    return {
      status: 'error',
      error: `Unexpected error: ${e.message}`,
      submissions: [],
      count: 0
    }
  }
}

/**
 * Process a friend submission by researching the URL
 * DISC-07a: Friend context captured and combined with research
 *
 * @param {object} params - Tool parameters
 * @param {string} params.submissionId - ID of the submission to process
 * @returns {object} Research result combined with friend context
 */
export async function processFriendSubmission({ submissionId }) {
  // Validate required parameter
  if (!submissionId) {
    return {
      status: 'error',
      error: 'submissionId is required'
    }
  }

  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    return {
      status: 'not_configured',
      error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.'
    }
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return {
      status: 'error',
      error: 'Failed to initialize Supabase client'
    }
  }

  try {
    // Fetch submission from Supabase
    const { data: submission, error } = await supabase
      .from('job_submissions')
      .select('*')
      .eq('id', submissionId)
      .single()

    if (error || !submission) {
      return {
        status: 'error',
        error: `Submission not found: ${error?.message || 'No data returned'}`
      }
    }

    // Build friend context
    const friendContext = {
      submittedBy: submission.submitted_by,
      connection: submission.connection_notes,
      benefits: submission.benefits_notes,
      reasoning: submission.reasoning
    }

    // Research the job URL
    const researchResult = await researchJobUrl({
      url: submission.job_url,
      notes: `Friend submission from ${submission.submitted_by}`
    })

    // Combine research with friend context
    return {
      status: researchResult.status,
      submissionId,
      friendContext,
      research: researchResult,
      nextStep: researchResult.status === 'ready_for_review'
        ? 'Call accept_friend_submission to add to dashboard with friend context preserved'
        : researchResult.status === 'duplicate'
          ? 'This job already exists in your system'
          : 'Review research result and decide next action'
    }
  } catch (e) {
    return {
      status: 'error',
      error: `Unexpected error: ${e.message}`
    }
  }
}

/**
 * Accept a friend submission and add to dashboard
 * DISC-07b: Friend context preserved in job data
 *
 * @param {object} params - Tool parameters
 * @param {string} params.submissionId - ID of the submission to accept
 * @param {string} params.status - Target status (apply-now, maybe, probably-not)
 * @param {string} [params.notes] - Additional notes
 * @returns {object} Result with job data and friend context
 */
export async function acceptFriendSubmission({ submissionId, status, notes }) {
  // Validate required parameters
  if (!submissionId) {
    return { success: false, error: 'submissionId is required' }
  }

  const validStatuses = ['apply-now', 'maybe', 'probably-not']
  if (!status || !validStatuses.includes(status)) {
    return {
      success: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    }
  }

  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.'
    }
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return { success: false, error: 'Failed to initialize Supabase client' }
  }

  try {
    // Fetch submission from Supabase
    const { data: submission, error: fetchError } = await supabase
      .from('job_submissions')
      .select('*')
      .eq('id', submissionId)
      .single()

    if (fetchError || !submission) {
      return {
        success: false,
        error: `Submission not found: ${fetchError?.message || 'No data returned'}`
      }
    }

    // Load current jobs data
    const data = loadJobsFromDashboard()
    const jobs = data.jobs || []

    // Check for duplicate by URL
    const existingJob = findDuplicateByUrl(submission.job_url, jobs)
    if (existingJob) {
      return {
        success: false,
        error: 'duplicate',
        existingJob: {
          id: existingJob.id,
          title: existingJob.title,
          company: existingJob.company,
          status: existingJob.status
        },
        message: `This job already exists in your ${existingJob.status} list`
      }
    }

    // Build friend context
    const friendContext = {
      submittedBy: submission.submitted_by,
      connection: submission.connection_notes,
      benefits: submission.benefits_notes,
      reasoning: submission.reasoning
    }

    // Build notes with friend context
    const friendNotes = [
      `Friend submission from ${submission.submitted_by}`,
      submission.reasoning ? `Reason: ${submission.reasoning}` : null,
      notes
    ].filter(Boolean).join('\n')

    // Create new job entry
    const newJob = {
      id: getNextJobId(jobs),
      title: submission.job_title || 'Unknown Title',
      company: submission.company_name || 'Unknown Company',
      location: '',
      salary: '',
      industry: '',
      description: '',
      url: submission.job_url,
      found: new Date().toISOString().split('T')[0],
      status: status,
      source: 'friend-submission',
      notes: friendNotes,
      friendContext: friendContext,
      updates: [{
        date: new Date().toISOString().split('T')[0],
        type: 'Friend Submission',
        notes: `Submitted by ${submission.submitted_by}${submission.reasoning ? ': ' + submission.reasoning : ''}`
      }],
      symbols: []
    }

    // Add to jobs array
    jobs.push(newJob)
    data.jobs = jobs

    // Persist to jobs.json
    writeJobsData(data)

    // Update Supabase status to accepted
    const { error: updateError } = await supabase
      .from('job_submissions')
      .update({ status: 'accepted', processed_at: new Date().toISOString() })
      .eq('id', submissionId)

    if (updateError) {
      console.warn(`Warning: Job added but Supabase status update failed: ${updateError.message}`)
    }

    return {
      success: true,
      job: {
        id: newJob.id,
        title: newJob.title,
        company: newJob.company,
        status: newJob.status,
        url: newJob.url
      },
      friendContext,
      message: `Job from ${submission.submitted_by} added to ${status} list`
    }
  } catch (e) {
    return {
      success: false,
      error: `Unexpected error: ${e.message}`
    }
  }
}
