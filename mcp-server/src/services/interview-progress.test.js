/**
 * Interview Progress Tests
 * INTV-04: Progress tracking and readiness calculation
 *
 * Uses unique job ID range: 9300-9399 for test isolation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { updateProgress, getProgress, calculateReadiness, getPreInterviewChecklist } from './interview-progress.js'
import { existsSync, unlinkSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const RESEARCH_DIR = join(DATA_DIR, 'job-research')

// Test job IDs in unique range
const TEST_JOB_ID = 9300
const TEST_JOB_ID_2 = 9301
const TEST_JOB_ID_3 = 9302

// Cleanup helper
function cleanupTestFiles(jobId) {
  const files = [
    join(RESEARCH_DIR, `${jobId}-prep-progress.json`),
    join(RESEARCH_DIR, `${jobId}-company.json`),
    join(RESEARCH_DIR, `${jobId}-interviewer-test-person.json`)
  ]
  for (const file of files) {
    if (existsSync(file)) {
      try { unlinkSync(file) } catch (e) { /* ignore */ }
    }
  }
}

describe('interview-progress', () => {
  beforeEach(() => {
    // Ensure research directory exists
    if (!existsSync(RESEARCH_DIR)) {
      mkdirSync(RESEARCH_DIR, { recursive: true })
    }
    // Cleanup before each test
    cleanupTestFiles(TEST_JOB_ID)
    cleanupTestFiles(TEST_JOB_ID_2)
    cleanupTestFiles(TEST_JOB_ID_3)
  })

  afterEach(() => {
    // Cleanup after each test
    cleanupTestFiles(TEST_JOB_ID)
    cleanupTestFiles(TEST_JOB_ID_2)
    cleanupTestFiles(TEST_JOB_ID_3)
  })

  describe('updateProgress', () => {
    it('creates new progress file when none exists', () => {
      const result = updateProgress(TEST_JOB_ID, {
        sessionId: 'test-session',
        questionsAnswered: 3,
        scores: [{ category: 'behavioral', score: 75 }]
      })

      expect(result.success).toBe(true)
      expect(result.progress).toBeDefined()
      expect(result.progress.jobId).toBe(TEST_JOB_ID)
    })

    it('increments totalSessions', () => {
      // First session
      updateProgress(TEST_JOB_ID, {
        sessionId: 'session-1',
        questionsAnswered: 2,
        scores: []
      })

      // Second session
      const result = updateProgress(TEST_JOB_ID, {
        sessionId: 'session-2',
        questionsAnswered: 3,
        scores: []
      })

      expect(result.progress.totalSessions).toBe(2)
    })

    it('adds scores to scoreHistory', () => {
      updateProgress(TEST_JOB_ID, {
        sessionId: 'session-1',
        questionsAnswered: 2,
        scores: [
          { category: 'behavioral', score: 70 },
          { category: 'technical', score: 80 }
        ]
      })

      const progress = getProgress(TEST_JOB_ID)

      expect(progress.scoreHistory.length).toBe(2)
      expect(progress.scoreHistory[0].category).toBe('behavioral')
      expect(progress.scoreHistory[0].score).toBe(70)
    })

    it('recalculates readiness after update', () => {
      updateProgress(TEST_JOB_ID, {
        sessionId: 'session-1',
        questionsAnswered: 5,
        scores: [
          { category: 'behavioral', score: 85 },
          { category: 'behavioral', score: 80 }
        ]
      })

      const progress = getProgress(TEST_JOB_ID)

      expect(progress.readiness).toBeDefined()
      expect(progress.readiness.overall).toBeGreaterThan(0)
      expect(progress.readiness.byCategory.behavioral).toBeDefined()
    })

    it('increments totalQuestionsAnswered', () => {
      updateProgress(TEST_JOB_ID, { sessionId: 's1', questionsAnswered: 3, scores: [] })
      updateProgress(TEST_JOB_ID, { sessionId: 's2', questionsAnswered: 5, scores: [] })

      const progress = getProgress(TEST_JOB_ID)

      expect(progress.totalQuestionsAnswered).toBe(8)
    })
  })

  describe('getProgress', () => {
    it('returns null when progress file does not exist', () => {
      const progress = getProgress(9399) // Unused job ID

      expect(progress).toBeNull()
    })

    it('returns stored progress data', () => {
      updateProgress(TEST_JOB_ID_2, {
        sessionId: 'test',
        questionsAnswered: 1,
        scores: [{ category: 'technical', score: 65 }]
      })

      const progress = getProgress(TEST_JOB_ID_2)

      expect(progress).toBeDefined()
      expect(progress.jobId).toBe(TEST_JOB_ID_2)
      expect(progress.totalSessions).toBe(1)
    })

    it('validates data structure', () => {
      updateProgress(TEST_JOB_ID_2, {
        sessionId: 'test',
        questionsAnswered: 1,
        scores: [{ category: 'behavioral', score: 70 }]
      })

      const progress = getProgress(TEST_JOB_ID_2)

      expect(progress).toHaveProperty('jobId')
      expect(progress).toHaveProperty('lastUpdated')
      expect(progress).toHaveProperty('totalSessions')
      expect(progress).toHaveProperty('scoreHistory')
    })
  })

  describe('calculateReadiness', () => {
    it('returns overall score as average of categories', () => {
      const progress = {
        scoreHistory: [
          { date: new Date().toISOString(), category: 'behavioral', score: 80 },
          { date: new Date().toISOString(), category: 'technical', score: 70 }
        ]
      }

      const readiness = calculateReadiness(progress)

      expect(readiness.overall).toBe(75) // Average of 80 and 70
    })

    it('returns byCategory scores', () => {
      const progress = {
        scoreHistory: [
          { date: new Date().toISOString(), category: 'behavioral', score: 80 },
          { date: new Date().toISOString(), category: 'behavioral', score: 90 },
          { date: new Date().toISOString(), category: 'technical', score: 60 }
        ]
      }

      const readiness = calculateReadiness(progress)

      expect(readiness.byCategory.behavioral).toBe(85) // Average of 80 and 90
      expect(readiness.byCategory.technical).toBe(60)
    })

    it('sets confidenceLevel not-ready for 0-50', () => {
      const progress = {
        scoreHistory: [
          { date: new Date().toISOString(), category: 'behavioral', score: 40 }
        ]
      }

      const readiness = calculateReadiness(progress)

      expect(readiness.confidenceLevel).toBe('not-ready')
    })

    it('sets confidenceLevel needs-work for 51-70', () => {
      const progress = {
        scoreHistory: [
          { date: new Date().toISOString(), category: 'behavioral', score: 65 }
        ]
      }

      const readiness = calculateReadiness(progress)

      expect(readiness.confidenceLevel).toBe('needs-work')
    })

    it('sets confidenceLevel ready for 71-85', () => {
      const progress = {
        scoreHistory: [
          { date: new Date().toISOString(), category: 'behavioral', score: 80 }
        ]
      }

      const readiness = calculateReadiness(progress)

      expect(readiness.confidenceLevel).toBe('ready')
    })

    it('sets confidenceLevel well-prepared for 86-100', () => {
      const progress = {
        scoreHistory: [
          { date: new Date().toISOString(), category: 'behavioral', score: 90 }
        ]
      }

      const readiness = calculateReadiness(progress)

      expect(readiness.confidenceLevel).toBe('well-prepared')
    })

    it('handles empty scoreHistory', () => {
      const progress = { scoreHistory: [] }

      const readiness = calculateReadiness(progress)

      expect(readiness.overall).toBe(0)
      expect(readiness.confidenceLevel).toBe('not-ready')
    })

    it('uses last 10 scores per category for average', () => {
      const scores = []
      // Add 15 behavioral scores
      for (let i = 0; i < 15; i++) {
        scores.push({
          date: new Date().toISOString(),
          category: 'behavioral',
          score: i < 5 ? 40 : 80 // First 5 are 40, rest are 80
        })
      }

      const progress = { scoreHistory: scores }
      const readiness = calculateReadiness(progress)

      // Should only average last 10 (all 80s)
      expect(readiness.byCategory.behavioral).toBe(80)
    })
  })

  describe('getPreInterviewChecklist', () => {
    it('returns checklist structure', () => {
      const checklist = getPreInterviewChecklist(TEST_JOB_ID_3)

      expect(checklist).toHaveProperty('companyTalkingPoints')
      expect(checklist).toHaveProperty('roleTalkingPoints')
      expect(checklist).toHaveProperty('interviewerBriefs')
      expect(checklist).toHaveProperty('topStories')
      expect(checklist).toHaveProperty('focusAreas')
      expect(checklist).toHaveProperty('readinessScore')
    })

    it('includes companyTalkingPoints from company research', () => {
      // Create mock company research
      const companyResearch = {
        id: 'test-id',
        jobId: TEST_JOB_ID_3,
        companyName: 'Test Corp',
        researchedAt: new Date().toISOString(),
        highlights: ['Fast-growing startup', 'Strong engineering culture'],
        culture: { values: ['Innovation', 'Collaboration'] },
        news: [{ headline: 'Series B funding' }],
        confidence: 'high'
      }
      writeFileSync(
        join(RESEARCH_DIR, `${TEST_JOB_ID_3}-company.json`),
        JSON.stringify(companyResearch),
        'utf-8'
      )

      const checklist = getPreInterviewChecklist(TEST_JOB_ID_3)

      expect(checklist.companyTalkingPoints.length).toBeGreaterThan(0)
      expect(checklist.companyTalkingPoints.some(p => p.includes('Fast-growing'))).toBe(true)
    })

    it('includes topStories from profile', () => {
      const checklist = getPreInterviewChecklist(TEST_JOB_ID_3)

      expect(Array.isArray(checklist.topStories)).toBe(true)
      // May be empty if no profile stories exist
    })

    it('includes focusAreas from progress', () => {
      // Create progress with low scores
      updateProgress(TEST_JOB_ID_3, {
        sessionId: 'test',
        questionsAnswered: 1,
        scores: [{ category: 'technical', score: 50 }]
      })

      const checklist = getPreInterviewChecklist(TEST_JOB_ID_3)

      expect(checklist.focusAreas.length).toBeGreaterThan(0)
    })

    it('returns readinessScore from progress', () => {
      updateProgress(TEST_JOB_ID_3, {
        sessionId: 'test',
        questionsAnswered: 2,
        scores: [
          { category: 'behavioral', score: 75 },
          { category: 'technical', score: 85 }
        ]
      })

      const checklist = getPreInterviewChecklist(TEST_JOB_ID_3)

      expect(checklist.readinessScore).toBe(80) // Average of 75 and 85
    })

    it('returns 0 readinessScore when no progress', () => {
      const checklist = getPreInterviewChecklist(9398) // Unused job ID

      expect(checklist.readinessScore).toBe(0)
    })
  })
})
