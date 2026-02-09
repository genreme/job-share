/**
 * Board Quality Analyzer Service
 *
 * Analyzes job data to calculate quality metrics for each job board:
 * - Extraction success rate
 * - Expired/closed job rate
 * - Direct-to-company rate (vs aggregator redirects)
 * - Data completeness
 *
 * Uses job source tracking data to provide actionable insights.
 */

import { loadJobsFromDashboard } from '../data/loader.js'
import { loadBoardRegistry, saveBoardRegistry, getBoardById } from './board-registry.js'

/**
 * Analyze board quality from historical job data
 *
 * @returns {object} Quality analysis by board
 */
export function analyzeBoardQuality() {
  const data = loadJobsFromDashboard()
  const jobs = data.jobs || []

  // Group jobs by source board
  const boardStats = {}

  for (const job of jobs) {
    const board = job.sourceBoard || 'unknown'

    if (!boardStats[board]) {
      boardStats[board] = {
        boardId: board,
        totalJobs: 0,
        // Extraction quality
        extractionComplete: 0,
        extractionPartial: 0,
        extractionFailed: 0,
        // Job status outcomes
        applied: 0,
        archived: 0,
        closedExpired: 0,
        active: 0,
        // Direct vs aggregator
        directToCompany: 0,
        aggregatorRedirect: 0,
        // Data completeness
        hasTitle: 0,
        hasCompany: 0,
        hasLocation: 0,
        hasSalary: 0,
        hasDescription: 0,
        // Timing
        jobsAddedLast30Days: 0,
        closedWithin7Days: 0
      }
    }

    const stats = boardStats[board]
    stats.totalJobs++

    // Extraction quality
    const quality = job.extractionQuality || 'unknown'
    if (quality === 'complete') stats.extractionComplete++
    else if (quality === 'partial') stats.extractionPartial++
    else if (quality === 'failed') stats.extractionFailed++

    // Job outcomes
    if (job.status === 'applied') stats.applied++
    else if (job.status === 'archived') stats.archived++

    if (job.closedAt || job.closedReason) stats.closedExpired++
    else if (job.status !== 'archived') stats.active++

    // Direct vs aggregator
    if (job.isDirectToCompany === true) stats.directToCompany++
    else if (job.isDirectToCompany === false) stats.aggregatorRedirect++

    // Data completeness
    if (job.title && job.title.trim()) stats.hasTitle++
    if (job.company && job.company.trim()) stats.hasCompany++
    if (job.location && job.location.trim()) stats.hasLocation++
    if (job.salary && job.salary.trim()) stats.hasSalary++
    if (job.description && job.description.length > 50) stats.hasDescription++

    // Timing analysis
    const foundDate = job.found ? new Date(job.found) : null
    const closedDate = job.closedAt ? new Date(job.closedAt) : null
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    if (foundDate && foundDate >= thirtyDaysAgo) {
      stats.jobsAddedLast30Days++
    }

    if (foundDate && closedDate) {
      const daysBetween = (closedDate - foundDate) / (24 * 60 * 60 * 1000)
      if (daysBetween <= 7) {
        stats.closedWithin7Days++
      }
    }
  }

  // Calculate quality scores for each board
  const analysis = Object.values(boardStats).map(stats => {
    const total = stats.totalJobs

    // Extraction success rate (complete + partial vs failed)
    const extractionRate = total > 0
      ? Math.round(((stats.extractionComplete + stats.extractionPartial * 0.5) / total) * 100)
      : 0

    // Freshness rate (jobs NOT closed within 7 days)
    const freshnessRate = stats.jobsAddedLast30Days > 0
      ? Math.round(((stats.jobsAddedLast30Days - stats.closedWithin7Days) / stats.jobsAddedLast30Days) * 100)
      : 100

    // Direct-to-company rate
    const directRate = (stats.directToCompany + stats.aggregatorRedirect) > 0
      ? Math.round((stats.directToCompany / (stats.directToCompany + stats.aggregatorRedirect)) * 100)
      : 50

    // Data completeness rate
    const completenessRate = total > 0
      ? Math.round(((stats.hasTitle + stats.hasCompany + stats.hasLocation + stats.hasSalary) / (total * 4)) * 100)
      : 0

    // Application conversion rate (applied / total non-archived)
    const activeJobs = total - stats.archived
    const conversionRate = activeJobs > 0
      ? Math.round((stats.applied / activeJobs) * 100)
      : 0

    // Overall quality score (weighted)
    // 30% extraction, 25% freshness, 20% direct, 15% completeness, 10% conversion
    const qualityScore = Math.round(
      extractionRate * 0.30 +
      freshnessRate * 0.25 +
      directRate * 0.20 +
      completenessRate * 0.15 +
      conversionRate * 0.10
    )

    return {
      boardId: stats.boardId,
      totalJobs: total,
      qualityScore,
      metrics: {
        extractionRate,
        freshnessRate,
        directRate,
        completenessRate,
        conversionRate
      },
      counts: {
        applied: stats.applied,
        archived: stats.archived,
        closedExpired: stats.closedExpired,
        active: stats.active,
        directToCompany: stats.directToCompany,
        aggregatorRedirect: stats.aggregatorRedirect
      },
      recentActivity: {
        jobsLast30Days: stats.jobsAddedLast30Days,
        closedWithin7Days: stats.closedWithin7Days
      }
    }
  })

  // Sort by quality score (descending)
  analysis.sort((a, b) => b.qualityScore - a.qualityScore)

  return {
    totalJobsAnalyzed: jobs.length,
    boardsFound: analysis.length,
    boards: analysis,
    recommendations: generateBoardRecommendations(analysis)
  }
}

/**
 * Generate recommendations based on board analysis
 *
 * @param {object[]} boardAnalysis - Array of board analysis objects
 * @returns {object[]} Recommendations
 */
function generateBoardRecommendations(boardAnalysis) {
  const recommendations = []

  for (const board of boardAnalysis) {
    // Skip if not enough data
    if (board.totalJobs < 3) continue

    const { metrics, counts, recentActivity, boardId } = board

    // High expired rate warning
    if (metrics.freshnessRate < 70 && recentActivity.jobsLast30Days >= 3) {
      recommendations.push({
        type: 'warning',
        boardId,
        issue: 'High expired job rate',
        detail: `${100 - metrics.freshnessRate}% of jobs from ${boardId} closed within 7 days of discovery`,
        action: 'Consider reducing priority or verify jobs before adding'
      })
    }

    // Low direct-to-company rate
    if (metrics.directRate < 40 && counts.aggregatorRedirect >= 3) {
      recommendations.push({
        type: 'info',
        boardId,
        issue: 'Aggregator board',
        detail: `Only ${metrics.directRate}% of ${boardId} jobs link directly to company career pages`,
        action: 'Jobs may require extra navigation; prefer direct ATS platforms'
      })
    }

    // Poor extraction rate
    if (metrics.extractionRate < 60 && board.totalJobs >= 5) {
      recommendations.push({
        type: 'warning',
        boardId,
        issue: 'Poor data extraction',
        detail: `Only ${metrics.extractionRate}% extraction success on ${boardId}`,
        action: 'Review CSS selectors or consider blacklisting'
      })
    }

    // High performer
    if (board.qualityScore >= 75 && board.totalJobs >= 5) {
      recommendations.push({
        type: 'success',
        boardId,
        issue: 'High-quality source',
        detail: `${boardId} has quality score ${board.qualityScore}/100 with ${metrics.conversionRate}% application rate`,
        action: 'Prioritize this board in searches'
      })
    }

    // Potential blacklist candidate
    if (board.qualityScore < 30 && board.totalJobs >= 5) {
      recommendations.push({
        type: 'danger',
        boardId,
        issue: 'Low-quality source',
        detail: `${boardId} quality score is only ${board.qualityScore}/100`,
        action: 'Consider blacklisting this board'
      })
    }
  }

  // Sort by severity
  const severityOrder = { danger: 0, warning: 1, info: 2, success: 3 }
  recommendations.sort((a, b) => severityOrder[a.type] - severityOrder[b.type])

  return recommendations
}

/**
 * Update board registry with analyzed quality scores
 *
 * @returns {object} Update result
 */
export function syncQualityToRegistry() {
  const analysis = analyzeBoardQuality()
  const registry = loadBoardRegistry()

  let updated = 0
  let added = 0

  for (const boardAnalysis of analysis.boards) {
    const { boardId, qualityScore, metrics, totalJobs } = boardAnalysis

    // Skip unknown or very low data
    if (boardId === 'unknown' || totalJobs < 2) continue

    // Find or create board in registry
    let board = registry.boards.find(b => b.id === boardId)

    if (!board) {
      // Check if in testing
      board = registry.testingBoards.find(b => b.id === boardId)
    }

    if (board) {
      // Update existing board
      board.quality = board.quality || {}
      board.quality.rating = qualityScore
      board.quality.dataCompleteness = metrics.completenessRate
      board.quality.extractionRate = metrics.extractionRate
      board.quality.freshnessRate = metrics.freshnessRate
      board.quality.directRate = metrics.directRate
      board.quality.lastAnalyzed = new Date().toISOString()
      board.metrics = board.metrics || {}
      board.metrics.totalFromAnalysis = totalJobs
      updated++
    } else {
      // Add new board to testing queue
      registry.testingBoards.push({
        id: boardId,
        name: formatBoardName(boardId),
        domain: boardId,
        status: 'testing',
        quality: {
          rating: qualityScore,
          dataCompleteness: metrics.completenessRate,
          extractionRate: metrics.extractionRate,
          freshnessRate: metrics.freshnessRate,
          directRate: metrics.directRate,
          lastAnalyzed: new Date().toISOString()
        },
        metrics: {
          totalFromAnalysis: totalJobs
        },
        addedAt: new Date().toISOString(),
        source: 'auto-detected'
      })
      added++
    }
  }

  saveBoardRegistry(registry)

  return {
    updated,
    added,
    totalBoards: analysis.boardsFound,
    message: `Synced quality scores: ${updated} updated, ${added} new boards discovered`
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
 * Get board quality report for a specific board
 *
 * @param {string} boardId - Board ID to analyze
 * @returns {object} Board-specific quality report
 */
export function getBoardQualityReport(boardId) {
  const analysis = analyzeBoardQuality()
  const board = analysis.boards.find(b => b.boardId === boardId)

  if (!board) {
    return {
      error: `No jobs found from board: ${boardId}`,
      availableBoards: analysis.boards.map(b => b.boardId)
    }
  }

  // Get relevant recommendations
  const recommendations = analysis.recommendations.filter(r => r.boardId === boardId)

  return {
    boardId,
    name: formatBoardName(boardId),
    ...board,
    recommendations,
    comparison: {
      rank: analysis.boards.findIndex(b => b.boardId === boardId) + 1,
      totalBoards: analysis.boardsFound,
      aboveAverage: board.qualityScore > (analysis.boards.reduce((sum, b) => sum + b.qualityScore, 0) / analysis.boardsFound)
    }
  }
}
