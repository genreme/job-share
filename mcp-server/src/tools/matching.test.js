/**
 * Resume Matching MCP Tools Tests
 *
 * Tests for getResumeMatch and getMatchScoresForActiveJobs tools.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock loader module
vi.mock('../data/loader.js', () => ({
  loadJobsFromDashboard: vi.fn()
}))

// Mock profile-loader module
vi.mock('../data/profile-loader.js', () => ({
  loadProfile: vi.fn()
}))

// Mock resume-matcher service
vi.mock('../services/resume-matcher.js', () => ({
  matchResumeToJob: vi.fn()
}))

// Import tools under test
import { getResumeMatch, getMatchScoresForActiveJobs } from './matching.js'

// Import mocked modules
import { loadJobsFromDashboard } from '../data/loader.js'
import { loadProfile } from '../data/profile-loader.js'
import { matchResumeToJob } from '../services/resume-matcher.js'

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockProfile(overrides = {}) {
  return {
    metadata: { version: 1, schemaVersion: '1.0' },
    skills: overrides.skills || [
      { id: '1', name: 'React' },
      { id: '2', name: 'TypeScript' },
      { id: '3', name: 'Figma' }
    ],
    experience: overrides.experience || [],
    preferences: { targetRoles: [] }
  }
}

function createMockJobsData(overrides = {}) {
  return {
    jobs: overrides.jobs || [
      {
        id: 1,
        title: 'Senior Designer',
        company: 'Acme Corp',
        status: 'apply-now',
        fitScore: 85,
        notes: 'Looking for React and Figma expertise'
      },
      {
        id: 2,
        title: 'Product Designer',
        company: 'Tech Co',
        status: 'inbox',
        fitScore: 72,
        notes: 'TypeScript and design systems experience'
      },
      {
        id: 3,
        title: 'UX Lead',
        company: 'Startup Inc',
        status: 'maybe',
        fitScore: 68,
        notes: '' // No description
      },
      {
        id: 4,
        title: 'Designer',
        company: 'Old Co',
        status: 'applied', // Not active
        fitScore: 80,
        notes: 'Full stack design'
      },
      {
        id: 5,
        title: 'Creative Director',
        company: 'Big Corp',
        status: 'archived', // Not active
        fitScore: 90,
        notes: 'Leadership role'
      }
    ],
    searchHistory: [],
    settings: {}
  }
}

function createMockMatchResult(overrides = {}) {
  return {
    score: overrides.score || 75,
    matched: overrides.matched || ['react', 'figma'],
    missing: overrides.missing || ['typescript', 'agile'],
    suggestions: overrides.suggestions || [
      { keyword: 'typescript', suggestion: 'Consider highlighting "typescript" experience' },
      { keyword: 'agile', suggestion: 'Consider highlighting "agile" experience' }
    ],
    totalJobKeywords: overrides.totalJobKeywords || 4,
    confidence: overrides.confidence || 'medium'
  }
}

// =============================================================================
// getResumeMatch Tests
// =============================================================================

describe('getResumeMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadProfile).mockReturnValue(createMockProfile())
    vi.mocked(loadJobsFromDashboard).mockReturnValue(createMockJobsData())
    vi.mocked(matchResumeToJob).mockReturnValue(createMockMatchResult())
  })

  describe('with jobId parameter', () => {
    it('returns match result for valid jobId', () => {
      const result = getResumeMatch({ jobId: 1 })

      expect(result.status).toBe('success')
      expect(result.score).toBe(75)
      expect(result.confidence).toBe('medium')
      expect(result.matched).toContain('react')
      expect(result.gaps).toContain('typescript')
    })

    it('includes job info in result', () => {
      const result = getResumeMatch({ jobId: 1 })

      expect(result.jobInfo).toBeDefined()
      expect(result.jobInfo.id).toBe(1)
      expect(result.jobInfo.title).toBe('Senior Designer')
      expect(result.jobInfo.company).toBe('Acme Corp')
      expect(result.jobInfo.fitScore).toBe(85)
    })

    it('returns error for non-existent jobId', () => {
      const result = getResumeMatch({ jobId: 999 })

      expect(result.status).toBe('error')
      expect(result.error).toContain('not found')
    })

    it('handles string jobId', () => {
      const result = getResumeMatch({ jobId: '1' })

      expect(result.status).toBe('success')
      expect(result.jobInfo.id).toBe(1)
    })

    it('returns error when job has no description', () => {
      const result = getResumeMatch({ jobId: 3 }) // Job 3 has empty notes

      expect(result.status).toBe('error')
      expect(result.error).toContain('No job description')
      expect(result.suggestion).toBeDefined()
    })
  })

  describe('with jobDescription parameter', () => {
    it('returns match result for provided description', () => {
      const result = getResumeMatch({
        jobDescription: 'Looking for React and TypeScript developer'
      })

      expect(result.status).toBe('success')
      expect(result.score).toBe(75)
      expect(matchResumeToJob).toHaveBeenCalledWith(
        expect.anything(),
        'Looking for React and TypeScript developer'
      )
    })

    it('does not require jobId when description provided', () => {
      const result = getResumeMatch({
        jobDescription: 'Any job description text'
      })

      expect(result.status).toBe('success')
      expect(loadJobsFromDashboard).not.toHaveBeenCalled()
    })

    it('prefers jobDescription over jobId when both provided', () => {
      const result = getResumeMatch({
        jobId: 1,
        jobDescription: 'Custom description text'
      })

      expect(result.status).toBe('success')
      expect(matchResumeToJob).toHaveBeenCalledWith(
        expect.anything(),
        'Custom description text'
      )
    })
  })

  describe('error handling', () => {
    it('returns error when profile load fails', () => {
      vi.mocked(loadProfile).mockImplementation(() => {
        throw new Error('Profile file not found')
      })

      const result = getResumeMatch({ jobDescription: 'test' })

      expect(result.status).toBe('error')
      expect(result.error).toContain('Failed to load profile')
      expect(result.details).toBe('Profile file not found')
    })

    it('returns error when neither jobId nor description provided', () => {
      const result = getResumeMatch({})

      expect(result.status).toBe('error')
      expect(result.error).toContain('No job description')
    })
  })

  describe('result formatting', () => {
    it('includes summary string', () => {
      const result = getResumeMatch({ jobId: 1 })

      expect(result.summary).toBeDefined()
      expect(result.summary).toContain('75%')
      expect(result.summary).toContain('2 skills matched')
      expect(result.summary).toContain('2 gaps')
    })

    it('formats partial matches correctly', () => {
      vi.mocked(matchResumeToJob).mockReturnValue({
        score: 80,
        matched: [
          'react',
          { keyword: 'typescript', via: 'javascript' }
        ],
        missing: [],
        suggestions: [],
        totalJobKeywords: 2,
        confidence: 'high'
      })

      const result = getResumeMatch({ jobId: 1 })

      expect(result.matched).toContain('react')
      expect(result.matched.some(m => m.includes('typescript') && m.includes('javascript'))).toBe(true)
    })

    it('includes suggestions array', () => {
      const result = getResumeMatch({ jobId: 1 })

      expect(result.suggestions).toBeDefined()
      expect(result.suggestions.length).toBe(2)
      expect(result.suggestions[0]).toHaveProperty('keyword')
      expect(result.suggestions[0]).toHaveProperty('suggestion')
    })

    it('includes totalJobKeywords', () => {
      const result = getResumeMatch({ jobId: 1 })

      expect(result.totalJobKeywords).toBe(4)
    })
  })
})

// =============================================================================
// getMatchScoresForActiveJobs Tests
// =============================================================================

describe('getMatchScoresForActiveJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadProfile).mockReturnValue(createMockProfile())
    vi.mocked(loadJobsFromDashboard).mockReturnValue(createMockJobsData())

    // Default mock: return different scores based on description content
    vi.mocked(matchResumeToJob).mockImplementation((profile, description) => {
      if (description.includes('React')) {
        return createMockMatchResult({ score: 90, confidence: 'high' })
      }
      if (description.includes('TypeScript')) {
        return createMockMatchResult({ score: 70, confidence: 'medium' })
      }
      return createMockMatchResult({ score: 50, confidence: 'low' })
    })
  })

  describe('filtering', () => {
    it('returns only active jobs (apply-now, maybe, inbox)', () => {
      const result = getMatchScoresForActiveJobs({})

      expect(result.status).toBe('success')
      expect(result.total).toBe(3) // Jobs 1, 2, 3 are active
      expect(result.jobs.every(j =>
        ['apply-now', 'maybe', 'inbox'].includes(j.status)
      )).toBe(true)
    })

    it('excludes applied and archived jobs', () => {
      const result = getMatchScoresForActiveJobs({})

      const ids = result.jobs.map(j => j.jobId)
      expect(ids).not.toContain(4) // applied
      expect(ids).not.toContain(5) // archived
    })
  })

  describe('sorting', () => {
    it('sorts by resumeMatch descending', () => {
      const result = getMatchScoresForActiveJobs({})

      // Job 1 has React (90 score), Job 2 has TypeScript (70 score)
      const scores = result.jobs
        .filter(j => j.resumeMatch !== null)
        .map(j => j.resumeMatch)

      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i])
      }
    })

    it('places jobs without description (null resumeMatch) at end', () => {
      const result = getMatchScoresForActiveJobs({})

      // Find the null score job
      const nullIndex = result.jobs.findIndex(j => j.resumeMatch === null)
      if (nullIndex !== -1) {
        // All jobs after null should also be null
        const remaining = result.jobs.slice(nullIndex)
        expect(remaining.every(j => j.resumeMatch === null)).toBe(true)
      }
    })
  })

  describe('job data', () => {
    it('includes all expected fields for each job', () => {
      const result = getMatchScoresForActiveJobs({})

      for (const job of result.jobs) {
        expect(job).toHaveProperty('jobId')
        expect(job).toHaveProperty('title')
        expect(job).toHaveProperty('company')
        expect(job).toHaveProperty('status')
        expect(job).toHaveProperty('fitScore')
        expect(job).toHaveProperty('resumeMatch')
        expect(job).toHaveProperty('confidence')
        expect(job).toHaveProperty('topGaps')
      }
    })

    it('includes topGaps (up to 3 missing skills)', () => {
      vi.mocked(matchResumeToJob).mockReturnValue(createMockMatchResult({
        missing: ['aws', 'docker', 'kubernetes', 'terraform', 'ansible']
      }))

      const result = getMatchScoresForActiveJobs({})
      const jobWithGaps = result.jobs.find(j => j.resumeMatch !== null)

      expect(jobWithGaps.topGaps.length).toBeLessThanOrEqual(3)
    })

    it('handles jobs without description gracefully', () => {
      const result = getMatchScoresForActiveJobs({})

      const noDescJob = result.jobs.find(j => j.jobId === 3)
      expect(noDescJob).toBeDefined()
      expect(noDescJob.resumeMatch).toBeNull()
      expect(noDescJob.confidence).toBe('no-data')
      expect(noDescJob.reason).toBeDefined()
    })
  })

  describe('summary stats', () => {
    it('calculates average match score', () => {
      const result = getMatchScoresForActiveJobs({})

      expect(result.averageMatchScore).toBeDefined()
      expect(typeof result.averageMatchScore).toBe('number')
    })

    it('counts high matches (score >= 70)', () => {
      const result = getMatchScoresForActiveJobs({})

      expect(result.highMatches).toBeDefined()
      expect(typeof result.highMatches).toBe('number')
    })

    it('counts jobs with no data', () => {
      const result = getMatchScoresForActiveJobs({})

      expect(result.noData).toBeDefined()
      expect(result.noData).toBe(1) // Job 3 has no description
    })

    it('returns total and showing counts', () => {
      const result = getMatchScoresForActiveJobs({})

      expect(result.total).toBe(3)
      expect(result.showing).toBe(3)
    })
  })

  describe('limit parameter', () => {
    it('respects limit parameter', () => {
      const result = getMatchScoresForActiveJobs({ limit: 2 })

      expect(result.showing).toBe(2)
      expect(result.jobs.length).toBe(2)
      expect(result.total).toBe(3) // Total is still all active jobs
    })

    it('handles limit larger than total', () => {
      const result = getMatchScoresForActiveJobs({ limit: 100 })

      expect(result.showing).toBe(3)
      expect(result.jobs.length).toBe(3)
    })
  })

  describe('error handling', () => {
    it('returns error when profile load fails', () => {
      vi.mocked(loadProfile).mockImplementation(() => {
        throw new Error('Profile not found')
      })

      const result = getMatchScoresForActiveJobs({})

      expect(result.status).toBe('error')
      expect(result.error).toContain('Failed to load profile')
    })

    it('handles empty jobs array', () => {
      vi.mocked(loadJobsFromDashboard).mockReturnValue({
        jobs: [],
        searchHistory: [],
        settings: {}
      })

      const result = getMatchScoresForActiveJobs({})

      expect(result.status).toBe('success')
      expect(result.total).toBe(0)
      expect(result.jobs).toEqual([])
    })

    it('handles no active jobs', () => {
      vi.mocked(loadJobsFromDashboard).mockReturnValue({
        jobs: [
          { id: 1, title: 'Test', status: 'archived', notes: 'test' }
        ],
        searchHistory: [],
        settings: {}
      })

      const result = getMatchScoresForActiveJobs({})

      expect(result.status).toBe('success')
      expect(result.total).toBe(0)
    })
  })

  describe('integration with matchResumeToJob', () => {
    it('calls matchResumeToJob for each job with description', () => {
      getMatchScoresForActiveJobs({})

      // Should be called for jobs with descriptions (1 and 2)
      expect(matchResumeToJob).toHaveBeenCalledTimes(2)
    })

    it('passes profile to matchResumeToJob', () => {
      const mockProfile = createMockProfile({ skills: [{ name: 'Custom' }] })
      vi.mocked(loadProfile).mockReturnValue(mockProfile)

      getMatchScoresForActiveJobs({})

      expect(matchResumeToJob).toHaveBeenCalledWith(
        mockProfile,
        expect.any(String)
      )
    })

    it('passes job notes as description', () => {
      getMatchScoresForActiveJobs({})

      expect(matchResumeToJob).toHaveBeenCalledWith(
        expect.anything(),
        'Looking for React and Figma expertise'
      )
    })
  })
})

// =============================================================================
// Edge Cases
// =============================================================================

describe('edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadProfile).mockReturnValue(createMockProfile())
  })

  it('getResumeMatch handles job with description field (not notes)', () => {
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [{
        id: 1,
        title: 'Test Job',
        company: 'Test Co',
        status: 'inbox',
        description: 'React developer wanted' // Using description field
        // No notes field
      }],
      searchHistory: [],
      settings: {}
    })

    vi.mocked(matchResumeToJob).mockReturnValue(createMockMatchResult())

    const result = getResumeMatch({ jobId: 1 })

    expect(result.status).toBe('success')
    expect(matchResumeToJob).toHaveBeenCalledWith(
      expect.anything(),
      'React developer wanted'
    )
  })

  it('getMatchScoresForActiveJobs handles mixed notes and description', () => {
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        { id: 1, title: 'J1', status: 'inbox', notes: 'From notes' },
        { id: 2, title: 'J2', status: 'inbox', description: 'From description' },
        { id: 3, title: 'J3', status: 'inbox' } // Neither
      ],
      searchHistory: [],
      settings: {}
    })

    vi.mocked(matchResumeToJob).mockReturnValue(createMockMatchResult())

    const result = getMatchScoresForActiveJobs({})

    expect(result.total).toBe(3)
    // Two jobs have descriptions
    expect(matchResumeToJob).toHaveBeenCalledTimes(2)
    // One job should have no data
    expect(result.noData).toBe(1)
  })

  it('getResumeMatch prefers notes over description', () => {
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [{
        id: 1,
        title: 'Test',
        company: 'Co',
        status: 'inbox',
        notes: 'From notes field',
        description: 'From description field'
      }],
      searchHistory: [],
      settings: {}
    })

    vi.mocked(matchResumeToJob).mockReturnValue(createMockMatchResult())

    const result = getResumeMatch({ jobId: 1 })

    expect(result.status).toBe('success')
    expect(matchResumeToJob).toHaveBeenCalledWith(
      expect.anything(),
      'From notes field' // Notes takes precedence
    )
  })
})
