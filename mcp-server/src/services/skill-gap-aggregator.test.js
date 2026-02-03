/**
 * Skill Gap Aggregator Service Tests
 *
 * Tests for skill gap aggregation, trend analysis, and recommendation generation.
 */

import { describe, it, expect } from 'vitest'
import { aggregateSkillGaps, getGapTrends, getGapRecommendations } from './skill-gap-aggregator.js'

// =============================================================================
// Test Helpers
// =============================================================================

function createMockJob(overrides = {}) {
  return {
    id: overrides.id || Math.floor(Math.random() * 10000),
    title: overrides.title || 'Software Engineer',
    company: overrides.company || 'Test Company',
    industry: overrides.industry || 'Technology',
    description: overrides.description || null,
    notes: overrides.notes || null,
    found: overrides.found || new Date().toISOString(),
    ...overrides
  }
}

function createMockProfile(overrides = {}) {
  return {
    skills: overrides.skills || [
      { id: '1', name: 'JavaScript' },
      { id: '2', name: 'React' },
      { id: '3', name: 'TypeScript' }
    ],
    ...overrides
  }
}

// =============================================================================
// aggregateSkillGaps Tests
// =============================================================================

describe('aggregateSkillGaps', () => {
  describe('empty/invalid inputs', () => {
    it('returns empty array for null jobs', () => {
      const result = aggregateSkillGaps(null, createMockProfile())
      expect(result).toEqual([])
    })

    it('returns empty array for undefined jobs', () => {
      const result = aggregateSkillGaps(undefined, createMockProfile())
      expect(result).toEqual([])
    })

    it('returns empty array for empty jobs array', () => {
      const result = aggregateSkillGaps([], createMockProfile())
      expect(result).toEqual([])
    })

    it('returns empty array for non-array jobs', () => {
      const result = aggregateSkillGaps({ length: 1 }, createMockProfile())
      expect(result).toEqual([])
    })

    it('handles null profile gracefully', () => {
      const jobs = [
        createMockJob({ description: 'Python experience required' }),
        createMockJob({ description: 'Python and Django' }),
        createMockJob({ description: 'Python developer' })
      ]
      const result = aggregateSkillGaps(jobs, null)
      expect(result.some(g => g.skill === 'python')).toBe(true)
    })

    it('handles profile without skills array', () => {
      const jobs = [
        createMockJob({ description: 'Python experience required' }),
        createMockJob({ description: 'Python and Django' }),
        createMockJob({ description: 'Python developer' })
      ]
      const result = aggregateSkillGaps(jobs, {})
      expect(result.some(g => g.skill === 'python')).toBe(true)
    })
  })

  describe('jobs without description/notes', () => {
    it('skips jobs without description or notes', () => {
      const jobs = [
        createMockJob({ description: null, notes: null }),
        createMockJob({ description: '', notes: '' }),
        createMockJob({ description: 'Python Python Python' }) // Only one job with content
      ]
      const result = aggregateSkillGaps(jobs, createMockProfile())
      // Python mentioned in only 1 job, should be filtered out (< 3)
      expect(result.some(g => g.skill === 'python')).toBe(false)
    })

    it('uses notes when description is empty', () => {
      const jobs = [
        createMockJob({ description: null, notes: 'Python experience' }),
        createMockJob({ description: null, notes: 'Python developer needed' }),
        createMockJob({ description: null, notes: 'Must know Python' })
      ]
      const result = aggregateSkillGaps(jobs, createMockProfile())
      expect(result.some(g => g.skill === 'python')).toBe(true)
    })
  })

  describe('minimum occurrence filter', () => {
    it('filters out skills with less than 3 occurrences', () => {
      const jobs = [
        createMockJob({ description: 'Python and Go experience' }),
        createMockJob({ description: 'Python developer' })
        // Python appears 2 times, Go appears 1 time
      ]
      const result = aggregateSkillGaps(jobs, createMockProfile())

      expect(result.some(g => g.skill === 'python')).toBe(false) // Only 2 occurrences
      expect(result.some(g => g.skill === 'go')).toBe(false) // Only 1 occurrence
    })

    it('includes skills with exactly 3 occurrences', () => {
      const jobs = [
        createMockJob({ description: 'AWS cloud experience' }),
        createMockJob({ description: 'AWS deployment' }),
        createMockJob({ description: 'AWS infrastructure' })
      ]
      const result = aggregateSkillGaps(jobs, createMockProfile())

      expect(result.some(g => g.skill === 'aws')).toBe(true)
      expect(result.find(g => g.skill === 'aws').count).toBe(3)
    })

    it('includes skills with more than 3 occurrences', () => {
      const jobs = [
        createMockJob({ description: 'Docker and Kubernetes' }),
        createMockJob({ description: 'Docker containers' }),
        createMockJob({ description: 'Docker experience' }),
        createMockJob({ description: 'Docker deployment' }),
        createMockJob({ description: 'Docker skills required' })
      ]
      const result = aggregateSkillGaps(jobs, createMockProfile())

      expect(result.some(g => g.skill === 'docker')).toBe(true)
      expect(result.find(g => g.skill === 'docker').count).toBe(5)
    })
  })

  describe('profile skill matching', () => {
    it('does not count profile skills as gaps', () => {
      const profile = createMockProfile({
        skills: [{ name: 'Python' }, { name: 'Django' }]
      })
      const jobs = [
        createMockJob({ description: 'Python and Django and Flask' }),
        createMockJob({ description: 'Python and Django and Flask' }),
        createMockJob({ description: 'Python and Django and Flask' })
      ]
      const result = aggregateSkillGaps(jobs, profile)

      expect(result.some(g => g.skill === 'python')).toBe(false) // In profile
      expect(result.some(g => g.skill === 'django')).toBe(false) // In profile
      expect(result.some(g => g.skill === 'flask')).toBe(true) // Not in profile
    })

    it('matches case-insensitively', () => {
      const profile = createMockProfile({
        skills: [{ name: 'REACT' }, { name: 'typescript' }]
      })
      const jobs = [
        createMockJob({ description: 'React and TypeScript and Vue' }),
        createMockJob({ description: 'React and TypeScript and Vue' }),
        createMockJob({ description: 'React and TypeScript and Vue' })
      ]
      const result = aggregateSkillGaps(jobs, profile)

      expect(result.some(g => g.skill === 'react')).toBe(false)
      expect(result.some(g => g.skill === 'typescript')).toBe(false)
      expect(result.some(g => g.skill === 'vue')).toBe(true)
    })

    it('matches partial skills (profile contains JD keyword)', () => {
      const profile = createMockProfile({
        skills: [{ name: 'React Native' }]
      })
      const jobs = [
        createMockJob({ description: 'React experience needed' }),
        createMockJob({ description: 'React developer' }),
        createMockJob({ description: 'React skills' })
      ]
      const result = aggregateSkillGaps(jobs, profile)

      // "React Native" contains "React", so not a gap
      expect(result.some(g => g.skill === 'react')).toBe(false)
    })
  })

  describe('context tracking', () => {
    it('tracks industries where skill is mentioned', () => {
      const jobs = [
        createMockJob({ description: 'Python required', industry: 'Healthcare' }),
        createMockJob({ description: 'Python experience', industry: 'Finance' }),
        createMockJob({ description: 'Python developer', industry: 'Healthcare' })
      ]
      const result = aggregateSkillGaps(jobs, createMockProfile())

      const pythonGap = result.find(g => g.skill === 'python')
      expect(pythonGap.industries).toContain('Healthcare')
      expect(pythonGap.industries).toContain('Finance')
    })

    it('tracks roles where skill is mentioned', () => {
      const jobs = [
        createMockJob({ description: 'Python required', title: 'Data Scientist' }),
        createMockJob({ description: 'Python experience', title: 'Backend Engineer' }),
        createMockJob({ description: 'Python developer', title: 'Data Scientist' })
      ]
      const result = aggregateSkillGaps(jobs, createMockProfile())

      const pythonGap = result.find(g => g.skill === 'python')
      expect(pythonGap.roles).toContain('Data Scientist')
      expect(pythonGap.roles).toContain('Backend Engineer')
    })

    it('deduplicates industries and roles', () => {
      const jobs = [
        createMockJob({ description: 'Python', industry: 'Tech', title: 'Engineer' }),
        createMockJob({ description: 'Python', industry: 'Tech', title: 'Engineer' }),
        createMockJob({ description: 'Python', industry: 'Tech', title: 'Engineer' })
      ]
      const result = aggregateSkillGaps(jobs, createMockProfile())

      const pythonGap = result.find(g => g.skill === 'python')
      expect(pythonGap.industries).toHaveLength(1)
      expect(pythonGap.roles).toHaveLength(1)
    })
  })

  describe('priority calculation', () => {
    it('assigns high priority for count >= 10', () => {
      const jobs = Array(10).fill(null).map((_, i) =>
        createMockJob({ id: i, description: 'AWS cloud experience' })
      )
      const result = aggregateSkillGaps(jobs, createMockProfile())

      const awsGap = result.find(g => g.skill === 'aws')
      expect(awsGap.priority).toBe('high')
    })

    it('assigns medium priority for count >= 5 and < 10', () => {
      const jobs = Array(6).fill(null).map((_, i) =>
        createMockJob({ id: i, description: 'Docker experience' })
      )
      const result = aggregateSkillGaps(jobs, createMockProfile())

      const dockerGap = result.find(g => g.skill === 'docker')
      expect(dockerGap.priority).toBe('medium')
    })

    it('assigns low priority for count >= 3 and < 5', () => {
      const jobs = Array(3).fill(null).map((_, i) =>
        createMockJob({ id: i, description: 'Go experience' })
      )
      const result = aggregateSkillGaps(jobs, createMockProfile())

      const goGap = result.find(g => g.skill === 'go')
      expect(goGap.priority).toBe('low')
    })
  })

  describe('sorting', () => {
    it('returns gaps sorted by frequency (highest first)', () => {
      const jobs = [
        // Python: 5 mentions
        ...Array(5).fill(null).map((_, i) =>
          createMockJob({ id: i * 100 + 1, description: 'Python developer' })
        ),
        // AWS: 3 mentions
        ...Array(3).fill(null).map((_, i) =>
          createMockJob({ id: i * 100 + 2, description: 'AWS cloud' })
        ),
        // Docker: 7 mentions
        ...Array(7).fill(null).map((_, i) =>
          createMockJob({ id: i * 100 + 3, description: 'Docker experience' })
        )
      ]
      const result = aggregateSkillGaps(jobs, createMockProfile())

      // Docker (7) > Python (5) > AWS (3)
      expect(result[0].skill).toBe('docker')
      expect(result[1].skill).toBe('python')
      expect(result[2].skill).toBe('aws')
    })
  })
})

// =============================================================================
// getGapTrends Tests
// =============================================================================

describe('getGapTrends', () => {
  describe('empty/invalid inputs', () => {
    it('returns empty trends for null jobs', () => {
      const dateRanges = {
        current: { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        previous: { start: new Date('2025-12-01'), end: new Date('2025-12-31') }
      }
      const result = getGapTrends(null, createMockProfile(), dateRanges)

      expect(result).toEqual({ closed: [], new: [], persistent: [], trending: { up: [], down: [] } })
    })

    it('returns empty trends for missing date ranges', () => {
      const jobs = [createMockJob({ description: 'Python' })]
      const result = getGapTrends(jobs, createMockProfile(), null)

      expect(result).toEqual({ closed: [], new: [], persistent: [], trending: { up: [], down: [] } })
    })

    it('returns empty trends when date ranges are incomplete', () => {
      const jobs = [createMockJob({ description: 'Python' })]
      const result = getGapTrends(jobs, createMockProfile(), { current: null, previous: null })

      expect(result).toEqual({ closed: [], new: [], persistent: [], trending: { up: [], down: [] } })
    })
  })

  describe('new gaps detection', () => {
    it('identifies new gaps appearing only in current period', () => {
      const profile = createMockProfile()
      const dateRanges = {
        current: { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        previous: { start: new Date('2025-12-01'), end: new Date('2025-12-31') }
      }
      const jobs = [
        // Only in current period
        createMockJob({ description: 'Python developer', found: '2026-01-15' })
      ]

      const result = getGapTrends(jobs, profile, dateRanges)

      expect(result.new).toContain('python')
    })
  })

  describe('closed gaps detection', () => {
    it('identifies gaps that are now in profile', () => {
      // Profile now has Python
      const profile = createMockProfile({
        skills: [{ name: 'JavaScript' }, { name: 'Python' }]
      })
      const dateRanges = {
        current: { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        previous: { start: new Date('2025-12-01'), end: new Date('2025-12-31') }
      }
      const jobs = [
        // Python mentioned in previous period (was a gap before)
        createMockJob({ description: 'Python developer', found: '2025-12-15' })
      ]

      const result = getGapTrends(jobs, profile, dateRanges)

      // Python was a gap in previous period but is now in profile
      expect(result.closed).toContain('python')
    })
  })

  describe('persistent gaps detection', () => {
    it('identifies gaps appearing in both periods', () => {
      const profile = createMockProfile()
      const dateRanges = {
        current: { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        previous: { start: new Date('2025-12-01'), end: new Date('2025-12-31') }
      }
      const jobs = [
        createMockJob({ description: 'AWS cloud', found: '2025-12-15' }),
        createMockJob({ description: 'AWS experience', found: '2026-01-15' })
      ]

      const result = getGapTrends(jobs, profile, dateRanges)

      expect(result.persistent).toContain('aws')
    })
  })

  describe('trending detection', () => {
    it('identifies trending up (count increased >50%)', () => {
      const profile = createMockProfile()
      const dateRanges = {
        current: { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        previous: { start: new Date('2025-12-01'), end: new Date('2025-12-31') }
      }
      const jobs = [
        // Previous: 2 mentions
        createMockJob({ description: 'Docker', found: '2025-12-10' }),
        createMockJob({ description: 'Docker', found: '2025-12-20' }),
        // Current: 4 mentions (100% increase)
        createMockJob({ description: 'Docker', found: '2026-01-05' }),
        createMockJob({ description: 'Docker', found: '2026-01-10' }),
        createMockJob({ description: 'Docker', found: '2026-01-15' }),
        createMockJob({ description: 'Docker', found: '2026-01-20' })
      ]

      const result = getGapTrends(jobs, profile, dateRanges)

      expect(result.trending.up).toContain('docker')
    })

    it('identifies trending down (count decreased >50%)', () => {
      const profile = createMockProfile()
      const dateRanges = {
        current: { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        previous: { start: new Date('2025-12-01'), end: new Date('2025-12-31') }
      }
      const jobs = [
        // Previous: 4 mentions
        createMockJob({ description: 'Kubernetes', found: '2025-12-05' }),
        createMockJob({ description: 'Kubernetes', found: '2025-12-10' }),
        createMockJob({ description: 'Kubernetes', found: '2025-12-15' }),
        createMockJob({ description: 'Kubernetes', found: '2025-12-20' }),
        // Current: 1 mention (75% decrease)
        createMockJob({ description: 'Kubernetes', found: '2026-01-15' })
      ]

      const result = getGapTrends(jobs, profile, dateRanges)

      expect(result.trending.down).toContain('kubernetes')
    })
  })
})

// =============================================================================
// getGapRecommendations Tests
// =============================================================================

describe('getGapRecommendations', () => {
  describe('empty/invalid inputs', () => {
    it('returns empty array for null gaps', () => {
      const result = getGapRecommendations(null)
      expect(result).toEqual([])
    })

    it('returns empty array for empty gaps array', () => {
      const result = getGapRecommendations([])
      expect(result).toEqual([])
    })
  })

  describe('recommendation generation', () => {
    it('generates recommendations for each gap', () => {
      const gaps = [
        { skill: 'python', count: 10, industries: ['Tech'], roles: ['Engineer'], priority: 'high' },
        { skill: 'aws', count: 5, industries: ['Finance'], roles: ['DevOps'], priority: 'medium' },
        { skill: 'docker', count: 3, industries: [], roles: [], priority: 'low' }
      ]

      const result = getGapRecommendations(gaps)

      expect(result).toHaveLength(3)
      expect(result[0].skill).toBe('python')
      expect(result[1].skill).toBe('aws')
      expect(result[2].skill).toBe('docker')
    })

    it('includes rationale with JD count', () => {
      const gaps = [
        { skill: 'python', count: 15, industries: [], roles: [], priority: 'high' }
      ]

      const result = getGapRecommendations(gaps)

      expect(result[0].rationale).toContain('15 JDs')
    })

    it('includes industry context in rationale', () => {
      const gaps = [
        { skill: 'python', count: 10, industries: ['Healthcare', 'Finance'], roles: [], priority: 'high' }
      ]

      const result = getGapRecommendations(gaps)

      expect(result[0].rationale).toContain('Healthcare')
      expect(result[0].rationale).toContain('Finance')
    })

    it('includes target role alignment in rationale', () => {
      const gaps = [
        { skill: 'python', count: 10, industries: [], roles: ['Data Scientist'], priority: 'high' }
      ]
      const targetRoles = ['Data Scientist']

      const result = getGapRecommendations(gaps, targetRoles)

      expect(result[0].rationale).toContain('aligns with your target roles')
    })
  })

  describe('action type assignment', () => {
    it('assigns learn action for high priority', () => {
      const gaps = [
        { skill: 'python', count: 12, industries: [], roles: [], priority: 'high' }
      ]

      const result = getGapRecommendations(gaps)

      expect(result[0].actionType).toBe('learn')
    })

    it('assigns learn action for medium priority when aligns with targets', () => {
      const gaps = [
        { skill: 'python', count: 6, industries: [], roles: ['Data Scientist'], priority: 'medium' }
      ]
      const targetRoles = ['Data Scientist']

      const result = getGapRecommendations(gaps, targetRoles)

      expect(result[0].actionType).toBe('learn')
    })

    it('assigns highlight action for medium priority when not aligned', () => {
      const gaps = [
        { skill: 'python', count: 6, industries: [], roles: ['Backend Dev'], priority: 'medium' }
      ]
      const targetRoles = ['Product Designer']

      const result = getGapRecommendations(gaps, targetRoles)

      expect(result[0].actionType).toBe('highlight')
    })

    it('assigns research action for low priority', () => {
      const gaps = [
        { skill: 'python', count: 3, industries: [], roles: [], priority: 'low' }
      ]

      const result = getGapRecommendations(gaps)

      expect(result[0].actionType).toBe('research')
    })
  })

  describe('priority preservation', () => {
    it('preserves priority from input gaps', () => {
      const gaps = [
        { skill: 'python', count: 15, industries: [], roles: [], priority: 'high' },
        { skill: 'aws', count: 7, industries: [], roles: [], priority: 'medium' },
        { skill: 'docker', count: 4, industries: [], roles: [], priority: 'low' }
      ]

      const result = getGapRecommendations(gaps)

      expect(result[0].priority).toBe('high')
      expect(result[1].priority).toBe('medium')
      expect(result[2].priority).toBe('low')
    })
  })

  describe('target role matching', () => {
    it('matches target roles case-insensitively', () => {
      const gaps = [
        { skill: 'python', count: 6, industries: [], roles: ['data scientist'], priority: 'medium' }
      ]
      const targetRoles = ['DATA SCIENTIST']

      const result = getGapRecommendations(gaps, targetRoles)

      expect(result[0].rationale).toContain('aligns')
    })

    it('matches partial role names', () => {
      const gaps = [
        { skill: 'python', count: 6, industries: [], roles: ['Senior Data Scientist'], priority: 'medium' }
      ]
      const targetRoles = ['Data Scientist']

      const result = getGapRecommendations(gaps, targetRoles)

      expect(result[0].rationale).toContain('aligns')
    })
  })
})
