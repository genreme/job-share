/**
 * Learning Schema Tests
 *
 * Tests Zod validation for cleanup findings and results.
 */

import { describe, it, expect } from 'vitest'
import {
  CleanupFindingSchema,
  CleanupResultSchema,
  DismissedFindingSchema,
  StoredCleanupFindingsSchema,
  validateCleanupFinding,
  validateCleanupResult
} from './learning.schema.js'

// =============================================================================
// TEST FIXTURES
// =============================================================================

const validDuplicateFinding = {
  type: 'duplicate',
  entityType: 'skill',
  ids: ['uuid-1', 'uuid-2'],
  similarity: 92,
  reason: "'React' and 'ReactJS' are 92% similar",
  suggestion: 'Consider merging these skills into one entry',
  createdAt: '2026-01-30T10:00:00.000Z'
}

const validStaleFinding = {
  type: 'stale',
  entityType: 'experience',
  ids: ['uuid-3'],
  reason: 'Not updated in 200 days and not used in documents for 95 days',
  suggestion: 'Review and update or remove if no longer relevant',
  createdAt: '2026-01-30T10:00:00.000Z'
}

const validGapFinding = {
  type: 'gap',
  entityType: 'skill',
  ids: ['uuid-4'],
  reason: 'Skill "Python" has only 1 evidence link - makes claims harder to verify',
  suggestion: 'Add more project references to strengthen this skill claim',
  relevantTo: 'Senior Software Engineer at Tech Corp',
  createdAt: '2026-01-30T10:00:00.000Z'
}

const validCleanupResult = {
  runAt: '2026-01-30T10:00:00.000Z',
  duplicates: [validDuplicateFinding],
  stale: [validStaleFinding],
  gaps: [validGapFinding],
  status: 'complete'
}

// =============================================================================
// CLEANUP FINDING SCHEMA TESTS
// =============================================================================

describe('CleanupFindingSchema', () => {
  describe('valid findings', () => {
    it('validates duplicate finding with similarity', () => {
      const result = CleanupFindingSchema.safeParse(validDuplicateFinding)
      expect(result.success).toBe(true)
      expect(result.data.similarity).toBe(92)
    })

    it('validates stale finding without similarity', () => {
      const result = CleanupFindingSchema.safeParse(validStaleFinding)
      expect(result.success).toBe(true)
      expect(result.data.similarity).toBeUndefined()
    })

    it('validates gap finding with relevantTo', () => {
      const result = CleanupFindingSchema.safeParse(validGapFinding)
      expect(result.success).toBe(true)
      expect(result.data.relevantTo).toBe('Senior Software Engineer at Tech Corp')
    })

    it('validates finding without optional fields', () => {
      const minimal = {
        type: 'stale',
        entityType: 'story',
        ids: ['uuid-5'],
        reason: 'Story not updated in 180 days',
        suggestion: 'Review and update',
        createdAt: '2026-01-30T10:00:00.000Z'
      }
      const result = CleanupFindingSchema.safeParse(minimal)
      expect(result.success).toBe(true)
    })
  })

  describe('type enum validation', () => {
    it('accepts valid types', () => {
      const types = ['duplicate', 'stale', 'gap']
      types.forEach((type) => {
        const finding = { ...validStaleFinding, type }
        const result = CleanupFindingSchema.safeParse(finding)
        expect(result.success).toBe(true)
      })
    })

    it('rejects invalid type', () => {
      const finding = { ...validStaleFinding, type: 'invalid' }
      const result = CleanupFindingSchema.safeParse(finding)
      expect(result.success).toBe(false)
    })
  })

  describe('entityType enum validation', () => {
    it('accepts valid entity types', () => {
      const entityTypes = ['skill', 'story', 'experience', 'summary']
      entityTypes.forEach((entityType) => {
        const finding = { ...validStaleFinding, entityType }
        const result = CleanupFindingSchema.safeParse(finding)
        expect(result.success).toBe(true)
      })
    })

    it('rejects invalid entity type', () => {
      const finding = { ...validStaleFinding, entityType: 'invalid' }
      const result = CleanupFindingSchema.safeParse(finding)
      expect(result.success).toBe(false)
    })
  })

  describe('similarity validation', () => {
    it('accepts similarity at 0', () => {
      const finding = { ...validDuplicateFinding, similarity: 0 }
      const result = CleanupFindingSchema.safeParse(finding)
      expect(result.success).toBe(true)
    })

    it('accepts similarity at 100', () => {
      const finding = { ...validDuplicateFinding, similarity: 100 }
      const result = CleanupFindingSchema.safeParse(finding)
      expect(result.success).toBe(true)
    })

    it('rejects similarity below 0', () => {
      const finding = { ...validDuplicateFinding, similarity: -1 }
      const result = CleanupFindingSchema.safeParse(finding)
      expect(result.success).toBe(false)
    })

    it('rejects similarity above 100', () => {
      const finding = { ...validDuplicateFinding, similarity: 101 }
      const result = CleanupFindingSchema.safeParse(finding)
      expect(result.success).toBe(false)
    })
  })

  describe('ids array validation', () => {
    it('requires at least one id', () => {
      const finding = { ...validStaleFinding, ids: [] }
      const result = CleanupFindingSchema.safeParse(finding)
      expect(result.success).toBe(false)
    })

    it('accepts multiple ids', () => {
      const finding = { ...validDuplicateFinding, ids: ['id1', 'id2', 'id3'] }
      const result = CleanupFindingSchema.safeParse(finding)
      expect(result.success).toBe(true)
      expect(result.data.ids).toHaveLength(3)
    })
  })

  describe('required string fields', () => {
    it('requires non-empty reason', () => {
      const finding = { ...validStaleFinding, reason: '' }
      const result = CleanupFindingSchema.safeParse(finding)
      expect(result.success).toBe(false)
    })

    it('requires non-empty suggestion', () => {
      const finding = { ...validStaleFinding, suggestion: '' }
      const result = CleanupFindingSchema.safeParse(finding)
      expect(result.success).toBe(false)
    })

    it('requires createdAt', () => {
      const { createdAt, ...finding } = validStaleFinding
      const result = CleanupFindingSchema.safeParse(finding)
      expect(result.success).toBe(false)
    })
  })
})

// =============================================================================
// CLEANUP RESULT SCHEMA TESTS
// =============================================================================

describe('CleanupResultSchema', () => {
  describe('valid results', () => {
    it('validates complete result with all finding types', () => {
      const result = CleanupResultSchema.safeParse(validCleanupResult)
      expect(result.success).toBe(true)
      expect(result.data.duplicates).toHaveLength(1)
      expect(result.data.stale).toHaveLength(1)
      expect(result.data.gaps).toHaveLength(1)
    })

    it('validates result with empty arrays', () => {
      const emptyResult = {
        runAt: '2026-01-30T10:00:00.000Z',
        duplicates: [],
        stale: [],
        gaps: [],
        status: 'complete'
      }
      const result = CleanupResultSchema.safeParse(emptyResult)
      expect(result.success).toBe(true)
    })

    it('applies default empty arrays when missing', () => {
      const minimalResult = {
        runAt: '2026-01-30T10:00:00.000Z',
        status: 'complete'
      }
      const result = CleanupResultSchema.safeParse(minimalResult)
      expect(result.success).toBe(true)
      expect(result.data.duplicates).toEqual([])
      expect(result.data.stale).toEqual([])
      expect(result.data.gaps).toEqual([])
    })
  })

  describe('status enum validation', () => {
    it('accepts valid statuses', () => {
      const statuses = ['complete', 'partial', 'error']
      statuses.forEach((status) => {
        const cleanupResult = { ...validCleanupResult, status }
        const result = CleanupResultSchema.safeParse(cleanupResult)
        expect(result.success).toBe(true)
      })
    })

    it('rejects invalid status', () => {
      const cleanupResult = { ...validCleanupResult, status: 'invalid' }
      const result = CleanupResultSchema.safeParse(cleanupResult)
      expect(result.success).toBe(false)
    })
  })

  describe('nested finding validation', () => {
    it('validates nested findings', () => {
      const result = CleanupResultSchema.safeParse(validCleanupResult)
      expect(result.success).toBe(true)
      expect(result.data.duplicates[0].type).toBe('duplicate')
      expect(result.data.stale[0].type).toBe('stale')
      expect(result.data.gaps[0].type).toBe('gap')
    })

    it('rejects invalid nested finding', () => {
      const invalidResult = {
        ...validCleanupResult,
        duplicates: [{ type: 'invalid' }]
      }
      const result = CleanupResultSchema.safeParse(invalidResult)
      expect(result.success).toBe(false)
    })
  })
})

// =============================================================================
// DISMISSED FINDING SCHEMA TESTS
// =============================================================================

describe('DismissedFindingSchema', () => {
  it('validates dismissed finding with reason', () => {
    const dismissed = {
      findingHash: 'abc123',
      dismissedAt: '2026-01-30T10:00:00.000Z',
      reason: 'These are intentionally different skills'
    }
    const result = DismissedFindingSchema.safeParse(dismissed)
    expect(result.success).toBe(true)
  })

  it('validates dismissed finding without reason', () => {
    const dismissed = {
      findingHash: 'abc123',
      dismissedAt: '2026-01-30T10:00:00.000Z'
    }
    const result = DismissedFindingSchema.safeParse(dismissed)
    expect(result.success).toBe(true)
  })

  it('requires findingHash', () => {
    const dismissed = {
      dismissedAt: '2026-01-30T10:00:00.000Z'
    }
    const result = DismissedFindingSchema.safeParse(dismissed)
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// STORED CLEANUP FINDINGS SCHEMA TESTS
// =============================================================================

describe('StoredCleanupFindingsSchema', () => {
  it('validates stored findings', () => {
    const stored = {
      lastRun: '2026-01-30T10:00:00.000Z',
      runs: [validCleanupResult],
      dismissed: []
    }
    const result = StoredCleanupFindingsSchema.safeParse(stored)
    expect(result.success).toBe(true)
  })

  it('enforces max 4 runs', () => {
    const stored = {
      lastRun: '2026-01-30T10:00:00.000Z',
      runs: [
        validCleanupResult,
        validCleanupResult,
        validCleanupResult,
        validCleanupResult,
        validCleanupResult // 5th run - should fail
      ],
      dismissed: []
    }
    const result = StoredCleanupFindingsSchema.safeParse(stored)
    expect(result.success).toBe(false)
  })

  it('applies default empty dismissed array', () => {
    const stored = {
      lastRun: '2026-01-30T10:00:00.000Z',
      runs: []
    }
    const result = StoredCleanupFindingsSchema.safeParse(stored)
    expect(result.success).toBe(true)
    expect(result.data.dismissed).toEqual([])
  })
})

// =============================================================================
// VALIDATION FUNCTION TESTS
// =============================================================================

describe('validateCleanupFinding', () => {
  describe('advisory mode (default)', () => {
    it('returns valid=true for valid finding', () => {
      const result = validateCleanupFinding(validDuplicateFinding)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.data).toEqual(validDuplicateFinding)
    })

    it('returns valid=false with errors for invalid finding', () => {
      const invalid = { type: 'invalid' }
      const result = validateCleanupFinding(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.data).toEqual(invalid) // Returns original data in advisory mode
    })

    it('includes descriptive error messages', () => {
      const invalid = { ...validDuplicateFinding, type: 'invalid' }
      const result = validateCleanupFinding(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors[0].path).toBe('type')
    })
  })

  describe('strict mode', () => {
    it('returns valid=true for valid finding', () => {
      const result = validateCleanupFinding(validDuplicateFinding, { mode: 'strict' })
      expect(result.valid).toBe(true)
    })

    it('throws error for invalid finding', () => {
      const invalid = { type: 'invalid' }
      expect(() => validateCleanupFinding(invalid, { mode: 'strict' })).toThrow(
        /Cleanup finding validation failed/
      )
    })
  })
})

describe('validateCleanupResult', () => {
  describe('advisory mode (default)', () => {
    it('returns valid=true for valid result', () => {
      const result = validateCleanupResult(validCleanupResult)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid=false with errors for invalid result', () => {
      const invalid = { status: 'invalid' }
      const result = validateCleanupResult(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('strict mode', () => {
    it('returns valid=true for valid result', () => {
      const result = validateCleanupResult(validCleanupResult, { mode: 'strict' })
      expect(result.valid).toBe(true)
    })

    it('throws error for invalid result', () => {
      const invalid = { status: 'invalid' }
      expect(() => validateCleanupResult(invalid, { mode: 'strict' })).toThrow(
        /Cleanup result validation failed/
      )
    })
  })
})
