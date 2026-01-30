/**
 * Tests for Document Generation Tools
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateResume,
  generateCoverLetter,
  generateInterviewPrep,
  previewDocumentSources,
  validateResume,
  validateCoverLetter,
  assessPageFit
} from './documents.js'

// Mock profile loader
vi.mock('../data/profile-loader.js', () => ({
  loadProfile: vi.fn()
}))

// Mock legacy loader
vi.mock('../data/loader.js', () => ({
  loadResumeData: vi.fn(),
  loadCoverLetterData: vi.fn()
}))

// Mock services
vi.mock('../services/profile-to-resume.js', () => ({
  previewResumeSources: vi.fn(),
  buildResumeFromProfile: vi.fn(),
  getUsedProfileItems: vi.fn()
}))

vi.mock('../services/profile-to-cover-letter.js', () => ({
  previewCoverLetterSources: vi.fn(),
  buildCoverLetterFromProfile: vi.fn(),
  getUsedCoverLetterItems: vi.fn()
}))

vi.mock('../services/interview-prep.js', () => ({
  generateInterviewPrep: vi.fn(),
  getUsedInterviewPrepItems: vi.fn()
}))

vi.mock('../services/gap-detector.js', () => ({
  detectGaps: vi.fn()
}))

vi.mock('../services/document-history.js', () => ({
  recordDocumentGeneration: vi.fn()
}))

// Mock child_process (for Python generator)
vi.mock('child_process', () => ({
  execSync: vi.fn()
}))

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn()
}))

import { loadProfile } from '../data/profile-loader.js'
import { loadResumeData, loadCoverLetterData } from '../data/loader.js'
import { previewResumeSources, buildResumeFromProfile, getUsedProfileItems } from '../services/profile-to-resume.js'
import { previewCoverLetterSources, buildCoverLetterFromProfile, getUsedCoverLetterItems } from '../services/profile-to-cover-letter.js'
import { generateInterviewPrep as interviewPrepService, getUsedInterviewPrepItems } from '../services/interview-prep.js'
import { detectGaps } from '../services/gap-detector.js'
import { recordDocumentGeneration } from '../services/document-history.js'
import { execSync } from 'child_process'
import { existsSync, writeFileSync } from 'fs'

describe('generateResume', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses profile data when available', () => {
    const mockProfile = {
      experience: [{ id: 'exp-1' }],
      skills: [{ id: 'skill-1' }]
    }
    loadProfile.mockReturnValue(mockProfile)
    detectGaps.mockReturnValue([])
    buildResumeFromProfile.mockReturnValue({ summary: 'Test summary' })
    getUsedProfileItems.mockReturnValue([{ itemType: 'skill', itemId: 'skill-1' }])
    existsSync.mockReturnValue(true)
    execSync.mockReturnValue('Success')

    const result = generateResume({ company: 'Acme', title: 'Engineer' })

    expect(loadProfile).toHaveBeenCalled()
    expect(buildResumeFromProfile).toHaveBeenCalled()
    expect(result.dataSource).toBe('profile')
  })

  it('returns gaps for review when profile has gaps', () => {
    const mockProfile = {
      experience: [{ id: 'exp-1' }],
      skills: []
    }
    loadProfile.mockReturnValue(mockProfile)
    detectGaps.mockReturnValue([
      { type: 'gap', field: 'skills', reason: 'No skills' }
    ])
    previewResumeSources.mockReturnValue({ summary: {}, experience: {} })

    const result = generateResume({ company: 'Acme', title: 'Engineer' })

    expect(result.status).toBe('gaps_detected')
    expect(result.gaps.length).toBeGreaterThan(0)
    expect(result.preview).toBeDefined()
  })

  it('proceeds with gaps when proceedWithGaps is true', () => {
    const mockProfile = {
      experience: [{ id: 'exp-1' }],
      skills: []
    }
    loadProfile.mockReturnValue(mockProfile)
    detectGaps.mockReturnValue([
      { type: 'gap', field: 'skills', reason: 'No skills' }
    ])
    buildResumeFromProfile.mockReturnValue({ summary: 'Test' })
    getUsedProfileItems.mockReturnValue([])
    existsSync.mockReturnValue(true)
    execSync.mockReturnValue('Success')

    const result = generateResume({
      company: 'Acme',
      title: 'Engineer',
      proceedWithGaps: true
    })

    expect(buildResumeFromProfile).toHaveBeenCalled()
  })

  it('falls back to legacy data when profile is empty', () => {
    loadProfile.mockReturnValue({ experience: [], skills: [] })
    loadResumeData.mockReturnValue({ summary: 'Legacy summary' })
    existsSync.mockReturnValue(true)
    execSync.mockReturnValue('Success')

    const result = generateResume({ company: 'Acme', title: 'Engineer' })

    expect(loadResumeData).toHaveBeenCalled()
    expect(result.dataSource).toBe('legacy')
  })

  it('returns error when no data source available', () => {
    loadProfile.mockReturnValue({ experience: [], skills: [] })
    loadResumeData.mockReturnValue(null)

    const result = generateResume({ company: 'Acme', title: 'Engineer' })

    expect(result.error).toContain('Could not load resume data')
  })

  it('records document generation for history', () => {
    const mockProfile = {
      experience: [{ id: 'exp-1' }],
      skills: [{ id: 'skill-1' }]
    }
    loadProfile.mockReturnValue(mockProfile)
    detectGaps.mockReturnValue([])
    buildResumeFromProfile.mockReturnValue({ summary: 'Test' })
    getUsedProfileItems.mockReturnValue([{ itemType: 'skill', itemId: 'skill-1' }])
    existsSync.mockReturnValue(true)
    execSync.mockReturnValue('Success')

    generateResume({ company: 'Acme', title: 'Engineer' })

    expect(recordDocumentGeneration).toHaveBeenCalledWith(
      'resume',
      expect.objectContaining({ company: 'Acme', title: 'Engineer' }),
      expect.any(Array)
    )
  })
})

describe('generateCoverLetter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses profile data when available', () => {
    const mockProfile = {
      stories: [{ id: 'story-1' }],
      preferences: { communication: { tone: 'conversational' } }
    }
    loadProfile.mockReturnValue(mockProfile)
    detectGaps.mockReturnValue([])
    buildCoverLetterFromProfile.mockReturnValue({ tone: 'conversational' })
    getUsedCoverLetterItems.mockReturnValue([{ itemType: 'story', itemId: 'story-1' }])
    existsSync.mockReturnValue(true)
    execSync.mockReturnValue('Success')

    const result = generateCoverLetter({ company: 'Acme', title: 'Engineer' })

    expect(loadProfile).toHaveBeenCalled()
    expect(buildCoverLetterFromProfile).toHaveBeenCalled()
    expect(result.dataSource).toBe('profile')
  })

  it('returns gaps for review when profile has gaps', () => {
    const mockProfile = {
      stories: [],
      experience: [{ id: 'exp-1' }]
    }
    loadProfile.mockReturnValue(mockProfile)
    detectGaps.mockReturnValue([
      { type: 'gap', field: 'stories', reason: 'No stories' }
    ])
    previewCoverLetterSources.mockReturnValue({ tone: 'conversational' })

    const result = generateCoverLetter({ company: 'Acme', title: 'Engineer' })

    expect(result.status).toBe('gaps_detected')
  })

  it('applies tone from profile preferences', () => {
    const mockProfile = {
      stories: [{ id: 'story-1' }],
      preferences: { communication: { tone: 'formal' } }
    }
    loadProfile.mockReturnValue(mockProfile)
    detectGaps.mockReturnValue([])
    buildCoverLetterFromProfile.mockReturnValue({ tone: 'formal' })
    getUsedCoverLetterItems.mockReturnValue([])
    existsSync.mockReturnValue(true)
    execSync.mockReturnValue('Success')

    const result = generateCoverLetter({ company: 'Acme', title: 'Engineer' })

    expect(result.toneApplied).toBe('formal')
  })
})

describe('generateInterviewPrep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns interview prep from profile', () => {
    const mockProfile = {
      stories: [{ id: 'story-1', title: 'Test Story' }],
      summaryBlocks: [{ id: 'summary-1' }]
    }
    loadProfile.mockReturnValue(mockProfile)
    interviewPrepService.mockReturnValue({
      targetRole: { title: 'Engineer' },
      talkingPoints: [],
      stories: { byCategory: {} }
    })
    getUsedInterviewPrepItems.mockReturnValue([{ itemType: 'story', itemId: 'story-1' }])

    const result = generateInterviewPrep({ company: 'Acme', title: 'Engineer' })

    expect(result.success).toBe(true)
    expect(result.prep).toBeDefined()
    expect(result.usedStories).toBeGreaterThanOrEqual(0)
  })

  it('returns error when no stories in profile', () => {
    loadProfile.mockReturnValue({ stories: [] })

    const result = generateInterviewPrep({ company: 'Acme', title: 'Engineer' })

    expect(result.status).toBe('incomplete_profile')
    expect(result.suggestion).toContain('STAR stories')
  })

  it('records interview prep generation', () => {
    const mockProfile = {
      stories: [{ id: 'story-1' }]
    }
    loadProfile.mockReturnValue(mockProfile)
    interviewPrepService.mockReturnValue({ stories: {} })
    getUsedInterviewPrepItems.mockReturnValue([{ itemType: 'story', itemId: 'story-1' }])

    generateInterviewPrep({ company: 'Acme', title: 'Engineer' })

    expect(recordDocumentGeneration).toHaveBeenCalledWith(
      'interview_prep',
      expect.objectContaining({ company: 'Acme' }),
      expect.any(Array)
    )
  })
})

describe('previewDocumentSources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns resume preview', () => {
    loadProfile.mockReturnValue({ experience: [], skills: [] })
    previewResumeSources.mockReturnValue({
      summary: { blocks: [] },
      experience: { roles: [] },
      skills: { relevant: [] }
    })

    const result = previewDocumentSources({
      documentType: 'resume',
      company: 'Acme',
      title: 'Engineer'
    })

    expect(result.documentType).toBe('resume')
    expect(result.sources).toBeDefined()
  })

  it('returns cover letter preview', () => {
    loadProfile.mockReturnValue({ stories: [] })
    previewCoverLetterSources.mockReturnValue({
      tone: 'conversational',
      matchingStories: []
    })

    const result = previewDocumentSources({
      documentType: 'cover_letter',
      company: 'Acme',
      title: 'Engineer'
    })

    expect(result.documentType).toBe('cover_letter')
    expect(result.sources).toBeDefined()
  })

  it('returns interview prep preview', () => {
    loadProfile.mockReturnValue({
      stories: [{ id: 'story-1' }],
      summaryBlocks: [],
      preferences: { targetRoles: [], communication: null }
    })
    detectGaps.mockReturnValue([])

    const result = previewDocumentSources({
      documentType: 'interview_prep',
      company: 'Acme',
      title: 'Engineer'
    })

    expect(result.documentType).toBe('interview_prep')
    expect(result.profile).toBeDefined()
    expect(result.profile.storyCount).toBe(1)
  })

  it('returns error for unknown document type', () => {
    loadProfile.mockReturnValue({})

    const result = previewDocumentSources({
      documentType: 'unknown',
      company: 'Acme'
    })

    expect(result.error).toContain('Unknown document type')
  })
})

describe('validateResume', () => {
  it('validates summary length', () => {
    const longSummary = 'a'.repeat(600)
    const result = validateResume({ summary: longSummary })

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0].section).toBe('summary')
  })

  it('warns on summary approaching limit', () => {
    const mediumSummary = 'a'.repeat(450)
    const result = validateResume({ summary: mediumSummary })

    expect(result.valid).toBe(true)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('validates experience bullets', () => {
    const bullets = ['a'.repeat(250), 'short bullet']
    const result = validateResume({ experienceBullets: bullets })

    expect(result.errors.some((e) => e.section.includes('experience_bullet'))).toBe(true)
  })

  it('estimates page count', () => {
    const result = validateResume({
      summary: 'a'.repeat(400),
      experienceBullets: ['bullet 1', 'bullet 2'],
      skills: 'React, Node.js',
      education: 'BS Computer Science'
    })

    expect(result.pageEstimate).toBeDefined()
    expect(result.pageEstimate.lines).toBeGreaterThan(0)
    expect(result.pageEstimate.pages).toBeGreaterThan(0)
  })
})

describe('validateCoverLetter', () => {
  it('validates section lengths', () => {
    const result = validateCoverLetter({
      opening: 'a'.repeat(350),
      body: 'normal body',
      closing: 'normal closing'
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.section === 'opening')).toBe(true)
  })

  it('validates total length', () => {
    const result = validateCoverLetter({
      opening: 'a'.repeat(250),
      body: 'a'.repeat(750),
      closing: 'a'.repeat(180),
      keyAlignment: 'a'.repeat(380)
    })

    expect(result.warnings.some((w) => w.section === 'total')).toBe(true)
  })

  it('reports fits on page', () => {
    const result = validateCoverLetter({
      opening: 'short',
      body: 'short',
      closing: 'short'
    })

    expect(result.fitsOnePage).toBe(true)
  })
})

describe('assessPageFit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses profile data when available', () => {
    loadProfile.mockReturnValue({
      experience: [
        {
          role: { title: 'Engineer', company: 'Acme' },
          projects: [
            { name: 'Project 1', description: 'Test description' }
          ]
        }
      ]
    })

    const result = assessPageFit()

    expect(result.dataSource).toBe('profile')
    expect(result.sections.length).toBeGreaterThan(0)
  })

  it('falls back to legacy data', () => {
    loadProfile.mockReturnValue({ experience: [] })
    loadResumeData.mockReturnValue({
      experience: [
        {
          title: 'Engineer',
          company: 'Acme',
          bullets: ['Bullet 1']
        }
      ]
    })

    const result = assessPageFit()

    expect(result.dataSource).toBe('legacy')
  })

  it('estimates pages', () => {
    loadProfile.mockReturnValue({
      experience: [
        {
          role: { title: 'Engineer', company: 'Acme' },
          projects: [
            { name: 'Project 1', description: 'a'.repeat(500) }
          ]
        }
      ]
    })

    const result = assessPageFit()

    expect(result.estimatedPages).toBeGreaterThan(0)
    expect(typeof result.fitsOnePage).toBe('boolean')
    expect(typeof result.fitsTwoPages).toBe('boolean')
  })
})
