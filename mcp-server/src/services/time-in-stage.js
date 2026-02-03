/**
 * Time-in-Stage Service - Track time metrics and bottleneck detection
 *
 * Provides time-based analytics for job pipeline stages (ANLT-05).
 * Calculates average days, median, and percentiles for each stage.
 * Identifies bottleneck stages exceeding configurable thresholds.
 *
 * Uses date-fns for all date calculations per RESEARCH.md Pitfall 4.
 */

import { parseISO, isValid, differenceInDays } from 'date-fns'

// Default bottleneck threshold in days
const DEFAULT_BOTTLENECK_THRESHOLD = 7

// Stage recommendations for bottleneck detection
const STAGE_RECOMMENDATIONS = {
  'inbox': 'Consider reviewing inbox jobs more frequently',
  'apply-now': 'Jobs flagged as apply-now may need follow-through',
  'maybe': 'Review maybe jobs periodically to decide on application',
  'probably-not': 'Archive or reconsider probably-not jobs to keep pipeline clean',
  'applied': 'Long wait after applying is normal; consider follow-up',
  'archived': 'Archived jobs have completed their lifecycle'
}

// Keywords for detecting stage transitions in updates
const STAGE_KEYWORDS = {
  'interview': ['interview', 'phone screen', 'screening', 'call scheduled', 'meeting', 'assessment'],
  'response': ['response', 'replied', 'heard back', 'got back', 'reached out'],
  'offer': ['offer', 'offered', 'compensation', 'package']
}

/**
 * Parse a date string safely
 *
 * @param {string|null|undefined} dateStr - Date string to parse
 * @returns {Date|null} Parsed Date or null if invalid
 */
function parseDate(dateStr) {
  if (!dateStr) return null
  try {
    const parsed = parseISO(dateStr)
    return isValid(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Calculate percentile from sorted array
 * Implements linear interpolation for percentile calculation
 *
 * @param {number[]} sortedArr - Sorted array of numbers
 * @param {number} p - Percentile (0-100)
 * @returns {number} Percentile value
 */
function percentile(sortedArr, p) {
  if (!sortedArr || sortedArr.length === 0) return 0
  if (sortedArr.length === 1) return sortedArr[0]

  const idx = (p / 100) * (sortedArr.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)

  if (lower === upper) return sortedArr[lower]

  // Linear interpolation
  return sortedArr[lower] + (idx - lower) * (sortedArr[upper] - sortedArr[lower])
}

/**
 * Calculate median from array
 *
 * @param {number[]} arr - Array of numbers
 * @returns {number} Median value
 */
function median(arr) {
  if (!arr || arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  return percentile(sorted, 50)
}

/**
 * Calculate average from array
 *
 * @param {number[]} arr - Array of numbers
 * @returns {number} Average value
 */
function average(arr) {
  if (!arr || arr.length === 0) return 0
  return arr.reduce((sum, val) => sum + val, 0) / arr.length
}

/**
 * Get entry date for a job in a specific status
 *
 * @param {object} job - Job object
 * @param {string} status - Status to check
 * @returns {Date|null} Entry date or null
 */
function getStageEntryDate(job, status) {
  // For inbox, use found date
  if (status === 'inbox') {
    return parseDate(job.found)
  }

  // For applied, use applied date
  if (status === 'applied') {
    return parseDate(job.applied)
  }

  // For other statuses, try to find from updates
  if (job.updates && Array.isArray(job.updates)) {
    for (const update of job.updates) {
      const text = [
        update.notes || '',
        update.text || '',
        update.type || ''
      ].join(' ').toLowerCase()

      if (text.includes(status) || text.includes(status.replace('-', ' '))) {
        return parseDate(update.date) || parseDate(update.timestamp)
      }
    }
  }

  // Fallback to found date
  return parseDate(job.found)
}

/**
 * Get exit date for a job from a specific status
 *
 * @param {object} job - Job object
 * @param {string} status - Status being exited
 * @param {Date} now - Current date for ongoing calculations
 * @returns {{ date: Date, ongoing: boolean }}
 */
function getStageExitDate(job, status, now) {
  // If job is currently in this status, use now (ongoing)
  if (job.status === status) {
    return { date: now, ongoing: true }
  }

  // For inbox, exit is when moved to any other status (use applied or found + assumed time)
  if (status === 'inbox') {
    // If applied, that's when it left inbox
    const appliedDate = parseDate(job.applied)
    if (appliedDate) {
      return { date: appliedDate, ongoing: false }
    }

    // Otherwise check updates for status changes
    if (job.updates && Array.isArray(job.updates)) {
      for (const update of job.updates) {
        const date = parseDate(update.date) || parseDate(update.timestamp)
        if (date) {
          return { date, ongoing: false }
        }
      }
    }

    // Fallback: assume it left inbox same day as found if status is not inbox
    if (job.status !== 'inbox') {
      const foundDate = parseDate(job.found)
      if (foundDate) {
        return { date: foundDate, ongoing: false }
      }
    }
  }

  // For applied, exit is first response
  if (status === 'applied') {
    if (job.updates && Array.isArray(job.updates)) {
      for (const update of job.updates) {
        const text = [
          update.notes || '',
          update.text || '',
          update.type || ''
        ].join(' ').toLowerCase()

        // Check for response indicators
        const isResponse = STAGE_KEYWORDS.response.some(kw => text.includes(kw)) ||
                          STAGE_KEYWORDS.interview.some(kw => text.includes(kw)) ||
                          STAGE_KEYWORDS.offer.some(kw => text.includes(kw)) ||
                          text.includes('reject') ||
                          text.includes('unfortunately')

        if (isResponse) {
          const date = parseDate(update.date) || parseDate(update.timestamp)
          if (date) {
            return { date, ongoing: false }
          }
        }
      }
    }
  }

  // If we can't determine exit, assume ongoing
  return { date: now, ongoing: true }
}

/**
 * Calculate time spent in a specific status for all jobs
 *
 * @param {Array} jobs - Array of job objects
 * @param {string} status - Status to analyze
 * @returns {{ status: string, averageDays: number, medianDays: number, percentiles: { p25: number, p50: number, p75: number, p90: number }, sampleSize: number, ongoing: number }}
 */
export function calculateTimeInStage(jobs, status) {
  const now = new Date()

  if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
    return {
      status,
      averageDays: 0,
      medianDays: 0,
      percentiles: { p25: 0, p50: 0, p75: 0, p90: 0 },
      sampleSize: 0,
      ongoing: 0
    }
  }

  // Filter jobs that are or were in this status
  const relevantJobs = jobs.filter(job => {
    // Currently in status
    if (job.status === status) return true

    // Was in status (for inbox, all jobs pass through)
    if (status === 'inbox') return true

    // For applied, check if job has applied date or status
    if (status === 'applied') {
      return job.status === 'applied' || !!job.applied
    }

    // For triage statuses, only include if current status
    return job.status === status
  })

  if (relevantJobs.length === 0) {
    return {
      status,
      averageDays: 0,
      medianDays: 0,
      percentiles: { p25: 0, p50: 0, p75: 0, p90: 0 },
      sampleSize: 0,
      ongoing: 0
    }
  }

  const durations = []
  let ongoingCount = 0

  for (const job of relevantJobs) {
    const entryDate = getStageEntryDate(job, status)
    if (!entryDate) continue

    const { date: exitDate, ongoing } = getStageExitDate(job, status, now)

    const days = differenceInDays(exitDate, entryDate)
    if (days >= 0) {
      durations.push(days)
      if (ongoing) ongoingCount++
    }
  }

  if (durations.length === 0) {
    return {
      status,
      averageDays: 0,
      medianDays: 0,
      percentiles: { p25: 0, p50: 0, p75: 0, p90: 0 },
      sampleSize: 0,
      ongoing: 0
    }
  }

  // Sort for percentile calculations
  const sorted = [...durations].sort((a, b) => a - b)

  return {
    status,
    averageDays: Math.round(average(durations) * 10) / 10,
    medianDays: Math.round(median(durations) * 10) / 10,
    percentiles: {
      p25: Math.round(percentile(sorted, 25) * 10) / 10,
      p50: Math.round(percentile(sorted, 50) * 10) / 10,
      p75: Math.round(percentile(sorted, 75) * 10) / 10,
      p90: Math.round(percentile(sorted, 90) * 10) / 10
    },
    sampleSize: durations.length,
    ongoing: ongoingCount
  }
}

/**
 * Calculate time to first response (from applied to any response)
 *
 * @param {Array} jobs - Array of job objects
 * @returns {{ averageDays: number, medianDays: number, percentiles: { p25: number, p50: number, p75: number, p80: number, p90: number }, sampleSize: number, display: string }}
 */
export function calculateTimeToResponse(jobs) {
  if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
    return {
      averageDays: 0,
      medianDays: 0,
      percentiles: { p25: 0, p50: 0, p75: 0, p80: 0, p90: 0 },
      sampleSize: 0,
      display: 'No data'
    }
  }

  const durations = []

  for (const job of jobs) {
    // Only consider jobs that have been applied to
    if (job.status !== 'applied' && !job.applied) continue

    const appliedDate = parseDate(job.applied)
    if (!appliedDate) continue

    // Find first response in updates
    let responseDate = null
    if (job.updates && Array.isArray(job.updates)) {
      for (const update of job.updates) {
        const text = [
          update.notes || '',
          update.text || '',
          update.type || ''
        ].join(' ').toLowerCase()

        // Check for response indicators
        const isResponse = STAGE_KEYWORDS.response.some(kw => text.includes(kw)) ||
                          STAGE_KEYWORDS.interview.some(kw => text.includes(kw)) ||
                          STAGE_KEYWORDS.offer.some(kw => text.includes(kw)) ||
                          text.includes('reject') ||
                          text.includes('unfortunately') ||
                          text.includes('not moving forward')

        if (isResponse) {
          const date = parseDate(update.date) || parseDate(update.timestamp)
          if (date) {
            responseDate = date
            break
          }
        }
      }
    }

    if (responseDate) {
      const days = differenceInDays(responseDate, appliedDate)
      if (days >= 0) {
        durations.push(days)
      }
    }
  }

  if (durations.length === 0) {
    return {
      averageDays: 0,
      medianDays: 0,
      percentiles: { p25: 0, p50: 0, p75: 0, p80: 0, p90: 0 },
      sampleSize: 0,
      display: 'No responses recorded'
    }
  }

  // Sort for percentile calculations
  const sorted = [...durations].sort((a, b) => a - b)

  const avgDays = Math.round(average(durations) * 10) / 10
  const p80Days = Math.round(percentile(sorted, 80) * 10) / 10

  // Display format per CONTEXT.md: "7 days avg, 80% within 14 days"
  const display = `${avgDays} days avg, 80% within ${p80Days} days`

  return {
    averageDays: avgDays,
    medianDays: Math.round(median(durations) * 10) / 10,
    percentiles: {
      p25: Math.round(percentile(sorted, 25) * 10) / 10,
      p50: Math.round(percentile(sorted, 50) * 10) / 10,
      p75: Math.round(percentile(sorted, 75) * 10) / 10,
      p80: Math.round(percentile(sorted, 80) * 10) / 10,
      p90: Math.round(percentile(sorted, 90) * 10) / 10
    },
    sampleSize: durations.length,
    display
  }
}

/**
 * Identify bottleneck stages exceeding threshold
 *
 * @param {Array} jobs - Array of job objects
 * @param {number} threshold - Threshold in days (default 7)
 * @returns {Array<{ status: string, averageDays: number, recommendation: string }>}
 */
export function identifyBottlenecks(jobs, threshold = DEFAULT_BOTTLENECK_THRESHOLD) {
  if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
    return []
  }

  const statuses = ['inbox', 'apply-now', 'maybe', 'probably-not', 'applied']
  const bottlenecks = []

  for (const status of statuses) {
    const metrics = calculateTimeInStage(jobs, status)

    if (metrics.sampleSize > 0 && metrics.averageDays > threshold) {
      bottlenecks.push({
        status,
        averageDays: metrics.averageDays,
        recommendation: STAGE_RECOMMENDATIONS[status] || 'Review this stage for optimization'
      })
    }
  }

  // Sort by average days descending (worst bottlenecks first)
  bottlenecks.sort((a, b) => b.averageDays - a.averageDays)

  return bottlenecks
}

/**
 * Calculate time metrics for all stages
 *
 * @param {Array} jobs - Array of job objects
 * @returns {Array<{ status: string, averageDays: number, medianDays: number, percentiles: object, sampleSize: number, ongoing: number }>}
 */
export function calculateAllStageMetrics(jobs) {
  const statuses = ['inbox', 'apply-now', 'maybe', 'probably-not', 'applied', 'archived']

  return statuses.map(status => calculateTimeInStage(jobs, status))
    .filter(metrics => metrics.sampleSize > 0)
}
