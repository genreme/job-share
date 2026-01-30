/**
 * Tests for Profile-to-Cover-Letter Transformation Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  previewCoverLetterSources,
  buildCoverLetterFromProfile,
  getUsedCoverLetterItems
} from './profile-to-cover-letter.js'

// Mock gap-detector
vi.mock('./gap-detector.js', () => ({
  detectGaps: vi.fn(() => [])
}))

/**
 * Create a mock profile for testing
 */
function createMockProfile(overrides = {}) {
  const now = new Date().toISOString()

  return {
    metadata: {
      version: 1,
      createdAt: now,
      updatedAt: now,
      schemaVersion: '1.0',
      name: 'Test User',
      email: 'test@example.com',
      ...overrides.metadata
    },
    experience: overrides.experience || [
      {
        id: 'exp-1',
        role: {
          title: 'Senior Engineer',
          company: 'Tech Corp',
          startDate: '2020-01-01',
          endDate: null
        },
        projects: [
          {
            id: 'proj-1',
            name: 'Revenue Platform',
            description: 'Built platform that increased revenue by 40%',
            tags: ['backend', 'revenue'],
            metrics: { value: 40, unit: 'percent', context: 'year-over-year' },
            createdAt: now,
            updatedAt: now
          },
          {
            id: 'proj-2',
            name: 'Internal Tool',
            description: 'Created internal tool for team productivity',
            tags: ['internal'],
            createdAt: now,
            updatedAt: now
          }
        ],
        version: 1,
        createdAt: now,
        updatedAt: now
      }
    ],
    skills: overrides.skills || [],
    summaryBlocks: overrides.summaryBlocks || [],
    stories: overrides.stories || [
      {
        id: 'story-1',
        title: 'Led Team Through Crisis',
        situation: 'Our main system went down during peak traffic.',
        task: 'I needed to coordinate the team to fix it quickly.',
        action: 'I organized a war room and delegated tasks efficiently.',
        result: 'We restored service in 2 hours with no data loss.',
        questionCategories: ['leadership', 'problem-solving'],
        themes: ['leadership', 'crisis-management'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'story-2',
        title: 'Shipped Feature Under Deadline',
        situation: 'We had a tight deadline for a critical feature.',
        task: 'Deliver the feature without compromising quality.',
        action: 'I prioritized ruthlessly and worked closely with QA.',
        result: 'Shipped on time with zero bugs reported.',
        questionCategories: ['achievement', 'time-management'],
        themes: ['delivery', 'quality'],
        createdAt: now,
        updatedAt: now
      }
    ],
    preferences: {
      targetRoles: [],
      communication: overrides.communication || {
        tone: 'conversational',
        verbosity: 'balanced',
        emphasisAreas: ['impact-driven', 'collaborative'],
        avoidPhrases: ['synergy', 'leverage']
      }
    },
    history: []
  }
}

describe('previewCoverLetterSources', () => {
  it('returns correct structure with all sections', () => {
    const profile = createMockProfile()
    const jobContext = { company: 'Acme', title: 'Senior Engineer' }

    const preview = previewCoverLetterSources(profile, jobContext)

    expect(preview).toHaveProperty('tone')
    expect(preview).toHaveProperty('verbosity')
    expect(preview).toHaveProperty('avoidPhrases')
    expect(preview).toHaveProperty('matchingStories')
    expect(preview).toHaveProperty('matchingAchievements')
    expect(preview).toHaveProperty('gaps')
  })

  it('shows communication preferences', () => {
    const profile = createMockProfile({
      communication: {
        tone: 'formal',
        verbosity: 'concise',
        avoidPhrases: ['buzzwords']
      }
    })

    const preview = previewCoverLetterSources(profile, {})

    expect(preview.tone).toBe('formal')
    expect(preview.verbosity).toBe('concise')
    expect(preview.avoidPhrases).toContain('buzzwords')
  })

  it('shows matching stories with relevance', () => {
    const profile = createMockProfile()
    const jobContext = { title: 'Engineering Lead', keywords: ['leadership'] }

    const preview = previewCoverLetterSources(profile, jobContext)

    expect(preview.matchingStories.length).toBeGreaterThan(0)
    expect(preview.matchingStories[0]).toHaveProperty('id')
    expect(preview.matchingStories[0]).toHaveProperty('title')
    expect(preview.matchingStories[0]).toHaveProperty('relevance')
  })

  it('shows matching achievements with metrics', () => {
    const profile = createMockProfile()

    const preview = previewCoverLetterSources(profile, {})

    expect(preview.matchingAchievements.length).toBeGreaterThan(0)
    expect(preview.matchingAchievements[0]).toHaveProperty('project')
    expect(preview.matchingAchievements[0]).toHaveProperty('metric')
  })

  it('uses default tone when no preferences set', () => {
    const profile = createMockProfile()
    profile.preferences = {}

    const preview = previewCoverLetterSources(profile, {})

    expect(preview.tone).toBe('conversational')
    expect(preview.avoidPhrases).toEqual([])
  })
})

describe('buildCoverLetterFromProfile', () => {
  it('transforms profile to cover letter format', () => {
    const profile = createMockProfile()
    const jobContext = { company: 'Acme', title: 'Senior Engineer', hiringManager: 'Jane Doe' }

    const coverLetter = buildCoverLetterFromProfile(profile, jobContext)

    expect(coverLetter).toHaveProperty('contact')
    expect(coverLetter).toHaveProperty('tone')
    expect(coverLetter).toHaveProperty('avoid_phrases')
    expect(coverLetter).toHaveProperty('key_achievements')
    expect(coverLetter).toHaveProperty('relevant_story')
    expect(coverLetter).toHaveProperty('target_company', 'Acme')
    expect(coverLetter).toHaveProperty('target_title', 'Senior Engineer')
    expect(coverLetter).toHaveProperty('hiring_manager', 'Jane Doe')
  })

  it('includes contact from profile metadata', () => {
    const profile = createMockProfile({
      metadata: {
        name: 'John Doe',
        email: 'john@example.com'
      }
    })

    const coverLetter = buildCoverLetterFromProfile(profile, {})

    expect(coverLetter.contact.name).toBe('John Doe')
    expect(coverLetter.contact.email).toBe('john@example.com')
  })

  it('applies communication preferences', () => {
    const profile = createMockProfile({
      communication: {
        tone: 'formal',
        verbosity: 'detailed',
        emphasisAreas: ['strategic'],
        avoidPhrases: ['pivot']
      }
    })

    const coverLetter = buildCoverLetterFromProfile(profile, {})

    expect(coverLetter.tone).toBe('formal')
    expect(coverLetter.verbosity).toBe('detailed')
    expect(coverLetter.emphasis_areas).toContain('strategic')
    expect(coverLetter.avoid_phrases).toContain('pivot')
  })

  it('selects relevant story', () => {
    const profile = createMockProfile()
    const jobContext = { title: 'Engineering Lead', keywords: ['leadership'] }

    const coverLetter = buildCoverLetterFromProfile(profile, jobContext)

    expect(coverLetter.relevant_story).not.toBeNull()
    expect(coverLetter.relevant_story).toHaveProperty('title')
    expect(coverLetter.relevant_story).toHaveProperty('situation')
    expect(coverLetter.relevant_story).toHaveProperty('action')
    expect(coverLetter.relevant_story).toHaveProperty('result')
    expect(coverLetter.relevant_story).toHaveProperty('narrative')
  })

  it('extracts key achievements with metrics', () => {
    const profile = createMockProfile()

    const coverLetter = buildCoverLetterFromProfile(profile, {})

    expect(coverLetter.key_achievements.length).toBeGreaterThan(0)
    expect(coverLetter.key_achievements[0]).toHaveProperty('description')
    expect(coverLetter.key_achievements[0]).toHaveProperty('metric')
  })

  it('defaults hiring manager when not provided', () => {
    const profile = createMockProfile()

    const coverLetter = buildCoverLetterFromProfile(profile, { company: 'Test' })

    expect(coverLetter.hiring_manager).toBe('Hiring Manager')
  })

  it('handles missing stories gracefully', () => {
    const profile = createMockProfile({ stories: [] })
    profile.stories = []

    const coverLetter = buildCoverLetterFromProfile(profile, {})

    expect(coverLetter.relevant_story).toBeNull()
  })

  it('handles missing experience gracefully', () => {
    const profile = createMockProfile({ experience: [] })
    profile.experience = []

    const coverLetter = buildCoverLetterFromProfile(profile, {})

    expect(coverLetter.key_achievements).toEqual([])
  })
})

describe('getUsedCoverLetterItems', () => {
  it('returns list of used item IDs', () => {
    const profile = createMockProfile()

    const usedItems = getUsedCoverLetterItems(profile, {})

    expect(usedItems.length).toBeGreaterThan(0)
  })

  it('includes selected story', () => {
    const profile = createMockProfile()

    const usedItems = getUsedCoverLetterItems(profile, { title: 'Engineering Lead' })

    const storyItems = usedItems.filter((item) => item.itemType === 'story')
    expect(storyItems.length).toBeGreaterThan(0)
  })

  it('includes projects with achievements', () => {
    const profile = createMockProfile()

    const usedItems = getUsedCoverLetterItems(profile, {})

    const projectItems = usedItems.filter((item) => item.itemType === 'project')
    expect(projectItems.length).toBeGreaterThan(0)
  })

  it('handles empty profile', () => {
    const profile = {
      metadata: {},
      experience: [],
      stories: [],
      preferences: {}
    }

    const usedItems = getUsedCoverLetterItems(profile, {})

    expect(usedItems).toEqual([])
  })
})
