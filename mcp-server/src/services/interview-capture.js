/**
 * Interview Capture Service
 * Phase 9: Interview Learning - Transcript capture and search
 *
 * Provides:
 * - captureTranscript: Save interview transcript with metadata
 * - getTranscriptsForJob: Get all transcripts for a specific job
 * - getTranscriptsChronological: Timeline view across all jobs
 * - searchTranscripts: Full-text search across transcripts
 * - checkTranscriptReminder: 24h reminder logic for uncaptured interviews
 *
 * Per CONTEXT.md:
 * - User pastes text transcripts (from external transcription services)
 * - Practice and real interviews stored together, tagged differently
 * - Reminder if >24h since interview with no notes captured
 */

import { v4 as uuidv4 } from 'uuid'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import { differenceInHours, parseISO } from 'date-fns'
import { validateInterviewTranscript, validateTranscriptStorage } from '../../../schemas/interview-learning.schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const RESEARCH_DIR = join(DATA_DIR, 'job-research')
const JOBS_FILE = join(DATA_DIR, 'jobs.json')

// Ensure research directory exists
if (!existsSync(RESEARCH_DIR)) {
  mkdirSync(RESEARCH_DIR, { recursive: true })
}

/**
 * Atomic file write using temp file + rename pattern
 */
function atomicWriteSync(filePath, data) {
  const tempPath = join(tmpdir(), `transcript-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`)
  try {
    writeFileSync(tempPath, data, 'utf-8')
    renameSync(tempPath, filePath)
  } catch (err) {
    try { unlinkSync(tempPath) } catch (e) { /* ignore */ }
    throw err
  }
}

/**
 * Get transcripts file path for a job
 */
function getTranscriptsPath(jobId) {
  return join(RESEARCH_DIR, `${jobId}-transcripts.json`)
}

/**
 * Load transcripts data for a job
 *
 * @param {number} jobId - Job ID
 * @returns {{ interviews: Array, lastUpdated: string }}
 */
function loadTranscriptsData(jobId) {
  const transcriptsPath = getTranscriptsPath(jobId)

  if (!existsSync(transcriptsPath)) {
    return { interviews: [], lastUpdated: new Date().toISOString() }
  }

  try {
    return JSON.parse(readFileSync(transcriptsPath, 'utf-8'))
  } catch (e) {
    console.error(`Error loading transcripts for job ${jobId}:`, e.message)
    return { interviews: [], lastUpdated: new Date().toISOString() }
  }
}

/**
 * Save transcripts data for a job
 *
 * @param {number} jobId - Job ID
 * @param {object} data - Transcripts data to save
 */
function saveTranscriptsData(jobId, data) {
  const transcriptsPath = getTranscriptsPath(jobId)
  data.lastUpdated = new Date().toISOString()
  atomicWriteSync(transcriptsPath, JSON.stringify(data, null, 2))
}

/**
 * Capture an interview transcript
 *
 * @param {object} transcript - Transcript data matching InterviewTranscriptSchema
 * @returns {{ captured: boolean, id: string, transcriptCount: number, error?: string }}
 */
export function captureTranscript(transcript) {
  try {
    // Generate UUID if not provided
    if (!transcript.id) {
      transcript.id = uuidv4()
    }

    // Set capturedAt to now if not provided
    if (!transcript.capturedAt) {
      transcript.capturedAt = new Date().toISOString()
    }

    // Validate the transcript
    const validation = validateInterviewTranscript(transcript, { mode: 'strict' })
    if (!validation.valid) {
      return {
        captured: false,
        id: null,
        transcriptCount: 0,
        error: `Validation failed: ${JSON.stringify(validation.errors)}`
      }
    }

    const validatedTranscript = validation.data

    // Load existing transcripts for job
    const transcriptsData = loadTranscriptsData(validatedTranscript.jobId)

    // Append new transcript
    transcriptsData.interviews.push(validatedTranscript)

    // Save with atomic write
    saveTranscriptsData(validatedTranscript.jobId, transcriptsData)

    return {
      captured: true,
      id: validatedTranscript.id,
      transcriptCount: transcriptsData.interviews.length
    }
  } catch (err) {
    return {
      captured: false,
      id: null,
      transcriptCount: 0,
      error: err.message
    }
  }
}

/**
 * Get all transcripts for a job
 *
 * @param {number} jobId - Job ID
 * @returns {{ interviews: Array, lastUpdated: string }}
 */
export function getTranscriptsForJob(jobId) {
  return loadTranscriptsData(jobId)
}

/**
 * Get transcripts across all jobs in chronological order
 *
 * @param {object} options - Options
 * @param {number} [options.limit=50] - Maximum number of transcripts to return
 * @returns {Array<object>} Array of transcripts with jobId included
 */
export function getTranscriptsChronological(options = { limit: 50 }) {
  const { limit = 50 } = options
  const allTranscripts = []

  if (!existsSync(RESEARCH_DIR)) {
    return []
  }

  try {
    const files = readdirSync(RESEARCH_DIR)
    const transcriptFiles = files.filter(f => f.endsWith('-transcripts.json'))

    for (const file of transcriptFiles) {
      const jobIdMatch = file.match(/^(\d+)-transcripts\.json$/)
      if (!jobIdMatch) continue

      const jobId = parseInt(jobIdMatch[1], 10)
      const transcriptsData = loadTranscriptsData(jobId)

      // Add jobId to each transcript for context
      for (const transcript of transcriptsData.interviews) {
        allTranscripts.push({
          ...transcript,
          jobId // Ensure jobId is present
        })
      }
    }

    // Sort by interviewDate descending (most recent first)
    allTranscripts.sort((a, b) => {
      const dateA = new Date(a.interviewDate)
      const dateB = new Date(b.interviewDate)
      return dateB - dateA
    })

    // Apply limit
    return allTranscripts.slice(0, limit)
  } catch (e) {
    console.error('Error getting chronological transcripts:', e.message)
    return []
  }
}

/**
 * Search transcripts by content
 *
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @param {number} [options.jobId] - Filter by job ID
 * @param {string} [options.sessionType] - Filter by session type ('practice' or 'real-interview')
 * @param {number} [options.limit=20] - Maximum results to return
 * @returns {Array<object>} Matching transcripts with context snippets
 */
export function searchTranscripts(query, options = {}) {
  const { jobId, sessionType, limit = 20 } = options

  if (!query || query.trim() === '') {
    return []
  }

  // Normalize query and split into words
  const normalizedQuery = query.toLowerCase().trim()
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0)

  if (queryWords.length === 0) {
    return []
  }

  const matches = []

  if (!existsSync(RESEARCH_DIR)) {
    return []
  }

  try {
    const files = readdirSync(RESEARCH_DIR)
    const transcriptFiles = files.filter(f => f.endsWith('-transcripts.json'))

    for (const file of transcriptFiles) {
      const jobIdMatch = file.match(/^(\d+)-transcripts\.json$/)
      if (!jobIdMatch) continue

      const fileJobId = parseInt(jobIdMatch[1], 10)

      // Skip if filtering by jobId and this doesn't match
      if (jobId !== undefined && fileJobId !== jobId) continue

      const transcriptsData = loadTranscriptsData(fileJobId)

      for (const transcript of transcriptsData.interviews) {
        // Skip if filtering by sessionType and this doesn't match
        if (sessionType && transcript.sessionType !== sessionType) continue

        const normalizedTranscript = transcript.rawTranscript.toLowerCase()

        // Check if ALL query words are present
        const allWordsMatch = queryWords.every(word => normalizedTranscript.includes(word))

        if (allWordsMatch) {
          // Find first match for context snippet
          const firstWordIndex = normalizedTranscript.indexOf(queryWords[0])
          const contextStart = Math.max(0, firstWordIndex - 50)
          const contextEnd = Math.min(transcript.rawTranscript.length, firstWordIndex + 200)

          const snippet = transcript.rawTranscript.slice(contextStart, contextEnd)
          const contextSnippet = (contextStart > 0 ? '...' : '') +
            snippet +
            (contextEnd < transcript.rawTranscript.length ? '...' : '')

          matches.push({
            ...transcript,
            jobId: fileJobId,
            contextSnippet
          })
        }
      }
    }

    // Sort by interviewDate descending
    matches.sort((a, b) => {
      const dateA = new Date(a.interviewDate)
      const dateB = new Date(b.interviewDate)
      return dateB - dateA
    })

    // Apply limit
    return matches.slice(0, limit)
  } catch (e) {
    console.error('Error searching transcripts:', e.message)
    return []
  }
}

/**
 * Load jobs data
 *
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
 * Check if a job needs a transcript capture reminder
 *
 * Looks for interviews within the last 7 days that:
 * 1. Have no transcript captured
 * 2. Are more than 24 hours old
 *
 * @param {number} jobId - Job ID to check
 * @returns {{ needsReminder: boolean, interviews: Array<{ interviewDate: string, hoursSince: number, message: string }> }}
 */
export function checkTranscriptReminder(jobId) {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const reminderInterviews = []

  // Load job data to find interview updates
  const jobs = loadJobsData()
  const job = jobs.find(j => j.id === jobId)

  if (!job) {
    return { needsReminder: false, interviews: [] }
  }

  // Look for interview-related updates
  const updates = job.updates || []
  const interviewUpdates = updates.filter(u => {
    // Look for updates that indicate an interview happened
    const content = (u.content || u.note || '').toLowerCase()
    return content.includes('interview') ||
           u.type === 'interview' ||
           u.type === 'phone-screen' ||
           u.type === 'onsite'
  })

  // Load existing transcripts to check what's already captured
  const transcriptsData = loadTranscriptsData(jobId)
  const capturedDates = new Set(
    transcriptsData.interviews.map(t => t.interviewDate.split('T')[0])
  )

  for (const update of interviewUpdates) {
    const updateDate = parseISO(update.date || update.createdAt || update.timestamp)

    // Only check interviews within the last 7 days
    if (updateDate < sevenDaysAgo) continue

    const hoursSince = differenceInHours(now, updateDate)

    // Check if more than 24 hours old and no transcript captured for this date
    if (hoursSince > 24) {
      const dateString = updateDate.toISOString().split('T')[0]
      if (!capturedDates.has(dateString)) {
        reminderInterviews.push({
          interviewDate: updateDate.toISOString(),
          hoursSince,
          message: `Interview from ${dateString} (${hoursSince} hours ago) has no transcript captured yet.`
        })
      }
    }
  }

  return {
    needsReminder: reminderInterviews.length > 0,
    interviews: reminderInterviews
  }
}
