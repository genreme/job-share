/**
 * Time-in-Stage Service Tests
 *
 * Tests time metrics calculations and bottleneck detection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  calculateTimeInStage,
  calculateTimeToResponse,
  identifyBottlenecks,
  calculateAllStageMetrics
} from './time-in-stage.js'

// =============================================================================
// TEST FIXTURES
// =============================================================================

// Use a fixed "now" for consistent tests
const NOW = new Date('2026-02-03T10:00:00.000Z')

const daysAgo = (days) => {
  const date = new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)
  return date.toISOString().split('T')[0]
}

/**
 * Create a mock job for testing
 */
function createJob(overrides = {}) {
  return {
    id: overrides.id || 1,
    title: overrides.title || 'Software Engineer',
    company: overrides.company || 'Tech Corp',
    status: overrides.status || 'inbox',
    found: overrides.found || daysAgo(14),
    applied: overrides.applied || null,
    fitScore: overrides.fitScore || 75,
    updates: overrides.updates || [],
    ...overrides
  }
}

// Mock Date.now() for consistent testing
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

// =============================================================================
// calculateTimeInStage TESTS
// =============================================================================

describe('calculateTimeInStage', () => {
  describe('empty and null handling', () => {
    it('returns zero metrics for null jobs', () => {
      const result = calculateTimeInStage(null, 'inbox')

      expect(result.averageDays).toBe(0)
      expect(result.medianDays).toBe(0)
      expect(result.sampleSize).toBe(0)
      expect(result.percentiles).toEqual({ p25: 0, p50: 0, p75: 0, p90: 0 })
    })

    it('returns zero metrics for empty array', () => {
      const result = calculateTimeInStage([], 'inbox')

      expect(result.averageDays).toBe(0)
      expect(result.sampleSize).toBe(0)
    })

    it('returns status in result', () => {
      const result = calculateTimeInStage([], 'apply-now')

      expect(result.status).toBe('apply-now')
    })
  })

  describe('single job calculations', () => {
    it('calculates days for job currently in inbox', () => {
      const jobs = [createJob({
        status: 'inbox',
        found: daysAgo(5) // Found 5 days ago, still in inbox
      })]

      const result = calculateTimeInStage(jobs, 'inbox')

      expect(result.sampleSize).toBe(1)
      expect(result.averageDays).toBe(5)
      expect(result.ongoing).toBe(1) // Still in inbox
    })

    it('calculates days for job that left inbox', () => {
      const jobs = [createJob({
        status: 'applied',
        found: daysAgo(10),
        applied: daysAgo(5) // Applied 5 days ago, was in inbox for 5 days
      })]

      const result = calculateTimeInStage(jobs, 'inbox')

      expect(result.sampleSize).toBe(1)
      expect(result.averageDays).toBe(5)
      expect(result.ongoing).toBe(0) // No longer in inbox
    })

    it('calculates days for applied job awaiting response', () => {
      const jobs = [createJob({
        status: 'applied',
        found: daysAgo(10),
        applied: daysAgo(7) // Applied 7 days ago
      })]

      const result = calculateTimeInStage(jobs, 'applied')

      expect(result.sampleSize).toBe(1)
      expect(result.averageDays).toBe(7)
      expect(result.ongoing).toBe(1) // Still waiting
    })
  })

  describe('percentile calculations', () => {
    it('computes percentiles correctly for multiple jobs', () => {
      // Create jobs with varying times in inbox
      const jobs = [
        createJob({ id: 1, status: 'inbox', found: daysAgo(1) }),
        createJob({ id: 2, status: 'inbox', found: daysAgo(3) }),
        createJob({ id: 3, status: 'inbox', found: daysAgo(5) }),
        createJob({ id: 4, status: 'inbox', found: daysAgo(7) }),
        createJob({ id: 5, status: 'inbox', found: daysAgo(10) })
      ]

      const result = calculateTimeInStage(jobs, 'inbox')

      expect(result.sampleSize).toBe(5)
      // Values: [1, 3, 5, 7, 10]
      // Median (p50) = 5
      expect(result.medianDays).toBe(5)
      expect(result.percentiles.p50).toBe(5)
    })

    it('calculates median for even number of samples', () => {
      const jobs = [
        createJob({ id: 1, status: 'inbox', found: daysAgo(2) }),
        createJob({ id: 2, status: 'inbox', found: daysAgo(4) }),
        createJob({ id: 3, status: 'inbox', found: daysAgo(6) }),
        createJob({ id: 4, status: 'inbox', found: daysAgo(8) })
      ]

      const result = calculateTimeInStage(jobs, 'inbox')

      // Values: [2, 4, 6, 8]
      // Median is interpolated: (4 + 6) / 2 = 5
      expect(result.medianDays).toBe(5)
    })
  })

  describe('ongoing job tracking', () => {
    it('counts ongoing jobs in current status', () => {
      const jobs = [
        createJob({ id: 1, status: 'inbox', found: daysAgo(3) }),
        createJob({ id: 2, status: 'inbox', found: daysAgo(5) }),
        createJob({ id: 3, status: 'applied', found: daysAgo(10), applied: daysAgo(7) })
      ]

      const result = calculateTimeInStage(jobs, 'inbox')

      expect(result.ongoing).toBe(2) // 2 jobs still in inbox
    })

    it('uses current date for ongoing jobs', () => {
      const jobs = [createJob({
        status: 'applied',
        found: daysAgo(14),
        applied: daysAgo(7) // Applied 7 days ago, still waiting
      })]

      const result = calculateTimeInStage(jobs, 'applied')

      expect(result.averageDays).toBe(7)
      expect(result.ongoing).toBe(1)
    })
  })
})

// =============================================================================
// calculateTimeToResponse TESTS
// =============================================================================

describe('calculateTimeToResponse', () => {
  describe('empty and null handling', () => {
    it('returns zero metrics for empty jobs', () => {
      const result = calculateTimeToResponse([])

      expect(result.averageDays).toBe(0)
      expect(result.sampleSize).toBe(0)
      expect(result.display).toBe('No data')
    })

    it('returns no responses message for applied jobs without response', () => {
      const jobs = [createJob({
        status: 'applied',
        applied: daysAgo(7),
        updates: [] // No response yet
      })]

      const result = calculateTimeToResponse(jobs)

      expect(result.sampleSize).toBe(0)
      expect(result.display).toBe('No responses recorded')
    })
  })

  describe('response detection', () => {
    it('calculates days from applied to first response', () => {
      const jobs = [createJob({
        status: 'applied',
        applied: daysAgo(10),
        updates: [
          { date: daysAgo(3), notes: 'Heard back from recruiter!' }
        ]
      })]

      const result = calculateTimeToResponse(jobs)

      // Applied 10 days ago, response 3 days ago = 7 days to response
      expect(result.sampleSize).toBe(1)
      expect(result.averageDays).toBe(7)
    })

    it('detects response from interview keywords', () => {
      const jobs = [createJob({
        status: 'applied',
        applied: daysAgo(14),
        updates: [
          { date: daysAgo(7), notes: 'Phone screen scheduled!' }
        ]
      })]

      const result = calculateTimeToResponse(jobs)

      expect(result.sampleSize).toBe(1)
      expect(result.averageDays).toBe(7)
    })

    it('detects response from rejection keywords', () => {
      const jobs = [createJob({
        status: 'applied',
        applied: daysAgo(10),
        updates: [
          { date: daysAgo(5), notes: 'Unfortunately, we are not moving forward.' }
        ]
      })]

      const result = calculateTimeToResponse(jobs)

      expect(result.sampleSize).toBe(1)
      expect(result.averageDays).toBe(5)
    })
  })

  describe('display format', () => {
    it('formats display as "X days avg, 80% within Y days"', () => {
      // Create jobs with known response times
      const jobs = [
        createJob({
          id: 1,
          applied: daysAgo(14),
          updates: [{ date: daysAgo(7), notes: 'Interview scheduled' }]
        }),
        createJob({
          id: 2,
          applied: daysAgo(10),
          updates: [{ date: daysAgo(5), notes: 'Heard back' }]
        }),
        createJob({
          id: 3,
          applied: daysAgo(20),
          updates: [{ date: daysAgo(10), notes: 'Phone screen' }]
        })
      ]

      const result = calculateTimeToResponse(jobs)

      // Response times: 7, 5, 10 days
      expect(result.sampleSize).toBe(3)
      expect(result.display).toMatch(/[\d.]+ days avg, 80% within [\d.]+ days/)
    })
  })

  describe('percentiles', () => {
    it('calculates p80 for response times', () => {
      const jobs = Array.from({ length: 10 }, (_, i) => createJob({
        id: i + 1,
        applied: daysAgo(20),
        updates: [{ date: daysAgo(20 - (i + 1)), notes: 'Response received' }]
      }))

      const result = calculateTimeToResponse(jobs)

      expect(result.sampleSize).toBe(10)
      expect(result.percentiles.p80).toBeGreaterThan(0)
    })
  })
})

// =============================================================================
// identifyBottlenecks TESTS
// =============================================================================

describe('identifyBottlenecks', () => {
  describe('empty and null handling', () => {
    it('returns empty array for null jobs', () => {
      const result = identifyBottlenecks(null)
      expect(result).toEqual([])
    })

    it('returns empty array for empty jobs', () => {
      const result = identifyBottlenecks([])
      expect(result).toEqual([])
    })
  })

  describe('bottleneck detection', () => {
    it('flags stages exceeding default threshold (7 days)', () => {
      const jobs = [
        createJob({ id: 1, status: 'inbox', found: daysAgo(10) }), // 10 days in inbox
        createJob({ id: 2, status: 'inbox', found: daysAgo(12) })  // 12 days in inbox
      ]

      const result = identifyBottlenecks(jobs)

      expect(result.length).toBeGreaterThan(0)
      const inboxBottleneck = result.find(b => b.status === 'inbox')
      expect(inboxBottleneck).toBeDefined()
      expect(inboxBottleneck?.averageDays).toBeGreaterThan(7)
    })

    it('does not flag stages under threshold', () => {
      const jobs = [
        createJob({ id: 1, status: 'inbox', found: daysAgo(3) }),
        createJob({ id: 2, status: 'inbox', found: daysAgo(4) })
      ]

      const result = identifyBottlenecks(jobs)

      const inboxBottleneck = result.find(b => b.status === 'inbox')
      expect(inboxBottleneck).toBeUndefined()
    })

    it('uses custom threshold when provided', () => {
      const jobs = [
        createJob({ id: 1, status: 'inbox', found: daysAgo(5) }),
        createJob({ id: 2, status: 'inbox', found: daysAgo(6) })
      ]

      // Default threshold (7) would not flag, but threshold of 4 should
      const result = identifyBottlenecks(jobs, 4)

      const inboxBottleneck = result.find(b => b.status === 'inbox')
      expect(inboxBottleneck).toBeDefined()
    })
  })

  describe('recommendations', () => {
    it('provides recommendation for inbox bottleneck', () => {
      const jobs = [createJob({ status: 'inbox', found: daysAgo(10) })]

      const result = identifyBottlenecks(jobs)

      const inboxBottleneck = result.find(b => b.status === 'inbox')
      expect(inboxBottleneck?.recommendation).toContain('inbox')
    })

    it('provides recommendation for apply-now bottleneck', () => {
      const jobs = [createJob({ status: 'apply-now', found: daysAgo(10) })]

      const result = identifyBottlenecks(jobs)

      const bottleneck = result.find(b => b.status === 'apply-now')
      expect(bottleneck?.recommendation).toContain('follow-through')
    })

    it('provides recommendation for applied bottleneck', () => {
      const jobs = [createJob({
        status: 'applied',
        found: daysAgo(20),
        applied: daysAgo(15)
      })]

      const result = identifyBottlenecks(jobs)

      const bottleneck = result.find(b => b.status === 'applied')
      expect(bottleneck?.recommendation).toContain('follow-up')
    })
  })

  describe('sorting', () => {
    it('sorts bottlenecks by average days descending', () => {
      const jobs = [
        createJob({ id: 1, status: 'inbox', found: daysAgo(8) }),
        createJob({ id: 2, status: 'apply-now', found: daysAgo(15) })
      ]

      const result = identifyBottlenecks(jobs)

      if (result.length >= 2) {
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].averageDays).toBeGreaterThanOrEqual(result[i + 1].averageDays)
        }
      }
    })
  })
})

// =============================================================================
// calculateAllStageMetrics TESTS
// =============================================================================

describe('calculateAllStageMetrics', () => {
  it('returns metrics for all stages with jobs', () => {
    const jobs = [
      createJob({ id: 1, status: 'inbox', found: daysAgo(3) }),
      createJob({ id: 2, status: 'applied', found: daysAgo(10), applied: daysAgo(5) })
    ]

    const result = calculateAllStageMetrics(jobs)

    // Should have metrics for inbox (all jobs) and applied
    expect(result.length).toBeGreaterThan(0)

    const inboxMetrics = result.find(m => m.status === 'inbox')
    expect(inboxMetrics).toBeDefined()
    expect(inboxMetrics?.sampleSize).toBeGreaterThan(0)
  })

  it('filters out stages with no sample', () => {
    const jobs = [createJob({ status: 'inbox', found: daysAgo(3) })]

    const result = calculateAllStageMetrics(jobs)

    // Should not have metrics for statuses with no jobs
    const archivedMetrics = result.find(m => m.status === 'archived')
    expect(archivedMetrics).toBeUndefined()
  })
})

// =============================================================================
// EDGE CASES
// =============================================================================

describe('edge cases', () => {
  it('handles jobs with missing found date', () => {
    const jobs = [createJob({
      status: 'inbox',
      found: null
    })]

    const result = calculateTimeInStage(jobs, 'inbox')

    // Should handle gracefully (either skip or use defaults)
    expect(result).toBeDefined()
  })

  it('handles jobs with invalid date strings', () => {
    const jobs = [createJob({
      status: 'inbox',
      found: 'not-a-date'
    })]

    const result = calculateTimeInStage(jobs, 'inbox')

    expect(result).toBeDefined()
  })

  it('handles updates with timestamp instead of date', () => {
    const jobs = [createJob({
      status: 'applied',
      applied: daysAgo(10),
      updates: [
        { timestamp: daysAgo(5), notes: 'Got a response!' }
      ]
    })]

    const result = calculateTimeToResponse(jobs)

    expect(result.sampleSize).toBe(1)
  })
})
