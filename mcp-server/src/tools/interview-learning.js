/**
 * Interview Learning Tools - MCP tool implementations for Phase 9
 *
 * 10 tools for interview learning workflow:
 * 1. captureInterviewTranscript - Capture interview transcript with metadata (INTV-09)
 * 2. getInterviewHistory - Get interview history by job or chronologically
 * 3. searchTranscripts - Full-text search across transcripts
 * 4. proposeInterviewLearnings - Claude proposes learnings from transcript
 * 5. reviewInterviewLearning - User accepts/rejects proposed learning
 * 6. linkLearningToProfile - Get suggested profile links for learning
 * 7. confirmProfileLink - User confirms profile link
 * 8. getProfileUpdateSuggestions - Batch/aggregate profile update suggestions
 * 9. getInterviewPatterns - Detect recurring interview patterns
 * 10. getCaptureReminders - Check for interviews needing transcript capture
 *
 * Completes the interview learning feedback loop:
 * Capture -> Extract -> Review -> Link -> Update Profile
 */

import {
  captureTranscript,
  getTranscriptsForJob,
  getTranscriptsChronological,
  searchTranscripts as searchTranscriptsService,
  checkTranscriptReminder
} from '../services/interview-capture.js'

import {
  queueInterviewLearning,
  reviewInterviewLearning as reviewLearningService,
  linkLearningToProfile as linkLearningService,
  getLearningsForJob,
  getPendingLearnings
} from '../services/learning-extractor.js'

import {
  updateProfileConfidence,
  getProfileUpdateSuggestions as getUpdateSuggestionsService,
  getInterviewPatterns as getPatternsService,
  detectConflicts
} from '../services/profile-feedback.js'

import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const JOBS_FILE = join(DATA_DIR, 'jobs.json')

/**
 * Load jobs data
 * @returns {Array<object>} Jobs array
 */
function loadJobsData() {
  if (!existsSync(JOBS_FILE)) {
    return []
  }

  try {
    const data = JSON.parse(readFileSync(JOBS_FILE, 'utf-8'))
    return data.jobs || []
  } catch (e) {
    console.error('Error loading jobs:', e.message)
    return []
  }
}

/**
 * Tool 1: Capture interview transcript - INTV-09
 * Store practice and real interviews with metadata
 *
 * @param {object} args
 * @param {number} args.jobId - Job ID
 * @param {string} args.sessionType - 'practice' | 'real-interview'
 * @param {string} args.interviewDate - Interview date (ISO format)
 * @param {string} args.interviewType - 'phone' | 'video' | 'onsite'
 * @param {string} args.rawTranscript - Full transcript text
 * @param {string} [args.interviewerName] - Interviewer name
 * @param {string} [args.confidenceLevel] - 'high' | 'medium' | 'low'
 * @param {string} [args.overallVibe] - 'went-well' | 'neutral' | 'rough'
 * @param {Array<string>} [args.highlights] - Key highlights
 * @param {number} [args.duration] - Duration in minutes
 * @param {string} [args.practiceSessionId] - Link to Phase 8 practice session
 * @returns {{ success: boolean, transcriptId?: string, message?: string, error?: string }}
 */
export function captureInterviewTranscript(args) {
  // Validate required fields
  if (!args.jobId) {
    return { success: false, error: 'jobId is required' }
  }
  if (!args.sessionType) {
    return { success: false, error: 'sessionType is required' }
  }
  if (!args.interviewDate) {
    return { success: false, error: 'interviewDate is required' }
  }
  if (!args.interviewType) {
    return { success: false, error: 'interviewType is required' }
  }
  if (!args.rawTranscript) {
    return { success: false, error: 'rawTranscript is required' }
  }

  // Build transcript object
  const transcript = {
    jobId: args.jobId,
    sessionType: args.sessionType,
    interviewDate: args.interviewDate,
    interviewType: args.interviewType,
    rawTranscript: args.rawTranscript
  }

  // Add optional fields
  if (args.interviewerName) {
    transcript.interviewerName = args.interviewerName
  }
  if (args.confidenceLevel) {
    transcript.confidenceLevel = args.confidenceLevel
  }
  if (args.overallVibe) {
    transcript.overallVibe = args.overallVibe
  }
  if (args.highlights) {
    transcript.highlights = args.highlights
  }
  if (args.duration !== undefined) {
    transcript.duration = args.duration
  }
  if (args.practiceSessionId) {
    transcript.practiceSessionId = args.practiceSessionId
  }

  // Call service
  const result = captureTranscript(transcript)

  if (result.captured) {
    return {
      success: true,
      transcriptId: result.id,
      message: `Transcript captured successfully (${result.transcriptCount} total for this job)`
    }
  } else {
    return {
      success: false,
      error: result.error || 'Failed to capture transcript'
    }
  }
}

/**
 * Tool 2: Get interview history
 * Primary view by job (all rounds grouped), or chronological timeline
 *
 * @param {object} args
 * @param {number} [args.jobId] - Job ID for per-job view
 * @param {number} [args.limit] - Max results (default: 50)
 * @param {boolean} [args.chronological] - If true, return timeline across all jobs
 * @returns {{ interviews: Array, count: number }}
 */
export function getInterviewHistory(args = {}) {
  const { jobId, limit = 50, chronological = false } = args

  // If jobId provided and not chronological, get transcripts for that job
  if (jobId && !chronological) {
    const transcriptsData = getTranscriptsForJob(jobId)
    const interviews = transcriptsData.interviews.slice(0, limit)
    return {
      interviews,
      count: interviews.length
    }
  }

  // Otherwise, get chronological timeline across all jobs
  const interviews = getTranscriptsChronological({ limit })
  return {
    interviews,
    count: interviews.length
  }
}

/**
 * Tool 3: Search transcripts
 * Full-text search across all interview transcripts
 *
 * @param {object} args
 * @param {string} args.query - Search query (all words must match)
 * @param {number} [args.jobId] - Filter by job
 * @param {string} [args.sessionType] - Filter by session type
 * @param {number} [args.limit] - Max results (default: 20)
 * @returns {{ results: Array, count: number }}
 */
export function searchTranscripts(args) {
  if (!args.query) {
    return { results: [], count: 0, error: 'query is required' }
  }

  const options = {
    jobId: args.jobId,
    sessionType: args.sessionType,
    limit: args.limit || 20
  }

  const results = searchTranscriptsService(args.query, options)

  return {
    results,
    count: results.length
  }
}

/**
 * Tool 4: Propose interview learnings
 * Claude proposes learnings extracted from transcript for user review
 *
 * @param {object} args
 * @param {number} args.jobId - Job ID
 * @param {string} args.transcriptId - Transcript ID the learnings came from
 * @param {Array<{ content: string, topic: string, outcome: string, sourceQuote?: string }>} args.learnings - Learnings to propose
 * @returns {{ proposed: number, learnings: Array<{ id: string, hasSuggestedLinks: boolean }>, errors?: Array }}
 */
export function proposeInterviewLearnings(args) {
  if (!args.jobId) {
    return { proposed: 0, learnings: [], error: 'jobId is required' }
  }
  if (!args.transcriptId) {
    return { proposed: 0, learnings: [], error: 'transcriptId is required' }
  }
  if (!args.learnings || !Array.isArray(args.learnings) || args.learnings.length === 0) {
    return { proposed: 0, learnings: [], error: 'learnings array is required and must not be empty' }
  }

  const results = []
  const errors = []

  for (const learning of args.learnings) {
    // Validate individual learning
    if (!learning.content) {
      errors.push({ learning, error: 'content is required' })
      continue
    }
    if (!learning.topic) {
      errors.push({ learning, error: 'topic is required' })
      continue
    }
    if (!learning.outcome) {
      errors.push({ learning, error: 'outcome is required' })
      continue
    }

    // Queue the learning
    const result = queueInterviewLearning({
      jobId: args.jobId,
      transcriptId: args.transcriptId,
      content: learning.content,
      topic: learning.topic,
      outcome: learning.outcome,
      sourceQuote: learning.sourceQuote
    })

    if (result.queued) {
      results.push({
        id: result.id,
        hasSuggestedLinks: result.hasSuggestedLinks
      })
    } else {
      errors.push({
        learning: { content: learning.content.substring(0, 50) + '...' },
        error: result.reason
      })
    }
  }

  const response = {
    proposed: results.length,
    learnings: results
  }

  if (errors.length > 0) {
    response.errors = errors
  }

  return response
}

/**
 * Tool 5: Review interview learning
 * User accepts or rejects a proposed learning
 *
 * @param {object} args
 * @param {string} args.learningId - Learning ID to review
 * @param {string} args.decision - 'accept' | 'reject'
 * @returns {{ success: boolean, learning?: object, error?: string }}
 */
export function reviewInterviewLearning(args) {
  if (!args.learningId) {
    return { success: false, error: 'learningId is required' }
  }
  if (!args.decision) {
    return { success: false, error: 'decision is required' }
  }
  if (!['accept', 'reject'].includes(args.decision)) {
    return { success: false, error: 'decision must be "accept" or "reject"' }
  }

  // Map decision to service status
  const status = args.decision === 'accept' ? 'accepted' : 'rejected'

  // Call service
  const result = reviewLearningService(args.learningId, { status })

  if (!result.updated) {
    return { success: false, error: result.reason }
  }

  // If accepted, update profile confidence based on learning outcome
  if (args.decision === 'accept' && result.learning) {
    const learning = result.learning
    // Only update if there are confirmed links (user may add links later)
    if (learning.confirmedProfileLinks && learning.confirmedProfileLinks.length > 0) {
      updateProfileConfidence(args.learningId, learning.outcome)
    }
  }

  return {
    success: true,
    learning: result.learning
  }
}

/**
 * Tool 6: Link learning to profile
 * Get suggested profile links for an accepted learning
 *
 * @param {object} args
 * @param {string} args.learningId - Learning ID to get suggestions for
 * @returns {{ learningId: string, suggestedLinks: Array, hasLinks: boolean, error?: string }}
 */
export function linkLearningToProfile(args) {
  if (!args.learningId) {
    return { learningId: null, suggestedLinks: [], hasLinks: false, error: 'learningId is required' }
  }

  // Find the learning to get its suggested links
  const RESEARCH_DIR = join(DATA_DIR, 'job-research')

  if (!existsSync(RESEARCH_DIR)) {
    return { learningId: args.learningId, suggestedLinks: [], hasLinks: false, error: 'Learning not found' }
  }

  try {
    const files = readdirSync(RESEARCH_DIR)
    const learningFiles = files.filter(f => f.endsWith('-learnings.json'))

    for (const file of learningFiles) {
      const learningsData = JSON.parse(readFileSync(join(RESEARCH_DIR, file), 'utf-8'))

      const learning = learningsData.learnings?.find(l => l.id === args.learningId)
      if (learning) {
        const suggestedLinks = learning.suggestedProfileLinks || []
        return {
          learningId: args.learningId,
          suggestedLinks,
          hasLinks: suggestedLinks.length > 0
        }
      }
    }
  } catch (e) {
    return { learningId: args.learningId, suggestedLinks: [], hasLinks: false, error: e.message }
  }

  return { learningId: args.learningId, suggestedLinks: [], hasLinks: false, error: 'Learning not found' }
}

/**
 * Tool 7: Confirm profile link
 * User confirms linking a learning to a profile item
 *
 * @param {object} args
 * @param {string} args.learningId - Learning ID
 * @param {string} args.entityType - 'story' | 'skill' | 'summary'
 * @param {string} args.entityId - Profile item ID (UUID)
 * @returns {{ success: boolean, link?: object, error?: string }}
 */
export function confirmProfileLink(args) {
  if (!args.learningId) {
    return { success: false, error: 'learningId is required' }
  }
  if (!args.entityType) {
    return { success: false, error: 'entityType is required' }
  }
  if (!['story', 'skill', 'summary'].includes(args.entityType)) {
    return { success: false, error: 'entityType must be "story", "skill", or "summary"' }
  }
  if (!args.entityId) {
    return { success: false, error: 'entityId is required' }
  }

  // Call service
  const result = linkLearningService(args.learningId, {
    entityType: args.entityType,
    entityId: args.entityId
  })

  if (result.linked) {
    return {
      success: true,
      link: result.link
    }
  } else {
    return {
      success: false,
      error: result.reason
    }
  }
}

/**
 * Tool 8: Get profile update suggestions
 * Batch or aggregate suggestions based on accepted learnings
 *
 * @param {object} args
 * @param {string} [args.mode] - 'batch' | 'aggregate' (default: 'batch')
 * @returns {{ suggestions: Array, conflicts: Array, hasConflicts: boolean }}
 */
export function getProfileUpdateSuggestions(args = {}) {
  const { mode = 'batch' } = args

  // Get suggestions from service
  const suggestions = getUpdateSuggestionsService({ mode })

  // Get conflicts
  const conflicts = detectConflicts()

  return {
    suggestions,
    conflicts,
    hasConflicts: conflicts.length > 0
  }
}

/**
 * Tool 9: Get interview patterns
 * Detect recurring patterns across interviews
 *
 * @param {object} args
 * @param {number} [args.minOccurrences] - Minimum occurrences to be a pattern (default: 3)
 * @param {number} [args.minCompanies] - Minimum different companies (default: 2)
 * @returns {{ patterns: Array, count: number }}
 */
export function getInterviewPatterns(args = {}) {
  const patterns = getPatternsService({
    minOccurrences: args.minOccurrences,
    minCompanies: args.minCompanies
  })

  return {
    patterns,
    count: patterns.length
  }
}

/**
 * Tool 10: Get capture reminders
 * Check for interviews needing transcript capture (>24h without notes)
 *
 * @param {object} args
 * @param {number} [args.jobId] - Check specific job (optional)
 * @returns {{ needsCapture: Array, count: number }}
 */
export function getCaptureReminders(args = {}) {
  const { jobId } = args
  const needsCapture = []

  if (jobId) {
    // Check single job
    const result = checkTranscriptReminder(jobId)
    if (result.needsReminder) {
      needsCapture.push({
        jobId,
        interviews: result.interviews
      })
    }
  } else {
    // Check all active jobs (apply-now, maybe, applied)
    const jobs = loadJobsData()
    const activeJobs = jobs.filter(j =>
      ['apply-now', 'maybe', 'applied'].includes(j.status)
    )

    for (const job of activeJobs) {
      const result = checkTranscriptReminder(job.id)
      if (result.needsReminder) {
        needsCapture.push({
          jobId: job.id,
          company: job.company,
          title: job.title,
          interviews: result.interviews
        })
      }
    }
  }

  return {
    needsCapture,
    count: needsCapture.length
  }
}
