/**
 * Board Registry Service Tests
 *
 * Tests for board registry loading, saving, and blacklisting.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs')
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    renameSync: vi.fn()
  }
})

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

// Import after mocking
import {
  loadBoardRegistry,
  saveBoardRegistry,
  getBoardsForScan,
  addBoardForTesting,
  updateBoardMetrics,
  blacklistBoard,
  promoteBoardToActive,
  getBoardById,
  createDefaultRegistry
} from './board-registry.js'

// Test fixtures
function createTestRegistry() {
  return {
    version: '1.0',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-31T00:00:00Z',
    boards: [
      {
        id: 'lever',
        name: 'Lever',
        domain: 'jobs.lever.co',
        status: 'active',
        quality: { rating: 95, dataCompleteness: 90 },
        metrics: { totalScanned: 100, successfulExtractions: 95, failedExtractions: 5 }
      },
      {
        id: 'greenhouse',
        name: 'Greenhouse',
        domain: 'boards.greenhouse.io',
        status: 'active',
        quality: { rating: 85, dataCompleteness: 80 },
        metrics: { totalScanned: 50, successfulExtractions: 40, failedExtractions: 10 }
      },
      {
        id: 'indeed',
        name: 'Indeed',
        domain: 'indeed.com',
        status: 'active',
        quality: { rating: 60, dataCompleteness: 55 },
        metrics: { totalScanned: 200, successfulExtractions: 120, failedExtractions: 80 }
      }
    ],
    blacklist: [],
    testingBoards: [
      {
        id: 'workday',
        name: 'Workday',
        domain: 'myworkday.com',
        status: 'testing',
        quality: { rating: 0 },
        metrics: { totalScanned: 0 }
      }
    ]
  }
}

describe('board-registry service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createDefaultRegistry', () => {
    it('creates empty registry with required structure', () => {
      const registry = createDefaultRegistry()

      expect(registry.version).toBe('1.0')
      expect(registry.boards).toEqual([])
      expect(registry.blacklist).toEqual([])
      expect(registry.testingBoards).toEqual([])
    })
  })

  describe('loadBoardRegistry', () => {
    it('returns empty registry when file does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const registry = loadBoardRegistry()

      expect(registry.boards).toEqual([])
      expect(registry.blacklist).toEqual([])
    })

    it('loads registry from file', () => {
      const testRegistry = createTestRegistry()
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(testRegistry))

      const registry = loadBoardRegistry()

      expect(registry.boards).toHaveLength(3)
      expect(registry.boards[0].name).toBe('Lever')
    })

    it('returns empty registry on parse error', () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue('not json')

      const registry = loadBoardRegistry()

      expect(registry.boards).toEqual([])
    })
  })

  describe('saveBoardRegistry', () => {
    it('writes registry atomically', () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const registry = createTestRegistry()
      const result = saveBoardRegistry(registry)

      expect(result.success).toBe(true)
      expect(writeFileSync).toHaveBeenCalled()
    })

    it('creates directory if missing', () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const registry = createDefaultRegistry()
      saveBoardRegistry(registry)

      expect(mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true })
    })
  })

  describe('getBoardsForScan', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(createTestRegistry()))
    })

    it('returns active boards sorted by quality', () => {
      const boards = getBoardsForScan()

      expect(boards).toHaveLength(3)
      expect(boards[0].id).toBe('lever') // 95 rating
      expect(boards[1].id).toBe('greenhouse') // 85 rating
      expect(boards[2].id).toBe('indeed') // 60 rating
    })

    it('filters by minimum quality', () => {
      const boards = getBoardsForScan({ minQuality: 80 })

      expect(boards).toHaveLength(2)
      expect(boards.every(b => b.quality.rating >= 80)).toBe(true)
    })

    it('excludes blacklisted boards by default', () => {
      const registry = createTestRegistry()
      registry.blacklist.push({ boardId: 'lever' })
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(registry))

      const boards = getBoardsForScan()

      expect(boards.find(b => b.id === 'lever')).toBeUndefined()
    })

    it('includes blacklisted when requested', () => {
      const registry = createTestRegistry()
      registry.blacklist.push({ boardId: 'lever' })
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(registry))

      const boards = getBoardsForScan({ includeBlacklisted: true })

      expect(boards.find(b => b.id === 'lever')).toBeDefined()
    })

    it('does not include testing boards', () => {
      const boards = getBoardsForScan()

      expect(boards.find(b => b.id === 'workday')).toBeUndefined()
    })
  })

  describe('addBoardForTesting', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(createTestRegistry()))
    })

    it('returns error for missing name', () => {
      const result = addBoardForTesting({ domain: 'test.com' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('name')
    })

    it('returns error for missing domain', () => {
      const result = addBoardForTesting({ name: 'Test Board' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('domain')
    })

    it('returns error for duplicate domain in active boards', () => {
      const result = addBoardForTesting({ name: 'New Lever', domain: 'jobs.lever.co' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('already exists')
    })

    it('returns error for duplicate domain in testing boards', () => {
      const result = addBoardForTesting({ name: 'New Workday', domain: 'myworkday.com' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('already in testing')
    })

    it('adds board to testing queue', () => {
      const result = addBoardForTesting({
        name: 'New Board',
        domain: 'newboard.com',
        notes: 'Testing this board'
      })

      expect(result.success).toBe(true)
      expect(result.boardId).toBe('new-board')
    })

    it('generates board ID from name', () => {
      const result = addBoardForTesting({
        name: 'My Awesome Job Board!',
        domain: 'awesome.com'
      })

      expect(result.success).toBe(true)
      expect(result.boardId).toBe('my-awesome-job-board-')
    })
  })

  describe('updateBoardMetrics', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(createTestRegistry()))
    })

    it('returns error for missing boardId', () => {
      const result = updateBoardMetrics({ scanned: 10, successful: 8, failed: 2 })

      expect(result.success).toBe(false)
      expect(result.error).toContain('boardId')
    })

    it('returns error for negative scanned count', () => {
      const result = updateBoardMetrics({ boardId: 'lever', scanned: -1, successful: 0, failed: 0 })

      expect(result.success).toBe(false)
      expect(result.error).toContain('non-negative')
    })

    it('returns error for unknown board', () => {
      const result = updateBoardMetrics({ boardId: 'unknown', scanned: 10, successful: 8, failed: 2 })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('updates metrics for active board', () => {
      const result = updateBoardMetrics({
        boardId: 'lever',
        scanned: 10,
        successful: 9,
        failed: 1
      })

      expect(result.success).toBe(true)
      expect(result.board.metrics.totalScanned).toBe(110) // 100 + 10
    })

    it('updates metrics for testing board', () => {
      const result = updateBoardMetrics({
        boardId: 'workday',
        scanned: 5,
        successful: 4,
        failed: 1
      })

      expect(result.success).toBe(true)
      expect(result.board.metrics.totalScanned).toBe(5)
    })

    it('recalculates quality rating based on success rate', () => {
      const result = updateBoardMetrics({
        boardId: 'workday',
        scanned: 100,
        successful: 80,
        failed: 20
      })

      expect(result.success).toBe(true)
      // 80% success rate * 70 + 50% default base completeness * 30 = 56 + 15 = 71
      expect(result.board.quality.rating).toBe(71)
    })
  })

  describe('blacklistBoard', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(createTestRegistry()))
    })

    it('returns error without userConfirmed=true', () => {
      const result = blacklistBoard({ boardId: 'indeed', reason: 'Low quality' })

      expect(result.success).toBe(false)
      expect(result.requiresConfirmation).toBe(true)
      expect(result.error).toContain('userConfirmed=true')
    })

    it('returns error for userConfirmed=false', () => {
      const result = blacklistBoard({ boardId: 'indeed', reason: 'Low quality', userConfirmed: false })

      expect(result.success).toBe(false)
      expect(result.requiresConfirmation).toBe(true)
    })

    it('returns error for missing boardId', () => {
      const result = blacklistBoard({ reason: 'Test', userConfirmed: true })

      expect(result.success).toBe(false)
      expect(result.error).toContain('boardId')
    })

    it('returns error for missing reason', () => {
      const result = blacklistBoard({ boardId: 'indeed', userConfirmed: true })

      expect(result.success).toBe(false)
      expect(result.error).toContain('reason')
    })

    it('returns error for unknown board', () => {
      const result = blacklistBoard({ boardId: 'unknown', reason: 'Test', userConfirmed: true })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('blacklists active board when confirmed', () => {
      const result = blacklistBoard({
        boardId: 'indeed',
        reason: 'Consistently low data quality',
        userConfirmed: true
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain('Indeed')
      expect(result.message).toContain('blacklisted')
    })

    it('returns error if already blacklisted', () => {
      const registry = createTestRegistry()
      registry.blacklist.push({ boardId: 'indeed' })
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(registry))

      const result = blacklistBoard({
        boardId: 'indeed',
        reason: 'Double blacklist',
        userConfirmed: true
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('already blacklisted')
    })

    it('blacklists testing board (removes from testing)', () => {
      const result = blacklistBoard({
        boardId: 'workday',
        reason: 'Failed testing',
        userConfirmed: true
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain('Workday')
    })
  })

  describe('promoteBoardToActive', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(createTestRegistry()))
    })

    it('returns error for missing boardId', () => {
      const result = promoteBoardToActive({})

      expect(result.success).toBe(false)
      expect(result.error).toContain('boardId')
    })

    it('returns error for board not in testing', () => {
      const result = promoteBoardToActive({ boardId: 'lever' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found in testing')
    })

    it('promotes testing board to active', () => {
      const result = promoteBoardToActive({ boardId: 'workday' })

      expect(result.success).toBe(true)
      expect(result.board.status).toBe('active')
      expect(result.board.promotedAt).toBeDefined()
    })
  })

  describe('getBoardById', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(createTestRegistry()))
    })

    it('returns null for null boardId', () => {
      const board = getBoardById(null)
      expect(board).toBeNull()
    })

    it('returns active board by id', () => {
      const board = getBoardById('lever')

      expect(board).not.toBeNull()
      expect(board.name).toBe('Lever')
    })

    it('returns testing board by id', () => {
      const board = getBoardById('workday')

      expect(board).not.toBeNull()
      expect(board.name).toBe('Workday')
    })

    it('returns null for unknown id', () => {
      const board = getBoardById('unknown')
      expect(board).toBeNull()
    })
  })
})

describe('board-registry quality prioritization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(createTestRegistry()))
  })

  it('DISC-13: high-quality boards appear first in scan list', () => {
    const boards = getBoardsForScan()

    // Verify sorted by quality (highest first)
    for (let i = 1; i < boards.length; i++) {
      const current = boards[i].quality?.rating || 0
      const previous = boards[i - 1].quality?.rating || 0
      expect(previous).toBeGreaterThanOrEqual(current)
    }
  })
})

describe('board-registry blacklist safety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(createTestRegistry()))
  })

  it('DISC-14: blacklistBoard requires explicit userConfirmed=true', () => {
    // Without userConfirmed
    const result1 = blacklistBoard({ boardId: 'indeed', reason: 'Test' })
    expect(result1.success).toBe(false)
    expect(result1.requiresConfirmation).toBe(true)

    // With userConfirmed=false
    const result2 = blacklistBoard({ boardId: 'indeed', reason: 'Test', userConfirmed: false })
    expect(result2.success).toBe(false)
    expect(result2.requiresConfirmation).toBe(true)

    // With userConfirmed=true
    const result3 = blacklistBoard({ boardId: 'indeed', reason: 'Test', userConfirmed: true })
    expect(result3.success).toBe(true)
  })

  it('blacklisted boards excluded from getBoardsForScan by default', () => {
    const registry = createTestRegistry()
    registry.blacklist.push({ boardId: 'greenhouse' })
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(registry))

    const boards = getBoardsForScan()
    const blacklistedBoard = boards.find(b => b.id === 'greenhouse')

    expect(blacklistedBoard).toBeUndefined()
  })
})
