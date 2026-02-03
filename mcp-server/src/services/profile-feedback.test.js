/**
 * Profile Feedback Service Tests
 *
 * Tests for updateProfileConfidence, getProfileUpdateSuggestions,
 * getInterviewPatterns, and detectConflicts.
 *
 * Uses job ID range 9300-9399 for test isolation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { unlinkSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  updateProfileConfidence,
  getProfileUpdateSuggestions,
  getInterviewPatterns,
  detectConflicts
} from './profile-feedback.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const RESEARCH_DIR = join(DATA_DIR, 'job-research')
const PROFILE_DIR = join(DATA_DIR, 'profile')
const PROFILE_PATH = join(PROFILE_DIR, 'master-profile.json')

// Ensure research directory exists
if (!existsSync(RESEARCH_DIR)) {
  mkdirSync(RESEARCH_DIR, { recursive: true })
}

// Helper to clean up test files
function cleanupTestFiles(jobIds) {
  for (const jobId of jobIds) {
    try {
      const filePath = join(RESEARCH_DIR, `${jobId}-learnings.json`)
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Helper to create learnings file
function createLearningsFile(jobId, learnings) {
  const filePath = join(RESEARCH_DIR, `${jobId}-learnings.json`)
  writeFileSync(filePath, JSON.stringify({
    learnings,
    lastUpdated: new Date().toISOString()
  }, null, 2))
}

// Store and restore original profile
let originalProfile = null

function backupProfile() {
  if (existsSync(PROFILE_PATH)) {
    originalProfile = readFileSync(PROFILE_PATH, 'utf-8')
  }
}

function restoreProfile() {
  if (originalProfile !== null) {
    writeFileSync(PROFILE_PATH, originalProfile)
    originalProfile = null
  }
}

function setTestProfile(profile) {
  writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2))
}

// UUID constants for tests - valid UUIDv4 format
const LEARNING_1_ID = 'a1a1a1a1-1111-4111-8111-111111111111'
const LEARNING_2_ID = 'a2a2a2a2-2222-4222-8222-222222222222'
const LEARNING_3_ID = 'a3a3a3a3-3333-4333-8333-333333333333'
const LEARNING_4_ID = 'a4a4a4a4-4444-4444-8444-444444444444'
const LEARNING_5_ID = 'a5a5a5a5-5555-4555-8555-555555555555'
const STORY_ID = 'b1b1b1b1-1111-4111-8111-111111111111'
const SKILL_ID = 'c1c1c1c1-1111-4111-8111-111111111111'
const SUMMARY_ID = 'd1d1d1d1-1111-4111-8111-111111111111'
const TRANSCRIPT_ID = 'e1e1e1e1-1111-4111-8111-111111111111'

// Valid learning fixture
function createValidLearning(overrides = {}) {
  return {
    id: LEARNING_1_ID,
    jobId: 9301,
    transcriptId: TRANSCRIPT_ID,
    content: 'My explanation of system design concepts was well-received.',
    topic: 'technical',
    outcome: 'worked',
    status: 'accepted',
    extractedAt: new Date().toISOString(),
    suggestedProfileLinks: [],
    confirmedProfileLinks: [],
    ...overrides
  }
}

// Valid profile fixture
function createTestProfile(overrides = {}) {
  return {
    metadata: {
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: '1.0'
    },
    experience: [],
    skills: [
      {
        id: SKILL_ID,
        name: 'System Design',
        level: 'advanced',
        category: 'technical'
      }
    ],
    summaryBlocks: [
      {
        id: SUMMARY_ID,
        label: 'Professional Summary',
        content: 'Experienced software engineer with strong technical skills.'
      }
    ],
    stories: [
      {
        id: STORY_ID,
        title: 'Led Technical Migration',
        situation: 'Legacy system needed modernization',
        task: 'Design and implement migration plan',
        action: 'Created phased approach with minimal downtime',
        result: 'Successful migration with zero data loss'
      }
    ],
    preferences: {
      targetRoles: [],
      communication: null
    },
    history: [],
    ...overrides
  }
}

describe('Profile Feedback Service', () => {
  const testJobIds = Array.from({ length: 100 }, (_, i) => 9300 + i)

  beforeEach(() => {
    cleanupTestFiles(testJobIds)
    backupProfile()
  })

  afterEach(() => {
    cleanupTestFiles(testJobIds)
    restoreProfile()
  })

  // ===========================================================================
  // updateProfileConfidence
  // ===========================================================================

  describe('updateProfileConfidence', () => {
    it('updates confidence for linked items', () => {
      setTestProfile(createTestProfile())

      const learning = createValidLearning({
        id: LEARNING_1_ID,
        jobId: 9301,
        outcome: 'worked',
        confirmedProfileLinks: [
          { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
        ]
      })
      createLearningsFile(9301, [learning])

      const result = updateProfileConfidence(LEARNING_1_ID, 'worked')

      expect(result.updated).toBe(true)
      expect(result.items).toHaveLength(1)
      expect(result.items[0].interviewUsage.totalUses).toBe(1)
      expect(result.items[0].interviewUsage.workedCount).toBe(1)
      expect(result.items[0].interviewUsage.interviewConfidence).toBe(100)
    })

    it('initializes interviewUsage if not present', () => {
      setTestProfile(createTestProfile())

      const learning = createValidLearning({
        id: LEARNING_1_ID,
        jobId: 9302,
        confirmedProfileLinks: [
          { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
        ]
      })
      createLearningsFile(9302, [learning])

      const result = updateProfileConfidence(LEARNING_1_ID, 'worked')

      expect(result.updated).toBe(true)
      expect(result.items[0].interviewUsage).toBeDefined()
      expect(result.items[0].interviewUsage.totalUses).toBe(1)
    })

    it('increments workedCount for worked outcome', () => {
      const profile = createTestProfile()
      profile.skills[0].interviewUsage = { totalUses: 1, workedCount: 0, needsWorkCount: 1 }
      setTestProfile(profile)

      const learning = createValidLearning({
        id: LEARNING_1_ID,
        jobId: 9303,
        confirmedProfileLinks: [
          { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
        ]
      })
      createLearningsFile(9303, [learning])

      const result = updateProfileConfidence(LEARNING_1_ID, 'worked')

      expect(result.items[0].interviewUsage.workedCount).toBe(1)
      expect(result.items[0].interviewUsage.totalUses).toBe(2)
    })

    it('increments needsWorkCount for needs-work outcome', () => {
      const profile = createTestProfile()
      profile.skills[0].interviewUsage = { totalUses: 1, workedCount: 1, needsWorkCount: 0 }
      setTestProfile(profile)

      const learning = createValidLearning({
        id: LEARNING_1_ID,
        jobId: 9304,
        confirmedProfileLinks: [
          { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
        ]
      })
      createLearningsFile(9304, [learning])

      const result = updateProfileConfidence(LEARNING_1_ID, 'needs-work')

      expect(result.items[0].interviewUsage.needsWorkCount).toBe(1)
      expect(result.items[0].interviewUsage.totalUses).toBe(2)
    })

    it('calculates interviewConfidence correctly', () => {
      const profile = createTestProfile()
      profile.skills[0].interviewUsage = { totalUses: 3, workedCount: 2, needsWorkCount: 1 }
      setTestProfile(profile)

      const learning = createValidLearning({
        id: LEARNING_1_ID,
        jobId: 9305,
        confirmedProfileLinks: [
          { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
        ]
      })
      createLearningsFile(9305, [learning])

      const result = updateProfileConfidence(LEARNING_1_ID, 'worked')

      // 3 worked out of 4 total = 75%
      expect(result.items[0].interviewUsage.interviewConfidence).toBe(75)
    })

    it('handles neutral outcome (increments totalUses only)', () => {
      const profile = createTestProfile()
      profile.skills[0].interviewUsage = { totalUses: 2, workedCount: 1, needsWorkCount: 1 }
      setTestProfile(profile)

      const learning = createValidLearning({
        id: LEARNING_1_ID,
        jobId: 9306,
        confirmedProfileLinks: [
          { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
        ]
      })
      createLearningsFile(9306, [learning])

      const result = updateProfileConfidence(LEARNING_1_ID, 'neutral')

      expect(result.items[0].interviewUsage.totalUses).toBe(3)
      expect(result.items[0].interviewUsage.workedCount).toBe(1)
      expect(result.items[0].interviewUsage.needsWorkCount).toBe(1)
    })

    it('returns error for non-existent learning', () => {
      const result = updateProfileConfidence('99999999-9999-4999-8999-999999999999', 'worked')

      expect(result.updated).toBe(false)
      expect(result.reason).toContain('not found')
    })

    it('returns error for learning with no confirmed links', () => {
      setTestProfile(createTestProfile())

      const learning = createValidLearning({
        id: LEARNING_1_ID,
        jobId: 9307,
        confirmedProfileLinks: []
      })
      createLearningsFile(9307, [learning])

      const result = updateProfileConfidence(LEARNING_1_ID, 'worked')

      expect(result.updated).toBe(false)
      expect(result.reason).toContain('No confirmed profile links')
    })

    it('returns error for invalid outcome', () => {
      const result = updateProfileConfidence(LEARNING_1_ID, 'invalid')

      expect(result.updated).toBe(false)
      expect(result.reason).toContain('Invalid outcome')
    })

    it('handles multiple linked items', () => {
      setTestProfile(createTestProfile())

      const learning = createValidLearning({
        id: LEARNING_1_ID,
        jobId: 9308,
        confirmedProfileLinks: [
          { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() },
          { entityType: 'story', entityId: STORY_ID, linkedAt: new Date().toISOString() }
        ]
      })
      createLearningsFile(9308, [learning])

      const result = updateProfileConfidence(LEARNING_1_ID, 'worked')

      expect(result.updated).toBe(true)
      expect(result.items).toHaveLength(2)
    })
  })

  // ===========================================================================
  // getProfileUpdateSuggestions
  // ===========================================================================

  describe('getProfileUpdateSuggestions', () => {
    it('groups suggestions by profile item', () => {
      setTestProfile(createTestProfile())

      const learnings = [
        createValidLearning({
          id: LEARNING_1_ID,
          jobId: 9310,
          outcome: 'worked',
          confirmedProfileLinks: [
            { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
          ]
        }),
        createValidLearning({
          id: LEARNING_2_ID,
          jobId: 9310,
          content: 'Also demonstrated strong skills in database design',
          outcome: 'worked',
          confirmedProfileLinks: [
            { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
          ]
        })
      ]
      createLearningsFile(9310, learnings)

      const result = getProfileUpdateSuggestions()

      // Should group both learnings under the same skill
      const skillSuggestion = result.find(s => s.entityId === SKILL_ID)
      expect(skillSuggestion).toBeDefined()
      expect(skillSuggestion.workedCount).toBe(2)
    })

    it('detects conflicts (mixed worked/needs-work)', () => {
      setTestProfile(createTestProfile())

      const learnings = [
        createValidLearning({
          id: LEARNING_1_ID,
          jobId: 9311,
          outcome: 'worked',
          confirmedProfileLinks: [
            { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
          ]
        }),
        createValidLearning({
          id: LEARNING_2_ID,
          jobId: 9311,
          content: 'Struggled to explain the architecture clearly',
          outcome: 'needs-work',
          confirmedProfileLinks: [
            { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
          ]
        })
      ]
      createLearningsFile(9311, learnings)

      const result = getProfileUpdateSuggestions()

      const skillSuggestion = result.find(s => s.entityId === SKILL_ID)
      expect(skillSuggestion.hasConflict).toBe(true)
      expect(skillSuggestion.recommendation).toContain('Mixed results')
    })

    it('generates appropriate recommendations', () => {
      setTestProfile(createTestProfile())

      // Create skill with only worked outcomes
      const learnings = [
        createValidLearning({
          id: LEARNING_1_ID,
          jobId: 9312,
          outcome: 'worked',
          confirmedProfileLinks: [
            { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
          ]
        })
      ]
      createLearningsFile(9312, learnings)

      const result = getProfileUpdateSuggestions()

      const skillSuggestion = result.find(s => s.entityId === SKILL_ID)
      expect(skillSuggestion.recommendation).toContain('Working well')
    })

    it('includes entityName from profile', () => {
      setTestProfile(createTestProfile())

      const learning = createValidLearning({
        id: LEARNING_1_ID,
        jobId: 9313,
        confirmedProfileLinks: [
          { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
        ]
      })
      createLearningsFile(9313, [learning])

      const result = getProfileUpdateSuggestions()

      const skillSuggestion = result.find(s => s.entityId === SKILL_ID)
      expect(skillSuggestion.entityName).toBe('System Design')
    })

    it('returns empty array when no accepted learnings', () => {
      setTestProfile(createTestProfile())
      // No learnings files created

      const result = getProfileUpdateSuggestions()

      expect(result).toEqual([])
    })

    it('only processes accepted learnings', () => {
      setTestProfile(createTestProfile())

      const learnings = [
        createValidLearning({
          id: LEARNING_1_ID,
          jobId: 9314,
          status: 'proposed', // Not accepted
          confirmedProfileLinks: [
            { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
          ]
        })
      ]
      createLearningsFile(9314, learnings)

      const result = getProfileUpdateSuggestions()

      expect(result).toEqual([])
    })
  })

  // ===========================================================================
  // getInterviewPatterns
  // ===========================================================================

  describe('getInterviewPatterns', () => {
    it('detects recurring patterns (3+ occurrences)', () => {
      setTestProfile(createTestProfile())

      // Create very similar learnings across multiple jobs (high similarity)
      createLearningsFile(9320, [
        createValidLearning({
          id: LEARNING_1_ID,
          jobId: 9320,
          content: 'Tell me about a time you handled conflict on your team'
        })
      ])
      createLearningsFile(9321, [
        createValidLearning({
          id: LEARNING_2_ID,
          jobId: 9321,
          content: 'Tell me about a time you handled conflict on your team at work'
        })
      ])
      createLearningsFile(9322, [
        createValidLearning({
          id: LEARNING_3_ID,
          jobId: 9322,
          content: 'Tell me about a time you handled conflict on your team recently'
        })
      ])

      const result = getInterviewPatterns()

      expect(result.length).toBeGreaterThan(0)
      const pattern = result[0]
      expect(pattern.occurrences).toBeGreaterThanOrEqual(3)
    })

    it('requires minimum 2 different companies', () => {
      setTestProfile(createTestProfile())

      // Create 3 learnings but all from same job
      createLearningsFile(9323, [
        createValidLearning({
          id: LEARNING_1_ID,
          jobId: 9323,
          content: 'Unique pattern content about React'
        }),
        createValidLearning({
          id: LEARNING_2_ID,
          jobId: 9323,
          content: 'Unique pattern content about React hooks'
        }),
        createValidLearning({
          id: LEARNING_3_ID,
          jobId: 9323,
          content: 'Unique pattern content about React state'
        })
      ])

      const result = getInterviewPatterns()

      // Should not find a pattern because all from same company
      const reactPattern = result.find(p => p.examples?.some(e => e.includes('React')))
      expect(reactPattern).toBeUndefined()
    })

    it('groups by content similarity', () => {
      setTestProfile(createTestProfile())

      createLearningsFile(9324, [
        createValidLearning({
          id: LEARNING_1_ID,
          jobId: 9324,
          content: 'Behavioral question about conflict resolution'
        })
      ])
      createLearningsFile(9325, [
        createValidLearning({
          id: LEARNING_2_ID,
          jobId: 9325,
          content: 'Behavioral question about conflict resolution style'
        })
      ])
      createLearningsFile(9326, [
        createValidLearning({
          id: LEARNING_3_ID,
          jobId: 9326,
          content: 'Behavioral questions about conflict resolution approach'
        })
      ])

      const result = getInterviewPatterns()

      // Should group these similar contents
      expect(result.length).toBeGreaterThan(0)
    })

    it('returns outcome distribution', () => {
      setTestProfile(createTestProfile())

      createLearningsFile(9327, [
        createValidLearning({
          id: LEARNING_1_ID,
          jobId: 9327,
          content: 'Distributed systems architecture question',
          outcome: 'worked'
        })
      ])
      createLearningsFile(9328, [
        createValidLearning({
          id: LEARNING_2_ID,
          jobId: 9328,
          content: 'Distributed systems architecture design',
          outcome: 'needs-work'
        })
      ])
      createLearningsFile(9329, [
        createValidLearning({
          id: LEARNING_3_ID,
          jobId: 9329,
          content: 'Distributed systems architecture patterns',
          outcome: 'worked'
        })
      ])

      const result = getInterviewPatterns()

      if (result.length > 0) {
        const pattern = result[0]
        expect(pattern.outcomeDistribution).toBeDefined()
        expect(typeof pattern.outcomeDistribution.worked).toBe('number')
        expect(typeof pattern.outcomeDistribution['needs-work']).toBe('number')
      }
    })

    it('respects minOccurrences option', () => {
      setTestProfile(createTestProfile())

      createLearningsFile(9330, [
        createValidLearning({
          id: LEARNING_1_ID,
          jobId: 9330,
          content: 'Custom min occurrences test pattern'
        })
      ])
      createLearningsFile(9331, [
        createValidLearning({
          id: LEARNING_2_ID,
          jobId: 9331,
          content: 'Custom min occurrences test pattern variant'
        })
      ])

      // With default minOccurrences=3, should not find pattern
      const resultDefault = getInterviewPatterns()
      const patternDefault = resultDefault.find(p =>
        p.examples?.some(e => e.includes('Custom min occurrences'))
      )
      expect(patternDefault).toBeUndefined()

      // With minOccurrences=2, should find pattern
      const resultCustom = getInterviewPatterns({ minOccurrences: 2, minCompanies: 2 })
      const patternCustom = resultCustom.find(p =>
        p.examples?.some(e => e.includes('Custom min'))
      )
      expect(patternCustom).toBeDefined()
    })

    it('returns empty array when no learnings exist', () => {
      setTestProfile(createTestProfile())
      // No learnings files created

      const result = getInterviewPatterns()

      expect(result).toEqual([])
    })
  })

  // ===========================================================================
  // detectConflicts
  // ===========================================================================

  describe('detectConflicts', () => {
    it('detects conflicting outcomes on same item', () => {
      setTestProfile(createTestProfile())

      const learnings = [
        createValidLearning({
          id: LEARNING_1_ID,
          jobId: 9340,
          outcome: 'worked',
          confirmedProfileLinks: [
            { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
          ]
        }),
        createValidLearning({
          id: LEARNING_2_ID,
          jobId: 9340,
          content: 'Had difficulty explaining the concept clearly',
          outcome: 'needs-work',
          confirmedProfileLinks: [
            { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
          ]
        })
      ]
      createLearningsFile(9340, learnings)

      const result = detectConflicts()

      const conflict = result.find(c => c.entityId === SKILL_ID)
      expect(conflict).toBeDefined()
      expect(conflict.conflictType).toBe('mixed-outcomes')
    })

    it('detects content conflicts with profile', () => {
      const profile = createTestProfile()
      profile.skills[0].level = 'expert'
      setTestProfile(profile)

      const learning = createValidLearning({
        id: LEARNING_1_ID,
        jobId: 9341,
        content: 'I struggled with the advanced system design question',
        outcome: 'needs-work',
        confirmedProfileLinks: [
          { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
        ]
      })
      createLearningsFile(9341, [learning])

      const result = detectConflicts()

      const conflict = result.find(c => c.conflictType === 'content-level-mismatch')
      expect(conflict).toBeDefined()
      expect(conflict.suggestion).toContain('expert')
    })

    it('returns actionable suggestions', () => {
      setTestProfile(createTestProfile())

      const learnings = [
        createValidLearning({
          id: LEARNING_1_ID,
          jobId: 9342,
          outcome: 'worked',
          confirmedProfileLinks: [
            { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
          ]
        }),
        createValidLearning({
          id: LEARNING_2_ID,
          jobId: 9342,
          content: 'Did not go as well',
          outcome: 'needs-work',
          confirmedProfileLinks: [
            { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
          ]
        })
      ]
      createLearningsFile(9342, learnings)

      const result = detectConflicts()

      const conflict = result.find(c => c.entityId === SKILL_ID)
      expect(conflict.suggestion).toBeDefined()
      expect(typeof conflict.suggestion).toBe('string')
      expect(conflict.suggestion.length).toBeGreaterThan(0)
    })

    it('no conflicts for consistent outcomes', () => {
      setTestProfile(createTestProfile())

      const learnings = [
        createValidLearning({
          id: LEARNING_1_ID,
          jobId: 9343,
          outcome: 'worked',
          confirmedProfileLinks: [
            { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
          ]
        }),
        createValidLearning({
          id: LEARNING_2_ID,
          jobId: 9343,
          content: 'Another positive experience',
          outcome: 'worked',
          confirmedProfileLinks: [
            { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
          ]
        })
      ]
      createLearningsFile(9343, learnings)

      const result = detectConflicts()

      const conflict = result.find(c => c.entityId === SKILL_ID && c.conflictType === 'mixed-outcomes')
      expect(conflict).toBeUndefined()
    })

    it('returns empty array when no conflicts exist', () => {
      setTestProfile(createTestProfile())

      const learning = createValidLearning({
        id: LEARNING_1_ID,
        jobId: 9344,
        outcome: 'worked',
        confirmedProfileLinks: []
      })
      createLearningsFile(9344, [learning])

      const result = detectConflicts()

      expect(result).toEqual([])
    })

    it('includes learning details in conflicts', () => {
      setTestProfile(createTestProfile())

      const learnings = [
        createValidLearning({
          id: LEARNING_1_ID,
          jobId: 9345,
          outcome: 'worked',
          confirmedProfileLinks: [
            { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
          ]
        }),
        createValidLearning({
          id: LEARNING_2_ID,
          jobId: 9345,
          content: 'Different content',
          outcome: 'needs-work',
          confirmedProfileLinks: [
            { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
          ]
        })
      ]
      createLearningsFile(9345, learnings)

      const result = detectConflicts()

      const conflict = result.find(c => c.entityId === SKILL_ID)
      expect(conflict.learnings).toBeDefined()
      expect(conflict.learnings.length).toBe(2)
      expect(conflict.learnings[0].id).toBeDefined()
      expect(conflict.learnings[0].outcome).toBeDefined()
    })
  })

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles missing profile items gracefully', () => {
      setTestProfile(createTestProfile())

      const learning = createValidLearning({
        id: LEARNING_1_ID,
        jobId: 9350,
        confirmedProfileLinks: [
          { entityType: 'skill', entityId: '00000000-0000-4000-8000-000000000000', linkedAt: new Date().toISOString() }
        ]
      })
      createLearningsFile(9350, [learning])

      const result = updateProfileConfidence(LEARNING_1_ID, 'worked')

      // Should complete without error, but no items updated
      expect(result.updated).toBe(false)
    })

    it('handles concurrent updates to same profile item', () => {
      setTestProfile(createTestProfile())

      const learning1 = createValidLearning({
        id: LEARNING_1_ID,
        jobId: 9351,
        confirmedProfileLinks: [
          { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
        ]
      })
      const learning2 = createValidLearning({
        id: LEARNING_2_ID,
        jobId: 9352,
        content: 'Different learning content',
        confirmedProfileLinks: [
          { entityType: 'skill', entityId: SKILL_ID, linkedAt: new Date().toISOString() }
        ]
      })
      createLearningsFile(9351, [learning1])
      createLearningsFile(9352, [learning2])

      // Update both
      updateProfileConfidence(LEARNING_1_ID, 'worked')
      const result = updateProfileConfidence(LEARNING_2_ID, 'worked')

      // Second update should see incremented counter
      expect(result.items[0].interviewUsage.totalUses).toBe(2)
    })
  })
})
