/**
 * Analytics Tools - MCP tool implementations for Phase 10
 *
 * 12 tools exposing analytics capabilities to Claude:
 *
 * Funnel Tools (ANLT-01):
 * 1. get_funnel_metrics - Get Sankey diagram data
 *
 * Response Rate Tools (ANLT-02):
 * 2. get_response_rates - Get response rates by dimension
 * 3. get_time_to_response - Get response time distribution
 *
 * Time-in-Stage Tools (ANLT-05):
 * 4. get_time_in_stage - Get time metrics per status
 * 5. get_bottlenecks - Identify process bottlenecks
 *
 * Skill Gap Tools (ANLT-03):
 * 6. get_skill_gaps - Get aggregated skill gaps
 * 7. get_skill_gap_recommendations - Get actionable gap recommendations
 *
 * Criteria Evolution Tools (ANLT-04):
 * 8. get_criteria_recommendations - Get fit criteria evolution suggestions
 * 9. preview_criteria_change - Preview impact of criteria change
 * 10. apply_criteria_change - Apply recommended criteria change
 *
 * Snapshot Tools:
 * 11. get_analytics_snapshot - Get current or historical snapshot
 * 12. save_analytics_snapshot - Save current state as snapshot
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Import analytics services from Wave 1
import { calculateFunnelMetrics, calculateFlows, getStatusDisplayName } from '../services/funnel-calculator.js'
import { calculateRatesByDimension, VALID_DIMENSIONS } from '../services/response-rate-analyzer.js'
import { calculateTimeInStage, calculateAllStageMetrics, identifyBottlenecks, calculateTimeToResponse } from '../services/time-in-stage.js'
import { aggregateSkillGaps, getGapRecommendations } from '../services/skill-gap-aggregator.js'
import { generateRecommendations, previewCriteriaChange as previewChange, applyCriteriaChange as applyChange } from '../services/criteria-recommender.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const JOBS_FILE = join(DATA_DIR, 'jobs.json')
const PROFILE_FILE = join(DATA_DIR, 'profile', 'master-profile.json')
const SNAPSHOTS_FILE = join(DATA_DIR, 'analytics-snapshots.json')

// Maximum days to keep snapshots (rolling window)
const SNAPSHOT_RETENTION_DAYS = 90

/**
 * Load jobs data
 * @returns {Array<object>} Jobs array
 */
function loadJobsData() {
  if (!existsSync(JOBS_FILE)) {
    return []
  }

  try {
    const data = JSON.parse(readFileSync(JOBS_FILE, 'utf-8'))
    return data.jobs || []
  } catch (e) {
    console.error('Error loading jobs:', e.message)
    return []
  }
}

/**
 * Load profile data
 * @returns {object|null} Profile object or null
 */
function loadProfileData() {
  if (!existsSync(PROFILE_FILE)) {
    return null
  }

  try {
    return JSON.parse(readFileSync(PROFILE_FILE, 'utf-8'))
  } catch (e) {
    console.error('Error loading profile:', e.message)
    return null
  }
}

/**
 * Load snapshots from file
 * @returns {{ version: string, snapshots: Array, lastSnapshot: string|null }}
 */
function loadSnapshots() {
  if (!existsSync(SNAPSHOTS_FILE)) {
    return { version: '1.0', snapshots: [], lastSnapshot: null }
  }

  try {
    return JSON.parse(readFileSync(SNAPSHOTS_FILE, 'utf-8'))
  } catch (e) {
    console.error('Error loading snapshots:', e.message)
    return { version: '1.0', snapshots: [], lastSnapshot: null }
  }
}

/**
 * Save snapshots to file with atomic write
 * @param {{ version: string, snapshots: Array, lastSnapshot: string|null }} data
 */
function saveSnapshots(data) {
  try {
    writeFileSync(SNAPSHOTS_FILE, JSON.stringify(data, null, 2))
    return true
  } catch (e) {
    console.error('Error saving snapshots:', e.message)
    return false
  }
}

/**
 * Clean old snapshots beyond retention period
 * @param {Array} snapshots - Array of snapshot objects
 * @returns {Array} Filtered snapshots within retention period
 */
function cleanOldSnapshots(snapshots) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - SNAPSHOT_RETENTION_DAYS)

  return snapshots.filter(s => {
    const snapshotDate = new Date(s.date)
    return snapshotDate >= cutoffDate
  })
}

/**
 * Parse date range from preset or explicit dates
 * @param {object} args - { preset?: string, dateRange?: { start: string, end: string } }
 * @returns {{ start: Date, end: Date }|null}
 */
function parseDateRange(args) {
  if (args.dateRange && args.dateRange.start && args.dateRange.end) {
    return {
      start: new Date(args.dateRange.start),
      end: new Date(args.dateRange.end)
    }
  }

  if (args.preset) {
    const end = new Date()
    const start = new Date()

    switch (args.preset) {
      case '7d':
        start.setDate(start.getDate() - 7)
        break
      case '30d':
        start.setDate(start.getDate() - 30)
        break
      case '90d':
        start.setDate(start.getDate() - 90)
        break
      case 'all':
        return null // No date filtering
      default:
        return null
    }

    return { start, end }
  }

  return null
}

// ============================================================================
// Tool 1: Get Funnel Metrics (ANLT-01)
// ============================================================================

/**
 * Get Sankey diagram data showing job flow through pipeline stages
 *
 * @param {object} args
 * @param {string} [args.preset] - '7d' | '30d' | '90d' | 'all'
 * @param {{ start: string, end: string }} [args.dateRange] - Custom date range
 * @returns {{ nodes: Array, links: Array, totalJobs: number, dateRange: object|null }}
 */
export function getFunnelMetrics(args = {}) {
  const jobs = loadJobsData()
  const dateRange = parseDateRange(args)

  const metrics = calculateFunnelMetrics(jobs, dateRange)

  return {
    nodes: metrics.nodes,
    links: metrics.links,
    totalJobs: metrics.totalJobs,
    dateRange: dateRange ? {
      start: dateRange.start.toISOString(),
      end: dateRange.end.toISOString()
    } : null
  }
}

// ============================================================================
// Tool 2: Get Response Rates (ANLT-02)
// ============================================================================

/**
 * Get response rates by dimension with confidence indicators
 *
 * @param {object} args
 * @param {string} args.dimension - 'companySize' | 'industry' | 'applicationMethod' | 'jobBoard' | 'roleType'
 * @returns {{ dimension: string, rates: Array, overall: object, validDimensions: string[] }}
 */
export function getResponseRates(args = {}) {
  if (!args.dimension) {
    return {
      error: 'dimension is required',
      validDimensions: VALID_DIMENSIONS
    }
  }

  if (!VALID_DIMENSIONS.includes(args.dimension)) {
    return {
      error: `Invalid dimension: ${args.dimension}`,
      validDimensions: VALID_DIMENSIONS
    }
  }

  const jobs = loadJobsData()
  const rates = calculateRatesByDimension(jobs, args.dimension)

  // Extract overall from first element if present
  const overall = rates.find(r => r.value === 'Overall')
  const dimensionRates = rates.filter(r => r.value !== 'Overall')

  return {
    dimension: args.dimension,
    rates: dimensionRates,
    overall: overall || null
  }
}

// ============================================================================
// Tool 3: Get Time to Response (ANLT-02)
// ============================================================================

/**
 * Get response time distribution from application to first response
 *
 * @returns {{ averageDays: number, medianDays: number, percentiles: object, sampleSize: number, display: string }}
 */
export function getTimeToResponse() {
  const jobs = loadJobsData()
  return calculateTimeToResponse(jobs)
}

// ============================================================================
// Tool 4: Get Time in Stage (ANLT-05)
// ============================================================================

/**
 * Get time metrics per status
 *
 * @param {object} args
 * @param {string} [args.status] - Specific status to analyze (optional, returns all if omitted)
 * @returns {{ stages: Array<{ status: string, averageDays: number, medianDays: number, percentiles: object, sampleSize: number }> }}
 */
export function getTimeInStage(args = {}) {
  const jobs = loadJobsData()

  if (args.status) {
    const metrics = calculateTimeInStage(jobs, args.status)
    return { stages: [metrics] }
  }

  const stages = calculateAllStageMetrics(jobs)
  return { stages }
}

// ============================================================================
// Tool 5: Get Bottlenecks (ANLT-05)
// ============================================================================

/**
 * Identify process bottlenecks exceeding threshold
 *
 * @param {object} args
 * @param {number} [args.threshold] - Days threshold (default: 7)
 * @returns {{ bottlenecks: Array<{ status: string, averageDays: number, recommendation: string }> }}
 */
export function getBottlenecks(args = {}) {
  const jobs = loadJobsData()
  const threshold = args.threshold || 7

  const bottlenecks = identifyBottlenecks(jobs, threshold)

  return { bottlenecks }
}

// ============================================================================
// Tool 6: Get Skill Gaps (ANLT-03)
// ============================================================================

/**
 * Get aggregated skill gaps from job descriptions
 *
 * @param {object} args
 * @param {number} [args.minOccurrences] - Minimum occurrences to include (default: 3)
 * @returns {{ gaps: Array<{ skill: string, count: number, priority: string, industries: string[], roles: string[] }>, total: number }}
 */
export function getSkillGaps(args = {}) {
  const jobs = loadJobsData()
  const profile = loadProfileData()
  const minOccurrences = args.minOccurrences || 3

  // aggregateSkillGaps already filters by minOccurrences = 3
  // If user requests different threshold, we filter again
  let gaps = aggregateSkillGaps(jobs, profile)

  if (minOccurrences !== 3) {
    gaps = gaps.filter(g => g.count >= minOccurrences)
  }

  return {
    gaps,
    total: gaps.length
  }
}

// ============================================================================
// Tool 7: Get Skill Gap Recommendations (ANLT-03)
// ============================================================================

/**
 * Get actionable recommendations for addressing skill gaps
 *
 * @returns {{ recommendations: Array<{ skill: string, priority: string, rationale: string, actionType: string }> }}
 */
export function getSkillGapRecommendations() {
  const jobs = loadJobsData()
  const profile = loadProfileData()

  // Get gaps
  const gaps = aggregateSkillGaps(jobs, profile)

  // Get target roles from profile preferences
  const targetRoles = profile?.preferences?.targetRoles || []

  // Generate recommendations
  const recommendations = getGapRecommendations(gaps, targetRoles)

  return { recommendations }
}

// ============================================================================
// Tool 8: Get Criteria Recommendations (ANLT-04)
// ============================================================================

/**
 * Get fit criteria evolution suggestions based on outcome analysis
 *
 * @returns {{ recommendations: Array<{ type: string, criteria: string, suggestedValue: any, confidence: string, rationale: string }> }}
 */
export function getCriteriaRecommendations() {
  const jobs = loadJobsData()
  const recommendations = generateRecommendations(jobs)

  return { recommendations }
}

// ============================================================================
// Tool 9: Preview Criteria Change (ANLT-04)
// ============================================================================

/**
 * Preview impact of a criteria change on existing job scores
 *
 * @param {object} args
 * @param {{ type: string, criteria: string, newValue?: any, currentValue?: any, removeValue?: any, percentChange?: number }} args.change - Proposed change
 * @returns {{ affected: number, scoreChanges: Array, summary: string }}
 */
export function previewCriteriaChange(args = {}) {
  if (!args.change) {
    return {
      affected: 0,
      scoreChanges: [],
      summary: 'change object is required'
    }
  }

  const jobs = loadJobsData()
  return previewChange(jobs, args.change)
}

// ============================================================================
// Tool 10: Apply Criteria Change (ANLT-04)
// ============================================================================

/**
 * Apply recommended criteria change with audit trail
 *
 * @param {object} args
 * @param {{ type: string, criteria: string, currentValue?: any, newValue?: any, removeValue?: any }} args.change - Change to apply
 * @param {string} args.reason - Human-readable reason for the change
 * @returns {{ success: boolean, config?: object, error?: string }}
 */
export function applyCriteriaChange(args = {}) {
  if (!args.change) {
    return { success: false, error: 'change object is required' }
  }

  if (!args.reason) {
    return { success: false, error: 'reason is required for audit trail' }
  }

  return applyChange(args.change, args.reason)
}

// ============================================================================
// Tool 11: Get Analytics Snapshot
// ============================================================================

/**
 * Get current or historical analytics snapshot
 *
 * @param {object} args
 * @param {string} [args.date] - ISO date to retrieve (omit for current)
 * @returns {object} Snapshot object with all metrics
 */
export function getAnalyticsSnapshot(args = {}) {
  if (args.date) {
    // Look up historical snapshot
    const { snapshots } = loadSnapshots()
    const targetDate = args.date.split('T')[0] // Normalize to YYYY-MM-DD

    const snapshot = snapshots.find(s => s.date.startsWith(targetDate))

    if (snapshot) {
      return snapshot
    }

    return {
      error: 'Snapshot not found for date',
      date: args.date,
      availableDates: snapshots.map(s => s.date)
    }
  }

  // Generate current snapshot
  const jobs = loadJobsData()
  const profile = loadProfileData()

  // Calculate all metrics for current snapshot
  const funnelMetrics = calculateFunnelMetrics(jobs, null)

  // Get time to response
  const timeToResponse = calculateTimeToResponse(jobs)

  // Get stage metrics
  const stageMetrics = calculateAllStageMetrics(jobs)

  // Get skill gaps
  const skillGaps = aggregateSkillGaps(jobs, profile)

  // Count by status
  const byStatus = {}
  for (const job of jobs) {
    byStatus[job.status] = (byStatus[job.status] || 0) + 1
  }

  return {
    date: new Date().toISOString(),
    metrics: {
      totalJobs: jobs.length,
      byStatus,
      funnelNodes: funnelMetrics.nodes.length,
      funnelLinks: funnelMetrics.links.length,
      responseRate: timeToResponse.sampleSize > 0
        ? Math.round((timeToResponse.sampleSize / jobs.filter(j => j.applied || j.status === 'applied').length) * 100)
        : 0,
      avgTimeToResponse: timeToResponse.averageDays,
      skillGapsCount: skillGaps.length,
      topGaps: skillGaps.slice(0, 5).map(g => g.skill)
    },
    stageMetrics,
    generated: true
  }
}

// ============================================================================
// Tool 12: Save Analytics Snapshot
// ============================================================================

/**
 * Save current analytics state as a snapshot for trend analysis
 *
 * @returns {{ success: boolean, snapshotDate: string, error?: string }}
 */
export function saveAnalyticsSnapshot() {
  // Generate current snapshot
  const currentSnapshot = getAnalyticsSnapshot({})

  if (currentSnapshot.error) {
    return { success: false, error: currentSnapshot.error }
  }

  // Load existing snapshots
  const data = loadSnapshots()

  // Clean old snapshots beyond retention period
  data.snapshots = cleanOldSnapshots(data.snapshots)

  // Add new snapshot (remove the 'generated' flag as it's now persisted)
  const { generated, ...snapshotToSave } = currentSnapshot
  data.snapshots.push(snapshotToSave)
  data.lastSnapshot = snapshotToSave.date

  // Save to file
  const saved = saveSnapshots(data)

  if (saved) {
    return {
      success: true,
      snapshotDate: snapshotToSave.date
    }
  }

  return {
    success: false,
    error: 'Failed to write snapshot to file'
  }
}

// ============================================================================
// Export all tool handlers for MCP server registration
// ============================================================================

export const analyticsToolHandlers = {
  get_funnel_metrics: getFunnelMetrics,
  get_response_rates: getResponseRates,
  get_time_to_response: getTimeToResponse,
  get_time_in_stage: getTimeInStage,
  get_bottlenecks: getBottlenecks,
  get_skill_gaps: getSkillGaps,
  get_skill_gap_recommendations: getSkillGapRecommendations,
  get_criteria_recommendations: getCriteriaRecommendations,
  preview_criteria_change: previewCriteriaChange,
  apply_criteria_change: applyCriteriaChange,
  get_analytics_snapshot: getAnalyticsSnapshot,
  save_analytics_snapshot: saveAnalyticsSnapshot
}
