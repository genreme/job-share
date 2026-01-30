/**
 * Workflow Schema Tests
 *
 * Tests status transition validation for the job workflow.
 */

import { describe, it, expect } from 'vitest'
import {
  VALID_TRANSITIONS,
  VALID_STATUSES,
  isValidTransition,
  getValidNextStatuses,
  validateStatusTransition
} from './workflow.js'

describe('VALID_TRANSITIONS', () => {
  it('defines all expected statuses', () => {
    expect(VALID_STATUSES).toContain('apply-now')
    expect(VALID_STATUSES).toContain('maybe')
    expect(VALID_STATUSES).toContain('probably-not')
    expect(VALID_STATUSES).toContain('applied')
    expect(VALID_STATUSES).toContain('archived')
    expect(VALID_STATUSES).toHaveLength(5)
  })

  it('defines apply-now transitions', () => {
    expect(VALID_TRANSITIONS['apply-now']).toContain('maybe')
    expect(VALID_TRANSITIONS['apply-now']).toContain('probably-not')
    expect(VALID_TRANSITIONS['apply-now']).toContain('applied')
    expect(VALID_TRANSITIONS['apply-now']).toContain('archived')
  })

  it('defines maybe transitions', () => {
    expect(VALID_TRANSITIONS['maybe']).toContain('apply-now')
    expect(VALID_TRANSITIONS['maybe']).toContain('probably-not')
    expect(VALID_TRANSITIONS['maybe']).toContain('applied')
    expect(VALID_TRANSITIONS['maybe']).toContain('archived')
  })

  it('defines probably-not transitions', () => {
    expect(VALID_TRANSITIONS['probably-not']).toContain('maybe')
    expect(VALID_TRANSITIONS['probably-not']).toContain('apply-now')
    expect(VALID_TRANSITIONS['probably-not']).toContain('archived')
    expect(VALID_TRANSITIONS['probably-not']).not.toContain('applied')
  })

  it('defines applied as near-terminal (only to archived)', () => {
    expect(VALID_TRANSITIONS['applied']).toEqual(['archived'])
  })

  it('defines archived as terminal (no transitions)', () => {
    expect(VALID_TRANSITIONS['archived']).toEqual([])
  })
})

describe('isValidTransition', () => {
  describe('valid transitions', () => {
    it('allows apply-now to applied', () => {
      expect(isValidTransition('apply-now', 'applied')).toBe(true)
    })

    it('allows apply-now to maybe', () => {
      expect(isValidTransition('apply-now', 'maybe')).toBe(true)
    })

    it('allows apply-now to probably-not', () => {
      expect(isValidTransition('apply-now', 'probably-not')).toBe(true)
    })

    it('allows apply-now to archived', () => {
      expect(isValidTransition('apply-now', 'archived')).toBe(true)
    })

    it('allows maybe to apply-now (promotion)', () => {
      expect(isValidTransition('maybe', 'apply-now')).toBe(true)
    })

    it('allows maybe to applied', () => {
      expect(isValidTransition('maybe', 'applied')).toBe(true)
    })

    it('allows maybe to probably-not (demotion)', () => {
      expect(isValidTransition('maybe', 'probably-not')).toBe(true)
    })

    it('allows probably-not to maybe (reconsideration)', () => {
      expect(isValidTransition('probably-not', 'maybe')).toBe(true)
    })

    it('allows probably-not to apply-now (major promotion)', () => {
      expect(isValidTransition('probably-not', 'apply-now')).toBe(true)
    })

    it('allows applied to archived', () => {
      expect(isValidTransition('applied', 'archived')).toBe(true)
    })
  })

  describe('invalid transitions', () => {
    it('blocks archived to any other state', () => {
      expect(isValidTransition('archived', 'apply-now')).toBe(false)
      expect(isValidTransition('archived', 'maybe')).toBe(false)
      expect(isValidTransition('archived', 'probably-not')).toBe(false)
      expect(isValidTransition('archived', 'applied')).toBe(false)
    })

    it('blocks applied to non-archived states', () => {
      expect(isValidTransition('applied', 'apply-now')).toBe(false)
      expect(isValidTransition('applied', 'maybe')).toBe(false)
      expect(isValidTransition('applied', 'probably-not')).toBe(false)
    })

    it('blocks probably-not to applied (must go through apply-now)', () => {
      expect(isValidTransition('probably-not', 'applied')).toBe(false)
    })

    it('blocks self-transitions', () => {
      expect(isValidTransition('apply-now', 'apply-now')).toBe(false)
      expect(isValidTransition('maybe', 'maybe')).toBe(false)
      expect(isValidTransition('probably-not', 'probably-not')).toBe(false)
      expect(isValidTransition('applied', 'applied')).toBe(false)
      expect(isValidTransition('archived', 'archived')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('handles unknown fromStatus gracefully', () => {
      expect(isValidTransition('unknown', 'applied')).toBe(false)
      expect(isValidTransition('pending', 'maybe')).toBe(false)
    })

    it('handles unknown toStatus gracefully', () => {
      expect(isValidTransition('apply-now', 'unknown')).toBe(false)
      expect(isValidTransition('maybe', 'pending')).toBe(false)
    })

    it('handles null inputs gracefully', () => {
      expect(isValidTransition(null, 'applied')).toBe(false)
      expect(isValidTransition('apply-now', null)).toBe(false)
      expect(isValidTransition(null, null)).toBe(false)
    })

    it('handles undefined inputs gracefully', () => {
      expect(isValidTransition(undefined, 'applied')).toBe(false)
      expect(isValidTransition('apply-now', undefined)).toBe(false)
      expect(isValidTransition(undefined, undefined)).toBe(false)
    })

    it('handles empty string inputs', () => {
      expect(isValidTransition('', 'applied')).toBe(false)
      expect(isValidTransition('apply-now', '')).toBe(false)
    })
  })
})

describe('getValidNextStatuses', () => {
  it('returns valid next statuses for apply-now', () => {
    const nextStatuses = getValidNextStatuses('apply-now')
    expect(nextStatuses).toContain('maybe')
    expect(nextStatuses).toContain('probably-not')
    expect(nextStatuses).toContain('applied')
    expect(nextStatuses).toContain('archived')
    expect(nextStatuses).toHaveLength(4)
  })

  it('returns valid next statuses for maybe', () => {
    const nextStatuses = getValidNextStatuses('maybe')
    expect(nextStatuses).toHaveLength(4)
  })

  it('returns valid next statuses for probably-not', () => {
    const nextStatuses = getValidNextStatuses('probably-not')
    expect(nextStatuses).toHaveLength(3)
    expect(nextStatuses).not.toContain('applied')
  })

  it('returns only archived for applied', () => {
    const nextStatuses = getValidNextStatuses('applied')
    expect(nextStatuses).toEqual(['archived'])
  })

  it('returns empty array for archived (terminal)', () => {
    const nextStatuses = getValidNextStatuses('archived')
    expect(nextStatuses).toEqual([])
  })

  it('returns empty array for unknown status', () => {
    expect(getValidNextStatuses('unknown')).toEqual([])
  })

  it('returns empty array for null/undefined', () => {
    expect(getValidNextStatuses(null)).toEqual([])
    expect(getValidNextStatuses(undefined)).toEqual([])
  })

  it('returns a copy, not the original array', () => {
    const nextStatuses = getValidNextStatuses('apply-now')
    nextStatuses.push('fake-status')

    // Original should not be modified
    expect(VALID_TRANSITIONS['apply-now']).not.toContain('fake-status')
  })
})

describe('validateStatusTransition', () => {
  describe('valid transitions', () => {
    it('returns valid: true for allowed transitions', () => {
      const result = validateStatusTransition('apply-now', 'applied')
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('returns valid: true for maybe to apply-now', () => {
      const result = validateStatusTransition('maybe', 'apply-now')
      expect(result.valid).toBe(true)
    })
  })

  describe('invalid transitions with descriptive errors', () => {
    it('returns error for self-transition', () => {
      const result = validateStatusTransition('apply-now', 'apply-now')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Cannot transition to same status')
    })

    it('returns error for terminal state transition', () => {
      const result = validateStatusTransition('archived', 'apply-now')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('terminal')
    })

    it('returns error for applied to non-archived', () => {
      const result = validateStatusTransition('applied', 'maybe')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Cannot transition from "applied"')
      expect(result.error).toContain('archived')
    })

    it('returns error with valid options for blocked transition', () => {
      const result = validateStatusTransition('probably-not', 'applied')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Valid transitions')
      expect(result.error).toContain('maybe')
      expect(result.error).toContain('apply-now')
      expect(result.error).toContain('archived')
    })

    it('returns error for unknown fromStatus', () => {
      const result = validateStatusTransition('unknown', 'applied')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Unknown current status')
      expect(result.error).toContain('unknown')
    })

    it('returns error for unknown toStatus', () => {
      const result = validateStatusTransition('apply-now', 'unknown')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Unknown target status')
      expect(result.error).toContain('unknown')
    })

    it('returns error for null fromStatus', () => {
      const result = validateStatusTransition(null, 'applied')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Current status is required')
    })

    it('returns error for null toStatus', () => {
      const result = validateStatusTransition('apply-now', null)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Target status is required')
    })

    it('returns error for undefined inputs', () => {
      const result1 = validateStatusTransition(undefined, 'applied')
      expect(result1.valid).toBe(false)

      const result2 = validateStatusTransition('apply-now', undefined)
      expect(result2.valid).toBe(false)
    })
  })
})
