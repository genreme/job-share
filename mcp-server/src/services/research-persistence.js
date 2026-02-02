/**
 * Research Persistence Service
 * APPL-14: Research outputs persist per job
 *
 * Provides retrieval functions for job research (company and manager)
 * and highlights extraction for quick surfacing in conversations.
 *
 * Per CONTEXT.md: Only show highlights by default, full research on request.
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const RESEARCH_DIR = join(DATA_DIR, 'job-research')

/**
 * Get research for a job
 * Loads company and/or manager research from persisted files
 *
 * @param {number} jobId - Job ID to get research for
 * @param {string} type - 'all', 'company', or 'manager'
 * @returns {{ jobId: number, company: object|null, manager: object|null, hasResearch: boolean }}
 */
export function getJobResearch(jobId, type = 'all') {
  const result = {
    jobId,
    company: null,
    manager: null,
    hasResearch: false
  }

  // Load company research
  if (type === 'all' || type === 'company') {
    const companyPath = join(RESEARCH_DIR, `${jobId}-company.json`)
    if (existsSync(companyPath)) {
      try {
        result.company = JSON.parse(readFileSync(companyPath, 'utf-8'))
        result.hasResearch = true
      } catch (e) {
        console.error(`Error loading company research for job ${jobId}:`, e.message)
      }
    }
  }

  // Load manager research
  if (type === 'all' || type === 'manager') {
    const managerPath = join(RESEARCH_DIR, `${jobId}-manager.json`)
    if (existsSync(managerPath)) {
      try {
        result.manager = JSON.parse(readFileSync(managerPath, 'utf-8'))
        result.hasResearch = true
      } catch (e) {
        console.error(`Error loading manager research for job ${jobId}:`, e.message)
      }
    }
  }

  return result
}

/**
 * Get research highlights for a job (for surfacing in conversation)
 * Per CONTEXT.md: Only show highlights, full research on request
 *
 * Extracts top 5 highlights:
 * - Company highlights (first 3)
 * - Funding stage if available
 * - Culture work style if available
 * - First talking point from manager if available
 *
 * @param {number} jobId - Job ID to get highlights for
 * @returns {{ jobId: number, highlights: string[], fullResearchAvailable: boolean, lastUpdated: string }|null}
 */
export function getResearchHighlights(jobId) {
  const research = getJobResearch(jobId)

  if (!research.hasResearch) {
    return null
  }

  const highlights = []

  if (research.company) {
    // Add company highlights (first 3)
    if (research.company.highlights?.length > 0) {
      highlights.push(...research.company.highlights.slice(0, 3))
    }

    // Add funding stage if available and not already in highlights
    if (research.company.funding?.stage) {
      const fundingHighlight = `Funding: ${research.company.funding.stage}`
      if (!highlights.some(h => h.toLowerCase().includes('funding'))) {
        highlights.push(fundingHighlight)
      }
    }

    // Add culture work style if available
    if (research.company.culture?.workStyle) {
      const cultureHighlight = `Culture: ${research.company.culture.workStyle}`
      if (!highlights.some(h => h.toLowerCase().includes('culture'))) {
        highlights.push(cultureHighlight)
      }
    }
  }

  if (research.manager) {
    // Add first talking point from manager
    if (research.manager.talkingPoints?.length > 0) {
      highlights.push(`Talking point: ${research.manager.talkingPoints[0]}`)
    }
  }

  // Determine last updated date
  let lastUpdated = null
  if (research.company?.researchedAt) {
    lastUpdated = research.company.researchedAt
  }
  if (research.manager?.researchedAt) {
    if (!lastUpdated || new Date(research.manager.researchedAt) > new Date(lastUpdated)) {
      lastUpdated = research.manager.researchedAt
    }
  }

  return {
    jobId,
    highlights: highlights.slice(0, 5),
    fullResearchAvailable: true,
    lastUpdated
  }
}

/**
 * Save research to job data (reference only)
 * This is called by company-research.js and manager-research.js
 * to update the job entry with a reference to the research
 *
 * Note: This function is exported for use by other services but
 * the actual implementation should update jobs.json via loader.js
 * This is a placeholder that returns the structure expected
 *
 * @param {number} jobId - Job ID
 * @param {string} type - 'company' or 'manager'
 * @param {object} reference - Research reference data
 * @returns {{ success: boolean }}
 */
export function saveResearchReference(jobId, type, reference) {
  // This would integrate with loader.js to update jobs.json
  // For now, the reference is stored in the research files themselves
  return { success: true }
}

/**
 * Load research from persisted files (alias for getJobResearch)
 * Provided for API symmetry with save operations
 *
 * @param {number} jobId - Job ID
 * @param {string} type - 'company' or 'manager' or 'all'
 * @returns {object} Research data
 */
export function loadResearch(jobId, type = 'all') {
  return getJobResearch(jobId, type)
}

/**
 * Check if research exists for a job
 *
 * @param {number} jobId - Job ID
 * @param {string} type - 'company', 'manager', or 'any'
 * @returns {boolean}
 */
export function hasResearch(jobId, type = 'any') {
  if (type === 'company') {
    return existsSync(join(RESEARCH_DIR, `${jobId}-company.json`))
  }
  if (type === 'manager') {
    return existsSync(join(RESEARCH_DIR, `${jobId}-manager.json`))
  }
  // 'any' - check both
  return existsSync(join(RESEARCH_DIR, `${jobId}-company.json`)) ||
         existsSync(join(RESEARCH_DIR, `${jobId}-manager.json`))
}

/**
 * Get the research directory path
 * Useful for debugging and testing
 *
 * @returns {string}
 */
export function getResearchDirectory() {
  return RESEARCH_DIR
}
