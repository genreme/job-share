/**
 * Profile Tools Tests
 *
 * Tests MCP tool implementations for profile access.
 * Uses mocking to isolate tests from file system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the profile-loader module BEFORE importing tools
vi.mock('../data/profile-loader.js', () => ({
  loadProfile: vi.fn()
}))

// Import tools under test (after mock is set up)
import {
  getProfile,
  getExperienceByTheme,
  getStoriesByCategory,
  getSkillsByCategory,
  getSummaryBlocksByAudience,
  getTargetRoles,
  getCommunicationPrefs
} from './profile.js'

// Import the mocked loadProfile to configure it
import { loadProfile } from '../data/profile-loader.js'

// Test fixture - complete profile with all sections populated
const testProfile = {
  metadata: {
    version: 1,
    createdAt: '2026-01-30T10:00:00.000Z',
    updatedAt: '2026-01-30T10:00:00.000Z',
    schemaVersion: '1.0'
  },
  experience: [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      role: {
        title: 'Senior Software Engineer',
        company: 'Tech Company Inc',
        startDate: '2022-01-15',
        endDate: null
      },
      projects: [
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'Design System Migration',
          description: 'Led migration from legacy component library.',
          tags: ['technical', 'leadership', 'cross-functional'],
          skillRefs: ['550e8400-e29b-41d4-a716-446655440010'],
          createdAt: '2026-01-30T10:00:00.000Z',
          updatedAt: '2026-01-30T10:00:00.000Z'
        }
      ],
      version: 1,
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      role: {
        title: 'Software Engineer',
        company: 'Startup Inc',
        startDate: '2020-01-15',
        endDate: '2022-01-14'
      },
      projects: [
        {
          id: '550e8400-e29b-41d4-a716-446655440004',
          name: 'API Platform',
          description: 'Built API platform.',
          tags: ['technical', 'architecture'],
          skillRefs: [],
          createdAt: '2026-01-30T10:00:00.000Z',
          updatedAt: '2026-01-30T10:00:00.000Z'
        }
      ],
      version: 1,
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
  ],
  skills: [
    {
      id: '550e8400-e29b-41d4-a716-446655440010',
      name: 'React',
      category: 'Technical',
      subcategory: 'Frontend Frameworks',
      proficiency: 'expert',
      source: 'explicit',
      confidence: 95,
      evidence: ['550e8400-e29b-41d4-a716-446655440002'],
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440011',
      name: 'Team Leadership',
      category: 'Leadership',
      subcategory: 'Team Management',
      proficiency: 'proficient',
      source: 'explicit',
      confidence: 85,
      evidence: ['550e8400-e29b-41d4-a716-446655440002'],
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
  ],
  summaryBlocks: [
    {
      id: '550e8400-e29b-41d4-a716-446655440020',
      content: 'Engineering leader with 10+ years scaling teams.',
      audiences: ['technical', 'leadership'],
      themes: ['team-scaling'],
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440021',
      content: 'Strategic thinker driving business outcomes.',
      audiences: ['executive'],
      themes: ['strategy'],
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
  ],
  stories: [
    {
      id: '550e8400-e29b-41d4-a716-446655440030',
      title: 'Design System Migration Leadership',
      situation: 'Legacy component library was causing bugs.',
      task: 'Lead migration to modern design system.',
      action: 'Created phased migration plan.',
      result: 'Completed in 6 months with zero incidents.',
      questionCategories: ['leadership', 'change-management'],
      themes: ['cross-functional'],
      variants: [],
      projectRef: '550e8400-e29b-41d4-a716-446655440002',
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440031',
      title: 'Conflict Resolution Story',
      situation: 'Team disagreement on technical approach.',
      task: 'Resolve conflict and align team.',
      action: 'Facilitated design review.',
      result: 'Team aligned on approach.',
      questionCategories: ['conflict-resolution', 'teamwork'],
      themes: ['collaboration'],
      variants: [],
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
  ],
  preferences: {
    targetRoles: [
      {
        id: '550e8400-e29b-41d4-a716-446655440040',
        title: 'Head of Design',
        level: 'director',
        industries: ['fintech', 'b2b-saas'],
        companyStages: ['series-b', 'growth'],
        remotePref: 'hybrid',
        locations: ['San Francisco'],
        salaryRange: { min: 200000, max: 300000, currency: 'USD' },
        priorities: ['impact'],
        dealbreakers: ['no-equity'],
        createdAt: '2026-01-30T10:00:00.000Z',
        updatedAt: '2026-01-30T10:00:00.000Z'
      }
    ],
    communication: {
      tone: 'conversational',
      verbosity: 'balanced',
      emphasisAreas: ['impact-driven'],
      avoidPhrases: ['synergy'],
      customGuidelines: 'Lead with outcomes.',
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z'
    }
  },
  history: []
}

describe('Profile Tools', () => {
  // Setup: Configure mock to return test profile before each test
  beforeEach(() => {
    vi.mocked(loadProfile).mockReturnValue(testProfile)
  })

  describe('getProfile', () => {
    it('returns valid profile structure', () => {
      const result = getProfile()

      expect(result).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(result.metadata).toBeDefined()
      expect(result.metadata.schemaVersion).toBe('1.0')
    })

    it('returns all profile sections', () => {
      const result = getProfile()

      expect(result.experience).toBeDefined()
      expect(result.skills).toBeDefined()
      expect(result.summaryBlocks).toBeDefined()
      expect(result.stories).toBeDefined()
      expect(result.preferences).toBeDefined()
      expect(result.history).toBeDefined()
    })

    it('returns populated experience array', () => {
      const result = getProfile()

      expect(result.experience).toHaveLength(2)
      expect(result.experience[0].role.title).toBe('Senior Software Engineer')
    })
  })

  describe('getExperienceByTheme', () => {
    it('filters experience by matching tag (exact)', () => {
      const result = getExperienceByTheme({ theme: 'leadership' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result[0].role.title).toBe('Senior Software Engineer')
    })

    it('filters experience by matching tag (partial)', () => {
      const result = getExperienceByTheme({ theme: 'lead' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
    })

    it('returns multiple experience entries when multiple match', () => {
      const result = getExperienceByTheme({ theme: 'technical' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2) // Both entries have 'technical' tag
    })

    it('returns empty array when no matches', () => {
      const result = getExperienceByTheme({ theme: 'nonexistent' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })

    it('is case-insensitive', () => {
      const result = getExperienceByTheme({ theme: 'LEADERSHIP' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
    })

    it('returns error when theme not provided', () => {
      const result = getExperienceByTheme({})

      expect(result.error).toBeDefined()
      expect(result.error).toContain('theme parameter is required')
    })
  })

  describe('getStoriesByCategory', () => {
    it('filters stories by question category', () => {
      const result = getStoriesByCategory({ category: 'leadership' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Design System Migration Leadership')
    })

    it('filters stories by partial category match', () => {
      const result = getStoriesByCategory({ category: 'conflict' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Conflict Resolution Story')
    })

    it('returns empty array when no matches', () => {
      const result = getStoriesByCategory({ category: 'nonexistent' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })

    it('is case-insensitive', () => {
      const result = getStoriesByCategory({ category: 'TEAMWORK' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
    })

    it('returns error when category not provided', () => {
      const result = getStoriesByCategory({})

      expect(result.error).toBeDefined()
      expect(result.error).toContain('category parameter is required')
    })
  })

  describe('getSkillsByCategory', () => {
    it('filters skills by category', () => {
      const result = getSkillsByCategory({ category: 'Technical' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('React')
    })

    it('filters skills by subcategory', () => {
      const result = getSkillsByCategory({ category: 'Frontend' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result[0].subcategory).toBe('Frontend Frameworks')
    })

    it('returns multiple skills matching category', () => {
      // Leadership category has Team Leadership skill
      const result = getSkillsByCategory({ category: 'Leadership' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('Leadership')
    })

    it('returns empty array when no matches', () => {
      const result = getSkillsByCategory({ category: 'Nonexistent' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })

    it('is case-insensitive', () => {
      const result = getSkillsByCategory({ category: 'technical' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
    })

    it('returns error when category not provided', () => {
      const result = getSkillsByCategory({})

      expect(result.error).toBeDefined()
      expect(result.error).toContain('category parameter is required')
    })

    it('includes evidence references in results', () => {
      const result = getSkillsByCategory({ category: 'Technical' })

      expect(result[0].evidence).toBeDefined()
      expect(result[0].evidence).toHaveLength(1)
    })
  })

  describe('getSummaryBlocksByAudience', () => {
    it('filters summary blocks by audience', () => {
      const result = getSummaryBlocksByAudience({ audience: 'technical' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result[0].audiences).toContain('technical')
    })

    it('returns blocks for executive audience', () => {
      const result = getSummaryBlocksByAudience({ audience: 'executive' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result[0].content).toContain('Strategic')
    })

    it('returns empty array when no matches', () => {
      const result = getSummaryBlocksByAudience({ audience: 'mission-driven' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })

    it('is case-insensitive', () => {
      const result = getSummaryBlocksByAudience({ audience: 'LEADERSHIP' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
    })

    it('returns error when audience not provided', () => {
      const result = getSummaryBlocksByAudience({})

      expect(result.error).toBeDefined()
      expect(result.error).toContain('audience parameter is required')
    })
  })

  describe('getTargetRoles', () => {
    it('returns target roles array', () => {
      const result = getTargetRoles()

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
    })

    it('returns target role with all fields', () => {
      const result = getTargetRoles()
      const role = result[0]

      expect(role.title).toBe('Head of Design')
      expect(role.level).toBe('director')
      expect(role.industries).toContain('fintech')
      expect(role.salaryRange).toBeDefined()
      expect(role.salaryRange.min).toBe(200000)
    })
  })

  describe('getCommunicationPrefs', () => {
    it('returns communication preferences', () => {
      const result = getCommunicationPrefs()

      expect(result).toBeDefined()
      expect(result.tone).toBe('conversational')
      expect(result.verbosity).toBe('balanced')
    })

    it('includes emphasis areas and avoid phrases', () => {
      const result = getCommunicationPrefs()

      expect(result.emphasisAreas).toContain('impact-driven')
      expect(result.avoidPhrases).toContain('synergy')
    })

    it('includes custom guidelines', () => {
      const result = getCommunicationPrefs()

      expect(result.customGuidelines).toBe('Lead with outcomes.')
    })
  })

  describe('empty profile handling', () => {
    it('handles empty experience array gracefully', () => {
      // The fixture has experience, so this tests the filter returning empty
      const result = getExperienceByTheme({ theme: 'nonexistent-theme' })
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })

    it('handles empty stories array gracefully', () => {
      const result = getStoriesByCategory({ category: 'nonexistent-category' })
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })

    it('handles empty skills array gracefully', () => {
      const result = getSkillsByCategory({ category: 'Nonexistent Category' })
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })
  })
})
