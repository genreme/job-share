/**
 * Manager Research Service
 * APPL-09: Focus on style and connection - interview style, communication patterns, shared interests
 *
 * Provides template generation for Claude to populate, validation,
 * and persistence in both JSON and markdown formats.
 * Background info is secondary; style and connection are primary.
 */

import { v4 as uuidv4 } from 'uuid'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import { HiringManagerResearchSchema } from '../../../schemas/research.schema.js'

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
 * Start hiring manager research by returning a template structure
 * Claude populates this through conversation, then calls updateManagerResearch
 *
 * Per CONTEXT.md: Primary focus on style and connection, background is secondary
 *
 * @param {number} jobId - Job ID to associate research with
 * @param {string} managerName - Hiring manager's name
 * @param {string} companyName - Company name for context
 * @returns {{ status: string, research: object, instructions: string }}
 */
export function researchHiringManager(jobId, managerName, companyName) {
  const research = {
    id: uuidv4(),
    jobId,
    managerName,
    researchedAt: new Date().toISOString(),
    background: { previousRoles: [] },
    interviewStyle: { signals: [], commonQuestions: [] },
    linkedIn: { activity: [] },
    sharedInterests: [],
    mutualConnections: [],
    talkingPoints: [],
    confidence: 'low',
    sources: []
  }

  return {
    status: 'template_ready',
    research,
    instructions: `Research ${managerName} at ${companyName}, focusing on:

**Primary (Style & Connection):**
1. **Interview Style Signals**: Patterns from Glassdoor reviews mentioning them, typical interview approach
2. **Communication Style**: Direct, collaborative, detail-oriented, etc.
3. **LinkedIn Activity**: Recent posts, articles, engagement topics
4. **Shared Interests**: Based on their content, groups, interests
5. **Mutual Connections**: Scan for overlap with your network
6. **Talking Points**: Specific topics for rapport building in interviews

**Secondary (Background):**
7. **Current Role**: Title and time in position
8. **Previous Experience**: Brief career trajectory
9. **Education**: If relevant for connection points

Use updateManagerResearch to save findings once complete.`
  }
}

/**
 * Update manager research with findings
 * Validates data, saves JSON + markdown, returns result
 *
 * @param {number} jobId - Job ID
 * @param {object} findings - Research findings to save
 * @returns {{ success: boolean, saved?: object, error?: string, details?: any[] }}
 */
export function updateManagerResearch(jobId, findings) {
  // Ensure findings has the correct jobId
  const researchData = { ...findings, jobId }

  // Validate findings
  const validation = HiringManagerResearchSchema.safeParse(researchData)
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
  const jsonPath = join(RESEARCH_DIR, `${jobId}-manager.json`)
  const markdownPath = join(RESEARCH_DIR, `${jobId}-manager.md`)

  // Save structured JSON
  atomicWriteSync(jsonPath, JSON.stringify(validatedData, null, 2))

  // Generate and save markdown summary
  const markdown = generateManagerMarkdown(validatedData)
  atomicWriteSync(markdownPath, markdown)

  return {
    success: true,
    saved: { json: jsonPath, markdown: markdownPath }
  }
}

/**
 * Generate human-readable markdown from manager research
 * Focuses on talking points and connection signals (per CONTEXT.md)
 *
 * @param {object} research - Validated manager research object
 * @returns {string} Markdown formatted research
 */
function generateManagerMarkdown(research) {
  const sections = []

  // Header
  sections.push(`# ${research.managerName} - Hiring Manager Research`)
  sections.push('')
  sections.push(`**Researched:** ${research.researchedAt}`)
  sections.push(`**Confidence:** ${research.confidence}`)
  sections.push(`**Job ID:** ${research.jobId}`)
  sections.push('')

  // Talking Points (most important, first)
  sections.push('## Talking Points')
  if (research.talkingPoints?.length > 0) {
    research.talkingPoints.forEach((point, i) => sections.push(`${i + 1}. ${point}`))
  } else {
    sections.push('*None identified yet*')
  }
  sections.push('')

  // Interview Style
  sections.push('## Interview Style')
  if (research.interviewStyle?.communicationPattern) {
    sections.push(`**Communication Pattern:** ${research.interviewStyle.communicationPattern}`)
  }
  if (research.interviewStyle?.signals?.length > 0) {
    sections.push('')
    sections.push('**Signals:**')
    research.interviewStyle.signals.forEach(s => sections.push(`- ${s}`))
  }
  if (research.interviewStyle?.commonQuestions?.length > 0) {
    sections.push('')
    sections.push('**Common Questions Asked:**')
    research.interviewStyle.commonQuestions.forEach(q => sections.push(`- ${q}`))
  }
  if (!research.interviewStyle?.communicationPattern &&
      !research.interviewStyle?.signals?.length &&
      !research.interviewStyle?.commonQuestions?.length) {
    sections.push('*No style signals found*')
  }
  sections.push('')

  // Shared Interests
  sections.push('## Shared Interests')
  if (research.sharedInterests?.length > 0) {
    sections.push(research.sharedInterests.join(', '))
  } else {
    sections.push('*None identified*')
  }
  sections.push('')

  // Mutual Connections
  sections.push('## Mutual Connections')
  if (research.mutualConnections?.length > 0) {
    research.mutualConnections.forEach(c => sections.push(`- ${c}`))
  } else {
    sections.push('*None found*')
  }
  sections.push('')

  // LinkedIn Activity
  sections.push('## LinkedIn Presence')
  if (research.linkedIn?.url) {
    sections.push(`**Profile:** ${research.linkedIn.url}`)
  }
  if (research.linkedIn?.connections) {
    sections.push(`**Connections:** ${research.linkedIn.connections.toLocaleString()}`)
  }
  if (research.linkedIn?.activity?.length > 0) {
    sections.push('')
    sections.push('**Recent Activity:**')
    research.linkedIn.activity.forEach(a => sections.push(`- ${a}`))
  }
  if (!research.linkedIn?.url && !research.linkedIn?.activity?.length) {
    sections.push('*No LinkedIn presence found*')
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
  if (research.background?.education) {
    sections.push(`**Education:** ${research.background.education}`)
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
  sections.push(`*Research for Job ID: ${research.jobId}*`)

  return sections.join('\n')
}
