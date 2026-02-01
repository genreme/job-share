/**
 * Follow-up Management MCP Tools
 *
 * Tools for managing follow-ups, getting prioritized queues, and
 * checking follow-up status for specific jobs.
 *
 * APPL-05: Reminders trigger based on days elapsed and stage
 * APPL-06: Smart suggestions based on time and stage context
 */

import {
  getFollowupQueue,
  calculateFollowupStatus,
  generateFollowupSuggestion
} from '../services/followup-engine.js'
import { loadJobsFromDashboard } from '../data/loader.js'

/**
 * Get prioritized follow-up queue
 * Returns jobs that need follow-up, sorted by priority
 *
 * @param {object} options - { limit?: number } - Max items to return (default 10)
 * @returns {object} { count, showing, followups: Array }
 */
export function getFollowups({ limit = 10 } = {}) {
  const queue = getFollowupQueue({ limit })

  return {
    count: queue.length,
    showing: Math.min(queue.length, limit),
    followups: queue.map(item => ({
      jobId: item.jobId,
      title: item.title,
      company: item.company,
      status: item.status,
      priority: item.priority,
      daysElapsed: item.daysElapsed,
      referenceEvent: item.referenceEvent,
      primarySuggestion: item.suggestions?.[0]?.text || null,
      allSuggestions: item.suggestions || []
    }))
  }
}

/**
 * Get follow-up status for a specific job
 * Returns detailed follow-up information and suggestions
 *
 * @param {number} jobId - The job ID
 * @returns {object} Job follow-up status with suggestions and contacts
 */
export function getJobFollowupStatus(jobId) {
  const data = loadJobsFromDashboard()
  const job = data.jobs?.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job with ID ${jobId} not found` }
  }

  const status = calculateFollowupStatus(job)
  const suggestions = generateFollowupSuggestion(job, status)

  // Get structured contacts with simplified view
  const contacts = (job.connections || [])
    .filter(c => typeof c === 'object')
    .map(c => ({
      name: c.name,
      role: c.role,
      reachedOut: c.reachedOut || false,
      lastInteractionDate: c.lastInteraction?.date || null
    }))

  return {
    jobId,
    title: job.title,
    company: job.company,
    currentStatus: job.status,
    followup: {
      needsFollowup: status.needsFollowup,
      priority: status.priority,
      daysElapsed: status.daysElapsed,
      referenceEvent: status.referenceEvent,
      referenceDate: status.referenceDate,
      suggestion: status.suggestion,
      reason: status.reason,
      suggestions
    },
    contacts
  }
}

/**
 * Get summary of all follow-up needs
 * Returns aggregated stats and top priority items
 *
 * @returns {object} Summary with counts, breakdown, and top actions
 */
export function getFollowupSummary() {
  // Get full queue (high limit to get all)
  const queue = getFollowupQueue({ limit: 1000 })

  // Calculate by priority
  const byPriority = {
    high: queue.filter(q => q.priority === 'high').length,
    medium: queue.filter(q => q.priority === 'medium').length,
    low: queue.filter(q => q.priority === 'low').length
  }

  // Calculate by status
  const byStatus = {}
  for (const item of queue) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1
  }

  // Get top 3 priority items
  const topActions = queue.slice(0, 3).map(item => ({
    job: `${item.title} at ${item.company}`,
    action: item.suggestions?.[0]?.text || 'Review needed',
    priority: item.priority
  }))

  // Generate summary text
  let summary
  if (byPriority.high > 0) {
    summary = `${byPriority.high} high priority follow-up${byPriority.high > 1 ? 's' : ''} needed`
  } else if (byPriority.medium > 0) {
    summary = `${byPriority.medium} medium priority item${byPriority.medium > 1 ? 's' : ''}`
  } else if (byPriority.low > 0) {
    summary = `${byPriority.low} low priority item${byPriority.low > 1 ? 's' : ''}`
  } else {
    summary = 'No urgent follow-ups'
  }

  return {
    totalNeedingFollowup: queue.length,
    byPriority,
    byStatus,
    topActions,
    summary
  }
}
