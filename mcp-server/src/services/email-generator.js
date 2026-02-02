/**
 * Email Generator Service
 *
 * Generates email response variations with different tones.
 * Per CONTEXT.md: "Multiple options - provide 2-3 tone variations, user picks and edits"
 *
 * APPL-13: Email responses with tone variations
 */

import { loadProfile } from '../data/profile-loader.js'
import { loadJobsFromDashboard } from '../data/loader.js'
import { getResearchHighlights } from './research-persistence.js'

/**
 * Email type definitions with context-specific guidance
 */
const EMAIL_TYPES = {
  followup: {
    label: 'Follow-up Email',
    purpose: 'Re-establish contact after application or interview',
    elements: ['reference previous interaction', 'express continued interest', 'offer next steps']
  },
  thank_you: {
    label: 'Thank You Email',
    purpose: 'Express gratitude after interview or informational meeting',
    elements: ['specific reference to conversation points', 'reinforce fit', 'forward-looking close']
  },
  inquiry: {
    label: 'Inquiry Email',
    purpose: 'Initial outreach or request for information',
    elements: ['clear purpose statement', 'brief value proposition', 'specific ask']
  },
  response: {
    label: 'Response Email',
    purpose: 'Reply to recruiter or hiring manager message',
    elements: ['acknowledge their message', 'answer questions', 'maintain momentum']
  }
}

/**
 * Tone definitions with style guidance
 */
const TONES = {
  professional: {
    label: 'Professional',
    style: 'Formal but approachable. Uses proper salutations and closings.',
    characteristics: ['Dear/Hello', 'Best regards', 'third-person references', 'complete sentences']
  },
  warm: {
    label: 'Warm & Personable',
    style: 'Friendly and engaging. Shows enthusiasm while maintaining professionalism.',
    characteristics: ['Hi/Hello', 'excited/looking forward', 'conversational flow', 'personal touches']
  },
  direct: {
    label: 'Direct & Concise',
    style: 'Gets to the point quickly. Respects reader time.',
    characteristics: ['Hi', 'short paragraphs', 'clear asks', 'minimal flourishes']
  }
}

/**
 * Generate email variations with different tones
 *
 * Returns template structures for Claude to fill with personalized content
 *
 * @param {{ jobId: number, emailType: string, context?: string, toneCount?: number }} params
 * @returns {{ status: string, variations: Array, ... }}
 */
export function generateEmailVariations({ jobId, emailType, context, toneCount = 3 }) {
  // Validate emailType
  if (!EMAIL_TYPES[emailType]) {
    return {
      error: `Invalid email type: ${emailType}`,
      validTypes: Object.keys(EMAIL_TYPES)
    }
  }

  // Load job data
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job with ID ${jobId} not found` }
  }

  // Load profile for name and preferences
  let profile
  try {
    profile = loadProfile()
  } catch (error) {
    console.error('Could not load profile:', error.message)
  }

  // Get research highlights if available
  const research = getResearchHighlights(jobId)

  // Determine tones to use (max 3)
  const toneKeys = ['professional', 'warm', 'direct'].slice(0, Math.min(toneCount, 3))

  // Build context object
  const emailContext = {
    job: {
      id: job.id,
      title: job.title,
      company: job.company,
      hiringManager: job.hiringManager || null,
      status: job.status
    },
    profile: {
      name: profile?.basics?.fullName || 'Your Name',
      preferredTone: profile?.preferences?.communication?.tone || 'professional'
    },
    research: research ? {
      hasResearch: true,
      highlights: research.highlights
    } : null,
    additionalContext: context || null
  }

  // Generate variation templates
  const variations = toneKeys.map(toneKey => {
    const tone = TONES[toneKey]
    const emailDef = EMAIL_TYPES[emailType]

    return {
      tone: toneKey,
      toneLabel: tone.label,
      toneDescription: tone.style,
      emailType,
      emailLabel: emailDef.label,
      template: {
        subject: `[Generate ${toneKey} subject for ${emailType} to ${job.company}]`,
        greeting: tone.characteristics[0] === 'Dear/Hello'
          ? `Dear ${job.hiringManager || 'Hiring Team'}`
          : `Hi ${job.hiringManager || 'there'}`,
        body: {
          opening: `[${tone.label} opening: ${emailDef.elements[0]}]`,
          middle: `[${tone.label} middle: ${emailDef.elements[1]}]`,
          closing: `[${tone.label} closing: ${emailDef.elements[2]}]`
        },
        signoff: toneKey === 'professional' ? 'Best regards' :
                 toneKey === 'warm' ? 'Looking forward to hearing from you' :
                 'Thanks',
        signature: emailContext.profile.name
      },
      context: emailContext,
      instructions: `Write a ${tone.label.toLowerCase()} ${emailDef.label.toLowerCase()}:
- Purpose: ${emailDef.purpose}
- Style: ${tone.style}
- Include: ${emailDef.elements.join(', ')}
${research ? `- Consider mentioning: ${research.highlights[0]}` : ''}
${context ? `- Additional context: ${context}` : ''}`
    }
  })

  return {
    status: 'variations_ready',
    jobId,
    company: job.company,
    title: job.title,
    emailType,
    emailLabel: EMAIL_TYPES[emailType].label,
    variations,
    note: 'Review variations and select the tone that best fits this situation. Edit as needed before sending.',
    nextStep: 'User selects preferred variation, edits if needed, then uses for sending'
  }
}
