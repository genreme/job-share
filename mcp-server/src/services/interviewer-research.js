/**
 * Interviewer Research Service
 * Per-person research following manager-research.js template pattern
 *
 * Provides template generation for Claude to populate, validation,
 * and persistence in both JSON and markdown formats.
 *
 * Primary focus: Interview style signals and connection building (talking points, shared interests)
 * Secondary focus: Background information
 *
 * Multiple interviewers can be researched per job, each stored separately.
 */

import { v4 as uuidv4 } from 'uuid'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import { InterviewerResearchSchema } from '../../../schemas/interview.schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const RESEARCH_DIR = join(DATA_DIR, 'job-research')

// Ensure research directory exists
if (!existsSync(RESEARCH_DIR)) {
  mkdirSync(RESEARCH_DIR, { recursive: true })
}

/**
 * Atomic file write using temp file + rename pattern
 * Prevents data corruption if process crashes mid-write
 */
function atomicWriteSync(filePath, data) {
  const tempPath = join(tmpdir(), `research-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`)
  try {
    writeFileSync(tempPath, data, 'utf-8')
    renameSync(tempPath, filePath)
  } catch (err) {
    try { unlinkSync(tempPath) } catch (e) { /* ignore */ }
    throw err
  }
}

/**
 * Sanitize interviewer name for use in filename
 * - Lowercase
 * - Replace spaces with dashes
 * - Remove special characters
 *
 * @param {string} name - Interviewer name
 * @returns {string} Sanitized name safe for filenames
 */
function sanitizeName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

/**
 * Start interviewer research by returning a template structure
 * Claude populates this through conversation, then calls saveInterviewerResearch
 *
 * Per CONTEXT.md:
 * - Comprehensive search: LinkedIn, company bio, news mentions, conference talks, blog posts
 * - Style inference: Role-based heuristics + content analysis combined
 * - Both talking points AND style signals surfaced equally
 *
 * @param {number} jobId - Job ID to associate research with
 * @param {string} interviewerName - Interviewer's name
 * @param {string} [interviewerTitle] - Interviewer's title (optional)
 * @param {string} [interviewRound] - Interview round (e.g., "phone screen", "onsite", "final")
 * @returns {{ status: string, research: object, instructions: string }}
 */
export function startInterviewerResearch(jobId, interviewerName, interviewerTitle, interviewRound) {
  const research = {
    id: uuidv4(),
    jobId,
    interviewerName,
    interviewerTitle: interviewerTitle || undefined,
    interviewRound: interviewRound || undefined,
    researchedAt: new Date().toISOString(),
    background: { previousRoles: [] },
    interviewStyle: { signals: [], expectedQuestionTypes: [] },
    talkingPoints: [],
    sharedInterests: [],
    confidence: 'low',
    sources: []
  }

  const titleContext = interviewerTitle ? ` (${interviewerTitle})` : ''
  const roundContext = interviewRound ? ` for the ${interviewRound} round` : ''

  return {
    status: 'template_ready',
    research,
    instructions: `Research ${interviewerName}${titleContext}${roundContext}, focusing on:

**Primary - Interview Style Signals (equally important with talking points):**
1. **Interview Style Signals**: Glassdoor patterns, typical interview approach for this role type
2. **Expected Question Types**: behavioral, technical, system-design, culture-fit, case-study
3. **Communication Style**: Direct, collaborative, detail-oriented, etc.
4. **Depth Expectation**: surface, moderate, deep

**Primary - Talking Points & Connection Building:**
5. **LinkedIn Activity**: Recent posts, articles, engagement topics
6. **Shared Interests**: Based on their content, groups, professional interests
7. **Talking Points**: Specific topics for rapport building in the interview

**Secondary - Background (for context):**
8. **Current Role**: Title and company
9. **Previous Roles**: Brief career trajectory
10. **Years in Role**: For context on experience level
11. **LinkedIn URL**: For reference

**Sources to check:**
- LinkedIn profile and activity
- Company bio page
- Glassdoor interview reviews
- Conference talks or presentations
- Blog posts or articles
- Twitter/X activity
- News mentions

Update the confidence level based on how much information you find:
- high: Found comprehensive info from multiple sources
- medium: Found some useful info but gaps remain
- low: Limited information available

Use saveInterviewerResearch to persist findings once complete.`
  }
}

/**
 * Save interviewer research with findings
 * Validates data, saves JSON + markdown, returns result
 *
 * @param {number} jobId - Job ID
 * @param {object} findings - Research findings to save
 * @returns {{ success?: boolean, saved?: object, error?: string, details?: any[] }}
 */
export function saveInterviewerResearch(jobId, findings) {
  // Ensure findings has the correct jobId
  const researchData = { ...findings, jobId }

  // Validate findings
  const validation = InterviewerResearchSchema.safeParse(researchData)
  if (!validation.success) {
    return {
      error: 'Invalid research format',
      details: validation.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    }
  }

  const validatedData = validation.data
  const sanitizedName = sanitizeName(validatedData.interviewerName)
  const jsonPath = join(RESEARCH_DIR, `${jobId}-interviewer-${sanitizedName}.json`)
  const markdownPath = join(RESEARCH_DIR, `${jobId}-interviewer-${sanitizedName}.md`)

  // Save structured JSON
  atomicWriteSync(jsonPath, JSON.stringify(validatedData, null, 2))

  // Generate and save markdown summary
  const markdown = generateInterviewerMarkdown(validatedData)
  atomicWriteSync(markdownPath, markdown)

  return {
    success: true,
    saved: { json: jsonPath, markdown: markdownPath }
  }
}

/**
 * Get interviewer research by job ID and name
 *
 * @param {number} jobId - Job ID
 * @param {string} interviewerName - Interviewer's name
 * @returns {object|null} Research data or null if not found
 */
export function getInterviewerResearch(jobId, interviewerName) {
  const sanitizedName = sanitizeName(interviewerName)
  const jsonPath = join(RESEARCH_DIR, `${jobId}-interviewer-${sanitizedName}.json`)

  if (!existsSync(jsonPath)) {
    return null
  }

  try {
    const data = JSON.parse(readFileSync(jsonPath, 'utf-8'))
    // Validate loaded data
    const validation = InterviewerResearchSchema.safeParse(data)
    if (!validation.success) {
      console.warn(`Invalid interviewer research data for ${interviewerName}:`, validation.error.issues)
      return data // Return anyway for backwards compatibility
    }
    return validation.data
  } catch (err) {
    console.error(`Error loading interviewer research for ${interviewerName}:`, err)
    return null
  }
}

/**
 * List all interviewer research for a job
 * Enables checking which interviewers have already been researched
 *
 * @param {number} jobId - Job ID
 * @returns {Array<{ name: string, researchedAt: string, confidence: string }>}
 */
export function listInterviewerResearchForJob(jobId) {
  if (!existsSync(RESEARCH_DIR)) {
    return []
  }

  const prefix = `${jobId}-interviewer-`
  const suffix = '.json'

  try {
    const files = readdirSync(RESEARCH_DIR)
    const interviewerFiles = files.filter(f =>
      f.startsWith(prefix) && f.endsWith(suffix)
    )

    const summaries = interviewerFiles.map(file => {
      try {
        const filePath = join(RESEARCH_DIR, file)
        const data = JSON.parse(readFileSync(filePath, 'utf-8'))
        return {
          name: data.interviewerName,
          researchedAt: data.researchedAt,
          confidence: data.confidence
        }
      } catch (err) {
        console.error(`Error reading interviewer file ${file}:`, err)
        return null
      }
    }).filter(Boolean)

    return summaries
  } catch (err) {
    console.error(`Error listing interviewer research for job ${jobId}:`, err)
    return []
  }
}

/**
 * Generate human-readable markdown from interviewer research
 * Order per CONTEXT.md: Talking points and style signals are primary
 *
 * @param {object} research - Validated interviewer research object
 * @returns {string} Markdown formatted research
 */
function generateInterviewerMarkdown(research) {
  const sections = []

  // Header
  const titleSuffix = research.interviewerTitle ? ` - ${research.interviewerTitle}` : ''
  sections.push(`# ${research.interviewerName}${titleSuffix}`)
  sections.push('')
  sections.push(`**Researched:** ${research.researchedAt}`)
  sections.push(`**Confidence:** ${research.confidence}`)
  sections.push(`**Job ID:** ${research.jobId}`)
  if (research.interviewRound) {
    sections.push(`**Interview Round:** ${research.interviewRound}`)
  }
  sections.push('')

  // Talking Points (most important, first)
  sections.push('## Talking Points')
  if (research.talkingPoints?.length > 0) {
    research.talkingPoints.forEach((point, i) => sections.push(`${i + 1}. ${point}`))
  } else {
    sections.push('*None identified yet*')
  }
  sections.push('')

  // Interview Style Signals (equally important with talking points)
  sections.push('## Interview Style')
  if (research.interviewStyle?.communicationPattern) {
    sections.push(`**Communication Pattern:** ${research.interviewStyle.communicationPattern}`)
  }
  if (research.interviewStyle?.depthExpectation) {
    sections.push(`**Depth Expectation:** ${research.interviewStyle.depthExpectation}`)
  }
  if (research.interviewStyle?.expectedQuestionTypes?.length > 0) {
    sections.push(`**Expected Question Types:** ${research.interviewStyle.expectedQuestionTypes.join(', ')}`)
  }
  if (research.interviewStyle?.signals?.length > 0) {
    sections.push('')
    sections.push('**Signals:**')
    research.interviewStyle.signals.forEach(s => sections.push(`- ${s}`))
  }
  if (!research.interviewStyle?.communicationPattern &&
      !research.interviewStyle?.signals?.length &&
      !research.interviewStyle?.expectedQuestionTypes?.length) {
    sections.push('*No style signals found*')
  }
  sections.push('')

  // Shared Interests
  sections.push('## Shared Interests')
  if (research.sharedInterests?.length > 0) {
    research.sharedInterests.forEach(interest => sections.push(`- ${interest}`))
  } else {
    sections.push('*None identified*')
  }
  sections.push('')

  // LinkedIn Presence
  sections.push('## LinkedIn Presence')
  if (research.background?.linkedInUrl) {
    sections.push(`**Profile:** ${research.background.linkedInUrl}`)
    sections.push('')
  }
  if (!research.background?.linkedInUrl) {
    sections.push('*No LinkedIn URL found*')
  }
  sections.push('')

  // Background (secondary, at the end)
  sections.push('## Background')
  if (research.background?.currentRole) {
    sections.push(`**Current Role:** ${research.background.currentRole}`)
  }
  if (research.background?.company) {
    sections.push(`**Company:** ${research.background.company}`)
  }
  if (research.background?.yearsInRole) {
    sections.push(`**Years in Role:** ${research.background.yearsInRole}`)
  }
  if (research.background?.previousRoles?.length > 0) {
    sections.push('')
    sections.push('**Previous Roles:**')
    research.background.previousRoles.forEach(r => sections.push(`- ${r}`))
  }
  if (!research.background?.currentRole && !research.background?.previousRoles?.length) {
    sections.push('*Limited background information available*')
  }
  sections.push('')

  // Sources
  if (research.sources?.length > 0) {
    sections.push('## Sources')
    research.sources.forEach(s => sections.push(`- ${s}`))
    sections.push('')
  }

  sections.push('---')
  sections.push(`*Interviewer research for Job ID: ${research.jobId}*`)

  return sections.join('\n')
}

// Export sanitizeName for testing
export { sanitizeName }
