/**
 * Practice Session Service Tests
 *
 * Tests for createPracticeSession, submitAnswer, completeSession, getSessionsForJob, getSession
 * Uses job ID range 9200-9299 for test isolation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  createPracticeSession,
  submitAnswer,
  completeSession,
  getSessionsForJob,
  getSession
} from './practice-session.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESEARCH_DIR = join(__dirname, '..', '..', 'data', 'job-research')

// Ensure research directory exists
if (!existsSync(RESEARCH_DIR)) {
  mkdirSync(RESEARCH_DIR, { recursive: true })
}

// Helper to clean up test files
function cleanupTestFiles(jobId) {
  const files = [
    `${jobId}-questions.json`,
    `${jobId}-practice-sessions.json`
  ]
  for (const file of files) {
    try {
      const filePath = join(RESEARCH_DIR, file)
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// UUID constants for test questions (valid UUID v4 format)
const Q1_ID = '11111111-1111-4111-a111-111111111111'
const Q2_ID = '22222222-2222-4222-a222-222222222222'
const Q3_ID = '33333333-3333-4333-a333-333333333333'
const S1_ID = '44444444-4444-4444-a444-444444444444'

// Mock questions data
function createMockQuestions(jobId = 9201) {
  return {
    jobId,
    generatedAt: new Date().toISOString(),
    options: { categories: ['behavioral', 'technical'], count: 5 },
    questions: [
      {
        id: Q1_ID,
        jobId,
        questionText: 'Tell me about a time you led a project.',
        category: 'behavioral',
        difficulty: 'medium',
        source: 'profile-strength',
        sourceDetail: 'Leadership',
        suggestedStories: [{ storyId: S1_ID, storyTitle: 'Led API Redesign', relevanceScore: 80 }],
        talkingPoints: [],
        generatedAt: new Date().toISOString()
      },
      {
        id: Q2_ID,
        jobId,
        questionText: 'How would you implement a REST API?',
        category: 'technical',
        difficulty: 'medium',
        source: 'jd-requirement',
        sourceDetail: 'Required skill: API',
        suggestedStories: [],
        talkingPoints: [],
        generatedAt: new Date().toISOString()
      },
      {
        id: Q3_ID,
        jobId,
        questionText: 'Describe a conflict you resolved.',
        category: 'behavioral',
        difficulty: 'easy',
        source: 'profile-strength',
        sourceDetail: 'Conflict resolution',
        suggestedStories: [],
        talkingPoints: [],
        generatedAt: new Date().toISOString()
      }
    ]
  }
}

describe('Practice Session Service', () => {
  beforeEach(() => {
    // Clean up before each test
    for (let i = 9200; i <= 9220; i++) {
      cleanupTestFiles(i)
    }

    // Create mock questions file - this is what getQuestionsForJob reads
    writeFileSync(
      join(RESEARCH_DIR, '9201-questions.json'),
      JSON.stringify(createMockQuestions(9201), null, 2)
    )
  })

  afterEach(() => {
    // Clean up test files
    for (let i = 9200; i <= 9220; i++) {
      cleanupTestFiles(i)
    }
  })

  describe('createPracticeSession', () => {
    it('returns sessionId and questions', () => {
      const result = createPracticeSession(9201)
      expect(result.sessionId).toBeDefined()
      expect(result.questions).toBeDefined()
      expect(Array.isArray(result.questions)).toBe(true)
    })

    it('sets feedbackTiming from options', () => {
      const resultBatched = createPracticeSession(9201, { feedbackTiming: 'batched' })
      expect(resultBatched.feedbackTiming).toBe('batched')

      const resultImmediate = createPracticeSession(9201, { feedbackTiming: 'immediate' })
      expect(resultImmediate.feedbackTiming).toBe('immediate')
    })

    it('filters by category for category-focus', () => {
      const result = createPracticeSession(9201, {
        sessionType: 'category-focus',
        categoryFilter: 'behavioral'
      })
      expect(result.questions.length).toBeGreaterThan(0)
      for (const question of result.questions) {
        expect(question.category).toBe('behavioral')
      }
    })

    it('uses all questions for full-interview', () => {
      const result = createPracticeSession(9201, { sessionType: 'full-interview' })
      expect(result.questions.length).toBe(createMockQuestions(9201).questions.length)
    })

    it('uses single question for single-question mode', () => {
      const result = createPracticeSession(9201, { sessionType: 'single-question' })
      expect(result.questions.length).toBe(1)
    })

    it('returns sessionType in response', () => {
      const result = createPracticeSession(9201, { sessionType: 'category-focus' })
      expect(result.sessionType).toBe('category-focus')
    })

    it('returns error when no questions exist', () => {
      const result = createPracticeSession(9299) // No questions
      expect(result.error).toBeDefined()
      expect(result.sessionId).toBeNull()
    })

    it('persists session to file', () => {
      createPracticeSession(9201)
      const sessionsPath = join(RESEARCH_DIR, '9201-practice-sessions.json')
      expect(existsSync(sessionsPath)).toBe(true)
    })

    it('filters by specific questionIds', () => {
      const result = createPracticeSession(9201, { questionIds: [Q1_ID, Q2_ID] })
      expect(result.questions.length).toBe(2)
      const ids = result.questions.map(q => q.id)
      expect(ids).toContain(Q1_ID)
      expect(ids).toContain(Q2_ID)
    })

    it('defaults feedbackTiming to batched', () => {
      const result = createPracticeSession(9201)
      expect(result.feedbackTiming).toBe('batched')
    })
  })

  describe('submitAnswer', () => {
    it('adds to session answers', () => {
      const session = createPracticeSession(9201)
      const result = submitAnswer(session.sessionId, {
        questionId: Q1_ID,
        answerText: 'I led a project where...'
      })
      expect(result.success).toBe(true)
      expect(result.answersSubmitted).toBe(1)
    })

    it('validates answer structure', () => {
      const session = createPracticeSession(9201)
      // Missing questionId should fail
      const result = submitAnswer(session.sessionId, {
        answerText: 'Some answer'
      })
      // The schema requires questionId to be a UUID, so this should fail
      expect(result.success).toBe(false)
    })

    it('tracks inputMethod text', () => {
      const session = createPracticeSession(9201)
      submitAnswer(session.sessionId, {
        questionId: Q1_ID,
        answerText: 'My answer',
        inputMethod: 'text'
      })
      const fullSession = getSession(session.sessionId)
      expect(fullSession.answers[0].inputMethod).toBe('text')
    })

    it('tracks inputMethod voice', () => {
      const session = createPracticeSession(9201)
      submitAnswer(session.sessionId, {
        questionId: Q1_ID,
        answerText: 'Transcribed answer',
        inputMethod: 'voice'
      })
      const fullSession = getSession(session.sessionId)
      expect(fullSession.answers[0].inputMethod).toBe('voice')
    })

    it('records duration for voice', () => {
      const session = createPracticeSession(9201)
      submitAnswer(session.sessionId, {
        questionId: Q1_ID,
        answerText: 'Transcribed answer',
        inputMethod: 'voice',
        duration: 45
      })
      const fullSession = getSession(session.sessionId)
      expect(fullSession.answers[0].duration).toBe(45)
    })

    it('returns error for non-existent session', () => {
      const result = submitAnswer('non-existent-session-id', {
        questionId: Q1_ID,
        answerText: 'Answer'
      })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns error for completed session', () => {
      const session = createPracticeSession(9201)
      completeSession(session.sessionId)
      const result = submitAnswer(session.sessionId, {
        questionId: Q1_ID,
        answerText: 'Late answer'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('completed')
    })

    it('increments answersSubmitted count', () => {
      const session = createPracticeSession(9201)
      submitAnswer(session.sessionId, { questionId: Q1_ID, answerText: 'Answer 1' })
      const result = submitAnswer(session.sessionId, { questionId: Q2_ID, answerText: 'Answer 2' })
      expect(result.answersSubmitted).toBe(2)
    })

    it('defaults inputMethod to text', () => {
      const session = createPracticeSession(9201)
      submitAnswer(session.sessionId, {
        questionId: Q1_ID,
        answerText: 'My answer'
      })
      const fullSession = getSession(session.sessionId)
      expect(fullSession.answers[0].inputMethod).toBe('text')
    })
  })

  describe('completeSession', () => {
    it('sets completedAt', () => {
      const session = createPracticeSession(9201)
      submitAnswer(session.sessionId, { questionId: Q1_ID, answerText: 'Answer' })
      const result = completeSession(session.sessionId)
      expect(result.success).toBe(true)
      expect(result.session.completedAt).toBeDefined()
    })

    it('calculates questionsAttempted', () => {
      const session = createPracticeSession(9201)
      submitAnswer(session.sessionId, { questionId: Q1_ID, answerText: 'Answer 1' })
      submitAnswer(session.sessionId, { questionId: Q2_ID, answerText: 'Answer 2' })
      const result = completeSession(session.sessionId)
      expect(result.session.summary.questionsAttempted).toBe(2)
    })

    it('includes strongCategories and improvementAreas', () => {
      const session = createPracticeSession(9201)
      submitAnswer(session.sessionId, { questionId: Q1_ID, answerText: 'Answer' })
      const result = completeSession(session.sessionId)
      expect(result.session.summary.strongCategories).toBeDefined()
      expect(Array.isArray(result.session.summary.strongCategories)).toBe(true)
      expect(result.session.summary.improvementAreas).toBeDefined()
      expect(Array.isArray(result.session.summary.improvementAreas)).toBe(true)
    })

    it('returns error for non-existent session', () => {
      const result = completeSession('non-existent-session')
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('handles already completed session gracefully', () => {
      const session = createPracticeSession(9201)
      completeSession(session.sessionId)
      const result = completeSession(session.sessionId)
      expect(result.success).toBe(true)
      expect(result.message || result.session).toBeDefined()
    })

    it('summary averageScore is undefined when no scores', () => {
      const session = createPracticeSession(9201)
      submitAnswer(session.sessionId, { questionId: Q1_ID, answerText: 'Answer' })
      const result = completeSession(session.sessionId)
      expect(result.session.summary.averageScore).toBeUndefined()
    })
  })

  describe('getSessionsForJob', () => {
    it('returns empty array when none', () => {
      const result = getSessionsForJob(9210) // No sessions
      expect(result).toEqual([])
    })

    it('returns session summaries', () => {
      createPracticeSession(9201)
      const result = getSessionsForJob(9201)
      expect(result.length).toBe(1)
      expect(result[0].id).toBeDefined()
      expect(result[0].sessionType).toBeDefined()
      expect(result[0].startedAt).toBeDefined()
    })

    it('includes questionsAttempted in summary', () => {
      const session = createPracticeSession(9201)
      submitAnswer(session.sessionId, { questionId: Q1_ID, answerText: 'Answer' })
      const result = getSessionsForJob(9201)
      expect(result[0].questionsAttempted).toBe(1)
    })

    it('includes feedbackTiming in summary', () => {
      createPracticeSession(9201, { feedbackTiming: 'immediate' })
      const result = getSessionsForJob(9201)
      expect(result[0].feedbackTiming).toBe('immediate')
    })

    it('includes completedAt when completed', () => {
      const session = createPracticeSession(9201)
      completeSession(session.sessionId)
      const result = getSessionsForJob(9201)
      expect(result[0].completedAt).toBeDefined()
    })

    it('completedAt is null when not completed', () => {
      createPracticeSession(9201)
      const result = getSessionsForJob(9201)
      expect(result[0].completedAt).toBeNull()
    })
  })

  describe('getSession', () => {
    it('returns full session with answers', () => {
      const session = createPracticeSession(9201)
      submitAnswer(session.sessionId, { questionId: Q1_ID, answerText: 'My answer' })
      const result = getSession(session.sessionId)
      expect(result).toBeDefined()
      expect(result.answers).toBeDefined()
      expect(result.answers.length).toBe(1)
      expect(result.answers[0].answerText).toBe('My answer')
    })

    it('returns null for non-existent session', () => {
      const result = getSession('non-existent-session-id')
      expect(result).toBeNull()
    })

    it('includes all session fields', () => {
      const session = createPracticeSession(9201)
      const result = getSession(session.sessionId)
      expect(result.id).toBe(session.sessionId)
      expect(result.jobId).toBe(9201)
      expect(result.sessionType).toBeDefined()
      expect(result.startedAt).toBeDefined()
      expect(result.feedbackTiming).toBeDefined()
      expect(result.answers).toBeDefined()
    })
  })

  describe('multiple sessions per job', () => {
    it('can create multiple sessions', () => {
      createPracticeSession(9201, { sessionType: 'full-interview' })
      createPracticeSession(9201, { sessionType: 'category-focus', categoryFilter: 'behavioral' })
      const sessions = getSessionsForJob(9201)
      expect(sessions.length).toBe(2)
    })

    it('each session has unique ID', () => {
      const s1 = createPracticeSession(9201)
      const s2 = createPracticeSession(9201)
      expect(s1.sessionId).not.toBe(s2.sessionId)
    })

    it('sessions are persisted atomically', () => {
      createPracticeSession(9201)
      createPracticeSession(9201)
      // Re-read from file
      const sessions = getSessionsForJob(9201)
      expect(sessions.length).toBe(2)
    })
  })

  describe('edge cases', () => {
    it('handles empty answer text', () => {
      const session = createPracticeSession(9201)
      const result = submitAnswer(session.sessionId, {
        questionId: Q1_ID,
        answerText: ''
      })
      expect(result.success).toBe(true)
    })

    it('handles very long answer text', () => {
      const session = createPracticeSession(9201)
      const longAnswer = 'A'.repeat(10000)
      const result = submitAnswer(session.sessionId, {
        questionId: Q1_ID,
        answerText: longAnswer
      })
      expect(result.success).toBe(true)
    })

    it('handles zero duration', () => {
      const session = createPracticeSession(9201)
      submitAnswer(session.sessionId, {
        questionId: Q1_ID,
        answerText: 'Quick answer',
        inputMethod: 'voice',
        duration: 0
      })
      const fullSession = getSession(session.sessionId)
      expect(fullSession.answers[0].duration).toBe(0)
    })
  })
})
