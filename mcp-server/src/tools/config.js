/**
 * Config MCP Tools
 *
 * Tools for managing fit configuration:
 * - getFitConfig: Get current fit criteria and weights
 * - updateFitConfig: Update fit criteria
 * - logJobOutcome: Log job outcome for evolution tracking
 */

import {
  loadFitConfig,
  updateFitCriteria,
  logOutcome
} from '../services/fit-config.js'

/**
 * Get current fit configuration
 *
 * Returns the fit criteria and weights used for scoring.
 * DISC-10: Fit criteria configurable and evolvable
 *
 * @returns {object} Current fit config
 */
export function getFitConfig() {
  const config = loadFitConfig()

  return {
    version: config.version,
    criteria: config.criteria,
    weights: config.weights,
    evolutionLogCount: config.evolutionLog?.length || 0,
    lastUpdated: config.updatedAt
  }
}

/**
 * Update fit criteria
 *
 * Allows updating specific criteria fields.
 * DISC-10: Fit criteria configurable and evolvable
 *
 * @param {object} params - Update parameters
 * @param {object} [params.titles] - Title matching criteria
 * @param {object} [params.industries] - Industry matching criteria
 * @param {object} [params.locations] - Location matching criteria
 * @param {number} [params.salaryMin] - Minimum salary threshold
 * @param {string} [params.reason] - Reason for the update (logged)
 * @returns {object} Update result
 */
export function updateFitConfig({ titles, industries, locations, salaryMin, reason }) {
  // Build updates object
  const updates = {}

  if (titles !== undefined) {
    updates.titles = titles
  }

  if (industries !== undefined) {
    updates.industries = industries
  }

  if (locations !== undefined) {
    updates.locations = locations
  }

  if (salaryMin !== undefined) {
    updates.salaryMin = salaryMin
  }

  // Check if any updates provided
  if (Object.keys(updates).length === 0) {
    return {
      success: false,
      error: 'No updates provided. Specify at least one of: titles, industries, locations, salaryMin'
    }
  }

  const result = updateFitCriteria(updates, reason)

  if (result.success) {
    return {
      success: true,
      message: `Updated fit criteria: ${Object.keys(updates).join(', ')}`,
      updatedFields: Object.keys(updates),
      newConfig: {
        criteria: result.config.criteria,
        weights: result.config.weights
      }
    }
  }

  return {
    success: false,
    error: result.error
  }
}

/**
 * Log job outcome for evolution tracking
 *
 * Records whether a job led to a positive/negative outcome.
 * Used to inform future fit criteria evolution.
 * DISC-10: Fit criteria evolvable based on outcomes
 *
 * @param {object} params - Outcome parameters
 * @param {number} params.jobId - Job ID
 * @param {string} params.outcome - 'positive' | 'negative' | 'neutral'
 * @param {number} params.fitScore - Fit score when assessed
 * @param {string} [params.notes] - Additional context
 * @returns {object} Result
 */
export function logJobOutcome({ jobId, outcome, fitScore, notes }) {
  const result = logOutcome({ jobId, outcome, fitScore, notes })

  if (result.success) {
    return {
      success: true,
      message: `Logged ${outcome} outcome for job ${jobId} (score: ${fitScore})`
    }
  }

  return {
    success: false,
    error: result.error
  }
}
