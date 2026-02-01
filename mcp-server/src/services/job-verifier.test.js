/**
 * Job Verifier Service Tests
 *
 * Tests job status verification and fit score refresh.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock loader.js
vi.mock('../data/loader.js', () => ({
  loadJobsFromDashboard: vi.fn(),
  writeJobsData: vi.fn()
}))

// Mock fit-scorer.js
vi.mock('./fit-scorer.js', () => ({
  calculateFitScore: vi.fn()
}))

import { loadJobsFromDashboard, writeJobsData } from '../data/loader.js'
import { calculateFitScore } from './fit-scorer.js'
import { verifyJobStatus, verifyActiveJobs } from './job-verifier.js'

// Store original env
const originalEnv = { ...process.env }

/**
 * Create mock job for testing
 */
function createMockJob(overrides = {}) {
  return {
    id: 1,
    title: 'Software Engineer',
    company: 'Test Corp',
    location: 'Boston',
    salary: '$120,000',
    url: 'https://jobs.example.com/123',
    status: 'interested',
    fitScore: 75,
    ...overrides
  }
}

describe('verifyJobStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  it('returns uncertain when Worker URL not configured', async () => {
    delete process.env.JOB_VALIDATOR_URL

    const result = await verifyJobStatus('https://example.com/job')

    expect(result.status).toBe('uncertain')
    expect(result.reason).toBe('Worker not configured')
    expect(result.error).toContain('JOB_VALIDATOR_URL')
  })

  it('calls Worker /status endpoint with correct payload', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [{ status: 'active' }] })
    })

    await verifyJobStatus('https://jobs.example.com/123')

    expect(global.fetch).toHaveBeenCalledWith(
      'https://worker.example.com/status',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: ['https://jobs.example.com/123'] })
      })
    )
  })

  it('returns active status from Worker', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{ status: 'active', reason: 'Job posting found' }]
      })
    })

    const result = await verifyJobStatus('https://example.com/job')

    expect(result.status).toBe('active')
    expect(result.reason).toBe('Job posting found')
  })

  it('returns closed status from Worker', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{ status: 'closed', reason: 'Position filled' }]
      })
    })

    const result = await verifyJobStatus('https://example.com/job')

    expect(result.status).toBe('closed')
    expect(result.reason).toBe('Position filled')
  })

  it('handles HTTP errors gracefully', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })

    const result = await verifyJobStatus('https://example.com/job')

    expect(result.status).toBe('uncertain')
    expect(result.reason).toBe('Worker returned error')
    expect(result.error).toContain('500')
  })

  it('handles network errors gracefully', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    global.fetch.mockRejectedValue(new Error('Network error'))

    const result = await verifyJobStatus('https://example.com/job')

    expect(result.status).toBe('uncertain')
    expect(result.reason).toBe('Network error')
    expect(result.error).toBe('Network error')
  })

  it('handles timeout errors', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'
    global.fetch.mockRejectedValue(abortError)

    const result = await verifyJobStatus('https://example.com/job')

    expect(result.status).toBe('uncertain')
    expect(result.reason).toBe('Request timeout')
  })

  it('returns uncertain when no result from Worker', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] })
    })

    const result = await verifyJobStatus('https://example.com/job')

    expect(result.status).toBe('uncertain')
    expect(result.reason).toBe('No result from Worker')
  })

  it('includes data from Worker response', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{
          status: 'active',
          data: { title: 'Updated Title', salary: '$140,000' }
        }]
      })
    })

    const result = await verifyJobStatus('https://example.com/job')

    expect(result.data).toEqual({ title: 'Updated Title', salary: '$140,000' })
  })
})

describe('verifyActiveJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  it('returns error when Worker not configured', async () => {
    delete process.env.JOB_VALIDATOR_URL

    const result = await verifyActiveJobs()

    expect(result.error).toContain('Worker not configured')
    expect(result.checked).toBe(0)
  })

  it('filters to active jobs only', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    loadJobsFromDashboard.mockReturnValue({
      jobs: [
        createMockJob({ id: 1, status: 'interested', url: 'https://a.com' }),
        createMockJob({ id: 2, status: 'archived', url: 'https://b.com' }),
        createMockJob({ id: 3, status: 'rejected', url: 'https://c.com' }),
        createMockJob({ id: 4, status: 'applied', url: null }),
        createMockJob({ id: 5, status: 'applied', url: 'https://d.com' })
      ]
    })

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] })
    })

    const result = await verifyActiveJobs()

    // Should only check jobs 1 and 5 (not archived/rejected, has URL)
    expect(result.checked).toBe(2)
  })

  it('returns message when no active jobs with URLs', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    loadJobsFromDashboard.mockReturnValue({
      jobs: [
        createMockJob({ id: 1, status: 'archived', url: 'https://a.com' }),
        createMockJob({ id: 2, status: 'interested', url: null })
      ]
    })

    const result = await verifyActiveJobs()

    expect(result.checked).toBe(0)
    expect(result.message).toContain('No active jobs')
  })

  it('categorizes job statuses correctly', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    loadJobsFromDashboard.mockReturnValue({
      jobs: [
        createMockJob({ id: 1, url: 'https://a.com' }),
        createMockJob({ id: 2, url: 'https://b.com' }),
        createMockJob({ id: 3, url: 'https://c.com' })
      ]
    })

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { url: 'https://a.com', status: 'active' },
          { url: 'https://b.com', status: 'closed', reason: 'Position filled' },
          { url: 'https://c.com', status: 'uncertain' }
        ]
      })
    })

    const result = await verifyActiveJobs()

    expect(result.active).toBe(1)
    expect(result.closed).toBe(1)
    expect(result.uncertain).toBe(1)
  })

  it('tracks closed jobs with details', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    loadJobsFromDashboard.mockReturnValue({
      jobs: [
        createMockJob({
          id: 1,
          title: 'Senior Engineer',
          company: 'TechCo',
          url: 'https://a.com'
        })
      ]
    })

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { url: 'https://a.com', status: 'closed', reason: 'Position filled' }
        ]
      })
    })

    const result = await verifyActiveJobs()

    expect(result.closedJobs).toHaveLength(1)
    expect(result.closedJobs[0]).toMatchObject({
      id: 1,
      title: 'Senior Engineer',
      company: 'TechCo',
      reason: 'Position filled'
    })
  })

  it('refreshes fit score when job data changes', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    loadJobsFromDashboard.mockReturnValue({
      jobs: [
        createMockJob({
          id: 1,
          title: 'Engineer',
          salary: '$100,000',
          fitScore: 70,
          url: 'https://a.com'
        })
      ]
    })

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{
          url: 'https://a.com',
          status: 'active',
          data: { title: 'Senior Engineer', salary: '$150,000' }
        }]
      })
    })

    calculateFitScore.mockReturnValue({ score: 90, breakdown: {} })

    const result = await verifyActiveJobs()

    expect(calculateFitScore).toHaveBeenCalled()
    expect(result.updated).toBe(1)
    expect(result.updatedJobs[0]).toMatchObject({
      id: 1,
      oldFitScore: 70,
      newFitScore: 90
    })
  })

  it('saves updated jobs', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    loadJobsFromDashboard.mockReturnValue({
      jobs: [
        createMockJob({ id: 1, url: 'https://a.com' })
      ]
    })

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{
          url: 'https://a.com',
          status: 'closed'
        }]
      })
    })

    await verifyActiveJobs()

    expect(writeJobsData).toHaveBeenCalled()
  })

  it('does not save when no changes', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    loadJobsFromDashboard.mockReturnValue({
      jobs: [
        createMockJob({ id: 1, url: 'https://a.com' })
      ]
    })

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{ url: 'https://a.com', status: 'active' }]
      })
    })

    await verifyActiveJobs()

    expect(writeJobsData).not.toHaveBeenCalled()
  })

  it('handles Worker batch failure gracefully', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    loadJobsFromDashboard.mockReturnValue({
      jobs: [
        createMockJob({ id: 1, url: 'https://a.com' }),
        createMockJob({ id: 2, url: 'https://b.com' })
      ]
    })

    global.fetch.mockRejectedValue(new Error('Network failure'))

    const result = await verifyActiveJobs()

    // All jobs should be marked uncertain
    expect(result.uncertain).toBe(2)
    expect(result.closed).toBe(0)
    expect(result.active).toBe(0)
  })

  it('handles empty jobs array', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    loadJobsFromDashboard.mockReturnValue({ jobs: [] })

    const result = await verifyActiveJobs()

    expect(result.checked).toBe(0)
    expect(result.message).toContain('No active jobs')
  })

  it('handles missing jobs property', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    loadJobsFromDashboard.mockReturnValue({})

    const result = await verifyActiveJobs()

    expect(result.checked).toBe(0)
  })

  it('marks closed job with timestamp and reason', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    const jobs = [createMockJob({ id: 1, url: 'https://a.com' })]
    loadJobsFromDashboard.mockReturnValue({ jobs })

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{
          url: 'https://a.com',
          status: 'closed',
          reason: 'Position filled'
        }]
      })
    })

    await verifyActiveJobs()

    expect(writeJobsData).toHaveBeenCalled()
    const savedData = writeJobsData.mock.calls[0][0]
    expect(savedData.jobs[0].status).toBe('closed')
    expect(savedData.jobs[0].closedAt).toBeDefined()
    expect(savedData.jobs[0].closedReason).toBe('Position filled')
  })

  it('updates multiple job fields when data changes', async () => {
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    const jobs = [createMockJob({
      id: 1,
      title: 'Old Title',
      salary: '$100K',
      company: 'Old Corp',
      location: 'NYC',
      description: 'Old desc',
      url: 'https://a.com'
    })]
    loadJobsFromDashboard.mockReturnValue({ jobs })

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{
          url: 'https://a.com',
          status: 'active',
          data: {
            title: 'New Title',
            salary: '$150K',
            company: 'New Corp',
            location: 'Boston',
            description: 'New desc'
          }
        }]
      })
    })

    calculateFitScore.mockReturnValue({ score: 85, breakdown: {} })

    await verifyActiveJobs()

    const savedData = writeJobsData.mock.calls[0][0]
    expect(savedData.jobs[0].title).toBe('New Title')
    expect(savedData.jobs[0].salary).toBe('$150K')
    expect(savedData.jobs[0].company).toBe('New Corp')
    expect(savedData.jobs[0].location).toBe('Boston')
    expect(savedData.jobs[0].description).toBe('New desc')
    expect(savedData.jobs[0].verifiedAt).toBeDefined()
  })
})
