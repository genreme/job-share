/**
 * Friend Submission Tools Tests
 *
 * Tests MCP tools for friend-submitted jobs via Supabase.
 * Uses mocking to isolate tests from Supabase and file system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock supabase-client module
vi.mock('../../src/services/supabase-client.js', () => ({
  getSupabaseClient: vi.fn(),
  isSupabaseConfigured: vi.fn()
}))

// Mock loader module
vi.mock('../../src/data/loader.js', () => ({
  loadJobsFromDashboard: vi.fn(),
  writeJobsData: vi.fn()
}))

// Mock fit-scorer and reasoning-generator (used by researchJobUrl)
vi.mock('../../src/services/fit-scorer.js', () => ({
  calculateFitScore: vi.fn()
}))

vi.mock('../../src/services/reasoning-generator.js', () => ({
  generateReasoning: vi.fn()
}))

// Import tools under test
import {
  getFriendSubmissions,
  processFriendSubmission,
  acceptFriendSubmission
} from '../../src/tools/discovery.js'

// Import mocked modules
import { getSupabaseClient, isSupabaseConfigured } from '../../src/services/supabase-client.js'
import { loadJobsFromDashboard, writeJobsData } from '../../src/data/loader.js'
import { calculateFitScore } from '../../src/services/fit-scorer.js'
import { generateReasoning } from '../../src/services/reasoning-generator.js'

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockSupabaseClient() {
  const mockFrom = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis()
  }

  return {
    from: vi.fn(() => mockFrom),
    _mockFrom: mockFrom
  }
}

function createSampleSubmission(overrides = {}) {
  return {
    id: 'sub-123',
    job_url: 'https://acme.com/jobs/creative-director',
    job_title: 'Creative Director',
    company_name: 'Acme Corp',
    submitted_by: 'Sarah Chen',
    connection_notes: 'Former colleague from IDEO',
    benefits_notes: 'Great culture fit, creative freedom',
    reasoning: 'This role aligns perfectly with your experience leading creative teams',
    status: 'pending',
    created_at: '2026-01-28T10:00:00Z',
    ...overrides
  }
}

function createTestJobsData(overrides = {}) {
  return {
    jobs: overrides.jobs || [
      {
        id: 1,
        title: 'Existing Job',
        company: 'Old Corp',
        status: 'apply-now',
        url: 'https://oldcorp.com/job'
      }
    ],
    searchHistory: [],
    settings: {}
  }
}

// =============================================================================
// getFriendSubmissions Tests
// =============================================================================

describe('getFriendSubmissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns helpful error when Supabase not configured', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)

    const result = await getFriendSubmissions()

    expect(result.status).toBe('not_configured')
    expect(result.error).toContain('Supabase not configured')
    expect(result.error).toContain('SUPABASE_URL')
    expect(result.error).toContain('SUPABASE_SERVICE_KEY')
    expect(result.submissions).toEqual([])
    expect(result.count).toBe(0)
  })

  it('returns error when Supabase client initialization fails', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(getSupabaseClient).mockReturnValue(null)

    const result = await getFriendSubmissions()

    expect(result.status).toBe('error')
    expect(result.error).toContain('Failed to initialize')
    expect(result.submissions).toEqual([])
  })

  it('returns submissions with friendContext mapped correctly', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)

    const mockClient = createMockSupabaseClient()
    mockClient._mockFrom.order.mockResolvedValue({
      data: [
        createSampleSubmission(),
        createSampleSubmission({
          id: 'sub-456',
          job_url: 'https://startup.com/lead',
          submitted_by: 'Mike Johnson',
          connection_notes: 'Met at a conference',
          benefits_notes: 'Startup equity',
          reasoning: 'Early stage opportunity'
        })
      ],
      error: null
    })
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient)

    const result = await getFriendSubmissions()

    expect(result.status).toBe('success')
    expect(result.count).toBe(2)
    expect(result.submissions).toHaveLength(2)

    // Verify first submission mapping
    const first = result.submissions[0]
    expect(first.id).toBe('sub-123')
    expect(first.url).toBe('https://acme.com/jobs/creative-director')
    expect(first.friendContext).toBeDefined()
    expect(first.friendContext.submittedBy).toBe('Sarah Chen')
    expect(first.friendContext.connection).toBe('Former colleague from IDEO')
    expect(first.friendContext.benefits).toBe('Great culture fit, creative freedom')
    expect(first.friendContext.reasoning).toContain('aligns perfectly')

    // Verify message
    expect(result.message).toContain('2 friend submission(s)')
  })

  it('handles empty results', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)

    const mockClient = createMockSupabaseClient()
    mockClient._mockFrom.order.mockResolvedValue({
      data: [],
      error: null
    })
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient)

    const result = await getFriendSubmissions()

    expect(result.status).toBe('success')
    expect(result.count).toBe(0)
    expect(result.submissions).toEqual([])
    expect(result.message).toBe('No pending friend submissions')
  })

  it('handles Supabase query errors', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)

    const mockClient = createMockSupabaseClient()
    mockClient._mockFrom.order.mockResolvedValue({
      data: null,
      error: { message: 'Connection timeout' }
    })
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient)

    const result = await getFriendSubmissions()

    expect(result.status).toBe('error')
    expect(result.error).toContain('Supabase query failed')
    expect(result.error).toContain('Connection timeout')
    expect(result.submissions).toEqual([])
  })

  it('handles unexpected exceptions', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(getSupabaseClient).mockImplementation(() => {
      throw new Error('Unexpected crash')
    })

    const result = await getFriendSubmissions()

    expect(result.status).toBe('error')
    expect(result.error).toContain('Unexpected error')
    expect(result.error).toContain('Unexpected crash')
  })

  it('queries for pending status only', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)

    const mockClient = createMockSupabaseClient()
    mockClient._mockFrom.order.mockResolvedValue({ data: [], error: null })
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient)

    await getFriendSubmissions()

    // Verify query chain
    expect(mockClient.from).toHaveBeenCalledWith('job_submissions')
    expect(mockClient._mockFrom.eq).toHaveBeenCalledWith('status', 'pending')
    expect(mockClient._mockFrom.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})

// =============================================================================
// processFriendSubmission Tests
// =============================================================================

describe('processFriendSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadJobsFromDashboard).mockReturnValue(createTestJobsData())
    vi.mocked(calculateFitScore).mockReturnValue({
      score: 85,
      breakdown: { base: 50, role: 25, industry: 10 },
      usingDefaults: false
    })
    vi.mocked(generateReasoning).mockReturnValue({
      score: 85,
      summary: 'Strong match',
      whyIncluded: ['Role match'],
      considerations: [],
      breakdown: {}
    })
  })

  it('returns error for missing submissionId', async () => {
    const result = await processFriendSubmission({})

    expect(result.status).toBe('error')
    expect(result.error).toBe('submissionId is required')
  })

  it('returns error for empty submissionId', async () => {
    const result = await processFriendSubmission({ submissionId: '' })

    expect(result.status).toBe('error')
    expect(result.error).toBe('submissionId is required')
  })

  it('returns error when Supabase not configured', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)

    const result = await processFriendSubmission({ submissionId: 'sub-123' })

    expect(result.status).toBe('not_configured')
    expect(result.error).toContain('Supabase not configured')
  })

  it('returns error when submission not found', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)

    const mockClient = createMockSupabaseClient()
    mockClient._mockFrom.single.mockResolvedValue({
      data: null,
      error: { message: 'Row not found' }
    })
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient)

    const result = await processFriendSubmission({ submissionId: 'sub-nonexistent' })

    expect(result.status).toBe('error')
    expect(result.error).toContain('Submission not found')
  })

  it('calls researchJobUrl with submission URL', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)

    const mockClient = createMockSupabaseClient()
    mockClient._mockFrom.single.mockResolvedValue({
      data: createSampleSubmission(),
      error: null
    })
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient)

    // Mock global fetch (used by researchJobUrl)
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        job: { title: 'Creative Director', company: 'Acme Corp' }
      })
    })
    const originalEnv = process.env.JOB_VALIDATOR_URL
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    const result = await processFriendSubmission({ submissionId: 'sub-123' })

    // Verify fetch was called with the Worker URL containing encoded job URL
    expect(global.fetch).toHaveBeenCalled()
    const fetchUrl = global.fetch.mock.calls[0][0]
    expect(fetchUrl).toContain('worker.example.com')
    // URL is encoded when passed to Worker
    expect(fetchUrl).toContain(encodeURIComponent('https://acme.com/jobs/creative-director'))

    // Cleanup
    global.fetch = originalFetch
    process.env.JOB_VALIDATOR_URL = originalEnv
  })

  it('combines research result with friendContext', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)

    const mockClient = createMockSupabaseClient()
    mockClient._mockFrom.single.mockResolvedValue({
      data: createSampleSubmission(),
      error: null
    })
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient)

    // Mock Worker response
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        job: { title: 'Creative Director', company: 'Acme Corp', location: 'Boston' }
      })
    })
    const originalEnv = process.env.JOB_VALIDATOR_URL
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    const result = await processFriendSubmission({ submissionId: 'sub-123' })

    expect(result.submissionId).toBe('sub-123')
    expect(result.friendContext).toBeDefined()
    expect(result.friendContext.submittedBy).toBe('Sarah Chen')
    expect(result.friendContext.connection).toBe('Former colleague from IDEO')
    expect(result.friendContext.benefits).toBe('Great culture fit, creative freedom')
    expect(result.friendContext.reasoning).toContain('aligns perfectly')

    expect(result.research).toBeDefined()
    expect(result.research.status).toBe('ready_for_review')
    expect(result.nextStep).toContain('accept_friend_submission')

    // Cleanup
    global.fetch = originalFetch
    process.env.JOB_VALIDATOR_URL = originalEnv
  })

  it('handles duplicate detection correctly', async () => {
    // Set up job store with matching URL
    vi.mocked(loadJobsFromDashboard).mockReturnValue({
      jobs: [{
        id: 1,
        title: 'Creative Director',
        company: 'Acme Corp',
        status: 'apply-now',
        url: 'https://acme.com/jobs/creative-director'
      }],
      searchHistory: [],
      settings: {}
    })

    vi.mocked(isSupabaseConfigured).mockReturnValue(true)

    const mockClient = createMockSupabaseClient()
    mockClient._mockFrom.single.mockResolvedValue({
      data: createSampleSubmission(),
      error: null
    })
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient)

    const result = await processFriendSubmission({ submissionId: 'sub-123' })

    expect(result.status).toBe('duplicate')
    expect(result.friendContext).toBeDefined() // Friend context still included
    expect(result.nextStep).toContain('already exists')
  })
})

// =============================================================================
// acceptFriendSubmission Tests
// =============================================================================

describe('acceptFriendSubmission', () => {
  let jobStore = null

  beforeEach(() => {
    vi.clearAllMocks()

    jobStore = createTestJobsData()

    vi.mocked(loadJobsFromDashboard).mockImplementation(() => {
      return JSON.parse(JSON.stringify(jobStore))
    })

    vi.mocked(writeJobsData).mockImplementation((data) => {
      jobStore = JSON.parse(JSON.stringify(data))
    })
  })

  it('returns error for missing submissionId', async () => {
    const result = await acceptFriendSubmission({ status: 'apply-now' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('submissionId is required')
  })

  it('returns error for missing status', async () => {
    const result = await acceptFriendSubmission({ submissionId: 'sub-123' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid status')
  })

  it('rejects invalid status values', async () => {
    const invalidStatuses = ['applied', 'active', 'rejected', 'pending', 'inbox']

    for (const status of invalidStatuses) {
      const result = await acceptFriendSubmission({ submissionId: 'sub-123', status })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid status')
    }
  })

  it('accepts valid status values', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)

    const validStatuses = ['apply-now', 'maybe', 'probably-not']

    for (const status of validStatuses) {
      // Reset for each iteration
      jobStore = createTestJobsData()

      const mockClient = createMockSupabaseClient()
      mockClient._mockFrom.single.mockResolvedValue({
        data: createSampleSubmission({ id: `sub-${status}` }),
        error: null
      })
      mockClient._mockFrom.eq.mockReturnValue({
        ...mockClient._mockFrom,
        update: vi.fn().mockReturnThis()
      })
      // Mock the final update call
      const updateMock = vi.fn().mockResolvedValue({ error: null })
      mockClient._mockFrom.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })
      vi.mocked(getSupabaseClient).mockReturnValue(mockClient)

      const result = await acceptFriendSubmission({
        submissionId: `sub-${status}`,
        status
      })

      expect(result.success).toBe(true)
      expect(result.job.status).toBe(status)
    }
  })

  it('returns error when Supabase not configured', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)

    const result = await acceptFriendSubmission({
      submissionId: 'sub-123',
      status: 'apply-now'
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Supabase not configured')
  })

  it('detects duplicate URLs', async () => {
    // Set up job store with matching URL
    jobStore = {
      jobs: [{
        id: 1,
        title: 'Creative Director',
        company: 'Acme Corp',
        status: 'apply-now',
        url: 'https://acme.com/jobs/creative-director'
      }],
      searchHistory: [],
      settings: {}
    }

    vi.mocked(isSupabaseConfigured).mockReturnValue(true)

    const mockClient = createMockSupabaseClient()
    mockClient._mockFrom.single.mockResolvedValue({
      data: createSampleSubmission(),
      error: null
    })
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient)

    const result = await acceptFriendSubmission({
      submissionId: 'sub-123',
      status: 'apply-now'
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('duplicate')
    expect(result.existingJob).toBeDefined()
    expect(result.existingJob.id).toBe(1)
    expect(result.message).toContain('already exists')
  })

  it('creates job with correct structure including friendContext', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)

    const mockClient = createMockSupabaseClient()
    mockClient._mockFrom.single.mockResolvedValue({
      data: createSampleSubmission(),
      error: null
    })
    mockClient._mockFrom.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    })
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient)

    const result = await acceptFriendSubmission({
      submissionId: 'sub-123',
      status: 'apply-now',
      notes: 'Looks promising!'
    })

    expect(result.success).toBe(true)
    expect(result.job).toBeDefined()
    expect(result.job.id).toBeDefined()
    expect(result.job.title).toBe('Creative Director')
    expect(result.job.company).toBe('Acme Corp')
    expect(result.job.status).toBe('apply-now')

    // Verify friendContext is in response
    expect(result.friendContext).toBeDefined()
    expect(result.friendContext.submittedBy).toBe('Sarah Chen')
    expect(result.friendContext.connection).toBe('Former colleague from IDEO')
    expect(result.friendContext.benefits).toBe('Great culture fit, creative freedom')

    // Verify job was written with correct structure
    expect(writeJobsData).toHaveBeenCalled()
    const savedJob = jobStore.jobs.find(j => j.id === result.job.id)
    expect(savedJob).toBeDefined()
    expect(savedJob.source).toBe('friend-submission')
    expect(savedJob.friendContext).toBeDefined()
    expect(savedJob.friendContext.submittedBy).toBe('Sarah Chen')
    expect(savedJob.notes).toContain('Friend submission from Sarah Chen')
    expect(savedJob.notes).toContain('aligns perfectly')
    expect(savedJob.notes).toContain('Looks promising!')

    // Verify updates array has initial entry
    expect(savedJob.updates).toBeDefined()
    expect(savedJob.updates.length).toBeGreaterThan(0)
    expect(savedJob.updates[0].type).toBe('Friend Submission')
    expect(savedJob.updates[0].notes).toContain('Sarah Chen')
  })

  it('calls writeJobsData with updated data', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)

    const mockClient = createMockSupabaseClient()
    mockClient._mockFrom.single.mockResolvedValue({
      data: createSampleSubmission(),
      error: null
    })
    mockClient._mockFrom.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    })
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient)

    await acceptFriendSubmission({
      submissionId: 'sub-123',
      status: 'maybe'
    })

    expect(writeJobsData).toHaveBeenCalledTimes(1)
    const savedData = writeJobsData.mock.calls[0][0]
    expect(savedData.jobs.length).toBe(2) // Original job + new job
  })

  it('updates Supabase status to accepted', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)

    const mockClient = createMockSupabaseClient()
    mockClient._mockFrom.single.mockResolvedValue({
      data: createSampleSubmission(),
      error: null
    })

    const updateEqMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock })
    mockClient._mockFrom.update = updateMock

    vi.mocked(getSupabaseClient).mockReturnValue(mockClient)

    await acceptFriendSubmission({
      submissionId: 'sub-123',
      status: 'apply-now'
    })

    // Verify update was called with correct status
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'accepted'
      })
    )
    expect(updateEqMock).toHaveBeenCalledWith('id', 'sub-123')
  })

  it('continues even if Supabase status update fails', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)

    const mockClient = createMockSupabaseClient()
    mockClient._mockFrom.single.mockResolvedValue({
      data: createSampleSubmission(),
      error: null
    })
    mockClient._mockFrom.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'Update failed' } })
    })
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient)

    // Spy on console.warn
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await acceptFriendSubmission({
      submissionId: 'sub-123',
      status: 'apply-now'
    })

    // Job should still be added successfully
    expect(result.success).toBe(true)
    expect(result.job).toBeDefined()

    // Warning should be logged
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Supabase status update failed')
    )

    warnSpy.mockRestore()
  })

  it('handles submission not found error', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)

    const mockClient = createMockSupabaseClient()
    mockClient._mockFrom.single.mockResolvedValue({
      data: null,
      error: { message: 'No rows returned' }
    })
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient)

    const result = await acceptFriendSubmission({
      submissionId: 'sub-nonexistent',
      status: 'apply-now'
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Submission not found')
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('integration: friend submission flow', () => {
  let jobStore = null

  beforeEach(() => {
    vi.clearAllMocks()

    jobStore = { jobs: [], searchHistory: [], settings: {} }

    vi.mocked(loadJobsFromDashboard).mockImplementation(() => {
      return JSON.parse(JSON.stringify(jobStore))
    })

    vi.mocked(writeJobsData).mockImplementation((data) => {
      jobStore = JSON.parse(JSON.stringify(data))
    })

    vi.mocked(calculateFitScore).mockReturnValue({
      score: 88,
      breakdown: { base: 50, role: 25, industry: 13 },
      usingDefaults: false
    })

    vi.mocked(generateReasoning).mockReturnValue({
      score: 88,
      summary: 'Strong match (88/100)',
      whyIncluded: ['Role alignment', 'Industry fit'],
      considerations: [],
      breakdown: {}
    })
  })

  it('completes full flow: get -> process -> accept with context preserved', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)

    // Setup mock Supabase client with stateful data
    const submissions = [createSampleSubmission()]
    const mockClient = createMockSupabaseClient()

    // Mock getFriendSubmissions query
    mockClient._mockFrom.order.mockResolvedValue({
      data: submissions,
      error: null
    })

    // Mock single submission fetch
    mockClient._mockFrom.single.mockResolvedValue({
      data: submissions[0],
      error: null
    })

    // Mock status update
    mockClient._mockFrom.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    })

    vi.mocked(getSupabaseClient).mockReturnValue(mockClient)

    // Mock Worker for researchJobUrl
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        job: {
          title: 'Creative Director',
          company: 'Acme Corp',
          location: 'Boston',
          salary: '$150,000'
        }
      })
    })
    const originalEnv = process.env.JOB_VALIDATOR_URL
    process.env.JOB_VALIDATOR_URL = 'https://worker.example.com'

    // Step 1: Get friend submissions
    const listResult = await getFriendSubmissions()
    expect(listResult.status).toBe('success')
    expect(listResult.count).toBe(1)
    expect(listResult.submissions[0].friendContext.submittedBy).toBe('Sarah Chen')

    const submissionId = listResult.submissions[0].id

    // Step 2: Process the submission (research)
    const processResult = await processFriendSubmission({ submissionId })
    expect(processResult.friendContext).toBeDefined()
    expect(processResult.friendContext.submittedBy).toBe('Sarah Chen')
    expect(processResult.friendContext.connection).toBe('Former colleague from IDEO')
    expect(processResult.research).toBeDefined()

    // Step 3: Accept the submission
    const acceptResult = await acceptFriendSubmission({
      submissionId,
      status: 'apply-now',
      notes: 'Sarah knows me well, great recommendation'
    })

    expect(acceptResult.success).toBe(true)
    expect(acceptResult.friendContext).toBeDefined()
    expect(acceptResult.friendContext.submittedBy).toBe('Sarah Chen')
    expect(acceptResult.message).toContain('Sarah Chen')

    // Verify job was saved with preserved friend context
    const savedJob = jobStore.jobs.find(j => j.source === 'friend-submission')
    expect(savedJob).toBeDefined()
    expect(savedJob.friendContext).toBeDefined()
    expect(savedJob.friendContext.submittedBy).toBe('Sarah Chen')
    expect(savedJob.friendContext.connection).toBe('Former colleague from IDEO')
    expect(savedJob.friendContext.benefits).toBe('Great culture fit, creative freedom')
    expect(savedJob.notes).toContain('Sarah Chen')
    expect(savedJob.notes).toContain('Sarah knows me well')

    // Cleanup
    global.fetch = originalFetch
    process.env.JOB_VALIDATOR_URL = originalEnv
  })

  it('preserves friend context end-to-end even with partial research', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)

    const mockClient = createMockSupabaseClient()
    mockClient._mockFrom.single.mockResolvedValue({
      data: createSampleSubmission(),
      error: null
    })
    mockClient._mockFrom.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    })
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient)

    // No Worker URL - will return partial research
    delete process.env.JOB_VALIDATOR_URL

    // Process should still capture friend context
    const processResult = await processFriendSubmission({ submissionId: 'sub-123' })

    expect(processResult.friendContext).toBeDefined()
    expect(processResult.friendContext.submittedBy).toBe('Sarah Chen')
    // Research will be partial but friend context still present
    expect(processResult.research.status).toBe('partial_research')

    // Accept should still work with friend context
    const acceptResult = await acceptFriendSubmission({
      submissionId: 'sub-123',
      status: 'maybe'
    })

    expect(acceptResult.success).toBe(true)
    expect(acceptResult.friendContext.submittedBy).toBe('Sarah Chen')

    // Job saved with friend context
    const savedJob = jobStore.jobs[0]
    expect(savedJob.friendContext.submittedBy).toBe('Sarah Chen')
    expect(savedJob.source).toBe('friend-submission')
  })
})
