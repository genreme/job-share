/**
 * Interview Tools - MCP tool implementations for Phase 8
 *
 * 10 tools for interview preparation workflow:
 * 1. startInterviewerResearch - Start research on specific interviewer (INTV-01)
 * 2. saveInterviewerResearch - Save interviewer research findings (INTV-01)
 * 3. getInterviewerResearch - Retrieve existing interviewer research
 * 4. generateInterviewQuestions - Generate questions from JD + profile + research (INTV-02)
 * 5. startPracticeSession - Start practice with session type and timing (INTV-03)
 * 6. submitPracticeAnswer - Submit answer (text or voice transcription) (INTV-03)
 * 7. scoreSessionAnswer - Score answer with feedback (INTV-04)
 * 8. getSessionFeedback - Get all feedback for session review
 * 9. getInterviewProgress - Get progress and readiness score (INTV-04)
 * 10. getPreInterviewChecklist - Get talking points and briefs (INTV-05)
 *
 * Note: INTV-06 (scheduling integration) is deferred - external calendar integration out of MCP scope
 */

import {
  startInterviewerResearch as startResearch,
  saveInterviewerResearch as saveResearch,
  getInterviewerResearch as getResearch
} from '../services/interviewer-research.js'

import { generateInterviewQuestions as generateQuestions } from '../services/question-generator.js'

import {
  createPracticeSession,
  submitAnswer as submitPracticeAnswerToSession,
  getSession,
  completeSession
} from '../services/practice-session.js'

import {
  scoreAnswer,
  generateFeedback
} from '../services/interview-scorer.js'

import {
  updateProgress,
  getProgress,
  getPreInterviewChecklist as getChecklist
} from '../services/interview-progress.js'

import { loadJobsFromDashboard } from '../data/loader.js'
import { loadProfile } from '../data/profile-loader.js'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')

/**
 * Start interviewer research - INTV-01
 * Returns template for Claude to populate
 *
 * @param {object} params
 * @param {number} params.jobId - Job ID
 * @param {string} params.interviewerName - Interviewer name
 * @param {string} [params.interviewerTitle] - Interviewer title
 * @param {string} [params.interviewRound] - Interview round
 * @returns {{ status: string, research: object, instructions: string }}
 */
export function startInterviewerResearch({ jobId, interviewerName, interviewerTitle, interviewRound }) {
  if (!jobId || !interviewerName) {
    return { error: 'jobId and interviewerName are required' }
  }

  return startResearch(jobId, interviewerName, interviewerTitle, interviewRound)
}

/**
 * Save interviewer research - INTV-01
 * Validates and persists research findings
 *
 * @param {object} params
 * @param {number} params.jobId - Job ID
 * @param {object} params.findings - Research findings to save
 * @returns {{ success: boolean, saved?: object, error?: string, details?: any[] }}
 */
export function saveInterviewerResearch({ jobId, findings }) {
  if (!jobId || !findings) {
    return { error: 'jobId and findings are required' }
  }

  return saveResearch(jobId, findings)
}

/**
 * Get interviewer research
 * Retrieves existing research for an interviewer
 *
 * @param {object} params
 * @param {number} params.jobId - Job ID
 * @param {string} params.interviewerName - Interviewer name
 * @returns {object|{ notFound: boolean }}
 */
export function getInterviewerResearch({ jobId, interviewerName }) {
  if (!jobId || !interviewerName) {
    return { error: 'jobId and interviewerName are required' }
  }

  const research = getResearch(jobId, interviewerName)

  if (!research) {
    return { notFound: true, message: `No research found for ${interviewerName} on job ${jobId}` }
  }

  return research
}

/**
 * Generate interview questions - INTV-02
 * Creates questions from JD + profile + research
 *
 * @param {object} params
 * @param {number} params.jobId - Job ID
 * @param {string[]} [params.categories] - Categories to include
 * @param {number} [params.count] - Number of questions
 * @param {string} [params.difficulty] - Difficulty level
 * @returns {{ questions: Array, sources: object }}
 */
export function generateInterviewQuestions({ jobId, categories, count, difficulty }) {
  if (!jobId) {
    return { error: 'jobId is required' }
  }

  const result = generateQuestions(jobId, { categories, count, difficulty })

  // Summarize sources
  const sources = {
    jd: 0,
    gaps: 0,
    strengths: 0,
    company: 0,
    interviewer: 0
  }

  for (const q of (result.questions || [])) {
    if (q.source === 'jd-requirement') sources.jd++
    else if (q.source === 'profile-gap') sources.gaps++
    else if (q.source === 'profile-strength') sources.strengths++
    else if (q.source === 'company-research') sources.company++
    else if (q.source === 'interviewer-style') sources.interviewer++
  }

  return {
    questions: result.questions,
    savedTo: result.savedTo,
    sources
  }
}

/**
 * Start practice session - INTV-03
 * Creates a new practice session with questions
 *
 * @param {object} params
 * @param {number} params.jobId - Job ID
 * @param {string} [params.sessionType] - 'full-interview'|'category-focus'|'single-question'
 * @param {string} [params.feedbackTiming] - 'immediate'|'batched'
 * @param {string} [params.categoryFilter] - Category to focus on
 * @returns {{ sessionId: string, questions: Array, feedbackTiming: string, error?: string }}
 */
export function startPracticeSession({ jobId, sessionType, feedbackTiming, categoryFilter }) {
  if (!jobId) {
    return { error: 'jobId is required' }
  }

  return createPracticeSession(jobId, { sessionType, feedbackTiming, categoryFilter })
}

/**
 * Submit practice answer - INTV-03
 * Records an answer for a practice question
 *
 * @param {object} params
 * @param {string} params.sessionId - Session ID
 * @param {string} params.questionId - Question ID
 * @param {string} params.answerText - The answer text
 * @param {string} [params.inputMethod] - 'text'|'voice'
 * @param {number} [params.duration] - Duration in seconds (for voice)
 * @returns {{ success: boolean, answersSubmitted: number, error?: string }}
 */
export function submitPracticeAnswer({ sessionId, questionId, answerText, inputMethod, duration }) {
  if (!sessionId || !questionId || !answerText) {
    return { error: 'sessionId, questionId, and answerText are required' }
  }

  return submitPracticeAnswerToSession(sessionId, {
    questionId,
    answerText,
    inputMethod: inputMethod || 'text',
    duration
  })
}

/**
 * Score a session answer - INTV-04
 * Scores an answer and generates feedback
 *
 * @param {object} params
 * @param {string} params.sessionId - Session ID
 * @param {string} params.questionId - Question ID to score
 * @returns {{ score: object, feedback: object, error?: string }}
 */
export function scoreSessionAnswer({ sessionId, questionId }) {
  if (!sessionId || !questionId) {
    return { error: 'sessionId and questionId are required' }
  }

  // Load session
  const session = getSession(sessionId)
  if (!session) {
    return { error: `Session ${sessionId} not found` }
  }

  // Find the answer
  const answer = session.answers?.find(a => a.questionId === questionId)
  if (!answer) {
    return { error: `No answer found for question ${questionId}` }
  }

  // Load questions to find the question
  const questionsPath = join(DATA_DIR, 'job-research', `${session.jobId}-questions.json`)

  let question = null
  if (existsSync(questionsPath)) {
    try {
      const questionsData = JSON.parse(readFileSync(questionsPath, 'utf-8'))
      question = questionsData.questions?.find(q => q.id === questionId)
    } catch (e) {
      // Continue with empty question
    }
  }

  if (!question) {
    question = { questionText: '', category: 'behavioral', suggestedStories: [], talkingPoints: [] }
  }

  // Load profile for context
  const profile = loadProfile()

  // Score the answer
  const score = scoreAnswer(
    { answerText: answer.answerText, inputMethod: answer.inputMethod },
    question,
    profile
  )

  // Generate feedback
  const feedback = generateFeedback(score, answer, question)

  // Update the answer in session with score and feedback
  answer.score = score
  answer.feedback = feedback

  // Update progress
  updateProgress(session.jobId, {
    sessionId: session.id,
    questionsAnswered: 1,
    scores: [{ category: question.category, score: score.overall }]
  })

  return { score, feedback }
}

/**
 * Get session feedback
 * Returns all scores and feedback for a session
 *
 * @param {object} params
 * @param {string} params.sessionId - Session ID
 * @returns {{ session: object, feedback: Array, error?: string }}
 */
export function getSessionFeedback({ sessionId }) {
  if (!sessionId) {
    return { error: 'sessionId is required' }
  }

  const session = getSession(sessionId)
  if (!session) {
    return { error: `Session ${sessionId} not found` }
  }

  // Extract feedback from all answers
  const feedback = session.answers?.map(answer => ({
    questionId: answer.questionId,
    answeredAt: answer.answeredAt,
    score: answer.score,
    feedback: answer.feedback
  })) || []

  // Calculate summary stats
  const scoredAnswers = feedback.filter(f => f.score?.overall !== undefined)
  const averageScore = scoredAnswers.length > 0
    ? Math.round(scoredAnswers.reduce((sum, f) => sum + f.score.overall, 0) / scoredAnswers.length)
    : null

  return {
    session: {
      id: session.id,
      jobId: session.jobId,
      sessionType: session.sessionType,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      totalAnswers: session.answers?.length || 0,
      scoredAnswers: scoredAnswers.length,
      averageScore
    },
    feedback
  }
}

/**
 * Get interview progress - INTV-04
 * Returns progress and readiness score
 *
 * @param {object} params
 * @param {number} params.jobId - Job ID
 * @returns {{ progress: object, readiness: object, error?: string }}
 */
export function getInterviewProgress({ jobId }) {
  if (!jobId) {
    return { error: 'jobId is required' }
  }

  const progress = getProgress(jobId)

  if (!progress) {
    return {
      progress: null,
      readiness: {
        overall: 0,
        byCategory: {},
        confidenceLevel: 'not-ready'
      },
      message: 'No practice sessions recorded yet. Start practicing to build progress.'
    }
  }

  return {
    progress: {
      jobId: progress.jobId,
      lastUpdated: progress.lastUpdated,
      totalSessions: progress.totalSessions,
      totalQuestionsAnswered: progress.totalQuestionsAnswered
    },
    readiness: progress.readiness,
    focusAreas: progress.focusAreas
  }
}

/**
 * Get pre-interview checklist - INTV-05
 * Returns talking points and briefs for quick review
 *
 * @param {object} params
 * @param {number} params.jobId - Job ID
 * @returns {{ checklist: object, error?: string }}
 */
export function getPreInterviewChecklist({ jobId }) {
  if (!jobId) {
    return { error: 'jobId is required' }
  }

  const checklist = getChecklist(jobId)

  return {
    checklist,
    summary: {
      hasCompanyResearch: checklist.companyTalkingPoints?.length > 0,
      interviewerCount: checklist.interviewerBriefs?.length || 0,
      topStoriesCount: checklist.topStories?.length || 0,
      readinessScore: checklist.readinessScore,
      focusAreasCount: checklist.focusAreas?.length || 0
    }
  }
}
