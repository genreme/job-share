/**
 * Reasoning Generator Tests
 *
 * Tests for generating human-readable explanations of fit scores.
 */

import { describe, it, expect } from 'vitest'
import { generateReasoning, generateSummary } from './reasoning-generator.js'

/**
 * Create a mock job for testing
 */
function createMockJob(overrides = {}) {
  return {
    id: 1,
    title: overrides.title || 'Software Engineer',
    company: overrides.company || 'Tech Corp',
    industry: overrides.industry || 'Technology',
    location: overrides.location || 'San Francisco',
    salary: overrides.salary || '$120,000',
    description: overrides.description || 'Looking for a skilled engineer',
    status: 'inbox',
    ...overrides
  }
}

/**
 * Create a mock fit result for testing
 */
function createMockFitResult(overrides = {}) {
  return {
    score: overrides.score ?? 75,
    breakdown: {
      base: 50,
      role: overrides.role ?? 15,
      industry: overrides.industry ?? 10,
      location: overrides.location ?? 8,
      salary: overrides.salary ?? 0,
      skills: overrides.skills ?? 2,
      ...overrides.breakdown
    },
    usingDefaults: overrides.usingDefaults ?? false
  }
}

describe('generateReasoning', () => {
  describe('high score with all positive signals', () => {
    it('includes positive reasons for all matched criteria', () => {
      const job = createMockJob({
        title: 'Creative Director',
        industry: 'Healthcare',
        location: 'Boston',
        salary: '$150,000'
      })

      const fitResult = createMockFitResult({
        score: 95,
        role: 25,
        industry: 20,
        location: 15,
        salary: 15,
        skills: 10
      })

      const result = generateReasoning(job, fitResult)

      expect(result.score).toBe(95)
      expect(result.whyIncluded).toContain("'Creative Director' matches your target roles")
      expect(result.whyIncluded).toContain('Industry aligns with your preferences')
      expect(result.whyIncluded).toContain('Location (Boston) is preferred')
      expect(result.whyIncluded).toContain('Salary meets your threshold')
      expect(result.whyIncluded).toContain('Multiple skill matches found')
      expect(result.considerations).toHaveLength(0)
    })

    it('generates summary starting with "Excellent match"', () => {
      const job = createMockJob({ title: 'Creative Director' })
      const fitResult = createMockFitResult({
        score: 92,
        role: 25,
        industry: 20,
        location: 15,
        salary: 15
      })

      const result = generateReasoning(job, fitResult)

      expect(result.summary).toContain('Excellent match (92/100)')
    })
  })

  describe('medium score with mixed signals', () => {
    it('includes both positive reasons and considerations', () => {
      const job = createMockJob({
        title: 'Design Lead',
        industry: 'Technology',
        location: 'New York',
        salary: ''
      })

      const fitResult = createMockFitResult({
        score: 73,
        role: 15,
        industry: 10,
        location: 8,
        salary: 0,
        skills: 0
      })

      const result = generateReasoning(job, fitResult)

      expect(result.whyIncluded).toContain('Title has partial alignment with your targets')
      expect(result.whyIncluded).toContain('Industry is in acceptable range')
      expect(result.considerations).toContain('Salary not disclosed')
    })

    it('generates summary with "Good potential"', () => {
      const job = createMockJob()
      const fitResult = createMockFitResult({
        score: 75,
        role: 15,
        industry: 10
      })

      const result = generateReasoning(job, fitResult)

      expect(result.summary).toContain('Good potential (75/100)')
    })
  })

  describe('lower score with concerns', () => {
    it('includes title mismatch concern', () => {
      const job = createMockJob({
        title: 'Janitor',
        salary: '$30,000'
      })

      const fitResult = createMockFitResult({
        score: 50,
        role: 0,
        industry: 0,
        location: 0,
        salary: 0,
        skills: 0
      })

      const result = generateReasoning(job, fitResult)

      expect(result.considerations).toContain('Title may not directly match target roles')
    })

    it('generates summary with "Lower fit"', () => {
      const job = createMockJob()
      const fitResult = createMockFitResult({
        score: 55,
        role: 0,
        industry: 0,
        location: 0
      })

      const result = generateReasoning(job, fitResult)

      expect(result.summary).toContain('Lower fit (55/100)')
    })
  })

  describe('using defaults warning', () => {
    it('adds warning when usingDefaults is true', () => {
      const job = createMockJob()
      const fitResult = createMockFitResult({
        score: 70,
        usingDefaults: true
      })

      const result = generateReasoning(job, fitResult)

      expect(result.considerations).toContain('Using default criteria - populate profile for personalized scoring')
    })

    it('does not add warning when usingDefaults is false', () => {
      const job = createMockJob()
      const fitResult = createMockFitResult({
        score: 70,
        usingDefaults: false
      })

      const result = generateReasoning(job, fitResult)

      expect(result.considerations).not.toContain('Using default criteria - populate profile for personalized scoring')
    })
  })

  describe('breakdown explanations', () => {
    it('includes role breakdown explanation', () => {
      const job = createMockJob({ title: 'Creative Director' })
      const fitResult = createMockFitResult({ role: 25 })

      const result = generateReasoning(job, fitResult)

      expect(result.breakdown.role).toContain('25/25 points')
      expect(result.breakdown.role).toContain('exact match')
    })

    it('includes industry breakdown explanation', () => {
      const job = createMockJob({ industry: 'Healthcare' })
      const fitResult = createMockFitResult({ industry: 20 })

      const result = generateReasoning(job, fitResult)

      expect(result.breakdown.industry).toContain('20/20 points')
      expect(result.breakdown.industry).toContain('preferred')
    })

    it('includes location breakdown explanation', () => {
      const job = createMockJob({ location: 'Boston' })
      const fitResult = createMockFitResult({ location: 15 })

      const result = generateReasoning(job, fitResult)

      expect(result.breakdown.location).toContain('15/15 points')
      expect(result.breakdown.location).toContain('preferred')
    })

    it('includes salary breakdown explanation', () => {
      const job = createMockJob({ salary: '$150,000' })
      const fitResult = createMockFitResult({ salary: 15 })

      const result = generateReasoning(job, fitResult)

      expect(result.breakdown.salary).toContain('15/15 points')
      expect(result.breakdown.salary).toContain('meets threshold')
    })

    it('includes skills breakdown explanation', () => {
      const job = createMockJob()
      const fitResult = createMockFitResult({ skills: 10 })

      const result = generateReasoning(job, fitResult)

      expect(result.breakdown.skills).toContain('10/10 points')
      expect(result.breakdown.skills).toContain('5+ skills matched')
    })
  })

  describe('edge cases', () => {
    it('handles job with empty/null title', () => {
      const job = createMockJob({ title: null })
      const fitResult = createMockFitResult({ role: 0 })

      const result = generateReasoning(job, fitResult)

      expect(result.breakdown.role).toContain('Unknown Title')
    })

    it('handles job with empty location', () => {
      const job = createMockJob({ location: '' })
      const fitResult = createMockFitResult({ location: 0 })

      const result = generateReasoning(job, fitResult)

      expect(result.breakdown.location).toContain('Not specified')
    })

    it('handles job with no salary', () => {
      const job = createMockJob({ salary: null })
      const fitResult = createMockFitResult({ salary: 0 })

      const result = generateReasoning(job, fitResult)

      expect(result.considerations).toContain('Salary not disclosed')
      expect(result.breakdown.salary).toContain('not disclosed')
    })

    it('handles completely empty job data', () => {
      const job = {}
      const fitResult = createMockFitResult({
        score: 50,
        role: 0,
        industry: 0,
        location: 0,
        salary: 0,
        skills: 0
      })

      const result = generateReasoning(job, fitResult)

      expect(result.score).toBe(50)
      expect(result.breakdown.role).toContain('Unknown Title')
      expect(result.breakdown.industry).toContain('Not specified')
    })

    it('returns empty whyIncluded when no positive signals', () => {
      const job = createMockJob({ title: 'Janitor', salary: '' })
      const fitResult = createMockFitResult({
        score: 50,
        role: 0,
        industry: 0,
        location: 0,
        salary: 0,
        skills: 0
      })

      const result = generateReasoning(job, fitResult)

      // Only title and salary will generate considerations, not whyIncluded
      expect(result.whyIncluded).not.toContain('matches your target roles')
    })
  })
})

describe('generateSummary', () => {
  describe('score thresholds', () => {
    it('returns "Excellent match" for score >= 90', () => {
      const summary = generateSummary(92, ['Great role match'], [])
      expect(summary).toContain('Excellent match (92/100)')
      expect(summary).toContain('Great role match')
    })

    it('returns "Strong match" for score 80-89', () => {
      const summary = generateSummary(85, ['Good alignment'], [])
      expect(summary).toContain('Strong match (85/100)')
    })

    it('returns "Good potential" for score 70-79', () => {
      const summary = generateSummary(72, ['Some matches'], [])
      expect(summary).toContain('Good potential (72/100)')
      expect(summary).toContain('Worth reviewing')
    })

    it('returns "Moderate fit" for score 60-69', () => {
      const summary = generateSummary(65, ['Partial match'], [])
      expect(summary).toContain('Moderate fit (65/100)')
      expect(summary).toContain('Consider')
    })

    it('returns "Lower fit" for score < 60', () => {
      const summary = generateSummary(55, [], ['May be stretch'])
      expect(summary).toContain('Lower fit (55/100)')
    })
  })

  describe('reason/concern fallbacks', () => {
    it('uses first reason in summary', () => {
      const summary = generateSummary(85, ['First reason', 'Second reason'], [])
      expect(summary).toContain('First reason')
      expect(summary).not.toContain('Second reason')
    })

    it('uses concern when no reasons available for lower scores', () => {
      const summary = generateSummary(55, [], ['Title mismatch'])
      expect(summary).toContain('Title mismatch')
    })

    it('falls back to default text when no reasons or concerns', () => {
      const summary = generateSummary(55, [], [])
      expect(summary).toContain('May be stretch role')
    })

    it('handles empty arrays gracefully', () => {
      const summary = generateSummary(90, [], [])
      expect(summary).toContain('Excellent match')
      expect(summary).toContain('Strong alignment')
    })

    it('handles null/undefined arrays gracefully', () => {
      const summary = generateSummary(85, null, undefined)
      expect(summary).toContain('Strong match')
    })
  })
})
