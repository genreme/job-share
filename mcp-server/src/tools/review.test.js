/**
 * Tests for Review MCP Tools
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reviewGeneratedDocument, approveDocument } from './review.js'

// Mock all dependencies
vi.mock('../data/loader.js', () => ({
  loadJobsFromDashboard: vi.fn(),
  writeJobsData: vi.fn()
}))

vi.mock('../data/profile-loader.js', () => ({
  loadProfile: vi.fn()
}))

vi.mock('../services/document-review.js', () => ({
  reviewDocument: vi.fn()
}))

import { loadJobsFromDashboard, writeJobsData } from '../data/loader.js'
import { loadProfile } from '../data/profile-loader.js'
import { reviewDocument } from '../services/document-review.js'

// Use unique job IDs in 60000 range for this test file
const TEST_JOB_ID = 60001

describe('Review MCP Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('reviewGeneratedDocument', () => {
    it('returns error when no documentType provided', async () => {
      const result = await reviewGeneratedDocument({ content: 'test' })

      expect(result.error).toBe('Document type is required')
      expect(result.validTypes).toContain('resume')
    })

    it('returns error when no content provided', async () => {
      const result = await reviewGeneratedDocument({ documentType: 'resume' })

      expect(result.error).toBe('Document content is required (string)')
    })

    it('reviews document and formats issues', async () => {
      loadProfile.mockReturnValue({
        experience: [{ role: { company: 'Acme' } }]
      })

      loadJobsFromDashboard.mockReturnValue({
        jobs: [{
          id: TEST_JOB_ID,
          title: 'Developer',
          notes: 'React, Node.js'
        }]
      })

      reviewDocument.mockResolvedValue({
        id: 'review-123',
        documentType: 'resume',
        reviewedAt: '2026-02-02T10:00:00Z',
        grammar: {
          score: 85,
          issues: [{
            type: 'spelling',
            severity: 'error',
            message: 'Misspelling detected',
            context: 'the teh word',
            suggestions: ['the']
          }]
        },
        ats: {
          score: 90,
          issues: [],
          keywordCoverage: 75
        },
        tone: {
          detected: 'professional',
          consistent: true,
          issues: []
        },
        length: {
          wordCount: 350,
          charCount: 2100,
          withinLimits: true,
          pageEstimate: 1
        },
        factual: {
          verified: ['Date 2023 matches profile'],
          unverified: ['Date 2020 not in profile'],
          conflicts: []
        },
        overallScore: 82,
        readyToUse: true,
        blockers: []
      })

      const result = await reviewGeneratedDocument({
        documentType: 'resume',
        content: 'Test resume content...',
        jobId: TEST_JOB_ID
      })

      expect(result.reviewId).toBe('review-123')
      expect(result.documentType).toBe('resume')
      expect(result.scores.grammar).toBe(85)
      expect(result.scores.ats).toBe(90)
      expect(result.scores.overall).toBe(82)
      expect(result.length.words).toBe(350)
      expect(result.readyToUse).toBe(true)
      expect(result.issues).toHaveLength(2) // 1 grammar + 1 factual unverified
      expect(result.nextStep).toContain('approve_document')
    })

    it('formats grammar issues correctly', async () => {
      loadProfile.mockReturnValue(null)

      reviewDocument.mockResolvedValue({
        id: 'review-456',
        documentType: 'cover_letter',
        reviewedAt: '2026-02-02T10:00:00Z',
        grammar: {
          score: 70,
          issues: [
            {
              type: 'grammar',
              severity: 'error',
              message: 'Subject-verb agreement',
              context: 'they is working',
              suggestions: ['they are working']
            },
            {
              type: 'style',
              severity: 'warning',
              message: 'Consider simpler word',
              context: 'utilize',
              suggestions: ['use']
            }
          ]
        },
        ats: { score: 100, issues: [] },
        tone: { detected: 'formal', consistent: true, issues: [] },
        length: { wordCount: 200, charCount: 1200, withinLimits: true },
        factual: { verified: [], unverified: [], conflicts: [] },
        overallScore: 80,
        readyToUse: false,
        blockers: ['Too many grammar errors']
      })

      const result = await reviewGeneratedDocument({
        documentType: 'cover_letter',
        content: 'Test content'
      })

      expect(result.issues).toHaveLength(2)
      expect(result.issues[0].category).toBe('grammar')
      expect(result.issues[0].suggestions).toContain('they are working')
      expect(result.issues[1].severity).toBe('warning')
      expect(result.readyToUse).toBe(false)
      expect(result.blockers).toContain('Too many grammar errors')
    })

    it('formats ATS issues correctly', async () => {
      loadProfile.mockReturnValue(null)

      reviewDocument.mockResolvedValue({
        id: 'review-789',
        documentType: 'resume',
        reviewedAt: '2026-02-02T10:00:00Z',
        grammar: { score: 100, issues: [] },
        ats: {
          score: 60,
          issues: [{
            type: 'ats',
            severity: 'error',
            message: 'Contains HTML tags',
            suggestions: ['Remove HTML formatting']
          }],
          keywordCoverage: 40
        },
        tone: { detected: 'balanced', consistent: true, issues: [] },
        length: { wordCount: 400, charCount: 2400, withinLimits: true },
        factual: { verified: [], unverified: [], conflicts: [] },
        overallScore: 65,
        readyToUse: false,
        blockers: ['ATS compatibility issues']
      })

      const result = await reviewGeneratedDocument({
        documentType: 'resume',
        content: '<b>Bold text</b>'
      })

      expect(result.scores.ats).toBe(60)
      expect(result.keywordCoverage).toBe(40)
      expect(result.issues.find(i => i.category === 'ats')).toBeDefined()
      expect(result.readyToUse).toBe(false)
    })

    it('formats tone issues correctly', async () => {
      loadProfile.mockReturnValue({
        preferences: { communication: { tone: 'professional' } }
      })

      reviewDocument.mockResolvedValue({
        id: 'review-tone',
        documentType: 'email',
        reviewedAt: '2026-02-02T10:00:00Z',
        grammar: { score: 100, issues: [] },
        ats: { score: 100, issues: [] },
        tone: {
          detected: 'casual',
          consistent: false,
          issues: ['Tone detected as casual, profile prefers professional']
        },
        length: { wordCount: 100, charCount: 600, withinLimits: true },
        factual: { verified: [], unverified: [], conflicts: [] },
        overallScore: 85,
        readyToUse: true,
        blockers: []
      })

      const result = await reviewGeneratedDocument({
        documentType: 'email',
        content: 'Hey! Super excited about this!'
      })

      expect(result.tone.detected).toBe('casual')
      expect(result.tone.consistent).toBe(false)
      expect(result.issues.find(i => i.category === 'tone')).toBeDefined()
    })

    it('counts critical issues correctly', async () => {
      loadProfile.mockReturnValue(null)

      reviewDocument.mockResolvedValue({
        id: 'review-critical',
        documentType: 'resume',
        reviewedAt: '2026-02-02T10:00:00Z',
        grammar: {
          score: 50,
          issues: [
            { type: 'spelling', severity: 'error', message: 'Error 1' },
            { type: 'spelling', severity: 'error', message: 'Error 2' },
            { type: 'style', severity: 'warning', message: 'Warning 1' }
          ]
        },
        ats: { score: 90, issues: [] },
        tone: { detected: 'balanced', consistent: true, issues: [] },
        length: { wordCount: 300, charCount: 1800, withinLimits: true },
        factual: { verified: [], unverified: [], conflicts: [] },
        overallScore: 70,
        readyToUse: false,
        blockers: ['Too many grammar errors']
      })

      const result = await reviewGeneratedDocument({
        documentType: 'resume',
        content: 'Content with errors'
      })

      expect(result.totalIssues).toBe(3)
      expect(result.criticalIssues).toBe(2)
      expect(result.nextStep).toContain('Fix 2 critical')
    })
  })

  describe('approveDocument', () => {
    it('returns error when no documentType provided', () => {
      const result = approveDocument({ jobId: TEST_JOB_ID })

      expect(result.error).toBe('Document type is required')
    })

    it('returns error when no jobId provided', () => {
      const result = approveDocument({ documentType: 'resume' })

      expect(result.error).toBe('Job ID is required')
    })

    it('returns error when job not found', () => {
      loadJobsFromDashboard.mockReturnValue({ jobs: [] })

      const result = approveDocument({
        documentType: 'resume',
        jobId: TEST_JOB_ID
      })

      expect(result.error).toBe(`Job with ID ${TEST_JOB_ID} not found`)
    })

    it('records approval in job history', () => {
      const mockJob = {
        id: TEST_JOB_ID,
        title: 'Developer',
        company: 'Acme Corp',
        updates: []
      }

      loadJobsFromDashboard.mockReturnValue({
        jobs: [mockJob]
      })

      const result = approveDocument({
        documentType: 'resume',
        jobId: TEST_JOB_ID
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe('ready_to_use')
      expect(result.company).toBe('Acme Corp')
      expect(result.documentType).toBe('resume')
      expect(result.approvedAt).toBeDefined()
      expect(writeJobsData).toHaveBeenCalled()

      // Check that update was added to job
      expect(mockJob.updates).toHaveLength(1)
      expect(mockJob.updates[0].type).toBe('Document Approved')
      expect(mockJob.updates[0].documentType).toBe('resume')
    })

    it('includes document path in approval when provided', () => {
      const mockJob = {
        id: TEST_JOB_ID,
        title: 'Developer',
        company: 'Acme',
        updates: []
      }

      loadJobsFromDashboard.mockReturnValue({
        jobs: [mockJob]
      })

      const result = approveDocument({
        documentType: 'cover_letter',
        jobId: TEST_JOB_ID,
        documentPath: '/path/to/cover_letter.pdf'
      })

      expect(result.success).toBe(true)
      expect(mockJob.updates[0].notes).toContain('/path/to/cover_letter.pdf')
      expect(mockJob.updates[0].documentPath).toBe('/path/to/cover_letter.pdf')
    })

    it('initializes updates array if missing', () => {
      const mockJob = {
        id: TEST_JOB_ID,
        title: 'Developer',
        company: 'Acme'
        // No updates array
      }

      loadJobsFromDashboard.mockReturnValue({
        jobs: [mockJob]
      })

      const result = approveDocument({
        documentType: 'email',
        jobId: TEST_JOB_ID
      })

      expect(result.success).toBe(true)
      expect(mockJob.updates).toHaveLength(1)
    })
  })
})
