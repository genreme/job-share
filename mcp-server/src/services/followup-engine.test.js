/**
 * Follow-up Engine Service Tests
 *
 * Tests time-based follow-up calculations and smart suggestion generation.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  FOLLOWUP_RULES,
  calculateFollowupStatus,
  generateFollowupSuggestion,
  getFollowupQueue
} from './followup-engine.js'

// Mock the data loader
vi.mock('../data/loader.js', () => ({
  loadJobsFromDashboard: vi.fn()
}))

import { loadJobsFromDashboard } from '../data/loader.js'

// Use fake timers for deterministic date testing
const FIXED_DATE = new Date('2026-02-06T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_DATE)
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * Create a date N days ago from the fixed test date
 */
function daysAgo(n) {
  const date = new Date(FIXED_DATE)
  date.setDate(date.getDate() - n)
  return date.toISOString().split('T')[0]
}

/**
 * Create a mock job for testing
 */
function createMockJob(overrides = {}) {
  return {
    id: overrides.id || 1,
    title: overrides.title || 'Software Engineer',
    company: overrides.company || 'Tech Corp',
    status: overrides.status || 'applied',
    applied: overrides.applied || daysAgo(10),
    found: overrides.found || daysAgo(15),
    connections: overrides.connections || [],
    updates: overrides.updates || [],
    fitScore: 75,
    url: 'https://example.com/job/1',
    ...overrides
  }
}

/**
 * Create a mock structured contact
 */
function createMockContact(overrides = {}) {
  return {
    id: overrides.id || 'contact-123',
    name: overrides.name || 'Jane Recruiter',
    role: overrides.role || 'recruiter',
    title: 'Senior Recruiter',
    linkedInUrl: 'https://linkedin.com/in/jane',
    isPrimary: overrides.isPrimary ?? false,
    reachedOut: overrides.reachedOut ?? false,
    lastInteraction: overrides.lastInteraction || null,
    interactions: overrides.interactions || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

describe('FOLLOWUP_RULES', () => {
  it('defines rules for applied status', () => {
    expect(FOLLOWUP_RULES['applied']).toBeDefined()
    expect(FOLLOWUP_RULES['applied'].length).toBe(3)
  })

  it('defines rules for inbox status', () => {
    expect(FOLLOWUP_RULES['inbox']).toBeDefined()
    expect(FOLLOWUP_RULES['inbox'].length).toBe(2)
  })

  it('defines rules for apply-now status', () => {
    expect(FOLLOWUP_RULES['apply-now']).toBeDefined()
    expect(FOLLOWUP_RULES['apply-now'].length).toBe(2)
  })

  it('defines rules for maybe status', () => {
    expect(FOLLOWUP_RULES['maybe']).toBeDefined()
    expect(FOLLOWUP_RULES['maybe'].length).toBe(2)
  })

  it('has no rules for archived or probably-not', () => {
    expect(FOLLOWUP_RULES['archived']).toBeUndefined()
    expect(FOLLOWUP_RULES['probably-not']).toBeUndefined()
  })
})

describe('calculateFollowupStatus', () => {
  describe('applied status', () => {
    it('returns low priority at 7 days', () => {
      const job = createMockJob({
        status: 'applied',
        applied: daysAgo(7)
      })

      const result = calculateFollowupStatus(job)

      expect(result.needsFollowup).toBe(true)
      expect(result.priority).toBe('low')
      expect(result.daysElapsed).toBe(7)
      expect(result.referenceEvent).toBe('application')
      expect(result.suggestion).toContain('brief check-in')
    })

    it('returns medium priority at 14 days', () => {
      const job = createMockJob({
        status: 'applied',
        applied: daysAgo(14)
      })

      const result = calculateFollowupStatus(job)

      expect(result.needsFollowup).toBe(true)
      expect(result.priority).toBe('medium')
      expect(result.daysElapsed).toBe(14)
      expect(result.suggestion).toContain('reference your application date')
    })

    it('returns high priority at 21+ days', () => {
      const job = createMockJob({
        status: 'applied',
        applied: daysAgo(25)
      })

      const result = calculateFollowupStatus(job)

      expect(result.needsFollowup).toBe(true)
      expect(result.priority).toBe('high')
      expect(result.daysElapsed).toBe(25)
      expect(result.suggestion).toContain('restate interest')
    })

    it('returns no followup needed for recently applied (< 7 days)', () => {
      const job = createMockJob({
        status: 'applied',
        applied: daysAgo(3)
      })

      const result = calculateFollowupStatus(job)

      expect(result.needsFollowup).toBe(false)
      expect(result.daysElapsed).toBe(3)
      expect(result.reason).toBe('No follow-up needed yet')
    })
  })

  describe('inbox status', () => {
    it('returns low priority at 3 days', () => {
      const job = createMockJob({
        status: 'inbox',
        applied: null,
        found: daysAgo(3)
      })

      const result = calculateFollowupStatus(job)

      expect(result.needsFollowup).toBe(true)
      expect(result.priority).toBe('low')
      expect(result.daysElapsed).toBe(3)
      expect(result.referenceEvent).toBe('found')
    })

    it('returns medium priority at 7+ days', () => {
      const job = createMockJob({
        status: 'inbox',
        applied: null,
        found: daysAgo(10)
      })

      const result = calculateFollowupStatus(job)

      expect(result.needsFollowup).toBe(true)
      expect(result.priority).toBe('medium')
      expect(result.suggestion).toContain('stale')
    })
  })

  describe('apply-now status', () => {
    it('returns medium priority at 2 days', () => {
      const job = createMockJob({
        status: 'apply-now',
        applied: null,
        found: daysAgo(2)
      })

      const result = calculateFollowupStatus(job)

      expect(result.needsFollowup).toBe(true)
      expect(result.priority).toBe('medium')
      expect(result.suggestion).toContain('Apply soon')
    })

    it('returns high priority at 5+ days', () => {
      const job = createMockJob({
        status: 'apply-now',
        applied: null,
        found: daysAgo(7)
      })

      const result = calculateFollowupStatus(job)

      expect(result.needsFollowup).toBe(true)
      expect(result.priority).toBe('high')
      expect(result.suggestion).toContain('Apply immediately')
    })
  })

  describe('maybe status', () => {
    it('returns low priority at 7 days', () => {
      const job = createMockJob({
        status: 'maybe',
        applied: null,
        found: daysAgo(7)
      })

      const result = calculateFollowupStatus(job)

      expect(result.needsFollowup).toBe(true)
      expect(result.priority).toBe('low')
      expect(result.suggestion).toContain('still interested')
    })

    it('returns medium priority at 14+ days', () => {
      const job = createMockJob({
        status: 'maybe',
        applied: null,
        found: daysAgo(20)
      })

      const result = calculateFollowupStatus(job)

      expect(result.needsFollowup).toBe(true)
      expect(result.priority).toBe('medium')
      expect(result.suggestion).toContain('apply or archive')
    })
  })

  describe('no followup needed', () => {
    it('returns false for recently found inbox job', () => {
      const job = createMockJob({
        status: 'inbox',
        applied: null,
        found: daysAgo(1)
      })

      const result = calculateFollowupStatus(job)

      expect(result.needsFollowup).toBe(false)
    })

    it('returns false when no reference date available', () => {
      const job = createMockJob({
        status: 'applied',
        applied: null,
        found: null
      })

      const result = calculateFollowupStatus(job)

      expect(result.needsFollowup).toBe(false)
      expect(result.reason).toBe('No reference date available')
    })

    it('returns false for status without rules', () => {
      const job = createMockJob({
        status: 'archived',
        found: daysAgo(30)
      })

      const result = calculateFollowupStatus(job)

      expect(result.needsFollowup).toBe(false)
    })
  })

  describe('recent interview detection', () => {
    it('detects interview from today and suggests thank-you', () => {
      const job = createMockJob({
        status: 'applied',
        applied: daysAgo(14),
        updates: [{
          type: 'Interview',
          date: daysAgo(0),
          notes: 'Phone screen with recruiter'
        }]
      })

      const result = calculateFollowupStatus(job)

      expect(result.needsFollowup).toBe(true)
      expect(result.priority).toBe('high')
      expect(result.referenceEvent).toBe('interview')
      expect(result.suggestion).toContain('thank-you')
    })

    it('detects interview from yesterday', () => {
      const job = createMockJob({
        status: 'applied',
        applied: daysAgo(14),
        updates: [{
          type: 'Technical Interview',
          timestamp: daysAgo(1),
          notes: 'Coding session'
        }]
      })

      const result = calculateFollowupStatus(job)

      expect(result.needsFollowup).toBe(true)
      expect(result.referenceEvent).toBe('interview')
      expect(result.suggestion).toContain('thank-you')
    })

    it('ignores interviews older than 2 days', () => {
      const job = createMockJob({
        status: 'applied',
        applied: daysAgo(14),
        updates: [{
          type: 'Interview',
          date: daysAgo(5),
          notes: 'Initial call'
        }]
      })

      const result = calculateFollowupStatus(job)

      // Should fall back to applied rules at 14 days
      expect(result.referenceEvent).toBe('application')
      expect(result.priority).toBe('medium')
    })
  })

  describe('edge cases', () => {
    it('handles invalid date formats gracefully', () => {
      const job = createMockJob({
        status: 'applied',
        applied: 'not-a-date'
      })

      const result = calculateFollowupStatus(job)

      expect(result.needsFollowup).toBe(false)
    })

    it('handles missing updates array', () => {
      const job = createMockJob({
        status: 'applied',
        applied: daysAgo(14),
        updates: undefined
      })

      const result = calculateFollowupStatus(job)

      expect(result.needsFollowup).toBe(true)
    })

    it('prefers applied date over found date for applied status', () => {
      const job = createMockJob({
        status: 'applied',
        applied: daysAgo(7),
        found: daysAgo(30)
      })

      const result = calculateFollowupStatus(job)

      expect(result.daysElapsed).toBe(7)
      expect(result.referenceEvent).toBe('application')
    })

    it('uses found date when applied is not set for applied status', () => {
      const job = createMockJob({
        status: 'applied',
        applied: null,
        found: daysAgo(10)
      })

      const result = calculateFollowupStatus(job)

      expect(result.daysElapsed).toBe(10)
      expect(result.referenceEvent).toBe('found')
    })
  })
})

describe('generateFollowupSuggestion', () => {
  describe('base suggestions', () => {
    it('includes the followup status suggestion', () => {
      const job = createMockJob()
      const followupStatus = {
        needsFollowup: true,
        priority: 'medium',
        suggestion: 'Test suggestion'
      }

      const result = generateFollowupSuggestion(job, followupStatus)

      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0]).toEqual({
        type: 'action',
        text: 'Test suggestion',
        priority: 'medium'
      })
    })

    it('defaults to medium priority when not specified', () => {
      const job = createMockJob()
      const followupStatus = {
        needsFollowup: true,
        suggestion: 'Test'
      }

      const result = generateFollowupSuggestion(job, followupStatus)

      expect(result[0].priority).toBe('medium')
    })
  })

  describe('contact suggestions', () => {
    it('suggests reaching out to uncontacted primary contact', () => {
      const job = createMockJob({
        connections: [
          createMockContact({
            name: 'Sarah Hiring',
            role: 'hiring_manager',
            isPrimary: true,
            reachedOut: false
          })
        ]
      })

      const result = generateFollowupSuggestion(job, { needsFollowup: true })

      const contactSuggestion = result.find(s => s.type === 'contact')
      expect(contactSuggestion).toBeDefined()
      expect(contactSuggestion.text).toContain('Sarah Hiring')
      expect(contactSuggestion.text).toContain('hiring_manager')
      expect(contactSuggestion.priority).toBe('high')
    })

    it('does not suggest contacted primary contact', () => {
      const job = createMockJob({
        connections: [
          createMockContact({
            isPrimary: true,
            reachedOut: true
          })
        ]
      })

      const result = generateFollowupSuggestion(job, { needsFollowup: true })

      const contactSuggestion = result.find(s => s.type === 'contact')
      expect(contactSuggestion).toBeUndefined()
    })
  })

  describe('research suggestions', () => {
    it('suggests finding contacts for applied jobs without contacts', () => {
      const job = createMockJob({
        status: 'applied',
        connections: []
      })

      const result = generateFollowupSuggestion(job, { needsFollowup: true })

      const researchSuggestion = result.find(s => s.type === 'research')
      expect(researchSuggestion).toBeDefined()
      expect(researchSuggestion.text).toContain('Find a recruiter')
      expect(researchSuggestion.priority).toBe('medium')
    })

    it('does not suggest finding contacts for non-applied jobs', () => {
      const job = createMockJob({
        status: 'inbox',
        connections: []
      })

      const result = generateFollowupSuggestion(job, { needsFollowup: true })

      const researchSuggestion = result.find(s => s.type === 'research')
      expect(researchSuggestion).toBeUndefined()
    })

    it('does not suggest finding contacts when contacts exist', () => {
      const job = createMockJob({
        status: 'applied',
        connections: [createMockContact()]
      })

      const result = generateFollowupSuggestion(job, { needsFollowup: true })

      const researchSuggestion = result.find(s => s.type === 'research')
      expect(researchSuggestion).toBeUndefined()
    })
  })

  describe('stale contact suggestions', () => {
    it('suggests re-engaging with contact not reached in >14 days', () => {
      const job = createMockJob({
        connections: [
          createMockContact({
            name: 'Old Contact',
            reachedOut: true,
            lastInteraction: {
              date: daysAgo(20),
              type: 'email',
              notes: 'Initial outreach'
            }
          })
        ]
      })

      const result = generateFollowupSuggestion(job, { needsFollowup: true })

      const reconnectSuggestion = result.find(s => s.type === 'reconnect')
      expect(reconnectSuggestion).toBeDefined()
      expect(reconnectSuggestion.text).toContain('Old Contact')
      expect(reconnectSuggestion.text).toContain('20 days ago')
      expect(reconnectSuggestion.priority).toBe('low')
    })

    it('does not suggest for contact reached recently', () => {
      const job = createMockJob({
        connections: [
          createMockContact({
            reachedOut: true,
            lastInteraction: {
              date: daysAgo(5),
              type: 'email'
            }
          })
        ]
      })

      const result = generateFollowupSuggestion(job, { needsFollowup: true })

      const reconnectSuggestion = result.find(s => s.type === 'reconnect')
      expect(reconnectSuggestion).toBeUndefined()
    })

    it('does not suggest for contact never reached', () => {
      const job = createMockJob({
        connections: [
          createMockContact({
            reachedOut: false,
            lastInteraction: null
          })
        ]
      })

      const result = generateFollowupSuggestion(job, { needsFollowup: true })

      const reconnectSuggestion = result.find(s => s.type === 'reconnect')
      expect(reconnectSuggestion).toBeUndefined()
    })
  })

  describe('legacy contacts', () => {
    it('ignores string-format legacy contacts', () => {
      const job = createMockJob({
        status: 'applied',
        connections: ['John Smith (recruiter)']
      })

      // Should suggest finding contacts since legacy doesn't count
      const result = generateFollowupSuggestion(job, { needsFollowup: true })

      const researchSuggestion = result.find(s => s.type === 'research')
      expect(researchSuggestion).toBeDefined()
    })
  })
})

describe('getFollowupQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when no jobs need followup', () => {
    loadJobsFromDashboard.mockReturnValue({
      jobs: [
        createMockJob({
          status: 'applied',
          applied: daysAgo(1) // Too recent
        })
      ]
    })

    const result = getFollowupQueue()

    expect(result).toEqual([])
  })

  it('returns jobs needing followup', () => {
    loadJobsFromDashboard.mockReturnValue({
      jobs: [
        createMockJob({
          id: 1,
          title: 'Engineer',
          company: 'Acme',
          status: 'applied',
          applied: daysAgo(15)
        })
      ]
    })

    const result = getFollowupQueue()

    expect(result.length).toBe(1)
    expect(result[0]).toMatchObject({
      jobId: 1,
      title: 'Engineer',
      company: 'Acme',
      status: 'applied',
      priority: 'medium'
    })
    expect(result[0].suggestions).toBeDefined()
  })

  it('filters out archived jobs', () => {
    loadJobsFromDashboard.mockReturnValue({
      jobs: [
        createMockJob({
          id: 1,
          status: 'archived',
          found: daysAgo(30)
        })
      ]
    })

    const result = getFollowupQueue()

    expect(result).toEqual([])
  })

  it('filters out probably-not jobs', () => {
    loadJobsFromDashboard.mockReturnValue({
      jobs: [
        createMockJob({
          id: 1,
          status: 'probably-not',
          found: daysAgo(30)
        })
      ]
    })

    const result = getFollowupQueue()

    expect(result).toEqual([])
  })

  it('sorts by priority (high > medium > low)', () => {
    loadJobsFromDashboard.mockReturnValue({
      jobs: [
        createMockJob({
          id: 1,
          title: 'Low Job',
          status: 'applied',
          applied: daysAgo(8) // low priority
        }),
        createMockJob({
          id: 2,
          title: 'High Job',
          status: 'applied',
          applied: daysAgo(25) // high priority
        }),
        createMockJob({
          id: 3,
          title: 'Medium Job',
          status: 'applied',
          applied: daysAgo(15) // medium priority
        })
      ]
    })

    const result = getFollowupQueue()

    expect(result[0].title).toBe('High Job')
    expect(result[1].title).toBe('Medium Job')
    expect(result[2].title).toBe('Low Job')
  })

  it('sorts by daysElapsed within same priority', () => {
    loadJobsFromDashboard.mockReturnValue({
      jobs: [
        createMockJob({
          id: 1,
          title: 'Older',
          status: 'applied',
          applied: daysAgo(18) // medium, 18 days
        }),
        createMockJob({
          id: 2,
          title: 'Newer',
          status: 'applied',
          applied: daysAgo(15) // medium, 15 days
        })
      ]
    })

    const result = getFollowupQueue()

    expect(result[0].title).toBe('Older')
    expect(result[0].daysElapsed).toBe(18)
    expect(result[1].title).toBe('Newer')
    expect(result[1].daysElapsed).toBe(15)
  })

  it('respects limit parameter', () => {
    loadJobsFromDashboard.mockReturnValue({
      jobs: [
        createMockJob({ id: 1, status: 'applied', applied: daysAgo(15) }),
        createMockJob({ id: 2, status: 'applied', applied: daysAgo(16) }),
        createMockJob({ id: 3, status: 'applied', applied: daysAgo(17) }),
        createMockJob({ id: 4, status: 'applied', applied: daysAgo(18) }),
        createMockJob({ id: 5, status: 'applied', applied: daysAgo(19) })
      ]
    })

    const result = getFollowupQueue({ limit: 3 })

    expect(result.length).toBe(3)
  })

  it('defaults to limit of 10', () => {
    const jobs = Array.from({ length: 15 }, (_, i) =>
      createMockJob({
        id: i + 1,
        status: 'applied',
        applied: daysAgo(14 + i)
      })
    )

    loadJobsFromDashboard.mockReturnValue({ jobs })

    const result = getFollowupQueue()

    expect(result.length).toBe(10)
  })

  it('includes suggestions for each job in queue', () => {
    loadJobsFromDashboard.mockReturnValue({
      jobs: [
        createMockJob({
          id: 1,
          status: 'applied',
          applied: daysAgo(15),
          connections: []
        })
      ]
    })

    const result = getFollowupQueue()

    expect(result[0].suggestions).toBeDefined()
    expect(Array.isArray(result[0].suggestions)).toBe(true)
    // Should have action suggestion and research suggestion (no contacts)
    expect(result[0].suggestions.length).toBeGreaterThanOrEqual(2)
  })

  it('handles empty jobs array', () => {
    loadJobsFromDashboard.mockReturnValue({ jobs: [] })

    const result = getFollowupQueue()

    expect(result).toEqual([])
  })

  it('handles missing jobs property', () => {
    loadJobsFromDashboard.mockReturnValue({})

    const result = getFollowupQueue()

    expect(result).toEqual([])
  })
})
