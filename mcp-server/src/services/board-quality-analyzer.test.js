/**
 * Board Quality Analyzer Service Tests
 *
 * Tests for analyzing job board quality from historical job data.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock loader module
vi.mock('../data/loader.js', () => ({
  loadJobsFromDashboard: vi.fn()
}))

// Mock board-registry module
vi.mock('./board-registry.js', () => ({
  loadBoardRegistry: vi.fn(),
  saveBoardRegistry: vi.fn(),
  getBoardById: vi.fn()
}))

import { loadJobsFromDashboard } from '../data/loader.js'
import { loadBoardRegistry, saveBoardRegistry, getBoardById } from './board-registry.js'

// Import functions under test
import {
  analyzeBoardQuality,
  syncQualityToRegistry,
  getBoardQualityReport
} from './board-quality-analyzer.js'

// Test fixtures
function createTestJobs() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

  return {
    jobs: [
      // LinkedIn jobs - mixed quality
      {
        id: 1,
        title: 'Senior Designer',
        company: 'Acme Corp',
        sourceBoard: 'linkedin',
        extractionQuality: 'complete',
        status: 'applied',
        location: 'Boston',
        salary: '$120,000',
        description: 'A great role for experienced designers...',
        isDirectToCompany: false,
        found: thirtyDaysAgo.toISOString()
      },
      {
        id: 2,
        title: 'UX Lead',
        company: 'Tech Co',
        sourceBoard: 'linkedin',
        extractionQuality: 'partial',
        status: 'maybe',
        location: 'NYC',
        isDirectToCompany: false,
        found: fiveDaysAgo.toISOString()
      },
      {
        id: 3,
        title: 'Creative Director',
        company: 'Startup Inc',
        sourceBoard: 'linkedin',
        extractionQuality: 'complete',
        status: 'archived',
        location: 'Remote',
        salary: '$150,000',
        description: 'Lead our creative team...',
        isDirectToCompany: true,
        found: fiveDaysAgo.toISOString(),
        closedAt: twoDaysAgo.toISOString()
      },
      // Greenhouse jobs - high quality
      {
        id: 4,
        title: 'Product Designer',
        company: 'Growth Co',
        sourceBoard: 'greenhouse',
        extractionQuality: 'complete',
        status: 'applied',
        location: 'San Francisco',
        salary: '$140,000',
        description: 'Join our product team...',
        isDirectToCompany: true,
        found: fiveDaysAgo.toISOString()
      },
      {
        id: 5,
        title: 'Design Manager',
        company: 'Enterprise Inc',
        sourceBoard: 'greenhouse',
        extractionQuality: 'complete',
        status: 'apply-now',
        location: 'Austin',
        salary: '$160,000',
        description: 'Manage a team of designers...',
        isDirectToCompany: true,
        found: twoDaysAgo.toISOString()
      },
      // Indeed jobs - lower quality
      {
        id: 6,
        title: 'Designer',
        company: 'Unknown',
        sourceBoard: 'indeed',
        extractionQuality: 'partial',
        status: 'probably-not',
        location: 'Chicago',
        isDirectToCompany: false,
        found: fiveDaysAgo.toISOString()
      },
      {
        id: 7,
        title: '',
        company: 'Some Corp',
        sourceBoard: 'indeed',
        extractionQuality: 'failed',
        status: 'archived',
        isDirectToCompany: false,
        found: fiveDaysAgo.toISOString(),
        closedAt: twoDaysAgo.toISOString()
      },
      // Unknown source
      {
        id: 8,
        title: 'Mystery Role',
        company: 'Mystery Co',
        extractionQuality: 'partial',
        status: 'maybe',
        found: thirtyDaysAgo.toISOString()
      }
    ],
    searchHistory: [],
    settings: {}
  }
}

function createTestRegistry() {
  return {
    version: '1.0',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-31T00:00:00Z',
    boards: [
      {
        id: 'linkedin',
        name: 'LinkedIn',
        domain: 'linkedin.com',
        status: 'active',
        quality: { rating: 50 },
        metrics: {}
      },
      {
        id: 'greenhouse',
        name: 'Greenhouse',
        domain: 'greenhouse.io',
        status: 'active',
        quality: { rating: 80 },
        metrics: {}
      }
    ],
    blacklist: [],
    testingBoards: []
  }
}

describe('analyzeBoardQuality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadJobsFromDashboard).mockReturnValue(createTestJobs())
  })

  it('groups jobs by source board', () => {
    const result = analyzeBoardQuality()

    expect(result.boardsFound).toBe(4) // linkedin, greenhouse, indeed, unknown
    expect(result.totalJobsAnalyzed).toBe(8)
  })

  it('calculates extraction rate correctly', () => {
    const result = analyzeBoardQuality()

    // LinkedIn: 2 complete + 1 partial*0.5 = 2.5 / 3 = ~83%
    const linkedin = result.boards.find(b => b.boardId === 'linkedin')
    expect(linkedin.metrics.extractionRate).toBeGreaterThan(80)

    // Greenhouse: 2 complete / 2 = 100%
    const greenhouse = result.boards.find(b => b.boardId === 'greenhouse')
    expect(greenhouse.metrics.extractionRate).toBe(100)

    // Indeed: 1 partial*0.5 + 1 failed*0 = 0.5 / 2 = 25%
    const indeed = result.boards.find(b => b.boardId === 'indeed')
    expect(indeed.metrics.extractionRate).toBe(25)
  })

  it('calculates direct-to-company rate', () => {
    const result = analyzeBoardQuality()

    // LinkedIn: 1 direct / 3 total with isDirectToCompany set = ~33%
    const linkedin = result.boards.find(b => b.boardId === 'linkedin')
    expect(linkedin.metrics.directRate).toBe(33)

    // Greenhouse: 2 direct / 2 = 100%
    const greenhouse = result.boards.find(b => b.boardId === 'greenhouse')
    expect(greenhouse.metrics.directRate).toBe(100)

    // Indeed: 0 direct / 2 = 0%
    const indeed = result.boards.find(b => b.boardId === 'indeed')
    expect(indeed.metrics.directRate).toBe(0)
  })

  it('calculates data completeness rate', () => {
    const result = analyzeBoardQuality()

    // Greenhouse: both jobs have title, company, location, salary = 100%
    const greenhouse = result.boards.find(b => b.boardId === 'greenhouse')
    expect(greenhouse.metrics.completenessRate).toBe(100)

    // Indeed: partial data
    const indeed = result.boards.find(b => b.boardId === 'indeed')
    expect(indeed.metrics.completenessRate).toBeLessThan(100)
  })

  it('calculates conversion rate (applied / non-archived)', () => {
    const result = analyzeBoardQuality()

    // LinkedIn: 1 applied / 2 non-archived = 50%
    const linkedin = result.boards.find(b => b.boardId === 'linkedin')
    expect(linkedin.metrics.conversionRate).toBe(50)

    // Greenhouse: 1 applied / 2 non-archived = 50%
    const greenhouse = result.boards.find(b => b.boardId === 'greenhouse')
    expect(greenhouse.metrics.conversionRate).toBe(50)
  })

  it('calculates overall quality score with weighted formula', () => {
    const result = analyzeBoardQuality()

    // Quality = 30% extraction + 25% freshness + 20% direct + 15% completeness + 10% conversion
    const greenhouse = result.boards.find(b => b.boardId === 'greenhouse')

    // Greenhouse should have high quality (100% extraction, 100% direct, 100% completeness)
    expect(greenhouse.qualityScore).toBeGreaterThanOrEqual(75)
  })

  it('sorts boards by quality score descending', () => {
    const result = analyzeBoardQuality()

    // Verify sorted order
    for (let i = 1; i < result.boards.length; i++) {
      expect(result.boards[i - 1].qualityScore).toBeGreaterThanOrEqual(result.boards[i].qualityScore)
    }
  })

  it('generates recommendations for low-quality boards', () => {
    // Need 5+ jobs and <60% extraction for poor extraction warning
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        { id: 1, sourceBoard: 'bad-board', extractionQuality: 'failed', status: 'archived' },
        { id: 2, sourceBoard: 'bad-board', extractionQuality: 'failed', status: 'archived' },
        { id: 3, sourceBoard: 'bad-board', extractionQuality: 'failed', status: 'archived' },
        { id: 4, sourceBoard: 'bad-board', extractionQuality: 'failed', status: 'archived' },
        { id: 5, sourceBoard: 'bad-board', extractionQuality: 'failed', status: 'archived' }
      ]
    })

    const result = analyzeBoardQuality()

    const badRec = result.recommendations.find(
      r => r.boardId === 'bad-board' && r.issue.includes('extraction')
    )
    expect(badRec).toBeDefined()
  })

  it('generates recommendations for high-quality boards', () => {
    const now = new Date()
    const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

    // Need 5+ jobs and quality score >= 75 for success recommendation
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        {
          id: 1, sourceBoard: 'great-board', extractionQuality: 'complete',
          isDirectToCompany: true, title: 'J1', company: 'C1', location: 'L1', salary: '$100k',
          status: 'applied', found: recentDate.toISOString()
        },
        {
          id: 2, sourceBoard: 'great-board', extractionQuality: 'complete',
          isDirectToCompany: true, title: 'J2', company: 'C2', location: 'L2', salary: '$110k',
          status: 'applied', found: recentDate.toISOString()
        },
        {
          id: 3, sourceBoard: 'great-board', extractionQuality: 'complete',
          isDirectToCompany: true, title: 'J3', company: 'C3', location: 'L3', salary: '$120k',
          status: 'apply-now', found: recentDate.toISOString()
        },
        {
          id: 4, sourceBoard: 'great-board', extractionQuality: 'complete',
          isDirectToCompany: true, title: 'J4', company: 'C4', location: 'L4', salary: '$130k',
          status: 'apply-now', found: recentDate.toISOString()
        },
        {
          id: 5, sourceBoard: 'great-board', extractionQuality: 'complete',
          isDirectToCompany: true, title: 'J5', company: 'C5', location: 'L5', salary: '$140k',
          status: 'maybe', found: recentDate.toISOString()
        }
      ]
    })

    const result = analyzeBoardQuality()

    const greatRec = result.recommendations.find(
      r => r.boardId === 'great-board' && r.type === 'success'
    )
    expect(greatRec).toBeDefined()
  })

  it('returns empty boards when no jobs', () => {
    vi.mocked(loadJobsFromDashboard).mockReturnValue({ jobs: [] })

    const result = analyzeBoardQuality()

    expect(result.totalJobsAnalyzed).toBe(0)
    expect(result.boardsFound).toBe(0)
    expect(result.boards).toHaveLength(0)
  })

  it('handles jobs without sourceBoard field', () => {
    const result = analyzeBoardQuality()

    // Should have 'unknown' board for jobs without sourceBoard
    const unknown = result.boards.find(b => b.boardId === 'unknown')
    expect(unknown).toBeDefined()
    expect(unknown.totalJobs).toBe(1)
  })

  it('tracks closed jobs for freshness calculation', () => {
    const result = analyzeBoardQuality()

    // LinkedIn has 1 job closed within 7 days
    const linkedin = result.boards.find(b => b.boardId === 'linkedin')
    expect(linkedin.recentActivity.closedWithin7Days).toBe(1)
  })

  it('tracks recent job additions', () => {
    const result = analyzeBoardQuality()

    // Most jobs are added in last 30 days
    const linkedin = result.boards.find(b => b.boardId === 'linkedin')
    expect(linkedin.recentActivity.jobsLast30Days).toBeGreaterThanOrEqual(2)
  })
})

describe('syncQualityToRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadJobsFromDashboard).mockReturnValue(createTestJobs())
    vi.mocked(loadBoardRegistry).mockReturnValue(createTestRegistry())
    vi.mocked(saveBoardRegistry).mockReturnValue({ success: true })
  })

  it('updates existing boards with quality scores', () => {
    const result = syncQualityToRegistry()

    expect(result.updated).toBeGreaterThanOrEqual(2) // linkedin and greenhouse exist
    expect(saveBoardRegistry).toHaveBeenCalled()
  })

  it('discovers new boards from job data', () => {
    const result = syncQualityToRegistry()

    // 'indeed' should be discovered and added to testing
    expect(result.added).toBeGreaterThanOrEqual(1)
  })

  it('skips boards with less than 2 jobs', () => {
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        { id: 1, sourceBoard: 'rare-board', extractionQuality: 'complete' }
      ]
    })

    const result = syncQualityToRegistry()

    // rare-board should be skipped (only 1 job)
    const savedCall = saveBoardRegistry.mock.calls[0]?.[0]
    const rareBoard = savedCall?.testingBoards?.find(b => b.id === 'rare-board')
    expect(rareBoard).toBeUndefined()
  })

  it('skips unknown source boards', () => {
    const result = syncQualityToRegistry()

    // 'unknown' board should be skipped
    const savedCall = saveBoardRegistry.mock.calls[0]?.[0]
    const unknownBoard = savedCall?.boards?.find(b => b.id === 'unknown')
    expect(unknownBoard).toBeUndefined()
  })

  it('updates quality metrics on existing board', () => {
    syncQualityToRegistry()

    const savedRegistry = saveBoardRegistry.mock.calls[0][0]
    const linkedin = savedRegistry.boards.find(b => b.id === 'linkedin')

    expect(linkedin.quality.rating).toBeDefined()
    expect(linkedin.quality.dataCompleteness).toBeDefined()
    expect(linkedin.quality.extractionRate).toBeDefined()
    expect(linkedin.quality.lastAnalyzed).toBeDefined()
  })

  it('adds new boards to testing queue with correct structure', () => {
    syncQualityToRegistry()

    const savedRegistry = saveBoardRegistry.mock.calls[0][0]
    const indeed = savedRegistry.testingBoards.find(b => b.id === 'indeed')

    expect(indeed).toBeDefined()
    expect(indeed.status).toBe('testing')
    expect(indeed.source).toBe('auto-detected')
    expect(indeed.quality).toBeDefined()
    expect(indeed.metrics.totalFromAnalysis).toBeDefined()
  })

  it('returns sync summary', () => {
    const result = syncQualityToRegistry()

    expect(result.updated).toBeDefined()
    expect(result.added).toBeDefined()
    expect(result.totalBoards).toBeDefined()
    expect(result.message).toContain('Synced quality scores')
  })
})

describe('getBoardQualityReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadJobsFromDashboard).mockReturnValue(createTestJobs())
  })

  it('returns detailed report for existing board', () => {
    const report = getBoardQualityReport('linkedin')

    expect(report.boardId).toBe('linkedin')
    expect(report.name).toBe('LinkedIn')
    expect(report.totalJobs).toBe(3)
    expect(report.qualityScore).toBeDefined()
    expect(report.metrics).toBeDefined()
    expect(report.counts).toBeDefined()
    expect(report.recentActivity).toBeDefined()
  })

  it('returns error for non-existent board', () => {
    const report = getBoardQualityReport('nonexistent')

    expect(report.error).toContain('No jobs found')
    expect(report.availableBoards).toBeDefined()
    expect(report.availableBoards).toContain('linkedin')
    expect(report.availableBoards).toContain('greenhouse')
  })

  it('includes board recommendations in report', () => {
    const report = getBoardQualityReport('indeed')

    expect(report.recommendations).toBeDefined()
    expect(Array.isArray(report.recommendations)).toBe(true)
  })

  it('includes comparison metrics', () => {
    const report = getBoardQualityReport('greenhouse')

    expect(report.comparison).toBeDefined()
    expect(report.comparison.rank).toBeDefined()
    expect(report.comparison.totalBoards).toBeDefined()
    expect(report.comparison.aboveAverage).toBeDefined()
  })

  it('formats board name correctly', () => {
    const linkedinReport = getBoardQualityReport('linkedin')
    expect(linkedinReport.name).toBe('LinkedIn')

    const greenhouseReport = getBoardQualityReport('greenhouse')
    expect(greenhouseReport.name).toBe('Greenhouse')
  })
})

describe('quality score formula', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('weights extraction rate at 30%', () => {
    // Create jobs with 100% extraction, 0% everything else
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        { id: 1, sourceBoard: 'test', extractionQuality: 'complete', status: 'archived' },
        { id: 2, sourceBoard: 'test', extractionQuality: 'complete', status: 'archived' },
        { id: 3, sourceBoard: 'test', extractionQuality: 'complete', status: 'archived' }
      ]
    })

    const result = analyzeBoardQuality()
    const test = result.boards.find(b => b.boardId === 'test')

    // 100% extraction * 0.30 = 30 points (plus some from other metrics)
    expect(test.metrics.extractionRate).toBe(100)
    expect(test.qualityScore).toBeGreaterThanOrEqual(30)
  })

  it('weighs freshness rate at 25%', () => {
    const now = new Date()
    const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        { id: 1, sourceBoard: 'fresh', found: recentDate.toISOString(), status: 'apply-now' },
        { id: 2, sourceBoard: 'fresh', found: recentDate.toISOString(), status: 'apply-now' },
        { id: 3, sourceBoard: 'fresh', found: recentDate.toISOString(), status: 'apply-now' }
      ]
    })

    const result = analyzeBoardQuality()
    const fresh = result.boards.find(b => b.boardId === 'fresh')

    // No jobs closed within 7 days = 100% freshness
    expect(fresh.metrics.freshnessRate).toBe(100)
  })

  it('penalizes boards with many expired jobs', () => {
    const now = new Date()
    const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    const closedDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)

    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        {
          id: 1,
          sourceBoard: 'stale',
          found: recentDate.toISOString(),
          closedAt: closedDate.toISOString(),
          status: 'archived'
        },
        {
          id: 2,
          sourceBoard: 'stale',
          found: recentDate.toISOString(),
          closedAt: closedDate.toISOString(),
          status: 'archived'
        },
        {
          id: 3,
          sourceBoard: 'stale',
          found: recentDate.toISOString(),
          closedAt: closedDate.toISOString(),
          status: 'archived'
        }
      ]
    })

    const result = analyzeBoardQuality()
    const stale = result.boards.find(b => b.boardId === 'stale')

    // All jobs closed within 7 days = 0% freshness
    expect(stale.metrics.freshnessRate).toBe(0)
    // Should get low quality recommendation
    const rec = result.recommendations.find(
      r => r.boardId === 'stale' && r.issue.includes('expired')
    )
    expect(rec).toBeDefined()
  })
})

describe('recommendation generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generates warning for low extraction rate', () => {
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        { id: 1, sourceBoard: 'bad', extractionQuality: 'failed', status: 'archived' },
        { id: 2, sourceBoard: 'bad', extractionQuality: 'failed', status: 'archived' },
        { id: 3, sourceBoard: 'bad', extractionQuality: 'failed', status: 'archived' },
        { id: 4, sourceBoard: 'bad', extractionQuality: 'failed', status: 'archived' },
        { id: 5, sourceBoard: 'bad', extractionQuality: 'failed', status: 'archived' }
      ]
    })

    const result = analyzeBoardQuality()
    const rec = result.recommendations.find(
      r => r.boardId === 'bad' && r.issue.includes('extraction')
    )

    expect(rec).toBeDefined()
    expect(rec.type).toBe('warning')
    expect(rec.action).toContain('selectors')
  })

  it('generates info for aggregator boards', () => {
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        { id: 1, sourceBoard: 'agg', isDirectToCompany: false, status: 'apply-now' },
        { id: 2, sourceBoard: 'agg', isDirectToCompany: false, status: 'apply-now' },
        { id: 3, sourceBoard: 'agg', isDirectToCompany: false, status: 'apply-now' }
      ]
    })

    const result = analyzeBoardQuality()
    const rec = result.recommendations.find(
      r => r.boardId === 'agg' && r.issue.includes('Aggregator')
    )

    expect(rec).toBeDefined()
    expect(rec.type).toBe('info')
    expect(rec.action).toContain('direct')
  })

  it('generates success for high-quality boards', () => {
    const now = new Date()
    const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        {
          id: 1,
          sourceBoard: 'great',
          extractionQuality: 'complete',
          isDirectToCompany: true,
          title: 'Job 1',
          company: 'Co 1',
          location: 'Boston',
          salary: '$100k',
          status: 'applied',
          found: recentDate.toISOString()
        },
        {
          id: 2,
          sourceBoard: 'great',
          extractionQuality: 'complete',
          isDirectToCompany: true,
          title: 'Job 2',
          company: 'Co 2',
          location: 'NYC',
          salary: '$120k',
          status: 'applied',
          found: recentDate.toISOString()
        },
        {
          id: 3,
          sourceBoard: 'great',
          extractionQuality: 'complete',
          isDirectToCompany: true,
          title: 'Job 3',
          company: 'Co 3',
          location: 'SF',
          salary: '$130k',
          status: 'apply-now',
          found: recentDate.toISOString()
        },
        {
          id: 4,
          sourceBoard: 'great',
          extractionQuality: 'complete',
          isDirectToCompany: true,
          title: 'Job 4',
          company: 'Co 4',
          location: 'Austin',
          salary: '$140k',
          status: 'apply-now',
          found: recentDate.toISOString()
        },
        {
          id: 5,
          sourceBoard: 'great',
          extractionQuality: 'complete',
          isDirectToCompany: true,
          title: 'Job 5',
          company: 'Co 5',
          location: 'Remote',
          salary: '$150k',
          status: 'maybe',
          found: recentDate.toISOString()
        }
      ]
    })

    const result = analyzeBoardQuality()
    const rec = result.recommendations.find(
      r => r.boardId === 'great' && r.type === 'success'
    )

    expect(rec).toBeDefined()
    expect(rec.action).toContain('Prioritize')
  })

  it('generates danger for very low quality boards', () => {
    // Quality score < 30 requires very poor metrics across all dimensions
    // All failed extraction (0%), all archived (0% conversion), no completeness, no direct
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        { id: 1, sourceBoard: 'terrible', extractionQuality: 'failed', status: 'archived', isDirectToCompany: false },
        { id: 2, sourceBoard: 'terrible', extractionQuality: 'failed', status: 'archived', isDirectToCompany: false },
        { id: 3, sourceBoard: 'terrible', extractionQuality: 'failed', status: 'archived', isDirectToCompany: false },
        { id: 4, sourceBoard: 'terrible', extractionQuality: 'failed', status: 'archived', isDirectToCompany: false },
        { id: 5, sourceBoard: 'terrible', extractionQuality: 'failed', status: 'archived', isDirectToCompany: false }
      ]
    })

    const result = analyzeBoardQuality()
    const terrible = result.boards.find(b => b.boardId === 'terrible')

    // Verify quality score is low enough for danger recommendation
    expect(terrible.qualityScore).toBeLessThan(30)

    const rec = result.recommendations.find(
      r => r.boardId === 'terrible' && r.type === 'danger'
    )

    expect(rec).toBeDefined()
    expect(rec.action).toContain('blacklist')
  })

  it('skips recommendations for boards with few jobs', () => {
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        { id: 1, sourceBoard: 'tiny', extractionQuality: 'failed', status: 'archived' },
        { id: 2, sourceBoard: 'tiny', extractionQuality: 'failed', status: 'archived' }
      ]
    })

    const result = analyzeBoardQuality()
    const rec = result.recommendations.find(r => r.boardId === 'tiny')

    // Should not generate recommendations for boards with < 3 jobs
    expect(rec).toBeUndefined()
  })

  it('sorts recommendations by severity', () => {
    const now = new Date()
    const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        // Great board
        ...Array(5).fill(null).map((_, i) => ({
          id: i + 1,
          sourceBoard: 'great',
          extractionQuality: 'complete',
          isDirectToCompany: true,
          title: `Job ${i}`,
          company: `Co ${i}`,
          location: 'Boston',
          salary: '$100k',
          status: 'applied',
          found: recentDate.toISOString()
        })),
        // Terrible board
        ...Array(5).fill(null).map((_, i) => ({
          id: i + 10,
          sourceBoard: 'terrible',
          extractionQuality: 'failed',
          status: 'archived'
        }))
      ]
    })

    const result = analyzeBoardQuality()
    const types = result.recommendations.map(r => r.type)

    // Danger should come before success
    const dangerIndex = types.indexOf('danger')
    const successIndex = types.indexOf('success')
    if (dangerIndex !== -1 && successIndex !== -1) {
      expect(dangerIndex).toBeLessThan(successIndex)
    }
  })
})
