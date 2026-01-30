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
  MetricsSchema,
  ProjectSchema,
  RoleSchema,
  ExperienceEntrySchema,
  validateProfile,
  validateHistoryEntry
} from './profile.schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '..', 'test', 'fixtures')

// Load test fixtures
const validProfile = JSON.parse(readFileSync(join(fixturesDir, 'valid-profile.json'), 'utf-8'))
const invalidProfiles = JSON.parse(readFileSync(join(fixturesDir, 'invalid-profiles.json'), 'utf-8'))

describe('MetricsSchema', () => {
  it('accepts metrics with numeric value', () => {
    const metrics = {
      value: 40,
      unit: 'percent'
    }
    const result = MetricsSchema.safeParse(metrics)
    expect(result.success).toBe(true)
  })

  it('accepts metrics with string value', () => {
    const metrics = {
      value: '40%',
      unit: 'percent'
    }
    const result = MetricsSchema.safeParse(metrics)
    expect(result.success).toBe(true)
  })

  it('accepts optional context field', () => {
    const metrics = {
      value: 40,
      unit: 'percent',
      context: 'year-over-year'
    }
    const result = MetricsSchema.safeParse(metrics)
    expect(result.success).toBe(true)
  })

  it('rejects missing unit', () => {
    const metrics = {
      value: 40
    }
    const result = MetricsSchema.safeParse(metrics)
    expect(result.success).toBe(false)
  })
})

describe('RoleSchema', () => {
  it('accepts valid role with all fields', () => {
    const role = {
      title: 'Senior Software Engineer',
      company: 'Tech Company Inc',
      location: 'San Francisco, CA',
      startDate: '2022-01-15',
      endDate: '2024-06-30'
    }
    const result = RoleSchema.safeParse(role)
    expect(result.success).toBe(true)
  })

  it('accepts null endDate for current role', () => {
    const role = {
      title: 'Senior Software Engineer',
      company: 'Tech Company Inc',
      startDate: '2022-01-15',
      endDate: null
    }
    const result = RoleSchema.safeParse(role)
    expect(result.success).toBe(true)
  })

  it('accepts role without optional location', () => {
    const role = {
      title: 'Senior Software Engineer',
      company: 'Tech Company Inc',
      startDate: '2022-01-15',
      endDate: null
    }
    const result = RoleSchema.safeParse(role)
    expect(result.success).toBe(true)
  })

  it('rejects missing title', () => {
    const role = {
      company: 'Tech Company Inc',
      startDate: '2022-01-15',
      endDate: null
    }
    const result = RoleSchema.safeParse(role)
    expect(result.success).toBe(false)
  })

  it('rejects missing company', () => {
    const role = {
      title: 'Senior Software Engineer',
      startDate: '2022-01-15',
      endDate: null
    }
    const result = RoleSchema.safeParse(role)
    expect(result.success).toBe(false)
  })

  it('rejects empty title', () => {
    const role = {
      title: '',
      company: 'Tech Company Inc',
      startDate: '2022-01-15',
      endDate: null
    }
    const result = RoleSchema.safeParse(role)
    expect(result.success).toBe(false)
  })

  it('rejects empty company', () => {
    const role = {
      title: 'Senior Software Engineer',
      company: '',
      startDate: '2022-01-15',
      endDate: null
    }
    const result = RoleSchema.safeParse(role)
    expect(result.success).toBe(false)
  })
})

describe('ProjectSchema', () => {
  it('accepts valid project with all fields', () => {
    const project = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Design System Migration',
      description: 'Led migration from legacy component library',
      metrics: {
        value: 40,
        unit: 'percent',
        context: 'bundle size reduction'
      },
      tags: ['technical', 'leadership'],
      skillRefs: ['550e8400-e29b-41d4-a716-446655440001'],
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
    const result = ProjectSchema.safeParse(project)
    expect(result.success).toBe(true)
  })

  it('accepts project without optional metrics', () => {
    const project = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Design System Migration',
      description: 'Led migration from legacy component library',
      tags: ['technical'],
      skillRefs: [],
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
    const result = ProjectSchema.safeParse(project)
    expect(result.success).toBe(true)
  })

  it('applies defaults for tags and skillRefs when missing', () => {
    const project = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Design System Migration',
      description: 'Led migration from legacy component library',
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
    const result = ProjectSchema.safeParse(project)
    expect(result.success).toBe(true)
    expect(result.data.tags).toEqual([])
    expect(result.data.skillRefs).toEqual([])
  })

  it('rejects project with missing name', () => {
    const project = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      description: 'Led migration from legacy component library',
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
    const result = ProjectSchema.safeParse(project)
    expect(result.success).toBe(false)
  })

  it('rejects project with missing description', () => {
    const project = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Design System Migration',
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
    const result = ProjectSchema.safeParse(project)
    expect(result.success).toBe(false)
  })

  it('rejects project with empty name', () => {
    const project = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: '',
      description: 'Led migration from legacy component library',
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
    const result = ProjectSchema.safeParse(project)
    expect(result.success).toBe(false)
  })

  it('rejects project with invalid uuid', () => {
    const project = {
      id: 'not-a-uuid',
      name: 'Design System Migration',
      description: 'Led migration from legacy component library',
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
    const result = ProjectSchema.safeParse(project)
    expect(result.success).toBe(false)
  })
})

describe('ExperienceEntrySchema', () => {
  const validRole = {
    title: 'Senior Software Engineer',
    company: 'Tech Company Inc',
    startDate: '2022-01-15',
    endDate: null
  }

  const validProject = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Design System Migration',
    description: 'Led migration from legacy component library',
    createdAt: '2026-01-30T10:00:00.000Z',
    updatedAt: '2026-01-30T10:00:00.000Z'
  }

  it('accepts valid experience entry with role and projects', () => {
    const entry = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      role: validRole,
      projects: [validProject],
      version: 1,
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
    const result = ExperienceEntrySchema.safeParse(entry)
    expect(result.success).toBe(true)
  })

  it('accepts multiple projects per experience entry', () => {
    const secondProject = {
      ...validProject,
      id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Performance Optimization'
    }
    const entry = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      role: validRole,
      projects: [validProject, secondProject],
      version: 1,
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
    const result = ExperienceEntrySchema.safeParse(entry)
    expect(result.success).toBe(true)
    expect(result.data.projects).toHaveLength(2)
  })

  it('applies default version when missing', () => {
    const entry = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      role: validRole,
      projects: [validProject],
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
    const result = ExperienceEntrySchema.safeParse(entry)
    expect(result.success).toBe(true)
    expect(result.data.version).toBe(1)
  })

  it('rejects empty projects array (at least one project required)', () => {
    const entry = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      role: validRole,
      projects: [],
      version: 1,
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
    const result = ExperienceEntrySchema.safeParse(entry)
    expect(result.success).toBe(false)
  })

  it('rejects missing role', () => {
    const entry = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      projects: [validProject],
      version: 1,
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
    const result = ExperienceEntrySchema.safeParse(entry)
    expect(result.success).toBe(false)
  })

  it('rejects invalid uuid', () => {
    const entry = {
      id: 'not-a-uuid',
      role: validRole,
      projects: [validProject],
      version: 1,
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
    const result = ExperienceEntrySchema.safeParse(entry)
    expect(result.success).toBe(false)
  })

  it('rejects non-positive version', () => {
    const entry = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      role: validRole,
      projects: [validProject],
      version: 0,
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
    const result = ExperienceEntrySchema.safeParse(entry)
    expect(result.success).toBe(false)
  })
})

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
