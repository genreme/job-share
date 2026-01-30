/**
 * Cleanup Tools Tests
 *
 * Tests MCP tool implementations for cleanup workflow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the cleanup service
vi.mock('../services/cleanup.js', () => ({
  runCleanupAnalysis: vi.fn(),
  checkCleanupOverdue: vi.fn(),
  getStoredFindings: vi.fn(),
  dismissFinding: vi.fn(),
  generateFindingHash: vi.fn()
}))

import { runWeeklyCleanup, getCleanupFindings, dismissCleanupFinding } from './cleanup.js'

import {
  runCleanupAnalysis,
  checkCleanupOverdue,
  getStoredFindings,
  dismissFinding,
  generateFindingHash
} from '../services/cleanup.js'

// =============================================================================
// TEST FIXTURES
// =============================================================================

const mockCleanupResult = {
  runAt: '2026-01-30T10:00:00.000Z',
  duplicates: [
    {
      type: 'duplicate',
      entityType: 'skill',
      ids: ['skill-1', 'skill-2'],
      similarity: 95,
      reason: "Skills are 95% similar",
      suggestion: 'Consider merging',
      createdAt: '2026-01-30T10:00:00.000Z'
    }
  ],
  stale: [
    {
      type: 'stale',
      entityType: 'story',
      ids: ['story-1'],
      reason: 'Not updated in 200 days',
      suggestion: 'Review and update',
      createdAt: '2026-01-30T10:00:00.000Z'
    }
  ],
  gaps: [
    {
      type: 'gap',
      entityType: 'experience',
      ids: ['preferences.targetRoles'],
      reason: 'No target roles defined',
      suggestion: 'Define target roles',
      createdAt: '2026-01-30T10:00:00.000Z'
    }
  ],
  status: 'complete'
}

const mockStoredFindings = {
  lastRun: '2026-01-30T10:00:00.000Z',
  runs: [mockCleanupResult],
  dismissed: []
}

// =============================================================================
// TESTS
// =============================================================================

describe('Cleanup Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock returns
    vi.mocked(runCleanupAnalysis).mockReturnValue(mockCleanupResult)
    vi.mocked(checkCleanupOverdue).mockReturnValue({
      overdue: false,
      daysSince: 0,
      lastRun: '2026-01-30T10:00:00.000Z'
    })
    vi.mocked(getStoredFindings).mockReturnValue(mockStoredFindings)
    vi.mocked(dismissFinding).mockReturnValue(true)
    vi.mocked(generateFindingHash).mockImplementation((f) => `hash-${f.type}-${f.ids[0]}`)
  })

  describe('runWeeklyCleanup', () => {
    it('calls runCleanupAnalysis', () => {
      runWeeklyCleanup()

      expect(runCleanupAnalysis).toHaveBeenCalled()
    })

    it('returns success with summary counts', () => {
      const result = runWeeklyCleanup()

      expect(result.success).toBe(true)
      expect(result.summary.duplicates).toBe(1)
      expect(result.summary.stale).toBe(1)
      expect(result.summary.gaps).toBe(1)
      expect(result.summary.total).toBe(3)
    })

    it('returns formatted findings', () => {
      const result = runWeeklyCleanup()

      expect(result.findings.duplicates).toHaveLength(1)
      expect(result.findings.duplicates[0].type).toBe('duplicate')
      expect(result.findings.duplicates[0].reason).toBeDefined()
      expect(result.findings.duplicates[0].suggestion).toBeDefined()
    })

    it('passes jobContext when provided', () => {
      const jobContext = { title: 'Engineering Manager', company: 'TechCorp' }

      runWeeklyCleanup({ jobContext })

      expect(runCleanupAnalysis).toHaveBeenCalledWith(null, { jobContext })
    })

    it('returns runAt and status', () => {
      const result = runWeeklyCleanup()

      expect(result.runAt).toBe('2026-01-30T10:00:00.000Z')
      expect(result.status).toBe('complete')
    })

    it('handles errors gracefully', () => {
      vi.mocked(runCleanupAnalysis).mockImplementation(() => {
        throw new Error('Analysis failed')
      })

      const result = runWeeklyCleanup()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Analysis failed')
    })
  })

  describe('getCleanupFindings', () => {
    it('returns hasFindings false when no previous run', () => {
      vi.mocked(getStoredFindings).mockReturnValue(null)

      const result = getCleanupFindings()

      expect(result.success).toBe(true)
      expect(result.hasFindings).toBe(false)
      expect(result.message).toContain('No cleanup has been run')
    })

    it('returns hasFindings false when runs array empty', () => {
      vi.mocked(getStoredFindings).mockReturnValue({
        lastRun: '2026-01-30T10:00:00.000Z',
        runs: [],
        dismissed: []
      })

      const result = getCleanupFindings()

      expect(result.hasFindings).toBe(false)
    })

    it('returns findings from most recent run', () => {
      const result = getCleanupFindings()

      expect(result.success).toBe(true)
      expect(result.hasFindings).toBe(true)
      expect(result.findings.length).toBe(3) // 1 duplicate + 1 stale + 1 gap
    })

    it('includes counts summary', () => {
      const result = getCleanupFindings()

      expect(result.counts.duplicates).toBe(1)
      expect(result.counts.stale).toBe(1)
      expect(result.counts.gaps).toBe(1)
      expect(result.counts.active).toBe(3)
    })

    it('filters by type when specified', () => {
      const duplicateResult = getCleanupFindings({ filterType: 'duplicate' })
      expect(duplicateResult.findings).toHaveLength(1)
      expect(duplicateResult.findings[0].type).toBe('duplicate')

      const staleResult = getCleanupFindings({ filterType: 'stale' })
      expect(staleResult.findings).toHaveLength(1)
      expect(staleResult.findings[0].type).toBe('stale')

      const gapResult = getCleanupFindings({ filterType: 'gap' })
      expect(gapResult.findings).toHaveLength(1)
      expect(gapResult.findings[0].type).toBe('gap')
    })

    it('excludes dismissed findings', () => {
      vi.mocked(getStoredFindings).mockReturnValue({
        ...mockStoredFindings,
        dismissed: [{ findingHash: 'hash-duplicate-skill-1', dismissedAt: '2026-01-30T10:00:00.000Z' }]
      })

      const result = getCleanupFindings()

      expect(result.findings).toHaveLength(2) // 3 - 1 dismissed
      expect(result.counts.dismissed).toBe(1)
    })

    it('includes hash for each finding', () => {
      const result = getCleanupFindings()

      result.findings.forEach((f) => {
        expect(f.hash).toBeDefined()
      })
    })

    it('includes overdueCheck', () => {
      const result = getCleanupFindings()

      expect(result.overdueCheck).toBeDefined()
      expect(result.overdueCheck.overdue).toBe(false)
    })

    it('handles errors gracefully', () => {
      vi.mocked(getStoredFindings).mockImplementation(() => {
        throw new Error('Storage error')
      })

      const result = getCleanupFindings()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Storage error')
    })
  })

  describe('dismissCleanupFinding', () => {
    it('requires findingHash parameter', () => {
      const result = dismissCleanupFinding({})

      expect(result.success).toBe(false)
      expect(result.error).toContain('findingHash parameter is required')
    })

    it('calls dismissFinding service', () => {
      dismissCleanupFinding({ findingHash: 'hash123' })

      expect(dismissFinding).toHaveBeenCalledWith('hash123', null)
    })

    it('passes reason when provided', () => {
      dismissCleanupFinding({ findingHash: 'hash123', reason: 'Not a real duplicate' })

      expect(dismissFinding).toHaveBeenCalledWith('hash123', 'Not a real duplicate')
    })

    it('returns success message', () => {
      const result = dismissCleanupFinding({ findingHash: 'hash123' })

      expect(result.success).toBe(true)
      expect(result.message).toContain('hash123')
      expect(result.message).toContain('dismissed')
    })

    it('returns failure when service fails', () => {
      vi.mocked(dismissFinding).mockReturnValue(false)

      const result = dismissCleanupFinding({ findingHash: 'hash123' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('no stored findings')
    })

    it('handles errors gracefully', () => {
      vi.mocked(dismissFinding).mockImplementation(() => {
        throw new Error('Dismiss error')
      })

      const result = dismissCleanupFinding({ findingHash: 'hash123' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Dismiss error')
    })
  })
})
