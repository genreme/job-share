/**
 * Job Verifier Service
 *
 * Verifies job status via Cloudflare Worker and detects stale/closed positions (DISC-09).
 * Refreshes fit scores when job data changes during verification.
 */

import { loadJobsFromDashboard, writeJobsData } from '../data/loader.js'
import { calculateFitScore } from './fit-scorer.js'

// Timeout for Worker requests (30 seconds)
const WORKER_TIMEOUT = 30000

/**
 * Verify the status of a single job URL via Worker /status endpoint
 *
 * @param {string} url - Job URL to verify
 * @returns {Promise<{status: 'active'|'closed'|'uncertain', reason?: string, error?: string}>}
 */
export async function verifyJobStatus(url) {
  const workerUrl = process.env.JOB_VALIDATOR_URL

  if (!workerUrl) {
    return {
      status: 'uncertain',
      reason: 'Worker not configured',
      error: 'JOB_VALIDATOR_URL environment variable not set'
    }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), WORKER_TIMEOUT)

    const response = await fetch(`${workerUrl}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url] }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        status: 'uncertain',
        reason: 'Worker returned error',
        error: `HTTP ${response.status}: ${response.statusText}`
      }
    }

    const data = await response.json()

    // Worker returns array of results
    const result = data.results?.[0] || data[0]

    if (!result) {
      return {
        status: 'uncertain',
        reason: 'No result from Worker'
      }
    }

    return {
      status: result.status || 'uncertain',
      reason: result.reason || result.message,
      data: result.data // Any updated job data from Worker
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        status: 'uncertain',
        reason: 'Request timeout',
        error: `Worker request timed out after ${WORKER_TIMEOUT}ms`
      }
    }

    return {
      status: 'uncertain',
      reason: 'Network error',
      error: error.message
    }
  }
}

/**
 * Verify all active jobs and detect stale/closed positions
 * Refreshes fit scores when job data changes
 *
 * @returns {Promise<{
 *   checked: number,
 *   active: number,
 *   closed: number,
 *   uncertain: number,
 *   updated: number,
 *   closedJobs: Array<{id: string|number, title: string, company: string, reason: string}>,
 *   updatedJobs: Array<{id: string|number, title: string, newFitScore: number, oldFitScore: number}>,
 *   error?: string
 * }>}
 */
export async function verifyActiveJobs() {
  const workerUrl = process.env.JOB_VALIDATOR_URL

  if (!workerUrl) {
    return {
      checked: 0,
      active: 0,
      closed: 0,
      uncertain: 0,
      updated: 0,
      closedJobs: [],
      updatedJobs: [],
      error: 'Worker not configured (JOB_VALIDATOR_URL not set)'
    }
  }

  // Load current jobs
  const jobsData = loadJobsFromDashboard()
  const jobs = jobsData.jobs || []

  // Filter to active jobs (not archived, has URL)
  const activeJobs = jobs.filter(job =>
    job.status !== 'archived' &&
    job.status !== 'rejected' &&
    job.url &&
    typeof job.url === 'string' &&
    job.url.trim().length > 0
  )

  if (activeJobs.length === 0) {
    return {
      checked: 0,
      active: 0,
      closed: 0,
      uncertain: 0,
      updated: 0,
      closedJobs: [],
      updatedJobs: [],
      message: 'No active jobs with URLs to verify'
    }
  }

  // Batch verify via Worker
  const urls = activeJobs.map(j => j.url)

  let workerResults = []
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), WORKER_TIMEOUT)

    const response = await fetch(`${workerUrl}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      workerResults = data.results || data || []
    }
  } catch (error) {
    console.warn('Worker batch verify failed:', error.message)
    // Continue with empty results - all will be marked uncertain
  }

  // Create a map of URL -> result for easy lookup
  const resultMap = new Map()
  for (const result of workerResults) {
    if (result.url) {
      resultMap.set(result.url, result)
    }
  }

  // Track results
  const summary = {
    checked: activeJobs.length,
    active: 0,
    closed: 0,
    uncertain: 0,
    updated: 0,
    closedJobs: [],
    updatedJobs: []
  }

  let hasChanges = false

  // Process each active job
  for (const job of activeJobs) {
    const result = resultMap.get(job.url)
    const jobIndex = jobs.findIndex(j => j.id === job.id)

    if (!result) {
      summary.uncertain++
      continue
    }

    // Categorize by status
    const status = result.status || 'uncertain'

    if (status === 'active') {
      summary.active++
    } else if (status === 'closed') {
      summary.closed++
      summary.closedJobs.push({
        id: job.id,
        title: job.title || 'Untitled',
        company: job.company || 'Unknown',
        reason: result.reason || 'Position no longer available'
      })

      // Mark job as closed if not already
      if (job.status !== 'closed' && jobIndex >= 0) {
        jobs[jobIndex].status = 'closed'
        jobs[jobIndex].closedAt = new Date().toISOString()
        jobs[jobIndex].closedReason = result.reason || 'Detected during verification'
        hasChanges = true
      }
    } else {
      summary.uncertain++
    }

    // Check if job data changed (title, salary from Worker)
    const updatedData = result.data
    if (updatedData && jobIndex >= 0) {
      let dataChanged = false
      const oldJob = { ...jobs[jobIndex] }

      // Update fields if different
      if (updatedData.title && updatedData.title !== job.title) {
        jobs[jobIndex].title = updatedData.title
        dataChanged = true
      }
      if (updatedData.salary && updatedData.salary !== job.salary) {
        jobs[jobIndex].salary = updatedData.salary
        dataChanged = true
      }
      if (updatedData.company && updatedData.company !== job.company) {
        jobs[jobIndex].company = updatedData.company
        dataChanged = true
      }
      if (updatedData.location && updatedData.location !== job.location) {
        jobs[jobIndex].location = updatedData.location
        dataChanged = true
      }
      if (updatedData.description && updatedData.description !== job.description) {
        jobs[jobIndex].description = updatedData.description
        dataChanged = true
      }

      // Recalculate fit score if data changed
      if (dataChanged) {
        const oldScore = job.fitScore || 0
        const newScoreResult = calculateFitScore(jobs[jobIndex])
        const newScore = newScoreResult.score

        jobs[jobIndex].fitScore = newScore
        jobs[jobIndex].fitBreakdown = newScoreResult.breakdown
        jobs[jobIndex].verifiedAt = new Date().toISOString()

        summary.updated++
        summary.updatedJobs.push({
          id: job.id,
          title: jobs[jobIndex].title || job.title || 'Untitled',
          oldFitScore: oldScore,
          newFitScore: newScore
        })

        hasChanges = true
      }
    }
  }

  // Save changes if any
  if (hasChanges) {
    jobsData.jobs = jobs
    writeJobsData(jobsData)
  }

  return summary
}
