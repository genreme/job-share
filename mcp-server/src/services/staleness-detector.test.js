/**
 * Staleness Detector Tests
 *
 * Tests staleness detection with BOTH age AND usage conditions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { detectStaleItems, STALENESS_THRESHOLDS } from './staleness-detector.js'

// Mock fs module for document history loading
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs')
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn()
  }
})

import { existsSync, readFileSync } from 'fs'

// =============================================================================
// TEST FIXTURES
// =============================================================================

const NOW = new Date('2026-01-30T10:00:00.000Z')

// Helper to create dates relative to NOW
const daysAgo = (days) => {
  const date = new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)
  return date.toISOString()
}

const createSkill = (id, name, updatedDaysAgo) => ({
  id,
  name,
  category: 'Technical',
  subcategory: 'General',
  proficiency: 'proficient',
  source: 'explicit',
  confidence: 85,
  evidence: ['proj-1'],
  createdAt: daysAgo(updatedDaysAgo + 30),
  updatedAt: daysAgo(updatedDaysAgo)
})

const createStory = (id, title, updatedDaysAgo) => ({
  id,
  title,
  situation: 'A challenge arose',
  task: 'Complete the task',
  action: 'Took action',
  result: 'Achieved result',
  questionCategories: ['leadership'],
  themes: ['team'],
  variants: [],
  createdAt: daysAgo(updatedDaysAgo + 30),
  updatedAt: daysAgo(updatedDaysAgo)
})

const createExperience = (id, title, updatedDaysAgo) => ({
  id,
  role: { title, company: 'Company Inc', startDate: '2020-01-01', endDate: null },
  projects: [
    {
      id: `${id}-proj`,
      name: 'Project A',
      description: 'Built something',
      tags: [],
      skillRefs: [],
      createdAt: daysAgo(updatedDaysAgo),
      updatedAt: daysAgo(updatedDaysAgo)
    }
  ],
  version: 1,
  createdAt: daysAgo(updatedDaysAgo + 30),
  updatedAt: daysAgo(updatedDaysAgo)
})

const createSummary = (id, content, updatedDaysAgo) => ({
  id,
  content,
  audiences: ['technical'],
  themes: ['general'],
  createdAt: daysAgo(updatedDaysAgo + 30),
  updatedAt: daysAgo(updatedDaysAgo)
})

// =============================================================================
// THRESHOLD TESTS
// =============================================================================

describe('Staleness Detector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('STALENESS_THRESHOLDS', () => {
    it('exports correct thresholds', () => {
      expect(STALENESS_THRESHOLDS.AGE_DAYS).toBe(180)
      expect(STALENESS_THRESHOLDS.USAGE_DAYS).toBe(90)
    })
  })

  // =============================================================================
  // BOTH CONDITIONS REQUIRED TESTS
  // =============================================================================

  describe('BOTH conditions required for staleness', () => {
    it('flags items that are old AND unused', () => {
      // Item is 200 days old (> 180) and not used
      const profile = {
        skills: [createSkill('skill-1', 'Old Unused Skill', 200)]
      }

      // No document history - items are considered unused
      vi.mocked(existsSync).mockReturnValue(false)

      const findings = detectStaleItems(profile)

      expect(findings).toHaveLength(1)
      expect(findings[0].type).toBe('stale')
      expect(findings[0].ids).toContain('skill-1')
    })

    it('does NOT flag items that are old but recently USED', () => {
      // Item is 200 days old but was used 30 days ago (within 90 day usage window)
      const profile = {
        skills: [createSkill('skill-1', 'Old But Used Skill', 200)]
      }

      // Document history shows recent usage
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          records: [
            {
              generatedAt: daysAgo(30), // Used 30 days ago
              usedItems: [{ itemId: 'skill-1', itemType: 'skill' }]
            }
          ]
        })
      )

      const findings = detectStaleItems(profile)

      expect(findings).toHaveLength(0) // Not stale because it's being used
    })

    it('does NOT flag items that are recently UPDATED even if unused', () => {
      // Item updated 30 days ago (< 180) but never used
      const profile = {
        skills: [createSkill('skill-1', 'Recently Updated Skill', 30)]
      }

      vi.mocked(existsSync).mockReturnValue(false)

      const findings = detectStaleItems(profile)

      expect(findings).toHaveLength(0) // Not stale because it's recently updated
    })

    it('does NOT flag items that are both recent AND used', () => {
      // Item updated 30 days ago and used 15 days ago
      const profile = {
        skills: [createSkill('skill-1', 'Active Skill', 30)]
      }

      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          records: [
            {
              generatedAt: daysAgo(15),
              usedItems: [{ itemId: 'skill-1', itemType: 'skill' }]
            }
          ]
        })
      )

      const findings = detectStaleItems(profile)

      expect(findings).toHaveLength(0)
    })
  })

  // =============================================================================
  // DOCUMENT HISTORY HANDLING TESTS
  // =============================================================================

  describe('document history handling', () => {
    it('treats items as unused when document-history.json does not exist', () => {
      const profile = {
        skills: [createSkill('skill-1', 'Old Skill', 200)]
      }

      vi.mocked(existsSync).mockReturnValue(false)

      const findings = detectStaleItems(profile)

      // Should be flagged because old + treated as unused
      expect(findings).toHaveLength(1)
      expect(findings[0].reason).toContain('never used in documents')
    })

    it('handles empty document history gracefully', () => {
      const profile = {
        skills: [createSkill('skill-1', 'Old Skill', 200)]
      }

      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ records: [] }))

      const findings = detectStaleItems(profile)

      expect(findings).toHaveLength(1)
    })

    it('handles malformed document history gracefully', () => {
      const profile = {
        skills: [createSkill('skill-1', 'Old Skill', 200)]
      }

      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue('invalid json')

      // Should not throw, should treat as empty
      const findings = detectStaleItems(profile)
      expect(findings).toHaveLength(1)
    })

    it('uses custom documentHistoryPath when provided', () => {
      const profile = {
        skills: [createSkill('skill-1', 'Old Skill', 200)]
      }

      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ records: [] }))

      detectStaleItems(profile, { documentHistoryPath: '/custom/path/history.json' })

      expect(vi.mocked(existsSync)).toHaveBeenCalledWith('/custom/path/history.json')
    })
  })

  // =============================================================================
  // ENTITY TYPE TESTS
  // =============================================================================

  describe('detects staleness for different entity types', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(false)
    })

    it('detects stale skills', () => {
      const profile = {
        skills: [createSkill('skill-1', 'Old Skill', 200)]
      }

      const findings = detectStaleItems(profile)

      expect(findings).toHaveLength(1)
      expect(findings[0].entityType).toBe('skill')
      expect(findings[0].suggestion).toContain('Old Skill')
    })

    it('detects stale stories', () => {
      const profile = {
        stories: [createStory('story-1', 'Old Story', 200)]
      }

      const findings = detectStaleItems(profile)

      expect(findings).toHaveLength(1)
      expect(findings[0].entityType).toBe('story')
      expect(findings[0].suggestion).toContain('Old Story')
    })

    it('detects stale experience entries', () => {
      const profile = {
        experience: [createExperience('exp-1', 'Old Role', 200)]
      }

      const findings = detectStaleItems(profile)

      expect(findings).toHaveLength(1)
      expect(findings[0].entityType).toBe('experience')
    })

    it('detects stale summary blocks', () => {
      const profile = {
        summaryBlocks: [createSummary('sum-1', 'Old summary content', 200)]
      }

      const findings = detectStaleItems(profile)

      expect(findings).toHaveLength(1)
      expect(findings[0].entityType).toBe('summary')
    })

    it('detects multiple stale items across types', () => {
      const profile = {
        skills: [createSkill('skill-1', 'Old Skill', 200)],
        stories: [createStory('story-1', 'Old Story', 250)],
        experience: [createExperience('exp-1', 'Old Role', 300)]
      }

      const findings = detectStaleItems(profile)

      expect(findings).toHaveLength(3)
      const types = findings.map((f) => f.entityType)
      expect(types).toContain('skill')
      expect(types).toContain('story')
      expect(types).toContain('experience')
    })
  })

  // =============================================================================
  // FINDING STRUCTURE TESTS
  // =============================================================================

  describe('finding structure', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(false)
    })

    it('includes all required fields', () => {
      const profile = {
        skills: [createSkill('skill-1', 'Old Skill', 200)]
      }

      const findings = detectStaleItems(profile)
      const finding = findings[0]

      expect(finding.type).toBe('stale')
      expect(finding.entityType).toBeDefined()
      expect(Array.isArray(finding.ids)).toBe(true)
      expect(finding.ids.length).toBe(1)
      expect(typeof finding.reason).toBe('string')
      expect(typeof finding.suggestion).toBe('string')
      expect(finding.createdAt).toBeDefined()
    })

    it('includes days since update in reason', () => {
      const profile = {
        skills: [createSkill('skill-1', 'Old Skill', 200)]
      }

      const findings = detectStaleItems(profile)

      expect(findings[0].reason).toContain('200 days')
    })

    it('includes usage info in reason', () => {
      const profile = {
        skills: [createSkill('skill-1', 'Old Skill', 200)]
      }

      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          records: [
            {
              generatedAt: daysAgo(100), // Used 100 days ago (> 90 day threshold)
              usedItems: [{ itemId: 'skill-1', itemType: 'skill' }]
            }
          ]
        })
      )

      const findings = detectStaleItems(profile)

      expect(findings[0].reason).toContain('100 days')
      expect(findings[0].reason).toContain('not used in documents')
    })
  })

  // =============================================================================
  // EDGE CASES
  // =============================================================================

  describe('edge cases', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(false)
    })

    it('handles empty profile', () => {
      const profile = {}
      const findings = detectStaleItems(profile)
      expect(findings).toHaveLength(0)
    })

    it('handles profile with empty arrays', () => {
      const profile = {
        skills: [],
        stories: [],
        summaryBlocks: [],
        experience: []
      }
      const findings = detectStaleItems(profile)
      expect(findings).toHaveLength(0)
    })

    it('handles item exactly at age threshold', () => {
      // Exactly 180 days old - should NOT be flagged (needs to be > 180)
      const profile = {
        skills: [createSkill('skill-1', 'Boundary Skill', 180)]
      }

      const findings = detectStaleItems(profile)

      // At exactly 180 days, updatedAt is at the cutoff
      // The check is updatedAt < ageCutoff, so exactly 180 should NOT trigger
      expect(findings).toHaveLength(0)
    })

    it('handles item just past age threshold', () => {
      // 181 days old - should be flagged
      const profile = {
        skills: [createSkill('skill-1', 'Old Skill', 181)]
      }

      const findings = detectStaleItems(profile)

      expect(findings).toHaveLength(1)
    })
  })

  // =============================================================================
  // SUGGESTION GENERATION TESTS
  // =============================================================================

  describe('suggestion generation', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(false)
    })

    it('generates skill-specific suggestion', () => {
      const profile = {
        skills: [createSkill('skill-1', 'Python', 200)]
      }

      const findings = detectStaleItems(profile)

      expect(findings[0].suggestion).toContain('Python')
      expect(findings[0].suggestion).toContain('familiar')
    })

    it('generates story-specific suggestion', () => {
      const profile = {
        stories: [createStory('story-1', 'Leadership Challenge', 200)]
      }

      const findings = detectStaleItems(profile)

      expect(findings[0].suggestion).toContain('Leadership Challenge')
      expect(findings[0].suggestion).toContain('example')
    })

    it('generates experience-specific suggestion', () => {
      const profile = {
        experience: [createExperience('exp-1', 'Senior Engineer', 200)]
      }

      const findings = detectStaleItems(profile)

      expect(findings[0].suggestion).toContain('project descriptions')
      expect(findings[0].suggestion).toContain('metrics')
    })

    it('generates summary-specific suggestion', () => {
      const profile = {
        summaryBlocks: [createSummary('sum-1', 'Old summary', 200)]
      }

      const findings = detectStaleItems(profile)

      expect(findings[0].suggestion).toContain('outdated')
      expect(findings[0].suggestion).toContain('accomplishments')
    })
  })
})
