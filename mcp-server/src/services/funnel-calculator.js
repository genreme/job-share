/**
 * Funnel Calculator Service - Compute Sankey diagram data from jobs
 *
 * Provides aggregation functions for funnel visualization (ANLT-01).
 * Generates nodes and links for Sankey diagrams showing job pipeline flow.
 *
 * Per RESEARCH.md:
 * - Use JobStatusSchema values as node IDs
 * - Derive interviewing/offer stages from job.updates (not schema statuses)
 * - Use date-fns for date comparisons
 */

import { isWithinInterval, parseISO, isValid } from 'date-fns'
import { JobStatusSchema } from '../../../schemas/job.schema.js'

// Status display name mapping
export const STATUS_DISPLAY_NAMES = {
  'inbox': 'Inbox',
  'apply-now': 'Apply Now',
  'maybe': 'Maybe',
  'probably-not': 'Probably Not',
  'applied': 'Applied',
  'archived': 'Archived',
  'interviewing': 'Interviewing',
  'offer': 'Offer'
}

// Schema statuses from JobStatusSchema
const SCHEMA_STATUSES = ['inbox', 'apply-now', 'maybe', 'probably-not', 'applied', 'archived']

// Derived statuses (from job.updates analysis)
const DERIVED_STATUSES = ['interviewing', 'offer']

// Keywords indicating interview stage (case-insensitive)
const INTERVIEW_KEYWORDS = [
  'interview', 'phone screen', 'screening', 'call scheduled',
  'meeting', 'chat', 'conversation', 'assessment', 'technical'
]

// Keywords indicating offer stage (case-insensitive)
const OFFER_KEYWORDS = [
  'offer', 'offered', 'compensation', 'package', 'accepted',
  'negotiate', 'negotiation', 'salary discussion'
]

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
 * Check if job is within date range (using found date)
 *
 * @param {object} job - Job object
 * @param {object} dateRange - { start: Date, end: Date }
 * @returns {boolean} True if job is within range
 */
function isJobInDateRange(job, dateRange) {
  if (!dateRange || !dateRange.start || !dateRange.end) {
    return true // No date range filter
  }

  const foundDate = parseDate(job.found)
  if (!foundDate) {
    return false // Jobs without found date excluded when filtering by date
  }

  return isWithinInterval(foundDate, { start: dateRange.start, end: dateRange.end })
}

/**
 * Detect if job has reached interview stage from updates
 *
 * @param {object} job - Job object
 * @returns {boolean} True if job has interview indicators
 */
function hasInterviewIndicator(job) {
  if (!job.updates || !Array.isArray(job.updates)) {
    return false
  }

  return job.updates.some(update => {
    const text = [
      update.notes || '',
      update.text || '',
      update.type || ''
    ].join(' ').toLowerCase()

    return INTERVIEW_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()))
  })
}

/**
 * Detect if job has reached offer stage from updates
 *
 * @param {object} job - Job object
 * @returns {boolean} True if job has offer indicators
 */
function hasOfferIndicator(job) {
  if (!job.updates || !Array.isArray(job.updates)) {
    return false
  }

  return job.updates.some(update => {
    const text = [
      update.notes || '',
      update.text || '',
      update.type || ''
    ].join(' ').toLowerCase()

    return OFFER_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()))
  })
}

/**
 * Get the effective stage for a job (including derived stages)
 *
 * @param {object} job - Job object
 * @returns {string} Effective status including derived stages
 */
function getEffectiveStage(job) {
  // Check for derived stages first (they override base status)
  if (hasOfferIndicator(job)) {
    return 'offer'
  }
  if (hasInterviewIndicator(job)) {
    return 'interviewing'
  }
  // Return base status
  return job.status || 'inbox'
}

/**
 * Calculate funnel metrics for Sankey diagram
 *
 * @param {Array} jobs - Array of job objects
 * @param {object} [dateRange] - Optional { start: Date, end: Date }
 * @returns {{ nodes: Array, links: Array, totalJobs: number, dateRange: object|null }}
 */
export function calculateFunnelMetrics(jobs, dateRange = null) {
  if (!jobs || !Array.isArray(jobs)) {
    return {
      nodes: [],
      links: [],
      totalJobs: 0,
      dateRange: dateRange
    }
  }

  // Filter jobs by date range
  const filteredJobs = dateRange
    ? jobs.filter(job => isJobInDateRange(job, dateRange))
    : jobs

  if (filteredJobs.length === 0) {
    return {
      nodes: [],
      links: [],
      totalJobs: 0,
      dateRange: dateRange
    }
  }

  // Count jobs by effective stage
  const stageCounts = new Map()
  for (const job of filteredJobs) {
    const stage = getEffectiveStage(job)
    stageCounts.set(stage, (stageCounts.get(stage) || 0) + 1)
  }

  // Build nodes array (only include stages with jobs)
  const allStatuses = [...SCHEMA_STATUSES, ...DERIVED_STATUSES]
  const nodes = allStatuses
    .filter(status => stageCounts.has(status))
    .map(status => ({
      id: status,
      name: STATUS_DISPLAY_NAMES[status] || status,
      value: stageCounts.get(status)
    }))

  // Calculate flows
  const links = calculateFlows(filteredJobs)

  return {
    nodes,
    links,
    totalJobs: filteredJobs.length,
    dateRange: dateRange
  }
}

/**
 * Calculate stage transition flows from jobs
 *
 * Derives transitions from:
 * 1. job.updates array timestamps (if available)
 * 2. Status-specific date fields (found, applied)
 * 3. Current status as final state
 *
 * @param {Array} jobs - Array of job objects
 * @returns {Array<{ source: string, target: string, value: number }>}
 */
export function calculateFlows(jobs) {
  if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
    return []
  }

  const flowCounts = new Map() // "source->target" => count

  for (const job of jobs) {
    const transitions = deriveTransitions(job)
    for (const { source, target } of transitions) {
      const key = `${source}->${target}`
      flowCounts.set(key, (flowCounts.get(key) || 0) + 1)
    }
  }

  // Convert map to links array
  const links = []
  for (const [key, count] of flowCounts) {
    const [source, target] = key.split('->')
    links.push({ source, target, value: count })
  }

  // Sort by value (largest flows first)
  return links.sort((a, b) => b.value - a.value)
}

/**
 * Derive stage transitions for a single job
 *
 * @param {object} job - Job object
 * @returns {Array<{ source: string, target: string }>}
 */
function deriveTransitions(job) {
  const transitions = []
  const stages = []

  // 1. All jobs start in inbox
  stages.push({ stage: 'inbox', date: parseDate(job.found) || new Date(0) })

  // 2. Check for status-specific transitions
  // If job has applied date or status, it went through apply workflow
  if (job.applied || job.status === 'applied') {
    // Determine intermediate stage before applied
    if (job.status === 'apply-now' || hasApplyNowHistory(job)) {
      stages.push({ stage: 'apply-now', date: parseDate(job.found) || new Date(0) })
    } else if (job.status === 'maybe' || hasMaybeHistory(job)) {
      stages.push({ stage: 'maybe', date: parseDate(job.found) || new Date(0) })
    }
    stages.push({ stage: 'applied', date: parseDate(job.applied) || new Date(0) })
  }

  // 3. Check for derived stages from updates
  if (hasInterviewIndicator(job)) {
    stages.push({ stage: 'interviewing', date: getInterviewDate(job) || new Date(0) })
  }
  if (hasOfferIndicator(job)) {
    stages.push({ stage: 'offer', date: getOfferDate(job) || new Date(0) })
  }

  // 4. Add current status if not already represented
  const finalStage = job.status || 'inbox'
  if (!stages.some(s => s.stage === finalStage)) {
    // For triage statuses, add them as transitions from inbox
    if (['apply-now', 'maybe', 'probably-not', 'archived'].includes(finalStage)) {
      stages.push({ stage: finalStage, date: parseDate(job.found) || new Date(0) })
    }
  }

  // 5. Sort by date and create transitions
  stages.sort((a, b) => a.date - b.date)

  // Remove duplicates while preserving order
  const uniqueStages = []
  const seen = new Set()
  for (const s of stages) {
    if (!seen.has(s.stage)) {
      seen.add(s.stage)
      uniqueStages.push(s.stage)
    }
  }

  // Create transitions between consecutive stages
  for (let i = 0; i < uniqueStages.length - 1; i++) {
    transitions.push({
      source: uniqueStages[i],
      target: uniqueStages[i + 1]
    })
  }

  // If only one stage (no transitions), create a self-loop or entry from inbox
  if (transitions.length === 0 && uniqueStages.length === 1) {
    const stage = uniqueStages[0]
    if (stage !== 'inbox') {
      // Jobs in non-inbox status came from inbox
      transitions.push({ source: 'inbox', target: stage })
    }
    // Jobs currently in inbox have no transitions (they haven't moved yet)
  }

  return transitions
}

/**
 * Check if job has apply-now in update history
 */
function hasApplyNowHistory(job) {
  if (!job.updates || !Array.isArray(job.updates)) return false
  return job.updates.some(u =>
    (u.text || '').toLowerCase().includes('apply-now') ||
    (u.notes || '').toLowerCase().includes('apply-now') ||
    (u.type || '').toLowerCase().includes('apply-now')
  )
}

/**
 * Check if job has maybe in update history
 */
function hasMaybeHistory(job) {
  if (!job.updates || !Array.isArray(job.updates)) return false
  return job.updates.some(u =>
    (u.text || '').toLowerCase().includes('maybe') ||
    (u.notes || '').toLowerCase().includes('maybe') ||
    (u.type || '').toLowerCase().includes('maybe')
  )
}

/**
 * Get interview date from updates
 */
function getInterviewDate(job) {
  if (!job.updates || !Array.isArray(job.updates)) return null
  for (const update of job.updates) {
    const text = [update.notes || '', update.text || '', update.type || ''].join(' ').toLowerCase()
    if (INTERVIEW_KEYWORDS.some(kw => text.includes(kw.toLowerCase()))) {
      return parseDate(update.date) || parseDate(update.timestamp)
    }
  }
  return null
}

/**
 * Get offer date from updates
 */
function getOfferDate(job) {
  if (!job.updates || !Array.isArray(job.updates)) return null
  for (const update of job.updates) {
    const text = [update.notes || '', update.text || '', update.type || ''].join(' ').toLowerCase()
    if (OFFER_KEYWORDS.some(kw => text.includes(kw.toLowerCase()))) {
      return parseDate(update.date) || parseDate(update.timestamp)
    }
  }
  return null
}

/**
 * Get display name for a status
 *
 * @param {string} status - Status ID
 * @returns {string} Display name
 */
export function getStatusDisplayName(status) {
  return STATUS_DISPLAY_NAMES[status] || status
}
