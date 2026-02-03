/**
 * Criteria Recommender Service Tests
 *
 * Tests for outcome analysis, recommendation generation, and criteria evolution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fit-config module
vi.mock('./fit-config.js', () => ({
  loadFitConfig: vi.fn(() => ({
    version: '1.0',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    criteria: {
      titles: {
        exact: ['Creative Director', 'Design Director'],
        partial: ['Creative', 'Design']
      },
      industries: {
        preferred: ['healthcare', 'nonprofit'],
        acceptable: ['technology']
      },
      locations: {
        preferred: ['remote', 'boston'],
        acceptable: ['new york']
      },
      salaryMin: 120000
    },
    weights: {
      BASE: 50,
      ROLE_EXACT: 25,
      ROLE_PARTIAL: 15,
      INDUSTRY_PREFERRED: 20,
      INDUSTRY_ACCEPTABLE: 10,
      MAX_TOTAL: 100
    },
    evolutionLog: []
  })),
  updateFitCriteria: vi.fn((updates, reason) => ({
    success: true,
    config: { ...updates, evolutionLog: [{ type: 'criteria_update', reason }] }
  }))
}))

import {
  analyzeOutcomes,
  generateRecommendations,
  previewCriteriaChange,
  applyCriteriaChange
} from './criteria-recommender.js'
import { loadFitConfig, updateFitCriteria } from './fit-config.js'

// =============================================================================
// Test Helpers
// =============================================================================

function createMockJob(overrides = {}) {
  return {
    id: overrides.id || Math.floor(Math.random() * 10000),
    title: overrides.title || 'Software Engineer',
    company: overrides.company || 'Test Company',
    industry: overrides.industry || 'Technology',
    status: overrides.status || 'inbox',
    fitScore: overrides.fitScore !== undefined ? overrides.fitScore : 75,
    ...overrides
  }
}

function createOutcomeEntry(overrides = {}) {
  return {
    timestamp: overrides.timestamp || new Date().toISOString(),
    type: 'outcome',
    jobId: overrides.jobId || Math.floor(Math.random() * 10000),
    outcome: overrides.outcome || 'positive',
    fitScore: overrides.fitScore !== undefined ? overrides.fitScore : 80,
    ...overrides
  }
}

// =============================================================================
// analyzeOutcomes Tests
// =============================================================================

describe('analyzeOutcomes', () => {
  describe('empty/invalid inputs', () => {
    it('returns empty analysis for null evolution log', () => {
      const result = analyzeOutcomes(null)

      expect(result.correlations.highScorePositive).toBe(0)
      expect(result.correlations.lowScoreNegative).toBe(0)
      expect(result.correlations.anomalies).toEqual([])
      expect(result.sampleSize).toBe(0)
      expect(result.confidence).toBe('very-low')
    })

    it('returns empty analysis for empty evolution log', () => {
      const result = analyzeOutcomes([])

      expect(result.sampleSize).toBe(0)
      expect(result.confidence).toBe('very-low')
    })

    it('returns empty analysis when no outcome entries exist', () => {
      const evolutionLog = [
        { type: 'criteria_update', reason: 'test' },
        { type: 'other', data: 'test' }
      ]

      const result = analyzeOutcomes(evolutionLog)

      expect(result.sampleSize).toBe(0)
      expect(result.confidence).toBe('very-low')
    })

    it('skips entries without fitScore', () => {
      const evolutionLog = [
        { type: 'outcome', outcome: 'positive', jobId: 1 }, // No fitScore
        createOutcomeEntry({ fitScore: 80, outcome: 'positive' })
      ]

      const result = analyzeOutcomes(evolutionLog)

      expect(result.sampleSize).toBe(1)
    })
  })

  describe('correlation calculations', () => {
    it('counts high score positive outcomes', () => {
      const evolutionLog = [
        createOutcomeEntry({ fitScore: 80, outcome: 'positive' }),
        createOutcomeEntry({ fitScore: 85, outcome: 'positive' }),
        createOutcomeEntry({ fitScore: 90, outcome: 'positive' }),
        createOutcomeEntry({ fitScore: 60, outcome: 'positive' }), // Not high score
        createOutcomeEntry({ fitScore: 75, outcome: 'negative' }) // Not positive
      ]

      const result = analyzeOutcomes(evolutionLog)

      expect(result.correlations.highScorePositive).toBe(3)
    })

    it('counts low score negative outcomes', () => {
      const evolutionLog = [
        createOutcomeEntry({ fitScore: 30, outcome: 'negative' }),
        createOutcomeEntry({ fitScore: 45, outcome: 'negative' }),
        createOutcomeEntry({ fitScore: 49, outcome: 'negative' }),
        createOutcomeEntry({ fitScore: 60, outcome: 'negative' }), // Not low score
        createOutcomeEntry({ fitScore: 40, outcome: 'positive' }) // Not negative
      ]

      const result = analyzeOutcomes(evolutionLog)

      expect(result.correlations.lowScoreNegative).toBe(3)
    })
  })

  describe('anomaly detection', () => {
    it('flags high score with negative outcome as anomaly', () => {
      const evolutionLog = [
        createOutcomeEntry({ jobId: 123, fitScore: 85, outcome: 'negative' }),
        createOutcomeEntry({ jobId: 456, fitScore: 90, outcome: 'negative' })
      ]

      const result = analyzeOutcomes(evolutionLog)

      expect(result.correlations.anomalies).toHaveLength(2)
      expect(result.correlations.anomalies[0].anomalyType).toBe('high_score_rejected')
      expect(result.correlations.anomalies[0].jobId).toBe(123)
    })

    it('flags low score with positive outcome as anomaly', () => {
      const evolutionLog = [
        createOutcomeEntry({ jobId: 789, fitScore: 40, outcome: 'positive' })
      ]

      const result = analyzeOutcomes(evolutionLog)

      expect(result.correlations.anomalies).toHaveLength(1)
      expect(result.correlations.anomalies[0].anomalyType).toBe('low_score_accepted')
      expect(result.correlations.anomalies[0].jobId).toBe(789)
    })

    it('does not flag neutral outcomes as anomalies', () => {
      const evolutionLog = [
        createOutcomeEntry({ fitScore: 85, outcome: 'neutral' }),
        createOutcomeEntry({ fitScore: 40, outcome: 'neutral' })
      ]

      const result = analyzeOutcomes(evolutionLog)

      expect(result.correlations.anomalies).toHaveLength(0)
    })
  })

  describe('confidence calculation', () => {
    it('returns very-low confidence for n < 5', () => {
      const evolutionLog = Array(4).fill(null).map((_, i) =>
        createOutcomeEntry({ jobId: i, fitScore: 80, outcome: 'positive' })
      )

      const result = analyzeOutcomes(evolutionLog)

      expect(result.sampleSize).toBe(4)
      expect(result.confidence).toBe('very-low')
    })

    it('returns low confidence for 5 <= n < 10', () => {
      const evolutionLog = Array(7).fill(null).map((_, i) =>
        createOutcomeEntry({ jobId: i, fitScore: 80, outcome: 'positive' })
      )

      const result = analyzeOutcomes(evolutionLog)

      expect(result.sampleSize).toBe(7)
      expect(result.confidence).toBe('low')
    })

    it('returns medium confidence for 10 <= n < 30', () => {
      const evolutionLog = Array(15).fill(null).map((_, i) =>
        createOutcomeEntry({ jobId: i, fitScore: 80, outcome: 'positive' })
      )

      const result = analyzeOutcomes(evolutionLog)

      expect(result.sampleSize).toBe(15)
      expect(result.confidence).toBe('medium')
    })

    it('returns high confidence for n >= 30', () => {
      const evolutionLog = Array(35).fill(null).map((_, i) =>
        createOutcomeEntry({ jobId: i, fitScore: 80, outcome: 'positive' })
      )

      const result = analyzeOutcomes(evolutionLog)

      expect(result.sampleSize).toBe(35)
      expect(result.confidence).toBe('high')
    })
  })
})

// =============================================================================
// generateRecommendations Tests
// =============================================================================

describe('generateRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('empty/invalid inputs', () => {
    it('returns empty array for null jobs', () => {
      const result = generateRecommendations(null)
      expect(result).toEqual([])
    })

    it('returns empty array for empty jobs array', () => {
      const result = generateRecommendations([])
      expect(result).toEqual([])
    })
  })

  describe('sample size requirements', () => {
    it('returns no recommendations when evolution log has insufficient data', () => {
      vi.mocked(loadFitConfig).mockReturnValue({
        criteria: {},
        weights: {},
        evolutionLog: [
          createOutcomeEntry({ fitScore: 80, outcome: 'positive' }),
          createOutcomeEntry({ fitScore: 85, outcome: 'positive' })
        ] // Only 2 entries
      })

      const jobs = [createMockJob()]
      const result = generateRecommendations(jobs)

      expect(result).toEqual([])
    })
  })

  describe('pattern detection', () => {
    it('recommends criteria review when high-fit jobs are rejected', () => {
      vi.mocked(loadFitConfig).mockReturnValue({
        criteria: { titles: { exact: ['Engineer'] } },
        weights: {},
        evolutionLog: [
          // 2+ high score rejections to trigger recommendation
          createOutcomeEntry({ fitScore: 85, outcome: 'negative' }),
          createOutcomeEntry({ fitScore: 90, outcome: 'negative' }),
          createOutcomeEntry({ fitScore: 80, outcome: 'positive' }),
          createOutcomeEntry({ fitScore: 75, outcome: 'positive' }),
          createOutcomeEntry({ fitScore: 70, outcome: 'positive' })
        ]
      })

      const jobs = [createMockJob()]
      const result = generateRecommendations(jobs)

      const reviewRec = result.find(r => r.type === 'review_criteria')
      expect(reviewRec).toBeDefined()
      expect(reviewRec.rationale).toContain('high-fit jobs resulted in negative outcomes')
    })

    it('detects title preference drift', () => {
      vi.mocked(loadFitConfig).mockReturnValue({
        criteria: { titles: { exact: ['Creative Director'] } },
        weights: {},
        evolutionLog: Array(5).fill(null).map((_, i) =>
          createOutcomeEntry({ jobId: i, fitScore: 70, outcome: 'positive' })
        )
      })

      // Jobs with title not in criteria - need 5+ applied jobs for pattern detection
      const jobs = [
        createMockJob({ id: 1, title: 'Product Designer', status: 'applied' }),
        createMockJob({ id: 2, title: 'Product Designer', status: 'applied' }),
        createMockJob({ id: 3, title: 'Product Designer', status: 'applied' }),
        createMockJob({ id: 4, title: 'Product Designer', status: 'interviewing' }),
        createMockJob({ id: 5, title: 'Product Designer', status: 'applied' })
      ]

      const result = generateRecommendations(jobs)

      const titleRec = result.find(r => r.type === 'add_title')
      expect(titleRec).toBeDefined()
      expect(titleRec.rationale).toContain('product designer')
      expect(titleRec.rationale).toContain("applied to")
    })

    it('detects industry preference drift', () => {
      vi.mocked(loadFitConfig).mockReturnValue({
        criteria: {
          industries: {
            preferred: ['healthcare'],
            acceptable: ['technology']
          }
        },
        weights: {},
        evolutionLog: Array(5).fill(null).map((_, i) =>
          createOutcomeEntry({ jobId: i, fitScore: 70, outcome: 'positive' })
        )
      })

      // Jobs with industry not in criteria - need 5+ applied jobs for pattern detection
      const jobs = [
        createMockJob({ id: 1, industry: 'Finance', status: 'applied' }),
        createMockJob({ id: 2, industry: 'Finance', status: 'applied' }),
        createMockJob({ id: 3, industry: 'Finance', status: 'offer' }),
        createMockJob({ id: 4, industry: 'Finance', status: 'applied' }),
        createMockJob({ id: 5, industry: 'Technology', status: 'applied' }) // Different industry for diversity
      ]

      const result = generateRecommendations(jobs)

      const industryRec = result.find(r => r.type === 'add_industry')
      expect(industryRec).toBeDefined()
      expect(industryRec.rationale).toContain('finance')
    })

    it('recommends weight adjustment when low scores have positive outcomes', () => {
      vi.mocked(loadFitConfig).mockReturnValue({
        criteria: {},
        weights: { BASE: 50 },
        evolutionLog: [
          // 2+ low score acceptances to trigger recommendation
          createOutcomeEntry({ fitScore: 40, outcome: 'positive' }),
          createOutcomeEntry({ fitScore: 35, outcome: 'positive' }),
          createOutcomeEntry({ fitScore: 80, outcome: 'positive' }),
          createOutcomeEntry({ fitScore: 75, outcome: 'positive' }),
          createOutcomeEntry({ fitScore: 70, outcome: 'positive' })
        ]
      })

      const jobs = [createMockJob()]
      const result = generateRecommendations(jobs)

      const weightRec = result.find(r => r.type === 'adjust_weight')
      expect(weightRec).toBeDefined()
      expect(weightRec.rationale).toContain('low-fit jobs resulted in positive outcomes')
    })
  })

  describe('recommendation content', () => {
    it('includes confidence level in recommendations', () => {
      vi.mocked(loadFitConfig).mockReturnValue({
        criteria: { titles: { exact: ['Engineer'] } },
        weights: {},
        evolutionLog: Array(15).fill(null).map((_, i) =>
          createOutcomeEntry({ jobId: i, fitScore: 85, outcome: i < 3 ? 'negative' : 'positive' })
        )
      })

      const jobs = [createMockJob()]
      const result = generateRecommendations(jobs)

      expect(result.length).toBeGreaterThan(0)
      result.forEach(rec => {
        expect(rec.confidence).toBeDefined()
        expect(['high', 'medium', 'low', 'very-low']).toContain(rec.confidence)
      })
    })

    it('includes rationale in recommendations', () => {
      vi.mocked(loadFitConfig).mockReturnValue({
        criteria: { titles: { exact: [] } },
        weights: {},
        evolutionLog: Array(5).fill(null).map((_, i) =>
          createOutcomeEntry({ jobId: i, fitScore: 70, outcome: 'positive' })
        )
      })

      const jobs = Array(5).fill(null).map((_, i) =>
        createMockJob({ id: i, title: 'UX Designer', status: 'applied' })
      )

      const result = generateRecommendations(jobs)

      const titleRec = result.find(r => r.type === 'add_title')
      expect(titleRec).toBeDefined()
      expect(titleRec.rationale).toBeTruthy()
      expect(titleRec.rationale.length).toBeGreaterThan(20)
    })
  })
})

// =============================================================================
// previewCriteriaChange Tests
// =============================================================================

describe('previewCriteriaChange', () => {
  describe('empty/invalid inputs', () => {
    it('returns empty preview for null jobs', () => {
      const change = { type: 'add_title', criteria: 'titles.exact', newValue: ['Test'] }
      const result = previewCriteriaChange(null, change)

      expect(result.affected).toBe(0)
      expect(result.scoreChanges).toEqual([])
      expect(result.summary).toContain('No jobs')
    })

    it('returns empty preview for empty jobs array', () => {
      const change = { type: 'add_title', criteria: 'titles.exact', newValue: ['Test'] }
      const result = previewCriteriaChange([], change)

      expect(result.affected).toBe(0)
    })

    it('returns error for invalid change specification', () => {
      const jobs = [createMockJob()]
      const result = previewCriteriaChange(jobs, null)

      expect(result.affected).toBe(0)
      expect(result.summary).toContain('Invalid')
    })

    it('returns error for change without type', () => {
      const jobs = [createMockJob()]
      const result = previewCriteriaChange(jobs, { criteria: 'titles' })

      expect(result.summary).toContain('Invalid')
    })
  })

  describe('title changes preview', () => {
    it('previews score increase for add_title matching jobs', () => {
      const jobs = [
        createMockJob({ id: 1, title: 'Product Manager', fitScore: 60 }),
        createMockJob({ id: 2, title: 'Product Designer', fitScore: 70 }),
        createMockJob({ id: 3, title: 'Software Engineer', fitScore: 80 })
      ]
      const change = {
        type: 'add_title',
        criteria: 'titles.exact',
        currentValue: [],
        newValue: ['Product']
      }

      const result = previewCriteriaChange(jobs, change)

      // Two jobs match "Product"
      expect(result.affected).toBe(2)
      expect(result.scoreChanges.some(c => c.jobId === 1 && c.delta > 0)).toBe(true)
      expect(result.scoreChanges.some(c => c.jobId === 2 && c.delta > 0)).toBe(true)
    })

    it('does not increase score for jobs already matching current criteria', () => {
      const jobs = [
        createMockJob({ id: 1, title: 'Product Manager', fitScore: 75 })
      ]
      const change = {
        type: 'add_title',
        criteria: 'titles.exact',
        currentValue: ['Product Manager'], // Already in criteria
        newValue: ['Product Manager', 'Product']
      }

      const result = previewCriteriaChange(jobs, change)

      // Job already matches current criteria, no change expected
      expect(result.affected).toBe(0)
    })
  })

  describe('industry changes preview', () => {
    it('previews score increase for add_industry matching jobs', () => {
      const jobs = [
        createMockJob({ id: 1, industry: 'FinTech', fitScore: 65 }),
        createMockJob({ id: 2, industry: 'Healthcare', fitScore: 80 }) // Already in criteria
      ]
      const change = {
        type: 'add_industry',
        criteria: 'industries.acceptable',
        currentValue: ['Healthcare'],
        newValue: ['Healthcare', 'FinTech']
      }

      const result = previewCriteriaChange(jobs, change)

      expect(result.affected).toBe(1)
      expect(result.scoreChanges[0].jobId).toBe(1)
      expect(result.scoreChanges[0].delta).toBeGreaterThan(0)
    })
  })

  describe('salary changes preview', () => {
    it('previews score changes for salary adjustment', () => {
      const jobs = [
        createMockJob({ id: 1, salaryMax: 100000, fitScore: 60 }), // Below current, now meets
        createMockJob({ id: 2, salaryMax: 130000, fitScore: 75 }) // Already meets
      ]
      const change = {
        type: 'adjust_salary',
        criteria: 'salaryMin',
        currentValue: 120000,
        newValue: 100000
      }

      const result = previewCriteriaChange(jobs, change)

      // Job 1 now meets new lower minimum
      expect(result.scoreChanges.some(c => c.jobId === 1 && c.delta > 0)).toBe(true)
    })
  })

  describe('summary generation', () => {
    it('generates accurate summary with counts', () => {
      const jobs = [
        createMockJob({ id: 1, title: 'Product Manager', fitScore: 60 }),
        createMockJob({ id: 2, title: 'Product Designer', fitScore: 70 }),
        createMockJob({ id: 3, title: 'Engineer', fitScore: 80 })
      ]
      const change = {
        type: 'add_title',
        criteria: 'titles.exact',
        currentValue: [],
        newValue: ['Product']
      }

      const result = previewCriteriaChange(jobs, change)

      expect(result.summary).toContain('2 jobs affected')
      expect(result.summary).toContain('score increases')
    })

    it('generates summary for no impact', () => {
      const jobs = [
        createMockJob({ id: 1, title: 'Engineer', fitScore: 80 })
      ]
      const change = {
        type: 'add_title',
        criteria: 'titles.exact',
        currentValue: [],
        newValue: ['Designer']
      }

      const result = previewCriteriaChange(jobs, change)

      expect(result.summary).toContain('No jobs would be affected')
    })
  })
})

// =============================================================================
// applyCriteriaChange Tests
// =============================================================================

describe('applyCriteriaChange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validation', () => {
    it('returns error for null change', () => {
      const result = applyCriteriaChange(null, 'test reason')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid')
    })

    it('returns error for change without type', () => {
      const result = applyCriteriaChange({ criteria: 'titles' }, 'test reason')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid')
    })

    it('returns error for missing reason', () => {
      const change = { type: 'add_title', criteria: 'titles.exact', newValue: ['Test'] }
      const result = applyCriteriaChange(change, '')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Reason')
    })

    it('returns error for whitespace-only reason', () => {
      const change = { type: 'add_title', criteria: 'titles.exact', newValue: ['Test'] }
      const result = applyCriteriaChange(change, '   ')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Reason')
    })
  })

  describe('title changes', () => {
    it('applies add_title change to exact titles', () => {
      const change = {
        type: 'add_title',
        criteria: 'titles.exact',
        newValue: ['Creative Director', 'Product Designer']
      }

      const result = applyCriteriaChange(change, 'Adding based on application patterns')

      expect(result.success).toBe(true)
      expect(updateFitCriteria).toHaveBeenCalledWith(
        { titles: { exact: ['Creative Director', 'Product Designer'] } },
        expect.stringContaining('[add_title]')
      )
    })

    it('applies add_title change to partial titles', () => {
      const change = {
        type: 'add_title',
        criteria: 'titles.partial',
        newValue: ['Product', 'UX']
      }

      const result = applyCriteriaChange(change, 'Expanding partial matches')

      expect(result.success).toBe(true)
      expect(updateFitCriteria).toHaveBeenCalledWith(
        { titles: { partial: ['Product', 'UX'] } },
        expect.any(String)
      )
    })
  })

  describe('industry changes', () => {
    it('applies add_industry change to acceptable', () => {
      const change = {
        type: 'add_industry',
        criteria: 'industries.acceptable',
        newValue: ['technology', 'finance']
      }

      const result = applyCriteriaChange(change, 'Adding finance based on applications')

      expect(result.success).toBe(true)
      expect(updateFitCriteria).toHaveBeenCalledWith(
        { industries: { acceptable: ['technology', 'finance'] } },
        expect.any(String)
      )
    })
  })

  describe('salary changes', () => {
    it('applies salary adjustment', () => {
      const change = {
        type: 'adjust_salary',
        criteria: 'salaryMin',
        newValue: 150000
      }

      const result = applyCriteriaChange(change, 'Increasing minimum salary target')

      expect(result.success).toBe(true)
      expect(updateFitCriteria).toHaveBeenCalledWith(
        { salaryMin: 150000 },
        expect.any(String)
      )
    })
  })

  describe('weight changes', () => {
    it('returns error for weight adjustments (require manual config)', () => {
      const change = {
        type: 'adjust_weight',
        criteria: 'weights.ROLE_EXACT',
        newValue: 30
      }

      const result = applyCriteriaChange(change, 'Adjusting role weight')

      expect(result.success).toBe(false)
      expect(result.error).toContain('manual')
    })
  })

  describe('unknown change types', () => {
    it('returns error for unknown change type', () => {
      const change = {
        type: 'unknown_type',
        criteria: 'something',
        newValue: 'value'
      }

      const result = applyCriteriaChange(change, 'Test reason')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown')
    })
  })

  describe('audit trail', () => {
    it('includes structured reason with change type', () => {
      const change = {
        type: 'add_title',
        criteria: 'titles.exact',
        newValue: ['Test Title']
      }

      applyCriteriaChange(change, 'User requested')

      expect(updateFitCriteria).toHaveBeenCalledWith(
        expect.any(Object),
        '[add_title] User requested'
      )
    })
  })
})
