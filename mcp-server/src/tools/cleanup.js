/**
 * Cleanup Tools - MCP tool implementations for profile cleanup workflow
 *
 * Provides tools for:
 * - run_weekly_cleanup: Triggers cleanup analysis
 * - get_cleanup_findings: Returns stored findings from last run
 * - dismiss_finding: Mark a finding as dismissed
 */

import {
  runCleanupAnalysis,
  checkCleanupOverdue,
  getStoredFindings,
  dismissFinding,
  generateFindingHash
} from '../services/cleanup.js'

/**
 * Run weekly cleanup analysis on profile
 *
 * Analyzes profile for:
 * - Duplicate entries (skills, stories, summaries)
 * - Stale items (not updated AND not used)
 * - Gaps (missing required fields, thin evidence)
 *
 * @param {object} params - Tool parameters
 * @param {object} params.jobContext - Optional job context { title, company }
 * @returns {object} Summary with counts and details
 */
export function runWeeklyCleanup(params = {}) {
  try {
    const { jobContext = null } = params

    const result = runCleanupAnalysis(null, { jobContext })

    // Format summary for MCP response
    return {
      success: true,
      runAt: result.runAt,
      status: result.status,
      summary: {
        duplicates: result.duplicates.length,
        stale: result.stale.length,
        gaps: result.gaps.length,
        total: result.duplicates.length + result.stale.length + result.gaps.length
      },
      findings: {
        duplicates: result.duplicates.map(formatFinding),
        stale: result.stale.map(formatFinding),
        gaps: result.gaps.map(formatFinding)
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to run cleanup: ${error.message}`
    }
  }
}

/**
 * Get stored cleanup findings from last run
 *
 * @param {object} params - Tool parameters
 * @param {string} params.filterType - Filter by type: 'duplicate', 'stale', 'gap'
 * @returns {object} Findings with metadata
 */
export function getCleanupFindings(params = {}) {
  try {
    const { filterType = null } = params

    const stored = getStoredFindings()

    if (!stored || stored.runs.length === 0) {
      return {
        success: true,
        hasFindings: false,
        message: 'No cleanup has been run yet. Use run_weekly_cleanup to analyze your profile.',
        overdueCheck: checkCleanupOverdue()
      }
    }

    // Get most recent run
    const lastRun = stored.runs[0]
    const dismissed = new Set((stored.dismissed || []).map((d) => d.findingHash))

    // Combine all findings and filter out dismissed ones
    let allFindings = []

    if (!filterType || filterType === 'duplicate') {
      allFindings.push(
        ...lastRun.duplicates.map((f) => ({
          ...formatFinding(f),
          hash: generateFindingHash(f),
          dismissed: dismissed.has(generateFindingHash(f))
        }))
      )
    }

    if (!filterType || filterType === 'stale') {
      allFindings.push(
        ...lastRun.stale.map((f) => ({
          ...formatFinding(f),
          hash: generateFindingHash(f),
          dismissed: dismissed.has(generateFindingHash(f))
        }))
      )
    }

    if (!filterType || filterType === 'gap') {
      allFindings.push(
        ...lastRun.gaps.map((f) => ({
          ...formatFinding(f),
          hash: generateFindingHash(f),
          dismissed: dismissed.has(generateFindingHash(f))
        }))
      )
    }

    // Filter out dismissed unless explicitly requested
    const activeFindings = allFindings.filter((f) => !f.dismissed)

    return {
      success: true,
      hasFindings: activeFindings.length > 0,
      lastRun: lastRun.runAt,
      overdueCheck: checkCleanupOverdue(),
      counts: {
        duplicates: lastRun.duplicates.length,
        stale: lastRun.stale.length,
        gaps: lastRun.gaps.length,
        dismissed: dismissed.size,
        active: activeFindings.length
      },
      findings: activeFindings
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to get findings: ${error.message}`
    }
  }
}

/**
 * Dismiss a finding (mark as acknowledged)
 *
 * Dismissed findings won't show in get_cleanup_findings unless
 * explicitly requested. They remain in storage for history.
 *
 * @param {object} params - Tool parameters
 * @param {string} params.findingHash - Hash identifying the finding
 * @param {string} params.reason - Optional reason for dismissing
 * @returns {object} Success/failure result
 */
export function dismissCleanupFinding(params = {}) {
  try {
    const { findingHash, reason = null } = params

    if (!findingHash) {
      return {
        success: false,
        error: 'findingHash parameter is required'
      }
    }

    const success = dismissFinding(findingHash, reason)

    if (success) {
      return {
        success: true,
        message: `Finding ${findingHash} has been dismissed`,
        reason: reason || 'No reason provided'
      }
    } else {
      return {
        success: false,
        error: 'Failed to dismiss finding - no stored findings exist'
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to dismiss finding: ${error.message}`
    }
  }
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Format a finding for MCP response
 */
function formatFinding(finding) {
  return {
    type: finding.type,
    entityType: finding.entityType,
    ids: finding.ids,
    similarity: finding.similarity, // Only for duplicates
    reason: finding.reason,
    suggestion: finding.suggestion,
    relevantTo: finding.relevantTo, // Only for contextual gaps
    createdAt: finding.createdAt
  }
}
