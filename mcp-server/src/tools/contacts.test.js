/**
 * Tests for Contact Management MCP Tools
 *
 * Tests the MCP tool functions for contact management.
 * Uses mocked loader module to isolate from file system.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock the loader module
vi.mock('../data/loader.js', () => ({
  loadJobsFromDashboard: vi.fn(),
  writeJobsData: vi.fn()
}))

// Mock the job schema
vi.mock('../../../schemas/job.schema.js', () => ({
  isValidTransition: vi.fn()
}))

// Import mocked modules
import { loadJobsFromDashboard, writeJobsData } from '../data/loader.js'
import { isValidTransition } from '../../../schemas/job.schema.js'

// Import functions to test (after mocks are set up)
import {
  addJobContact,
  logContactInteraction,
  getJobContacts,
  addJobUpdate
} from './contacts.js'

// Sample job data for tests
const createMockJobsData = () => ({
  jobs: [
    {
      id: 1,
      title: 'Creative Director',
      company: 'Acme Corp',
      status: 'apply-now',
      fitScore: 85,
      updates: [],
      connections: []
    },
    {
      id: 2,
      title: 'Senior Designer',
      company: 'Tech Solutions',
      status: 'applied',
      applied: '2026-01-25',
      fitScore: 72,
      updates: [
        { date: '2026-01-25', type: 'Applied', notes: 'Submitted application' }
      ],
      connections: [
        'John Smith (referral)',
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Jane Doe',
          role: 'recruiter',
          title: 'Senior Recruiter',
          linkedInUrl: 'https://linkedin.com/in/janedoe',
          email: 'jane@example.com',
          isPrimary: true,
          reachedOut: false,
          interactions: [],
          createdAt: '2026-01-20T10:00:00.000Z',
          updatedAt: '2026-01-20T10:00:00.000Z'
        }
      ],
      notes: 'Good company culture'
    },
    {
      id: 3,
      title: 'Design Lead',
      company: 'Healthcare Inc',
      status: 'maybe',
      fitScore: 90,
      updates: [],
      connections: []
    }
  ],
  version: 1,
  lastUpdated: '2026-01-28T10:00:00.000Z'
})

describe('addJobContact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadJobsFromDashboard.mockReturnValue(createMockJobsData())
    writeJobsData.mockImplementation(() => {})
  })

  describe('adding new contacts', () => {
    it('adds a new contact with full data', () => {
      const contactData = {
        name: 'Mike Jones',
        role: 'hiring_manager',
        title: 'VP of Design',
        linkedInUrl: 'https://linkedin.com/in/mikejones',
        email: 'mike@acme.com',
        isPrimary: true
      }

      const result = addJobContact(1, contactData)

      expect(result.success).toBe(true)
      expect(result.action).toBe('added')
      expect(result.contact.name).toBe('Mike Jones')
      expect(result.contact.role).toBe('hiring_manager')
      expect(result.contact.id).toBeDefined()
      expect(result.contact.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}/)
      expect(result.contact.createdAt).toBeDefined()
      expect(result.contact.updatedAt).toBeDefined()
    })

    it('adds a minimal contact (name only)', () => {
      const result = addJobContact(1, { name: 'Simple Contact' })

      expect(result.success).toBe(true)
      expect(result.contact.name).toBe('Simple Contact')
      expect(result.contact.role).toBe('other') // Default role
    })

    it('writes data and adds update entry', () => {
      addJobContact(1, { name: 'New Contact', role: 'recruiter' })

      expect(writeJobsData).toHaveBeenCalled()
      const writtenData = writeJobsData.mock.calls[0][0]
      const job = writtenData.jobs.find(j => j.id === 1)

      expect(job.connections).toHaveLength(1)
      expect(job.updates).toHaveLength(1)
      expect(job.updates[0].type).toBe('Contact Added')
      expect(job.updates[0].notes).toContain('New Contact')
    })
  })

  describe('duplicate detection', () => {
    it('detects duplicate by name (case-insensitive)', () => {
      const result = addJobContact(2, { name: 'JANE DOE', role: 'internal_contact' })

      expect(result.success).toBe(true)
      expect(result.action).toBe('updated')
      expect(result.contact.name).toBe('JANE DOE') // Updated to new case
      expect(result.contact.role).toBe('internal_contact') // Updated role
    })

    it('detects duplicate by LinkedIn URL', () => {
      const result = addJobContact(2, {
        name: 'Different Name',
        linkedInUrl: 'https://linkedin.com/in/janedoe'
      })

      expect(result.success).toBe(true)
      expect(result.action).toBe('updated')
    })

    it('preserves original ID and createdAt when updating', () => {
      const result = addJobContact(2, {
        name: 'Jane Doe',
        title: 'Director of Recruiting'
      })

      expect(result.contact.id).toBe('123e4567-e89b-12d3-a456-426614174000')
      expect(result.contact.createdAt).toBe('2026-01-20T10:00:00.000Z')
      expect(result.contact.title).toBe('Director of Recruiting')
    })
  })

  describe('error handling', () => {
    it('returns error when job not found', () => {
      const result = addJobContact(999, { name: 'Test' })

      expect(result.error).toBe('Job with ID 999 not found')
    })

    it('returns error when name is missing', () => {
      const result = addJobContact(1, { role: 'recruiter' })

      expect(result.error).toBe('Contact name is required')
    })

    it('returns error when contactData is null', () => {
      const result = addJobContact(1, null)

      expect(result.error).toBe('Contact name is required')
    })
  })
})

describe('logContactInteraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadJobsFromDashboard.mockReturnValue(createMockJobsData())
    writeJobsData.mockImplementation(() => {})
  })

  describe('valid interactions', () => {
    it('logs an email interaction', () => {
      const result = logContactInteraction(
        2,
        '123e4567-e89b-12d3-a456-426614174000',
        { type: 'email', notes: 'Sent follow-up about application' }
      )

      expect(result.success).toBe(true)
      expect(result.interaction.type).toBe('email')
      expect(result.interaction.notes).toBe('Sent follow-up about application')
      expect(result.interaction.date).toBeDefined()
    })

    it('updates lastInteraction on the contact', () => {
      const result = logContactInteraction(
        2,
        '123e4567-e89b-12d3-a456-426614174000',
        { type: 'call' }
      )

      expect(result.contact.lastInteraction).toBeDefined()
      expect(result.contact.lastInteraction.type).toBe('call')
    })

    it('sets reachedOut to true', () => {
      const result = logContactInteraction(
        2,
        '123e4567-e89b-12d3-a456-426614174000',
        { type: 'linkedin' }
      )

      expect(result.contact.reachedOut).toBe(true)
    })

    it('adds to interactions array', () => {
      logContactInteraction(
        2,
        '123e4567-e89b-12d3-a456-426614174000',
        { type: 'email', notes: 'First contact' }
      )

      expect(writeJobsData).toHaveBeenCalled()
      const writtenData = writeJobsData.mock.calls[0][0]
      const job = writtenData.jobs.find(j => j.id === 2)
      const contact = job.connections.find(c => typeof c === 'object' && c.name === 'Jane Doe')

      expect(contact.interactions).toHaveLength(1)
      expect(contact.interactions[0].type).toBe('email')
    })

    it('updates contact.updatedAt', () => {
      const result = logContactInteraction(
        2,
        '123e4567-e89b-12d3-a456-426614174000',
        { type: 'meeting' }
      )

      // updatedAt should be more recent than createdAt
      expect(new Date(result.contact.updatedAt) > new Date(result.contact.createdAt)).toBe(true)
    })
  })

  describe('error handling', () => {
    it('returns error when job not found', () => {
      const result = logContactInteraction(999, 'some-id', { type: 'email' })

      expect(result.error).toBe('Job with ID 999 not found')
    })

    it('returns error when contact not found', () => {
      const result = logContactInteraction(2, 'nonexistent-id', { type: 'email' })

      expect(result.error).toBe('Contact with ID nonexistent-id not found')
    })

    it('returns error when contactId is missing', () => {
      const result = logContactInteraction(2, null, { type: 'email' })

      expect(result.error).toBe('Contact ID is required')
    })

    it('returns error when interaction type is missing', () => {
      const result = logContactInteraction(
        2,
        '123e4567-e89b-12d3-a456-426614174000',
        { notes: 'Just notes' }
      )

      expect(result.error).toBe('Interaction type is required')
    })
  })
})

describe('getJobContacts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadJobsFromDashboard.mockReturnValue(createMockJobsData())
  })

  it('returns job details with contacts', () => {
    const result = getJobContacts(2)

    expect(result.jobId).toBe(2)
    expect(result.title).toBe('Senior Designer')
    expect(result.company).toBe('Tech Solutions')
  })

  it('separates structured and legacy contacts', () => {
    const result = getJobContacts(2)

    expect(result.structuredContacts).toHaveLength(1)
    expect(result.legacyContacts).toHaveLength(1)
    expect(result.totalContacts).toBe(2)
  })

  it('parses legacy contacts with suggestion', () => {
    const result = getJobContacts(2)

    const legacy = result.legacyContacts[0]
    expect(legacy.name).toBe('John Smith')
    expect(legacy.notes).toBe('referral')
    expect(legacy.legacy).toBe(true)
    expect(legacy.originalValue).toBe('John Smith (referral)')
    expect(legacy.suggestion).toContain('Convert to structured format')
  })

  it('returns hasUncontacted correctly', () => {
    const result = getJobContacts(2)

    // Jane Doe has reachedOut: false
    expect(result.hasUncontacted).toBe(true)
  })

  it('handles job with no connections', () => {
    const result = getJobContacts(1)

    expect(result.totalContacts).toBe(0)
    expect(result.structuredContacts).toEqual([])
    expect(result.legacyContacts).toEqual([])
    expect(result.hasUncontacted).toBe(false)
  })

  it('returns error when job not found', () => {
    const result = getJobContacts(999)

    expect(result.error).toBe('Job with ID 999 not found')
  })
})

describe('addJobUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadJobsFromDashboard.mockReturnValue(createMockJobsData())
    writeJobsData.mockImplementation(() => {})
    isValidTransition.mockImplementation((from, to) => {
      // Simple mock: allow most transitions except probably-not -> applied
      if (from === 'probably-not' && to === 'applied') return false
      if (from === 'archived') return false
      return true
    })
  })

  describe('note only', () => {
    it('adds a note with default type', () => {
      const result = addJobUpdate(1, { note: 'Researched the team' })

      expect(result.success).toBe(true)
      expect(result.changes).toContain('note added')

      expect(writeJobsData).toHaveBeenCalled()
      const writtenData = writeJobsData.mock.calls[0][0]
      const job = writtenData.jobs.find(j => j.id === 1)

      expect(job.updates).toHaveLength(1)
      expect(job.updates[0].notes).toBe('Researched the team')
      expect(job.updates[0].type).toBe('Note')
    })

    it('adds a note with custom type', () => {
      const result = addJobUpdate(1, { note: 'Phone call scheduled', type: 'Interview' })

      expect(result.success).toBe(true)

      const writtenData = writeJobsData.mock.calls[0][0]
      const job = writtenData.jobs.find(j => j.id === 1)

      expect(job.updates[0].type).toBe('Interview')
    })
  })

  describe('connection only', () => {
    it('adds a connection via addJobUpdate', () => {
      const result = addJobUpdate(1, {
        connection: { name: 'Bob Builder', role: 'referral' }
      })

      expect(result.success).toBe(true)
      expect(result.changes).toContain('contact added: Bob Builder')
    })
  })

  describe('status change', () => {
    it('changes status when valid transition', () => {
      const result = addJobUpdate(1, { status: 'applied' })

      expect(result.success).toBe(true)
      expect(result.changes).toContain('status: apply-now -> applied')
    })

    it('sets applied date when transitioning to applied', () => {
      addJobUpdate(1, { status: 'applied' })

      const writtenData = writeJobsData.mock.calls[0][0]
      const job = writtenData.jobs.find(j => j.id === 1)

      expect(job.applied).toBeDefined()
      expect(job.applied).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('does not overwrite existing applied date', () => {
      addJobUpdate(2, { status: 'archived' })

      const writtenData = writeJobsData.mock.calls[0][0]
      const job = writtenData.jobs.find(j => j.id === 2)

      expect(job.applied).toBe('2026-01-25') // Original date preserved
    })

    it('returns error for invalid transition', () => {
      // Set up mock data with probably-not status
      const mockData = createMockJobsData()
      mockData.jobs[0].status = 'probably-not'
      loadJobsFromDashboard.mockReturnValue(mockData)

      const result = addJobUpdate(1, { status: 'applied' })

      expect(result.error).toContain('Cannot transition')
    })

    it('adds status change to updates history', () => {
      addJobUpdate(1, { status: 'applied' })

      const writtenData = writeJobsData.mock.calls[0][0]
      const job = writtenData.jobs.find(j => j.id === 1)

      const statusUpdate = job.updates.find(u => u.type === 'Status Change')
      expect(statusUpdate).toBeDefined()
      expect(statusUpdate.notes).toBe('apply-now -> applied')
    })
  })

  describe('appendToNotes', () => {
    it('appends to existing notes', () => {
      addJobUpdate(2, { appendToNotes: 'Had great phone screen' })

      const writtenData = writeJobsData.mock.calls[0][0]
      const job = writtenData.jobs.find(j => j.id === 2)

      expect(job.notes).toContain('Good company culture')
      expect(job.notes).toContain('Had great phone screen')
      expect(job.notes).toMatch(/\[\d{4}-\d{2}-\d{2}\]/)
    })

    it('creates notes field if empty', () => {
      addJobUpdate(1, { appendToNotes: 'First note' })

      const writtenData = writeJobsData.mock.calls[0][0]
      const job = writtenData.jobs.find(j => j.id === 1)

      expect(job.notes).toContain('First note')
    })
  })

  describe('combined updates', () => {
    it('handles note + status change together', () => {
      const result = addJobUpdate(1, {
        note: 'Submitted application via website',
        type: 'Applied',
        status: 'applied'
      })

      expect(result.success).toBe(true)
      expect(result.changes).toContain('note added')
      expect(result.changes).toContain('status: apply-now -> applied')

      const writtenData = writeJobsData.mock.calls[0][0]
      const job = writtenData.jobs.find(j => j.id === 1)

      // Should have both note and status change updates
      expect(job.updates.length).toBeGreaterThanOrEqual(2)
    })

    it('handles all fields together', () => {
      const result = addJobUpdate(3, {
        note: 'Got referral from friend',
        type: 'Referral',
        status: 'apply-now',
        connection: { name: 'Friend Contact', role: 'referral' },
        appendToNotes: 'Friend works in design team'
      })

      expect(result.success).toBe(true)
      expect(result.changes).toHaveLength(4) // note, contact, status, append
    })
  })

  describe('error handling', () => {
    it('returns error when job not found', () => {
      const result = addJobUpdate(999, { note: 'Test' })

      expect(result.error).toBe('Job with ID 999 not found')
    })

    it('returns error when update object is null', () => {
      const result = addJobUpdate(1, null)

      expect(result.error).toBe('Update object is required')
    })

    it('returns error from connection failure', () => {
      // Empty name should fail
      const result = addJobUpdate(1, {
        connection: { role: 'recruiter' } // Missing name
      })

      expect(result.error).toContain('name is required')
    })
  })
})
