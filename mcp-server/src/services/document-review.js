/**
 * Document Review Service - Grammar, ATS, tone, and factual accuracy checks
 *
 * Provides comprehensive document review before use:
 * - Grammar checking via LanguageTool API
 * - ATS compatibility analysis
 * - Tone consistency with profile preferences
 * - Factual accuracy verification against profile
 *
 * APPL-12: Full review (grammar, spelling, ATS compatibility, JD keyword coverage,
 * tone consistency, length limits, factual accuracy against profile)
 */

import { v4 as uuidv4 } from 'uuid'
import { extractJobKeywords } from './resume-matcher.js'

const LANGUAGETOOL_API = 'https://api.languagetool.org/v2/check'

/**
 * Map LanguageTool category to issue type
 *
 * @param {string} categoryId - LanguageTool category ID
 * @returns {string} Issue type
 */
function categorizeIssue(categoryId) {
  const mapping = {
    'TYPOS': 'spelling',
    'GRAMMAR': 'grammar',
    'STYLE': 'style',
    'PUNCTUATION': 'punctuation',
    'TYPOGRAPHY': 'style',
    'REDUNDANCY': 'style',
    'MISC': 'grammar',
    'CASING': 'grammar'
  }
  return mapping[categoryId] || 'grammar'
}

/**
 * Check grammar using LanguageTool API
 *
 * @param {string} text - Text to check
 * @param {string} language - Language code (default: 'en-US')
 * @returns {Promise<{ issues: Array, score: number|null, error?: string }>}
 */
export async function checkGrammar(text, language = 'en-US') {
  if (!text || typeof text !== 'string') {
    return { issues: [], score: 100 }
  }

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
      type: categorizeIssue(match.rule?.category?.id || 'GRAMMAR'),
      message: match.message,
      context: match.context?.text || '',
      offset: match.offset,
      length: match.length,
      suggestions: (match.replacements || []).slice(0, 3).map(r => r.value),
      severity: match.rule?.issueType === 'misspelling' ? 'error' : 'warning'
    }))

    // Calculate grammar score (100 - deductions for issues)
    // 5 points per error, 2 points per warning
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

/**
 * Check ATS compatibility
 *
 * @param {string} text - Text to check
 * @param {string[]} keywords - Expected keywords from job description
 * @returns {{ score: number, issues: Array, keywordCoverage: number }}
 */
export function checkATSCompatibility(text, keywords = []) {
  if (!text || typeof text !== 'string') {
    return { score: 100, issues: [], keywordCoverage: 100 }
  }

  const issues = []
  let score = 100

  // ATS-unfriendly pattern checks
  const atsChecks = [
    {
      pattern: /[^\x00-\x7F]/g,
      message: 'Contains non-ASCII characters',
      deduction: 5,
      type: 'ats'
    },
    {
      pattern: /<[^>]+>/g,
      message: 'Contains HTML tags',
      deduction: 10,
      type: 'ats'
    },
    {
      pattern: /\t/g,
      message: 'Contains tab characters (use spaces instead)',
      deduction: 3,
      type: 'ats'
    },
    {
      pattern: /[|]/g,
      message: 'Contains pipe characters (may cause parsing issues)',
      deduction: 2,
      type: 'ats'
    }
  ]

  for (const check of atsChecks) {
    if (check.pattern.test(text)) {
      issues.push({
        type: check.type,
        message: check.message,
        severity: check.deduction > 5 ? 'error' : 'warning',
        suggestions: []
      })
      score -= check.deduction
    }
  }

  // Check keyword coverage
  const textLower = text.toLowerCase()
  const matchedKeywords = keywords.filter(k =>
    textLower.includes(k.toLowerCase())
  )
  const keywordCoverage = keywords.length > 0
    ? Math.round((matchedKeywords.length / keywords.length) * 100)
    : 100

  if (keywordCoverage < 50 && keywords.length > 0) {
    issues.push({
      type: 'ats',
      message: `Low keyword coverage (${keywordCoverage}%). Consider adding more relevant terms.`,
      severity: 'warning',
      suggestions: keywords.filter(k => !textLower.includes(k.toLowerCase())).slice(0, 5)
    })
  }

  return {
    score: Math.max(0, score),
    issues,
    keywordCoverage
  }
}

/**
 * Check factual accuracy against profile
 *
 * @param {string} text - Document text
 * @param {object} profile - User profile data
 * @returns {{ verified: string[], unverified: string[], conflicts: Array }}
 */
export function checkFactualAccuracy(text, profile) {
  if (!text || typeof text !== 'string') {
    return { verified: [], unverified: [], conflicts: [] }
  }

  const verified = []
  const unverified = []
  const conflicts = []

  // Extract dates from text
  const datePattern = /\b(19|20)\d{2}\b/g
  const textDates = text.match(datePattern) || []

  // Get profile experience dates
  const experienceDates = (profile?.experience || []).flatMap(exp => {
    const dates = []
    if (exp.role?.startDate) {
      dates.push(exp.role.startDate.substring(0, 4))
    }
    if (exp.role?.endDate) {
      dates.push(exp.role.endDate.substring(0, 4))
    }
    return dates
  })

  // Verify dates
  for (const date of textDates) {
    if (experienceDates.includes(date)) {
      verified.push(`Date ${date} matches profile`)
    } else {
      unverified.push(`Date ${date} not found in profile`)
    }
  }

  // Extract company names from text
  const companyPattern = /(?:at|for|with)\s+([A-Z][A-Za-z\s]+)/g
  const profileCompanies = (profile?.experience || [])
    .map(exp => exp.role?.company?.toLowerCase())
    .filter(Boolean)

  let match
  const companyRegex = new RegExp(companyPattern)
  while ((match = companyRegex.exec(text)) !== null) {
    const company = match[1].trim().toLowerCase()
    if (profileCompanies.some(pc => pc.includes(company) || company.includes(pc))) {
      verified.push(`Company "${match[1].trim()}" found in profile`)
    }
  }

  return { verified, unverified, conflicts }
}

/**
 * Analyze document tone
 *
 * @param {string} text - Document text
 * @param {object} communicationPrefs - Profile communication preferences
 * @returns {{ detected: string, consistent: boolean, issues: string[] }}
 */
export function analyzeTone(text, communicationPrefs = null) {
  if (!text || typeof text !== 'string') {
    return { detected: 'balanced', consistent: true, issues: [] }
  }

  // Formal tone indicators
  const formalIndicators = /\b(hereby|pursuant|furthermore|moreover|accordingly|therefore|consequently|notwithstanding)\b/gi
  // Casual tone indicators
  const casualIndicators = /\b(awesome|cool|stuff|guys|gonna|kinda|pretty much|super|really|basically|like)\b/gi

  const formalCount = (text.match(formalIndicators) || []).length
  const casualCount = (text.match(casualIndicators) || []).length

  // Determine detected tone
  let detected
  if (casualCount > formalCount) {
    detected = 'casual'
  } else if (formalCount > casualCount) {
    detected = 'formal'
  } else {
    detected = 'balanced'
  }

  // Check consistency with preferences
  const targetTone = communicationPrefs?.tone || 'conversational'
  let consistent = true
  const issues = []

  if (targetTone === 'formal' && detected === 'casual') {
    consistent = false
    issues.push(`Tone detected as ${detected}, profile prefers ${targetTone}`)
  } else if (targetTone === 'conversational' && detected === 'formal') {
    consistent = false
    issues.push(`Tone detected as ${detected}, profile prefers ${targetTone}`)
  } else if (targetTone === 'direct' && formalCount >= 3) {
    consistent = false
    issues.push(`Too many formal phrases for direct tone preference`)
  }

  return { detected, consistent, issues }
}

/**
 * Full document review
 *
 * APPL-12: Grammar, ATS, tone, length, factual accuracy
 *
 * @param {string} documentType - 'resume', 'cover_letter', or 'email'
 * @param {string} content - Document content
 * @param {string} jobDescription - Job description for keyword extraction
 * @param {object} profile - User profile for factual verification
 * @returns {Promise<object>} Complete review result
 */
export async function reviewDocument(documentType, content, jobDescription, profile) {
  // Extract keywords from job description
  const keywords = jobDescription
    ? extractJobKeywords(jobDescription).skills
    : []

  // Run checks in parallel where possible
  const [grammar, ats, factual, tone] = await Promise.all([
    checkGrammar(content),
    Promise.resolve(checkATSCompatibility(content, keywords)),
    Promise.resolve(checkFactualAccuracy(content, profile)),
    Promise.resolve(analyzeTone(content, profile?.preferences?.communication))
  ])

  // Length check
  const wordCount = content ? content.split(/\s+/).filter(w => w.length > 0).length : 0
  const charCount = content ? content.length : 0

  // Document-specific limits
  const limits = documentType === 'resume'
    ? { minWords: 200, maxWords: 700, maxPages: 2 }
    : documentType === 'cover_letter'
      ? { minWords: 150, maxWords: 400, maxPages: 1 }
      : { minWords: 50, maxWords: 300, maxPages: 1 }  // email

  const withinLimits = wordCount >= limits.minWords && wordCount <= limits.maxWords
  const pageEstimate = Math.ceil(charCount / 3500)  // ~3500 chars per page

  const length = {
    wordCount,
    charCount,
    withinLimits,
    pageEstimate
  }

  // Calculate overall score (average of component scores)
  const grammarScore = grammar.score !== null ? grammar.score : 80  // Default if API failed
  const atsScore = ats.score
  const toneScore = tone.consistent ? 90 : 70
  const lengthScore = withinLimits ? 100 : 70

  const overallScore = Math.round(
    (grammarScore + atsScore + toneScore + lengthScore) / 4
  )

  // Determine blockers
  const blockers = []
  const grammarErrors = grammar.issues.filter(i => i.severity === 'error').length
  if (grammarErrors > 3) {
    blockers.push('Too many grammar errors')
  }
  if (ats.score < 70) {
    blockers.push('ATS compatibility issues')
  }
  if (factual.conflicts.length > 0) {
    blockers.push('Factual conflicts with profile')
  }

  // readyToUse = no blockers AND overall score >= 75
  const readyToUse = blockers.length === 0 && overallScore >= 75

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
    readyToUse,
    blockers
  }
}
