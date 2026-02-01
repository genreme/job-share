/**
 * Archive MCP Tools
 *
 * Tools for archiving job descriptions as PDFs and verifying job status.
 * Implements DISC-08 (PDF archiving) and DISC-09 (staleness verification).
 */

import { archiveJobAsPdf, listArchivedJobs } from '../services/pdf-archiver.js'
import { verifyActiveJobs } from '../services/job-verifier.js'
import { loadJobsFromDashboard, writeJobsData } from '../data/loader.js'

/**
 * Archive a job as PDF
 *
 * @param {object} params
 * @param {string|number} params.jobId - ID of the job to archive
 * @returns {Promise<{success: boolean, filename?: string, path?: string, error?: string}>}
 */
export async function archiveJob({ jobId }) {
  if (!jobId) {
    return {
      success: false,
      error: 'jobId is required'
    }
  }

  // Load job from dashboard
  const jobsData = loadJobsFromDashboard()
  const jobs = jobsData.jobs || []

  const job = jobs.find(j =>
    j.id === jobId ||
    j.id === String(jobId) ||
    j.id === Number(jobId)
  )

  if (!job) {
    return {
      success: false,
      error: `Job not found with ID: ${jobId}`
    }
  }

  // Archive the job as PDF
  const result = await archiveJobAsPdf(job)

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'PDF generation failed'
    }
  }

  // Update job with archive info
  const jobIndex = jobs.findIndex(j =>
    j.id === jobId ||
    j.id === String(jobId) ||
    j.id === Number(jobId)
  )

  if (jobIndex >= 0) {
    jobs[jobIndex].archivedAt = result.archivedAt
    jobs[jobIndex].archivePath = result.path

    jobsData.jobs = jobs
    writeJobsData(jobsData)
  }

  return {
    success: true,
    filename: result.filename,
    path: result.path,
    archivedAt: result.archivedAt,
    usedFallback: result.usedFallback
  }
}

/**
 * List all archived job PDFs
 *
 * @returns {{count: number, archives: Array<{filename: string, path: string, createdAt: string}>}}
 */
export function listArchives() {
  const archives = listArchivedJobs()

  return {
    count: archives.length,
    archives
  }
}

/**
 * Verify all active jobs for staleness
 *
 * @returns {Promise<{
 *   summary: {checked: number, active: number, closed: number, uncertain: number, updated: number},
 *   closedJobs: Array<{id: string|number, title: string, company: string, reason: string}>,
 *   updatedJobs: Array<{id: string|number, title: string, newFitScore: number, oldFitScore: number}>,
 *   recommendations: string[],
 *   error?: string
 * }>}
 */
export async function verifyJobs() {
  const result = await verifyActiveJobs()

  // Build recommendations based on results
  const recommendations = []

  if (result.error) {
    recommendations.push(`Setup required: ${result.error}`)
  }

  if (result.closed > 0) {
    recommendations.push(`${result.closed} job(s) have been closed. Consider removing them from active tracking or archiving them.`)
  }

  if (result.updated > 0) {
    recommendations.push(`${result.updated} job(s) had data changes. Fit scores have been recalculated.`)
  }

  if (result.uncertain > 0) {
    recommendations.push(`${result.uncertain} job(s) could not be verified. This may indicate network issues or changed URLs.`)
  }

  if (result.active > 0 && result.closed === 0 && result.updated === 0) {
    recommendations.push('All verified jobs are still active with no changes detected.')
  }

  return {
    summary: {
      checked: result.checked,
      active: result.active,
      closed: result.closed,
      uncertain: result.uncertain,
      updated: result.updated
    },
    closedJobs: result.closedJobs,
    updatedJobs: result.updatedJobs,
    recommendations,
    error: result.error
  }
}

/**
 * Tool definitions for MCP server registration
 */
export const archiveToolDefinitions = [
  {
    name: 'archive_job',
    description: 'Archive a job description as a PDF for pattern analysis. Creates a snapshot of the job posting that can be referenced later.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: ['string', 'number'],
          description: 'ID of the job to archive'
        }
      },
      required: ['jobId']
    }
  },
  {
    name: 'list_archives',
    description: 'List all archived job PDFs. Returns a list of archived job descriptions with their filenames and creation dates.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'verify_jobs',
    description: 'Verify all active jobs for staleness. Checks if job postings are still active, detects closed positions, and refreshes fit scores when job data has changed.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
]

/**
 * Handle tool calls for archive tools
 */
export async function handleArchiveTool(name, args) {
  switch (name) {
    case 'archive_job':
      return await archiveJob(args)
    case 'list_archives':
      return listArchives()
    case 'verify_jobs':
      return await verifyJobs()
    default:
      return { error: `Unknown tool: ${name}` }
  }
}
