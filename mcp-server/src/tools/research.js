/**
 * Research MCP Tools
 *
 * Exposes research infrastructure as MCP tools:
 * - Company research (start, save, existing detection)
 * - Manager research (start, save)
 * - Research retrieval (highlights or full)
 *
 * APPL-08: Deep company investigation
 * APPL-09: Hiring manager research
 * APPL-14: Research outputs persist per job
 */

import { loadJobsFromDashboard } from '../data/loader.js'
import {
  researchCompany,
  updateCompanyResearch,
  checkForExistingCompanyResearch
} from '../services/company-research.js'
import {
  researchHiringManager,
  updateManagerResearch
} from '../services/manager-research.js'
import {
  getJobResearch,
  getResearchHighlights
} from '../services/research-persistence.js'

/**
 * Start company research for a job
 * Checks for existing research first (per CONTEXT.md: prompt for reuse)
 *
 * APPL-08: Deep company investigation
 *
 * @param {{ jobId: number }} params
 * @returns {{ status: string, ... }}
 */
export function startCompanyResearch({ jobId }) {
  if (!jobId) {
    return { error: 'Job ID is required' }
  }

  // Load job to get company name
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job with ID ${jobId} not found` }
  }

  const companyName = job.company

  if (!companyName) {
    return {
      error: 'Job has no company name',
      suggestion: 'Update the job with a company name first'
    }
  }

  // Check for existing research on this company
  const existing = checkForExistingCompanyResearch(companyName)

  if (existing.found) {
    return {
      status: 'existing_research_found',
      existing: {
        jobId: existing.existingJobId,
        companyName: existing.companyName,
        researchedAt: existing.researchedAt,
        daysSinceResearch: existing.daysSinceResearch,
        highlights: existing.highlights
      },
      options: ['reuse', 'refresh', 'copy_and_update'],
      suggestion: existing.suggestion,
      note: 'Use reuse to skip re-research, refresh to start fresh, or copy_and_update to use as starting point'
    }
  }

  // No existing research - return template for Claude to populate
  return researchCompany(jobId, companyName)
}

/**
 * Save company research findings
 * Validates and persists as JSON + markdown
 *
 * @param {{ jobId: number, findings: object }} params
 * @returns {{ success: boolean, saved?: object, highlights?: string[], error?: string }}
 */
export function saveCompanyResearch({ jobId, findings }) {
  if (!jobId) {
    return { error: 'Job ID is required' }
  }

  if (!findings || typeof findings !== 'object') {
    return { error: 'Findings object is required' }
  }

  return updateCompanyResearch(jobId, findings)
}

/**
 * Start hiring manager research for a job
 * Returns template focused on style and connection (per CONTEXT.md)
 *
 * APPL-09: Focus on style and connection
 *
 * @param {{ jobId: number, managerName?: string }} params
 * @returns {{ status: string, research: object, instructions: string } | { error: string }}
 */
export function startManagerResearch({ jobId, managerName }) {
  if (!jobId) {
    return { error: 'Job ID is required' }
  }

  // Load job to get company and possibly hiring manager
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job with ID ${jobId} not found` }
  }

  // Use provided managerName or fall back to job.hiringManager
  const name = managerName || job.hiringManager

  if (!name) {
    return {
      error: 'No hiring manager name available',
      suggestion: 'Provide managerName parameter or set hiringManager on the job first',
      action: 'Use set_hiring_manager tool to record hiring manager details'
    }
  }

  const companyName = job.company || 'Unknown Company'

  return researchHiringManager(jobId, name, companyName)
}

/**
 * Save manager research findings
 * Validates and persists as JSON + markdown
 *
 * @param {{ jobId: number, findings: object }} params
 * @returns {{ success: boolean, saved?: object, error?: string }}
 */
export function saveManagerResearch({ jobId, findings }) {
  if (!jobId) {
    return { error: 'Job ID is required' }
  }

  if (!findings || typeof findings !== 'object') {
    return { error: 'Findings object is required' }
  }

  return updateManagerResearch(jobId, findings)
}

/**
 * Get research for a job
 * Returns highlights by default (per CONTEXT.md), full research on request
 *
 * APPL-14: Research outputs persist per job
 *
 * @param {{ jobId: number, type?: 'highlights'|'company'|'manager'|'all' }} params
 * @returns {{ jobId: number, ... } | null}
 */
export function getResearch({ jobId, type = 'highlights' }) {
  if (!jobId) {
    return { error: 'Job ID is required' }
  }

  // Default to highlights for quick surfacing
  if (type === 'highlights') {
    const highlights = getResearchHighlights(jobId)

    if (!highlights) {
      return {
        jobId,
        hasResearch: false,
        message: 'No research found for this job',
        suggestion: 'Use start_company_research to begin researching'
      }
    }

    return highlights
  }

  // Full research request
  const research = getJobResearch(jobId, type)

  if (!research.hasResearch) {
    return {
      jobId,
      hasResearch: false,
      message: 'No research found for this job',
      suggestion: 'Use start_company_research to begin researching'
    }
  }

  return research
}
