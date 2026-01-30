/**
 * Tests for Extraction Mapper
 *
 * Tests mapping extractions to profile fields, creating entries, and merging.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock uuid to return predictable values
let uuidCounter = 0
vi.mock('uuid', () => ({
  v4: vi.fn(() => `550e8400-e29b-41d4-a716-44665544000${uuidCounter++}`)
}))

// Import after mocking
import {
  addExtractionToProfile,
  mergeWithExisting,
  determineTargetField
} from './extraction-mapper.js'

// Test fixture - minimal profile for testing
function createTestProfile() {
  return {
    metadata: {
      version: 1,
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z',
      schemaVersion: '1.0'
    },
    experience: [
      {
        id: 'exp-1',
        role: {
          title: 'Senior Engineer',
          company: 'Tech Co',
          startDate: '2022-01-01',
          endDate: null
        },
        projects: [
          {
            id: 'proj-1',
            name: 'API Platform',
            description: 'Built REST API',
            tags: ['technical'],
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
        id: 'skill-1',
        name: 'React',
        category: 'Technical',
        subcategory: 'Frontend',
        proficiency: 'proficient',
        source: 'explicit',
        confidence: 80,
        evidence: ['proj-1'],
        createdAt: '2026-01-30T10:00:00.000Z',
        updatedAt: '2026-01-30T10:00:00.000Z'
      }
    ],
    summaryBlocks: [],
    stories: [
      {
        id: 'story-1',
        title: 'Migration Story',
        situation: 'Legacy system',
        task: 'Migrate',
        action: 'Created plan',
        result: 'Success',
        questionCategories: ['leadership'],
        themes: [],
        variants: [],
        createdAt: '2026-01-30T10:00:00.000Z',
        updatedAt: '2026-01-30T10:00:00.000Z'
      }
    ],
    preferences: {
      targetRoles: [],
      communication: {
        tone: 'conversational',
        verbosity: 'balanced',
        emphasisAreas: ['impact-driven'],
        avoidPhrases: []
      }
    },
    history: []
  }
}

describe('determineTargetField', () => {
  it('returns targetField if provided in extraction', () => {
    const extraction = {
      category: 'skill',
      content: 'React',
      targetField: 'skills.frontend'
    }

    expect(determineTargetField(extraction)).toBe('skills.frontend')
  })

  it('maps skill category to skills field', () => {
    const extraction = { category: 'skill', content: 'TypeScript' }
    expect(determineTargetField(extraction)).toBe('skills')
  })

  it('maps story category to stories field', () => {
    const extraction = { category: 'story', content: 'Leadership story' }
    expect(determineTargetField(extraction)).toBe('stories')
  })

  it('maps preference category to preferences field', () => {
    const extraction = { category: 'preference', content: 'Remote work' }
    expect(determineTargetField(extraction)).toBe('preferences')
  })

  it('maps achievement category to experience.projects field', () => {
    const extraction = { category: 'achievement', content: 'Built platform' }
    expect(determineTargetField(extraction)).toBe('experience.projects')
  })

  it('maps pattern category to metadata.patterns field', () => {
    const extraction = { category: 'pattern', content: 'Works well with deadlines' }
    expect(determineTargetField(extraction)).toBe('metadata.patterns')
  })
})

describe('addExtractionToProfile', () => {
  beforeEach(() => {
    uuidCounter = 0
  })

  describe('skill extractions', () => {
    it('creates valid skill entry from extraction', () => {
      const profile = createTestProfile()
      const extraction = {
        id: 'ext-1',
        category: 'skill',
        content: 'GraphQL',
        confidence: 'high',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      }

      const updatedProfile = addExtractionToProfile(profile, extraction)

      expect(updatedProfile.skills).toHaveLength(2)
      const newSkill = updatedProfile.skills[1]
      expect(newSkill.name).toBe('GraphQL')
      expect(newSkill.category).toBe('Uncategorized')
      expect(newSkill.proficiency).toBe('familiar')
      expect(newSkill.source).toBe('inferred')
      expect(newSkill.confidence).toBe(90) // high = 90
    })

    it('maps confidence levels correctly', () => {
      const profile = createTestProfile()

      const highConfidence = addExtractionToProfile(profile, {
        id: 'ext-1',
        category: 'skill',
        content: 'Skill1',
        confidence: 'high',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      })
      expect(highConfidence.skills[1].confidence).toBe(90)

      const mediumConfidence = addExtractionToProfile(profile, {
        id: 'ext-2',
        category: 'skill',
        content: 'Skill2',
        confidence: 'medium',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      })
      expect(mediumConfidence.skills[1].confidence).toBe(70)

      const lowConfidence = addExtractionToProfile(profile, {
        id: 'ext-3',
        category: 'skill',
        content: 'Skill3',
        confidence: 'low',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      })
      expect(lowConfidence.skills[1].confidence).toBe(50)
    })
  })

  describe('story extractions', () => {
    it('creates valid story entry from simple extraction', () => {
      const profile = createTestProfile()
      const extraction = {
        id: 'ext-1',
        category: 'story',
        content: 'Led a major migration project',
        confidence: 'high',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      }

      const updatedProfile = addExtractionToProfile(profile, extraction)

      expect(updatedProfile.stories).toHaveLength(2)
      const newStory = updatedProfile.stories[1]
      expect(newStory.title).toBe('Led a major migration project')
      expect(newStory.situation).toBe('To be completed')
      expect(newStory.questionCategories).toEqual([])
    })

    it('parses STAR components from structured content', () => {
      const profile = createTestProfile()
      const extraction = {
        id: 'ext-1',
        category: 'story',
        content:
          'SITUATION: Team was struggling TASK: Lead turnaround ACTION: Implemented daily standups RESULT: Team velocity doubled',
        confidence: 'high',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      }

      const updatedProfile = addExtractionToProfile(profile, extraction)

      const newStory = updatedProfile.stories[1]
      expect(newStory.situation).toBe('Team was struggling')
      expect(newStory.task).toBe('Lead turnaround')
      expect(newStory.action).toBe('Implemented daily standups')
      expect(newStory.result).toBe('Team velocity doubled')
    })
  })

  describe('preference extractions', () => {
    it('adds preference to communication emphasisAreas', () => {
      const profile = createTestProfile()
      const extraction = {
        id: 'ext-1',
        category: 'preference',
        content: 'Collaborative work environment',
        confidence: 'high',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      }

      const updatedProfile = addExtractionToProfile(profile, extraction)

      expect(updatedProfile.preferences.communication.emphasisAreas).toContain(
        'Collaborative work environment'
      )
    })

    it('updates tone based on preference content', () => {
      const profile = createTestProfile()
      const extraction = {
        id: 'ext-1',
        category: 'preference',
        content: 'Prefer formal communication style',
        confidence: 'medium',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      }

      const updatedProfile = addExtractionToProfile(profile, extraction)

      expect(updatedProfile.preferences.communication.tone).toBe('formal')
    })

    it('handles remote preference', () => {
      const profile = createTestProfile()
      const extraction = {
        id: 'ext-1',
        category: 'preference',
        content: 'Prefer remote work',
        confidence: 'high',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      }

      const updatedProfile = addExtractionToProfile(profile, extraction)

      expect(updatedProfile.preferences.communication.customGuidelines).toContain('remote')
    })
  })

  describe('achievement extractions', () => {
    it('adds achievement to metadata.achievementNotes', () => {
      const profile = createTestProfile()
      const extraction = {
        id: 'ext-1',
        category: 'achievement',
        content: 'Increased revenue by 40%',
        confidence: 'high',
        sourceQuote: 'In my last role, I increased revenue by 40%',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      }

      const updatedProfile = addExtractionToProfile(profile, extraction)

      expect(updatedProfile.metadata.achievementNotes).toHaveLength(1)
      expect(updatedProfile.metadata.achievementNotes[0].content).toBe('Increased revenue by 40%')
    })
  })

  describe('pattern extractions', () => {
    it('adds pattern to metadata.patterns', () => {
      const profile = createTestProfile()
      const extraction = {
        id: 'ext-1',
        category: 'pattern',
        content: 'Works best with clear deadlines',
        confidence: 'medium',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      }

      const updatedProfile = addExtractionToProfile(profile, extraction)

      expect(updatedProfile.metadata.patterns).toContain('Works best with clear deadlines')
    })
  })

  describe('history tracking', () => {
    it('adds history entry when adding extraction', () => {
      const profile = createTestProfile()
      const extraction = {
        id: 'ext-1',
        category: 'skill',
        content: 'Python',
        confidence: 'high',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      }

      const updatedProfile = addExtractionToProfile(profile, extraction)

      expect(updatedProfile.history).toHaveLength(1)
      expect(updatedProfile.history[0].action).toBe('create')
      expect(updatedProfile.history[0].entityType).toBe('skill')
    })

    it('does not mutate original profile', () => {
      const profile = createTestProfile()
      const originalSkillsLength = profile.skills.length

      addExtractionToProfile(profile, {
        id: 'ext-1',
        category: 'skill',
        content: 'New Skill',
        confidence: 'high',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      })

      expect(profile.skills.length).toBe(originalSkillsLength)
    })
  })
})

describe('mergeWithExisting', () => {
  beforeEach(() => {
    uuidCounter = 0
  })

  describe('skill merging', () => {
    it('updates skill confidence if higher', () => {
      const profile = createTestProfile()
      const extraction = {
        id: 'ext-1',
        category: 'skill',
        content: 'React',
        confidence: 'high', // 90, existing is 80
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      }

      const updatedProfile = mergeWithExisting(profile, extraction, 'skill-1')

      expect(updatedProfile.skills[0].confidence).toBe(90)
      expect(updatedProfile.skills).toHaveLength(1) // Didn't add new
    })

    it('keeps existing confidence if higher', () => {
      const profile = createTestProfile()
      // Set high confidence on existing skill
      profile.skills[0].confidence = 95

      const extraction = {
        id: 'ext-1',
        category: 'skill',
        content: 'React',
        confidence: 'medium', // 70, existing is 95
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      }

      const updatedProfile = mergeWithExisting(profile, extraction, 'skill-1')

      expect(updatedProfile.skills[0].confidence).toBe(95)
    })
  })

  describe('story merging', () => {
    it('updates story result if more detailed', () => {
      const profile = createTestProfile()
      const extraction = {
        id: 'ext-1',
        category: 'story',
        content: 'RESULT: Complete success with 50% improvement in metrics',
        confidence: 'high',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      }

      const updatedProfile = mergeWithExisting(profile, extraction, 'story-1')

      expect(updatedProfile.stories[0].result).toContain('50% improvement')
      expect(updatedProfile.stories).toHaveLength(1) // Didn't add new
    })
  })

  describe('preference merging', () => {
    it('adds to existing emphasis areas', () => {
      const profile = createTestProfile()
      const extraction = {
        id: 'ext-1',
        category: 'preference',
        content: 'Detail-oriented',
        confidence: 'medium',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      }

      const updatedProfile = mergeWithExisting(profile, extraction, 'preferences.communication')

      expect(updatedProfile.preferences.communication.emphasisAreas).toContain('impact-driven')
      expect(updatedProfile.preferences.communication.emphasisAreas).toContain('Detail-oriented')
    })
  })

  describe('fallback behavior', () => {
    it('falls back to addExtractionToProfile if item not found', () => {
      const profile = createTestProfile()
      const extraction = {
        id: 'ext-1',
        category: 'skill',
        content: 'New Skill',
        confidence: 'high',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      }

      const updatedProfile = mergeWithExisting(profile, extraction, 'nonexistent-id')

      expect(updatedProfile.skills).toHaveLength(2)
      expect(updatedProfile.skills[1].name).toBe('New Skill')
    })
  })

  describe('history tracking', () => {
    it('adds history entry with previousValue on merge', () => {
      const profile = createTestProfile()
      const extraction = {
        id: 'ext-1',
        category: 'skill',
        content: 'React',
        confidence: 'high',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      }

      const updatedProfile = mergeWithExisting(profile, extraction, 'skill-1')

      expect(updatedProfile.history).toHaveLength(1)
      expect(updatedProfile.history[0].action).toBe('update')
      expect(updatedProfile.history[0].previousValue).toBeDefined()
      expect(updatedProfile.history[0].previousValue.confidence).toBe(80)
    })
  })
})
