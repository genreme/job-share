/**
 * Fit Scorer Service - Calculate job fit scores using profile preferences
 *
 * Provides profile-based scoring when targetRoles is populated,
 * falls back to configurable defaults (from fit-config.json) when profile is empty.
 *
 * Fallback chain:
 * 1. Profile targetRoles (if populated)
 * 2. fit-config.json (if exists)
 * 3. Hardcoded defaults (final fallback)
 */

import { loadProfile } from '../data/profile-loader.js'
import { loadFitConfig, getDefaultCriteria, getDefaultWeights } from './fit-config.js'

/**
 * Get effective fit criteria and weights
 *
 * Loads from fit-config.json if available, otherwise uses hardcoded defaults.
 *
 * @returns {{ criteria: object, weights: object }}
 */
function getEffectiveFitConfig() {
  try {
    const config = loadFitConfig()
    return {
      criteria: config.criteria,
      weights: config.weights
    }
  } catch (e) {
    console.warn('Failed to load fit config, using hardcoded defaults:', e.message)
    return {
      criteria: getDefaultCriteria(),
      weights: getDefaultWeights()
    }
  }
}

// Load effective config (cached for session performance)
let cachedConfig = null

function getFitConfig() {
  if (!cachedConfig) {
    cachedConfig = getEffectiveFitConfig()
  }
  return cachedConfig
}

/**
 * Clear cached config (useful for testing)
 */
export function clearFitConfigCache() {
  cachedConfig = null
}

// Backward compatibility: expose DEFAULT_FIT_CRITERIA getter
export function getDefaultFitCriteria() {
  return getFitConfig().criteria
}

// Backward compatibility: expose SCORES getter
export function getScores() {
  return getFitConfig().weights
}

/**
 * Parse a salary from text (e.g., "$120,000", "$120K - $150K")
 *
 * @param {string|null|undefined} salaryText - Salary string to parse
 * @returns {number} Parsed salary (minimum if range), 0 if not parseable
 */
export function parseSalaryFromText(salaryText) {
  if (!salaryText || typeof salaryText !== 'string') {
    return 0
  }

  // Remove $ and commas, convert K to 000
  const normalized = salaryText
    .toLowerCase()
    .replace(/[$,]/g, '')
    .replace(/k/g, '000')

  // Find all numbers in the string
  const numbers = normalized.match(/\d+/g)

  if (!numbers || numbers.length === 0) {
    return 0
  }

  // Return the first number (minimum in a range)
  return parseInt(numbers[0], 10)
}

/**
 * Check if text matches any keywords (case-insensitive)
 *
 * @param {string|null|undefined} text - Text to search
 * @param {string[]} keywords - Keywords to match
 * @returns {boolean} True if any keyword matches
 */
function matchesKeywords(text, keywords) {
  if (!text || typeof text !== 'string') {
    return false
  }

  const lowerText = text.toLowerCase()
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))
}

/**
 * Count matching skills in text
 *
 * @param {string|null|undefined} text - Text to search (job description)
 * @param {string[]} skillNames - Skill names to look for
 * @param {object} weights - Scoring weights
 * @returns {number} Count of matching skills (max 5)
 */
function countSkillMatches(text, skillNames, weights) {
  if (!text || typeof text !== 'string' || !skillNames || skillNames.length === 0) {
    return 0
  }

  const lowerText = text.toLowerCase()
  let matches = 0
  const maxMatches = weights.MAX_SKILL_MATCHES || 5

  for (const skill of skillNames) {
    if (lowerText.includes(skill.toLowerCase())) {
      matches++
      if (matches >= maxMatches) {
        break
      }
    }
  }

  return matches
}

/**
 * Calculate fit score using default criteria (from config)
 *
 * @param {object} job - Job data with title, company, industry, location, salary, description
 * @returns {{ score: number, breakdown: object, usingDefaults: true }}
 */
export function calculateDefaultFitScore(job) {
  const { criteria, weights } = getFitConfig()

  const breakdown = {
    base: weights.BASE,
    role: 0,
    industry: 0,
    location: 0,
    salary: 0,
    skills: 0
  }

  const title = job.title || ''
  const industry = job.industry || ''
  const location = job.location || ''
  const salary = parseSalaryFromText(job.salary)

  // Role matching
  if (criteria.titles.exact.some(t => title.toLowerCase().includes(t.toLowerCase()))) {
    breakdown.role = weights.ROLE_EXACT
  } else if (criteria.titles.partial.some(t => title.toLowerCase().includes(t.toLowerCase()))) {
    breakdown.role = weights.ROLE_PARTIAL
  }

  // Industry matching
  if (matchesKeywords(industry, criteria.industries.preferred)) {
    breakdown.industry = weights.INDUSTRY_PREFERRED
  } else if (matchesKeywords(industry, criteria.industries.acceptable)) {
    breakdown.industry = weights.INDUSTRY_ACCEPTABLE
  }

  // Location matching
  if (matchesKeywords(location, criteria.locations.preferred)) {
    breakdown.location = weights.LOCATION_PREFERRED
  } else if (matchesKeywords(location, criteria.locations.acceptable)) {
    breakdown.location = weights.LOCATION_ACCEPTABLE
  }

  // Salary matching
  if (salary >= criteria.salaryMin) {
    breakdown.salary = weights.SALARY_MEETS
  }

  // Calculate total (cap at 100)
  const score = Math.min(
    weights.MAX_TOTAL,
    breakdown.base + breakdown.role + breakdown.industry + breakdown.location + breakdown.salary + breakdown.skills
  )

  return { score, breakdown, usingDefaults: true }
}

/**
 * Calculate fit score using profile preferences
 *
 * @param {object} job - Job data with title, company, industry, location, salary, description
 * @param {object} profile - Profile with preferences.targetRoles and skills
 * @returns {{ score: number, breakdown: object, usingDefaults: false }}
 */
function calculateProfileBasedScore(job, profile) {
  const { weights } = getFitConfig()

  const breakdown = {
    base: weights.BASE,
    role: 0,
    industry: 0,
    location: 0,
    salary: 0,
    skills: 0
  }

  const targetRoles = profile.preferences?.targetRoles || []
  const skills = profile.skills || []

  const title = job.title || ''
  const industry = job.industry || ''
  const location = job.location || ''
  const description = job.description || job.notes || ''
  const salary = parseSalaryFromText(job.salary)

  // Collect criteria from all target roles
  const exactTitles = []
  const partialTitles = []
  const preferredIndustries = []
  const acceptableIndustries = []
  const preferredLocations = []
  const acceptableLocations = []
  let minSalary = 0

  for (const role of targetRoles) {
    // Title matching
    if (role.titles?.exact) {
      exactTitles.push(...role.titles.exact)
    }
    if (role.titles?.partial) {
      partialTitles.push(...role.titles.partial)
    }

    // Industry matching
    if (role.industries?.preferred) {
      preferredIndustries.push(...role.industries.preferred)
    }
    if (role.industries?.acceptable) {
      acceptableIndustries.push(...role.industries.acceptable)
    }

    // Location matching
    if (role.locations?.preferred) {
      preferredLocations.push(...role.locations.preferred)
    }
    if (role.locations?.acceptable) {
      acceptableLocations.push(...role.locations.acceptable)
    }

    // Salary (use highest minimum across all target roles)
    if (role.salary?.minimum && role.salary.minimum > minSalary) {
      minSalary = role.salary.minimum
    }
  }

  // Role matching
  if (exactTitles.some(t => title.toLowerCase().includes(t.toLowerCase()))) {
    breakdown.role = weights.ROLE_EXACT
  } else if (partialTitles.some(t => title.toLowerCase().includes(t.toLowerCase()))) {
    breakdown.role = weights.ROLE_PARTIAL
  }

  // Industry matching
  if (matchesKeywords(industry, preferredIndustries)) {
    breakdown.industry = weights.INDUSTRY_PREFERRED
  } else if (matchesKeywords(industry, acceptableIndustries)) {
    breakdown.industry = weights.INDUSTRY_ACCEPTABLE
  }

  // Location matching
  if (matchesKeywords(location, preferredLocations)) {
    breakdown.location = weights.LOCATION_PREFERRED
  } else if (matchesKeywords(location, acceptableLocations)) {
    breakdown.location = weights.LOCATION_ACCEPTABLE
  }

  // Salary matching
  if (minSalary > 0 && salary >= minSalary) {
    breakdown.salary = weights.SALARY_MEETS
  } else if (minSalary === 0 && salary > 0) {
    // If no minimum set in profile but salary exists, give partial credit
    breakdown.salary = Math.floor(weights.SALARY_MEETS / 2)
  }

  // Skills matching (2 points per skill, max 5 skills = 10 points)
  const skillNames = skills.map(s => s.name)
  const matchCount = countSkillMatches(description, skillNames, weights)
  breakdown.skills = matchCount * weights.SKILL_MATCH

  // Calculate total (cap at 100)
  const score = Math.min(
    weights.MAX_TOTAL,
    breakdown.base + breakdown.role + breakdown.industry + breakdown.location + breakdown.salary + breakdown.skills
  )

  return { score, breakdown, usingDefaults: false }
}

/**
 * Calculate fit score for a job
 *
 * Uses profile preferences when targetRoles is populated,
 * falls back to defaults with warning when empty.
 *
 * @param {object} job - Job data with title, company, industry, location, salary, description
 * @returns {{ score: number, breakdown: object, usingDefaults: boolean }}
 */
export function calculateFitScore(job) {
  let profile

  try {
    // Load profile fresh each time to pick up updates
    profile = loadProfile()
  } catch (e) {
    console.warn('Failed to load profile - using default fit criteria:', e.message)
    return calculateDefaultFitScore(job)
  }

  // Check if profile has targetRoles defined
  const targetRoles = profile?.preferences?.targetRoles || []

  if (targetRoles.length === 0) {
    console.warn('Profile targetRoles is empty - using default fit criteria')
    return calculateDefaultFitScore(job)
  }

  return calculateProfileBasedScore(job, profile)
}
