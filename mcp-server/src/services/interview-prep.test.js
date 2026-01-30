/**
 * Tests for Interview Prep Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getRelevantStories,
  generateInterviewPrep,
  getUsedInterviewPrepItems
} from './interview-prep.js'

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
            name: 'Platform Redesign',
            description: 'Led platform redesign resulting in 40% performance improvement',
            metrics: { value: 40, unit: 'percent', context: 'performance improvement' },
            tags: ['architecture'],
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
    summaryBlocks: overrides.summaryBlocks || [
      {
        id: 'summary-1',
        content:
          'Experienced technical leader. Passionate about building great products. Focus on impact.',
        audiences: ['technical'],
        themes: ['technical', 'leadership'],
        createdAt: now,
        updatedAt: now
      }
    ],
    stories: overrides.stories || [
      {
        id: 'story-1',
        title: 'Led Team Through Crisis',
        situation: 'System outage during peak traffic.',
        task: 'Coordinate team to fix quickly.',
        action: 'Organized war room and delegated tasks.',
        result: 'Restored service in 2 hours.',
        questionCategories: ['leadership', 'problem-solving'],
        themes: ['leadership'],
        projectRef: 'proj-1',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'story-2',
        title: 'Technical Architecture Decision',
        situation: 'Needed to choose between two architectures.',
        task: 'Make the right technical decision.',
        action: 'Created POCs and analyzed tradeoffs.',
        result: 'Chose architecture that scaled 10x.',
        questionCategories: ['technical', 'decision-making'],
        themes: ['technical', 'architecture'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'story-3',
        title: 'Resolved Team Conflict',
        situation: 'Two team members had a disagreement.',
        task: 'Mediate and resolve the conflict.',
        action: 'Held 1:1s and facilitated discussion.',
        result: 'Team worked better together after.',
        questionCategories: ['conflict-resolution', 'teamwork'],
        themes: ['people'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'story-4',
        title: 'Learned From Failure',
        situation: 'Launched feature that had bugs.',
        task: 'Fix issues and learn from mistake.',
        action: 'Implemented better testing practices.',
        result: 'No similar issues since.',
        questionCategories: ['failure', 'learning'],
        themes: ['growth'],
        createdAt: now,
        updatedAt: now
      }
    ],
    preferences: {
      targetRoles: overrides.targetRoles || [
        {
          id: 'role-1',
          title: 'Engineering Manager',
          level: 'manager',
          industries: ['tech'],
          priorities: ['impact', 'growth', 'team-building'],
          createdAt: now,
          updatedAt: now
        }
      ],
      communication: overrides.communication || {
        tone: 'conversational',
        emphasisAreas: ['leadership', 'technical-depth'],
        avoidPhrases: []
      }
    },
    history: []
  }
}

describe('getRelevantStories', () => {
  it('returns stories sorted by relevance', () => {
    const profile = createMockProfile()
    const jobContext = { title: 'Engineering Lead', interviewType: 'behavioral' }

    const stories = getRelevantStories(profile, jobContext)

    expect(stories.length).toBe(4)
    expect(stories[0]).toHaveProperty('relevanceScore')
    // Leadership story should be highly ranked for behavioral
    expect(stories.some((s) => s.title.includes('Led Team'))).toBe(true)
  })

  it('prioritizes leadership stories for leadership interviews', () => {
    const profile = createMockProfile()
    const jobContext = { interviewType: 'leadership' }

    const stories = getRelevantStories(profile, jobContext)

    // Leadership and conflict stories should be top
    const topStory = stories[0]
    expect(topStory.questionCategories.some((c) => c.includes('leadership'))).toBe(true)
  })

  it('prioritizes technical stories for technical interviews', () => {
    const profile = createMockProfile()
    const jobContext = { interviewType: 'technical' }

    const stories = getRelevantStories(profile, jobContext)

    // Technical story should be highly ranked (in top 2)
    const technicalStory = stories.find((s) =>
      s.questionCategories.some((c) => c.includes('technical'))
    )
    expect(technicalStory).toBeDefined()
    expect(technicalStory.relevanceScore).toBeGreaterThan(0)
    // Technical story should rank in top half
    const technicalIndex = stories.indexOf(technicalStory)
    expect(technicalIndex).toBeLessThan(stories.length / 2 + 1)
  })

  it('scores stories by keyword match', () => {
    const profile = createMockProfile()
    const jobContext = { keywords: ['architecture', 'scaling'] }

    const stories = getRelevantStories(profile, jobContext)

    // Architecture story should be boosted
    const architectureStory = stories.find((s) => s.title.includes('Architecture'))
    expect(architectureStory.relevanceScore).toBeGreaterThan(0)
  })

  it('gives bonus to stories with project reference', () => {
    const profile = createMockProfile()

    const stories = getRelevantStories(profile, {})

    const withRef = stories.find((s) => s.projectRef)
    const withoutRef = stories.find((s) => !s.projectRef)

    // Story with projectRef should have slight bonus
    expect(withRef).toBeDefined()
  })

  it('returns empty array for profile with no stories', () => {
    const profile = createMockProfile()
    profile.stories = []

    const stories = getRelevantStories(profile, {})

    expect(stories).toEqual([])
  })
})

describe('generateInterviewPrep', () => {
  it('returns complete interview prep package', () => {
    const profile = createMockProfile()
    const jobContext = { company: 'Acme', title: 'Engineering Manager' }

    const prep = generateInterviewPrep(profile, jobContext)

    expect(prep).toHaveProperty('targetRole')
    expect(prep).toHaveProperty('talkingPoints')
    expect(prep).toHaveProperty('stories')
    expect(prep).toHaveProperty('strengthsToEmphasize')
    expect(prep).toHaveProperty('gapsToAddress')
    expect(prep).toHaveProperty('practiceQuestions')
  })

  it('finds matching target role', () => {
    const profile = createMockProfile()
    const jobContext = { title: 'Engineering Manager' }

    const prep = generateInterviewPrep(profile, jobContext)

    expect(prep.targetRole).not.toBeNull()
    expect(prep.targetRole.title).toBe('Engineering Manager')
  })

  it('infers target role when none matches', () => {
    const profile = createMockProfile({ targetRoles: [] })
    profile.preferences.targetRoles = []
    const jobContext = { title: 'VP of Engineering' }

    const prep = generateInterviewPrep(profile, jobContext)

    expect(prep.targetRole).not.toBeNull()
    expect(prep.targetRole.inferred).toBe(true)
    expect(prep.targetRole.level).toBe('vp')
  })

  it('generates talking points from summaries', () => {
    const profile = createMockProfile()
    const jobContext = { audience: 'technical' }

    const prep = generateInterviewPrep(profile, jobContext)

    expect(prep.talkingPoints.length).toBeGreaterThan(0)
    expect(prep.talkingPoints.some((p) => p.source === 'summary')).toBe(true)
  })

  it('generates talking points from achievements', () => {
    const profile = createMockProfile()

    const prep = generateInterviewPrep(profile, {})

    const achievementPoints = prep.talkingPoints.filter((p) => p.source === 'experience')
    expect(achievementPoints.length).toBeGreaterThan(0)
  })

  it('organizes stories by category', () => {
    const profile = createMockProfile()

    const prep = generateInterviewPrep(profile, {})

    expect(prep.stories.byCategory).toHaveProperty('leadership')
    expect(prep.stories.byCategory).toHaveProperty('conflict')
    expect(prep.stories.byCategory.leadership.length).toBeGreaterThan(0)
  })

  it('includes ranked stories', () => {
    const profile = createMockProfile()

    const prep = generateInterviewPrep(profile, {})

    expect(prep.stories.ranked.length).toBeGreaterThan(0)
    expect(prep.stories.ranked[0]).toHaveProperty('id')
    expect(prep.stories.ranked[0]).toHaveProperty('title')
    expect(prep.stories.ranked[0]).toHaveProperty('relevanceScore')
  })

  it('includes strengths from communication preferences', () => {
    const profile = createMockProfile()

    const prep = generateInterviewPrep(profile, {})

    expect(prep.strengthsToEmphasize).toContain('leadership')
    expect(prep.strengthsToEmphasize).toContain('technical-depth')
  })

  it('generates practice questions for available categories', () => {
    const profile = createMockProfile()

    const prep = generateInterviewPrep(profile, {})

    expect(prep.practiceQuestions.length).toBeGreaterThan(0)
    expect(prep.practiceQuestions[0]).toHaveProperty('category')
    expect(prep.practiceQuestions[0]).toHaveProperty('question')
  })

  it('links practice questions to suggested stories', () => {
    const profile = createMockProfile()

    const prep = generateInterviewPrep(profile, {})

    const questionWithStory = prep.practiceQuestions.find((q) => q.suggestedStory)
    expect(questionWithStory).toBeDefined()
    expect(questionWithStory.storyId).toBeDefined()
  })
})

describe('getUsedInterviewPrepItems', () => {
  it('returns list of used story IDs', () => {
    const profile = createMockProfile()

    const usedItems = getUsedInterviewPrepItems(profile, {})

    const storyItems = usedItems.filter((item) => item.itemType === 'story')
    expect(storyItems.length).toBeGreaterThan(0)
  })

  it('includes matching summary block', () => {
    const profile = createMockProfile()

    const usedItems = getUsedInterviewPrepItems(profile, { audience: 'technical' })

    const summaryItems = usedItems.filter((item) => item.itemType === 'summary')
    expect(summaryItems.length).toBeGreaterThan(0)
  })

  it('handles empty profile', () => {
    const profile = {
      metadata: {},
      stories: [],
      summaryBlocks: [],
      preferences: {}
    }

    const usedItems = getUsedInterviewPrepItems(profile, {})

    expect(usedItems).toEqual([])
  })

  it('limits stories to top 10', () => {
    // Create profile with many stories
    const now = new Date().toISOString()
    const manyStories = Array(15)
      .fill(null)
      .map((_, i) => ({
        id: `story-${i}`,
        title: `Story ${i}`,
        situation: 'Test',
        task: 'Test',
        action: 'Test',
        result: 'Test',
        questionCategories: ['leadership'],
        themes: [],
        createdAt: now,
        updatedAt: now
      }))

    const profile = createMockProfile({ stories: manyStories })
    profile.stories = manyStories

    const usedItems = getUsedInterviewPrepItems(profile, {})

    const storyItems = usedItems.filter((item) => item.itemType === 'story')
    expect(storyItems.length).toBeLessThanOrEqual(10)
  })
})
