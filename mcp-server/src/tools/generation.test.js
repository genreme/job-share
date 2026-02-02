/**
 * Tests for Generation MCP Tools
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateOptimizedResume,
  generateResearchedCoverLetter,
  generateEmailResponse
} from './generation.js'

// Mock all dependencies
vi.mock('../data/loader.js', () => ({
  loadJobsFromDashboard: vi.fn()
}))

vi.mock('../data/profile-loader.js', () => ({
  loadProfile: vi.fn()
}))

vi.mock('../services/profile-to-resume.js', () => ({
  buildResumeFromProfile: vi.fn()
}))

vi.mock('../services/keyword-optimizer.js', () => ({
  optimizeResumeForJob: vi.fn()
}))

vi.mock('../services/research-persistence.js', () => ({
  getJobResearch: vi.fn(),
  getResearchHighlights: vi.fn()
}))

vi.mock('../services/email-generator.js', () => ({
  generateEmailVariations: vi.fn()
}))

import { loadJobsFromDashboard } from '../data/loader.js'
import { loadProfile } from '../data/profile-loader.js'
import { buildResumeFromProfile } from '../services/profile-to-resume.js'
import { optimizeResumeForJob } from '../services/keyword-optimizer.js'
import { getJobResearch, getResearchHighlights } from '../services/research-persistence.js'
import { generateEmailVariations } from '../services/email-generator.js'

// Use unique job IDs in 50000 range for this test file
const TEST_JOB_ID = 50001

describe('Generation MCP Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateOptimizedResume', () => {
    it('returns error when no jobId provided', () => {
      const result = generateOptimizedResume({})

      expect(result.error).toBe('Job ID is required')
    })

    it('returns error when job not found', () => {
      loadJobsFromDashboard.mockReturnValue({ jobs: [] })

      const result = generateOptimizedResume({ jobId: TEST_JOB_ID })

      expect(result.error).toBe(`Job with ID ${TEST_JOB_ID} not found`)
    })

    it('returns error when profile has no experience', () => {
      loadJobsFromDashboard.mockReturnValue({
        jobs: [{ id: TEST_JOB_ID, title: 'Developer', company: 'Acme' }]
      })
      loadProfile.mockReturnValue({ experience: [] })

      const result = generateOptimizedResume({ jobId: TEST_JOB_ID })

      expect(result.error).toBe('Profile has no experience data')
    })

    it('optimizes resume without research references', () => {
      loadJobsFromDashboard.mockReturnValue({
        jobs: [{
          id: TEST_JOB_ID,
          title: 'Developer',
          company: 'Acme',
          notes: 'React, Node.js, TypeScript'
        }]
      })

      loadProfile.mockReturnValue({
        experience: [{ role: { title: 'Developer' } }],
        skills: [{ name: 'React' }]
      })

      buildResumeFromProfile.mockReturnValue({
        skills: ['React', 'Node.js']
      })

      optimizeResumeForJob.mockReturnValue({
        optimizedData: { skills: ['React', 'Node.js'] },
        optimizations: [{ section: 'skills', action: 'reordered' }],
        keywordCoverage: { matched: 2, total: 3 },
        summary: '1 optimizations applied'
      })

      const result = generateOptimizedResume({ jobId: TEST_JOB_ID })

      expect(result.status).toBe('optimized')
      expect(result.company).toBe('Acme')
      expect(result.researchUsed).toBe(false)
      expect(result.optimization.changes).toHaveLength(1)
      expect(result.nextStep).toContain('review_generated_document')
    })

    it('includes research when requested', () => {
      loadJobsFromDashboard.mockReturnValue({
        jobs: [{
          id: TEST_JOB_ID,
          title: 'Developer',
          company: 'Acme',
          notes: 'React, Node.js'
        }]
      })

      loadProfile.mockReturnValue({
        experience: [{ role: { title: 'Developer' } }]
      })

      getJobResearch.mockReturnValue({
        hasResearch: true,
        company: { highlights: ['Series B funded'] }
      })

      buildResumeFromProfile.mockReturnValue({ skills: ['React'] })

      optimizeResumeForJob.mockReturnValue({
        optimizedData: { skills: ['React'] },
        optimizations: [],
        keywordCoverage: { matched: 1, total: 2 },
        researchIntegration: { available: true, suggested: 'Series B funded' },
        summary: 'optimized'
      })

      const result = generateOptimizedResume({
        jobId: TEST_JOB_ID,
        includeResearchReferences: true
      })

      expect(result.researchUsed).toBe(true)
      expect(getJobResearch).toHaveBeenCalledWith(TEST_JOB_ID, 'company')
    })
  })

  describe('generateResearchedCoverLetter', () => {
    it('returns error when no jobId provided', () => {
      const result = generateResearchedCoverLetter({})

      expect(result.error).toBe('Job ID is required')
    })

    it('returns error when job not found', () => {
      loadJobsFromDashboard.mockReturnValue({ jobs: [] })

      const result = generateResearchedCoverLetter({ jobId: TEST_JOB_ID })

      expect(result.error).toBe(`Job with ID ${TEST_JOB_ID} not found`)
    })

    it('generates cover letter structure with research', () => {
      loadJobsFromDashboard.mockReturnValue({
        jobs: [{
          id: TEST_JOB_ID,
          title: 'Developer',
          company: 'Acme',
          hiringManager: 'Jane Doe',
          notes: 'Build great products'
        }]
      })

      loadProfile.mockReturnValue({
        basics: { fullName: 'John Smith' },
        experience: [{ role: { title: 'Engineer' } }],
        skills: [{ name: 'React' }],
        stories: [{ title: 'Leadership story', category: 'leadership' }],
        preferences: { communication: { tone: 'professional' } }
      })

      getResearchHighlights.mockReturnValue({
        highlights: ['Remote-first culture', 'Series B'],
        lastUpdated: '2026-01-20'
      })

      const result = generateResearchedCoverLetter({ jobId: TEST_JOB_ID })

      expect(result.status).toBe('generated')
      expect(result.company).toBe('Acme')
      expect(result.researchUsed).toBe(true)
      expect(result.toneApplied).toBe('professional')
      expect(result.coverLetter.structure).toBeDefined()
      expect(result.coverLetter.structure.opener).toBeDefined()
      expect(result.coverLetter.structure.body).toBeDefined()
      expect(result.coverLetter.structure.closing).toBeDefined()
      expect(result.coverLetter.context.research.available).toBe(true)
    })

    it('generates without research when not available', () => {
      loadJobsFromDashboard.mockReturnValue({
        jobs: [{
          id: TEST_JOB_ID,
          title: 'Developer',
          company: 'NewCo'
        }]
      })

      loadProfile.mockReturnValue({
        experience: [{ role: { title: 'Dev' } }]
      })

      getResearchHighlights.mockReturnValue(null)

      const result = generateResearchedCoverLetter({ jobId: TEST_JOB_ID })

      expect(result.status).toBe('generated')
      expect(result.researchUsed).toBe(false)
      expect(result.coverLetter.context.research.available).toBe(false)
    })

    it('applies tone override', () => {
      loadJobsFromDashboard.mockReturnValue({
        jobs: [{ id: TEST_JOB_ID, title: 'Dev', company: 'Co' }]
      })

      loadProfile.mockReturnValue({
        preferences: { communication: { tone: 'professional' } }
      })

      getResearchHighlights.mockReturnValue(null)

      const result = generateResearchedCoverLetter({
        jobId: TEST_JOB_ID,
        toneVariation: 'conversational'
      })

      expect(result.toneApplied).toBe('conversational')
    })

    it('skips research when includeCompanyReferences is false', () => {
      loadJobsFromDashboard.mockReturnValue({
        jobs: [{ id: TEST_JOB_ID, title: 'Dev', company: 'Co' }]
      })

      loadProfile.mockReturnValue({})

      const result = generateResearchedCoverLetter({
        jobId: TEST_JOB_ID,
        includeCompanyReferences: false
      })

      expect(getResearchHighlights).not.toHaveBeenCalled()
      expect(result.researchUsed).toBe(false)
    })
  })

  describe('generateEmailResponse', () => {
    it('returns error when no jobId provided', () => {
      const result = generateEmailResponse({ emailType: 'followup' })

      expect(result.error).toBe('Job ID is required')
    })

    it('returns error when no emailType provided', () => {
      const result = generateEmailResponse({ jobId: TEST_JOB_ID })

      expect(result.error).toBe('Email type is required')
      expect(result.validTypes).toContain('followup')
    })

    it('delegates to email generator service', () => {
      generateEmailVariations.mockReturnValue({
        status: 'variations_ready',
        variations: [{ tone: 'professional' }, { tone: 'warm' }]
      })

      const result = generateEmailResponse({
        jobId: TEST_JOB_ID,
        emailType: 'followup',
        context: 'After phone screen'
      })

      expect(generateEmailVariations).toHaveBeenCalledWith({
        jobId: TEST_JOB_ID,
        emailType: 'followup',
        context: 'After phone screen',
        toneCount: 3
      })
      expect(result.status).toBe('variations_ready')
    })

    it('limits tone count to 3', () => {
      generateEmailVariations.mockReturnValue({
        status: 'variations_ready',
        variations: []
      })

      generateEmailResponse({
        jobId: TEST_JOB_ID,
        emailType: 'thank_you',
        toneCount: 10
      })

      expect(generateEmailVariations).toHaveBeenCalledWith(
        expect.objectContaining({ toneCount: 3 })
      )
    })
  })
})
