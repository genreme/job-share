/**
 * Boards MCP Tools
 *
 * Tools for managing job board registry:
 * - getJobBoards: Get active boards sorted by quality
 * - addTestBoard: Add a new board for testing
 * - blacklistBoard: Blacklist a board (requires confirmation)
 * - recordScanResults: Update metrics after scanning
 */

import {
  getBoardsForScan,
  addBoardForTesting,
  updateBoardMetrics,
  blacklistBoard as blacklistBoardService,
  getBoardById,
  loadBoardRegistry,
  promoteBoardToActive
} from '../services/board-registry.js'

import {
  analyzeBoardQuality,
  syncQualityToRegistry,
  getBoardQualityReport
} from '../services/board-quality-analyzer.js'

/**
 * Get job boards for scanning
 *
 * Returns active boards sorted by quality rating.
 * DISC-11: Job board registry with quality ratings
 * DISC-13: High-quality boards prioritized
 *
 * @param {object} [params] - Filter options
 * @param {number} [params.minQuality] - Minimum quality rating (0-100)
 * @param {boolean} [params.includeBlacklisted] - Include blacklisted boards
 * @returns {object} Boards list with metadata
 */
export function getJobBoards({ minQuality, includeBlacklisted } = {}) {
  const boards = getBoardsForScan({ minQuality, includeBlacklisted })
  const registry = loadBoardRegistry()

  return {
    count: boards.length,
    boards: boards.map(board => ({
      id: board.id,
      name: board.name,
      domain: board.domain,
      qualityRating: board.quality?.rating || 0,
      dataCompleteness: board.quality?.dataCompleteness || 0,
      totalScanned: board.metrics?.totalScanned || 0,
      successRate: calculateSuccessRate(board),
      lastScanDate: board.metrics?.lastScanDate || null
    })),
    testingCount: registry.testingBoards?.length || 0,
    blacklistCount: registry.blacklist?.length || 0
  }
}

/**
 * Calculate success rate for a board
 *
 * @param {object} board - Board object
 * @returns {number|null} Success rate as percentage, or null if no data
 */
function calculateSuccessRate(board) {
  const total = (board.metrics?.successfulExtractions || 0) + (board.metrics?.failedExtractions || 0)
  if (total === 0) return null
  return Math.round((board.metrics.successfulExtractions / total) * 100)
}

/**
 * Add a new board for testing
 *
 * Testing boards are not included in scan rotation until promoted.
 * DISC-12: New boards can be tested
 *
 * @param {object} params - Board parameters
 * @param {string} params.name - Board name (e.g., "Workday")
 * @param {string} params.domain - Domain pattern (e.g., "myworkday.com")
 * @param {object} [params.selectors] - CSS selectors for extraction
 * @param {string} [params.notes] - Notes about the board
 * @returns {object} Result with board ID
 */
export function addTestBoard({ name, domain, selectors, notes }) {
  const result = addBoardForTesting({ name, domain, selectors, notes })

  if (result.success) {
    return {
      success: true,
      boardId: result.boardId,
      message: `Board '${name}' added to testing queue. Domain: ${domain}`,
      nextStep: 'Test extractions and call recordScanResults to track quality'
    }
  }

  return {
    success: false,
    error: result.error
  }
}

/**
 * Blacklist a job board
 *
 * IMPORTANT: Requires userConfirmed=true to proceed.
 * DISC-14: Blacklisting requires user confirmation
 *
 * @param {object} params - Blacklist parameters
 * @param {string} params.boardId - Board ID to blacklist
 * @param {string} params.reason - Reason for blacklisting
 * @param {boolean} params.userConfirmed - Must be true to proceed
 * @returns {object} Result
 */
export function blacklistBoard({ boardId, reason, userConfirmed }) {
  // Get board info before blacklisting (for message)
  const board = getBoardById(boardId)

  const result = blacklistBoardService({ boardId, reason, userConfirmed })

  if (result.requiresConfirmation) {
    const boardName = board ? board.name : boardId
    return {
      success: false,
      requiresConfirmation: true,
      error: result.error,
      boardInfo: board ? {
        id: board.id,
        name: board.name,
        domain: board.domain,
        qualityRating: board.quality?.rating,
        totalScanned: board.metrics?.totalScanned
      } : null,
      instruction: `To confirm blacklisting '${boardName}', call blacklistBoard again with userConfirmed: true`
    }
  }

  if (result.success) {
    return {
      success: true,
      message: result.message
    }
  }

  return {
    success: false,
    error: result.error
  }
}

/**
 * Record scan results for a board
 *
 * Updates metrics after scanning jobs from a board.
 * Used to track quality over time.
 *
 * @param {object} params - Scan results
 * @param {string} params.boardId - Board ID
 * @param {number} params.scanned - Total jobs scanned
 * @param {number} params.successful - Successful extractions
 * @param {number} params.failed - Failed extractions
 * @returns {object} Result with updated board info
 */
export function recordScanResults({ boardId, scanned, successful, failed }) {
  const result = updateBoardMetrics({ boardId, scanned, successful, failed })

  if (result.success) {
    return {
      success: true,
      boardId,
      updatedMetrics: {
        totalScanned: result.board.metrics.totalScanned,
        successRate: calculateSuccessRate(result.board),
        qualityRating: result.board.quality?.rating
      },
      message: `Recorded ${scanned} scans (${successful} successful, ${failed} failed) for ${result.board.name}`
    }
  }

  return {
    success: false,
    error: result.error
  }
}

/**
 * Analyze job board quality from historical job data
 *
 * Examines all jobs to calculate quality metrics for each source board:
 * - Extraction success rate
 * - Expired/closed job rate (freshness)
 * - Direct-to-company rate
 * - Data completeness
 * - Application conversion rate
 *
 * @returns {object} Quality analysis with recommendations
 */
export function analyzeBoards() {
  const analysis = analyzeBoardQuality()

  return {
    success: true,
    totalJobsAnalyzed: analysis.totalJobsAnalyzed,
    boardsFound: analysis.boardsFound,
    boards: analysis.boards.map(board => ({
      boardId: board.boardId,
      name: formatBoardName(board.boardId),
      qualityScore: board.qualityScore,
      totalJobs: board.totalJobs,
      metrics: board.metrics,
      recentActivity: board.recentActivity
    })),
    recommendations: analysis.recommendations,
    nextStep: 'Use sync_board_quality to update registry with these scores'
  }
}

/**
 * Format board ID into readable name
 */
function formatBoardName(boardId) {
  const names = {
    'linkedin': 'LinkedIn',
    'indeed': 'Indeed',
    'glassdoor': 'Glassdoor',
    'greenhouse': 'Greenhouse',
    'lever': 'Lever',
    'workday': 'Workday',
    'ashby': 'Ashby',
    'wellfound': 'Wellfound (AngelList)',
    'builtin': 'Built In',
    'company-direct': 'Company Career Pages',
    'unknown': 'Unknown Sources'
  }
  return names[boardId] || boardId.charAt(0).toUpperCase() + boardId.slice(1)
}

/**
 * Sync analyzed quality scores to the board registry
 *
 * Updates existing boards and auto-discovers new boards from job data.
 *
 * @returns {object} Sync result
 */
export function syncBoardQuality() {
  const result = syncQualityToRegistry()

  return {
    success: true,
    ...result,
    nextStep: 'Call get_job_boards to see updated quality rankings'
  }
}

/**
 * Get detailed quality report for a specific board
 *
 * @param {object} params - Parameters
 * @param {string} params.boardId - Board ID to analyze
 * @returns {object} Board quality report
 */
export function getBoardReport({ boardId }) {
  if (!boardId || typeof boardId !== 'string') {
    return { success: false, error: 'boardId is required' }
  }

  const report = getBoardQualityReport(boardId)

  if (report.error) {
    return { success: false, ...report }
  }

  return {
    success: true,
    ...report
  }
}

/**
 * Promote a testing board to active rotation
 *
 * @param {object} params - Parameters
 * @param {string} params.boardId - Board ID to promote
 * @returns {object} Result
 */
export function promoteBoard({ boardId }) {
  if (!boardId || typeof boardId !== 'string') {
    return { success: false, error: 'boardId is required' }
  }

  const result = promoteBoardToActive({ boardId })

  if (result.success) {
    return {
      success: true,
      board: result.board,
      message: `Board '${result.board.name}' promoted to active rotation`
    }
  }

  return { success: false, error: result.error }
}
