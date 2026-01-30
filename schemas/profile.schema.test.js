/**
 * Profile Schema Tests
 *
 * Tests Zod schema validation for profile data structure.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  ProfileSchema,
  ProfileMetadataSchema,
  HistoryEntrySchema,
  validateProfile,
  validateHistoryEntry
} from './profile.schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '..', 'test', 'fixtures')

// Load test fixtures
const validProfile = JSON.parse(readFileSync(join(fixturesDir, 'valid-profile.json'), 'utf-8'))
const invalidProfiles = JSON.parse(readFileSync(join(fixturesDir, 'invalid-profiles.json'), 'utf-8'))

describe('ProfileMetadataSchema', () => {
  it('accepts valid metadata', () => {
    const validMetadata = {
      version: 1,
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z',
      schemaVersion: '1.0'
    }

    const result = ProfileMetadataSchema.safeParse(validMetadata)
    expect(result.success).toBe(true)
  })

  it('rejects invalid schema version', () => {
    const invalidMetadata = {
      version: 1,
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z',
      schemaVersion: '2.0'
    }

    const result = ProfileMetadataSchema.safeParse(invalidMetadata)
    expect(result.success).toBe(false)
  })

  it('rejects non-positive version', () => {
    const invalidMetadata = {
      version: 0,
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z',
      schemaVersion: '1.0'
    }

    const result = ProfileMetadataSchema.safeParse(invalidMetadata)
    expect(result.success).toBe(false)
  })

  it('rejects missing required fields', () => {
    const incompleteMetadata = {
      version: 1,
      schemaVersion: '1.0'
    }

    const result = ProfileMetadataSchema.safeParse(incompleteMetadata)
    expect(result.success).toBe(false)
  })
})

describe('HistoryEntrySchema', () => {
  it('accepts valid history entry', () => {
    const validEntry = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2026-01-30T10:00:00.000Z',
      action: 'create',
      entityType: 'skill',
      entityId: 'skill-1',
      previousValue: null,
      newValue: { name: 'React' }
    }

    const result = HistoryEntrySchema.safeParse(validEntry)
    expect(result.success).toBe(true)
  })

  it('accepts all valid actions', () => {
    const validActions = ['create', 'update', 'delete']

    for (const action of validActions) {
      const entry = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: '2026-01-30T10:00:00.000Z',
        action,
        entityType: 'skill',
        entityId: 'skill-1',
        previousValue: null,
        newValue: null
      }

      const result = HistoryEntrySchema.safeParse(entry)
      expect(result.success, `Action "${action}" should be valid`).toBe(true)
    }
  })

  it('accepts all valid entity types', () => {
    const validTypes = ['experience', 'skill', 'summary', 'story', 'preference']

    for (const entityType of validTypes) {
      const entry = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: '2026-01-30T10:00:00.000Z',
        action: 'create',
        entityType,
        entityId: 'item-1',
        previousValue: null,
        newValue: null
      }

      const result = HistoryEntrySchema.safeParse(entry)
      expect(result.success, `Entity type "${entityType}" should be valid`).toBe(true)
    }
  })

  it('rejects invalid action', () => {
    const invalidEntry = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2026-01-30T10:00:00.000Z',
      action: 'invalid-action',
      entityType: 'skill',
      entityId: 'skill-1',
      previousValue: null,
      newValue: null
    }

    const result = HistoryEntrySchema.safeParse(invalidEntry)
    expect(result.success).toBe(false)
  })

  it('rejects invalid entity type', () => {
    const invalidEntry = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2026-01-30T10:00:00.000Z',
      action: 'create',
      entityType: 'unknown-type',
      entityId: 'item-1',
      previousValue: null,
      newValue: null
    }

    const result = HistoryEntrySchema.safeParse(invalidEntry)
    expect(result.success).toBe(false)
  })

  it('rejects invalid uuid', () => {
    const invalidEntry = {
      id: 'not-a-valid-uuid',
      timestamp: '2026-01-30T10:00:00.000Z',
      action: 'create',
      entityType: 'skill',
      entityId: 'skill-1',
      previousValue: null,
      newValue: null
    }

    const result = HistoryEntrySchema.safeParse(invalidEntry)
    expect(result.success).toBe(false)
  })

  it('accepts optional reason field', () => {
    const entryWithReason = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2026-01-30T10:00:00.000Z',
      action: 'update',
      entityType: 'skill',
      entityId: 'skill-1',
      previousValue: { proficiency: 'familiar' },
      newValue: { proficiency: 'proficient' },
      reason: 'Gained more experience with this skill'
    }

    const result = HistoryEntrySchema.safeParse(entryWithReason)
    expect(result.success).toBe(true)
  })
})

describe('ProfileSchema', () => {
  describe('valid profile', () => {
    it('passes validation for complete valid profile', () => {
      const result = ProfileSchema.safeParse(validProfile)
      expect(result.success).toBe(true)
    })

    it('accepts profile with minimal required fields', () => {
      const minimalProfile = {
        metadata: {
          version: 1,
          createdAt: '2026-01-30T10:00:00.000Z',
          updatedAt: '2026-01-30T10:00:00.000Z',
          schemaVersion: '1.0'
        }
      }

      const result = ProfileSchema.safeParse(minimalProfile)
      expect(result.success).toBe(true)
    })

    it('applies defaults for missing optional fields', () => {
      const minimalProfile = {
        metadata: {
          version: 1,
          createdAt: '2026-01-30T10:00:00.000Z',
          updatedAt: '2026-01-30T10:00:00.000Z',
          schemaVersion: '1.0'
        }
      }

      const result = ProfileSchema.safeParse(minimalProfile)
      expect(result.success).toBe(true)
      expect(result.data.experience).toEqual([])
      expect(result.data.skills).toEqual([])
      expect(result.data.summaryBlocks).toEqual([])
      expect(result.data.stories).toEqual([])
      expect(result.data.history).toEqual([])
      // When preferences is undefined, Zod applies {} default
      // Nested defaults only apply when properties are undefined
      expect(result.data.preferences).toBeDefined()
    })

    it('applies defaults when preferences omitted', () => {
      // When preferences is entirely omitted, the default empty object is applied
      const profile = {
        metadata: {
          version: 1,
          createdAt: '2026-01-30T10:00:00.000Z',
          updatedAt: '2026-01-30T10:00:00.000Z',
          schemaVersion: '1.0'
        }
      }

      const result = ProfileSchema.safeParse(profile)
      expect(result.success).toBe(true)
      // Preferences defaults to empty object with nested defaults
      expect(result.data.preferences).toBeDefined()
      expect(typeof result.data.preferences).toBe('object')
    })

    it('accepts profile with history entries', () => {
      const profileWithHistory = {
        ...validProfile,
        history: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            timestamp: '2026-01-30T10:00:00.000Z',
            action: 'create',
            entityType: 'skill',
            entityId: 'skill-1',
            previousValue: null,
            newValue: { name: 'React' }
          }
        ]
      }

      const result = ProfileSchema.safeParse(profileWithHistory)
      expect(result.success).toBe(true)
    })
  })

  describe('invalid profiles', () => {
    it.each(invalidProfiles)('catches error for: $name', ({ profile, expectedErrors }) => {
      const result = ProfileSchema.safeParse(profile)
      expect(result.success).toBe(false)

      // Check that expected error paths are present
      const errorPaths = result.error.issues.map((issue) => issue.path.join('.'))

      for (const expectedError of expectedErrors) {
        expect(
          errorPaths.some((path) => path.startsWith(expectedError) || path === expectedError),
          `Expected error for "${expectedError}" but got errors for: ${errorPaths.join(', ')}`
        ).toBe(true)
      }
    })
  })

  describe('empty arrays are valid', () => {
    it('accepts empty experience array', () => {
      const profile = { ...validProfile, experience: [] }
      const result = ProfileSchema.safeParse(profile)
      expect(result.success).toBe(true)
    })

    it('accepts empty skills array', () => {
      const profile = { ...validProfile, skills: [] }
      const result = ProfileSchema.safeParse(profile)
      expect(result.success).toBe(true)
    })

    it('accepts empty summaryBlocks array', () => {
      const profile = { ...validProfile, summaryBlocks: [] }
      const result = ProfileSchema.safeParse(profile)
      expect(result.success).toBe(true)
    })

    it('accepts empty stories array', () => {
      const profile = { ...validProfile, stories: [] }
      const result = ProfileSchema.safeParse(profile)
      expect(result.success).toBe(true)
    })

    it('accepts empty history array', () => {
      const profile = { ...validProfile, history: [] }
      const result = ProfileSchema.safeParse(profile)
      expect(result.success).toBe(true)
    })

    it('accepts empty targetRoles array', () => {
      const profile = { ...validProfile, preferences: { targetRoles: [] } }
      const result = ProfileSchema.safeParse(profile)
      expect(result.success).toBe(true)
    })
  })
})

describe('validateProfile', () => {
  describe('advisory mode (default)', () => {
    it('returns valid: true for valid profile', () => {
      const result = validateProfile(validProfile)

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.data).toBeDefined()
    })

    it('returns valid: false with errors but still returns data', () => {
      const invalidProfile = {
        metadata: { version: -1, schemaVersion: '2.0' }
      }

      const result = validateProfile(invalidProfile)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      // Advisory mode returns original data even on failure
      expect(result.data).toEqual(invalidProfile)
    })

    it('includes descriptive error messages', () => {
      const invalidProfile = {
        metadata: { version: -1, schemaVersion: '2.0' }
      }

      const result = validateProfile(invalidProfile)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.path.includes('version'))).toBe(true)
      expect(result.errors.some((e) => e.message)).toBe(true)
    })
  })

  describe('strict mode', () => {
    it('returns valid data in strict mode', () => {
      const result = validateProfile(validProfile, { mode: 'strict' })

      expect(result.valid).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('throws error in strict mode for invalid profile', () => {
      const invalidProfile = { metadata: { version: -1 } }

      expect(() => validateProfile(invalidProfile, { mode: 'strict' })).toThrow()
    })

    it('error message includes validation details', () => {
      const invalidProfile = { metadata: { version: -1 } }

      expect(() => validateProfile(invalidProfile, { mode: 'strict' })).toThrow(
        /validation failed/i
      )
    })
  })
})

describe('validateHistoryEntry', () => {
  it('validates a single valid history entry', () => {
    const validEntry = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2026-01-30T10:00:00.000Z',
      action: 'create',
      entityType: 'skill',
      entityId: 'skill-1',
      previousValue: null,
      newValue: { name: 'React' }
    }

    const result = validateHistoryEntry(validEntry)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('returns errors for invalid entry in advisory mode', () => {
    const invalidEntry = {
      id: 'not-a-uuid',
      timestamp: '2026-01-30T10:00:00.000Z',
      action: 'invalid',
      entityType: 'unknown',
      entityId: 'item-1'
    }

    const result = validateHistoryEntry(invalidEntry)

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.data).toEqual(invalidEntry)
  })

  it('throws in strict mode for invalid entry', () => {
    const invalidEntry = { id: 'not-valid' }

    expect(() => validateHistoryEntry(invalidEntry, { mode: 'strict' })).toThrow()
  })
})
