/**
 * Discovery Tools Tests
 *
 * Tests MCP tool implementations for discovery funnel workflow.
 * Uses mocking to isolate tests from file system and external services.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock loader module
vi.mock('../data/loader.js', () => ({
  loadJobsFromDashboard: vi.fn(),
  writeJobsData: vi.fn()
}))

// Mock fit-scorer module
vi.mock('../services/fit-scorer.js', () => ({
  calculateFitScore: vi.fn()
}))

// Mock reasoning-generator module
vi.mock('../services/reasoning-generator.js', () => ({
  generateReasoning: vi.fn()
}))

// Import tools under test
import {
  researchJobUrl,
  getInboxForReview,
  confirmJobToDashboard,
  deferJob
} from './discovery.js'

// Import mocked modules
import { loadJobsFromDashboard, writeJobsData } from '../data/loader.js'
import { calculateFitScore } from '../services/fit-scorer.js'
import { generateReasoning } from '../services/reasoning-generator.js'

// Test fixtures
function createTestJobsData(overrides = {}) {
  return {
    jobs: overrides.jobs || [
      {
        id: 1,
        title: 'Creative Director',
        company: 'Acme Corp',
        location: 'Boston',
        salary: '$150,000',
        status: 'inbox',
        fitScore: 85,
        found: '2026-01-25',
        url: 'https://jobs.acme.com/creative-director'
      },
      {
        id: 2,
        title: 'Design Lead',
        company: 'Tech Co',
        location: 'Remote',
        salary: '$130,000',
        status: 'inbox',
        fitScore: 72,
        found: '2026-01-28',
        url: 'https://jobs.techco.com/design-lead'
      },
      {
        id: 3,
        title: 'Senior Designer',
        company: 'Startup Inc',
        location: 'New York',
        salary: '$120,000',
        status: 'apply-now',
        fitScore: 80,
        found: '2026-01-20',
        url: 'https://jobs.startup.com/senior-designer'
      }
    ],
    searchHistory: [],
    settings: {}
  }
}

describe('researchJobUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadJobsFromDashboard).mockReturnValue(createTestJobsData())
    vi.mocked(calculateFitScore).mockReturnValue({
      score: 85,
      breakdown: { base: 50, role: 25, industry: 10, location: 0, salary: 0, skills: 0 },
      usingDefaults: false
    })
    vi.mocked(generateReasoning).mockReturnValue({
      score: 85,
      summary: 'Strong match (85/100). Good role alignment.',
      whyIncluded: ['Title matches target roles'],
      considerations: [],
      breakdown: { role: '25/25 points - exact match' }
    })
  })

  it('returns error for invalid URL format', async () => {
    const result = await researchJobUrl({ url: 'not-a-url' })

    expect(result.status).toBe('error')
    expect(result.error).toContain('Invalid URL')
  })

  it('returns error for missing URL', async () => {
    const result = await researchJobUrl({ url: '' })

    expect(result.status).toBe('error')
    expect(result.error).toContain('Invalid URL')
  })

  it('returns duplicate status when URL already exists', async () => {
    const result = await researchJobUrl({ url: 'https://jobs.acme.com/creative-director' })

    expect(result.status).toBe('duplicate')
    expect(result.existingJob).toBeDefined()
    expect(result.existingJob.id).toBe(1)
    expect(result.existingJob.company).toBe('Acme Corp')
  })

  it('returns partial_research when Worker URL is not configured', async () => {
    // No JOB_VALIDATOR_URL set
    delete process.env.JOB_VALIDATOR_URL

    const result = await researchJobUrl({ url: 'https://jobs.newcompany.com/role' })

    expect(result.status).toBe('partial_research')
    expect(result.requiresManualEntry).toBe(true)
    expect(result.missingFields).toContain('title')
    expect(result.missingFields).toContain('company')
    expect(result.missingFields).toContain('description')
  })

  it('includes reasoning field when research is successful', async () => {
    // Set up mock Worker response
    const originalEnv = process.env.JOB_VALIDATOR_URL
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    // Mock global fetch
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        job: {
          title: 'New Role',
          company: 'New Corp',
          location: 'Chicago',
          salary: '$140,000'
        }
      })
    })

    const result = await researchJobUrl({ url: 'https://jobs.newcorp.com/new-role' })

    expect(result.status).toBe('ready_for_review')
    expect(result.reasoning).toBeDefined()
    expect(result.reasoning.score).toBe(85)
    expect(result.reasoning.summary).toContain('Strong match')
    expect(result.reasoning.whyIncluded).toContain('Title matches target roles')

    // Cleanup
    global.fetch = originalFetch
    process.env.JOB_VALIDATOR_URL = originalEnv
  })
})

describe('getInboxForReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadJobsFromDashboard).mockReturnValue(createTestJobsData())
  })

  it('returns only inbox jobs', () => {
    const result = getInboxForReview({})

    expect(result.count).toBe(2) // Only 2 jobs in inbox
    expect(result.jobs.every(j => j.id !== 3)).toBe(true) // Job 3 is apply-now
  })

  it('returns jobs sorted by fit score by default', () => {
    const result = getInboxForReview({})

    expect(result.jobs[0].fitScore).toBe(85)
    expect(result.jobs[1].fitScore).toBe(72)
  })

  it('sorts by found date when requested', () => {
    const result = getInboxForReview({ sortBy: 'found' })

    // Job 2 (found 2026-01-28) should come before Job 1 (found 2026-01-25)
    expect(result.jobs[0].id).toBe(2)
    expect(result.jobs[1].id).toBe(1)
  })

  it('returns empty list when no inbox jobs', () => {
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [{ id: 1, status: 'applied' }],
      searchHistory: [],
      settings: {}
    })

    const result = getInboxForReview({})

    expect(result.count).toBe(0)
    expect(result.jobs).toHaveLength(0)
    expect(result.summary.total).toBe(0)
  })

  it('includes summary statistics', () => {
    const result = getInboxForReview({})

    expect(result.summary).toBeDefined()
    expect(result.summary.total).toBe(2)
    expect(result.summary.highFit).toBe(1) // Only job 1 has fitScore >= 80
  })

  it('includes presentationNote', () => {
    const result = getInboxForReview({})

    expect(result.presentationNote).toContain('Claude formats')
  })
})

describe('confirmJobToDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadJobsFromDashboard).mockReturnValue(createTestJobsData())
    vi.mocked(writeJobsData).mockImplementation(() => {})
  })

  it('moves inbox job to target status and calls writeJobsData', () => {
    const result = confirmJobToDashboard({ jobId: 1, status: 'apply-now' })

    expect(result.success).toBe(true)
    expect(result.previousStatus).toBe('inbox')
    expect(result.newStatus).toBe('apply-now')
    expect(writeJobsData).toHaveBeenCalled()
  })

  it('rejects if job not in inbox', () => {
    const result = confirmJobToDashboard({ jobId: 3, status: 'apply-now' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('must be in inbox')
    expect(writeJobsData).not.toHaveBeenCalled()
  })

  it('rejects invalid status', () => {
    const result = confirmJobToDashboard({ jobId: 1, status: 'invalid-status' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid status')
  })

  it('returns error for non-existent job', () => {
    const result = confirmJobToDashboard({ jobId: 999, status: 'apply-now' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('includes confirmation message with job title', () => {
    const result = confirmJobToDashboard({ jobId: 1, status: 'maybe' })

    expect(result.message).toContain('Creative Director')
    expect(result.message).toContain('Acme Corp')
    expect(result.message).toContain('maybe')
  })

  it('accepts all valid statuses', () => {
    const statuses = ['apply-now', 'maybe', 'probably-not']

    for (const status of statuses) {
      vi.mocked(loadJobsFromDashboard).mockReturnValue(createTestJobsData())
      const result = confirmJobToDashboard({ jobId: 1, status })
      expect(result.success).toBe(true)
      expect(result.newStatus).toBe(status)
    }
  })
})

describe('deferJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadJobsFromDashboard).mockReturnValue(createTestJobsData())
    vi.mocked(writeJobsData).mockImplementation(() => {})
  })

  it('sets deferredAt and reason and calls writeJobsData', () => {
    const result = deferJob({ jobId: 1, reason: 'Waiting for more info' })

    expect(result.success).toBe(true)
    expect(result.message).toContain('Waiting for more info')
    expect(writeJobsData).toHaveBeenCalled()
  })

  it('sets reviewAfter when provided', () => {
    const result = deferJob({
      jobId: 1,
      reason: 'Check back later',
      reviewAfter: '2026-02-15'
    })

    expect(result.success).toBe(true)
    expect(result.deferredUntil).toBe('2026-02-15')
  })

  it('returns error for missing reason', () => {
    const result = deferJob({ jobId: 1, reason: '' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('reason is required')
    expect(writeJobsData).not.toHaveBeenCalled()
  })

  it('returns error for non-existent job', () => {
    const result = deferJob({ jobId: 999, reason: 'Test' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('adds update entry to job history', () => {
    let savedData = null
    vi.mocked(writeJobsData).mockImplementation((data) => {
      savedData = data
    })

    deferJob({ jobId: 1, reason: 'Needs review' })

    expect(savedData).not.toBeNull()
    const job = savedData.jobs.find(j => j.id === 1)
    expect(job.updates).toContainEqual(expect.objectContaining({
      type: 'Deferred',
      notes: 'Needs review'
    }))
  })
})
