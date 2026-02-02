/**
 * Interview Progress Service
 * INTV-04: Progress tracking and readiness calculation
 *
 * Provides:
 * - updateProgress: Update progress with session results
 * - getProgress: Get progress data for a job
 * - calculateReadiness: Determine interview readiness level
 * - getPreInterviewChecklist: Comprehensive pre-interview checklist (INTV-05)
 *
 * Per CONTEXT.md:
 * - Progress tracking: Overall trend dashboard showing readiness across all practice
 * - Pre-interview checklist with talking points and briefs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import { PrepProgressSchema } from '../../../schemas/interview.schema.js'
import { getRelevantStories } from './interview-prep.js'
import { getInterviewerResearch, listInterviewerResearchForJob } from './interviewer-research.js'
import { loadJobsFromDashboard } from '../data/loader.js'
import { loadProfile } from '../data/profile-loader.js'

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
  const tempPath = join(tmpdir(), `progress-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`)
  try {
    writeFileSync(tempPath, data, 'utf-8')
    renameSync(tempPath, filePath)
  } catch (err) {
    try { unlinkSync(tempPath) } catch (e) { /* ignore */ }
    throw err
  }
}

/**
 * Readiness level thresholds
 */
const READINESS_THRESHOLDS = {
  'not-ready': { min: 0, max: 50 },
  'needs-work': { min: 51, max: 70 },
  'ready': { min: 71, max: 85 },
  'well-prepared': { min: 86, max: 100 }
}

/**
 * Get progress file path for a job
 */
function getProgressPath(jobId) {
  return join(RESEARCH_DIR, `${jobId}-prep-progress.json`)
}

/**
 * Load company research for a job
 * @param {number} jobId
 * @returns {object|null}
 */
function loadCompanyResearch(jobId) {
  const jsonPath = join(RESEARCH_DIR, `${jobId}-company.json`)
  if (!existsSync(jsonPath)) {
    return null
  }
  try {
    return JSON.parse(readFileSync(jsonPath, 'utf-8'))
  } catch (e) {
    console.error(`Error loading company research for job ${jobId}:`, e.message)
    return null
  }
}

/**
 * Update progress with session results
 *
 * @param {number} jobId - Job ID to update progress for
 * @param {object} sessionResult - Results from a practice session
 * @param {string} sessionResult.sessionId - Session ID
 * @param {number} sessionResult.questionsAnswered - Number of questions answered
 * @param {Array} sessionResult.scores - Array of { category, score } objects
 * @returns {{ success: boolean, progress: object }}
 */
export function updateProgress(jobId, sessionResult) {
  // Load or initialize progress
  let progress = getProgress(jobId)

  if (!progress) {
    progress = {
      jobId,
      lastUpdated: new Date().toISOString(),
      totalSessions: 0,
      totalQuestionsAnswered: 0,
      scoreHistory: [],
      focusAreas: []
    }
  }

  // Update session counts
  progress.totalSessions += 1
  progress.totalQuestionsAnswered += sessionResult.questionsAnswered || 0

  // Add scores to history
  const now = new Date().toISOString()
  for (const scoreItem of (sessionResult.scores || [])) {
    progress.scoreHistory.push({
      date: now,
      category: scoreItem.category,
      score: scoreItem.score
    })
  }

  // Recalculate readiness
  progress.readiness = calculateReadiness(progress)

  // Update focus areas based on new readiness
  progress.focusAreas = calculateFocusAreas(progress)

  // Update timestamp
  progress.lastUpdated = new Date().toISOString()

  // Validate and save
  const validation = PrepProgressSchema.safeParse(progress)
  if (!validation.success) {
    console.warn('Progress validation warning:', validation.error.issues)
  }

  const progressPath = getProgressPath(jobId)
  atomicWriteSync(progressPath, JSON.stringify(progress, null, 2))

  return { success: true, progress }
}

/**
 * Get progress data for a job
 *
 * @param {number} jobId - Job ID
 * @returns {object|null} PrepProgress data or null if not exists
 */
export function getProgress(jobId) {
  const progressPath = getProgressPath(jobId)

  if (!existsSync(progressPath)) {
    return null
  }

  try {
    const data = JSON.parse(readFileSync(progressPath, 'utf-8'))
    const validation = PrepProgressSchema.safeParse(data)
    if (!validation.success) {
      console.warn(`Progress validation warning for job ${jobId}:`, validation.error.issues)
      return data // Return anyway for backwards compatibility
    }
    return validation.data
  } catch (e) {
    console.error(`Error loading progress for job ${jobId}:`, e.message)
    return null
  }
}

/**
 * Calculate readiness from progress data
 *
 * @param {object} progress - Progress data
 * @returns {{ overall: number, byCategory: object, confidenceLevel: string }}
 */
export function calculateReadiness(progress) {
  const scoreHistory = progress.scoreHistory || []

  if (scoreHistory.length === 0) {
    return {
      overall: 0,
      byCategory: {},
      confidenceLevel: 'not-ready'
    }
  }

  // Group scores by category
  const categoryScores = {}
  for (const entry of scoreHistory) {
    if (!categoryScores[entry.category]) {
      categoryScores[entry.category] = []
    }
    categoryScores[entry.category].push(entry.score)
  }

  // Calculate average per category (last 10 scores each)
  const byCategory = {}
  for (const [category, scores] of Object.entries(categoryScores)) {
    const recentScores = scores.slice(-10) // Last 10
    const avg = recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length
    byCategory[category] = Math.round(avg)
  }

  // Calculate overall as average of category averages
  const categoryAverages = Object.values(byCategory)
  const overall = categoryAverages.length > 0
    ? Math.round(categoryAverages.reduce((sum, s) => sum + s, 0) / categoryAverages.length)
    : 0

  // Determine confidence level
  let confidenceLevel = 'not-ready'
  for (const [level, range] of Object.entries(READINESS_THRESHOLDS)) {
    if (overall >= range.min && overall <= range.max) {
      confidenceLevel = level
      break
    }
  }

  return { overall, byCategory, confidenceLevel }
}

/**
 * Calculate focus areas based on progress
 *
 * @param {object} progress - Progress data
 * @returns {Array<{ category: string, reason: string, recommendedPractice: string }>}
 */
function calculateFocusAreas(progress) {
  const focusAreas = []
  const readiness = progress.readiness || calculateReadiness(progress)
  const scoreHistory = progress.scoreHistory || []

  // Check for low-scoring categories
  for (const [category, score] of Object.entries(readiness.byCategory || {})) {
    if (score < 70) {
      focusAreas.push({
        category,
        reason: `Score below target (${score}/100)`,
        recommendedPractice: `Practice 2-3 more ${category} questions to improve`
      })
    }
  }

  // Check for categories with few practice answers
  const categoryCounts = {}
  for (const entry of scoreHistory) {
    categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1
  }

  const expectedCategories = ['behavioral', 'technical', 'culture-fit']
  for (const category of expectedCategories) {
    const count = categoryCounts[category] || 0
    if (count < 3) {
      // Only add if not already in focus areas
      if (!focusAreas.some(f => f.category === category)) {
        focusAreas.push({
          category,
          reason: `Limited practice (${count} answers)`,
          recommendedPractice: `Practice at least ${3 - count} more ${category} questions`
        })
      }
    }
  }

  return focusAreas
}

/**
 * Get pre-interview checklist with all talking points and briefs
 * Per INTV-05: Pre-interview checklist with company/role talking points
 *
 * @param {number} jobId - Job ID
 * @returns {{ companyTalkingPoints: string[], roleTalkingPoints: string[], interviewerBriefs: object[], topStories: object[], focusAreas: object[], readinessScore: number }}
 */
export function getPreInterviewChecklist(jobId) {
  // Load job data
  const jobsData = loadJobsFromDashboard()
  const job = jobsData.jobs?.find(j => j.id === jobId)

  // Load company research
  const companyResearch = loadCompanyResearch(jobId)

  // Load interviewer research
  const interviewerSummaries = listInterviewerResearchForJob(jobId)
  const interviewerBriefs = []

  for (const summary of interviewerSummaries) {
    const fullResearch = getInterviewerResearch(jobId, summary.name)
    if (fullResearch) {
      interviewerBriefs.push({
        name: fullResearch.interviewerName,
        title: fullResearch.interviewerTitle,
        round: fullResearch.interviewRound,
        talkingPoints: fullResearch.talkingPoints || [],
        styleSignals: fullResearch.interviewStyle?.signals || [],
        expectedQuestionTypes: fullResearch.interviewStyle?.expectedQuestionTypes || [],
        sharedInterests: fullResearch.sharedInterests || []
      })
    }
  }

  // Load profile and get relevant stories
  const profile = loadProfile()
  const jobContext = job ? { company: job.company, title: job.title } : {}
  const rankedStories = getRelevantStories(profile, jobContext)

  // Get top 5 stories with formatted info
  const topStories = rankedStories.slice(0, 5).map(story => ({
    id: story.id,
    title: story.title,
    relevanceScore: story.relevanceScore,
    situation: story.situation?.substring(0, 100) + (story.situation?.length > 100 ? '...' : ''),
    categories: story.questionCategories || []
  }))

  // Load progress data
  const progress = getProgress(jobId)

  // Compile company talking points
  const companyTalkingPoints = []
  if (companyResearch) {
    // Add highlights
    for (const highlight of (companyResearch.highlights || []).slice(0, 5)) {
      companyTalkingPoints.push(highlight)
    }

    // Add culture values
    const values = companyResearch.culture?.values || []
    if (values.length > 0) {
      companyTalkingPoints.push(`Core values: ${values.slice(0, 3).join(', ')}`)
    }

    // Add recent news
    const recentNews = (companyResearch.news || []).slice(0, 2)
    for (const news of recentNews) {
      companyTalkingPoints.push(`Recent news: ${news.headline}`)
    }
  }

  // Compile role talking points
  const roleTalkingPoints = []
  if (job) {
    roleTalkingPoints.push(`Position: ${job.title}`)
    if (job.company) {
      roleTalkingPoints.push(`Company: ${job.company}`)
    }
    if (job.location) {
      roleTalkingPoints.push(`Location: ${job.location}`)
    }
    if (job.salary) {
      roleTalkingPoints.push(`Salary: ${job.salary}`)
    }
    if (job.fitReasoning?.highlights) {
      for (const highlight of job.fitReasoning.highlights.slice(0, 3)) {
        roleTalkingPoints.push(`Fit: ${highlight}`)
      }
    }
  }

  // Extract focus areas and readiness
  const focusAreas = progress?.focusAreas || []
  const readinessScore = progress?.readiness?.overall || 0

  return {
    companyTalkingPoints,
    roleTalkingPoints,
    interviewerBriefs,
    topStories,
    focusAreas,
    readinessScore
  }
}
