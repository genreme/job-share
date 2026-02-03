/**
 * Interview Learning Tools Tests
 * MCP tool wrappers for Phase 9 interview learning workflow
 *
 * Uses unique job ID range: 9300-9399 for test isolation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, readdirSync, unlinkSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

// Import tools to test
import {
  captureInterviewTranscript,
  getInterviewHistory,
  searchTranscripts,
  proposeInterviewLearnings,
  reviewInterviewLearning,
  linkLearningToProfile,
  confirmProfileLink,
  getProfileUpdateSuggestions,
  getInterviewPatterns,
  getCaptureReminders
} from './interview-learning.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const RESEARCH_DIR = join(DATA_DIR, 'job-research')
const JOBS_FILE = join(DATA_DIR, 'jobs.json')

// Test job IDs in unique range
const TEST_JOB_ID = 9300
const TEST_JOB_ID_2 = 9301
const TEST_JOB_ID_3 = 9302
const TEST_JOB_ID_4 = 9303
const TEST_JOB_ID_5 = 9304

// Cleanup helper
function cleanupTestFiles(jobId) {
  if (!existsSync(RESEARCH_DIR)) return

  const files = readdirSync(RESEARCH_DIR)
  for (const file of files) {
    if (file.startsWith(`${jobId}-`)) {
      try { unlinkSync(join(RESEARCH_DIR, file)) } catch (e) { /* ignore */ }
    }
  }
}

// Helper to create mock transcript
function createMockTranscript(jobId, sessionType = 'real-interview', extraFields = {}) {
  const args = {
    jobId,
    sessionType,
    interviewDate: new Date().toISOString(),
    interviewType: 'video',
    rawTranscript: 'This is a test transcript with some content about leadership and React.',
    ...extraFields
  }

  return captureInterviewTranscript(args)
}

// Helper to create mock learning
function createMockLearning(jobId, transcriptId, extraFields = {}) {
  return proposeInterviewLearnings({
    jobId,
    transcriptId,
    learnings: [{
      content: 'Learned about effective team leadership approaches',
      topic: 'behavioral',
      outcome: 'worked',
      ...extraFields
    }]
  })
}

describe('interview-learning tools', () => {
  beforeEach(() => {
    if (!existsSync(RESEARCH_DIR)) {
      mkdirSync(RESEARCH_DIR, { recursive: true })
    }
    cleanupTestFiles(TEST_JOB_ID)
    cleanupTestFiles(TEST_JOB_ID_2)
    cleanupTestFiles(TEST_JOB_ID_3)
    cleanupTestFiles(TEST_JOB_ID_4)
    cleanupTestFiles(TEST_JOB_ID_5)
  })

  afterEach(() => {
    cleanupTestFiles(TEST_JOB_ID)
    cleanupTestFiles(TEST_JOB_ID_2)
    cleanupTestFiles(TEST_JOB_ID_3)
    cleanupTestFiles(TEST_JOB_ID_4)
    cleanupTestFiles(TEST_JOB_ID_5)
  })

  // ==========================================
  // captureInterviewTranscript tests
  // ==========================================
  describe('captureInterviewTranscript', () => {
    it('captures transcript with required fields', () => {
      const result = captureInterviewTranscript({
        jobId: TEST_JOB_ID,
        sessionType: 'real-interview',
        interviewDate: '2025-01-15T10:00:00Z',
        interviewType: 'video',
        rawTranscript: 'Interview content here.'
      })

      expect(result.success).toBe(true)
      expect(result.transcriptId).toBeDefined()
      expect(result.message).toContain('captured successfully')
    })

    it('captures transcript with all optional fields', () => {
      const result = captureInterviewTranscript({
        jobId: TEST_JOB_ID,
        sessionType: 'practice',
        interviewDate: '2025-01-15T10:00:00Z',
        interviewType: 'phone',
        rawTranscript: 'Practice session transcript.',
        interviewerName: 'Jane Doe',
        confidenceLevel: 'high',
        overallVibe: 'went-well',
        highlights: ['Great question about React', 'Strong STAR story'],
        duration: 45,
        practiceSessionId: uuidv4() // Must be a valid UUID per schema
      })

      expect(result.success).toBe(true)
      expect(result.transcriptId).toBeDefined()
    })

    it('returns error when jobId missing', () => {
      const result = captureInterviewTranscript({
        sessionType: 'real-interview',
        interviewDate: '2025-01-15T10:00:00Z',
        interviewType: 'video',
        rawTranscript: 'Content'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('jobId')
    })

    it('returns error when sessionType missing', () => {
      const result = captureInterviewTranscript({
        jobId: TEST_JOB_ID,
        interviewDate: '2025-01-15T10:00:00Z',
        interviewType: 'video',
        rawTranscript: 'Content'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('sessionType')
    })

    it('returns error when interviewDate missing', () => {
      const result = captureInterviewTranscript({
        jobId: TEST_JOB_ID,
        sessionType: 'real-interview',
        interviewType: 'video',
        rawTranscript: 'Content'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('interviewDate')
    })

    it('returns error when interviewType missing', () => {
      const result = captureInterviewTranscript({
        jobId: TEST_JOB_ID,
        sessionType: 'real-interview',
        interviewDate: '2025-01-15T10:00:00Z',
        rawTranscript: 'Content'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('interviewType')
    })

    it('returns error when rawTranscript missing', () => {
      const result = captureInterviewTranscript({
        jobId: TEST_JOB_ID,
        sessionType: 'real-interview',
        interviewDate: '2025-01-15T10:00:00Z',
        interviewType: 'video'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('rawTranscript')
    })

    it('tracks transcript count for job', () => {
      const result1 = createMockTranscript(TEST_JOB_ID)
      expect(result1.message).toContain('1 total')

      const result2 = createMockTranscript(TEST_JOB_ID)
      expect(result2.message).toContain('2 total')
    })
  })

  // ==========================================
  // getInterviewHistory tests
  // ==========================================
  describe('getInterviewHistory', () => {
    it('returns empty array when no transcripts', () => {
      const result = getInterviewHistory({ jobId: TEST_JOB_ID })

      expect(result.interviews).toEqual([])
      expect(result.count).toBe(0)
    })

    it('returns transcripts for specific job', () => {
      createMockTranscript(TEST_JOB_ID)
      createMockTranscript(TEST_JOB_ID)
      createMockTranscript(TEST_JOB_ID_2) // Different job

      const result = getInterviewHistory({ jobId: TEST_JOB_ID })

      expect(result.count).toBe(2)
      expect(result.interviews.length).toBe(2)
    })

    it('returns chronological timeline when chronological=true', () => {
      createMockTranscript(TEST_JOB_ID)
      createMockTranscript(TEST_JOB_ID_2)

      const result = getInterviewHistory({ chronological: true })

      expect(result.count).toBeGreaterThanOrEqual(2)
    })

    it('returns chronological timeline when no jobId provided', () => {
      createMockTranscript(TEST_JOB_ID)
      createMockTranscript(TEST_JOB_ID_2)

      const result = getInterviewHistory({})

      expect(result.count).toBeGreaterThanOrEqual(2)
    })

    it('respects limit parameter', () => {
      createMockTranscript(TEST_JOB_ID)
      createMockTranscript(TEST_JOB_ID)
      createMockTranscript(TEST_JOB_ID)

      const result = getInterviewHistory({ jobId: TEST_JOB_ID, limit: 2 })

      expect(result.count).toBe(2)
    })
  })

  // ==========================================
  // searchTranscripts tests
  // ==========================================
  describe('searchTranscripts', () => {
    it('returns empty when no query', () => {
      const result = searchTranscripts({})

      expect(result.results).toEqual([])
      expect(result.error).toBeDefined()
    })

    it('searches and returns matching results', () => {
      createMockTranscript(TEST_JOB_ID, 'real-interview', {
        rawTranscript: 'Discussed React hooks and component lifecycle.'
      })

      const result = searchTranscripts({ query: 'React hooks' })

      expect(result.count).toBe(1)
      expect(result.results[0].rawTranscript).toContain('React')
    })

    it('filters by jobId', () => {
      createMockTranscript(TEST_JOB_ID, 'real-interview', {
        rawTranscript: 'Content about testing.'
      })
      createMockTranscript(TEST_JOB_ID_2, 'real-interview', {
        rawTranscript: 'Content about testing.'
      })

      const result = searchTranscripts({ query: 'testing', jobId: TEST_JOB_ID })

      expect(result.count).toBe(1)
    })

    it('filters by sessionType', () => {
      createMockTranscript(TEST_JOB_ID, 'practice', {
        rawTranscript: 'Practice session about algorithms.'
      })
      createMockTranscript(TEST_JOB_ID, 'real-interview', {
        rawTranscript: 'Real interview about algorithms.'
      })

      const result = searchTranscripts({ query: 'algorithms', sessionType: 'practice' })

      expect(result.count).toBe(1)
      expect(result.results[0].sessionType).toBe('practice')
    })

    it('respects limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        createMockTranscript(TEST_JOB_ID, 'real-interview', {
          rawTranscript: `Interview ${i} about unique topic.`
        })
      }

      const result = searchTranscripts({ query: 'unique', limit: 3 })

      expect(result.count).toBeLessThanOrEqual(3)
    })

    it('returns context snippets', () => {
      createMockTranscript(TEST_JOB_ID, 'real-interview', {
        rawTranscript: 'This is a longer transcript with context around the keyword engineering which we want to find.'
      })

      const result = searchTranscripts({ query: 'engineering' })

      expect(result.count).toBe(1)
      expect(result.results[0].contextSnippet).toBeDefined()
    })
  })

  // ==========================================
  // proposeInterviewLearnings tests
  // ==========================================
  describe('proposeInterviewLearnings', () => {
    let transcriptId

    beforeEach(() => {
      const result = createMockTranscript(TEST_JOB_ID_3)
      transcriptId = result.transcriptId
    })

    it('queues multiple learnings', () => {
      const result = proposeInterviewLearnings({
        jobId: TEST_JOB_ID_3,
        transcriptId,
        learnings: [
          { content: 'Discovered that storytelling approach resonates well with behavioral interviews', topic: 'behavioral', outcome: 'worked' },
          { content: 'Need to practice React hooks questions for future technical discussions', topic: 'technical', outcome: 'needs-work' }
        ]
      })

      expect(result.proposed).toBe(2)
      expect(result.learnings.length).toBe(2)
    })

    it('returns proposed count and learning IDs', () => {
      const result = proposeInterviewLearnings({
        jobId: TEST_JOB_ID_3,
        transcriptId,
        learnings: [
          { content: 'Test learning content', topic: 'behavioral', outcome: 'neutral' }
        ]
      })

      expect(result.proposed).toBe(1)
      expect(result.learnings[0].id).toBeDefined()
    })

    it('indicates which have suggested links', () => {
      const result = proposeInterviewLearnings({
        jobId: TEST_JOB_ID_3,
        transcriptId,
        learnings: [
          { content: 'Learning about leadership', topic: 'behavioral', outcome: 'worked' }
        ]
      })

      expect(result.learnings[0]).toHaveProperty('hasSuggestedLinks')
    })

    it('returns error when jobId missing', () => {
      const result = proposeInterviewLearnings({
        transcriptId,
        learnings: [{ content: 'Test', topic: 'behavioral', outcome: 'worked' }]
      })

      expect(result.proposed).toBe(0)
      expect(result.error).toContain('jobId')
    })

    it('returns error when transcriptId missing', () => {
      const result = proposeInterviewLearnings({
        jobId: TEST_JOB_ID_3,
        learnings: [{ content: 'Test', topic: 'behavioral', outcome: 'worked' }]
      })

      expect(result.proposed).toBe(0)
      expect(result.error).toContain('transcriptId')
    })

    it('returns error when learnings array empty', () => {
      const result = proposeInterviewLearnings({
        jobId: TEST_JOB_ID_3,
        transcriptId,
        learnings: []
      })

      expect(result.proposed).toBe(0)
      expect(result.error).toContain('learnings')
    })

    it('validates individual learning fields', () => {
      const result = proposeInterviewLearnings({
        jobId: TEST_JOB_ID_3,
        transcriptId,
        learnings: [
          { topic: 'behavioral', outcome: 'worked' }, // Missing content
          { content: 'Valid', outcome: 'worked' }, // Missing topic
          { content: 'Valid', topic: 'behavioral' } // Missing outcome
        ]
      })

      expect(result.proposed).toBe(0)
      expect(result.errors.length).toBe(3)
    })

    it('reports errors for invalid learnings', () => {
      const result = proposeInterviewLearnings({
        jobId: TEST_JOB_ID_3,
        transcriptId,
        learnings: [
          { content: 'Valid learning', topic: 'behavioral', outcome: 'worked' },
          { content: '', topic: 'behavioral', outcome: 'worked' } // Empty content
        ]
      })

      expect(result.proposed).toBe(1)
      expect(result.errors.length).toBe(1)
    })
  })

  // ==========================================
  // reviewInterviewLearning tests
  // ==========================================
  describe('reviewInterviewLearning', () => {
    let learningId

    beforeEach(() => {
      const transcriptResult = createMockTranscript(TEST_JOB_ID_4)
      const learningResult = createMockLearning(TEST_JOB_ID_4, transcriptResult.transcriptId)
      learningId = learningResult.learnings[0]?.id
    })

    it('accepts learning successfully', () => {
      const result = reviewInterviewLearning({
        learningId,
        decision: 'accept'
      })

      expect(result.success).toBe(true)
      expect(result.learning.status).toBe('accepted')
    })

    it('rejects learning successfully', () => {
      const result = reviewInterviewLearning({
        learningId,
        decision: 'reject'
      })

      expect(result.success).toBe(true)
      expect(result.learning.status).toBe('rejected')
    })

    it('returns updated learning object', () => {
      const result = reviewInterviewLearning({
        learningId,
        decision: 'accept'
      })

      expect(result.learning).toBeDefined()
      expect(result.learning.id).toBe(learningId)
      expect(result.learning.reviewedAt).toBeDefined()
    })

    it('returns error when learningId missing', () => {
      const result = reviewInterviewLearning({ decision: 'accept' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('learningId')
    })

    it('returns error when decision missing', () => {
      const result = reviewInterviewLearning({ learningId })

      expect(result.success).toBe(false)
      expect(result.error).toContain('decision')
    })

    it('returns error for invalid decision', () => {
      const result = reviewInterviewLearning({
        learningId,
        decision: 'invalid'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('accept')
    })

    it('returns error for non-existent learning', () => {
      const result = reviewInterviewLearning({
        learningId: 'nonexistent-id',
        decision: 'accept'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  // ==========================================
  // linkLearningToProfile tests
  // ==========================================
  describe('linkLearningToProfile', () => {
    let learningId

    beforeEach(() => {
      const transcriptResult = createMockTranscript(TEST_JOB_ID_4)
      const learningResult = createMockLearning(TEST_JOB_ID_4, transcriptResult.transcriptId)
      learningId = learningResult.learnings[0]?.id
    })

    it('returns suggested links for learning', () => {
      const result = linkLearningToProfile({ learningId })

      expect(result.learningId).toBe(learningId)
      expect(result.suggestedLinks).toBeDefined()
      expect(Array.isArray(result.suggestedLinks)).toBe(true)
    })

    it('indicates when no links available', () => {
      // Create a learning with no matching profile items
      const transcriptResult = createMockTranscript(TEST_JOB_ID_5)
      const learningResult = proposeInterviewLearnings({
        jobId: TEST_JOB_ID_5,
        transcriptId: transcriptResult.transcriptId,
        learnings: [{
          content: 'xyz123 unique content that matches nothing',
          topic: 'compensation',
          outcome: 'neutral'
        }]
      })
      const newLearningId = learningResult.learnings[0]?.id

      const result = linkLearningToProfile({ learningId: newLearningId })

      expect(result.hasLinks).toBe(false)
    })

    it('returns error when learningId missing', () => {
      const result = linkLearningToProfile({})

      expect(result.error).toContain('learningId')
    })

    it('returns error for non-existent learning', () => {
      const result = linkLearningToProfile({ learningId: 'nonexistent-id' })

      expect(result.error).toBeDefined()
    })
  })

  // ==========================================
  // confirmProfileLink tests
  // ==========================================
  describe('confirmProfileLink', () => {
    let learningId

    beforeEach(() => {
      const transcriptResult = createMockTranscript(TEST_JOB_ID_4)
      const learningResult = createMockLearning(TEST_JOB_ID_4, transcriptResult.transcriptId)
      learningId = learningResult.learnings[0]?.id
      // Accept the learning first
      reviewInterviewLearning({ learningId, decision: 'accept' })
    })

    it('confirms link successfully', () => {
      const result = confirmProfileLink({
        learningId,
        entityType: 'story',
        entityId: uuidv4()
      })

      expect(result.success).toBe(true)
      expect(result.link).toBeDefined()
      expect(result.link.entityType).toBe('story')
    })

    it('returns link with linkedAt timestamp', () => {
      const result = confirmProfileLink({
        learningId,
        entityType: 'skill',
        entityId: uuidv4()
      })

      expect(result.link.linkedAt).toBeDefined()
    })

    it('returns error for invalid entityType', () => {
      const result = confirmProfileLink({
        learningId,
        entityType: 'invalid',
        entityId: uuidv4()
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('entityType')
    })

    it('returns error when learningId missing', () => {
      const result = confirmProfileLink({
        entityType: 'story',
        entityId: uuidv4()
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('learningId')
    })

    it('returns error when entityType missing', () => {
      const result = confirmProfileLink({
        learningId,
        entityId: uuidv4()
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('entityType')
    })

    it('returns error when entityId missing', () => {
      const result = confirmProfileLink({
        learningId,
        entityType: 'story'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('entityId')
    })

    it('supports all entity types', () => {
      const storyResult = confirmProfileLink({
        learningId,
        entityType: 'story',
        entityId: uuidv4()
      })
      expect(storyResult.success).toBe(true)

      const skillResult = confirmProfileLink({
        learningId,
        entityType: 'skill',
        entityId: uuidv4()
      })
      expect(skillResult.success).toBe(true)

      const summaryResult = confirmProfileLink({
        learningId,
        entityType: 'summary',
        entityId: uuidv4()
      })
      expect(summaryResult.success).toBe(true)
    })
  })

  // ==========================================
  // getProfileUpdateSuggestions tests
  // ==========================================
  describe('getProfileUpdateSuggestions', () => {
    it('returns suggestions array', () => {
      const result = getProfileUpdateSuggestions()

      expect(result.suggestions).toBeDefined()
      expect(Array.isArray(result.suggestions)).toBe(true)
    })

    it('returns conflicts array', () => {
      const result = getProfileUpdateSuggestions()

      expect(result.conflicts).toBeDefined()
      expect(Array.isArray(result.conflicts)).toBe(true)
    })

    it('indicates hasConflicts status', () => {
      const result = getProfileUpdateSuggestions()

      expect(result.hasConflicts).toBeDefined()
      expect(typeof result.hasConflicts).toBe('boolean')
    })

    it('respects mode parameter batch', () => {
      const result = getProfileUpdateSuggestions({ mode: 'batch' })

      expect(result.suggestions).toBeDefined()
    })

    it('respects mode parameter aggregate', () => {
      const result = getProfileUpdateSuggestions({ mode: 'aggregate' })

      expect(result.suggestions).toBeDefined()
    })
  })

  // ==========================================
  // getInterviewPatterns tests
  // ==========================================
  describe('getInterviewPatterns', () => {
    it('returns patterns array', () => {
      const result = getInterviewPatterns()

      expect(result.patterns).toBeDefined()
      expect(Array.isArray(result.patterns)).toBe(true)
    })

    it('returns count', () => {
      const result = getInterviewPatterns()

      expect(result.count).toBeDefined()
      expect(typeof result.count).toBe('number')
    })

    it('respects minOccurrences parameter', () => {
      const result = getInterviewPatterns({ minOccurrences: 5 })

      expect(result.patterns).toBeDefined()
    })

    it('respects minCompanies parameter', () => {
      const result = getInterviewPatterns({ minCompanies: 3 })

      expect(result.patterns).toBeDefined()
    })

    it('handles empty results gracefully', () => {
      const result = getInterviewPatterns({ minOccurrences: 100 })

      expect(result.patterns).toEqual([])
      expect(result.count).toBe(0)
    })
  })

  // ==========================================
  // getCaptureReminders tests
  // ==========================================
  describe('getCaptureReminders', () => {
    it('returns needsCapture array', () => {
      const result = getCaptureReminders()

      expect(result.needsCapture).toBeDefined()
      expect(Array.isArray(result.needsCapture)).toBe(true)
    })

    it('returns count', () => {
      const result = getCaptureReminders()

      expect(result.count).toBeDefined()
      expect(typeof result.count).toBe('number')
    })

    it('checks single job when jobId provided', () => {
      const result = getCaptureReminders({ jobId: TEST_JOB_ID })

      expect(result.needsCapture).toBeDefined()
      // Should only have entries for this specific job or none
      for (const entry of result.needsCapture) {
        expect(entry.jobId).toBe(TEST_JOB_ID)
      }
    })

    it('checks all active jobs when no jobId', () => {
      const result = getCaptureReminders({})

      expect(result.needsCapture).toBeDefined()
      expect(result.count).toBeGreaterThanOrEqual(0)
    })

    it('handles non-existent job gracefully', () => {
      const result = getCaptureReminders({ jobId: 99999 })

      expect(result.needsCapture).toBeDefined()
      expect(result.count).toBe(0)
    })
  })

  // ==========================================
  // Error handling tests
  // ==========================================
  describe('error handling', () => {
    it('captureInterviewTranscript handles missing all params', () => {
      const result = captureInterviewTranscript({})
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('getInterviewHistory handles undefined args', () => {
      const result = getInterviewHistory()
      expect(result.interviews).toBeDefined()
    })

    it('searchTranscripts handles missing query', () => {
      const result = searchTranscripts({})
      expect(result.error).toBeDefined()
    })

    it('proposeInterviewLearnings handles missing params', () => {
      const result = proposeInterviewLearnings({})
      expect(result.error).toBeDefined()
    })

    it('reviewInterviewLearning handles missing params', () => {
      const result = reviewInterviewLearning({})
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('linkLearningToProfile handles missing params', () => {
      const result = linkLearningToProfile({})
      expect(result.error).toBeDefined()
    })

    it('confirmProfileLink handles missing params', () => {
      const result = confirmProfileLink({})
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('getProfileUpdateSuggestions handles undefined args', () => {
      const result = getProfileUpdateSuggestions()
      expect(result.suggestions).toBeDefined()
    })

    it('getInterviewPatterns handles undefined args', () => {
      const result = getInterviewPatterns()
      expect(result.patterns).toBeDefined()
    })

    it('getCaptureReminders handles undefined args', () => {
      const result = getCaptureReminders()
      expect(result.needsCapture).toBeDefined()
    })
  })
})
