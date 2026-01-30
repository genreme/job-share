/**
 * Document Generation Tools
 *
 * Tools for generating and validating resumes, cover letters, and interview prep.
 * Integrates with profile data for single source of truth.
 * Integrates with existing Python generators for PDF output.
 */

import { loadResumeData, loadCoverLetterData } from '../data/loader.js'
import { loadProfile } from '../data/profile-loader.js'
import {
  previewResumeSources,
  buildResumeFromProfile,
  getUsedProfileItems
} from '../services/profile-to-resume.js'
import {
  previewCoverLetterSources,
  buildCoverLetterFromProfile,
  getUsedCoverLetterItems
} from '../services/profile-to-cover-letter.js'
import {
  generateInterviewPrep as generateInterviewPrepService,
  getUsedInterviewPrepItems
} from '../services/interview-prep.js'
import { detectGaps } from '../services/gap-detector.js'
import { recordDocumentGeneration } from '../services/document-history.js'
import { execSync } from 'child_process'
import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'

const RESUME_ROOT = '/Users/genre/Claude/resume'
const RESUME_GENERATOR = join(RESUME_ROOT, 'resume generator - claude', 'generate_resume_v9_1.py')
const COVER_LETTER_GENERATOR = join(
  RESUME_ROOT,
  'cover letter generator - claude',
  'generate_cover_letter.py'
)

/**
 * Character limits for resume sections (for fit validation)
 */
const SECTION_LIMITS = {
  summary: { soft: 400, hard: 500, label: 'Professional Summary' },
  experience_bullet: { soft: 150, hard: 200, label: 'Experience Bullet' },
  skills_section: { soft: 300, hard: 400, label: 'Skills Section' },
  education: { soft: 200, hard: 250, label: 'Education Entry' }
}

/**
 * Generate a tailored resume PDF
 *
 * Uses profile data as primary source. Falls back to legacy resume_data_v9_1.json
 * if profile is empty or invalid.
 *
 * @param {object} params - Generation parameters
 * @param {string} params.company - Target company name
 * @param {string} params.title - Target job title
 * @param {string} params.audience - Audience type (technical, leadership, executive)
 * @param {Array} params.keywords - Keywords for relevance matching
 * @param {object} params.customizations - Additional customization options
 * @param {string} params.outputPath - Custom output filename
 * @param {boolean} params.proceedWithGaps - Skip gap warning and proceed
 * @returns {object} Generation result
 */
export function generateResume(params) {
  const { company, title, audience, keywords, customizations, outputPath, proceedWithGaps } = params

  const jobContext = {
    company,
    title,
    audience: audience || 'technical',
    keywords: keywords || []
  }

  // Load profile
  let profile
  try {
    profile = loadProfile()
  } catch (error) {
    console.error('Error loading profile:', error.message)
  }

  // Check if profile has meaningful data
  const hasProfileData =
    profile &&
    ((profile.experience && profile.experience.length > 0) ||
      (profile.skills && profile.skills.length > 0))

  let resumeData
  let usedItems = []

  if (hasProfileData) {
    // Use profile data (primary source)
    console.error('Using profile data for resume generation')

    // Check for gaps
    const gaps = detectGaps(profile, jobContext)
    const significantGaps = gaps.filter((g) => g.type === 'gap')

    if (significantGaps.length > 0 && !proceedWithGaps) {
      // Return gaps for user review
      const preview = previewResumeSources(profile, jobContext)
      return {
        status: 'gaps_detected',
        message:
          'Profile has gaps that may affect resume quality. Review and proceed or fill gaps first.',
        gaps: significantGaps,
        preview,
        proceedAction: 'Call generateResume with proceedWithGaps: true to continue anyway'
      }
    }

    // Build resume data from profile
    resumeData = buildResumeFromProfile(profile, jobContext, customizations || {})
    usedItems = getUsedProfileItems(profile, jobContext)
  } else {
    // Fall back to legacy data source
    console.error('DEPRECATION WARNING: Using legacy resume_data_v9_1.json. Populate profile data.')
    resumeData = loadResumeData()
    if (!resumeData) {
      return { error: 'Could not load resume data from profile or legacy source' }
    }
  }

  // Check if generator exists
  if (!existsSync(RESUME_GENERATOR)) {
    return { error: `Resume generator not found at ${RESUME_GENERATOR}` }
  }

  // Add target company/title to data
  const customizedData = {
    ...resumeData,
    target_company: company,
    target_title: title,
    customizations: customizations || {}
  }

  // Write temp config for generator
  const tempConfigPath = join(RESUME_ROOT, 'resume generator - claude', '_temp_custom.json')

  try {
    writeFileSync(tempConfigPath, JSON.stringify(customizedData, null, 2))

    // Determine output filename
    const filename = outputPath || `John Ra Resume - ${company}.pdf`
    const fullOutputPath = join(RESUME_ROOT, filename)

    // Run Python generator
    const result = execSync(
      `python3 "${RESUME_GENERATOR}" --config "${tempConfigPath}" --output "${fullOutputPath}"`,
      { encoding: 'utf-8', timeout: 30000 }
    )

    // Record document generation for staleness tracking
    if (usedItems.length > 0) {
      recordDocumentGeneration('resume', jobContext, usedItems)
    }

    return {
      success: true,
      outputPath: fullOutputPath,
      company,
      title,
      message: `Resume generated: ${filename}`,
      generatorOutput: result,
      usedProfileItems: usedItems.length,
      dataSource: hasProfileData ? 'profile' : 'legacy'
    }
  } catch (e) {
    return {
      error: `Generation failed: ${e.message}`,
      stdout: e.stdout,
      stderr: e.stderr
    }
  }
}

/**
 * Generate a tailored cover letter PDF
 *
 * Uses profile data for tone, stories, and achievements.
 *
 * @param {object} params - Generation parameters
 * @param {string} params.company - Target company name
 * @param {string} params.title - Target job title
 * @param {string} params.hiringManager - Name of hiring manager
 * @param {Array} params.keyPoints - Key points to emphasize
 * @param {Array} params.keywords - Keywords for relevance matching
 * @param {string} params.outputPath - Custom output filename
 * @param {boolean} params.proceedWithGaps - Skip gap warning and proceed
 * @returns {object} Generation result
 */
export function generateCoverLetter(params) {
  const { company, title, hiringManager, keyPoints, keywords, outputPath, proceedWithGaps } = params

  const jobContext = {
    company,
    title,
    hiringManager: hiringManager || 'Hiring Manager',
    keywords: keywords || []
  }

  // Load profile
  let profile
  try {
    profile = loadProfile()
  } catch (error) {
    console.error('Error loading profile:', error.message)
  }

  // Check if profile has meaningful data
  const hasProfileData =
    profile &&
    ((profile.stories && profile.stories.length > 0) ||
      profile.preferences?.communication ||
      (profile.experience && profile.experience.length > 0))

  let coverLetterData
  let usedItems = []

  if (hasProfileData) {
    // Use profile data (primary source)
    console.error('Using profile data for cover letter generation')

    // Check for gaps
    const gaps = detectGaps(profile, jobContext)
    const significantGaps = gaps.filter((g) => g.type === 'gap')

    if (significantGaps.length > 0 && !proceedWithGaps) {
      // Return gaps for user review
      const preview = previewCoverLetterSources(profile, jobContext)
      return {
        status: 'gaps_detected',
        message:
          'Profile has gaps that may affect cover letter quality. Review and proceed or fill gaps first.',
        gaps: significantGaps,
        preview,
        proceedAction: 'Call generateCoverLetter with proceedWithGaps: true to continue anyway'
      }
    }

    // Build cover letter data from profile
    coverLetterData = buildCoverLetterFromProfile(profile, jobContext)
    usedItems = getUsedCoverLetterItems(profile, jobContext)
  } else {
    // Fall back to legacy data source
    console.error('DEPRECATION WARNING: Using legacy cover_letter_data.json. Populate profile data.')
    coverLetterData = loadCoverLetterData()
    if (!coverLetterData) {
      return { error: 'Could not load cover letter data from profile or legacy source' }
    }
  }

  // Check if generator exists
  if (!existsSync(COVER_LETTER_GENERATOR)) {
    return { error: `Cover letter generator not found at ${COVER_LETTER_GENERATOR}` }
  }

  // Build customized data
  const customizedData = {
    ...coverLetterData,
    target_company: company,
    target_title: title,
    hiring_manager: hiringManager || 'Hiring Manager',
    key_points: keyPoints || []
  }

  // Write temp config for generator
  const tempConfigPath = join(RESUME_ROOT, 'cover letter generator - claude', '_temp_custom.json')

  try {
    writeFileSync(tempConfigPath, JSON.stringify(customizedData, null, 2))

    // Determine output filename
    const filename = outputPath || `John Ra Cover Letter - ${company}.pdf`
    const fullOutputPath = join(RESUME_ROOT, filename)

    // Run Python generator
    const result = execSync(
      `python3 "${COVER_LETTER_GENERATOR}" --config "${tempConfigPath}" --output "${fullOutputPath}"`,
      { encoding: 'utf-8', timeout: 30000 }
    )

    // Record document generation for staleness tracking
    if (usedItems.length > 0) {
      recordDocumentGeneration('cover_letter', jobContext, usedItems)
    }

    return {
      success: true,
      outputPath: fullOutputPath,
      company,
      title,
      message: `Cover letter generated: ${filename}`,
      generatorOutput: result,
      usedProfileItems: usedItems.length,
      dataSource: hasProfileData ? 'profile' : 'legacy',
      toneApplied: coverLetterData.tone || 'default'
    }
  } catch (e) {
    return {
      error: `Generation failed: ${e.message}`,
      stdout: e.stdout,
      stderr: e.stderr
    }
  }
}

/**
 * Generate interview preparation materials
 *
 * @param {object} params - Generation parameters
 * @param {string} params.company - Target company name
 * @param {string} params.title - Target job title
 * @param {string} params.interviewType - Type of interview (behavioral, technical, leadership)
 * @param {Array} params.keywords - Keywords for relevance matching
 * @returns {object} Interview prep package
 */
export function generateInterviewPrep(params) {
  const { company, title, interviewType, keywords } = params

  const jobContext = {
    company,
    title,
    interviewType: interviewType || 'behavioral',
    keywords: keywords || []
  }

  // Load profile
  let profile
  try {
    profile = loadProfile()
  } catch (error) {
    console.error('Error loading profile:', error.message)
    return { error: `Could not load profile: ${error.message}` }
  }

  // Check if profile has stories
  if (!profile.stories || profile.stories.length === 0) {
    return {
      status: 'incomplete_profile',
      message: 'No STAR stories in profile. Interview prep requires stories.',
      suggestion: 'Add STAR stories to your profile for leadership, technical, and behavioral categories'
    }
  }

  // Generate interview prep
  const prep = generateInterviewPrepService(profile, jobContext)

  // Get used items for history tracking
  const usedItems = getUsedInterviewPrepItems(profile, jobContext)

  // Record generation
  if (usedItems.length > 0) {
    recordDocumentGeneration('interview_prep', jobContext, usedItems)
  }

  return {
    success: true,
    company,
    title,
    interviewType: jobContext.interviewType,
    prep,
    usedStories: usedItems.filter((i) => i.itemType === 'story').length
  }
}

/**
 * Preview which profile sections will be used for document generation
 *
 * @param {object} params - Preview parameters
 * @param {string} params.documentType - 'resume' | 'cover_letter' | 'interview_prep'
 * @param {string} params.company - Target company name
 * @param {string} params.title - Target job title
 * @param {string} params.audience - Audience type (for resume)
 * @param {Array} params.keywords - Keywords for relevance matching
 * @returns {object} Preview of data sources
 */
export function previewDocumentSources(params) {
  const { documentType, company, title, audience, keywords } = params

  const jobContext = {
    company,
    title,
    audience: audience || 'technical',
    keywords: keywords || []
  }

  // Load profile
  let profile
  try {
    profile = loadProfile()
  } catch (error) {
    return { error: `Could not load profile: ${error.message}` }
  }

  switch (documentType) {
    case 'resume':
      return {
        documentType: 'resume',
        jobContext,
        sources: previewResumeSources(profile, jobContext)
      }

    case 'cover_letter':
      return {
        documentType: 'cover_letter',
        jobContext,
        sources: previewCoverLetterSources(profile, jobContext)
      }

    case 'interview_prep':
      return {
        documentType: 'interview_prep',
        jobContext,
        profile: {
          storyCount: (profile.stories || []).length,
          summaryBlockCount: (profile.summaryBlocks || []).length,
          hasTargetRoles: (profile.preferences?.targetRoles || []).length > 0,
          hasCommunicationPrefs: !!profile.preferences?.communication
        },
        gaps: detectGaps(profile, jobContext)
      }

    default:
      return { error: `Unknown document type: ${documentType}` }
  }
}

/**
 * Validate resume content fits within page limits
 * @param {object} params - Content to validate
 * @returns {object} Validation results with warnings
 */
export function validateResume(params) {
  const { summary, experienceBullets, skills, education } = params
  const warnings = []
  const errors = []

  // Validate summary
  if (summary) {
    const len = summary.length
    if (len > SECTION_LIMITS.summary.hard) {
      errors.push({
        section: 'summary',
        message: `Summary too long: ${len} chars (max: ${SECTION_LIMITS.summary.hard})`,
        current: len,
        limit: SECTION_LIMITS.summary.hard,
        overBy: len - SECTION_LIMITS.summary.hard
      })
    } else if (len > SECTION_LIMITS.summary.soft) {
      warnings.push({
        section: 'summary',
        message: `Summary approaching limit: ${len} chars (recommended: ${SECTION_LIMITS.summary.soft})`,
        current: len,
        recommended: SECTION_LIMITS.summary.soft
      })
    }
  }

  // Validate experience bullets
  if (experienceBullets && Array.isArray(experienceBullets)) {
    experienceBullets.forEach((bullet, idx) => {
      const len = bullet.length
      if (len > SECTION_LIMITS.experience_bullet.hard) {
        errors.push({
          section: `experience_bullet_${idx + 1}`,
          message: `Bullet ${idx + 1} too long: ${len} chars (max: ${SECTION_LIMITS.experience_bullet.hard})`,
          current: len,
          limit: SECTION_LIMITS.experience_bullet.hard,
          text: bullet.substring(0, 50) + '...'
        })
      } else if (len > SECTION_LIMITS.experience_bullet.soft) {
        warnings.push({
          section: `experience_bullet_${idx + 1}`,
          message: `Bullet ${idx + 1} approaching limit: ${len} chars`,
          current: len,
          recommended: SECTION_LIMITS.experience_bullet.soft,
          text: bullet.substring(0, 50) + '...'
        })
      }
    })
  }

  // Estimate total page fit
  const estimatedLines = estimateResumeLines(params)
  const pageCapacity = 55 // Approximate lines per page with standard formatting
  const estimatedPages = Math.ceil(estimatedLines / pageCapacity)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    pageEstimate: {
      lines: estimatedLines,
      pages: estimatedPages,
      withinOnePage: estimatedPages <= 1,
      withinTwoPages: estimatedPages <= 2
    },
    sectionLimits: SECTION_LIMITS
  }
}

/**
 * Validate cover letter content
 * @param {object} params - Content to validate
 * @returns {object} Validation results
 */
export function validateCoverLetter(params) {
  const { opening, body, closing, keyAlignment } = params
  const warnings = []
  const errors = []

  const COVER_LETTER_LIMITS = {
    opening: { soft: 200, hard: 300 },
    body: { soft: 600, hard: 800 },
    closing: { soft: 150, hard: 200 },
    keyAlignment: { soft: 300, hard: 400 },
    total: { soft: 1500, hard: 2000 }
  }

  // Validate each section
  const sections = { opening, body, closing, keyAlignment }
  let totalLength = 0

  for (const [name, content] of Object.entries(sections)) {
    if (content && COVER_LETTER_LIMITS[name]) {
      const len = content.length
      totalLength += len

      if (len > COVER_LETTER_LIMITS[name].hard) {
        errors.push({
          section: name,
          message: `${name} too long: ${len} chars (max: ${COVER_LETTER_LIMITS[name].hard})`,
          current: len,
          limit: COVER_LETTER_LIMITS[name].hard
        })
      } else if (len > COVER_LETTER_LIMITS[name].soft) {
        warnings.push({
          section: name,
          message: `${name} approaching limit: ${len} chars`,
          current: len,
          recommended: COVER_LETTER_LIMITS[name].soft
        })
      }
    }
  }

  // Check total length
  if (totalLength > COVER_LETTER_LIMITS.total.hard) {
    errors.push({
      section: 'total',
      message: `Total content too long: ${totalLength} chars (max: ${COVER_LETTER_LIMITS.total.hard})`,
      current: totalLength,
      limit: COVER_LETTER_LIMITS.total.hard
    })
  } else if (totalLength > COVER_LETTER_LIMITS.total.soft) {
    warnings.push({
      section: 'total',
      message: `Total content approaching limit: ${totalLength} chars`,
      current: totalLength,
      recommended: COVER_LETTER_LIMITS.total.soft
    })
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    totalLength,
    limits: COVER_LETTER_LIMITS,
    fitsOnePage: totalLength <= COVER_LETTER_LIMITS.total.soft
  }
}

/**
 * Helper: Estimate resume lines from content
 */
function estimateResumeLines(params) {
  let lines = 0
  const CHARS_PER_LINE = 85

  // Header: name, contact info
  lines += 4

  // Summary
  if (params.summary) {
    lines += Math.ceil(params.summary.length / CHARS_PER_LINE) + 1
  }

  // Experience
  if (params.experienceBullets) {
    // Header for each job
    lines += 3
    params.experienceBullets.forEach((bullet) => {
      lines += Math.ceil(bullet.length / CHARS_PER_LINE)
    })
  }

  // Skills
  if (params.skills) {
    lines += 3 + Math.ceil(params.skills.length / CHARS_PER_LINE)
  }

  // Education
  if (params.education) {
    lines += 4
  }

  return lines
}

/**
 * Get page fit assessment for current resume data
 */
export function assessPageFit() {
  // Try profile first
  let profile
  try {
    profile = loadProfile()
  } catch (error) {
    console.error('Error loading profile:', error.message)
  }

  // Check if profile has experience
  if (profile && profile.experience && profile.experience.length > 0) {
    const assessment = {
      sections: [],
      totalCharacters: 0,
      estimatedPages: 0,
      recommendations: [],
      dataSource: 'profile'
    }

    // Analyze each experience entry
    for (const exp of profile.experience) {
      const projects = exp.projects || []
      const sectionChars = projects.reduce((sum, p) => sum + (p.description?.length || 0), 0)
      assessment.totalCharacters += sectionChars

      assessment.sections.push({
        name: `${exp.role?.title || 'Unknown'} at ${exp.role?.company || 'Unknown'}`,
        projects: projects.length,
        characters: sectionChars,
        averageProjectLength:
          projects.length > 0 ? Math.round(sectionChars / projects.length) : 0
      })

      // Check for long project descriptions
      projects.forEach((project, idx) => {
        const descLen = project.description?.length || 0
        if (descLen > SECTION_LIMITS.experience_bullet.soft) {
          assessment.recommendations.push({
            type: 'trim_description',
            location: `${exp.role?.company} - ${project.name}`,
            current: descLen,
            target: SECTION_LIMITS.experience_bullet.soft,
            preview: project.description?.substring(0, 60) + '...'
          })
        }
      })
    }

    // Estimate pages
    const CHARS_PER_PAGE = 3500
    assessment.estimatedPages = Math.ceil(assessment.totalCharacters / CHARS_PER_PAGE)
    assessment.fitsOnePage = assessment.estimatedPages <= 1
    assessment.fitsTwoPages = assessment.estimatedPages <= 2

    return assessment
  }

  // Fall back to legacy data
  const resumeData = loadResumeData()
  if (!resumeData) {
    return { error: 'Could not load resume data from profile or legacy source' }
  }

  const assessment = {
    sections: [],
    totalCharacters: 0,
    estimatedPages: 0,
    recommendations: [],
    dataSource: 'legacy'
  }

  // Analyze each experience entry
  if (resumeData.experience) {
    for (const exp of resumeData.experience) {
      const sectionChars = (exp.bullets || []).reduce((sum, b) => sum + b.length, 0)
      assessment.totalCharacters += sectionChars

      assessment.sections.push({
        name: `${exp.title} at ${exp.company}`,
        bullets: (exp.bullets || []).length,
        characters: sectionChars,
        averageBulletLength: Math.round(sectionChars / (exp.bullets || []).length)
      })

      // Check for long bullets
      ;(exp.bullets || []).forEach((bullet, idx) => {
        if (bullet.length > SECTION_LIMITS.experience_bullet.soft) {
          assessment.recommendations.push({
            type: 'trim_bullet',
            location: `${exp.company} - bullet ${idx + 1}`,
            current: bullet.length,
            target: SECTION_LIMITS.experience_bullet.soft,
            preview: bullet.substring(0, 60) + '...'
          })
        }
      })
    }
  }

  // Analyze summary
  if (resumeData.summary) {
    const summaryLen = resumeData.summary.length
    assessment.totalCharacters += summaryLen

    if (summaryLen > SECTION_LIMITS.summary.soft) {
      assessment.recommendations.push({
        type: 'trim_summary',
        current: summaryLen,
        target: SECTION_LIMITS.summary.soft
      })
    }
  }

  // Estimate pages
  const CHARS_PER_PAGE = 3500 // Approximate with standard formatting
  assessment.estimatedPages = Math.ceil(assessment.totalCharacters / CHARS_PER_PAGE)
  assessment.fitsOnePage = assessment.estimatedPages <= 1
  assessment.fitsTwoPages = assessment.estimatedPages <= 2

  return assessment
}
