/**
 * Enhanced Document Generation MCP Tools
 *
 * Provides keyword-optimized resume generation, research-integrated
 * cover letter generation, and email response variations.
 *
 * APPL-10: Keyword optimization for resume
 * APPL-11: Research-integrated cover letter
 * APPL-13: Email response variations
 */

import { loadJobsFromDashboard } from '../data/loader.js'
import { loadProfile } from '../data/profile-loader.js'
import { buildResumeFromProfile } from '../services/profile-to-resume.js'
import { optimizeResumeForJob } from '../services/keyword-optimizer.js'
import { getJobResearch, getResearchHighlights } from '../services/research-persistence.js'
import { generateEmailVariations } from '../services/email-generator.js'

/**
 * Generate keyword-optimized resume for a specific job
 * Reorders skills and bullets by relevance, preserves structure
 *
 * APPL-10: Uses profile + job research + playbook
 *
 * @param {{ jobId: number, includeResearchReferences?: boolean }} params
 * @returns {{ status: string, optimization: object, resumeData: object, ... }}
 */
export function generateOptimizedResume({ jobId, includeResearchReferences = false }) {
  if (!jobId) {
    return { error: 'Job ID is required' }
  }

  // Load job data
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job with ID ${jobId} not found` }
  }

  // Load profile
  let profile
  try {
    profile = loadProfile()
  } catch (error) {
    return { error: `Could not load profile: ${error.message}` }
  }

  if (!profile || !profile.experience?.length) {
    return {
      error: 'Profile has no experience data',
      suggestion: 'Populate profile with experience entries first'
    }
  }

  // Get job description from notes field
  const jobDescription = job.notes || job.description || ''

  // Get research if requested
  let research = null
  if (includeResearchReferences) {
    const researchData = getJobResearch(jobId, 'company')
    if (researchData?.hasResearch) {
      research = {
        highlights: researchData.company?.highlights || []
      }
    }
  }

  // Build base resume from profile
  const jobContext = {
    company: job.company,
    title: job.title,
    keywords: [] // Will be extracted by optimizer
  }
  const baseResume = buildResumeFromProfile(profile, jobContext)

  // Optimize resume for job keywords
  const optimization = optimizeResumeForJob(baseResume, jobDescription, research)

  return {
    status: 'optimized',
    jobId,
    company: job.company,
    title: job.title,
    optimization: {
      summary: optimization.summary,
      changes: optimization.optimizations,
      keywordCoverage: optimization.keywordCoverage,
      researchIntegration: optimization.researchIntegration
    },
    researchUsed: !!research,
    resumeData: optimization.optimizedData,
    nextStep: 'Call review_generated_document to check for issues before using'
  }
}

/**
 * Generate cover letter with research integration
 * Fixed structure, fresh content using profile + research + JD
 *
 * APPL-11: Research-integrated cover letter
 *
 * @param {{ jobId: number, includeCompanyReferences?: boolean, toneVariation?: string }} params
 * @returns {{ status: string, coverLetter: object, ... }}
 */
export function generateResearchedCoverLetter({
  jobId,
  includeCompanyReferences = true,
  toneVariation = null
}) {
  if (!jobId) {
    return { error: 'Job ID is required' }
  }

  // Load job data
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job with ID ${jobId} not found` }
  }

  // Load profile
  let profile
  try {
    profile = loadProfile()
  } catch (error) {
    return { error: `Could not load profile: ${error.message}` }
  }

  // Determine tone from profile preferences or override
  const profileTone = profile?.preferences?.communication?.tone || 'professional'
  const appliedTone = toneVariation || profileTone

  // Get research if available and requested
  let research = null
  let researchHighlights = []
  if (includeCompanyReferences) {
    const highlights = getResearchHighlights(jobId)
    if (highlights) {
      research = highlights
      researchHighlights = highlights.highlights || []
    }
  }

  // Build cover letter structure for Claude to fill
  // Per CONTEXT.md: "fixed structure (opener, body, close) but content generated fresh"
  const coverLetter = {
    structure: {
      opener: {
        instruction: `Write compelling opening paragraph for ${job.title} at ${job.company}`,
        elements: [
          'Hook that captures attention',
          'Clear statement of role interest',
          research ? `Reference to company: ${researchHighlights[0] || 'company values'}` : null
        ].filter(Boolean),
        tone: appliedTone,
        lengthGuidance: '2-3 sentences'
      },
      body: {
        instruction: `Write body paragraphs demonstrating fit for ${job.title}`,
        elements: [
          'Relevant experience highlights',
          'Specific achievements with metrics',
          'Connection to job requirements',
          research ? 'Company-specific alignment' : null
        ].filter(Boolean),
        tone: appliedTone,
        lengthGuidance: '2 paragraphs, 3-4 sentences each'
      },
      closing: {
        instruction: 'Write strong closing paragraph',
        elements: [
          'Enthusiasm for opportunity',
          'Call to action',
          'Professional sign-off'
        ],
        tone: appliedTone,
        lengthGuidance: '2-3 sentences'
      }
    },
    context: {
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        hiringManager: job.hiringManager || null,
        description: job.notes?.substring(0, 500) || ''
      },
      profile: {
        name: profile?.basics?.fullName || 'Your Name',
        currentTitle: profile?.experience?.[0]?.role?.title || '',
        topSkills: (profile?.skills || []).slice(0, 5).map(s => s.name),
        stories: (profile?.stories || []).slice(0, 3).map(s => ({
          title: s.title,
          category: s.category
        }))
      },
      research: research ? {
        available: true,
        highlights: researchHighlights,
        lastUpdated: research.lastUpdated
      } : { available: false }
    }
  }

  return {
    status: 'generated',
    jobId,
    company: job.company,
    title: job.title,
    coverLetter,
    researchUsed: !!research,
    toneApplied: appliedTone,
    nextStep: 'Claude fills structure, then call review_generated_document to check before use'
  }
}

/**
 * Generate email response with tone variations
 * Provides 2-3 options for user to select and edit
 *
 * APPL-13: Email responses with tone variations
 *
 * @param {{ jobId: number, emailType: string, context?: string, toneCount?: number }} params
 * @returns {{ status: string, variations: Array, ... }}
 */
export function generateEmailResponse({ jobId, emailType, context, toneCount = 3 }) {
  if (!jobId) {
    return { error: 'Job ID is required' }
  }

  if (!emailType) {
    return {
      error: 'Email type is required',
      validTypes: ['followup', 'thank_you', 'inquiry', 'response']
    }
  }

  // Delegate to email generator service
  return generateEmailVariations({
    jobId,
    emailType,
    context,
    toneCount: Math.min(toneCount || 3, 3)
  })
}
