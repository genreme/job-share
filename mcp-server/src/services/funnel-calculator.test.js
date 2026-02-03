/**
 * Funnel Calculator Service Tests
 *
 * Tests Sankey diagram data generation from job arrays.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateFunnelMetrics,
  calculateFlows,
  getStatusDisplayName,
  STATUS_DISPLAY_NAMES
} from './funnel-calculator.js'

// =============================================================================
// TEST FIXTURES
// =============================================================================

const NOW = new Date('2026-02-03T10:00:00.000Z')

// Helper to create dates relative to NOW
const daysAgo = (days) => {
  const date = new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)
  return date.toISOString().split('T')[0] // Return YYYY-MM-DD
}

/**
 * Create a mock job for testing
 */
function createJob(overrides = {}) {
  return {
    id: overrides.id || 1,
    title: overrides.title || 'Software Engineer',
    company: overrides.company || 'Tech Corp',
    status: overrides.status || 'inbox',
    found: overrides.found || daysAgo(7),
    applied: overrides.applied || null,
    fitScore: overrides.fitScore || 75,
    updates: overrides.updates || [],
    ...overrides
  }
}

// =============================================================================
// calculateFunnelMetrics TESTS
// =============================================================================

describe('calculateFunnelMetrics', () => {
  describe('empty and null handling', () => {
    it('returns empty structure for null jobs', () => {
      const result = calculateFunnelMetrics(null)

      expect(result).toEqual({
        nodes: [],
        links: [],
        totalJobs: 0,
        dateRange: null
      })
    })

    it('returns empty structure for undefined jobs', () => {
      const result = calculateFunnelMetrics(undefined)

      expect(result).toEqual({
        nodes: [],
        links: [],
        totalJobs: 0,
        dateRange: null
      })
    })

    it('returns empty structure for empty array', () => {
      const result = calculateFunnelMetrics([])

      expect(result).toEqual({
        nodes: [],
        links: [],
        totalJobs: 0,
        dateRange: null
      })
    })
  })

  describe('single job scenarios', () => {
    it('creates single node for job in inbox', () => {
      const jobs = [createJob({ status: 'inbox' })]
      const result = calculateFunnelMetrics(jobs)

      expect(result.totalJobs).toBe(1)
      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0]).toEqual({
        id: 'inbox',
        name: 'Inbox',
        value: 1
      })
      // No transitions for jobs still in inbox
      expect(result.links).toHaveLength(0)
    })

    it('creates node for current status and flow from source', () => {
      const jobs = [createJob({ status: 'apply-now' })]
      const result = calculateFunnelMetrics(jobs)

      expect(result.totalJobs).toBe(1)
      // Nodes represent current state counts (where jobs ARE now)
      // Job is in apply-now, so that's the only node
      const nodeIds = result.nodes.map(n => n.id)
      expect(nodeIds).toContain('apply-now')
      expect(result.nodes.find(n => n.id === 'apply-now')?.value).toBe(1)

      // Should have transition from inbox to apply-now
      // (flow shows where they came FROM, even if no jobs remain there)
      expect(result.links).toHaveLength(1)
      expect(result.links[0]).toMatchObject({
        source: 'inbox',
        target: 'apply-now',
        value: 1
      })
    })

    it('creates applied node for job with applied date', () => {
      const jobs = [createJob({
        status: 'applied',
        applied: daysAgo(3)
      })]
      const result = calculateFunnelMetrics(jobs)

      expect(result.totalJobs).toBe(1)
      const nodeIds = result.nodes.map(n => n.id)
      expect(nodeIds).toContain('applied')
    })
  })

  describe('multiple jobs aggregation', () => {
    it('counts jobs by status correctly', () => {
      const jobs = [
        createJob({ id: 1, status: 'inbox' }),
        createJob({ id: 2, status: 'inbox' }),
        createJob({ id: 3, status: 'apply-now' }),
        createJob({ id: 4, status: 'applied', applied: daysAgo(2) }),
        createJob({ id: 5, status: 'applied', applied: daysAgo(1) }),
        createJob({ id: 6, status: 'applied', applied: daysAgo(3) })
      ]
      const result = calculateFunnelMetrics(jobs)

      expect(result.totalJobs).toBe(6)

      // Check node counts
      const inboxNode = result.nodes.find(n => n.id === 'inbox')
      const applyNowNode = result.nodes.find(n => n.id === 'apply-now')
      const appliedNode = result.nodes.find(n => n.id === 'applied')

      expect(inboxNode?.value).toBe(2)
      expect(applyNowNode?.value).toBe(1)
      expect(appliedNode?.value).toBe(3)
    })

    it('aggregates flow counts', () => {
      const jobs = [
        createJob({ id: 1, status: 'apply-now' }),
        createJob({ id: 2, status: 'apply-now' }),
        createJob({ id: 3, status: 'maybe' })
      ]
      const result = calculateFunnelMetrics(jobs)

      // Should have flow from inbox->apply-now with value 2
      const applyNowFlow = result.links.find(l =>
        l.source === 'inbox' && l.target === 'apply-now'
      )
      expect(applyNowFlow?.value).toBe(2)

      // Should have flow from inbox->maybe with value 1
      const maybeFlow = result.links.find(l =>
        l.source === 'inbox' && l.target === 'maybe'
      )
      expect(maybeFlow?.value).toBe(1)
    })
  })

  describe('date range filtering', () => {
    it('filters jobs within date range', () => {
      const jobs = [
        createJob({ id: 1, found: '2026-01-15', status: 'inbox' }),
        createJob({ id: 2, found: '2026-01-20', status: 'apply-now' }),
        createJob({ id: 3, found: '2026-02-01', status: 'applied', applied: '2026-02-02' })
      ]

      const dateRange = {
        start: new Date('2026-01-10'),
        end: new Date('2026-01-25')
      }

      const result = calculateFunnelMetrics(jobs, dateRange)

      // Only jobs 1 and 2 are within range
      expect(result.totalJobs).toBe(2)
      expect(result.dateRange).toEqual(dateRange)
    })

    it('excludes jobs outside date range', () => {
      const jobs = [
        createJob({ id: 1, found: '2026-01-01', status: 'inbox' }),
        createJob({ id: 2, found: '2026-01-05', status: 'inbox' })
      ]

      const dateRange = {
        start: new Date('2026-02-01'),
        end: new Date('2026-02-28')
      }

      const result = calculateFunnelMetrics(jobs, dateRange)

      expect(result.totalJobs).toBe(0)
      expect(result.nodes).toHaveLength(0)
    })

    it('excludes jobs with null found dates when date filtering', () => {
      const jobs = [
        createJob({ id: 1, found: null, status: 'apply-now' }),
        createJob({ id: 2, found: '2026-01-15', status: 'inbox' })
      ]

      const dateRange = {
        start: new Date('2026-01-01'),
        end: new Date('2026-01-31')
      }

      const result = calculateFunnelMetrics(jobs, dateRange)

      // Only job 2 should be included
      expect(result.totalJobs).toBe(1)
    })

    it('includes all jobs when no date range provided', () => {
      const jobs = [
        createJob({ id: 1, found: null, status: 'inbox' }),
        createJob({ id: 2, found: '2026-01-15', status: 'apply-now' })
      ]

      const result = calculateFunnelMetrics(jobs)

      expect(result.totalJobs).toBe(2)
      expect(result.dateRange).toBeNull()
    })
  })

  describe('derived stages from updates', () => {
    it('derives interviewing stage from interview keyword in updates', () => {
      const jobs = [createJob({
        status: 'applied',
        applied: daysAgo(10),
        updates: [
          { date: daysAgo(5), notes: 'Phone screen scheduled for next week' }
        ]
      })]

      const result = calculateFunnelMetrics(jobs)

      const interviewingNode = result.nodes.find(n => n.id === 'interviewing')
      expect(interviewingNode).toBeDefined()
      expect(interviewingNode?.value).toBe(1)
    })

    it('derives offer stage from offer keyword in updates', () => {
      const jobs = [createJob({
        status: 'applied',
        applied: daysAgo(20),
        updates: [
          { date: daysAgo(10), notes: 'Had final interview' },
          { date: daysAgo(2), notes: 'Received offer! Negotiating compensation package.' }
        ]
      })]

      const result = calculateFunnelMetrics(jobs)

      const offerNode = result.nodes.find(n => n.id === 'offer')
      expect(offerNode).toBeDefined()
      expect(offerNode?.value).toBe(1)
    })

    it('detects interview from update type field', () => {
      const jobs = [createJob({
        status: 'applied',
        updates: [
          { date: daysAgo(3), type: 'interview' }
        ]
      })]

      const result = calculateFunnelMetrics(jobs)

      const interviewingNode = result.nodes.find(n => n.id === 'interviewing')
      expect(interviewingNode).toBeDefined()
    })

    it('detects interview from update text field', () => {
      const jobs = [createJob({
        status: 'applied',
        updates: [
          { date: daysAgo(3), text: 'Technical assessment completed' }
        ]
      })]

      const result = calculateFunnelMetrics(jobs)

      const interviewingNode = result.nodes.find(n => n.id === 'interviewing')
      expect(interviewingNode).toBeDefined()
    })
  })
})

// =============================================================================
// calculateFlows TESTS
// =============================================================================

describe('calculateFlows', () => {
  describe('empty and null handling', () => {
    it('returns empty array for null jobs', () => {
      expect(calculateFlows(null)).toEqual([])
    })

    it('returns empty array for empty array', () => {
      expect(calculateFlows([])).toEqual([])
    })
  })

  describe('basic transitions', () => {
    it('creates no flow for job in inbox (no transition yet)', () => {
      const jobs = [createJob({ status: 'inbox' })]
      const flows = calculateFlows(jobs)

      expect(flows).toHaveLength(0)
    })

    it('creates inbox to apply-now flow', () => {
      const jobs = [createJob({ status: 'apply-now' })]
      const flows = calculateFlows(jobs)

      expect(flows).toHaveLength(1)
      expect(flows[0]).toMatchObject({
        source: 'inbox',
        target: 'apply-now'
      })
    })

    it('creates inbox to maybe flow', () => {
      const jobs = [createJob({ status: 'maybe' })]
      const flows = calculateFlows(jobs)

      expect(flows).toContainEqual({
        source: 'inbox',
        target: 'maybe',
        value: 1
      })
    })

    it('creates inbox to probably-not flow', () => {
      const jobs = [createJob({ status: 'probably-not' })]
      const flows = calculateFlows(jobs)

      expect(flows).toContainEqual({
        source: 'inbox',
        target: 'probably-not',
        value: 1
      })
    })

    it('creates inbox to archived flow', () => {
      const jobs = [createJob({ status: 'archived' })]
      const flows = calculateFlows(jobs)

      expect(flows).toContainEqual({
        source: 'inbox',
        target: 'archived',
        value: 1
      })
    })
  })

  describe('complex transitions', () => {
    it('derives transitions through apply-now to applied', () => {
      const jobs = [createJob({
        status: 'applied',
        applied: daysAgo(3),
        updates: [
          { date: daysAgo(7), notes: 'Moved to apply-now' }
        ]
      })]
      const flows = calculateFlows(jobs)

      // Should have flow to applied
      const appliedFlow = flows.find(f => f.target === 'applied')
      expect(appliedFlow).toBeDefined()
    })

    it('aggregates multiple jobs with same transition', () => {
      const jobs = [
        createJob({ id: 1, status: 'apply-now' }),
        createJob({ id: 2, status: 'apply-now' }),
        createJob({ id: 3, status: 'apply-now' })
      ]
      const flows = calculateFlows(jobs)

      const applyNowFlow = flows.find(f =>
        f.source === 'inbox' && f.target === 'apply-now'
      )
      expect(applyNowFlow?.value).toBe(3)
    })

    it('sorts flows by value descending', () => {
      const jobs = [
        createJob({ id: 1, status: 'apply-now' }),
        createJob({ id: 2, status: 'apply-now' }),
        createJob({ id: 3, status: 'maybe' })
      ]
      const flows = calculateFlows(jobs)

      // apply-now flow (value 2) should come before maybe flow (value 1)
      expect(flows[0].value).toBeGreaterThanOrEqual(flows[flows.length - 1].value)
    })
  })

  describe('jobs with updates derive proper flows', () => {
    it('creates flow to interviewing from updates', () => {
      const jobs = [createJob({
        status: 'applied',
        applied: daysAgo(10),
        updates: [
          { date: daysAgo(5), notes: 'Had phone screen with recruiter' }
        ]
      })]
      const flows = calculateFlows(jobs)

      // Should have flow to interviewing
      const interviewFlow = flows.find(f => f.target === 'interviewing')
      expect(interviewFlow).toBeDefined()
    })

    it('creates flow to offer from updates', () => {
      const jobs = [createJob({
        status: 'applied',
        applied: daysAgo(20),
        updates: [
          { date: daysAgo(10), notes: 'Final round interview' },
          { date: daysAgo(2), notes: 'Offer received!' }
        ]
      })]
      const flows = calculateFlows(jobs)

      // Should have flow to offer
      const offerFlow = flows.find(f => f.target === 'offer')
      expect(offerFlow).toBeDefined()
    })
  })

  describe('jobs without history flow directly to current status', () => {
    it('jobs without updates flow from inbox to current status', () => {
      const jobs = [createJob({
        status: 'archived',
        updates: [] // No history
      })]
      const flows = calculateFlows(jobs)

      expect(flows).toContainEqual({
        source: 'inbox',
        target: 'archived',
        value: 1
      })
    })
  })
})

// =============================================================================
// getStatusDisplayName TESTS
// =============================================================================

describe('getStatusDisplayName', () => {
  it('returns correct display name for inbox', () => {
    expect(getStatusDisplayName('inbox')).toBe('Inbox')
  })

  it('returns correct display name for apply-now', () => {
    expect(getStatusDisplayName('apply-now')).toBe('Apply Now')
  })

  it('returns correct display name for maybe', () => {
    expect(getStatusDisplayName('maybe')).toBe('Maybe')
  })

  it('returns correct display name for probably-not', () => {
    expect(getStatusDisplayName('probably-not')).toBe('Probably Not')
  })

  it('returns correct display name for applied', () => {
    expect(getStatusDisplayName('applied')).toBe('Applied')
  })

  it('returns correct display name for archived', () => {
    expect(getStatusDisplayName('archived')).toBe('Archived')
  })

  it('returns correct display name for derived interviewing stage', () => {
    expect(getStatusDisplayName('interviewing')).toBe('Interviewing')
  })

  it('returns correct display name for derived offer stage', () => {
    expect(getStatusDisplayName('offer')).toBe('Offer')
  })

  it('returns status as-is for unknown status', () => {
    expect(getStatusDisplayName('unknown-status')).toBe('unknown-status')
  })
})

// =============================================================================
// STATUS_DISPLAY_NAMES CONSTANT TESTS
// =============================================================================

describe('STATUS_DISPLAY_NAMES', () => {
  it('contains all schema statuses', () => {
    expect(STATUS_DISPLAY_NAMES).toHaveProperty('inbox')
    expect(STATUS_DISPLAY_NAMES).toHaveProperty('apply-now')
    expect(STATUS_DISPLAY_NAMES).toHaveProperty('maybe')
    expect(STATUS_DISPLAY_NAMES).toHaveProperty('probably-not')
    expect(STATUS_DISPLAY_NAMES).toHaveProperty('applied')
    expect(STATUS_DISPLAY_NAMES).toHaveProperty('archived')
  })

  it('contains derived statuses', () => {
    expect(STATUS_DISPLAY_NAMES).toHaveProperty('interviewing')
    expect(STATUS_DISPLAY_NAMES).toHaveProperty('offer')
  })
})
