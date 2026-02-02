/**
 * Interview Tools Tests
 * MCP tool wrappers for Phase 8 interview preparation
 *
 * Uses unique job ID range: 9400-9499 for test isolation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  startInterviewerResearch,
  saveInterviewerResearch,
  getInterviewerResearch,
  generateInterviewQuestions,
  startPracticeSession,
  submitPracticeAnswer,
  scoreSessionAnswer,
  getSessionFeedback,
  getInterviewProgress,
  getPreInterviewChecklist
} from './interview-tools.js'
import { existsSync, unlinkSync, writeFileSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const RESEARCH_DIR = join(DATA_DIR, 'job-research')

// Test job IDs in unique range
const TEST_JOB_ID = 9400
const TEST_JOB_ID_2 = 9401
const TEST_JOB_ID_3 = 9402
const TEST_JOB_ID_4 = 9403

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

// Helper to create mock questions for a job
function createMockQuestions(jobId, count = 3) {
  const questions = []
  const categories = ['behavioral', 'technical', 'culture-fit']

  for (let i = 0; i < count; i++) {
    questions.push({
      id: uuidv4(),
      jobId,
      questionText: `Test question ${i + 1} about ${categories[i % categories.length]}`,
      category: categories[i % categories.length],
      difficulty: 'medium',
      source: 'jd-requirement',
      sourceDetail: 'Test question',
      suggestedStories: [],
      talkingPoints: [],
      generatedAt: new Date().toISOString()
    })
  }

  const questionsData = {
    jobId,
    generatedAt: new Date().toISOString(),
    options: { categories, count, difficulty: 'mixed' },
    questions
  }

  writeFileSync(
    join(RESEARCH_DIR, `${jobId}-questions.json`),
    JSON.stringify(questionsData, null, 2),
    'utf-8'
  )

  return questions
}

describe('interview-tools', () => {
  beforeEach(() => {
    if (!existsSync(RESEARCH_DIR)) {
      mkdirSync(RESEARCH_DIR, { recursive: true })
    }
    cleanupTestFiles(TEST_JOB_ID)
    cleanupTestFiles(TEST_JOB_ID_2)
    cleanupTestFiles(TEST_JOB_ID_3)
    cleanupTestFiles(TEST_JOB_ID_4)
  })

  afterEach(() => {
    cleanupTestFiles(TEST_JOB_ID)
    cleanupTestFiles(TEST_JOB_ID_2)
    cleanupTestFiles(TEST_JOB_ID_3)
    cleanupTestFiles(TEST_JOB_ID_4)
  })

  describe('startInterviewerResearch', () => {
    it('returns template with instructions', () => {
      const result = startInterviewerResearch({
        jobId: TEST_JOB_ID,
        interviewerName: 'Jane Smith'
      })

      expect(result.status).toBe('template_ready')
      expect(result.research).toBeDefined()
      expect(result.instructions).toBeDefined()
    })

    it('includes interviewer name in template', () => {
      const result = startInterviewerResearch({
        jobId: TEST_JOB_ID,
        interviewerName: 'John Doe',
        interviewerTitle: 'VP Engineering'
      })

      expect(result.research.interviewerName).toBe('John Doe')
      expect(result.research.interviewerTitle).toBe('VP Engineering')
    })

    it('returns error when jobId missing', () => {
      const result = startInterviewerResearch({ interviewerName: 'Test' })

      expect(result.error).toBeDefined()
    })

    it('returns error when interviewerName missing', () => {
      const result = startInterviewerResearch({ jobId: TEST_JOB_ID })

      expect(result.error).toBeDefined()
    })
  })

  describe('saveInterviewerResearch', () => {
    it('validates and persists research', () => {
      const findings = {
        id: uuidv4(),
        jobId: TEST_JOB_ID,
        interviewerName: 'Jane Smith',
        researchedAt: new Date().toISOString(),
        background: { currentRole: 'VP Engineering', previousRoles: [] },
        interviewStyle: { signals: ['Technical depth'], expectedQuestionTypes: ['technical'] },
        talkingPoints: ['Shared interest in React'],
        sharedInterests: ['Open source'],
        confidence: 'medium',
        sources: ['LinkedIn']
      }

      const result = saveInterviewerResearch({ jobId: TEST_JOB_ID, findings })

      expect(result.success).toBe(true)
      expect(result.saved).toBeDefined()
    })

    it('returns error for invalid findings', () => {
      const result = saveInterviewerResearch({
        jobId: TEST_JOB_ID,
        findings: { invalid: 'data' }
      })

      expect(result.error).toBeDefined()
    })

    it('returns error when jobId missing', () => {
      const result = saveInterviewerResearch({ findings: {} })

      expect(result.error).toBeDefined()
    })
  })

  describe('getInterviewerResearch', () => {
    it('retrieves saved research', () => {
      // First save research
      const findings = {
        id: uuidv4(),
        jobId: TEST_JOB_ID_2,
        interviewerName: 'Bob Jones',
        researchedAt: new Date().toISOString(),
        background: { previousRoles: [] },
        interviewStyle: { signals: [], expectedQuestionTypes: [] },
        talkingPoints: [],
        sharedInterests: [],
        confidence: 'low',
        sources: []
      }
      saveInterviewerResearch({ jobId: TEST_JOB_ID_2, findings })

      // Then retrieve
      const result = getInterviewerResearch({
        jobId: TEST_JOB_ID_2,
        interviewerName: 'Bob Jones'
      })

      expect(result.interviewerName).toBe('Bob Jones')
    })

    it('returns notFound when research does not exist', () => {
      const result = getInterviewerResearch({
        jobId: TEST_JOB_ID,
        interviewerName: 'Nonexistent Person'
      })

      expect(result.notFound).toBe(true)
    })

    it('returns error when parameters missing', () => {
      const result = getInterviewerResearch({ jobId: TEST_JOB_ID })

      expect(result.error).toBeDefined()
    })
  })

  describe('generateInterviewQuestions', () => {
    it('returns questions array', () => {
      const result = generateInterviewQuestions({ jobId: TEST_JOB_ID })

      expect(result.questions).toBeDefined()
      expect(Array.isArray(result.questions)).toBe(true)
    })

    it('includes sources summary', () => {
      const result = generateInterviewQuestions({ jobId: TEST_JOB_ID })

      expect(result.sources).toBeDefined()
      expect(result.sources).toHaveProperty('jd')
      expect(result.sources).toHaveProperty('gaps')
    })

    it('respects count parameter', () => {
      const result = generateInterviewQuestions({ jobId: TEST_JOB_ID, count: 5 })

      expect(result.questions.length).toBeLessThanOrEqual(5)
    })

    it('returns error when jobId missing', () => {
      const result = generateInterviewQuestions({})

      expect(result.error).toBeDefined()
    })
  })

  describe('startPracticeSession', () => {
    it('returns sessionId and questions', () => {
      // Create mock questions
      createMockQuestions(TEST_JOB_ID_3, 5)

      const result = startPracticeSession({ jobId: TEST_JOB_ID_3 })

      expect(result.sessionId).toBeDefined()
      expect(result.questions).toBeDefined()
      expect(result.questions.length).toBe(5)
    })

    it('returns error when no questions exist', () => {
      const result = startPracticeSession({ jobId: 9499 }) // Unused job ID

      expect(result.error).toBeDefined()
    })

    it('returns error when jobId missing', () => {
      const result = startPracticeSession({})

      expect(result.error).toBeDefined()
    })

    it('supports feedbackTiming option', () => {
      createMockQuestions(TEST_JOB_ID_3, 3)

      const result = startPracticeSession({
        jobId: TEST_JOB_ID_3,
        feedbackTiming: 'immediate'
      })

      expect(result.feedbackTiming).toBe('immediate')
    })
  })

  describe('submitPracticeAnswer', () => {
    let sessionId
    let questionId

    beforeEach(() => {
      createMockQuestions(TEST_JOB_ID_4, 3)
      const session = startPracticeSession({ jobId: TEST_JOB_ID_4 })
      sessionId = session.sessionId
      questionId = session.questions?.[0]?.id
    })

    it('records answer to session', () => {
      const result = submitPracticeAnswer({
        sessionId,
        questionId,
        answerText: 'This is my answer to the question.'
      })

      expect(result.success).toBe(true)
      expect(result.answersSubmitted).toBe(1)
    })

    it('supports voice input method', () => {
      const result = submitPracticeAnswer({
        sessionId,
        questionId,
        answerText: 'Transcribed voice answer',
        inputMethod: 'voice',
        duration: 45
      })

      expect(result.success).toBe(true)
    })

    it('returns error when session not found', () => {
      const result = submitPracticeAnswer({
        sessionId: 'nonexistent-session',
        questionId: 'q1',
        answerText: 'Answer'
      })

      expect(result.error).toBeDefined()
    })

    it('returns error when required fields missing', () => {
      const result = submitPracticeAnswer({ sessionId })

      expect(result.error).toBeDefined()
    })
  })

  describe('scoreSessionAnswer', () => {
    it('returns score and feedback', () => {
      createMockQuestions(TEST_JOB_ID_4, 2)
      const session = startPracticeSession({ jobId: TEST_JOB_ID_4 })
      const sessionId = session.sessionId
      const questionId = session.questions?.[0]?.id

      submitPracticeAnswer({
        sessionId,
        questionId,
        answerText: 'At my previous company, I led a team of 5 engineers to deliver a critical feature.'
      })

      const result = scoreSessionAnswer({ sessionId, questionId })

      expect(result.score).toBeDefined()
      expect(result.feedback).toBeDefined()
      expect(result.score.overall).toBeGreaterThanOrEqual(0)
    })

    it('updates progress after scoring', () => {
      createMockQuestions(TEST_JOB_ID_4, 2)
      const session = startPracticeSession({ jobId: TEST_JOB_ID_4 })
      const sessionId = session.sessionId
      const questionId = session.questions?.[0]?.id

      submitPracticeAnswer({
        sessionId,
        questionId,
        answerText: 'My answer here.'
      })

      scoreSessionAnswer({ sessionId, questionId })

      const progress = getInterviewProgress({ jobId: TEST_JOB_ID_4 })
      expect(progress.progress.totalSessions).toBeGreaterThan(0)
    })

    it('returns error when session not found', () => {
      const result = scoreSessionAnswer({
        sessionId: 'nonexistent',
        questionId: 'q1'
      })

      expect(result.error).toBeDefined()
    })

    it('returns error when answer not found', () => {
      createMockQuestions(TEST_JOB_ID_4, 1)
      const session = startPracticeSession({ jobId: TEST_JOB_ID_4 })

      const result = scoreSessionAnswer({
        sessionId: session.sessionId,
        questionId: 'nonexistent-question'
      })

      expect(result.error).toBeDefined()
    })
  })

  describe('getSessionFeedback', () => {
    it('returns session info and feedback array', () => {
      createMockQuestions(TEST_JOB_ID_4, 2)
      const session = startPracticeSession({ jobId: TEST_JOB_ID_4 })
      const sessionId = session.sessionId
      const questionId = session.questions?.[0]?.id

      submitPracticeAnswer({
        sessionId,
        questionId,
        answerText: 'My answer to this question.'
      })

      const result = getSessionFeedback({ sessionId })

      expect(result.session).toBeDefined()
      expect(result.feedback).toBeDefined()
      expect(Array.isArray(result.feedback)).toBe(true)
    })

    it('returns error when session not found', () => {
      const result = getSessionFeedback({ sessionId: 'nonexistent' })

      expect(result.error).toBeDefined()
    })

    it('returns error when sessionId missing', () => {
      const result = getSessionFeedback({})

      expect(result.error).toBeDefined()
    })
  })

  describe('getInterviewProgress', () => {
    it('returns progress and readiness', () => {
      createMockQuestions(TEST_JOB_ID_4, 2)
      const session = startPracticeSession({ jobId: TEST_JOB_ID_4 })
      submitPracticeAnswer({
        sessionId: session.sessionId,
        questionId: session.questions?.[0]?.id,
        answerText: 'My answer'
      })
      scoreSessionAnswer({
        sessionId: session.sessionId,
        questionId: session.questions?.[0]?.id
      })

      const result = getInterviewProgress({ jobId: TEST_JOB_ID_4 })

      expect(result.progress).toBeDefined()
      expect(result.readiness).toBeDefined()
    })

    it('returns message when no progress exists', () => {
      const result = getInterviewProgress({ jobId: 9499 })

      expect(result.progress).toBeNull()
      expect(result.message).toBeDefined()
    })

    it('returns error when jobId missing', () => {
      const result = getInterviewProgress({})

      expect(result.error).toBeDefined()
    })
  })

  describe('getPreInterviewChecklist', () => {
    it('returns complete checklist structure', () => {
      const result = getPreInterviewChecklist({ jobId: TEST_JOB_ID })

      expect(result.checklist).toBeDefined()
      expect(result.summary).toBeDefined()
    })

    it('includes summary with counts', () => {
      const result = getPreInterviewChecklist({ jobId: TEST_JOB_ID })

      expect(result.summary).toHaveProperty('hasCompanyResearch')
      expect(result.summary).toHaveProperty('interviewerCount')
      expect(result.summary).toHaveProperty('topStoriesCount')
      expect(result.summary).toHaveProperty('readinessScore')
    })

    it('returns error when jobId missing', () => {
      const result = getPreInterviewChecklist({})

      expect(result.error).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('startInterviewerResearch handles missing params', () => {
      const result = startInterviewerResearch({})
      expect(result.error).toBeDefined()
    })

    it('saveInterviewerResearch handles missing params', () => {
      const result = saveInterviewerResearch({})
      expect(result.error).toBeDefined()
    })

    it('getInterviewerResearch handles missing params', () => {
      const result = getInterviewerResearch({})
      expect(result.error).toBeDefined()
    })

    it('generateInterviewQuestions handles missing params', () => {
      const result = generateInterviewQuestions({})
      expect(result.error).toBeDefined()
    })

    it('startPracticeSession handles missing params', () => {
      const result = startPracticeSession({})
      expect(result.error).toBeDefined()
    })

    it('submitPracticeAnswer handles missing params', () => {
      const result = submitPracticeAnswer({})
      expect(result.error).toBeDefined()
    })

    it('scoreSessionAnswer handles missing params', () => {
      const result = scoreSessionAnswer({})
      expect(result.error).toBeDefined()
    })

    it('getSessionFeedback handles missing params', () => {
      const result = getSessionFeedback({})
      expect(result.error).toBeDefined()
    })

    it('getInterviewProgress handles missing params', () => {
      const result = getInterviewProgress({})
      expect(result.error).toBeDefined()
    })

    it('getPreInterviewChecklist handles missing params', () => {
      const result = getPreInterviewChecklist({})
      expect(result.error).toBeDefined()
    })
  })
})
