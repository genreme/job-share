/**
 * Keyword Optimizer Service - Resume optimization without structural changes
 *
 * Provides keyword-based optimization following CONTEXT.md decision:
 * "keyword optimization, same structure preserved, reorder and emphasize
 * sections based on JD keywords. Not full rewrites per job."
 *
 * APPL-10: Uses profile + job research + playbook
 */

import { extractJobKeywords } from './resume-matcher.js'

/**
 * Score text relevance based on keyword matches
 *
 * @param {string} text - Text to score
 * @param {string[]} keywords - Target keywords
 * @returns {number} Count of matching keywords
 */
export function scoreTextRelevance(text, keywords) {
  if (!text || typeof text !== 'string' || !keywords || !Array.isArray(keywords)) {
    return 0
  }

  const textLower = text.toLowerCase()
  return keywords.filter(k => textLower.includes(k.toLowerCase())).length
}

/**
 * Reorder skills by relevance to target keywords
 *
 * Handles two formats:
 * - Grouped format: { "Technical": ["React", "Node"], "Design": ["Figma"] }
 * - Flat array format: ["React", "Node", "Figma"]
 *
 * Skills matching target keywords are moved to the front within each group/array.
 *
 * @param {object|Array} skills - Skills in grouped or flat format
 * @param {string[]} targetKeywords - Keywords from job description
 * @returns {object|Array} Reordered skills in same format as input
 */
export function reorderSkillsByRelevance(skills, targetKeywords) {
  if (!skills) {
    return skills
  }

  const normalizedKeywords = (targetKeywords || []).map(k => k.toLowerCase())
  const keywordSet = new Set(normalizedKeywords)

  // Handle grouped format: { "Technical": ["React", "Node"], ... }
  if (typeof skills === 'object' && !Array.isArray(skills)) {
    const result = {}

    for (const [category, skillList] of Object.entries(skills)) {
      if (!Array.isArray(skillList)) {
        result[category] = skillList
        continue
      }

      // Score each skill
      const scored = skillList.map(skill => {
        const skillLower = (typeof skill === 'string' ? skill : skill.name || '').toLowerCase()
        // Check for exact match or partial match
        const matches = keywordSet.has(skillLower) ||
          normalizedKeywords.some(k => skillLower.includes(k) || k.includes(skillLower))
        return { skill, matches: matches ? 1 : 0 }
      })

      // Sort matching skills first, preserve relative order otherwise
      scored.sort((a, b) => b.matches - a.matches)
      result[category] = scored.map(s => s.skill)
    }

    return result
  }

  // Handle flat array format
  if (Array.isArray(skills)) {
    const scored = skills.map(skill => {
      const skillName = typeof skill === 'string' ? skill : skill.name || ''
      const skillLower = skillName.toLowerCase()
      const matches = keywordSet.has(skillLower) ||
        normalizedKeywords.some(k => skillLower.includes(k) || k.includes(skillLower))
      return { skill, matches: matches ? 1 : 0 }
    })

    scored.sort((a, b) => b.matches - a.matches)
    return scored.map(s => s.skill)
  }

  // Unknown format, return as-is
  return skills
}

/**
 * Analyze keyword coverage in resume data
 *
 * @param {object} resumeData - Resume data to analyze
 * @param {string[]} keywords - Target keywords
 * @returns {{ total: number, matched: number, missing: number, matchedKeywords: string[], missingKeywords: string[], coveragePercent: number }}
 */
export function analyzeKeywordCoverage(resumeData, keywords) {
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return {
      total: 0,
      matched: 0,
      missing: 0,
      matchedKeywords: [],
      missingKeywords: [],
      coveragePercent: 100
    }
  }

  // Stringify resume data for searching
  const resumeText = JSON.stringify(resumeData).toLowerCase()

  const matchedKeywords = []
  const missingKeywords = []

  for (const keyword of keywords) {
    if (resumeText.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword)
    } else {
      missingKeywords.push(keyword)
    }
  }

  const total = keywords.length
  const matched = matchedKeywords.length
  const missing = missingKeywords.length
  const coveragePercent = Math.round((matched / total) * 100)

  return {
    total,
    matched,
    missing,
    matchedKeywords,
    missingKeywords,
    coveragePercent
  }
}

/**
 * Optimize resume for job keywords while preserving structure
 *
 * This does NOT rewrite content. It only reorders existing content.
 * Per CONTEXT.md: "same structure preserved, reorder and emphasize
 * sections based on JD keywords. Not full rewrites per job."
 *
 * @param {object} resumeData - Resume data with skills and experience
 * @param {string} jobDescription - Job description text
 * @param {object|null} research - Optional company research with highlights
 * @returns {{
 *   optimizedData: object,
 *   optimizations: Array<{ section: string, action: string, reason: string }>,
 *   keywordCoverage: object,
 *   researchIntegration: { available: boolean, suggested: string }|null,
 *   summary: string
 * }}
 */
export function optimizeResumeForJob(resumeData, jobDescription, research = null) {
  if (!resumeData) {
    return {
      optimizedData: resumeData,
      optimizations: [],
      keywordCoverage: { total: 0, matched: 0, missing: 0, coveragePercent: 100 },
      researchIntegration: null,
      summary: 'No resume data provided'
    }
  }

  // Extract keywords from job description
  const { skills: keywords } = extractJobKeywords(jobDescription || '')
  const optimizations = []

  // Make a copy to avoid mutating original
  const optimizedData = JSON.parse(JSON.stringify(resumeData))

  // 1. Reorder skills
  if (optimizedData.skills) {
    const originalSkills = JSON.stringify(optimizedData.skills)
    optimizedData.skills = reorderSkillsByRelevance(optimizedData.skills, keywords)
    const reorderedSkills = JSON.stringify(optimizedData.skills)

    if (originalSkills !== reorderedSkills) {
      optimizations.push({
        section: 'skills',
        action: 'reordered',
        reason: 'Leading with job-relevant skills'
      })
    }
  }

  // 2. Reorder experience bullets (most relevant first within each role)
  if (optimizedData.experience && Array.isArray(optimizedData.experience)) {
    for (const exp of optimizedData.experience) {
      if (exp.bullets && Array.isArray(exp.bullets) && exp.bullets.length > 1) {
        const originalBullets = [...exp.bullets]

        // Score each bullet
        const scored = exp.bullets.map((bullet, idx) => ({
          bullet,
          originalIndex: idx,
          relevance: scoreTextRelevance(bullet, keywords)
        }))

        // Sort by relevance (highest first)
        scored.sort((a, b) => {
          if (b.relevance !== a.relevance) {
            return b.relevance - a.relevance
          }
          // Preserve original order for ties
          return a.originalIndex - b.originalIndex
        })

        // Check if order changed
        const reordered = scored.some((s, idx) => s.originalIndex !== idx)
        if (reordered) {
          exp.bullets = scored.map(s => s.bullet)
          const companyName = exp.company || exp.title || 'experience'
          optimizations.push({
            section: `experience.${companyName}`,
            action: 'reordered_bullets',
            reason: 'Most relevant bullets first'
          })
        }
      }
    }
  }

  // 3. Calculate keyword coverage
  const keywordCoverage = analyzeKeywordCoverage(optimizedData, keywords)

  // 4. Integrate research if available
  let researchIntegration = null
  if (research?.highlights && research.highlights.length > 0) {
    researchIntegration = {
      available: true,
      suggested: `Consider mentioning: ${research.highlights[0]}`
    }
  }

  // Generate summary
  const summary = `${optimizations.length} optimizations applied, ${keywordCoverage.matched}/${keywordCoverage.total} keywords covered`

  return {
    optimizedData,
    optimizations,
    keywordCoverage,
    researchIntegration,
    summary
  }
}
