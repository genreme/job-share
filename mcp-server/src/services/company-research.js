/**
 * Company Research Service
 * APPL-08: Deep company investigation - culture, news, funding, challenges
 *
 * Provides template generation for Claude to populate, validation,
 * and persistence in both JSON and markdown formats.
 */

import { v4 as uuidv4 } from 'uuid'
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, renameSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import { CompanyResearchSchema } from '../../../schemas/research.schema.js'

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
 * Start company research by returning a template structure
 * Claude populates this through conversation, then calls updateCompanyResearch
 *
 * @param {number} jobId - Job ID to associate research with
 * @param {string} companyName - Company name to research
 * @returns {{ status: string, research: object, instructions: string }}
 */
export function researchCompany(jobId, companyName) {
  const research = {
    id: uuidv4(),
    jobId,
    companyName,
    researchedAt: new Date().toISOString(),
    firmographics: {},
    funding: { investors: [], signals: [] },
    culture: { values: [], glassdoorThemes: [], leadershipQuotes: [] },
    news: [],
    challenges: [],
    competitors: [],
    products: [],
    confidence: 'medium',
    sources: [],
    highlights: []
  }

  return {
    status: 'template_ready',
    research,
    instructions: `Research ${companyName} and populate the following:

1. **Firmographics**: Company size, industry, founded date, HQ, website
2. **Funding**: Stage, total raised, last round, key investors, financial signals
3. **Culture**: Core values, Glassdoor themes, leadership quotes on culture, work style
4. **News**: Recent news (last 6 months), especially hiring, product, funding
5. **Challenges**: Industry challenges, company-specific challenges mentioned
6. **Competitors**: Main competitors in their space
7. **Products**: Key products/services with brief descriptions
8. **Highlights**: 3-5 key talking points for interviews

Use updateCompanyResearch to save findings once complete.`
  }
}

/**
 * Update company research with findings
 * Validates data, saves JSON + markdown, returns result
 *
 * @param {number} jobId - Job ID
 * @param {object} findings - Research findings to save
 * @returns {{ success: boolean, saved?: object, highlights?: string[], error?: string, details?: any[] }}
 */
export function updateCompanyResearch(jobId, findings) {
  // Ensure findings has the correct jobId
  const researchData = { ...findings, jobId }

  // Validate findings
  const validation = CompanyResearchSchema.safeParse(researchData)
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
  const jsonPath = join(RESEARCH_DIR, `${jobId}-company.json`)
  const markdownPath = join(RESEARCH_DIR, `${jobId}-company.md`)

  // Save structured JSON
  atomicWriteSync(jsonPath, JSON.stringify(validatedData, null, 2))

  // Generate and save markdown summary
  const markdown = generateCompanyMarkdown(validatedData)
  atomicWriteSync(markdownPath, markdown)

  return {
    success: true,
    saved: { json: jsonPath, markdown: markdownPath },
    highlights: validatedData.highlights
  }
}

/**
 * Check for existing company research by company name
 * Per CONTEXT.md: Prompt for reuse when same company detected
 *
 * @param {string} companyName - Company name to check
 * @returns {{ found: boolean, existingJobId?: number, companyName?: string, researchedAt?: string, daysSinceResearch?: number, highlights?: string[], suggestion?: string }}
 */
export function checkForExistingCompanyResearch(companyName) {
  if (!existsSync(RESEARCH_DIR)) {
    return { found: false }
  }

  const files = readdirSync(RESEARCH_DIR)
  const companyFiles = files.filter(f => f.endsWith('-company.json'))

  for (const file of companyFiles) {
    try {
      const research = JSON.parse(readFileSync(join(RESEARCH_DIR, file), 'utf-8'))
      if (research.companyName?.toLowerCase() === companyName.toLowerCase()) {
        const jobIdMatch = file.match(/^(\d+)-company\.json$/)
        const existingJobId = jobIdMatch ? parseInt(jobIdMatch[1], 10) : null

        const daysSince = Math.floor(
          (Date.now() - new Date(research.researchedAt).getTime()) / (1000 * 60 * 60 * 24)
        )

        return {
          found: true,
          existingJobId,
          companyName: research.companyName,
          researchedAt: research.researchedAt,
          daysSinceResearch: daysSince,
          highlights: research.highlights,
          suggestion: daysSince < 30
            ? 'Recent research available. Reuse?'
            : 'Older research available. Refresh recommended.'
        }
      }
    } catch (e) {
      // Skip invalid files
    }
  }

  return { found: false }
}

/**
 * Generate human-readable markdown from company research
 * Internal helper, not exported
 *
 * @param {object} research - Validated company research object
 * @returns {string} Markdown formatted research
 */
function generateCompanyMarkdown(research) {
  const sections = []

  // Header
  sections.push(`# ${research.companyName} - Company Research`)
  sections.push('')
  sections.push(`**Researched:** ${research.researchedAt}`)
  sections.push(`**Confidence:** ${research.confidence}`)
  sections.push(`**Job ID:** ${research.jobId}`)
  sections.push('')

  // Highlights
  if (research.highlights?.length > 0) {
    sections.push('## Quick Highlights')
    research.highlights.forEach(h => sections.push(`- ${h}`))
    sections.push('')
  }

  // Firmographics
  sections.push('## Firmographics')
  sections.push(`- **Size:** ${research.firmographics?.size || 'Unknown'}`)
  sections.push(`- **Industry:** ${research.firmographics?.industry || 'Unknown'}`)
  sections.push(`- **Founded:** ${research.firmographics?.founded || 'Unknown'}`)
  sections.push(`- **HQ:** ${research.firmographics?.headquarters || 'Unknown'}`)
  sections.push(`- **Website:** ${research.firmographics?.website || 'Unknown'}`)
  sections.push('')

  // Funding
  sections.push('## Funding')
  sections.push(`- **Stage:** ${research.funding?.stage || 'Unknown'}`)
  sections.push(`- **Total Raised:** ${research.funding?.totalRaised || 'Unknown'}`)
  sections.push(`- **Last Round:** ${research.funding?.lastRound || 'Unknown'}`)
  if (research.funding?.investors?.length > 0) {
    sections.push(`- **Investors:** ${research.funding.investors.join(', ')}`)
  }
  if (research.funding?.signals?.length > 0) {
    sections.push('')
    sections.push('**Signals:**')
    research.funding.signals.forEach(s => sections.push(`- ${s}`))
  }
  sections.push('')

  // Culture
  sections.push('## Culture')
  if (research.culture?.values?.length > 0) {
    sections.push(`**Values:** ${research.culture.values.join(', ')}`)
  }
  if (research.culture?.workStyle) {
    sections.push(`**Work Style:** ${research.culture.workStyle}`)
  }
  if (research.culture?.glassdoorThemes?.length > 0) {
    sections.push('')
    sections.push('**Glassdoor Themes:**')
    research.culture.glassdoorThemes.forEach(t => sections.push(`- ${t}`))
  }
  if (research.culture?.leadershipQuotes?.length > 0) {
    sections.push('')
    sections.push('**Leadership Quotes:**')
    research.culture.leadershipQuotes.forEach(q => {
      sections.push(`> "${q.quote}" - ${q.speaker}${q.source ? ` (${q.source})` : ''}`)
      sections.push('')
    })
  }
  sections.push('')

  // News
  sections.push('## Recent News')
  if (research.news?.length > 0) {
    research.news.forEach(n => {
      const dateStr = n.date ? ` (${n.date})` : ''
      const sourceStr = n.source ? ` [${n.source}]` : ''
      const relevanceStr = n.relevance !== 'medium' ? ` [${n.relevance}]` : ''
      sections.push(`- **${n.headline}**${dateStr}${sourceStr}${relevanceStr}`)
    })
  } else {
    sections.push('No recent news found.')
  }
  sections.push('')

  // Challenges
  sections.push('## Challenges')
  if (research.challenges?.length > 0) {
    research.challenges.forEach(c => sections.push(`- ${c}`))
  } else {
    sections.push('None identified.')
  }
  sections.push('')

  // Competitors
  sections.push('## Competitors')
  if (research.competitors?.length > 0) {
    sections.push(research.competitors.join(', '))
  } else {
    sections.push('None identified.')
  }
  sections.push('')

  // Products
  if (research.products?.length > 0) {
    sections.push('## Products/Services')
    research.products.forEach(p => {
      if (p.description) {
        sections.push(`- **${p.name}:** ${p.description}`)
      } else {
        sections.push(`- ${p.name}`)
      }
    })
    sections.push('')
  }

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
