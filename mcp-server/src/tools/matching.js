/**
 * Resume Matching MCP Tools
 *
 * Tools for resume-JD matching:
 * - getResumeMatch: Get match score and gap analysis for a single job
 * - getMatchScoresForActiveJobs: Get match scores for all active jobs
 *
 * APPL-01: Match score shows before applying (0-100 with confidence)
 * APPL-02: Gaps identified with specific keywords to add
 */

import { loadProfile } from '../data/profile-loader.js'
import { loadJobsFromDashboard } from '../data/loader.js'
import { matchResumeToJob } from '../services/resume-matcher.js'

/**
 * Get resume-JD match score for a single job
 *
 * APPL-01: Match score shows before applying
 * APPL-02: Identifies gaps and keywords to add
 *
 * @param {object} params - Tool parameters
 * @param {number|string} [params.jobId] - ID of job to match against
 * @param {string} [params.jobDescription] - Direct job description text (alternative to jobId)
 * @returns {object} Match result with score, gaps, and suggestions
 */
export function getResumeMatch({ jobId, jobDescription }) {
  // Load profile for matching
  let profile
  try {
    profile = loadProfile()
  } catch (e) {
    return {
      status: 'error',
      error: 'Failed to load profile',
      details: e.message
    }
  }

  // Get job description from job if not provided directly
  let description = jobDescription
  let jobInfo = null

  if (!description && jobId !== undefined && jobId !== null) {
    const data = loadJobsFromDashboard()
    const job = data.jobs?.find(j => j.id === jobId || j.id === Number(jobId))

    if (!job) {
      return {
        status: 'error',
        error: `Job with ID ${jobId} not found`
      }
    }

    jobInfo = {
      id: job.id,
      title: job.title,
      company: job.company,
      fitScore: job.fitScore
    }

    // Use notes or description field
    description = job.notes || job.description || ''
  }

  if (!description) {
    return {
      status: 'error',
      error: 'No job description available',
      suggestion: 'Provide job description text or ensure job has notes/description field',
      jobInfo
    }
  }

  // Calculate match
  const match = matchResumeToJob(profile, description)

  // Format matched items (flatten objects to strings for display)
  const matchedDisplay = match.matched.map(m => {
    if (typeof m === 'object' && m.keyword) {
      return `${m.keyword} (via: ${m.via})`
    }
    return m
  })

  // Build summary
  const summary = `${match.score}% match - ${match.matched.length} skills matched, ${match.missing.length} gaps identified`

  return {
    status: 'success',
    score: match.score,
    confidence: match.confidence,
    matched: matchedDisplay,
    gaps: match.missing,
    suggestions: match.suggestions,
    totalJobKeywords: match.totalJobKeywords,
    summary,
    jobInfo
  }
}

/**
 * Get match scores for all active jobs
 *
 * Returns ranked list of active jobs by resume match score.
 * Useful for prioritizing which jobs to apply to based on profile fit.
 *
 * @param {object} [params] - Tool parameters (optional)
 * @param {number} [params.limit] - Maximum number of jobs to return (default: all)
 * @returns {object} List of jobs with match scores
 */
export function getMatchScoresForActiveJobs({ limit } = {}) {
  // Load profile
  let profile
  try {
    profile = loadProfile()
  } catch (e) {
    return {
      status: 'error',
      error: 'Failed to load profile',
      details: e.message
    }
  }

  // Load jobs
  const data = loadJobsFromDashboard()
  const allJobs = data.jobs || []

  // Filter to active statuses
  const activeStatuses = ['apply-now', 'maybe', 'inbox']
  const activeJobs = allJobs.filter(j => activeStatuses.includes(j.status))

  // Calculate match scores for each job
  const results = activeJobs.map(job => {
    const description = job.notes || job.description || ''

    if (!description) {
      return {
        jobId: job.id,
        title: job.title,
        company: job.company,
        status: job.status,
        fitScore: job.fitScore || null,
        resumeMatch: null,
        confidence: 'no-data',
        topGaps: [],
        reason: 'No job description available'
      }
    }

    const match = matchResumeToJob(profile, description)

    return {
      jobId: job.id,
      title: job.title,
      company: job.company,
      status: job.status,
      fitScore: job.fitScore || null,
      resumeMatch: match.score,
      confidence: match.confidence,
      topGaps: match.missing.slice(0, 3)
    }
  })

  // Sort by resumeMatch descending (nulls at end)
  results.sort((a, b) => {
    if (a.resumeMatch === null && b.resumeMatch === null) return 0
    if (a.resumeMatch === null) return 1
    if (b.resumeMatch === null) return -1
    return b.resumeMatch - a.resumeMatch
  })

  // Apply limit if specified
  const limitedResults = limit ? results.slice(0, limit) : results

  // Calculate summary stats
  const withScores = results.filter(r => r.resumeMatch !== null)
  const avgScore = withScores.length > 0
    ? Math.round(withScores.reduce((sum, r) => sum + r.resumeMatch, 0) / withScores.length)
    : 0

  return {
    status: 'success',
    total: activeJobs.length,
    showing: limitedResults.length,
    averageMatchScore: avgScore,
    highMatches: withScores.filter(r => r.resumeMatch >= 70).length,
    noData: results.filter(r => r.resumeMatch === null).length,
    jobs: limitedResults
  }
}
