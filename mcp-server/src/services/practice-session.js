/**
 * Practice Session Service
 * INTV-03: Practice mode with text/voice, configurable feedback timing
 *
 * Provides:
 * - createPracticeSession: Start a new practice session
 * - submitAnswer: Submit an answer to a question
 * - completeSession: Finish session and calculate summary
 * - getSessionsForJob: List all sessions for a job
 * - getSession: Get full session details
 *
 * Per CONTEXT.md:
 * - No timer (focus on content quality)
 * - All sessions saved automatically
 * - User chooses feedback timing (immediate/batched)
 */

import { v4 as uuidv4 } from 'uuid'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import { getQuestionsForJob } from './question-generator.js'
import { PracticeSessionSchema, PracticeAnswerSchema } from '../../../schemas/interview.schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const RESEARCH_DIR = join(DATA_DIR, 'job-research')

// Ensure research directory exists
if (!existsSync(RESEARCH_DIR)) {
  mkdirSync(RESEARCH_DIR, { recursive: true })
}

/**
 * Atomic file write using temp file + rename pattern
 */
function atomicWriteSync(filePath, data) {
  const tempPath = join(tmpdir(), `practice-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`)
  try {
    writeFileSync(tempPath, data, 'utf-8')
    renameSync(tempPath, filePath)
  } catch (err) {
    try { unlinkSync(tempPath) } catch (e) { /* ignore */ }
    throw err
  }
}

/**
 * Get sessions file path for a job
 */
function getSessionsPath(jobId) {
  return join(RESEARCH_DIR, `${jobId}-practice-sessions.json`)
}

/**
 * Load sessions data for a job
 *
 * @param {number} jobId - Job ID
 * @returns {{ sessions: Array, lastUpdated: string }}
 */
function loadSessionsData(jobId) {
  const sessionsPath = getSessionsPath(jobId)

  if (!existsSync(sessionsPath)) {
    return { sessions: [], lastUpdated: new Date().toISOString() }
  }

  try {
    return JSON.parse(readFileSync(sessionsPath, 'utf-8'))
  } catch (e) {
    console.error(`Error loading sessions for job ${jobId}:`, e.message)
    return { sessions: [], lastUpdated: new Date().toISOString() }
  }
}

/**
 * Save sessions data for a job
 *
 * @param {number} jobId - Job ID
 * @param {object} data - Sessions data to save
 */
function saveSessionsData(jobId, data) {
  const sessionsPath = getSessionsPath(jobId)
  data.lastUpdated = new Date().toISOString()
  atomicWriteSync(sessionsPath, JSON.stringify(data, null, 2))
}

/**
 * Create a new practice session
 *
 * @param {number} jobId - Job ID to practice for
 * @param {object} [options] - Session options
 * @param {string} [options.sessionType] - 'full-interview'|'category-focus'|'single-question' (default: 'full-interview')
 * @param {string} [options.feedbackTiming] - 'immediate'|'batched' (default: 'batched')
 * @param {string[]} [options.questionIds] - Specific question IDs (optional)
 * @param {string} [options.categoryFilter] - Category to filter by for 'category-focus' (optional)
 * @returns {{ sessionId: string, questions: Array, feedbackTiming: string, error?: string }}
 */
export function createPracticeSession(jobId, options = {}) {
  const {
    sessionType = 'full-interview',
    feedbackTiming = 'batched',
    questionIds = null,
    categoryFilter = null
  } = options

  // Load questions for job
  const questionsData = getQuestionsForJob(jobId)

  if (!questionsData || !questionsData.questions || questionsData.questions.length === 0) {
    return {
      error: `No questions found for job ${jobId}. Generate questions first using generateInterviewQuestions.`,
      sessionId: null,
      questions: [],
      feedbackTiming
    }
  }

  let sessionQuestions = questionsData.questions

  // Filter by specific question IDs if provided
  if (questionIds && questionIds.length > 0) {
    sessionQuestions = sessionQuestions.filter(q => questionIds.includes(q.id))
  }

  // Filter by category for category-focus sessions
  if (sessionType === 'category-focus' && categoryFilter) {
    sessionQuestions = sessionQuestions.filter(q => q.category === categoryFilter)
  }

  // For single-question, take first question only
  if (sessionType === 'single-question') {
    sessionQuestions = sessionQuestions.slice(0, 1)
  }

  if (sessionQuestions.length === 0) {
    return {
      error: 'No questions match the specified criteria.',
      sessionId: null,
      questions: [],
      feedbackTiming
    }
  }

  // Create session
  const session = {
    id: uuidv4(),
    jobId,
    sessionType,
    startedAt: new Date().toISOString(),
    completedAt: null,
    answers: [],
    feedbackTiming,
    summary: null
  }

  // Validate session structure
  const validation = PracticeSessionSchema.safeParse(session)
  if (!validation.success) {
    console.error('Session validation error:', validation.error.issues)
  }

  // Load existing sessions and add new one
  const sessionsData = loadSessionsData(jobId)
  sessionsData.sessions.push(session)
  saveSessionsData(jobId, sessionsData)

  return {
    sessionId: session.id,
    questions: sessionQuestions,
    feedbackTiming,
    sessionType
  }
}

/**
 * Submit an answer for a practice question
 *
 * @param {string} sessionId - Session ID
 * @param {object} answer - Answer data
 * @param {string} answer.questionId - Question ID being answered
 * @param {string} answer.answerText - The answer text (or transcription for voice)
 * @param {string} [answer.inputMethod] - 'text'|'voice' (default: 'text')
 * @param {number} [answer.duration] - Duration in seconds (for voice)
 * @returns {{ success: boolean, answersSubmitted: number, error?: string }}
 */
export function submitAnswer(sessionId, answer) {
  // Find session across all jobs
  const { session, jobId, sessionsData } = findSession(sessionId)

  if (!session) {
    return { success: false, error: `Session ${sessionId} not found`, answersSubmitted: 0 }
  }

  if (session.completedAt) {
    return { success: false, error: 'Session already completed', answersSubmitted: session.answers.length }
  }

  // Build answer object
  const answerRecord = {
    questionId: answer.questionId,
    answerText: answer.answerText || '',
    inputMethod: answer.inputMethod || 'text',
    answeredAt: new Date().toISOString()
  }

  // Add duration for voice answers
  if (answer.duration !== undefined && answer.duration !== null) {
    answerRecord.duration = answer.duration
  }

  // Validate answer structure
  const validation = PracticeAnswerSchema.safeParse(answerRecord)
  if (!validation.success) {
    return {
      success: false,
      error: `Invalid answer format: ${validation.error.issues.map(i => i.message).join(', ')}`,
      answersSubmitted: session.answers.length
    }
  }

  // Add answer to session
  session.answers.push(validation.data)

  // Save updated sessions
  saveSessionsData(jobId, sessionsData)

  return {
    success: true,
    answersSubmitted: session.answers.length
  }
}

/**
 * Complete a practice session
 *
 * @param {string} sessionId - Session ID to complete
 * @returns {{ success: boolean, session?: object, error?: string }}
 */
export function completeSession(sessionId) {
  const { session, jobId, sessionsData } = findSession(sessionId)

  if (!session) {
    return { success: false, error: `Session ${sessionId} not found` }
  }

  if (session.completedAt) {
    return { success: true, session, message: 'Session was already completed' }
  }

  // Mark as completed
  session.completedAt = new Date().toISOString()

  // Calculate summary
  const summary = calculateSessionSummary(session, jobId)
  session.summary = summary

  // Save updated sessions
  saveSessionsData(jobId, sessionsData)

  return {
    success: true,
    session
  }
}

/**
 * Calculate session summary statistics
 *
 * @param {object} session - The session object
 * @param {number} jobId - Job ID for loading questions
 * @returns {object} Summary statistics
 */
function calculateSessionSummary(session, jobId) {
  const questionsData = getQuestionsForJob(jobId)
  const questionsMap = new Map()

  if (questionsData?.questions) {
    for (const q of questionsData.questions) {
      questionsMap.set(q.id, q)
    }
  }

  // Group answers by category
  const categoryScores = {}

  for (const answer of session.answers) {
    const question = questionsMap.get(answer.questionId)
    if (question) {
      const category = question.category
      if (!categoryScores[category]) {
        categoryScores[category] = { count: 0, totalScore: 0 }
      }
      categoryScores[category].count++
      // If score exists (added by scorer service), track it
      if (answer.score?.overall !== undefined) {
        categoryScores[category].totalScore += answer.score.overall
      }
    }
  }

  // Determine strong and weak categories
  const strongCategories = []
  const improvementAreas = []

  for (const [category, data] of Object.entries(categoryScores)) {
    if (data.totalScore > 0) {
      const avgScore = data.totalScore / data.count
      if (avgScore >= 70) {
        strongCategories.push(category)
      } else if (avgScore < 50) {
        improvementAreas.push(category)
      }
    }
  }

  // Calculate average score if any answers have scores
  const answersWithScores = session.answers.filter(a => a.score?.overall !== undefined)
  const averageScore = answersWithScores.length > 0
    ? Math.round(answersWithScores.reduce((sum, a) => sum + a.score.overall, 0) / answersWithScores.length)
    : undefined

  return {
    questionsAttempted: session.answers.length,
    averageScore,
    strongCategories,
    improvementAreas
  }
}

/**
 * Find a session by ID across all jobs
 *
 * @param {string} sessionId - Session ID to find
 * @returns {{ session: object|null, jobId: number|null, sessionsData: object|null }}
 */
function findSession(sessionId) {
  if (!existsSync(RESEARCH_DIR)) {
    return { session: null, jobId: null, sessionsData: null }
  }

  try {
    const files = require('fs').readdirSync(RESEARCH_DIR)
    const sessionFiles = files.filter(f => f.endsWith('-practice-sessions.json'))

    for (const file of sessionFiles) {
      const jobIdMatch = file.match(/^(\d+)-practice-sessions\.json$/)
      if (!jobIdMatch) continue

      const jobId = parseInt(jobIdMatch[1], 10)
      const sessionsData = loadSessionsData(jobId)

      const session = sessionsData.sessions.find(s => s.id === sessionId)
      if (session) {
        return { session, jobId, sessionsData }
      }
    }
  } catch (e) {
    console.error('Error finding session:', e.message)
  }

  return { session: null, jobId: null, sessionsData: null }
}

/**
 * Get all practice sessions for a job
 *
 * @param {number} jobId - Job ID
 * @returns {Array<{ id: string, sessionType: string, startedAt: string, completedAt: string|null, questionsAttempted: number }>}
 */
export function getSessionsForJob(jobId) {
  const sessionsData = loadSessionsData(jobId)

  return sessionsData.sessions.map(session => ({
    id: session.id,
    sessionType: session.sessionType,
    startedAt: session.startedAt,
    completedAt: session.completedAt || null,
    questionsAttempted: session.answers?.length || 0,
    feedbackTiming: session.feedbackTiming
  }))
}

/**
 * Get a specific session by ID
 *
 * @param {string} sessionId - Session ID
 * @returns {object|null} Full session object or null if not found
 */
export function getSession(sessionId) {
  const { session } = findSession(sessionId)
  return session
}
