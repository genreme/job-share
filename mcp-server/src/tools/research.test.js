/**
 * Tests for Research MCP Tools
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  startCompanyResearch,
  saveCompanyResearch,
  startManagerResearch,
  saveManagerResearch,
  getResearch
} from './research.js'

// Mock the loader module
vi.mock('../data/loader.js', () => ({
  loadJobsFromDashboard: vi.fn()
}))

// Mock the research services
vi.mock('../services/company-research.js', () => ({
  researchCompany: vi.fn(),
  updateCompanyResearch: vi.fn(),
  checkForExistingCompanyResearch: vi.fn()
}))

vi.mock('../services/manager-research.js', () => ({
  researchHiringManager: vi.fn(),
  updateManagerResearch: vi.fn()
}))

vi.mock('../services/research-persistence.js', () => ({
  getJobResearch: vi.fn(),
  getResearchHighlights: vi.fn()
}))

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

// Use unique job IDs in 40000 range for this test file
const TEST_JOB_ID = 40001
const TEST_JOB_ID_2 = 40002

describe('Research MCP Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('startCompanyResearch', () => {
    it('returns error when no jobId provided', () => {
      const result = startCompanyResearch({})

      expect(result.error).toBe('Job ID is required')
    })

    it('returns error when job not found', () => {
      loadJobsFromDashboard.mockReturnValue({ jobs: [] })

      const result = startCompanyResearch({ jobId: TEST_JOB_ID })

      expect(result.error).toBe(`Job with ID ${TEST_JOB_ID} not found`)
    })

    it('returns error when job has no company name', () => {
      loadJobsFromDashboard.mockReturnValue({
        jobs: [{ id: TEST_JOB_ID, title: 'Developer', company: '' }]
      })

      const result = startCompanyResearch({ jobId: TEST_JOB_ID })

      expect(result.error).toBe('Job has no company name')
      expect(result.suggestion).toContain('Update the job')
    })

    it('returns existing research when found', () => {
      loadJobsFromDashboard.mockReturnValue({
        jobs: [{ id: TEST_JOB_ID, title: 'Developer', company: 'Acme Corp' }]
      })

      checkForExistingCompanyResearch.mockReturnValue({
        found: true,
        existingJobId: TEST_JOB_ID_2,
        companyName: 'Acme Corp',
        researchedAt: '2026-01-15T10:00:00Z',
        daysSinceResearch: 18,
        highlights: ['Series B funded', 'Remote-first culture'],
        suggestion: 'Recent research available. Reuse?'
      })

      const result = startCompanyResearch({ jobId: TEST_JOB_ID })

      expect(result.status).toBe('existing_research_found')
      expect(result.existing.companyName).toBe('Acme Corp')
      expect(result.options).toContain('reuse')
      expect(result.options).toContain('refresh')
    })

    it('returns template when no existing research', () => {
      loadJobsFromDashboard.mockReturnValue({
        jobs: [{ id: TEST_JOB_ID, title: 'Developer', company: 'NewCo Inc' }]
      })

      checkForExistingCompanyResearch.mockReturnValue({ found: false })

      researchCompany.mockReturnValue({
        status: 'template_ready',
        research: { companyName: 'NewCo Inc' },
        instructions: 'Research NewCo Inc...'
      })

      const result = startCompanyResearch({ jobId: TEST_JOB_ID })

      expect(result.status).toBe('template_ready')
      expect(researchCompany).toHaveBeenCalledWith(TEST_JOB_ID, 'NewCo Inc')
    })
  })

  describe('saveCompanyResearch', () => {
    it('returns error when no jobId provided', () => {
      const result = saveCompanyResearch({ findings: {} })

      expect(result.error).toBe('Job ID is required')
    })

    it('returns error when no findings provided', () => {
      const result = saveCompanyResearch({ jobId: TEST_JOB_ID })

      expect(result.error).toBe('Findings object is required')
    })

    it('delegates to updateCompanyResearch service', () => {
      updateCompanyResearch.mockReturnValue({
        success: true,
        saved: { json: '/path/to/json', markdown: '/path/to/md' },
        highlights: ['Key point 1']
      })

      const findings = {
        companyName: 'Acme Corp',
        highlights: ['Key point 1']
      }

      const result = saveCompanyResearch({ jobId: TEST_JOB_ID, findings })

      expect(updateCompanyResearch).toHaveBeenCalledWith(TEST_JOB_ID, findings)
      expect(result.success).toBe(true)
    })

    it('returns validation errors from service', () => {
      updateCompanyResearch.mockReturnValue({
        error: 'Invalid research format',
        details: [{ path: 'companyName', message: 'Required' }]
      })

      const result = saveCompanyResearch({ jobId: TEST_JOB_ID, findings: {} })

      expect(result.error).toBe('Invalid research format')
    })
  })

  describe('startManagerResearch', () => {
    it('returns error when no jobId provided', () => {
      const result = startManagerResearch({})

      expect(result.error).toBe('Job ID is required')
    })

    it('returns error when job not found', () => {
      loadJobsFromDashboard.mockReturnValue({ jobs: [] })

      const result = startManagerResearch({ jobId: TEST_JOB_ID })

      expect(result.error).toBe(`Job with ID ${TEST_JOB_ID} not found`)
    })

    it('returns error when no manager name available', () => {
      loadJobsFromDashboard.mockReturnValue({
        jobs: [{ id: TEST_JOB_ID, title: 'Developer', company: 'Acme' }]
      })

      const result = startManagerResearch({ jobId: TEST_JOB_ID })

      expect(result.error).toBe('No hiring manager name available')
      expect(result.suggestion).toContain('managerName parameter')
    })

    it('uses provided managerName over job.hiringManager', () => {
      loadJobsFromDashboard.mockReturnValue({
        jobs: [{
          id: TEST_JOB_ID,
          title: 'Developer',
          company: 'Acme',
          hiringManager: 'Jane Doe'
        }]
      })

      researchHiringManager.mockReturnValue({
        status: 'template_ready',
        research: { managerName: 'John Smith' },
        instructions: 'Research John Smith...'
      })

      const result = startManagerResearch({
        jobId: TEST_JOB_ID,
        managerName: 'John Smith'
      })

      expect(researchHiringManager).toHaveBeenCalledWith(
        TEST_JOB_ID,
        'John Smith',
        'Acme'
      )
    })

    it('falls back to job.hiringManager when no managerName provided', () => {
      loadJobsFromDashboard.mockReturnValue({
        jobs: [{
          id: TEST_JOB_ID,
          title: 'Developer',
          company: 'Acme',
          hiringManager: 'Jane Doe'
        }]
      })

      researchHiringManager.mockReturnValue({
        status: 'template_ready',
        research: { managerName: 'Jane Doe' },
        instructions: 'Research Jane Doe...'
      })

      const result = startManagerResearch({ jobId: TEST_JOB_ID })

      expect(researchHiringManager).toHaveBeenCalledWith(
        TEST_JOB_ID,
        'Jane Doe',
        'Acme'
      )
    })
  })

  describe('saveManagerResearch', () => {
    it('returns error when no jobId provided', () => {
      const result = saveManagerResearch({ findings: {} })

      expect(result.error).toBe('Job ID is required')
    })

    it('returns error when no findings provided', () => {
      const result = saveManagerResearch({ jobId: TEST_JOB_ID })

      expect(result.error).toBe('Findings object is required')
    })

    it('delegates to updateManagerResearch service', () => {
      updateManagerResearch.mockReturnValue({
        success: true,
        saved: { json: '/path/to/json', markdown: '/path/to/md' }
      })

      const findings = {
        managerName: 'Jane Doe',
        talkingPoints: ['Shared interest in design systems']
      }

      const result = saveManagerResearch({ jobId: TEST_JOB_ID, findings })

      expect(updateManagerResearch).toHaveBeenCalledWith(TEST_JOB_ID, findings)
      expect(result.success).toBe(true)
    })
  })

  describe('getResearch', () => {
    it('returns error when no jobId provided', () => {
      const result = getResearch({})

      expect(result.error).toBe('Job ID is required')
    })

    it('returns highlights by default', () => {
      getResearchHighlights.mockReturnValue({
        jobId: TEST_JOB_ID,
        highlights: ['Series B funded', 'Remote culture'],
        fullResearchAvailable: true,
        lastUpdated: '2026-01-20T10:00:00Z'
      })

      const result = getResearch({ jobId: TEST_JOB_ID })

      expect(getResearchHighlights).toHaveBeenCalledWith(TEST_JOB_ID)
      expect(result.highlights).toHaveLength(2)
      expect(getJobResearch).not.toHaveBeenCalled()
    })

    it('returns no research message when highlights not found', () => {
      getResearchHighlights.mockReturnValue(null)

      const result = getResearch({ jobId: TEST_JOB_ID })

      expect(result.hasResearch).toBe(false)
      expect(result.suggestion).toContain('start_company_research')
    })

    it('returns full company research when type=company', () => {
      getJobResearch.mockReturnValue({
        jobId: TEST_JOB_ID,
        company: { companyName: 'Acme', funding: { stage: 'Series B' } },
        manager: null,
        hasResearch: true
      })

      const result = getResearch({ jobId: TEST_JOB_ID, type: 'company' })

      expect(getJobResearch).toHaveBeenCalledWith(TEST_JOB_ID, 'company')
      expect(result.company.companyName).toBe('Acme')
    })

    it('returns full research when type=all', () => {
      getJobResearch.mockReturnValue({
        jobId: TEST_JOB_ID,
        company: { companyName: 'Acme' },
        manager: { managerName: 'Jane Doe' },
        hasResearch: true
      })

      const result = getResearch({ jobId: TEST_JOB_ID, type: 'all' })

      expect(getJobResearch).toHaveBeenCalledWith(TEST_JOB_ID, 'all')
      expect(result.company).toBeDefined()
      expect(result.manager).toBeDefined()
    })

    it('returns no research message for full research when not found', () => {
      getJobResearch.mockReturnValue({
        jobId: TEST_JOB_ID,
        company: null,
        manager: null,
        hasResearch: false
      })

      const result = getResearch({ jobId: TEST_JOB_ID, type: 'all' })

      expect(result.hasResearch).toBe(false)
      expect(result.message).toContain('No research found')
    })
  })
})
