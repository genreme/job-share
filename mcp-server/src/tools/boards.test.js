/**
 * Board Tools Tests
 *
 * Tests for MCP tool implementations for job board management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock board-registry module
vi.mock('../services/board-registry.js', () => ({
  getBoardsForScan: vi.fn(),
  addBoardForTesting: vi.fn(),
  updateBoardMetrics: vi.fn(),
  blacklistBoard: vi.fn(),
  getBoardById: vi.fn(),
  loadBoardRegistry: vi.fn(),
  promoteBoardToActive: vi.fn()
}))

// Mock board-quality-analyzer module
vi.mock('../services/board-quality-analyzer.js', () => ({
  analyzeBoardQuality: vi.fn(),
  syncQualityToRegistry: vi.fn(),
  getBoardQualityReport: vi.fn()
}))

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

// Import tools under test
import {
  getJobBoards,
  addTestBoard,
  blacklistBoard,
  recordScanResults,
  analyzeBoards,
  syncBoardQuality,
  getBoardReport,
  promoteBoard
} from './boards.js'

// Test fixtures
function createTestBoards() {
  return [
    {
      id: 'lever',
      name: 'Lever',
      domain: 'jobs.lever.co',
      status: 'active',
      quality: { rating: 95, dataCompleteness: 90 },
      metrics: { totalScanned: 100, successfulExtractions: 95, failedExtractions: 5, lastScanDate: '2026-01-30' }
    },
    {
      id: 'greenhouse',
      name: 'Greenhouse',
      domain: 'boards.greenhouse.io',
      status: 'active',
      quality: { rating: 85, dataCompleteness: 80 },
      metrics: { totalScanned: 50, successfulExtractions: 40, failedExtractions: 10 }
    }
  ]
}

function createTestRegistry() {
  return {
    boards: createTestBoards(),
    testingBoards: [
      { id: 'workday', name: 'Workday', status: 'testing' }
    ],
    blacklist: [
      { boardId: 'spam-board', reason: 'Spam content' }
    ]
  }
}

describe('getJobBoards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getBoardsForScan).mockReturnValue(createTestBoards())
    vi.mocked(loadBoardRegistry).mockReturnValue(createTestRegistry())
  })

  it('returns boards sorted by quality', () => {
    const result = getJobBoards()

    expect(result.count).toBe(2)
    expect(result.boards[0].id).toBe('lever')
    expect(result.boards[0].qualityRating).toBe(95)
  })

  it('includes board metadata', () => {
    const result = getJobBoards()
    const lever = result.boards.find(b => b.id === 'lever')

    expect(lever.name).toBe('Lever')
    expect(lever.domain).toBe('jobs.lever.co')
    expect(lever.dataCompleteness).toBe(90)
    expect(lever.totalScanned).toBe(100)
    expect(lever.lastScanDate).toBe('2026-01-30')
  })

  it('calculates success rate', () => {
    const result = getJobBoards()
    const lever = result.boards.find(b => b.id === 'lever')

    // 95 successful / (95 + 5) total = 95%
    expect(lever.successRate).toBe(95)
  })

  it('returns null successRate when no extractions', () => {
    vi.mocked(getBoardsForScan).mockReturnValue([
      { id: 'new', name: 'New', metrics: { totalScanned: 0 } }
    ])

    const result = getJobBoards()

    expect(result.boards[0].successRate).toBeNull()
  })

  it('passes filter options to service', () => {
    getJobBoards({ minQuality: 80, includeBlacklisted: true })

    expect(getBoardsForScan).toHaveBeenCalledWith({
      minQuality: 80,
      includeBlacklisted: true
    })
  })

  it('includes testing and blacklist counts', () => {
    const result = getJobBoards()

    expect(result.testingCount).toBe(1)
    expect(result.blacklistCount).toBe(1)
  })

  it('handles boards without quality data', () => {
    vi.mocked(getBoardsForScan).mockReturnValue([
      { id: 'no-quality', name: 'No Quality', metrics: {} }
    ])

    const result = getJobBoards()

    expect(result.boards[0].qualityRating).toBe(0)
    expect(result.boards[0].dataCompleteness).toBe(0)
  })
})

describe('addTestBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds board successfully', () => {
    vi.mocked(addBoardForTesting).mockReturnValue({
      success: true,
      boardId: 'new-board'
    })

    const result = addTestBoard({
      name: 'New Board',
      domain: 'newboard.com',
      notes: 'Testing'
    })

    expect(result.success).toBe(true)
    expect(result.boardId).toBe('new-board')
    expect(result.message).toContain('New Board')
    expect(result.message).toContain('newboard.com')
    expect(result.nextStep).toContain('recordScanResults')
  })

  it('passes selectors to service', () => {
    vi.mocked(addBoardForTesting).mockReturnValue({ success: true, boardId: 'test' })

    const selectors = { title: '.job-title', company: '.company-name' }
    addTestBoard({
      name: 'Test',
      domain: 'test.com',
      selectors
    })

    expect(addBoardForTesting).toHaveBeenCalledWith({
      name: 'Test',
      domain: 'test.com',
      selectors,
      notes: undefined
    })
  })

  it('returns error on failure', () => {
    vi.mocked(addBoardForTesting).mockReturnValue({
      success: false,
      error: 'Board already exists'
    })

    const result = addTestBoard({
      name: 'Duplicate',
      domain: 'duplicate.com'
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Board already exists')
  })
})

describe('blacklistBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires confirmation', () => {
    vi.mocked(getBoardById).mockReturnValue({
      id: 'bad-board',
      name: 'Bad Board',
      domain: 'bad.com',
      quality: { rating: 20 },
      metrics: { totalScanned: 50 }
    })
    vi.mocked(blacklistBoardService).mockReturnValue({
      success: false,
      requiresConfirmation: true,
      error: 'Requires userConfirmed=true'
    })

    const result = blacklistBoard({
      boardId: 'bad-board',
      reason: 'Low quality'
    })

    expect(result.success).toBe(false)
    expect(result.requiresConfirmation).toBe(true)
    expect(result.boardInfo).toBeDefined()
    expect(result.boardInfo.name).toBe('Bad Board')
    expect(result.instruction).toContain('userConfirmed: true')
  })

  it('blacklists when confirmed', () => {
    vi.mocked(blacklistBoardService).mockReturnValue({
      success: true,
      message: 'Board blacklisted'
    })

    const result = blacklistBoard({
      boardId: 'bad-board',
      reason: 'Low quality',
      userConfirmed: true
    })

    expect(result.success).toBe(true)
    expect(result.message).toContain('blacklisted')
  })

  it('returns error on service failure', () => {
    vi.mocked(blacklistBoardService).mockReturnValue({
      success: false,
      error: 'Board not found'
    })

    const result = blacklistBoard({
      boardId: 'nonexistent',
      reason: 'Test',
      userConfirmed: true
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Board not found')
  })

  it('handles missing board gracefully', () => {
    vi.mocked(getBoardById).mockReturnValue(null)
    vi.mocked(blacklistBoardService).mockReturnValue({
      success: false,
      requiresConfirmation: true,
      error: 'Requires confirmation'
    })

    const result = blacklistBoard({
      boardId: 'unknown',
      reason: 'Test'
    })

    expect(result.requiresConfirmation).toBe(true)
    expect(result.boardInfo).toBeNull()
  })
})

describe('recordScanResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('records results successfully', () => {
    vi.mocked(updateBoardMetrics).mockReturnValue({
      success: true,
      board: {
        id: 'lever',
        name: 'Lever',
        metrics: { totalScanned: 110 },
        quality: { rating: 93 }
      }
    })

    const result = recordScanResults({
      boardId: 'lever',
      scanned: 10,
      successful: 9,
      failed: 1
    })

    expect(result.success).toBe(true)
    expect(result.boardId).toBe('lever')
    expect(result.updatedMetrics.totalScanned).toBe(110)
    expect(result.message).toContain('10 scans')
    expect(result.message).toContain('9 successful')
    expect(result.message).toContain('1 failed')
  })

  it('includes updated quality rating', () => {
    vi.mocked(updateBoardMetrics).mockReturnValue({
      success: true,
      board: {
        id: 'test',
        name: 'Test',
        metrics: { totalScanned: 100, successfulExtractions: 80, failedExtractions: 20 },
        quality: { rating: 75 }
      }
    })

    const result = recordScanResults({
      boardId: 'test',
      scanned: 100,
      successful: 80,
      failed: 20
    })

    expect(result.updatedMetrics.qualityRating).toBe(75)
    expect(result.updatedMetrics.successRate).toBe(80)
  })

  it('returns error on failure', () => {
    vi.mocked(updateBoardMetrics).mockReturnValue({
      success: false,
      error: 'Board not found'
    })

    const result = recordScanResults({
      boardId: 'nonexistent',
      scanned: 10,
      successful: 5,
      failed: 5
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Board not found')
  })
})

describe('analyzeBoards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns analysis results and auto-syncs by default', () => {
    vi.mocked(analyzeBoardQuality).mockReturnValue({
      totalJobsAnalyzed: 100,
      boardsFound: 5,
      boards: [
        {
          boardId: 'linkedin',
          totalJobs: 50,
          qualityScore: 75,
          metrics: { extractionRate: 80 },
          recentActivity: { jobsLast30Days: 20 }
        },
        {
          boardId: 'indeed',
          totalJobs: 30,
          qualityScore: 60,
          metrics: { extractionRate: 65 },
          recentActivity: { jobsLast30Days: 10 }
        }
      ],
      recommendations: [
        { type: 'warning', boardId: 'indeed', issue: 'Low extraction rate' }
      ]
    })
    vi.mocked(syncQualityToRegistry).mockReturnValue({
      updated: 2,
      added: 0,
      totalBoards: 5
    })

    const result = analyzeBoards()

    expect(result.success).toBe(true)
    expect(result.totalJobsAnalyzed).toBe(100)
    expect(result.boardsFound).toBe(5)
    expect(result.boards).toHaveLength(2)
    expect(result.boards[0].name).toBe('LinkedIn')
    expect(result.recommendations).toHaveLength(1)
    // Should auto-sync
    expect(syncQualityToRegistry).toHaveBeenCalled()
    expect(result.synced).toBe(true)
    expect(result.syncResult.updated).toBe(2)
    expect(result.message).toContain('Analyzed')
    expect(result.message).toContain('Updated')
  })

  it('does not sync in preview mode', () => {
    vi.mocked(analyzeBoardQuality).mockReturnValue({
      totalJobsAnalyzed: 10,
      boardsFound: 2,
      boards: [
        { boardId: 'linkedin', totalJobs: 10, qualityScore: 80, metrics: {}, recentActivity: {} }
      ],
      recommendations: []
    })

    const result = analyzeBoards({ preview: true })

    expect(result.success).toBe(true)
    expect(syncQualityToRegistry).not.toHaveBeenCalled()
    expect(result.synced).toBe(false)
    expect(result.syncResult).toBeNull()
    expect(result.message).toContain('Preview mode')
  })

  it('formats board names correctly', () => {
    vi.mocked(analyzeBoardQuality).mockReturnValue({
      totalJobsAnalyzed: 10,
      boardsFound: 3,
      boards: [
        { boardId: 'greenhouse', totalJobs: 5, qualityScore: 90, metrics: {}, recentActivity: {} },
        { boardId: 'wellfound', totalJobs: 3, qualityScore: 70, metrics: {}, recentActivity: {} },
        { boardId: 'custom-board', totalJobs: 2, qualityScore: 60, metrics: {}, recentActivity: {} }
      ],
      recommendations: []
    })
    vi.mocked(syncQualityToRegistry).mockReturnValue({
      updated: 3,
      added: 0,
      totalBoards: 3
    })

    const result = analyzeBoards()

    expect(result.boards[0].name).toBe('Greenhouse')
    expect(result.boards[1].name).toBe('Wellfound (AngelList)')
    expect(result.boards[2].name).toBe('Custom-board')
  })

  it('handles no boards found', () => {
    vi.mocked(analyzeBoardQuality).mockReturnValue({
      totalJobsAnalyzed: 0,
      boardsFound: 0,
      boards: [],
      recommendations: []
    })

    const result = analyzeBoards()

    expect(result.success).toBe(true)
    expect(syncQualityToRegistry).not.toHaveBeenCalled()
    expect(result.synced).toBe(false)
    expect(result.message).toContain('No boards found')
  })
})

describe('syncBoardQuality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('syncs quality scores to registry', () => {
    vi.mocked(syncQualityToRegistry).mockReturnValue({
      updated: 3,
      added: 1,
      totalBoards: 4,
      message: 'Synced quality scores: 3 updated, 1 new boards discovered'
    })

    const result = syncBoardQuality()

    expect(result.success).toBe(true)
    expect(result.updated).toBe(3)
    expect(result.added).toBe(1)
    expect(result.totalBoards).toBe(4)
    expect(result.nextStep).toContain('get_job_boards')
  })
})

describe('getBoardReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns detailed board report', () => {
    vi.mocked(getBoardQualityReport).mockReturnValue({
      boardId: 'linkedin',
      name: 'LinkedIn',
      totalJobs: 50,
      qualityScore: 75,
      metrics: { extractionRate: 80, directRate: 40 },
      counts: { applied: 10, archived: 5 },
      recommendations: [{ type: 'info', issue: 'Aggregator board' }],
      comparison: { rank: 2, totalBoards: 5, aboveAverage: true }
    })

    const result = getBoardReport({ boardId: 'linkedin' })

    expect(result.success).toBe(true)
    expect(result.boardId).toBe('linkedin')
    expect(result.name).toBe('LinkedIn')
    expect(result.qualityScore).toBe(75)
  })

  it('returns error for missing boardId', () => {
    const result = getBoardReport({})

    expect(result.success).toBe(false)
    expect(result.error).toContain('boardId')
  })

  it('returns error for invalid boardId type', () => {
    const result = getBoardReport({ boardId: 123 })

    expect(result.success).toBe(false)
    expect(result.error).toContain('boardId')
  })

  it('passes through service errors', () => {
    vi.mocked(getBoardQualityReport).mockReturnValue({
      error: 'No jobs found from board: unknown',
      availableBoards: ['linkedin', 'indeed']
    })

    const result = getBoardReport({ boardId: 'unknown' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('No jobs found')
    expect(result.availableBoards).toBeDefined()
  })
})

describe('promoteBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('promotes testing board to active', () => {
    vi.mocked(promoteBoardToActive).mockReturnValue({
      success: true,
      board: {
        id: 'workday',
        name: 'Workday',
        status: 'active',
        promotedAt: '2026-02-01T00:00:00Z'
      }
    })

    const result = promoteBoard({ boardId: 'workday' })

    expect(result.success).toBe(true)
    expect(result.board.status).toBe('active')
    expect(result.message).toContain('Workday')
    expect(result.message).toContain('promoted')
  })

  it('returns error for missing boardId', () => {
    const result = promoteBoard({})

    expect(result.success).toBe(false)
    expect(result.error).toContain('boardId')
  })

  it('returns error for invalid boardId type', () => {
    const result = promoteBoard({ boardId: 123 })

    expect(result.success).toBe(false)
    expect(result.error).toContain('boardId')
  })

  it('returns error when board not in testing', () => {
    vi.mocked(promoteBoardToActive).mockReturnValue({
      success: false,
      error: 'Board not found in testing boards'
    })

    const result = promoteBoard({ boardId: 'lever' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })
})

describe('board tools integration', () => {
  it('workflow: add board -> record results -> analyze -> sync', () => {
    // Step 1: Add a new board for testing
    vi.mocked(addBoardForTesting).mockReturnValue({
      success: true,
      boardId: 'new-ats'
    })
    const addResult = addTestBoard({
      name: 'New ATS',
      domain: 'newats.io'
    })
    expect(addResult.success).toBe(true)

    // Step 2: Record scan results
    vi.mocked(updateBoardMetrics).mockReturnValue({
      success: true,
      board: {
        id: 'new-ats',
        name: 'New ATS',
        metrics: { totalScanned: 20, successfulExtractions: 18, failedExtractions: 2 },
        quality: { rating: 85 }
      }
    })
    const recordResult = recordScanResults({
      boardId: 'new-ats',
      scanned: 20,
      successful: 18,
      failed: 2
    })
    expect(recordResult.success).toBe(true)
    expect(recordResult.updatedMetrics.successRate).toBe(90)

    // Step 3: Analyze all boards
    vi.mocked(analyzeBoardQuality).mockReturnValue({
      totalJobsAnalyzed: 50,
      boardsFound: 3,
      boards: [
        { boardId: 'new-ats', totalJobs: 20, qualityScore: 85, metrics: {}, recentActivity: {} }
      ],
      recommendations: [
        { type: 'success', boardId: 'new-ats', issue: 'High-quality source' }
      ]
    })
    const analyzeResult = analyzeBoards()
    expect(analyzeResult.success).toBe(true)
    expect(analyzeResult.recommendations[0].type).toBe('success')

    // Step 4: Sync quality to registry
    vi.mocked(syncQualityToRegistry).mockReturnValue({
      updated: 1,
      added: 0,
      totalBoards: 3,
      message: 'Synced'
    })
    const syncResult = syncBoardQuality()
    expect(syncResult.success).toBe(true)
    expect(syncResult.updated).toBe(1)

    // Step 5: Promote to active
    vi.mocked(promoteBoardToActive).mockReturnValue({
      success: true,
      board: { id: 'new-ats', name: 'New ATS', status: 'active' }
    })
    const promoteResult = promoteBoard({ boardId: 'new-ats' })
    expect(promoteResult.success).toBe(true)
  })
})
