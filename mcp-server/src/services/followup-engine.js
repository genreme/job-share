/**
 * Follow-up Engine Service - Calculate follow-up timing and generate smart suggestions
 *
 * Provides time-based reminders based on days elapsed and application stage,
 * with context-aware suggestions that adapt to contacts and recent activity.
 *
 * APPL-05: Follow-up reminders trigger based on days elapsed and stage
 * APPL-06: Smart suggestions adapt based on time and stage context
 */

import { differenceInDays, parseISO } from 'date-fns'
import { loadJobsFromDashboard } from '../data/loader.js'

/**
 * Follow-up rules by status and days elapsed
 * Defines timing thresholds and suggested actions for each stage
 */
export const FOLLOWUP_RULES = {
  'applied': [
    { minDays: 7, maxDays: 13, priority: 'low', suggestion: 'Consider a brief check-in if you have a contact' },
    { minDays: 14, maxDays: 20, priority: 'medium', suggestion: 'Good time to follow up - reference your application date' },
    { minDays: 21, maxDays: null, priority: 'high', suggestion: 'Follow up now - restate interest and key qualifications' }
  ],
  'inbox': [
    { minDays: 3, maxDays: 6, priority: 'low', suggestion: 'Review and decide - apply or archive' },
    { minDays: 7, maxDays: null, priority: 'medium', suggestion: 'Job may become stale - decide soon' }
  ],
  'apply-now': [
    { minDays: 2, maxDays: 4, priority: 'medium', suggestion: 'Apply soon - this was marked high priority' },
    { minDays: 5, maxDays: null, priority: 'high', suggestion: 'Apply immediately or reconsider priority' }
  ],
  'maybe': [
    { minDays: 7, maxDays: 13, priority: 'low', suggestion: 'Review again - still interested?' },
    { minDays: 14, maxDays: null, priority: 'medium', suggestion: 'Decide: apply or archive' }
  ]
}

/**
 * Calculate follow-up status for a job
 * APPL-05: Trigger based on days elapsed and stage
 *
 * @param {object} job - Job data with status, applied, found, updates
 * @returns {object} Follow-up status with needsFollowup, priority, daysElapsed, etc.
 */
export function calculateFollowupStatus(job) {
  const now = new Date()

  // Determine reference date based on status
  let referenceDate = null
  let referenceEvent = null

  if (job.status === 'applied' && job.applied) {
    try {
      referenceDate = parseISO(job.applied)
      referenceEvent = 'application'
    } catch (e) {
      // Invalid date format
    }
  } else if (job.found) {
    try {
      referenceDate = parseISO(job.found)
      referenceEvent = 'found'
    } catch (e) {
      // Invalid date format
    }
  }

  if (!referenceDate || isNaN(referenceDate.getTime())) {
    return { needsFollowup: false, reason: 'No reference date available' }
  }

  const daysElapsed = differenceInDays(now, referenceDate)

  // Check for recent interview in updates (within 2 days) - special handling for thank-you
  const recentInterview = (job.updates || []).find(u => {
    if (!u.type?.toLowerCase().includes('interview')) return false

    const updateDate = u.timestamp || u.date
    if (!updateDate) return false

    try {
      const interviewDate = parseISO(updateDate)
      const daysSince = differenceInDays(now, interviewDate)
      return daysSince <= 2 && daysSince >= 0
    } catch (e) {
      return false
    }
  })

  if (recentInterview) {
    const updateDate = recentInterview.timestamp || recentInterview.date
    const interviewDate = parseISO(updateDate)
    const daysSinceInterview = differenceInDays(now, interviewDate)

    return {
      needsFollowup: true,
      priority: 'high',
      daysElapsed: daysSinceInterview,
      referenceEvent: 'interview',
      referenceDate: updateDate,
      suggestion: 'Send thank-you email within 24 hours'
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
 * Generate smart follow-up suggestions based on context
 * APPL-06: Suggestions adapt based on time and stage context
 *
 * @param {object} job - Job data with connections, status
 * @param {object} followupStatus - Result from calculateFollowupStatus
 * @returns {Array} Array of suggestions with type, text, priority, contactId
 */
export function generateFollowupSuggestion(job, followupStatus) {
  const suggestions = []

  // Base suggestion from rules
  if (followupStatus.suggestion) {
    suggestions.push({
      type: 'action',
      text: followupStatus.suggestion,
      priority: followupStatus.priority || 'medium'
    })
  }

  // Get structured contacts (filter out legacy string connections)
  const contacts = (job.connections || []).filter(c => typeof c === 'object')

  // Check for uncontacted primary contact
  const uncontactedPrimary = contacts.find(c => c.isPrimary && !c.reachedOut)

  if (uncontactedPrimary) {
    suggestions.push({
      type: 'contact',
      text: `Reach out to ${uncontactedPrimary.name} (${uncontactedPrimary.role})`,
      priority: 'high',
      contactId: uncontactedPrimary.id
    })
  }

  // Connection suggestions for applied jobs without contacts
  if (job.status === 'applied' && contacts.length === 0) {
    suggestions.push({
      type: 'research',
      text: 'Find a recruiter or hiring manager to follow up with',
      priority: 'medium'
    })
  }

  // Check for stale contacts (reached out but no interaction in >14 days)
  const now = new Date()
  const staleContacts = contacts.filter(c => {
    if (!c.lastInteraction?.date) return false
    if (!c.reachedOut) return false

    try {
      const lastDate = parseISO(c.lastInteraction.date)
      const daysSince = differenceInDays(now, lastDate)
      return daysSince > 14
    } catch (e) {
      return false
    }
  })

  if (staleContacts.length > 0) {
    const staleContact = staleContacts[0]
    const daysSince = differenceInDays(now, parseISO(staleContact.lastInteraction.date))

    suggestions.push({
      type: 'reconnect',
      text: `Re-engage with ${staleContact.name} - last contact ${daysSince} days ago`,
      priority: 'low',
      contactId: staleContact.id
    })
  }

  return suggestions
}

/**
 * Get prioritized follow-up queue
 *
 * @param {object} options - Options (limit: max items to return)
 * @returns {Array} Sorted array of jobs needing follow-up
 */
export function getFollowupQueue(options = { limit: 10 }) {
  const data = loadJobsFromDashboard()
  const queue = []

  for (const job of data.jobs || []) {
    // Skip archived and probably-not
    if (['archived', 'probably-not'].includes(job.status)) continue

    const followupStatus = calculateFollowupStatus(job)

    if (followupStatus.needsFollowup) {
      const suggestions = generateFollowupSuggestion(job, followupStatus)

      queue.push({
        jobId: job.id,
        title: job.title,
        company: job.company,
        status: job.status,
        priority: followupStatus.priority,
        daysElapsed: followupStatus.daysElapsed,
        referenceEvent: followupStatus.referenceEvent,
        suggestions
      })
    }
  }

  // Sort by priority (high > medium > low), then by daysElapsed descending
  const priorityOrder = { high: 0, medium: 1, low: 2 }

  queue.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    return b.daysElapsed - a.daysElapsed // More days = higher in queue
  })

  // Apply limit
  return queue.slice(0, options.limit)
}
