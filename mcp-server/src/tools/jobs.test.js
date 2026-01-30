/**
 * Tests for Job Query Tools
 *
 * Tests the MCP tool functions that query job data.
 * Uses mocked loader module to avoid file system dependencies.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock the loader module before importing functions that use it
vi.mock('../data/loader.js', () => ({
  loadJobsFromDashboard: vi.fn()
}))

import { loadJobsFromDashboard } from '../data/loader.js'
import {
  getJobs,
  getJobDetail,
  getJobsByCompany,
  getApplicationStats,
  findSimilarJobs,
  getSearchHistory
} from './jobs.js'

// Sample job data for tests
const createMockJobs = () => [
  {
    id: 1,
    title: 'Creative Director',
    company: 'Acme Corp',
    industry: 'Technology',
    location: 'Boston, MA',
    salary: '$140k - $180k',
    fitScore: 85,
    status: 'apply-now',
    url: 'https://acme.com/jobs/1',
    found: '2026-01-20',
    applied: null,
    symbols: ['💰', '🏠'],
    connections: ['John Smith (VP Marketing)'],
    updates: []
  },
  {
    id: 2,
    title: 'Senior Designer',
    company: 'Tech Solutions',
    industry: 'Technology',
    location: 'Remote',
    salary: '$120k - $150k',
    fitScore: 72,
    status: 'applied',
    url: 'https://techsolutions.com/jobs/2',
    found: '2026-01-15',
    applied: '2026-01-25',
    symbols: ['🏠'],
    connections: [],
    updates: [
      { date: '2026-01-25', type: 'Applied', notes: 'Submitted application' }
    ]
  },
  {
    id: 3,
    title: 'Design Lead',
    company: 'Healthcare Inc',
    industry: 'Healthcare',
    location: 'New York, NY',
    salary: '$150k - $190k',
    fitScore: 90,
    status: 'apply-now',
    url: 'https://healthcare.com/jobs/3',
    found: '2026-01-22',
    applied: null,
    symbols: ['💰'],
    connections: [],
    updates: []
  },
  {
    id: 4,
    title: 'UX Director',
    company: 'ACME Corporation',
    industry: 'Technology',
    location: 'Boston, MA',
    salary: '$160k - $200k',
    fitScore: 45,
    status: 'maybe',
    url: 'https://acmecorp.com/jobs/4',
    found: '2026-01-18',
    applied: null,
    symbols: [],
    connections: [],
    updates: []
  },
  {
    id: 5,
    title: 'Product Designer',
    company: 'StartupXYZ',
    industry: 'Fintech',
    location: 'San Francisco, CA',
    salary: '$100k - $130k',
    fitScore: 60,
    status: 'applied',
    url: 'https://startupxyz.com/jobs/5',
    found: '2026-01-10',
    applied: '2026-01-20',
    symbols: [],
    connections: [],
    updates: [
      { date: '2026-01-20', type: 'Applied', notes: 'Submitted' },
      { date: '2026-01-28', type: 'Phone Screen', notes: 'Scheduled for tomorrow' }
    ]
  }
]

describe('getJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when no jobs exist', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: [] })

    const result = getJobs()

    expect(result).toEqual([])
  })

  it('returns all jobs when no filters applied', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getJobs()

    expect(result).toHaveLength(5)
  })

  it('filters by status correctly', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const applyNow = getJobs({ status: 'apply-now' })
    const applied = getJobs({ status: 'applied' })
    const maybe = getJobs({ status: 'maybe' })

    expect(applyNow).toHaveLength(2)
    expect(applyNow.every(j => j.status === 'apply-now')).toBe(true)

    expect(applied).toHaveLength(2)
    expect(applied.every(j => j.status === 'applied')).toBe(true)

    expect(maybe).toHaveLength(1)
    expect(maybe[0].status).toBe('maybe')
  })

  it('filters by minFitScore correctly', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const highFit = getJobs({ minFitScore: 80 })
    const mediumFit = getJobs({ minFitScore: 60 })

    expect(highFit).toHaveLength(2) // fitScores 85 and 90
    expect(highFit.every(j => j.fitScore >= 80)).toBe(true)

    expect(mediumFit).toHaveLength(4) // fitScores 60, 72, 85, 90
    expect(mediumFit.every(j => j.fitScore >= 60)).toBe(true)
  })

  it('sorts by fitScore descending', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getJobs()

    // Should be sorted: 90, 85, 72, 60, 45
    expect(result[0].fitScore).toBe(90)
    expect(result[1].fitScore).toBe(85)
    expect(result[2].fitScore).toBe(72)
    expect(result[3].fitScore).toBe(60)
    expect(result[4].fitScore).toBe(45)
  })

  it('respects maxResults limit', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getJobs({ maxResults: 2 })

    expect(result).toHaveLength(2)
    // Should get top 2 by fitScore
    expect(result[0].fitScore).toBe(90)
    expect(result[1].fitScore).toBe(85)
  })

  it('returns correct summary fields', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getJobs({ maxResults: 1 })

    expect(result[0]).toEqual({
      id: 3,
      title: 'Design Lead',
      company: 'Healthcare Inc',
      location: 'New York, NY',
      salary: '$150k - $190k',
      industry: 'Healthcare',
      fitScore: 90,
      status: 'apply-now',
      url: 'https://healthcare.com/jobs/3',
      found: '2026-01-22',
      applied: null,
      hasConnections: false,
      symbols: ['💰']
    })
  })

  it('sets hasConnections correctly', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getJobs()

    const jobWithConnections = result.find(j => j.id === 1)
    const jobWithoutConnections = result.find(j => j.id === 3)

    expect(jobWithConnections.hasConnections).toBe(true)
    expect(jobWithoutConnections.hasConnections).toBe(false)
  })

  it('combines filters correctly', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getJobs({
      status: 'apply-now',
      minFitScore: 85,
      maxResults: 10
    })

    expect(result).toHaveLength(2) // jobs 1 and 3 are apply-now with 85+ fitScore
    expect(result.every(j => j.status === 'apply-now' && j.fitScore >= 85)).toBe(true)
  })
})

describe('getJobDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns full job details for valid ID', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getJobDetail(1)

    expect(result.id).toBe(1)
    expect(result.title).toBe('Creative Director')
    expect(result.company).toBe('Acme Corp')
    expect(result.connections).toEqual(['John Smith (VP Marketing)'])
    expect(result.symbols).toEqual(['💰', '🏠'])
  })

  it('returns error object for non-existent ID', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getJobDetail(999)

    expect(result.error).toBe('Job with ID 999 not found')
  })

  it('calculates daysSinceFound correctly', () => {
    const mockJobs = createMockJobs()
    // Set found date to exactly 5 days ago
    const fiveDaysAgo = new Date()
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
    mockJobs[0].found = fiveDaysAgo.toISOString().split('T')[0]

    loadJobsFromDashboard.mockReturnValue({ jobs: mockJobs })

    const result = getJobDetail(1)

    expect(result.daysSinceFound).toBe(5)
  })

  it('calculates daysSinceApplied correctly', () => {
    const mockJobs = createMockJobs()
    // Set applied date to exactly 3 days ago
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    mockJobs[1].applied = threeDaysAgo.toISOString().split('T')[0]

    loadJobsFromDashboard.mockReturnValue({ jobs: mockJobs })

    const result = getJobDetail(2)

    expect(result.daysSinceApplied).toBe(3)
  })

  it('returns null for daysSinceApplied when not applied', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getJobDetail(1) // Job 1 has not applied

    expect(result.daysSinceApplied).toBeNull()
  })

  it('includes updateCount', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const resultNoUpdates = getJobDetail(1) // 0 updates
    const resultWithUpdates = getJobDetail(5) // 2 updates

    expect(resultNoUpdates.updateCount).toBe(0)
    expect(resultWithUpdates.updateCount).toBe(2)
  })
})

describe('getJobsByCompany', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('finds jobs by company name (case insensitive)', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    // Search for exact company name match
    const result = getJobsByCompany('Tech Solutions')

    expect(result).toHaveLength(1)
    expect(result[0].company).toBe('Tech Solutions')
  })

  it('finds jobs by partial company name match', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getJobsByCompany('acme')

    expect(result).toHaveLength(2) // 'Acme Corp' and 'ACME Corporation'
    expect(result.some(j => j.company === 'Acme Corp')).toBe(true)
    expect(result.some(j => j.company === 'ACME Corporation')).toBe(true)
  })

  it('returns empty array when no match', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getJobsByCompany('NonExistentCorp')

    expect(result).toEqual([])
  })

  it('handles case variations correctly', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const upper = getJobsByCompany('TECH SOLUTIONS')
    const lower = getJobsByCompany('tech solutions')
    const mixed = getJobsByCompany('Tech Solutions')

    expect(upper).toHaveLength(1)
    expect(lower).toHaveLength(1)
    expect(mixed).toHaveLength(1)
    expect(upper[0].id).toBe(lower[0].id)
    expect(lower[0].id).toBe(mixed[0].id)
  })
})

describe('getApplicationStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calculates total correctly', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getApplicationStats()

    expect(result.total).toBe(5)
  })

  it('groups by status correctly', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getApplicationStats()

    expect(result.byStatus['apply-now']).toBe(2)
    expect(result.byStatus['applied']).toBe(2)
    expect(result.byStatus['maybe']).toBe(1)
  })

  it('groups by industry correctly', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getApplicationStats()

    expect(result.byIndustry['Technology']).toBe(3)
    expect(result.byIndustry['Healthcare']).toBe(1)
    expect(result.byIndustry['Fintech']).toBe(1)
  })

  it('calculates fit score distribution (high/medium/low)', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getApplicationStats()

    // High: 85, 90 (75+)
    // Medium: 72, 60 (55-74)
    // Low: 45 (<55)
    expect(result.fitScoreDistribution.high).toBe(2)
    expect(result.fitScoreDistribution.medium).toBe(2)
    expect(result.fitScoreDistribution.low).toBe(1)
  })

  it('calculates averageFitScore', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getApplicationStats()

    // (85 + 72 + 90 + 45 + 60) / 5 = 70.4 -> rounded to 70
    expect(result.averageFitScore).toBe(70)
  })

  it('calculates response rate correctly', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getApplicationStats()

    // 2 applied jobs, 1 has Phone Screen (job 5)
    // Response rate = 1/2 = 50%
    expect(result.applied.total).toBe(2)
    expect(result.applied.withResponse).toBe(1)
    expect(result.applied.responseRate).toBe(50)
  })

  it('calculates interview rate correctly', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = getApplicationStats()

    // 2 applied jobs, 1 has Phone Screen (job 5)
    // Interview rate = 1/2 = 50%
    expect(result.applied.interviewed).toBe(1)
    expect(result.applied.interviewRate).toBe(50)
  })

  it('handles empty jobs array', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: [] })

    const result = getApplicationStats()

    expect(result.total).toBe(0)
    expect(result.averageFitScore).toBe(0)
    expect(result.applied.responseRate).toBe(0)
  })
})

describe('findSimilarJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error for non-existent job ID', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = findSimilarJobs(999)

    expect(result.error).toBe('Job with ID 999 not found')
  })

  it('finds jobs with same industry', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = findSimilarJobs(1) // Technology industry

    // Job 1 is Technology, should find jobs 2 and 4 (also Technology)
    const techJobs = result.filter(j => j.id === 2 || j.id === 4)
    expect(techJobs.length).toBeGreaterThan(0)
  })

  it('finds jobs with similar title keywords', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    // Job 1 is "Creative Director", job 4 is "UX Director" - shares "Director"
    const result = findSimilarJobs(1)

    const hasDirectorJob = result.some(j => j.title.includes('Director'))
    expect(hasDirectorJob).toBe(true)
  })

  it('ranks by similarity score', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = findSimilarJobs(1)

    // Results should be sorted by similarityScore descending
    for (let i = 1; i < result.length; i++) {
      expect(result[i-1].similarityScore).toBeGreaterThanOrEqual(result[i].similarityScore)
    }
  })

  it('excludes the source job from results', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = findSimilarJobs(1)

    const containsSourceJob = result.some(j => j.id === 1)
    expect(containsSourceJob).toBe(false)
  })

  it('returns correct fields in results', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: createMockJobs() })

    const result = findSimilarJobs(1)

    if (result.length > 0) {
      expect(result[0]).toHaveProperty('id')
      expect(result[0]).toHaveProperty('title')
      expect(result[0]).toHaveProperty('company')
      expect(result[0]).toHaveProperty('status')
      expect(result[0]).toHaveProperty('fitScore')
      expect(result[0]).toHaveProperty('similarityScore')
    }
  })
})

describe('getSearchHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns search history array', () => {
    const mockHistory = [
      { query: 'creative director boston', date: '2026-01-20' },
      { query: 'design lead remote', date: '2026-01-21' }
    ]
    loadJobsFromDashboard.mockReturnValue({
      jobs: [],
      searchHistory: mockHistory
    })

    const result = getSearchHistory()

    expect(result).toEqual(mockHistory)
  })

  it('returns empty array when no history', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: [] })

    const result = getSearchHistory()

    expect(result).toEqual([])
  })

  it('returns empty array when searchHistory is undefined', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: [], searchHistory: undefined })

    const result = getSearchHistory()

    expect(result).toEqual([])
  })
})
