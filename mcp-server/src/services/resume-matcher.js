/**
 * Resume Matcher Service - Compare profile against job descriptions
 *
 * Provides:
 * - extractJobKeywords: Extract skills/tools/keywords from job descriptions
 * - matchResumeToJob: Calculate match score and identify gaps
 *
 * APPL-01: Match score shows before applying (0-100 with confidence)
 * APPL-02: Gaps identified with specific keywords to add
 */

import { loadProfile } from '../data/profile-loader.js'

// Skill patterns organized by category for keyword extraction
const SKILL_PATTERNS = {
  // Design tools
  design_tools: /\b(figma|sketch|adobe\s*(xd|photoshop|illustrator|indesign|creative\s*suite)|invision|principle|framer|zeplin|miro|figjam|whimsical)\b/gi,
  // Frontend technologies
  frontend: /\b(react|angular|vue|svelte|next\.?js|nuxt|typescript|javascript|html5?|css3?|sass|scss|less|tailwind|styled[\s-]?components|webpack|vite)\b/gi,
  // Backend technologies
  backend: /\b(node\.?js|express|python|django|flask|java|spring|ruby|rails|go|golang|rust|php|laravel|\.net|graphql|rest\s*api)\b/gi,
  // Databases
  databases: /\b(sql|mysql|postgres|postgresql|mongodb|redis|elasticsearch|dynamodb|firebase|supabase)\b/gi,
  // Methodologies
  methodologies: /\b(agile|scrum|kanban|lean|design\s*thinking|user[\s-]?centered|human[\s-]?centered|waterfall|sprint|okr|jira|asana)\b/gi,
  // Soft skills
  soft_skills: /\b(leadership|management|mentoring|collaboration|communication|strategic\s*thinking|problem[\s-]?solving|stakeholder|cross[\s-]?functional)\b/gi,
  // Domain keywords
  domain: /\b(ux|ui|brand|creative|visual|product\s*design|interaction\s*design|user\s*research|usability|accessibility|a11y|wcag|mobile|responsive|design\s*systems)\b/gi,
  // Cloud/DevOps
  cloud: /\b(aws|azure|gcp|google\s*cloud|docker|kubernetes|k8s|ci[\s\/]?cd|github\s*actions|terraform|vercel|netlify)\b/gi,
  // Data/Analytics
  data: /\b(analytics|data\s*analysis|sql|tableau|looker|mixpanel|amplitude|segment|a[\s\/]?b\s*testing|metrics|kpis)\b/gi
}

/**
 * Normalize text for consistent matching
 * @param {string} text - Raw text to normalize
 * @returns {string} Normalized text
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return ''

  return text
    .toLowerCase()
    .replace(/[•\-\*\u2022\u2023\u25E6\u2043\u2219]/g, ' ') // Remove bullets
    .replace(/&[^;]+;/g, ' ') // Remove HTML entities
    .replace(/[<>]/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim()
}

/**
 * Extract keywords from job description
 *
 * @param {string} description - Job description text
 * @returns {{ skills: string[], rawText: string }}
 */
export function extractJobKeywords(description) {
  if (!description || typeof description !== 'string') {
    return { skills: [], rawText: '' }
  }

  const normalized = normalizeText(description)
  const skills = new Set()

  // Extract keywords using all patterns
  for (const pattern of Object.values(SKILL_PATTERNS)) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0
    const matches = normalized.match(pattern) || []
    for (const match of matches) {
      // Normalize the match and add to set (deduplicates automatically)
      skills.add(match.toLowerCase().replace(/\s+/g, ' ').trim())
    }
  }

  return {
    skills: [...skills],
    rawText: normalized
  }
}

/**
 * Extract keywords from profile experience (projects tags and descriptions)
 *
 * @param {Array} experience - Profile experience array
 * @returns {string[]} Extracted keywords
 */
function extractExperienceKeywords(experience) {
  const keywords = []

  for (const exp of experience || []) {
    for (const project of exp.projects || []) {
      // Add tags directly
      if (project.tags && Array.isArray(project.tags)) {
        keywords.push(...project.tags)
      }

      // Extract keywords from description using patterns
      if (project.description) {
        const normalized = normalizeText(project.description)
        for (const pattern of Object.values(SKILL_PATTERNS)) {
          pattern.lastIndex = 0
          const matches = normalized.match(pattern) || []
          keywords.push(...matches.map(m => m.toLowerCase()))
        }
      }
    }

    // Also extract from role title
    if (exp.role?.title) {
      const titleNormalized = normalizeText(exp.role.title)
      for (const pattern of Object.values(SKILL_PATTERNS)) {
        pattern.lastIndex = 0
        const matches = titleNormalized.match(pattern) || []
        keywords.push(...matches.map(m => m.toLowerCase()))
      }
    }
  }

  // Deduplicate and normalize
  return [...new Set(keywords.map(k => k.toLowerCase()))]
}

/**
 * Check if two keywords match (exact or partial)
 *
 * @param {string} profileKeyword - Keyword from profile
 * @param {string} jobKeyword - Keyword from job description
 * @returns {boolean} True if keywords match
 */
function keywordsMatch(profileKeyword, jobKeyword) {
  const pk = profileKeyword.toLowerCase()
  const jk = jobKeyword.toLowerCase()

  // Exact match
  if (pk === jk) return true

  // Profile keyword contains job keyword
  if (pk.includes(jk)) return true

  // Job keyword contains profile keyword (for short skills)
  if (jk.includes(pk) && pk.length >= 2) return true

  return false
}

/**
 * Match profile against job description
 *
 * @param {object} profile - Profile data with skills and experience
 * @param {string} jobDescription - Job description text
 * @returns {{
 *   score: number,
 *   matched: Array<string|{keyword: string, via: string}>,
 *   missing: string[],
 *   suggestions: Array<{keyword: string, suggestion: string}>,
 *   totalJobKeywords: number,
 *   confidence: 'high'|'medium'|'low'
 * }}
 */
export function matchResumeToJob(profile, jobDescription) {
  // Extract job keywords
  const jobKeywords = extractJobKeywords(jobDescription)

  // Extract profile skills from skills array
  const profileSkillNames = (profile?.skills || []).map(s => s.name?.toLowerCase()).filter(Boolean)

  // Extract keywords from experience
  const experienceKeywords = extractExperienceKeywords(profile?.experience)

  // Combine all profile keywords (deduplicated)
  const allProfileKeywords = new Set([...profileSkillNames, ...experienceKeywords])

  // Calculate matches and gaps
  const matched = []
  const missing = []

  for (const jobKeyword of jobKeywords.skills) {
    let foundMatch = false
    let matchedVia = null

    // Check each profile keyword
    for (const profileKeyword of allProfileKeywords) {
      if (keywordsMatch(profileKeyword, jobKeyword)) {
        foundMatch = true
        matchedVia = profileKeyword
        break
      }
    }

    if (foundMatch) {
      // If exact match, just add the keyword; otherwise track how it matched
      if (matchedVia === jobKeyword) {
        matched.push(jobKeyword)
      } else {
        matched.push({ keyword: jobKeyword, via: matchedVia })
      }
    } else {
      missing.push(jobKeyword)
    }
  }

  // Calculate score
  const totalKeywords = jobKeywords.skills.length
  const matchCount = matched.length
  const score = totalKeywords > 0
    ? Math.round((matchCount / totalKeywords) * 100)
    : 50 // Default neutral score when no keywords extracted

  // Generate suggestions for missing skills
  const suggestions = missing.map(keyword => ({
    keyword,
    suggestion: `Consider highlighting "${keyword}" experience if you have it, or research to prepare for questions about it`
  }))

  // Determine confidence level based on keyword count
  let confidence
  if (totalKeywords >= 5) {
    confidence = 'high'
  } else if (totalKeywords >= 2) {
    confidence = 'medium'
  } else {
    confidence = 'low'
  }

  return {
    score,
    matched,
    missing,
    suggestions,
    totalJobKeywords: totalKeywords,
    confidence
  }
}
