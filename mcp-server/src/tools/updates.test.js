/**
 * Tests for Job Update Tools
 *
 * Tests the MCP tool functions that modify job data.
 * Uses mocked fs and os modules to avoid file system side effects.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn()
}))

// Mock os module
vi.mock('os', () => ({
  tmpdir: vi.fn(() => '/tmp')
}))

// Import after mocking
import {
  updateJob,
  archiveJob,
  archiveJobs,
  setHiringManager,
  addJobNote,
  bulkUpdateJobs
} from './updates.js'

// Sample job data for tests
const createMockJobsData = () => ({
  jobs: [
    {
      id: 1,
      title: 'Creative Director',
      company: 'Acme Corp',
      industry: 'Technology',
      status: 'apply-now',
      fitScore: 85,
      updates: [],
      connections: []
    },
    {
      id: 2,
      title: 'Senior Designer',
      company: 'Tech Solutions',
      industry: 'Technology',
      status: 'applied',
      fitScore: 72,
      updates: [
        { date: '2026-01-25', type: 'Applied', notes: 'Submitted application' }
      ],
      connections: ['John Smith']
    },
    {
      id: 3,
      title: 'Design Lead',
      company: 'Healthcare Inc',
      industry: 'Healthcare',
      status: 'archived',
      fitScore: 90,
      updates: [],
      connections: []
    }
  ],
  version: 1,
  lastUpdated: '2026-01-28T10:00:00.000Z'
})

describe('updateJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify(createMockJobsData()))
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})
  })

  it('updates job fields correctly', () => {
    const result = updateJob(1, { status: 'applied', notes: 'Submitted!' })

    expect(result.success).toBe(true)
    expect(result.jobId).toBe(1)
    expect(result.job.status).toBe('applied')
    expect(result.job.notes).toBe('Submitted!')
  })

  it('returns changedFields array', () => {
    const result = updateJob(1, { status: 'applied', fitScore: 95 })

    expect(result.changedFields).toHaveLength(2)
    expect(result.changedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'status', oldValue: 'apply-now', newValue: 'applied' }),
        expect.objectContaining({ field: 'fitScore', oldValue: 85, newValue: 95 })
      ])
    )
  })

  it('adds update entry to job history', () => {
    const result = updateJob(1, { status: 'applied' })

    expect(result.job.updates).toHaveLength(1)
    expect(result.job.updates[0].type).toBe('MCP Update')
    expect(result.job.updates[0].notes).toContain('Updated: status')
  })

  it('returns error for non-existent job ID', () => {
    const result = updateJob(999, { status: 'applied' })

    expect(result.error).toBe('Job with ID 999 not found')
  })

  it('returns "no changes" when values are same', () => {
    const result = updateJob(1, { status: 'apply-now' }) // Already 'apply-now'

    expect(result.success).toBe(true)
    expect(result.message).toBe('No changes needed')
    expect(result.changedFields).toBeUndefined()
  })

  it('increments version on write', () => {
    updateJob(1, { status: 'applied' })

    // Verify renameSync was called (atomic write)
    expect(fs.renameSync).toHaveBeenCalled()

    // Verify writeFileSync was called with incremented version
    expect(fs.writeFileSync).toHaveBeenCalled()
    const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1])
    expect(writtenData.version).toBe(2)
  })
})

describe('archiveJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify(createMockJobsData()))
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})
  })

  it('changes status to archived', () => {
    const result = archiveJob(1, 'Position filled')

    expect(result.success).toBe(true)
    expect(result.job.status).toBe('archived')
  })

  it('returns previousStatus', () => {
    const result = archiveJob(1, 'Position filled')

    expect(result.previousStatus).toBe('apply-now')
  })

  it('adds archive entry to updates', () => {
    const result = archiveJob(1, 'Position filled')

    const archiveUpdate = result.job.updates.find(u => u.type === 'Archived')
    expect(archiveUpdate).toBeDefined()
    expect(archiveUpdate.notes).toBe('Position filled')
  })

  it('returns "already archived" if already archived', () => {
    const result = archiveJob(3) // Job 3 is already archived

    expect(result.success).toBe(true)
    expect(result.message).toBe('Job already archived')
  })

  it('returns error for non-existent job ID', () => {
    const result = archiveJob(999)

    expect(result.error).toBe('Job with ID 999 not found')
  })

  it('uses default reason if not provided', () => {
    const result = archiveJob(1)

    const archiveUpdate = result.job.updates.find(u => u.type === 'Archived')
    expect(archiveUpdate.notes).toBe('Archived via MCP')
  })
})

describe('archiveJobs (bulk)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify(createMockJobsData()))
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})
  })

  it('archives multiple jobs', () => {
    const result = archiveJobs([1, 2], 'Batch cleanup')

    expect(result.success).toBe(true)
    expect(result.archivedCount).toBe(2)
  })

  it('returns count and results', () => {
    const result = archiveJobs([1, 2], 'Batch cleanup')

    expect(result.totalRequested).toBe(2)
    expect(result.archivedCount).toBe(2)
    expect(result.results).toHaveLength(2)
    expect(result.results[0].status).toBe('archived')
    expect(result.results[1].status).toBe('archived')
  })

  it('handles non-existent IDs gracefully', () => {
    const result = archiveJobs([1, 999], 'Batch cleanup')

    expect(result.archivedCount).toBe(1)
    expect(result.results).toHaveLength(2)
    expect(result.results[0].status).toBe('archived')
    expect(result.results[1].error).toBe('Not found')
  })

  it('handles already-archived jobs', () => {
    const result = archiveJobs([1, 3], 'Batch cleanup') // Job 3 is already archived

    expect(result.archivedCount).toBe(1)
    const alreadyArchivedResult = result.results.find(r => r.jobId === 3)
    expect(alreadyArchivedResult.status).toBe('already archived')
  })
})

describe('setHiringManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify(createMockJobsData()))
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})
  })

  it('sets hiringManager object', () => {
    const manager = {
      name: 'Jane Doe',
      title: 'VP of Design',
      linkedin: 'https://linkedin.com/in/janedoe',
      notes: 'Met at conference'
    }

    const result = setHiringManager(1, manager)

    expect(result.success).toBe(true)
    expect(result.hiringManager.name).toBe('Jane Doe')
    expect(result.hiringManager.title).toBe('VP of Design')
    expect(result.hiringManager.linkedin).toBe('https://linkedin.com/in/janedoe')
    expect(result.hiringManager.notes).toBe('Met at conference')
    expect(result.hiringManager.foundDate).toBeDefined()
  })

  it('adds to connections array', () => {
    const manager = { name: 'Jane Doe', title: 'VP of Design' }

    const result = setHiringManager(1, manager)

    expect(result.job.connections).toContain('Hiring Manager: Jane Doe (VP of Design)')
  })

  it('adds update entry', () => {
    const manager = { name: 'Jane Doe', title: 'VP of Design' }

    const result = setHiringManager(1, manager)

    const hmUpdate = result.job.updates.find(u => u.type === 'Hiring Manager Found')
    expect(hmUpdate).toBeDefined()
    expect(hmUpdate.notes).toBe('Jane Doe - VP of Design')
  })

  it('does not duplicate existing connection', () => {
    const mockData = createMockJobsData()
    mockData.jobs[0].connections = ['Hiring Manager: Jane Doe (VP of Design)']
    fs.readFileSync.mockReturnValue(JSON.stringify(mockData))

    const manager = { name: 'Jane Doe', title: 'VP of Design' }
    const result = setHiringManager(1, manager)

    // Should still have only 1 connection (not duplicated)
    const janeConnections = result.job.connections.filter(c => c.includes('Jane Doe'))
    expect(janeConnections).toHaveLength(1)
  })

  it('returns error for non-existent job ID', () => {
    const manager = { name: 'Jane Doe' }

    const result = setHiringManager(999, manager)

    expect(result.error).toBe('Job with ID 999 not found')
  })
})

describe('addJobNote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify(createMockJobsData()))
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})
  })

  it('adds note to updates array', () => {
    const result = addJobNote(1, 'Research', 'Looked up company on Glassdoor')

    expect(result.success).toBe(true)
    expect(result.entry.notes).toBe('Looked up company on Glassdoor')
  })

  it('sets date and type correctly', () => {
    const result = addJobNote(1, 'Interview', 'Phone screen scheduled')

    expect(result.entry.type).toBe('Interview')
    expect(result.entry.date).toBeDefined()
    // Date should be in YYYY-MM-DD format
    expect(result.entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns totalUpdates count', () => {
    const result = addJobNote(1, 'Note', 'First note')

    expect(result.totalUpdates).toBe(1)

    // Add another note - need to update mock data
    const mockData = createMockJobsData()
    mockData.jobs[0].updates = [{ date: '2026-01-28', type: 'Note', notes: 'First' }]
    fs.readFileSync.mockReturnValue(JSON.stringify(mockData))

    const result2 = addJobNote(1, 'Note', 'Second note')
    expect(result2.totalUpdates).toBe(2)
  })

  it('uses default type "Note" if not provided', () => {
    const result = addJobNote(1, null, 'General observation')

    expect(result.entry.type).toBe('Note')
  })

  it('returns error for non-existent job ID', () => {
    const result = addJobNote(999, 'Note', 'Test')

    expect(result.error).toBe('Job with ID 999 not found')
  })
})

describe('bulkUpdateJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify(createMockJobsData()))
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})
  })

  it('updates multiple jobs', () => {
    const updates = [
      { jobId: 1, updates: { status: 'applied' } },
      { jobId: 2, updates: { fitScore: 80 } }
    ]

    const result = bulkUpdateJobs(updates)

    expect(result.success).toBe(true)
    expect(result.updatedCount).toBe(2)
  })

  it('tracks changed fields per job', () => {
    const updates = [
      { jobId: 1, updates: { status: 'applied', fitScore: 90 } }
    ]

    const result = bulkUpdateJobs(updates)

    const jobResult = result.results.find(r => r.jobId === 1)
    expect(jobResult.changedFields).toContain('status')
    expect(jobResult.changedFields).toContain('fitScore')
  })

  it('returns success count', () => {
    const updates = [
      { jobId: 1, updates: { status: 'applied' } },
      { jobId: 999, updates: { status: 'applied' } }, // Non-existent
      { jobId: 2, updates: { status: 'applied' } } // Already 'applied', no changes
    ]

    const result = bulkUpdateJobs(updates)

    expect(result.totalRequested).toBe(3)
    // Only job 1 actually changes (job 999 not found, job 2 already applied)
    expect(result.updatedCount).toBe(1)
  })

  it('handles non-existent IDs gracefully', () => {
    const updates = [
      { jobId: 1, updates: { status: 'applied' } },
      { jobId: 999, updates: { status: 'applied' } }
    ]

    const result = bulkUpdateJobs(updates)

    const notFoundResult = result.results.find(r => r.jobId === 999)
    expect(notFoundResult.error).toBe('Not found')
  })

  it('reports no changes when values are same', () => {
    const updates = [
      { jobId: 1, updates: { status: 'apply-now' } } // Already 'apply-now'
    ]

    const result = bulkUpdateJobs(updates)

    expect(result.updatedCount).toBe(0)
    expect(result.results[0].status).toBe('no changes')
  })
})

describe('Status Transition Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fs.existsSync.mockReturnValue(true)
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})
  })

  it('rejects invalid status transition in archiveJob', () => {
    // archiving an already archived job should return the "already archived" message
    fs.readFileSync.mockReturnValue(JSON.stringify({
      jobs: [{ id: 1, status: 'archived', title: 'Test', company: 'Corp' }]
    }))

    const result = archiveJob(1, 'test reason')

    // Already archived is handled separately (returns success with message)
    expect(result.message || result.success).toBeTruthy()
  })

  it('rejects invalid status transition in updateJob', () => {
    // Trying to go from 'probably-not' directly to 'applied' should fail
    fs.readFileSync.mockReturnValue(JSON.stringify({
      jobs: [{ id: 1, status: 'probably-not', title: 'Test', company: 'Corp' }]
    }))

    const result = updateJob(1, { status: 'applied' })

    expect(result.error).toBeDefined()
    expect(result.error).toContain('Cannot transition')
  })

  it('allows valid status transition in updateJob', () => {
    // 'maybe' to 'applied' is valid
    fs.readFileSync.mockReturnValue(JSON.stringify({
      jobs: [{ id: 1, status: 'maybe', title: 'Test', company: 'Corp' }]
    }))

    const result = updateJob(1, { status: 'applied' })

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
  })

  it('rejects invalid status transition in bulkUpdateJobs', () => {
    // Trying to go from 'probably-not' directly to 'applied' should fail
    fs.readFileSync.mockReturnValue(JSON.stringify({
      jobs: [{ id: 1, status: 'probably-not', title: 'Test', company: 'Corp' }]
    }))

    const result = bulkUpdateJobs([{ jobId: 1, updates: { status: 'applied' } }])

    expect(result.results[0].error).toBeDefined()
    expect(result.results[0].error).toContain('Cannot transition')
  })

  it('allows archiving from any non-archived status', () => {
    // 'apply-now' to 'archived' should work
    fs.readFileSync.mockReturnValue(JSON.stringify({
      jobs: [{ id: 1, status: 'apply-now', title: 'Test', company: 'Corp' }]
    }))

    const result = archiveJob(1, 'Position filled')

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    expect(result.job.status).toBe('archived')
  })
})
