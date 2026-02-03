/**
 * Response Rate Analyzer Service Tests
 *
 * Tests response rate calculations with confidence levels and dimension breakdowns.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateResponseRate,
  calculateAcknowledgmentRate,
  calculateRatesByDimension,
  calculateAcknowledgmentRatesByDimension,
  VALID_DIMENSIONS
} from './response-rate-analyzer.js'

// =============================================================================
// TEST FIXTURES
// =============================================================================

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
    industry: overrides.industry || null,
    companySize: overrides.companySize || null,
    applicationMethod: overrides.applicationMethod || null,
    roleType: overrides.roleType || null,
    sources: overrides.sources || [],
    updates: overrides.updates || [],
    ...overrides
  }
}

/**
 * Create an applied job
 */
function createAppliedJob(overrides = {}) {
  return createJob({
    status: 'applied',
    applied: daysAgo(7),
    ...overrides
  })
}

/**
 * Create a job with positive response (interview)
 */
function createInterviewJob(overrides = {}) {
  return createAppliedJob({
    updates: [
      { date: daysAgo(3), notes: 'Phone screen scheduled!' }
    ],
    ...overrides
  })
}

/**
 * Create a job with rejection response
 */
function createRejectedJob(overrides = {}) {
  return createAppliedJob({
    updates: [
      { date: daysAgo(2), notes: 'Unfortunately, we decided not to move forward.' }
    ],
    ...overrides
  })
}

// =============================================================================
// calculateResponseRate TESTS
// =============================================================================

describe('calculateResponseRate', () => {
  describe('empty and null handling', () => {
    it('returns 0% rate with n=0 for null jobs', () => {
      const result = calculateResponseRate(null)

      expect(result.rate).toBe(0)
      expect(result.sampleSize).toBe(0)
      expect(result.confidence).toBe('very-low')
      expect(result.display).toBe('0% (n=0) low confidence')
    })

    it('returns 0% rate with n=0 for empty array', () => {
      const result = calculateResponseRate([])

      expect(result.rate).toBe(0)
      expect(result.sampleSize).toBe(0)
      expect(result.confidence).toBe('very-low')
    })

    it('returns 0% for jobs with no applied status', () => {
      const jobs = [
        createJob({ status: 'inbox' }),
        createJob({ status: 'apply-now' }),
        createJob({ status: 'maybe' })
      ]
      const result = calculateResponseRate(jobs)

      expect(result.rate).toBe(0)
      expect(result.sampleSize).toBe(0)
    })
  })

  describe('confidence levels', () => {
    it('returns very-low confidence for n=3', () => {
      const jobs = [
        createAppliedJob({ id: 1 }),
        createAppliedJob({ id: 2 }),
        createInterviewJob({ id: 3 })
      ]
      const result = calculateResponseRate(jobs)

      expect(result.sampleSize).toBe(3)
      expect(result.confidence).toBe('very-low')
      expect(result.display).toContain('low confidence')
    })

    it('returns low confidence for n=7', () => {
      const jobs = Array.from({ length: 7 }, (_, i) =>
        createAppliedJob({ id: i + 1 })
      )
      const result = calculateResponseRate(jobs)

      expect(result.sampleSize).toBe(7)
      expect(result.confidence).toBe('low')
      expect(result.display).toContain('low confidence')
    })

    it('returns medium confidence for n=15', () => {
      const jobs = Array.from({ length: 15 }, (_, i) =>
        createAppliedJob({ id: i + 1 })
      )
      const result = calculateResponseRate(jobs)

      expect(result.sampleSize).toBe(15)
      expect(result.confidence).toBe('medium')
      expect(result.display).not.toContain('low confidence')
    })

    it('returns high confidence for n=30', () => {
      const jobs = Array.from({ length: 30 }, (_, i) =>
        createAppliedJob({ id: i + 1 })
      )
      const result = calculateResponseRate(jobs)

      expect(result.sampleSize).toBe(30)
      expect(result.confidence).toBe('high')
      expect(result.display).not.toContain('low confidence')
    })
  })

  describe('rate calculation', () => {
    it('calculates 0% when no positive responses', () => {
      const jobs = [
        createAppliedJob({ id: 1 }),
        createAppliedJob({ id: 2 }),
        createAppliedJob({ id: 3 }),
        createAppliedJob({ id: 4 }),
        createAppliedJob({ id: 5 })
      ]
      const result = calculateResponseRate(jobs)

      expect(result.rate).toBe(0)
      expect(result.positiveResponses).toBe(0)
      expect(result.sampleSize).toBe(5)
    })

    it('calculates 100% when all have positive responses', () => {
      const jobs = [
        createInterviewJob({ id: 1 }),
        createInterviewJob({ id: 2 }),
        createInterviewJob({ id: 3 }),
        createInterviewJob({ id: 4 }),
        createInterviewJob({ id: 5 })
      ]
      const result = calculateResponseRate(jobs)

      expect(result.rate).toBe(1)
      expect(result.positiveResponses).toBe(5)
      expect(result.display).toContain('100%')
    })

    it('calculates correct rate for mixed responses', () => {
      const jobs = [
        createInterviewJob({ id: 1 }), // positive
        createInterviewJob({ id: 2 }), // positive
        createAppliedJob({ id: 3 }),   // no response
        createAppliedJob({ id: 4 }),   // no response
        createRejectedJob({ id: 5 })   // rejection (not positive)
      ]
      const result = calculateResponseRate(jobs)

      // 2 out of 5 = 40%
      expect(result.rate).toBe(0.4)
      expect(result.positiveResponses).toBe(2)
      expect(result.display).toContain('40%')
    })

    it('detects positive response from interview keyword', () => {
      const jobs = [createAppliedJob({
        updates: [{ notes: 'Technical assessment scheduled' }]
      })]
      const result = calculateResponseRate(jobs)

      expect(result.positiveResponses).toBe(1)
    })

    it('detects positive response from offer keyword', () => {
      const jobs = [createAppliedJob({
        updates: [{ notes: 'Received offer!' }]
      })]
      const result = calculateResponseRate(jobs)

      expect(result.positiveResponses).toBe(1)
    })

    it('detects positive response from status interviewing', () => {
      const jobs = [createJob({
        status: 'interviewing',
        applied: daysAgo(10)
      })]
      const result = calculateResponseRate(jobs)

      expect(result.positiveResponses).toBe(1)
    })
  })

  describe('dimension filtering', () => {
    it('filters by industry dimension', () => {
      const jobs = [
        createAppliedJob({ id: 1, industry: 'Technology' }),
        createInterviewJob({ id: 2, industry: 'Technology' }),
        createAppliedJob({ id: 3, industry: 'Healthcare' }),
        createInterviewJob({ id: 4, industry: 'Healthcare' }),
        createInterviewJob({ id: 5, industry: 'Healthcare' })
      ]

      const techResult = calculateResponseRate(jobs, 'industry', 'Technology')
      const healthResult = calculateResponseRate(jobs, 'industry', 'Healthcare')

      expect(techResult.sampleSize).toBe(2)
      expect(techResult.positiveResponses).toBe(1)
      expect(techResult.rate).toBe(0.5) // 1/2

      expect(healthResult.sampleSize).toBe(3)
      expect(healthResult.positiveResponses).toBe(2)
      expect(healthResult.rate).toBeCloseTo(0.67, 1) // 2/3
    })

    it('filters by companySize dimension', () => {
      const jobs = [
        createInterviewJob({ id: 1, companySize: 'startup' }),
        createAppliedJob({ id: 2, companySize: 'enterprise' })
      ]

      const startupResult = calculateResponseRate(jobs, 'companySize', 'startup')
      const enterpriseResult = calculateResponseRate(jobs, 'companySize', 'enterprise')

      expect(startupResult.positiveResponses).toBe(1)
      expect(enterpriseResult.positiveResponses).toBe(0)
    })

    it('filters by jobBoard dimension using sources array', () => {
      const jobs = [
        createInterviewJob({ id: 1, sources: ['LinkedIn'] }),
        createAppliedJob({ id: 2, sources: ['Indeed'] })
      ]

      const linkedInResult = calculateResponseRate(jobs, 'jobBoard', 'LinkedIn')
      expect(linkedInResult.sampleSize).toBe(1)
      expect(linkedInResult.positiveResponses).toBe(1)
    })
  })
})

// =============================================================================
// calculateAcknowledgmentRate TESTS
// =============================================================================

describe('calculateAcknowledgmentRate', () => {
  it('returns 0% rate with n=0 for empty jobs', () => {
    const result = calculateAcknowledgmentRate([])

    expect(result.rate).toBe(0)
    expect(result.sampleSize).toBe(0)
    expect(result.confidence).toBe('very-low')
  })

  it('includes rejections in acknowledgment count', () => {
    const jobs = [
      createRejectedJob({ id: 1 }), // acknowledged (rejection)
      createInterviewJob({ id: 2 }), // acknowledged (positive)
      createAppliedJob({ id: 3 })    // not acknowledged
    ]
    const result = calculateAcknowledgmentRate(jobs)

    // 2 out of 3 acknowledged
    expect(result.acknowledgedCount).toBe(2)
    expect(result.rate).toBeCloseTo(0.67, 1)
  })

  it('detects acknowledgment from rejection keywords', () => {
    const jobs = [createAppliedJob({
      updates: [{ notes: 'Position has been filled' }]
    })]
    const result = calculateAcknowledgmentRate(jobs)

    expect(result.acknowledgedCount).toBe(1)
  })

  it('detects acknowledgment from heard back keyword', () => {
    const jobs = [createAppliedJob({
      updates: [{ notes: 'Heard back from recruiter' }]
    })]
    const result = calculateAcknowledgmentRate(jobs)

    expect(result.acknowledgedCount).toBe(1)
  })

  it('calculates both acknowledgment and positive rates separately', () => {
    const jobs = [
      createInterviewJob({ id: 1 }),  // both positive and acknowledged
      createRejectedJob({ id: 2 }),   // acknowledged but not positive
      createAppliedJob({ id: 3 }),    // neither
      createAppliedJob({ id: 4 }),    // neither
      createAppliedJob({ id: 5 })     // neither
    ]

    const ackRate = calculateAcknowledgmentRate(jobs)
    const respRate = calculateResponseRate(jobs)

    // Acknowledgment: 2/5 = 40%
    expect(ackRate.acknowledgedCount).toBe(2)
    expect(ackRate.rate).toBe(0.4)

    // Positive response: 1/5 = 20%
    expect(respRate.positiveResponses).toBe(1)
    expect(respRate.rate).toBe(0.2)
  })
})

// =============================================================================
// calculateRatesByDimension TESTS
// =============================================================================

describe('calculateRatesByDimension', () => {
  it('returns empty array for null jobs', () => {
    const result = calculateRatesByDimension(null, 'industry')
    expect(result).toEqual([])
  })

  it('returns empty array for invalid dimension', () => {
    const jobs = [createAppliedJob()]
    const result = calculateRatesByDimension(jobs, 'invalidDimension')
    expect(result).toEqual([])
  })

  it('groups jobs by dimension values', () => {
    const jobs = [
      createInterviewJob({ id: 1, industry: 'Technology' }),
      createAppliedJob({ id: 2, industry: 'Technology' }),
      createInterviewJob({ id: 3, industry: 'Healthcare' }),
      createAppliedJob({ id: 4, industry: 'Finance' })
    ]

    const result = calculateRatesByDimension(jobs, 'industry')

    // Should have Overall + 3 industries
    expect(result.length).toBe(4)

    // First should be Overall
    expect(result[0].value).toBe('Overall')

    // Check specific industries exist
    const industries = result.map(r => r.value)
    expect(industries).toContain('Technology')
    expect(industries).toContain('Healthcare')
    expect(industries).toContain('Finance')
  })

  it('sorts results by sample size descending', () => {
    const jobs = [
      createAppliedJob({ id: 1, industry: 'Small' }),
      createAppliedJob({ id: 2, industry: 'Large' }),
      createAppliedJob({ id: 3, industry: 'Large' }),
      createAppliedJob({ id: 4, industry: 'Large' }),
      createAppliedJob({ id: 5, industry: 'Medium' }),
      createAppliedJob({ id: 6, industry: 'Medium' })
    ]

    const result = calculateRatesByDimension(jobs, 'industry')

    // After Overall, should be sorted by sample size
    const nonOverall = result.filter(r => r.value !== 'Overall')
    for (let i = 0; i < nonOverall.length - 1; i++) {
      expect(nonOverall[i].sampleSize).toBeGreaterThanOrEqual(nonOverall[i + 1].sampleSize)
    }
  })

  it('includes Overall calculation at beginning', () => {
    const jobs = [
      createInterviewJob({ id: 1, industry: 'Tech' }),
      createAppliedJob({ id: 2, industry: 'Tech' })
    ]

    const result = calculateRatesByDimension(jobs, 'industry')

    expect(result[0].value).toBe('Overall')
    expect(result[0].sampleSize).toBe(2)
    expect(result[0].positiveResponses).toBe(1)
  })

  it('handles unknown dimension values gracefully', () => {
    const jobs = [
      createAppliedJob({ id: 1, industry: 'Technology' }),
      createAppliedJob({ id: 2, industry: null }) // Unknown industry
    ]

    const result = calculateRatesByDimension(jobs, 'industry')

    const unknownResult = result.find(r => r.value === 'Unknown')
    expect(unknownResult).toBeDefined()
    expect(unknownResult?.sampleSize).toBe(1)
  })

  it('skips dimension values with no applied jobs', () => {
    const jobs = [
      createJob({ id: 1, status: 'inbox', industry: 'NoApplied' }), // Not applied
      createAppliedJob({ id: 2, industry: 'HasApplied' })
    ]

    const result = calculateRatesByDimension(jobs, 'industry')

    const noAppliedResult = result.find(r => r.value === 'NoApplied')
    expect(noAppliedResult).toBeUndefined()
  })
})

// =============================================================================
// calculateAcknowledgmentRatesByDimension TESTS
// =============================================================================

describe('calculateAcknowledgmentRatesByDimension', () => {
  it('calculates acknowledgment rates by dimension', () => {
    const jobs = [
      createInterviewJob({ id: 1, industry: 'Tech' }),
      createRejectedJob({ id: 2, industry: 'Tech' }),
      createAppliedJob({ id: 3, industry: 'Tech' })
    ]

    const result = calculateAcknowledgmentRatesByDimension(jobs, 'industry')

    const techResult = result.find(r => r.value === 'Tech')
    expect(techResult?.acknowledgedCount).toBe(2)
    expect(techResult?.sampleSize).toBe(3)
  })

  it('returns empty array for invalid dimension', () => {
    const jobs = [createAppliedJob()]
    const result = calculateAcknowledgmentRatesByDimension(jobs, 'invalid')
    expect(result).toEqual([])
  })
})

// =============================================================================
// VALID_DIMENSIONS TESTS
// =============================================================================

describe('VALID_DIMENSIONS', () => {
  it('contains all expected dimensions', () => {
    expect(VALID_DIMENSIONS).toContain('companySize')
    expect(VALID_DIMENSIONS).toContain('industry')
    expect(VALID_DIMENSIONS).toContain('applicationMethod')
    expect(VALID_DIMENSIONS).toContain('jobBoard')
    expect(VALID_DIMENSIONS).toContain('roleType')
  })
})
