/**
 * Tests for Follow-up MCP Tools
 *
 * Tests the MCP tool functions for follow-up management.
 * Uses mocked loader and followup-engine modules for isolation.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock the loader module
vi.mock('../data/loader.js', () => ({
  loadJobsFromDashboard: vi.fn()
}))

// Mock the followup-engine module
vi.mock('../services/followup-engine.js', () => ({
  getFollowupQueue: vi.fn(),
  calculateFollowupStatus: vi.fn(),
  generateFollowupSuggestion: vi.fn()
}))

// Import mocked modules
import { loadJobsFromDashboard } from '../data/loader.js'
import {
  getFollowupQueue,
  calculateFollowupStatus,
  generateFollowupSuggestion
} from '../services/followup-engine.js'

// Import functions to test
import {
  getFollowups,
  getJobFollowupStatus,
  getFollowupSummary
} from './followup.js'

/**
 * Create a mock queue item
 */
function createMockQueueItem(overrides = {}) {
  return {
    jobId: overrides.jobId || 1,
    title: overrides.title || 'Software Engineer',
    company: overrides.company || 'Tech Corp',
    status: overrides.status || 'applied',
    priority: overrides.priority || 'medium',
    daysElapsed: overrides.daysElapsed || 15,
    referenceEvent: overrides.referenceEvent || 'application',
    suggestions: overrides.suggestions || [
      { type: 'action', text: 'Follow up now', priority: 'medium' }
    ],
    ...overrides
  }
}

/**
 * Create a mock job
 */
function createMockJob(overrides = {}) {
  return {
    id: overrides.id || 1,
    title: overrides.title || 'Software Engineer',
    company: overrides.company || 'Tech Corp',
    status: overrides.status || 'applied',
    applied: overrides.applied || '2026-01-15',
    found: overrides.found || '2026-01-10',
    connections: overrides.connections || [],
    updates: overrides.updates || [],
    fitScore: 75,
    url: 'https://example.com/job/1',
    ...overrides
  }
}

describe('getFollowups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns prioritized follow-up list', () => {
    getFollowupQueue.mockReturnValue([
      createMockQueueItem({ jobId: 1, title: 'Job 1', priority: 'high' }),
      createMockQueueItem({ jobId: 2, title: 'Job 2', priority: 'medium' })
    ])

    const result = getFollowups()

    expect(result.count).toBe(2)
    expect(result.showing).toBe(2)
    expect(result.followups).toHaveLength(2)
    expect(result.followups[0].title).toBe('Job 1')
    expect(result.followups[0].priority).toBe('high')
  })

  it('respects limit parameter', () => {
    getFollowupQueue.mockReturnValue([
      createMockQueueItem({ jobId: 1 }),
      createMockQueueItem({ jobId: 2 }),
      createMockQueueItem({ jobId: 3 })
    ])

    const result = getFollowups({ limit: 2 })

    expect(getFollowupQueue).toHaveBeenCalledWith({ limit: 2 })
  })

  it('defaults to limit of 10', () => {
    getFollowupQueue.mockReturnValue([])

    getFollowups()

    expect(getFollowupQueue).toHaveBeenCalledWith({ limit: 10 })
  })

  it('handles empty queue', () => {
    getFollowupQueue.mockReturnValue([])

    const result = getFollowups()

    expect(result.count).toBe(0)
    expect(result.showing).toBe(0)
    expect(result.followups).toEqual([])
  })

  it('formats followup items correctly', () => {
    getFollowupQueue.mockReturnValue([
      createMockQueueItem({
        jobId: 1,
        title: 'Design Lead',
        company: 'Acme',
        status: 'applied',
        priority: 'high',
        daysElapsed: 25,
        referenceEvent: 'application',
        suggestions: [
          { type: 'action', text: 'Send thank-you', priority: 'high' },
          { type: 'research', text: 'Find contact', priority: 'medium' }
        ]
      })
    ])

    const result = getFollowups()
    const item = result.followups[0]

    expect(item.jobId).toBe(1)
    expect(item.title).toBe('Design Lead')
    expect(item.company).toBe('Acme')
    expect(item.status).toBe('applied')
    expect(item.priority).toBe('high')
    expect(item.daysElapsed).toBe(25)
    expect(item.referenceEvent).toBe('application')
    expect(item.primarySuggestion).toBe('Send thank-you')
    expect(item.allSuggestions).toHaveLength(2)
  })

  it('handles items with no suggestions', () => {
    getFollowupQueue.mockReturnValue([
      createMockQueueItem({
        suggestions: []
      })
    ])

    const result = getFollowups()

    expect(result.followups[0].primarySuggestion).toBeNull()
    expect(result.followups[0].allSuggestions).toEqual([])
  })

  it('handles items with undefined suggestions', () => {
    getFollowupQueue.mockReturnValue([
      {
        jobId: 1,
        title: 'Test',
        company: 'Test Co',
        status: 'applied',
        priority: 'low',
        daysElapsed: 8
        // suggestions undefined
      }
    ])

    const result = getFollowups()

    expect(result.followups[0].primarySuggestion).toBeNull()
    expect(result.followups[0].allSuggestions).toEqual([])
  })
})

describe('getJobFollowupStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns follow-up status for valid job', () => {
    const mockJob = createMockJob({
      id: 1,
      title: 'Creative Director',
      company: 'Design Co',
      status: 'applied'
    })

    loadJobsFromDashboard.mockReturnValue({ jobs: [mockJob] })
    calculateFollowupStatus.mockReturnValue({
      needsFollowup: true,
      priority: 'medium',
      daysElapsed: 15,
      referenceEvent: 'application',
      referenceDate: '2026-01-15',
      suggestion: 'Follow up now'
    })
    generateFollowupSuggestion.mockReturnValue([
      { type: 'action', text: 'Follow up now', priority: 'medium' }
    ])

    const result = getJobFollowupStatus(1)

    expect(result.jobId).toBe(1)
    expect(result.title).toBe('Creative Director')
    expect(result.company).toBe('Design Co')
    expect(result.currentStatus).toBe('applied')
    expect(result.followup.needsFollowup).toBe(true)
    expect(result.followup.priority).toBe('medium')
    expect(result.followup.daysElapsed).toBe(15)
    expect(result.followup.suggestions).toHaveLength(1)
  })

  it('returns job without follow-up needed', () => {
    const mockJob = createMockJob({ id: 2 })

    loadJobsFromDashboard.mockReturnValue({ jobs: [mockJob] })
    calculateFollowupStatus.mockReturnValue({
      needsFollowup: false,
      daysElapsed: 3,
      referenceEvent: 'application',
      reason: 'No follow-up needed yet'
    })
    generateFollowupSuggestion.mockReturnValue([])

    const result = getJobFollowupStatus(2)

    expect(result.followup.needsFollowup).toBe(false)
    expect(result.followup.reason).toBe('No follow-up needed yet')
    expect(result.followup.suggestions).toEqual([])
  })

  it('returns error when job not found', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: [] })

    const result = getJobFollowupStatus(999)

    expect(result.error).toBe('Job with ID 999 not found')
  })

  it('includes simplified contacts view', () => {
    const mockJob = createMockJob({
      id: 1,
      connections: [
        {
          id: 'contact-1',
          name: 'Jane Recruiter',
          role: 'recruiter',
          reachedOut: true,
          lastInteraction: {
            date: '2026-01-20T10:00:00.000Z',
            type: 'email'
          }
        },
        {
          id: 'contact-2',
          name: 'Bob Manager',
          role: 'hiring_manager',
          reachedOut: false
        }
      ]
    })

    loadJobsFromDashboard.mockReturnValue({ jobs: [mockJob] })
    calculateFollowupStatus.mockReturnValue({ needsFollowup: true })
    generateFollowupSuggestion.mockReturnValue([])

    const result = getJobFollowupStatus(1)

    expect(result.contacts).toHaveLength(2)
    expect(result.contacts[0]).toEqual({
      name: 'Jane Recruiter',
      role: 'recruiter',
      reachedOut: true,
      lastInteractionDate: '2026-01-20T10:00:00.000Z'
    })
    expect(result.contacts[1]).toEqual({
      name: 'Bob Manager',
      role: 'hiring_manager',
      reachedOut: false,
      lastInteractionDate: null
    })
  })

  it('filters out legacy string contacts', () => {
    const mockJob = createMockJob({
      id: 1,
      connections: [
        'John Smith (referral)', // Legacy string
        {
          id: 'contact-1',
          name: 'Jane',
          role: 'recruiter',
          reachedOut: false
        }
      ]
    })

    loadJobsFromDashboard.mockReturnValue({ jobs: [mockJob] })
    calculateFollowupStatus.mockReturnValue({ needsFollowup: true })
    generateFollowupSuggestion.mockReturnValue([])

    const result = getJobFollowupStatus(1)

    // Only structured contact should be included
    expect(result.contacts).toHaveLength(1)
    expect(result.contacts[0].name).toBe('Jane')
  })

  it('handles job with no connections', () => {
    const mockJob = createMockJob({ id: 1, connections: undefined })

    loadJobsFromDashboard.mockReturnValue({ jobs: [mockJob] })
    calculateFollowupStatus.mockReturnValue({ needsFollowup: true })
    generateFollowupSuggestion.mockReturnValue([])

    const result = getJobFollowupStatus(1)

    expect(result.contacts).toEqual([])
  })

  it('handles missing jobs property', () => {
    loadJobsFromDashboard.mockReturnValue({})

    const result = getJobFollowupStatus(1)

    expect(result.error).toBe('Job with ID 1 not found')
  })
})

describe('getFollowupSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calculates correct counts and summary text', () => {
    getFollowupQueue.mockReturnValue([
      createMockQueueItem({ jobId: 1, priority: 'high', status: 'applied' }),
      createMockQueueItem({ jobId: 2, priority: 'high', status: 'applied' }),
      createMockQueueItem({ jobId: 3, priority: 'medium', status: 'inbox' }),
      createMockQueueItem({ jobId: 4, priority: 'low', status: 'maybe' })
    ])

    const result = getFollowupSummary()

    expect(result.totalNeedingFollowup).toBe(4)
    expect(result.byPriority).toEqual({ high: 2, medium: 1, low: 1 })
    expect(result.byStatus).toEqual({ applied: 2, inbox: 1, maybe: 1 })
    expect(result.summary).toBe('2 high priority follow-ups needed')
  })

  it('returns top 3 actions', () => {
    getFollowupQueue.mockReturnValue([
      createMockQueueItem({
        jobId: 1,
        title: 'Job 1',
        company: 'Company A',
        priority: 'high',
        suggestions: [{ text: 'Action 1' }]
      }),
      createMockQueueItem({
        jobId: 2,
        title: 'Job 2',
        company: 'Company B',
        priority: 'high',
        suggestions: [{ text: 'Action 2' }]
      }),
      createMockQueueItem({
        jobId: 3,
        title: 'Job 3',
        company: 'Company C',
        priority: 'medium',
        suggestions: [{ text: 'Action 3' }]
      }),
      createMockQueueItem({
        jobId: 4,
        title: 'Job 4',
        company: 'Company D',
        priority: 'low',
        suggestions: [{ text: 'Action 4' }]
      })
    ])

    const result = getFollowupSummary()

    expect(result.topActions).toHaveLength(3)
    expect(result.topActions[0]).toEqual({
      job: 'Job 1 at Company A',
      action: 'Action 1',
      priority: 'high'
    })
    expect(result.topActions[2]).toEqual({
      job: 'Job 3 at Company C',
      action: 'Action 3',
      priority: 'medium'
    })
  })

  it('handles empty queue', () => {
    getFollowupQueue.mockReturnValue([])

    const result = getFollowupSummary()

    expect(result.totalNeedingFollowup).toBe(0)
    expect(result.byPriority).toEqual({ high: 0, medium: 0, low: 0 })
    expect(result.byStatus).toEqual({})
    expect(result.topActions).toEqual([])
    expect(result.summary).toBe('No urgent follow-ups')
  })

  it('shows medium summary when no high priority', () => {
    getFollowupQueue.mockReturnValue([
      createMockQueueItem({ priority: 'medium' }),
      createMockQueueItem({ priority: 'medium' }),
      createMockQueueItem({ priority: 'low' })
    ])

    const result = getFollowupSummary()

    expect(result.summary).toBe('2 medium priority items')
  })

  it('shows low summary when no high or medium priority', () => {
    getFollowupQueue.mockReturnValue([
      createMockQueueItem({ priority: 'low' }),
      createMockQueueItem({ priority: 'low' }),
      createMockQueueItem({ priority: 'low' })
    ])

    const result = getFollowupSummary()

    expect(result.summary).toBe('3 low priority items')
  })

  it('uses singular form for single item', () => {
    getFollowupQueue.mockReturnValue([
      createMockQueueItem({ priority: 'high' })
    ])

    const result = getFollowupSummary()

    expect(result.summary).toBe('1 high priority follow-up needed')
  })

  it('handles items with no suggestions', () => {
    getFollowupQueue.mockReturnValue([
      createMockQueueItem({
        title: 'Test Job',
        company: 'Test Co',
        suggestions: []
      })
    ])

    const result = getFollowupSummary()

    expect(result.topActions[0].action).toBe('Review needed')
  })

  it('handles items with undefined suggestions', () => {
    getFollowupQueue.mockReturnValue([
      {
        jobId: 1,
        title: 'Test',
        company: 'Test Co',
        status: 'applied',
        priority: 'high'
        // suggestions undefined
      }
    ])

    const result = getFollowupSummary()

    expect(result.topActions[0].action).toBe('Review needed')
  })

  it('requests high limit from queue to get all items', () => {
    getFollowupQueue.mockReturnValue([])

    getFollowupSummary()

    expect(getFollowupQueue).toHaveBeenCalledWith({ limit: 1000 })
  })
})
