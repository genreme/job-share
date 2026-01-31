/**
 * Fit Scorer Service - Calculate job fit scores using profile preferences
 *
 * Provides profile-based scoring when targetRoles is populated,
 * falls back to hardcoded defaults (matching worker/job-validator.js pattern)
 * when profile is empty.
 */

import { loadProfile } from '../data/profile-loader.js'

// Default fit criteria (fallback when profile.preferences.targetRoles is empty)
// Matches pattern from worker/job-validator.js
const DEFAULT_FIT_CRITERIA = {
  titles: {
    exact: [
      'Creative Director', 'VP of Creative', 'VP Creative Services', 'Director of Creative Services',
      'Head of Creative', 'Head of Design', 'Design Director', 'Executive Creative Director',
      'Senior Creative Director', 'Creative Operations Director'
    ],
    partial: ['Creative', 'Design', 'Brand', 'Visual', 'Art Director', 'UX Director']
  },
  industries: {
    preferred: [
      'healthcare', 'health', 'nonprofit', 'non-profit', 'education', 'social impact',
      'mission-driven', 'public health', 'mental health', 'wellness'
    ],
    acceptable: ['technology', 'saas', 'startup', 'b2b']
  },
  locations: {
    preferred: ['boston', 'massachusetts', 'ma', 'remote', 'hybrid'],
    acceptable: ['new york', 'ny', 'northeast', 'east coast']
  },
  salaryMin: 120000
}

// Scoring weights
const SCORES = {
  BASE: 50,
  ROLE_EXACT: 25,
  ROLE_PARTIAL: 15,
  INDUSTRY_PREFERRED: 20,
  INDUSTRY_ACCEPTABLE: 10,
  LOCATION_PREFERRED: 15,
  LOCATION_ACCEPTABLE: 8,
  SALARY_MEETS: 15,
  SKILL_MATCH: 2,
  MAX_SKILL_MATCHES: 5,
  MAX_TOTAL: 100
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
 * @returns {number} Count of matching skills (max 5)
 */
function countSkillMatches(text, skillNames) {
  if (!text || typeof text !== 'string' || !skillNames || skillNames.length === 0) {
    return 0
  }

  const lowerText = text.toLowerCase()
  let matches = 0

  for (const skill of skillNames) {
    if (lowerText.includes(skill.toLowerCase())) {
      matches++
      if (matches >= SCORES.MAX_SKILL_MATCHES) {
        break
      }
    }
  }

  return matches
}

/**
 * Calculate fit score using default criteria
 *
 * @param {object} job - Job data with title, company, industry, location, salary, description
 * @returns {{ score: number, breakdown: object, usingDefaults: true }}
 */
export function calculateDefaultFitScore(job) {
  const breakdown = {
    base: SCORES.BASE,
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
  if (DEFAULT_FIT_CRITERIA.titles.exact.some(t => title.toLowerCase().includes(t.toLowerCase()))) {
    breakdown.role = SCORES.ROLE_EXACT
  } else if (DEFAULT_FIT_CRITERIA.titles.partial.some(t => title.toLowerCase().includes(t.toLowerCase()))) {
    breakdown.role = SCORES.ROLE_PARTIAL
  }

  // Industry matching
  if (matchesKeywords(industry, DEFAULT_FIT_CRITERIA.industries.preferred)) {
    breakdown.industry = SCORES.INDUSTRY_PREFERRED
  } else if (matchesKeywords(industry, DEFAULT_FIT_CRITERIA.industries.acceptable)) {
    breakdown.industry = SCORES.INDUSTRY_ACCEPTABLE
  }

  // Location matching
  if (matchesKeywords(location, DEFAULT_FIT_CRITERIA.locations.preferred)) {
    breakdown.location = SCORES.LOCATION_PREFERRED
  } else if (matchesKeywords(location, DEFAULT_FIT_CRITERIA.locations.acceptable)) {
    breakdown.location = SCORES.LOCATION_ACCEPTABLE
  }

  // Salary matching
  if (salary >= DEFAULT_FIT_CRITERIA.salaryMin) {
    breakdown.salary = SCORES.SALARY_MEETS
  }

  // Calculate total (cap at 100)
  const score = Math.min(
    SCORES.MAX_TOTAL,
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
  const breakdown = {
    base: SCORES.BASE,
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
    breakdown.role = SCORES.ROLE_EXACT
  } else if (partialTitles.some(t => title.toLowerCase().includes(t.toLowerCase()))) {
    breakdown.role = SCORES.ROLE_PARTIAL
  }

  // Industry matching
  if (matchesKeywords(industry, preferredIndustries)) {
    breakdown.industry = SCORES.INDUSTRY_PREFERRED
  } else if (matchesKeywords(industry, acceptableIndustries)) {
    breakdown.industry = SCORES.INDUSTRY_ACCEPTABLE
  }

  // Location matching
  if (matchesKeywords(location, preferredLocations)) {
    breakdown.location = SCORES.LOCATION_PREFERRED
  } else if (matchesKeywords(location, acceptableLocations)) {
    breakdown.location = SCORES.LOCATION_ACCEPTABLE
  }

  // Salary matching
  if (minSalary > 0 && salary >= minSalary) {
    breakdown.salary = SCORES.SALARY_MEETS
  } else if (minSalary === 0 && salary > 0) {
    // If no minimum set in profile but salary exists, give partial credit
    breakdown.salary = Math.floor(SCORES.SALARY_MEETS / 2)
  }

  // Skills matching (2 points per skill, max 5 skills = 10 points)
  const skillNames = skills.map(s => s.name)
  const matchCount = countSkillMatches(description, skillNames)
  breakdown.skills = matchCount * SCORES.SKILL_MATCH

  // Calculate total (cap at 100)
  const score = Math.min(
    SCORES.MAX_TOTAL,
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
