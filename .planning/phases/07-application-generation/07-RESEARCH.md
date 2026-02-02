# Phase 7: Application Generation - Research

**Researched:** 2026-02-02
**Domain:** Company/Hiring Manager Research, Document Generation, Automated Review, Research Persistence
**Confidence:** HIGH

## Summary

Phase 7 adds deep research capabilities and tailored document generation to the Job Search Command Center. The phase builds on Phase 6's resume-JD matching to create a full application workflow: research company and hiring manager, generate customized materials (resume, cover letter, emails), review for quality, and persist research per job for future reference.

The primary work focuses on: (1) Creating a research service that aggregates company information from multiple public sources and extracts hiring manager intel, (2) Extending existing document generation with keyword optimization and research integration, (3) Implementing an automated review service for grammar, ATS compatibility, and factual accuracy, and (4) Persisting research data per job in both structured JSON and markdown formats.

Key decisions from CONTEXT.md constrain implementation: research is on-demand only (no auto-triggering), resume customization preserves structure while optimizing keywords, cover letters use fixed structure with fresh content, automated review flags issues with suggested fixes (user approves each), and research is stored per job but only highlights are surfaced automatically.

**Primary recommendation:** Use Claude/Perplexity as the research engine (already MCP-connected), extend existing profile-to-document services for keyword optimization, use LanguageTool API for grammar checking, and store research as JSON + markdown per job with the existing atomic write pattern.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed - No New Dependencies Required)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | ^3.x | Schema validation | Already used throughout codebase |
| date-fns | ^4.x | Date calculations | Already installed for follow-up engine |
| uuid | ^9.x | Generate research/review IDs | Already installed for profile/contacts |
| fs/path | Node builtin | File operations | Atomic writes pattern established |

### Supporting (May Need Adding)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| languagetool-api | custom fetch | Grammar checking | For automated review (APPL-12) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| LanguageTool API | Sapling.ai | Sapling is paid, LanguageTool has free tier with 20 req/min |
| LanguageTool API | Local gramma CLI | Requires Java runtime; prefer HTTP API for simplicity |
| Manual web scraping | Apify/Bright Data | Adds cost, complexity; Claude/Perplexity already connected via MCP |
| Custom research aggregation | Perplexity Deep Research | Perplexity already integrated; handles multi-source aggregation |

**Installation (if needed):**
```bash
# LanguageTool is HTTP API - no npm install needed
# Access via fetch to https://api.languagetool.org/v2/check
```

**Recommendation:** Keep dependencies minimal. The research heavy-lifting happens through Claude's existing web access or Perplexity MCP integration. Grammar checking uses LanguageTool's free public API.

## Architecture Patterns

### Recommended Project Structure
```
mcp-server/
├── data/
│   ├── jobs.json                       # Existing - extended with research field
│   ├── job-research/                   # NEW: Per-job research storage
│   │   ├── {jobId}-company.json        # Structured company research
│   │   ├── {jobId}-company.md          # Human-readable company notes
│   │   ├── {jobId}-manager.json        # Structured hiring manager research
│   │   └── {jobId}-manager.md          # Human-readable manager notes
│   └── profile/master-profile.json     # Existing - source for generation
├── src/
│   ├── services/
│   │   ├── company-research.js         # NEW: Company research aggregation
│   │   ├── manager-research.js         # NEW: Hiring manager research
│   │   ├── document-review.js          # NEW: Grammar, ATS, factual review
│   │   ├── keyword-optimizer.js        # NEW: Resume keyword optimization
│   │   ├── email-generator.js          # NEW: Email response generation
│   │   ├── profile-to-resume.js        # EXTEND: Add keyword optimization
│   │   └── profile-to-cover-letter.js  # EXTEND: Add research integration
│   └── tools/
│       ├── research.js                 # NEW: Company/manager research tools
│       ├── generation.js               # NEW: Enhanced document generation
│       └── review.js                   # NEW: Document review tools
schemas/
├── research.schema.js                  # NEW: Company/manager research schemas
└── review.schema.js                    # NEW: Document review schemas
```

### Pattern 1: Company Research (APPL-08)
**What:** Deep investigation of company info: size, industry, mission, funding, products, culture, news, challenges, competitors
**When to use:** User explicitly requests research for a specific job
**Example:**
```javascript
// Source: Existing MCP tool patterns + APPL-08 requirements
import { z } from 'zod'

// Structured company research schema
export const CompanyResearchSchema = z.object({
  id: z.string().uuid(),
  jobId: z.number(),
  companyName: z.string(),
  researchedAt: z.string(),
  refreshedAt: z.string().optional(),

  // Core firmographics
  firmographics: z.object({
    size: z.string().optional(),           // "50-200 employees"
    industry: z.string().optional(),
    founded: z.string().optional(),
    headquarters: z.string().optional(),
    website: z.string().url().optional()
  }),

  // Funding and financial signals
  funding: z.object({
    stage: z.string().optional(),          // "Series B"
    totalRaised: z.string().optional(),    // "$50M"
    lastRound: z.string().optional(),      // "$20M Series B, Jan 2026"
    investors: z.array(z.string()).default([]),
    signals: z.array(z.string()).default([]) // "Growing headcount", "Recent profitability"
  }),

  // Culture signals
  culture: z.object({
    values: z.array(z.string()).default([]),
    glassdoorThemes: z.array(z.string()).default([]),
    leadershipQuotes: z.array(z.object({
      quote: z.string(),
      speaker: z.string(),
      source: z.string().optional()
    })).default([]),
    workStyle: z.string().optional()       // "Remote-first", "Hybrid", "Fast-paced"
  }),

  // Recent news and challenges
  news: z.array(z.object({
    headline: z.string(),
    date: z.string().optional(),
    source: z.string().optional(),
    relevance: z.enum(['high', 'medium', 'low']).default('medium')
  })).default([]),

  challenges: z.array(z.string()).default([]),
  competitors: z.array(z.string()).default([]),

  // Products/services
  products: z.array(z.object({
    name: z.string(),
    description: z.string().optional()
  })).default([]),

  // Confidence and sources
  confidence: z.enum(['high', 'medium', 'low']),
  sources: z.array(z.string()).default([]),

  // Summary for quick reference
  highlights: z.array(z.string()).default([])
})

/**
 * Research a company deeply
 * APPL-08: Culture, news, funding, challenges
 */
export async function researchCompany(jobId, companyName) {
  // This function structures research that Claude performs via conversation
  // The actual research happens through Claude's web access/Perplexity

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

  // Return template for Claude to populate through conversation
  return {
    status: 'template_ready',
    research,
    instructions: `Research ${companyName} and populate the following:

1. **Firmographics**: Company size, industry, founded date, HQ, website
2. **Funding**: Stage, total raised, last round, key investors, financial signals
3. **Culture**: Core values, Glassdoor themes, leadership quotes on culture
4. **News**: Recent news (last 6 months), especially hiring, product, funding
5. **Challenges**: Industry challenges, company-specific challenges mentioned
6. **Competitors**: Main competitors in their space
7. **Products**: Key products/services

Use call updateCompanyResearch to save findings.`
  }
}

/**
 * Update company research with findings
 */
export function updateCompanyResearch(jobId, findings) {
  const researchPath = join(DATA_DIR, 'job-research', `${jobId}-company.json`)
  const markdownPath = join(DATA_DIR, 'job-research', `${jobId}-company.md`)

  // Validate findings
  const validation = CompanyResearchSchema.safeParse(findings)
  if (!validation.success) {
    return { error: 'Invalid research format', details: validation.error.issues }
  }

  // Save structured JSON
  atomicWriteSync(researchPath, JSON.stringify(validation.data, null, 2))

  // Generate and save markdown summary
  const markdown = generateCompanyMarkdown(validation.data)
  atomicWriteSync(markdownPath, markdown)

  // Update job with research reference
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)
  if (job) {
    job.companyResearch = {
      researchedAt: findings.researchedAt,
      highlights: findings.highlights.slice(0, 5),
      confidence: findings.confidence
    }
    writeJobsData(data)
  }

  return {
    success: true,
    saved: { json: researchPath, markdown: markdownPath },
    highlights: findings.highlights
  }
}

function generateCompanyMarkdown(research) {
  return `# ${research.companyName} - Company Research

**Researched:** ${research.researchedAt}
**Confidence:** ${research.confidence}

## Quick Highlights
${research.highlights.map(h => `- ${h}`).join('\n')}

## Firmographics
- **Size:** ${research.firmographics.size || 'Unknown'}
- **Industry:** ${research.firmographics.industry || 'Unknown'}
- **Founded:** ${research.firmographics.founded || 'Unknown'}
- **HQ:** ${research.firmographics.headquarters || 'Unknown'}
- **Website:** ${research.firmographics.website || 'Unknown'}

## Funding
- **Stage:** ${research.funding.stage || 'Unknown'}
- **Total Raised:** ${research.funding.totalRaised || 'Unknown'}
- **Last Round:** ${research.funding.lastRound || 'Unknown'}
- **Investors:** ${research.funding.investors.join(', ') || 'Unknown'}
${research.funding.signals.length > 0 ? `\n**Signals:**\n${research.funding.signals.map(s => `- ${s}`).join('\n')}` : ''}

## Culture
${research.culture.values.length > 0 ? `**Values:** ${research.culture.values.join(', ')}` : ''}
${research.culture.workStyle ? `**Work Style:** ${research.culture.workStyle}` : ''}
${research.culture.glassdoorThemes.length > 0 ? `\n**Glassdoor Themes:**\n${research.culture.glassdoorThemes.map(t => `- ${t}`).join('\n')}` : ''}
${research.culture.leadershipQuotes.length > 0 ? `\n**Leadership Quotes:**\n${research.culture.leadershipQuotes.map(q => `> "${q.quote}" - ${q.speaker}`).join('\n\n')}` : ''}

## Recent News
${research.news.length > 0 ? research.news.map(n => `- **${n.headline}** (${n.date || 'Recent'})`).join('\n') : 'No recent news found'}

## Challenges
${research.challenges.length > 0 ? research.challenges.map(c => `- ${c}`).join('\n') : 'None identified'}

## Competitors
${research.competitors.length > 0 ? research.competitors.join(', ') : 'None identified'}

## Sources
${research.sources.map(s => `- ${s}`).join('\n')}

---
*Research for Job ID: ${research.jobId}*
`
}
```

### Pattern 2: Hiring Manager Research (APPL-09)
**What:** Focus on style and connection - interview style signals, communication patterns, shared interests, talking points
**When to use:** User explicitly requests manager research for a job
**Example:**
```javascript
// Source: Existing contact.schema.js + APPL-09 requirements

export const HiringManagerResearchSchema = z.object({
  id: z.string().uuid(),
  jobId: z.number(),
  managerName: z.string(),
  researchedAt: z.string(),

  // Professional background (secondary priority per CONTEXT.md)
  background: z.object({
    currentRole: z.string().optional(),
    company: z.string().optional(),
    yearsInRole: z.number().optional(),
    previousRoles: z.array(z.string()).default([]),
    education: z.string().optional()
  }),

  // Style and connection (primary priority per CONTEXT.md)
  interviewStyle: z.object({
    signals: z.array(z.string()).default([]),    // From reviews, patterns
    communicationPattern: z.string().optional(),  // "Direct", "Collaborative"
    commonQuestions: z.array(z.string()).default([])
  }),

  linkedIn: z.object({
    url: z.string().url().optional(),
    activity: z.array(z.string()).default([]),   // Recent posts/engagement
    connections: z.number().optional()
  }),

  // Connection building
  sharedInterests: z.array(z.string()).default([]),
  mutualConnections: z.array(z.string()).default([]),
  talkingPoints: z.array(z.string()).default([]),

  confidence: z.enum(['high', 'medium', 'low']),
  sources: z.array(z.string()).default([])
})

/**
 * Research hiring manager
 * APPL-09: Focus on style and connection
 */
export async function researchHiringManager(jobId, managerName, companyName) {
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
1. Interview style signals (from Glassdoor reviews mentioning them, interview patterns)
2. Communication style (direct, collaborative, detail-oriented)
3. LinkedIn activity (recent posts, articles, engagement topics)
4. Shared interests (based on their content, groups, interests)
5. Mutual connections (scan for overlap with your network)
6. Talking points for rapport building

**Secondary (Background):**
7. Current role and time in position
8. Previous experience (brief)
9. Education (if relevant for connection)

Use call updateManagerResearch to save findings.`
  }
}
```

### Pattern 3: Resume Keyword Optimization (APPL-10)
**What:** Same resume structure, reorder/emphasize sections based on JD keywords
**When to use:** When generating resume for a specific job
**Example:**
```javascript
// Source: Existing profile-to-resume.js + APPL-10 requirements
import { extractJobKeywords } from './resume-matcher.js'

/**
 * Optimize resume for job keywords while preserving structure
 * APPL-10: Keyword optimization, not full rewrites
 */
export function optimizeResumeForJob(resumeData, jobDescription, research = null) {
  const keywords = extractJobKeywords(jobDescription)
  const optimizations = []

  // 1. Reorder skills to lead with matching keywords
  if (resumeData.skills) {
    const reorderedSkills = reorderSkillsByRelevance(resumeData.skills, keywords.skills)
    optimizations.push({
      section: 'skills',
      action: 'reordered',
      reason: 'Leading with job-relevant skills'
    })
    resumeData.skills = reorderedSkills
  }

  // 2. Emphasize matching experience bullets (move to top of each role)
  if (resumeData.experience) {
    for (const exp of resumeData.experience) {
      if (exp.bullets) {
        const scored = exp.bullets.map((bullet, idx) => ({
          bullet,
          originalIndex: idx,
          relevance: scoreTextRelevance(bullet, keywords.skills)
        }))
        scored.sort((a, b) => b.relevance - a.relevance)

        if (scored[0].originalIndex !== 0) {
          exp.bullets = scored.map(s => s.bullet)
          optimizations.push({
            section: `experience.${exp.company}`,
            action: 'reordered_bullets',
            reason: 'Most relevant bullets first'
          })
        }
      }
    }
  }

  // 3. Add keyword coverage analysis
  const coverage = analyzeKeywordCoverage(resumeData, keywords.skills)

  // 4. Integrate research highlights if available
  let researchIntegration = null
  if (research?.highlights) {
    researchIntegration = {
      available: true,
      suggested: `Consider mentioning: ${research.highlights[0]}`
    }
  }

  return {
    optimizedData: resumeData,
    optimizations,
    keywordCoverage: coverage,
    researchIntegration,
    summary: `${optimizations.length} optimizations applied, ${coverage.matched}/${coverage.total} keywords covered`
  }
}

function reorderSkillsByRelevance(skills, targetKeywords) {
  // Handle both grouped (object) and flat (array) skill formats
  if (typeof skills === 'object' && !Array.isArray(skills)) {
    // Grouped format: { "Technical": ["React", "Node"], "Design": ["Figma"] }
    const result = {}
    const targetSet = new Set(targetKeywords.map(k => k.toLowerCase()))

    // Reorder within each category
    for (const [category, skillList] of Object.entries(skills)) {
      const scored = skillList.map(skill => ({
        skill,
        matches: targetSet.has(skill.toLowerCase()) ? 1 : 0
      }))
      scored.sort((a, b) => b.matches - a.matches)
      result[category] = scored.map(s => s.skill)
    }
    return result
  }

  // Flat array format
  const targetSet = new Set(targetKeywords.map(k => k.toLowerCase()))
  return [...skills].sort((a, b) => {
    const aMatches = targetSet.has(a.name?.toLowerCase() || a.toLowerCase())
    const bMatches = targetSet.has(b.name?.toLowerCase() || b.toLowerCase())
    return bMatches - aMatches
  })
}

function scoreTextRelevance(text, keywords) {
  const textLower = text.toLowerCase()
  return keywords.filter(k => textLower.includes(k.toLowerCase())).length
}

function analyzeKeywordCoverage(resumeData, keywords) {
  const resumeText = JSON.stringify(resumeData).toLowerCase()
  const matched = keywords.filter(k => resumeText.includes(k.toLowerCase()))
  const missing = keywords.filter(k => !resumeText.includes(k.toLowerCase()))

  return {
    total: keywords.length,
    matched: matched.length,
    missing: missing.length,
    matchedKeywords: matched,
    missingKeywords: missing,
    coveragePercent: keywords.length > 0
      ? Math.round((matched.length / keywords.length) * 100)
      : 100
  }
}
```

### Pattern 4: Document Review Service (APPL-12)
**What:** Grammar, spelling, ATS compatibility, keyword coverage, tone, length, factual accuracy
**When to use:** Before marking any generated document as ready to use
**Example:**
```javascript
// Source: APPL-12 requirements + LanguageTool API

export const DocumentReviewSchema = z.object({
  id: z.string().uuid(),
  documentType: z.enum(['resume', 'cover_letter', 'email']),
  reviewedAt: z.string(),

  // Grammar and spelling (via LanguageTool)
  grammar: z.object({
    issues: z.array(z.object({
      type: z.enum(['spelling', 'grammar', 'style', 'punctuation']),
      message: z.string(),
      context: z.string(),
      offset: z.number(),
      length: z.number(),
      suggestions: z.array(z.string()),
      severity: z.enum(['error', 'warning', 'info'])
    })),
    score: z.number().min(0).max(100)
  }),

  // ATS compatibility
  ats: z.object({
    score: z.number().min(0).max(100),
    issues: z.array(z.object({
      type: z.string(),
      message: z.string(),
      severity: z.enum(['error', 'warning', 'info'])
    })),
    keywordCoverage: z.number().min(0).max(100)
  }),

  // Tone consistency
  tone: z.object({
    detected: z.string(),
    consistent: z.boolean(),
    issues: z.array(z.string())
  }),

  // Length validation
  length: z.object({
    wordCount: z.number(),
    charCount: z.number(),
    withinLimits: z.boolean(),
    pageEstimate: z.number()
  }),

  // Factual accuracy (against profile)
  factual: z.object({
    verified: z.array(z.string()),
    unverified: z.array(z.string()),
    conflicts: z.array(z.object({
      claim: z.string(),
      profileValue: z.string(),
      issue: z.string()
    }))
  }),

  // Overall assessment
  overallScore: z.number().min(0).max(100),
  readyToUse: z.boolean(),
  blockers: z.array(z.string())
})

const LANGUAGETOOL_API = 'https://api.languagetool.org/v2/check'

/**
 * Check grammar using LanguageTool API
 */
async function checkGrammar(text, language = 'en-US') {
  try {
    const response = await fetch(LANGUAGETOOL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        text,
        language,
        enabledOnly: 'false'
      })
    })

    if (!response.ok) {
      throw new Error(`LanguageTool API error: ${response.status}`)
    }

    const result = await response.json()

    const issues = result.matches.map(match => ({
      type: categorizeIssue(match.rule.category.id),
      message: match.message,
      context: match.context.text,
      offset: match.offset,
      length: match.length,
      suggestions: match.replacements.slice(0, 3).map(r => r.value),
      severity: match.rule.issueType === 'misspelling' ? 'error' : 'warning'
    }))

    // Calculate grammar score (100 - deductions for issues)
    const deduction = issues.reduce((sum, issue) => {
      return sum + (issue.severity === 'error' ? 5 : 2)
    }, 0)
    const score = Math.max(0, 100 - deduction)

    return { issues, score }
  } catch (error) {
    console.error('Grammar check failed:', error.message)
    return {
      issues: [],
      score: null,
      error: error.message
    }
  }
}

function categorizeIssue(categoryId) {
  const mapping = {
    'TYPOS': 'spelling',
    'GRAMMAR': 'grammar',
    'STYLE': 'style',
    'PUNCTUATION': 'punctuation'
  }
  return mapping[categoryId] || 'grammar'
}

/**
 * Check ATS compatibility
 */
function checkATSCompatibility(text, keywords = []) {
  const issues = []
  let score = 100

  // Check for ATS-unfriendly patterns
  const atsChecks = [
    { pattern: /[^\x00-\x7F]/g, message: 'Contains non-ASCII characters', deduction: 5 },
    { pattern: /<[^>]+>/g, message: 'Contains HTML tags', deduction: 10 },
    { pattern: /\t/g, message: 'Contains tab characters (use spaces)', deduction: 3 },
    { pattern: /[|]/g, message: 'Contains pipe characters (may cause parsing issues)', deduction: 2 }
  ]

  for (const check of atsChecks) {
    if (check.pattern.test(text)) {
      issues.push({
        type: 'formatting',
        message: check.message,
        severity: check.deduction > 5 ? 'error' : 'warning'
      })
      score -= check.deduction
    }
  }

  // Check keyword coverage
  const textLower = text.toLowerCase()
  const matchedKeywords = keywords.filter(k => textLower.includes(k.toLowerCase()))
  const keywordCoverage = keywords.length > 0
    ? Math.round((matchedKeywords.length / keywords.length) * 100)
    : 100

  if (keywordCoverage < 50) {
    issues.push({
      type: 'keywords',
      message: `Low keyword coverage (${keywordCoverage}%). Consider adding more relevant terms.`,
      severity: 'warning'
    })
    score -= 10
  }

  return {
    score: Math.max(0, score),
    issues,
    keywordCoverage
  }
}

/**
 * Check factual accuracy against profile
 */
function checkFactualAccuracy(text, profile) {
  const verified = []
  const unverified = []
  const conflicts = []

  // Extract claims from text (dates, companies, percentages)
  const datePattern = /\b(19|20)\d{2}\b/g
  const percentPattern = /\b\d+%|\b\d+\s*percent/gi
  const companyPattern = /(?:at|for|with)\s+([A-Z][A-Za-z\s]+(?:Inc|LLC|Corp)?)/g

  // Verify dates against experience
  const experienceDates = (profile.experience || []).flatMap(exp => {
    const dates = []
    if (exp.role?.startDate) dates.push(exp.role.startDate.substring(0, 4))
    if (exp.role?.endDate) dates.push(exp.role.endDate.substring(0, 4))
    return dates
  })

  const textDates = text.match(datePattern) || []
  for (const date of textDates) {
    if (experienceDates.includes(date)) {
      verified.push(`Date ${date} matches profile`)
    } else {
      unverified.push(`Date ${date} not found in profile`)
    }
  }

  // Verify companies
  const profileCompanies = (profile.experience || [])
    .map(exp => exp.role?.company?.toLowerCase())
    .filter(Boolean)

  let match
  while ((match = companyPattern.exec(text)) !== null) {
    const company = match[1].trim().toLowerCase()
    if (profileCompanies.some(pc => pc.includes(company) || company.includes(pc))) {
      verified.push(`Company "${match[1].trim()}" found in profile`)
    }
  }

  return { verified, unverified, conflicts }
}

/**
 * Full document review
 * APPL-12: Grammar, ATS, tone, length, factual accuracy
 */
export async function reviewDocument(documentType, content, jobDescription, profile) {
  const keywords = extractJobKeywords(jobDescription).skills

  // Run all checks
  const grammar = await checkGrammar(content)
  const ats = checkATSCompatibility(content, keywords)
  const factual = checkFactualAccuracy(content, profile)

  // Analyze tone (basic heuristic)
  const tone = analyzeTone(content, profile.preferences?.communication)

  // Length check
  const wordCount = content.split(/\s+/).length
  const charCount = content.length
  const limits = documentType === 'resume'
    ? { minWords: 200, maxWords: 700, maxPages: 2 }
    : { minWords: 150, maxWords: 400, maxPages: 1 }

  const length = {
    wordCount,
    charCount,
    withinLimits: wordCount >= limits.minWords && wordCount <= limits.maxWords,
    pageEstimate: Math.ceil(charCount / 3500)
  }

  // Calculate overall score
  const scores = [
    grammar.score || 80,  // Default if API failed
    ats.score,
    tone.consistent ? 90 : 70,
    length.withinLimits ? 100 : 70
  ]
  const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

  // Determine blockers
  const blockers = []
  if (grammar.issues.filter(i => i.severity === 'error').length > 3) {
    blockers.push('Too many grammar errors')
  }
  if (ats.score < 70) {
    blockers.push('ATS compatibility issues')
  }
  if (factual.conflicts.length > 0) {
    blockers.push('Factual conflicts with profile')
  }

  return {
    id: uuidv4(),
    documentType,
    reviewedAt: new Date().toISOString(),
    grammar,
    ats,
    tone,
    length,
    factual,
    overallScore,
    readyToUse: blockers.length === 0 && overallScore >= 75,
    blockers
  }
}

function analyzeTone(text, communicationPrefs) {
  // Basic tone detection using keyword patterns
  const formalIndicators = /\b(hereby|pursuant|furthermore|moreover|accordingly)\b/gi
  const casualIndicators = /\b(awesome|cool|stuff|guys|gonna|kinda)\b/gi

  const formalCount = (text.match(formalIndicators) || []).length
  const casualCount = (text.match(casualIndicators) || []).length

  const detected = casualCount > formalCount ? 'casual' :
                   formalCount > casualCount ? 'formal' : 'balanced'

  const targetTone = communicationPrefs?.tone || 'conversational'
  const consistent =
    (targetTone === 'formal' && detected !== 'casual') ||
    (targetTone === 'conversational' && detected !== 'formal') ||
    (targetTone === 'direct' && formalCount < 3)

  return {
    detected,
    consistent,
    issues: consistent ? [] : [`Tone detected as ${detected}, profile prefers ${targetTone}`]
  }
}
```

### Pattern 5: Research Persistence (APPL-14)
**What:** Store research per job in both JSON (programmatic) and markdown (human-readable)
**When to use:** After completing research, for reference in later communications
**Example:**
```javascript
// Source: Existing atomic write pattern + APPL-14 requirements
import { existsSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'

const RESEARCH_DIR = join(DATA_DIR, 'job-research')

// Ensure research directory exists
if (!existsSync(RESEARCH_DIR)) {
  mkdirSync(RESEARCH_DIR, { recursive: true })
}

/**
 * Get research for a job
 * APPL-14: Returns persisted research
 */
export function getJobResearch(jobId, type = 'all') {
  const result = {
    jobId,
    company: null,
    manager: null,
    hasResearch: false
  }

  // Load company research
  if (type === 'all' || type === 'company') {
    const companyPath = join(RESEARCH_DIR, `${jobId}-company.json`)
    if (existsSync(companyPath)) {
      try {
        result.company = JSON.parse(readFileSync(companyPath, 'utf-8'))
        result.hasResearch = true
      } catch (e) {
        console.error(`Error loading company research for job ${jobId}:`, e.message)
      }
    }
  }

  // Load manager research
  if (type === 'all' || type === 'manager') {
    const managerPath = join(RESEARCH_DIR, `${jobId}-manager.json`)
    if (existsSync(managerPath)) {
      try {
        result.manager = JSON.parse(readFileSync(managerPath, 'utf-8'))
        result.hasResearch = true
      } catch (e) {
        console.error(`Error loading manager research for job ${jobId}:`, e.message)
      }
    }
  }

  return result
}

/**
 * Get research highlights for a job (for surfacing in conversation)
 * Per CONTEXT.md: Only show highlights, full research on request
 */
export function getResearchHighlights(jobId) {
  const research = getJobResearch(jobId)

  if (!research.hasResearch) {
    return null
  }

  const highlights = []

  if (research.company) {
    highlights.push(...(research.company.highlights || []).slice(0, 3))
    if (research.company.funding?.stage) {
      highlights.push(`Funding: ${research.company.funding.stage}`)
    }
    if (research.company.culture?.workStyle) {
      highlights.push(`Culture: ${research.company.culture.workStyle}`)
    }
  }

  if (research.manager) {
    if (research.manager.talkingPoints?.length > 0) {
      highlights.push(`Talking point: ${research.manager.talkingPoints[0]}`)
    }
  }

  return {
    jobId,
    highlights: highlights.slice(0, 5),
    fullResearchAvailable: true,
    lastUpdated: research.company?.researchedAt || research.manager?.researchedAt
  }
}

/**
 * Check if company research exists and offer reuse
 * Per CONTEXT.md: Prompt for reuse when same company
 */
export function checkForExistingCompanyResearch(companyName) {
  const files = readdirSync(RESEARCH_DIR)
  const companyFiles = files.filter(f => f.endsWith('-company.json'))

  for (const file of companyFiles) {
    try {
      const research = JSON.parse(readFileSync(join(RESEARCH_DIR, file), 'utf-8'))
      if (research.companyName?.toLowerCase() === companyName.toLowerCase()) {
        const jobId = file.replace('-company.json', '')
        const daysSince = Math.floor(
          (Date.now() - new Date(research.researchedAt).getTime()) / (1000 * 60 * 60 * 24)
        )

        return {
          found: true,
          existingJobId: parseInt(jobId),
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
```

### Anti-Patterns to Avoid
- **Auto-triggering research:** Per CONTEXT.md, research is on-demand only. Never auto-research on job confirmation or before generation.
- **Full resume rewrites per job:** CONTEXT.md specifies "keyword optimization, same structure preserved." Don't restructure entire resume.
- **Auto-sending documents:** Always require explicit user approval before marking document "ready to use."
- **External ML for keyword extraction:** Use existing regex patterns from resume-matcher.js. No TensorFlow or external NLP.
- **Ignoring existing company research:** Check for and offer to reuse existing research when researching a new job at same company.
- **Showing full research by default:** Only surface highlights; full research on explicit request.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Grammar checking | Custom regex rules | LanguageTool API | 2,000+ rules for English, context-aware |
| Company research aggregation | Custom web scrapers | Claude/Perplexity MCP | Already connected, handles multi-source |
| Keyword extraction | Custom NLP | Existing resume-matcher.js | Already has skill patterns by category |
| Atomic file writes | Manual temp/rename | Existing atomicWriteSync | Already in loader.js |
| Date calculations | Custom math | date-fns | Already installed, handles edge cases |
| Schema validation | Manual type checks | Zod schemas | Already used throughout codebase |

**Key insight:** Phase 7 leverages Claude's conversation capabilities for research rather than building custom scraping infrastructure. The heavy lifting happens through dialogue, not code.

## Common Pitfalls

### Pitfall 1: Building Custom Web Scrapers
**What goes wrong:** Attempting to scrape Glassdoor, LinkedIn, Crunchbase directly
**Why it happens:** Seems like the "proper" way to get structured data
**How to avoid:** Use Claude/Perplexity's existing web access through conversation; structure the output
**Warning signs:** Adding puppeteer for new scraping, handling CAPTCHAs, rate limiting

### Pitfall 2: Auto-Triggering Research
**What goes wrong:** Research runs automatically when job is confirmed or before generation
**Why it happens:** Seems helpful to pre-cache data
**How to avoid:** Per CONTEXT.md decision: research is on-demand only. Add explicit MCP tools for triggering.
**Warning signs:** `onJobConfirmed` hooks, automatic research calls in generation

### Pitfall 3: Over-Customizing Resumes
**What goes wrong:** Completely rewriting resume content per job
**Why it happens:** Desire for maximum relevance
**How to avoid:** CONTEXT.md decision: "keyword optimization, same structure preserved." Reorder and emphasize, don't rewrite.
**Warning signs:** Generating new bullet points, changing job descriptions

### Pitfall 4: Skipping User Approval
**What goes wrong:** Documents marked "ready" without explicit user review
**Why it happens:** Automation seems efficient
**How to avoid:** CONTEXT.md decision: "Explicit approval required." Always return review results, require confirmation.
**Warning signs:** Auto-saving to "ready" status, no approval flag check

### Pitfall 5: Ignoring Existing Research
**What goes wrong:** Re-researching companies already in the system
**Why it happens:** No check for existing data
**How to avoid:** Check for existing company research before starting. Offer to reuse with user confirmation.
**Warning signs:** Duplicate research files, redundant queries

### Pitfall 6: Surfacing Full Research Automatically
**What goes wrong:** Overwhelming user with all research details
**Why it happens:** All data seems useful
**How to avoid:** Per CONTEXT.md: "Highlights only shown when discussing a job, full research on request."
**Warning signs:** Long research dumps in every job discussion

## Code Examples

Verified patterns from existing codebase:

### MCP Tool: Research Company
```javascript
// File: mcp-server/src/tools/research.js

import { researchCompany, updateCompanyResearch, checkForExistingCompanyResearch } from '../services/company-research.js'
import { researchHiringManager, updateManagerResearch } from '../services/manager-research.js'
import { getJobResearch, getResearchHighlights } from '../services/research-persistence.js'
import { loadJobsFromDashboard } from '../data/loader.js'

/**
 * Start deep company research
 * APPL-08: Culture, news, funding, challenges
 */
export async function startCompanyResearch({ jobId }) {
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job ${jobId} not found` }
  }

  // Check for existing research
  const existing = checkForExistingCompanyResearch(job.company)
  if (existing.found) {
    return {
      status: 'existing_research_found',
      existing,
      options: [
        { action: 'reuse', description: 'Use existing research as-is' },
        { action: 'refresh', description: 'Start fresh research' },
        { action: 'copy_and_update', description: 'Copy existing and update specific sections' }
      ],
      suggestion: existing.suggestion
    }
  }

  // Start new research
  return researchCompany(jobId, job.company)
}

/**
 * Save company research findings
 */
export function saveCompanyResearch({ jobId, findings }) {
  return updateCompanyResearch(jobId, findings)
}

/**
 * Start hiring manager research
 * APPL-09: Focus on style and connection
 */
export async function startManagerResearch({ jobId, managerName }) {
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job ${jobId} not found` }
  }

  // Use provided name or try to get from job's hiringManager field
  const name = managerName || job.hiringManager
  if (!name) {
    return {
      error: 'Hiring manager name required',
      suggestion: 'Set hiring manager first using set_hiring_manager tool'
    }
  }

  return researchHiringManager(jobId, name, job.company)
}

/**
 * Get research for a job
 * APPL-14: Research outputs persist per job
 */
export function getResearch({ jobId, type = 'highlights' }) {
  if (type === 'highlights') {
    const highlights = getResearchHighlights(jobId)
    if (!highlights) {
      return {
        jobId,
        hasResearch: false,
        message: 'No research available. Use start_company_research or start_manager_research.'
      }
    }
    return highlights
  }

  // Full research requested
  return getJobResearch(jobId, type === 'company' ? 'company' : type === 'manager' ? 'manager' : 'all')
}
```

### MCP Tool: Generate with Research
```javascript
// File: mcp-server/src/tools/generation.js (extend existing documents.js)

import { buildResumeFromProfile } from '../services/profile-to-resume.js'
import { optimizeResumeForJob } from '../services/keyword-optimizer.js'
import { getJobResearch } from '../services/research-persistence.js'
import { loadProfile } from '../data/profile-loader.js'
import { loadJobsFromDashboard } from '../data/loader.js'

/**
 * Generate resume with keyword optimization
 * APPL-10: Uses profile + job research + playbook
 */
export function generateOptimizedResume({ jobId, includeResearchReferences = false }) {
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job ${jobId} not found` }
  }

  const profile = loadProfile()
  const jobDescription = job.notes || job.description || ''

  if (!jobDescription) {
    return {
      error: 'No job description available',
      suggestion: 'Add job description to notes field first'
    }
  }

  // Get research if available
  const research = getJobResearch(jobId, 'company')

  // Build base resume
  const jobContext = {
    company: job.company,
    title: job.title,
    audience: 'technical',
    keywords: []
  }
  const baseResume = buildResumeFromProfile(profile, jobContext)

  // Optimize for job keywords
  const optimized = optimizeResumeForJob(baseResume, jobDescription, research.company)

  return {
    status: 'optimized',
    jobId,
    company: job.company,
    title: job.title,
    optimization: {
      changes: optimized.optimizations,
      keywordCoverage: optimized.keywordCoverage,
      summary: optimized.summary
    },
    researchUsed: research.hasResearch,
    resumeData: optimized.optimizedData,
    nextStep: 'Call review_document to check before finalizing'
  }
}

/**
 * Generate cover letter with research integration
 * APPL-11: Uses profile + job research + structure
 */
export function generateResearchedCoverLetter({
  jobId,
  includeCompanyReferences = true,
  toneVariation = null
}) {
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job ${jobId} not found` }
  }

  const profile = loadProfile()
  const research = getJobResearch(jobId)

  // Get tone from profile or override
  const tone = toneVariation || profile.preferences?.communication?.tone || 'conversational'

  // Build cover letter structure (per CONTEXT.md: fixed structure, fresh content)
  const coverLetter = {
    opening: generateOpening(job, research.company, tone),
    body: generateBody(profile, job, research, tone),
    closing: generateClosing(job, tone),
    includesCompanyReferences: includeCompanyReferences && research.hasResearch
  }

  // If user wants version without company references
  if (!includeCompanyReferences) {
    coverLetter.body = removeCompanyReferences(coverLetter.body)
    coverLetter.opening = removeCompanyReferences(coverLetter.opening)
  }

  return {
    status: 'generated',
    jobId,
    company: job.company,
    title: job.title,
    coverLetter,
    researchUsed: research.hasResearch,
    toneApplied: tone,
    nextStep: 'Call review_document to check before finalizing'
  }
}

// Helper functions for cover letter generation
function generateOpening(job, companyResearch, tone) {
  // Return template with placeholders that Claude fills via conversation
  return {
    template: true,
    tone,
    context: {
      company: job.company,
      title: job.title,
      companyHighlights: companyResearch?.highlights || []
    },
    instruction: 'Generate opening paragraph expressing enthusiasm for the role and company'
  }
}

function generateBody(profile, job, research, tone) {
  // Structure: 2-3 paragraphs covering experience match, key achievement, cultural fit
  return {
    template: true,
    tone,
    sections: [
      { type: 'experience_match', instruction: 'Connect profile experience to job requirements' },
      { type: 'key_achievement', instruction: 'Highlight most relevant achievement with metrics' },
      { type: 'cultural_fit', instruction: 'Connect to company culture using research' }
    ],
    context: {
      experience: profile.experience?.slice(0, 3),
      stories: profile.stories?.slice(0, 2),
      companyResearch: research.company,
      managerResearch: research.manager
    }
  }
}

function generateClosing(job, tone) {
  return {
    template: true,
    tone,
    instruction: 'Generate closing with clear call to action'
  }
}

function removeCompanyReferences(section) {
  // Mark for generic version generation
  return { ...section, genericVersion: true }
}
```

### MCP Tool: Email Response Generation
```javascript
// File: mcp-server/src/tools/generation.js (continued)

/**
 * Generate email response with tone variations
 * APPL-13: References job research + hiring manager intel + profile
 */
export function generateEmailResponse({
  jobId,
  emailType,  // 'followup', 'thank_you', 'inquiry', 'response'
  context,    // Additional context about the email
  toneCount = 3
}) {
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job ${jobId} not found` }
  }

  const profile = loadProfile()
  const research = getJobResearch(jobId)

  // Define tone variations
  const tones = ['professional', 'warm', 'direct'].slice(0, toneCount)

  const variations = tones.map(tone => ({
    tone,
    template: true,
    emailType,
    context: {
      job: {
        company: job.company,
        title: job.title,
        status: job.status,
        contacts: job.connections?.filter(c => typeof c === 'object') || []
      },
      research: {
        companyHighlights: research.company?.highlights || [],
        managerTalkingPoints: research.manager?.talkingPoints || []
      },
      profile: {
        name: profile.metadata?.name,
        communicationPrefs: profile.preferences?.communication
      },
      additionalContext: context
    },
    instruction: getEmailInstruction(emailType, tone)
  }))

  return {
    status: 'variations_ready',
    jobId,
    company: job.company,
    emailType,
    variations,
    note: 'Review variations, select one, edit as needed',
    nextStep: 'User selects and edits preferred variation'
  }
}

function getEmailInstruction(emailType, tone) {
  const instructions = {
    followup: `Generate a ${tone} follow-up email checking on application status`,
    thank_you: `Generate a ${tone} thank-you email after interview`,
    inquiry: `Generate a ${tone} inquiry email asking about the role`,
    response: `Generate a ${tone} response to recruiter outreach`
  }
  return instructions[emailType] || `Generate a ${tone} email`
}
```

### MCP Tool: Document Review
```javascript
// File: mcp-server/src/tools/review.js

import { reviewDocument } from '../services/document-review.js'
import { loadProfile } from '../data/profile-loader.js'
import { loadJobsFromDashboard } from '../data/loader.js'

/**
 * Review document before use
 * APPL-12: Grammar, ATS, tone, length, factual accuracy
 */
export async function reviewGeneratedDocument({
  documentType,  // 'resume', 'cover_letter', 'email'
  content,
  jobId
}) {
  const profile = loadProfile()

  let jobDescription = ''
  if (jobId) {
    const data = loadJobsFromDashboard()
    const job = data.jobs.find(j => j.id === jobId)
    if (job) {
      jobDescription = job.notes || job.description || ''
    }
  }

  const review = await reviewDocument(documentType, content, jobDescription, profile)

  // Format issues for user review (per CONTEXT.md: flag + suggest)
  const issuesSummary = {
    grammar: formatIssuesForReview(review.grammar.issues, 'grammar'),
    ats: formatIssuesForReview(review.ats.issues, 'ats'),
    tone: review.tone.issues.map(i => ({ type: 'tone', message: i, severity: 'warning' })),
    factual: review.factual.conflicts.map(c => ({
      type: 'factual',
      message: c.issue,
      severity: 'error',
      details: { claim: c.claim, profileValue: c.profileValue }
    }))
  }

  return {
    reviewId: review.id,
    documentType,
    scores: {
      grammar: review.grammar.score,
      ats: review.ats.score,
      keywordCoverage: review.ats.keywordCoverage,
      overall: review.overallScore
    },
    length: review.length,
    issues: issuesSummary,
    totalIssues: countAllIssues(issuesSummary),
    readyToUse: review.readyToUse,
    blockers: review.blockers,
    nextStep: review.readyToUse
      ? 'Document ready. Call approve_document to mark as ready for use.'
      : 'Review issues and make corrections. Call review_generated_document again after edits.'
  }
}

function formatIssuesForReview(issues, type) {
  return issues.map(issue => ({
    type,
    message: issue.message,
    severity: issue.severity,
    context: issue.context,
    suggestions: issue.suggestions || []
  }))
}

function countAllIssues(issuesSummary) {
  return Object.values(issuesSummary).reduce((sum, arr) => sum + arr.length, 0)
}

/**
 * Approve document for use
 * APPL-12: Explicit approval required before marking ready
 */
export function approveDocument({ documentType, jobId, documentPath = null }) {
  // This marks the document as approved in job history
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job ${jobId} not found` }
  }

  // Add approval to job updates
  if (!job.updates) job.updates = []
  job.updates.push({
    date: new Date().toISOString().split('T')[0],
    type: 'Document Approved',
    notes: `${documentType} approved for use${documentPath ? `: ${documentPath}` : ''}`
  })

  writeJobsData(data)

  return {
    success: true,
    jobId,
    documentType,
    approvedAt: new Date().toISOString(),
    status: 'ready_to_use'
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual company research | Structured research via Claude/Perplexity | Phase 7 | Consistent, persisted research |
| Generic resume per company | Keyword-optimized resume | Phase 7 | Better ATS performance |
| Manual grammar review | Automated LanguageTool check | Phase 7 | Consistent quality checks |
| Research lost after conversation | Per-job research persistence | Phase 7 | Reference in later communications |
| Single cover letter approach | Research-integrated with structure | Phase 7 | More personalized content |

**Deprecated/outdated:**
- Manual research note-taking: Now captured in structured JSON + markdown
- Generic cover letter templates: Now uses fixed structure with fresh, researched content
- Manual keyword insertion: Now automated with coverage tracking

## Open Questions

Things that couldn't be fully resolved:

1. **LanguageTool Rate Limits**
   - What we know: Free API is 20 requests/minute per IP
   - What's unclear: Whether this is sufficient for batch document reviews
   - Recommendation: Start with free tier; add local LanguageTool server if limits become issue

2. **Research Depth vs Time**
   - What we know: CONTEXT.md says "20+ min equivalent effort"
   - What's unclear: How to balance thoroughness with user patience
   - Recommendation: Return partial results quickly, offer "deep dive" option for more

3. **Cover Letter Section Lengths**
   - What we know: Total should be 250-400 words per best practices
   - What's unclear: Optimal split between opener, body, closing
   - Recommendation: Start with 50/250/50 word targets, adjust based on feedback

4. **Research Source Conflicts**
   - What we know: Different sources may have conflicting info
   - What's unclear: How to present conflicts to user
   - Claude's discretion per CONTEXT.md: Flag conflicts, note confidence levels

## Sources

### Primary (HIGH confidence)
- Existing codebase: `mcp-server/src/services/profile-to-resume.js` - Document generation patterns
- Existing codebase: `mcp-server/src/services/resume-matcher.js` - Keyword extraction patterns
- Existing codebase: `mcp-server/src/tools/documents.js` - Generation tool patterns
- CONTEXT.md decisions - User-locked implementation choices
- Requirements APPL-08 through APPL-14 - Feature specifications

### Secondary (MEDIUM confidence)
- [LanguageTool API Documentation](https://languagetool.org/http-api/) - Grammar checking API
- [Perplexity Deep Research](https://www.perplexity.ai/hub/blog/introducing-perplexity-deep-research) - Research capabilities
- WebSearch: Cover letter best practices 2026 - Structure guidelines

### Tertiary (LOW confidence)
- WebSearch: ATS keyword optimization 2026 - Industry conventions
- WebSearch: Company research tools 2026 - Source landscape

## Metadata

**Confidence breakdown:**
- Company research schema: HIGH - Clear requirements, extends existing patterns
- Hiring manager research: HIGH - Clear requirements, similar to company research
- Resume keyword optimization: HIGH - Extends existing resume-matcher.js
- Document review: MEDIUM - LanguageTool API is straightforward, factual accuracy is heuristic
- Cover letter generation: MEDIUM - Structure clear, content generation relies on Claude
- Email generation: MEDIUM - Pattern clear, tone variations straightforward
- Research persistence: HIGH - Extends existing atomic write patterns

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable domain, extends existing patterns)
