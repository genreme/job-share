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
  deferJob,
  getExistingJobs,
  addJobManual
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

// ============================================================================
// INTEGRATION TESTS - Full Discovery Workflow
// ============================================================================

describe('integration: manual submission workflow', () => {
  // Use in-memory store that persists across test steps
  let jobStore = null

  beforeEach(() => {
    vi.clearAllMocks()

    // Create a fresh job store for each integration test
    jobStore = {
      jobs: [
        {
          id: 1,
          title: 'Existing Job',
          company: 'Old Corp',
          status: 'apply-now',
          fitScore: 70,
          found: '2026-01-20',
          url: 'https://oldcorp.com/job'
        }
      ],
      searchHistory: [],
      settings: {}
    }

    // Mock loader to use our in-memory store
    vi.mocked(loadJobsFromDashboard).mockImplementation(() => {
      // Return a deep copy to avoid reference mutations
      return JSON.parse(JSON.stringify(jobStore))
    })

    // Mock writeJobsData to update our in-memory store
    vi.mocked(writeJobsData).mockImplementation((data) => {
      jobStore = JSON.parse(JSON.stringify(data))
    })

    // Set up fit score and reasoning mocks
    vi.mocked(calculateFitScore).mockReturnValue({
      score: 85,
      breakdown: { base: 50, role: 25, industry: 10, location: 0, salary: 0, skills: 0 },
      usingDefaults: false
    })

    vi.mocked(generateReasoning).mockReturnValue({
      score: 85,
      summary: 'Strong match (85/100). Good role alignment.',
      whyIncluded: ['Title matches target roles', 'Industry aligns'],
      considerations: [],
      breakdown: {
        role: '25/25 points - exact match',
        industry: '10/20 points - acceptable',
        location: '0/15 points - not specified',
        salary: '0/15 points - not disclosed',
        skills: '0/10 points - no matches'
      }
    })
  })

  it('should complete full flow: research -> inbox -> confirm', async () => {
    // Set up mock Worker response
    const originalEnv = process.env.JOB_VALIDATOR_URL
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        job: {
          title: 'Creative Director',
          company: 'Awesome Inc',
          location: 'Boston',
          salary: '$150,000',
          industry: 'Technology',
          description: 'Lead creative team...'
        }
      })
    })

    // Step 1: Research a job URL
    const researchResult = await researchJobUrl({
      url: 'https://awesome.com/jobs/creative-director',
      notes: 'Found via LinkedIn'
    })

    expect(researchResult.status).toBe('ready_for_review')
    expect(researchResult.reasoning).toBeDefined()
    expect(researchResult.reasoning.score).toBe(85)
    expect(researchResult.reasoning.whyIncluded).toBeInstanceOf(Array)
    expect(researchResult.reasoning.whyIncluded.length).toBeGreaterThan(0)
    expect(researchResult.job.id).toBeDefined()
    const newJobId = researchResult.job.id

    // Step 2: Simulate job being added to inbox (normally extension or tool does this)
    // For integration test, manually add to store with inbox status
    jobStore.jobs.push({
      id: newJobId,
      title: 'Creative Director',
      company: 'Awesome Inc',
      location: 'Boston',
      salary: '$150,000',
      status: 'inbox',
      fitScore: 85,
      found: new Date().toISOString().split('T')[0],
      url: 'https://awesome.com/jobs/creative-director',
      notes: 'Found via LinkedIn'
    })

    // Step 3: Get inbox and verify job appears
    const inbox = getInboxForReview({})
    expect(inbox.count).toBeGreaterThan(0)
    const inboxJob = inbox.jobs.find(j => j.company === 'Awesome Inc')
    expect(inboxJob).toBeDefined()

    // Step 4: Confirm the job to dashboard
    const confirmResult = confirmJobToDashboard({
      jobId: newJobId,
      status: 'apply-now',
      notes: 'Great fit!'
    })

    expect(confirmResult.success).toBe(true)
    expect(confirmResult.newStatus).toBe('apply-now')

    // Step 5: Verify job no longer in inbox
    const inboxAfter = getInboxForReview({})
    const stillInInbox = inboxAfter.jobs.find(j => j.id === newJobId)
    expect(stillInInbox).toBeUndefined()

    // Cleanup
    global.fetch = originalFetch
    process.env.JOB_VALIDATOR_URL = originalEnv
  })

  it('should include reasoning from reasoning-generator in researchJobUrl output', async () => {
    // Configure specific mock responses for this test
    vi.mocked(calculateFitScore).mockReturnValue({
      score: 92,
      breakdown: { base: 50, role: 25, industry: 20, location: 12, salary: 0, skills: 0 },
      usingDefaults: false
    })

    vi.mocked(generateReasoning).mockReturnValue({
      score: 92,
      summary: 'Excellent match (92/100). Strong alignment across all criteria.',
      whyIncluded: [
        "'Creative Director' matches your target roles",
        "Industry aligns with your preferences",
        "Location (Boston) is preferred"
      ],
      considerations: ['Salary not disclosed'],
      breakdown: {
        role: '25/25 points - exact match',
        industry: '20/20 points - preferred',
        location: '12/15 points - preferred',
        salary: '0/15 points - not disclosed',
        skills: '0/10 points - no matches'
      }
    })

    // Set up mock Worker
    const originalEnv = process.env.JOB_VALIDATOR_URL
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        job: {
          title: 'Creative Director',
          company: 'Health Corp',
          location: 'Boston',
          industry: 'Healthcare'
        }
      })
    })

    const result = await researchJobUrl({ url: 'https://health.com/jobs/cd' })

    // Verify generateReasoning was called
    expect(generateReasoning).toHaveBeenCalled()

    // Verify reasoning is fully wired into output
    expect(result.status).toBe('ready_for_review')
    expect(result.reasoning).toBeDefined()
    expect(result.reasoning.score).toBe(92)
    expect(result.reasoning.summary).toContain('Excellent match')
    expect(result.reasoning.whyIncluded).toContain("'Creative Director' matches your target roles")
    expect(result.reasoning.considerations).toContain('Salary not disclosed')
    expect(result.reasoning.breakdown).toHaveProperty('role')
    expect(result.reasoning.breakdown).toHaveProperty('industry')
    expect(result.reasoning.breakdown).toHaveProperty('location')

    // Cleanup
    global.fetch = originalFetch
    process.env.JOB_VALIDATOR_URL = originalEnv
  })

  it('should complete defer flow with review date', () => {
    // Setup: Add an inbox job
    jobStore.jobs.push({
      id: 10,
      title: 'Deferred Test Job',
      company: 'Later Corp',
      status: 'inbox',
      fitScore: 65,
      found: '2026-01-28',
      url: 'https://later.com/job'
    })

    // Verify job is in inbox
    const inboxBefore = getInboxForReview({})
    expect(inboxBefore.jobs.find(j => j.id === 10)).toBeDefined()

    // Defer with reason and date
    const deferResult = deferJob({
      jobId: 10,
      reason: 'Waiting for Q2 hiring budget',
      reviewAfter: '2026-04-01'
    })

    expect(deferResult.success).toBe(true)
    expect(deferResult.deferredUntil).toBe('2026-04-01')

    // Verify deferred fields are set on job
    const deferredJob = jobStore.jobs.find(j => j.id === 10)
    expect(deferredJob.deferredReason).toBe('Waiting for Q2 hiring budget')
    expect(deferredJob.reviewAfter).toBe('2026-04-01')
    expect(deferredJob.deferredAt).toBeDefined()

    // Verify job still appears in inbox (deferred != removed)
    // Note: deferred jobs remain with inbox status until confirmed
    const inboxAfter = getInboxForReview({})
    expect(inboxAfter.jobs.find(j => j.id === 10)).toBeDefined()
  })

  it('should detect duplicate when same URL submitted twice', async () => {
    // Set up mock Worker
    const originalEnv = process.env.JOB_VALIDATOR_URL
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        job: {
          title: 'Duplicate Test',
          company: 'Test Corp'
        }
      })
    })

    // First submission succeeds
    const firstResult = await researchJobUrl({
      url: 'https://testcorp.com/duplicate-job'
    })
    expect(firstResult.status).toBe('ready_for_review')

    // Add job to store (simulating it being saved)
    jobStore.jobs.push({
      id: firstResult.job.id,
      title: 'Duplicate Test',
      company: 'Test Corp',
      status: 'inbox',
      url: 'https://testcorp.com/duplicate-job'
    })

    // Second submission should return duplicate status
    const secondResult = await researchJobUrl({
      url: 'https://testcorp.com/duplicate-job'
    })

    expect(secondResult.status).toBe('duplicate')
    expect(secondResult.existingJob).toBeDefined()
    expect(secondResult.existingJob.id).toBe(firstResult.job.id)
    expect(secondResult.message).toContain('already exists')

    // Cleanup
    global.fetch = originalFetch
    process.env.JOB_VALIDATOR_URL = originalEnv
  })

  it('should handle research failure gracefully', async () => {
    // Set up Worker URL but make fetch fail
    const originalEnv = process.env.JOB_VALIDATOR_URL
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    const originalFetch = global.fetch
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await researchJobUrl({
      url: 'https://failing.com/job'
    })

    // Should return partial_research with suggestion
    expect(result.status).toBe('partial_research')
    expect(result.requiresManualEntry).toBe(true)
    expect(result.missingFields).toContain('title')
    expect(result.missingFields).toContain('company')
    expect(result.research.warnings).toBeDefined()
    expect(result.research.warnings.some(w => w.includes('Network error'))).toBe(true)
    expect(result.nextStep).toBeDefined()

    // Cleanup
    global.fetch = originalFetch
    process.env.JOB_VALIDATOR_URL = originalEnv
  })

  it('should return requiresManualEntry when Worker unavailable', async () => {
    // Scenario 1: JOB_VALIDATOR_URL is undefined
    const originalEnv = process.env.JOB_VALIDATOR_URL
    delete process.env.JOB_VALIDATOR_URL

    const result1 = await researchJobUrl({
      url: 'https://noworker.com/job'
    })

    expect(result1.status).toBe('partial_research')
    expect(result1.requiresManualEntry).toBe(true)
    expect(result1.missingFields).toEqual(['title', 'company', 'description'])

    // Scenario 2: Worker fetch fails
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    const originalFetch = global.fetch
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

    const result2 = await researchJobUrl({
      url: 'https://workerfails.com/job'
    })

    expect(result2.status).toBe('partial_research')
    expect(result2.requiresManualEntry).toBe(true)
    expect(result2.missingFields).toContain('title')
    expect(result2.missingFields).toContain('company')

    // Cleanup
    global.fetch = originalFetch
    process.env.JOB_VALIDATOR_URL = originalEnv
  })
})

describe('integration: reasoning generator wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadJobsFromDashboard).mockReturnValue({ jobs: [], searchHistory: [], settings: {} })
    vi.mocked(writeJobsData).mockImplementation(() => {})
  })

  it('should call generateReasoning with job data and fit result', async () => {
    // Setup
    const mockFitResult = {
      score: 78,
      breakdown: { base: 50, role: 15, industry: 10, location: 3, salary: 0, skills: 0 },
      usingDefaults: true
    }
    vi.mocked(calculateFitScore).mockReturnValue(mockFitResult)

    vi.mocked(generateReasoning).mockReturnValue({
      score: 78,
      summary: 'Good potential (78/100).',
      whyIncluded: ['Partial role match'],
      considerations: ['Using default criteria'],
      breakdown: {}
    })

    const originalEnv = process.env.JOB_VALIDATOR_URL
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        job: {
          title: 'Test Role',
          company: 'Test Co',
          location: 'NYC'
        }
      })
    })

    await researchJobUrl({ url: 'https://test.com/job' })

    // Verify generateReasoning was called with correct arguments
    expect(generateReasoning).toHaveBeenCalledTimes(1)
    const [jobArg, fitResultArg] = generateReasoning.mock.calls[0]

    // Job data should have been passed
    expect(jobArg.title).toBe('Test Role')
    expect(jobArg.company).toBe('Test Co')
    expect(jobArg.location).toBe('NYC')

    // Fit result should have been passed
    expect(fitResultArg).toEqual(mockFitResult)

    // Cleanup
    global.fetch = originalFetch
    process.env.JOB_VALIDATOR_URL = originalEnv
  })

  it('should include all reasoning fields in ready_for_review response', async () => {
    vi.mocked(calculateFitScore).mockReturnValue({
      score: 88,
      breakdown: { base: 50, role: 25, industry: 8, location: 5, salary: 0, skills: 0 },
      usingDefaults: false
    })

    const fullReasoning = {
      score: 88,
      summary: 'Strong match (88/100). Title matches exactly.',
      whyIncluded: ['Role match', 'Industry acceptable', 'Location preferred'],
      considerations: ['Salary unknown'],
      breakdown: {
        role: '25/25 points',
        industry: '8/20 points',
        location: '5/15 points',
        salary: '0/15 points',
        skills: '0/10 points'
      }
    }
    vi.mocked(generateReasoning).mockReturnValue(fullReasoning)

    const originalEnv = process.env.JOB_VALIDATOR_URL
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        job: { title: 'CD', company: 'Co' }
      })
    })

    const result = await researchJobUrl({ url: 'https://co.com/cd' })

    // Verify all reasoning fields are present
    expect(result.reasoning.score).toBe(88)
    expect(result.reasoning.summary).toBe('Strong match (88/100). Title matches exactly.')
    expect(result.reasoning.whyIncluded).toEqual(['Role match', 'Industry acceptable', 'Location preferred'])
    expect(result.reasoning.considerations).toEqual(['Salary unknown'])
    expect(result.reasoning.breakdown).toEqual(fullReasoning.breakdown)

    // Cleanup
    global.fetch = originalFetch
    process.env.JOB_VALIDATOR_URL = originalEnv
  })
})

// ============================================================================
// getExistingJobs TESTS
// ============================================================================

describe('getExistingJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns summary of all existing jobs', () => {
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        { id: 1, title: 'Job A', company: 'Company A', status: 'inbox', url: 'https://a.com/job' },
        { id: 2, title: 'Job B', company: 'Company B', status: 'apply-now', url: 'https://b.com/job' },
        { id: 3, title: 'Job C', company: 'Company C', status: 'applied', url: 'https://c.com/job' }
      ]
    })

    const result = getExistingJobs()

    expect(result.total).toBe(3)
    expect(result.companies).toContain('Company A')
    expect(result.companies).toContain('Company B')
    expect(result.urls).toContain('https://a.com/job')
    expect(result.jobs).toHaveLength(3)
  })

  it('returns counts grouped by status', () => {
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        { id: 1, status: 'inbox' },
        { id: 2, status: 'inbox' },
        { id: 3, status: 'apply-now' },
        { id: 4, status: 'applied' }
      ]
    })

    const result = getExistingJobs()

    expect(result.byStatus.inbox).toBe(2)
    expect(result.byStatus['apply-now']).toBe(1)
    expect(result.byStatus.applied).toBe(1)
  })

  it('handles empty jobs list', () => {
    vi.mocked(loadJobsFromDashboard).mockReturnValue({ jobs: [] })

    const result = getExistingJobs()

    expect(result.total).toBe(0)
    expect(result.companies).toHaveLength(0)
    expect(result.urls).toHaveLength(0)
    expect(result.jobs).toHaveLength(0)
  })

  it('filters out null/undefined companies and URLs', () => {
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        { id: 1, company: 'Valid Co', url: 'https://valid.com' },
        { id: 2, company: null, url: null },
        { id: 3, company: undefined, url: undefined }
      ]
    })

    const result = getExistingJobs()

    expect(result.companies).toHaveLength(1)
    expect(result.companies).toContain('Valid Co')
    expect(result.urls).toHaveLength(1)
    expect(result.urls).toContain('https://valid.com')
  })

  it('deduplicates company names', () => {
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        { id: 1, title: 'Role A', company: 'Same Corp', url: 'https://a.com' },
        { id: 2, title: 'Role B', company: 'Same Corp', url: 'https://b.com' }
      ]
    })

    const result = getExistingJobs()

    expect(result.companies).toHaveLength(1)
    expect(result.companies).toContain('Same Corp')
  })

  it('includes helpful message for Claude', () => {
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [{ id: 1, company: 'Test' }]
    })

    const result = getExistingJobs()

    expect(result.message).toContain('1 jobs tracked')
    expect(result.message).toContain('Skip')
  })
})

// ============================================================================
// addJobManual TESTS
// ============================================================================

describe('addJobManual', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadJobsFromDashboard).mockReturnValue({ jobs: [], searchHistory: [] })
    vi.mocked(writeJobsData).mockImplementation(() => {})
    vi.mocked(calculateFitScore).mockReturnValue({
      score: 75,
      breakdown: { base: 50, role: 15, industry: 10, location: 0, salary: 0, skills: 0 }
    })
    vi.mocked(generateReasoning).mockReturnValue({
      score: 75,
      summary: 'Good match',
      whyIncluded: ['Role matches'],
      considerations: []
    })
  })

  it('returns error for missing title', () => {
    const result = addJobManual({
      company: 'Test Co',
      url: 'https://test.com/job'
    })

    expect(result.status).toBe('error')
    expect(result.error).toContain('title')
  })

  it('returns error for empty title', () => {
    const result = addJobManual({
      title: '   ',
      company: 'Test Co',
      url: 'https://test.com/job'
    })

    expect(result.status).toBe('error')
    expect(result.error).toContain('title')
  })

  it('returns error for missing company', () => {
    const result = addJobManual({
      title: 'Developer',
      url: 'https://test.com/job'
    })

    expect(result.status).toBe('error')
    expect(result.error).toContain('company')
  })

  it('returns error for invalid URL', () => {
    const result = addJobManual({
      title: 'Developer',
      company: 'Test Co',
      url: 'not-a-url'
    })

    expect(result.status).toBe('error')
    expect(result.error).toContain('url')
  })

  it('returns error for missing URL', () => {
    const result = addJobManual({
      title: 'Developer',
      company: 'Test Co',
      url: ''
    })

    expect(result.status).toBe('error')
    expect(result.error).toContain('url')
  })

  it('detects duplicate by URL', () => {
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        { id: 1, title: 'Existing', company: 'Old Co', status: 'apply-now', url: 'https://test.com/job', fitScore: 80 }
      ]
    })

    const result = addJobManual({
      title: 'New Job',
      company: 'New Co',
      url: 'https://test.com/job'
    })

    expect(result.status).toBe('duplicate')
    expect(result.existingJob.id).toBe(1)
    expect(result.existingJob.status).toBe('apply-now')
  })

  it('adds job to inbox successfully', () => {
    const result = addJobManual({
      title: 'Creative Director',
      company: 'Acme Corp',
      url: 'https://acme.com/jobs/cd',
      location: 'Boston',
      salary: '$150,000'
    })

    expect(result.status).toBe('added_to_inbox')
    expect(result.job.title).toBe('Creative Director')
    expect(result.job.company).toBe('Acme Corp')
    expect(result.job.fitScore).toBe(75)
    expect(writeJobsData).toHaveBeenCalled()
  })

  it('includes reasoning in response', () => {
    const result = addJobManual({
      title: 'Designer',
      company: 'Test Co',
      url: 'https://test.com/job'
    })

    expect(result.reasoning).toBeDefined()
    expect(result.reasoning.score).toBe(75)
    expect(result.reasoning.summary).toBe('Good match')
    expect(result.reasoning.whyIncluded).toContain('Role matches')
  })

  it('detects source board from greenhouse URL', () => {
    let savedData
    vi.mocked(writeJobsData).mockImplementation((data) => {
      savedData = data
    })

    addJobManual({
      title: 'Engineer',
      company: 'Tech Co',
      url: 'https://boards.greenhouse.io/techco/jobs/123'
    })

    const savedJob = savedData.jobs[0]
    expect(savedJob.sourceBoard).toBe('greenhouse')
    expect(savedJob.isDirectToCompany).toBe(true)
  })

  it('detects source board from linkedin URL', () => {
    let savedData
    vi.mocked(writeJobsData).mockImplementation((data) => {
      savedData = data
    })

    addJobManual({
      title: 'Designer',
      company: 'Big Corp',
      url: 'https://www.linkedin.com/jobs/view/12345'
    })

    const savedJob = savedData.jobs[0]
    expect(savedJob.sourceBoard).toBe('linkedin')
    expect(savedJob.isDirectToCompany).toBe(false)
  })

  it('uses provided sourceBoard when specified', () => {
    let savedData
    vi.mocked(writeJobsData).mockImplementation((data) => {
      savedData = data
    })

    addJobManual({
      title: 'Manager',
      company: 'Custom Co',
      url: 'https://custom.com/job',
      sourceBoard: 'custom-board'
    })

    const savedJob = savedData.jobs[0]
    expect(savedJob.sourceBoard).toBe('custom-board')
  })

  it('sets extractionQuality based on data completeness', () => {
    let savedData
    vi.mocked(writeJobsData).mockImplementation((data) => {
      savedData = data
    })

    // Complete data
    addJobManual({
      title: 'Full Job',
      company: 'Complete Co',
      url: 'https://complete.com/job',
      location: 'Boston'
    })

    expect(savedData.jobs[0].extractionQuality).toBe('complete')
  })

  it('sets partial extractionQuality when missing location', () => {
    let savedData
    vi.mocked(writeJobsData).mockImplementation((data) => {
      savedData = data
    })

    // Partial data (no location)
    addJobManual({
      title: 'Partial Job',
      company: 'Partial Co',
      url: 'https://partial.com/job'
    })

    expect(savedData.jobs[0].extractionQuality).toBe('partial')
  })

  it('uses provided extractionQuality when specified', () => {
    let savedData
    vi.mocked(writeJobsData).mockImplementation((data) => {
      savedData = data
    })

    addJobManual({
      title: 'Manual',
      company: 'Manual Co',
      url: 'https://manual.com/job',
      extractionQuality: 'failed'
    })

    expect(savedData.jobs[0].extractionQuality).toBe('failed')
  })

  it('generates next job ID correctly', () => {
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [
        { id: 1 },
        { id: 5 },
        { id: 3 }
      ]
    })

    let savedData
    vi.mocked(writeJobsData).mockImplementation((data) => {
      savedData = data
    })

    addJobManual({
      title: 'New Job',
      company: 'New Co',
      url: 'https://new.com/job'
    })

    expect(savedData.jobs[3].id).toBe(6) // max(1,5,3) + 1
  })

  it('trims whitespace from title and company', () => {
    let savedData
    vi.mocked(writeJobsData).mockImplementation((data) => {
      savedData = data
    })

    addJobManual({
      title: '  Trimmed Title  ',
      company: '  Trimmed Company  ',
      url: 'https://trim.com/job'
    })

    expect(savedData.jobs[0].title).toBe('Trimmed Title')
    expect(savedData.jobs[0].company).toBe('Trimmed Company')
  })

  it('detects lever as direct company URL', () => {
    let savedData
    vi.mocked(writeJobsData).mockImplementation((data) => {
      savedData = data
    })

    addJobManual({
      title: 'Role',
      company: 'Lever Co',
      url: 'https://jobs.lever.co/company/12345'
    })

    expect(savedData.jobs[0].sourceBoard).toBe('lever')
    expect(savedData.jobs[0].isDirectToCompany).toBe(true)
  })

  it('detects workday as direct company URL', () => {
    let savedData
    vi.mocked(writeJobsData).mockImplementation((data) => {
      savedData = data
    })

    addJobManual({
      title: 'Role',
      company: 'Corp',
      url: 'https://corp.wd5.myworkdayjobs.com/careers'
    })

    expect(savedData.jobs[0].sourceBoard).toBe('workday')
    expect(savedData.jobs[0].isDirectToCompany).toBe(true)
  })

  it('detects indeed as non-direct URL', () => {
    let savedData
    vi.mocked(writeJobsData).mockImplementation((data) => {
      savedData = data
    })

    addJobManual({
      title: 'Role',
      company: 'Corp',
      url: 'https://www.indeed.com/viewjob?jk=abc123'
    })

    expect(savedData.jobs[0].sourceBoard).toBe('indeed')
    expect(savedData.jobs[0].isDirectToCompany).toBe(false)
  })

  it('includes next step guidance', () => {
    const result = addJobManual({
      title: 'Job',
      company: 'Co',
      url: 'https://co.com/job'
    })

    expect(result.nextStep).toContain('inbox')
    expect(result.message).toContain('inbox')
  })
})
