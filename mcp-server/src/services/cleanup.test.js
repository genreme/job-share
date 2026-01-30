/**
 * Cleanup Service Tests
 *
 * Tests the cleanup orchestrator that coordinates all detectors.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock the profile-loader and detectors
vi.mock('../data/profile-loader.js', () => ({
  loadProfile: vi.fn()
}))

vi.mock('./duplicate-detector.js', () => ({
  detectDuplicates: vi.fn()
}))

vi.mock('./staleness-detector.js', () => ({
  detectStaleItems: vi.fn()
}))

vi.mock('./gap-detector.js', () => ({
  detectGaps: vi.fn()
}))

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

import {
  runCleanupAnalysis,
  checkCleanupOverdue,
  getStoredFindings,
  dismissFinding,
  generateFindingHash
} from './cleanup.js'

import { loadProfile } from '../data/profile-loader.js'
import { detectDuplicates } from './duplicate-detector.js'
import { detectStaleItems } from './staleness-detector.js'
import { detectGaps } from './gap-detector.js'
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'fs'

// =============================================================================
// TEST FIXTURES
// =============================================================================

const mockProfile = {
  metadata: { version: 1, schemaVersion: '1.0' },
  experience: [],
  skills: [],
  summaryBlocks: [],
  stories: [],
  preferences: {}
}

const mockDuplicateFinding = {
  type: 'duplicate',
  entityType: 'skill',
  ids: ['skill-1', 'skill-2'],
  similarity: 95,
  reason: "Skills 'React' and 'ReactJS' are 95% similar",
  suggestion: 'Consider merging',
  createdAt: '2026-01-30T10:00:00.000Z'
}

const mockStaleFinding = {
  type: 'stale',
  entityType: 'story',
  ids: ['story-1'],
  reason: 'Not updated in 200 days',
  suggestion: 'Review and update',
  createdAt: '2026-01-30T10:00:00.000Z'
}

const mockGapFinding = {
  type: 'gap',
  entityType: 'experience',
  ids: ['preferences.targetRoles'],
  reason: 'No target roles defined',
  suggestion: 'Define target roles',
  createdAt: '2026-01-30T10:00:00.000Z'
}

// =============================================================================
// TESTS
// =============================================================================

describe('Cleanup Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-30T10:00:00.000Z'))

    // Default mock returns
    vi.mocked(loadProfile).mockReturnValue(mockProfile)
    vi.mocked(detectDuplicates).mockReturnValue([mockDuplicateFinding])
    vi.mocked(detectStaleItems).mockReturnValue([mockStaleFinding])
    vi.mocked(detectGaps).mockReturnValue([mockGapFinding])
    vi.mocked(existsSync).mockReturnValue(false)
    vi.mocked(mkdirSync).mockReturnValue(undefined)
    vi.mocked(writeFileSync).mockReturnValue(undefined)
    vi.mocked(renameSync).mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('runCleanupAnalysis', () => {
    it('runs all three detectors', () => {
      const result = runCleanupAnalysis()

      expect(detectDuplicates).toHaveBeenCalled()
      expect(detectStaleItems).toHaveBeenCalled()
      expect(detectGaps).toHaveBeenCalled()
    })

    it('returns results from all detectors', () => {
      const result = runCleanupAnalysis()

      expect(result.duplicates).toHaveLength(1)
      expect(result.stale).toHaveLength(1)
      expect(result.gaps).toHaveLength(1)
    })

    it('includes runAt timestamp', () => {
      const result = runCleanupAnalysis()

      expect(result.runAt).toBe('2026-01-30T10:00:00.000Z')
    })

    it('includes status', () => {
      const result = runCleanupAnalysis()

      expect(result.status).toBe('complete')
    })

    it('loads profile when not provided', () => {
      runCleanupAnalysis()

      expect(loadProfile).toHaveBeenCalled()
    })

    it('uses provided profile when given', () => {
      const customProfile = { ...mockProfile, customField: true }

      runCleanupAnalysis(customProfile)

      expect(loadProfile).not.toHaveBeenCalled()
      expect(detectDuplicates).toHaveBeenCalledWith(customProfile, {})
    })

    it('passes jobContext to gap detector', () => {
      const jobContext = { title: 'Engineering Manager', company: 'TechCorp' }

      runCleanupAnalysis(null, { jobContext })

      expect(detectGaps).toHaveBeenCalledWith(expect.anything(), jobContext)
    })

    it('passes options to detectors', () => {
      const duplicateOptions = { threshold: 0.9 }
      const stalenessOptions = { documentHistoryPath: '/custom/path' }

      runCleanupAnalysis(null, { duplicateOptions, stalenessOptions })

      expect(detectDuplicates).toHaveBeenCalledWith(expect.anything(), duplicateOptions)
      expect(detectStaleItems).toHaveBeenCalledWith(expect.anything(), stalenessOptions)
    })

    it('saves findings after analysis', () => {
      runCleanupAnalysis()

      expect(writeFileSync).toHaveBeenCalled()
      expect(renameSync).toHaveBeenCalled()
    })

    it('returns error status on detector failure', () => {
      vi.mocked(detectDuplicates).mockImplementation(() => {
        throw new Error('Detector failed')
      })

      const result = runCleanupAnalysis()

      expect(result.status).toBe('error')
      expect(result.duplicates).toEqual([])
    })
  })

  describe('checkCleanupOverdue', () => {
    it('returns overdue true when no previous run', () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const result = checkCleanupOverdue()

      expect(result.overdue).toBe(true)
      expect(result.lastRun).toBeNull()
      expect(result.daysSince).toBeNull()
    })

    it('returns overdue true when last run > 7 days ago', () => {
      const oldRunDate = new Date('2026-01-20T10:00:00.000Z').toISOString() // 10 days ago
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          lastRun: oldRunDate,
          runs: []
        })
      )

      const result = checkCleanupOverdue()

      expect(result.overdue).toBe(true)
      expect(result.daysSince).toBe(10)
    })

    it('returns overdue false when last run < 7 days ago', () => {
      const recentRunDate = new Date('2026-01-28T10:00:00.000Z').toISOString() // 2 days ago
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          lastRun: recentRunDate,
          runs: []
        })
      )

      const result = checkCleanupOverdue()

      expect(result.overdue).toBe(false)
      expect(result.daysSince).toBe(2)
    })

    it('returns overdue true at exactly 7 days', () => {
      const exactlySevenDays = new Date('2026-01-23T10:00:00.000Z').toISOString()
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          lastRun: exactlySevenDays,
          runs: []
        })
      )

      const result = checkCleanupOverdue()

      expect(result.overdue).toBe(true)
      expect(result.daysSince).toBe(7)
    })
  })

  describe('getStoredFindings', () => {
    it('returns null when no findings file exists', () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const result = getStoredFindings()

      expect(result).toBeNull()
    })

    it('returns stored findings when file exists', () => {
      const storedData = {
        lastRun: '2026-01-30T10:00:00.000Z',
        runs: [{ duplicates: [], stale: [], gaps: [], status: 'complete' }],
        dismissed: []
      }
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(storedData))

      const result = getStoredFindings()

      expect(result).toEqual(storedData)
    })

    it('returns null on parse error', () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue('invalid json')

      const result = getStoredFindings()

      expect(result).toBeNull()
    })
  })

  describe('dismissFinding', () => {
    it('returns false when no stored findings exist', () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const result = dismissFinding('hash123')

      expect(result).toBe(false)
    })

    it('adds dismissal to stored findings', () => {
      const storedData = {
        lastRun: '2026-01-30T10:00:00.000Z',
        runs: [],
        dismissed: []
      }
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(storedData))

      const result = dismissFinding('hash123', 'Not a real duplicate')

      expect(result).toBe(true)
      expect(writeFileSync).toHaveBeenCalled()

      // Check that the written data includes the dismissal
      const writtenData = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1])
      expect(writtenData.dismissed).toHaveLength(1)
      expect(writtenData.dismissed[0].findingHash).toBe('hash123')
      expect(writtenData.dismissed[0].reason).toBe('Not a real duplicate')
    })

    it('handles missing reason', () => {
      const storedData = {
        lastRun: '2026-01-30T10:00:00.000Z',
        runs: [],
        dismissed: []
      }
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(storedData))

      const result = dismissFinding('hash123')

      expect(result).toBe(true)
      const writtenData = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1])
      expect(writtenData.dismissed[0].reason).toBeUndefined()
    })
  })

  describe('generateFindingHash', () => {
    it('generates consistent hash for same finding', () => {
      const hash1 = generateFindingHash(mockDuplicateFinding)
      const hash2 = generateFindingHash(mockDuplicateFinding)

      expect(hash1).toBe(hash2)
    })

    it('generates different hash for different findings', () => {
      const hash1 = generateFindingHash(mockDuplicateFinding)
      const hash2 = generateFindingHash(mockStaleFinding)

      expect(hash1).not.toBe(hash2)
    })

    it('generates different hash when ids differ', () => {
      const finding1 = { ...mockDuplicateFinding, ids: ['a', 'b'] }
      const finding2 = { ...mockDuplicateFinding, ids: ['b', 'c'] }

      const hash1 = generateFindingHash(finding1)
      const hash2 = generateFindingHash(finding2)

      expect(hash1).not.toBe(hash2)
    })

    it('generates same hash regardless of id order', () => {
      const finding1 = { ...mockDuplicateFinding, ids: ['a', 'b'] }
      const finding2 = { ...mockDuplicateFinding, ids: ['b', 'a'] }

      const hash1 = generateFindingHash(finding1)
      const hash2 = generateFindingHash(finding2)

      expect(hash1).toBe(hash2)
    })

    it('returns hexadecimal string', () => {
      const hash = generateFindingHash(mockDuplicateFinding)

      expect(hash).toMatch(/^[0-9a-f]+$/)
    })
  })
})
