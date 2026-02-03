/**
 * Skill Gap Aggregator Service - Aggregate skill gaps from job descriptions
 *
 * Provides:
 * - aggregateSkillGaps: Extract and count skill gaps across multiple JDs
 * - getGapTrends: Identify new, closed, and persistent gaps over time
 * - getGapRecommendations: Generate prioritized recommendations for addressing gaps
 *
 * ANLT-03: Skill gap insights with frequency, trends, and context
 */

import { extractJobKeywords } from './resume-matcher.js'

/**
 * Determine priority level based on occurrence count
 *
 * @param {number} count - Number of JDs mentioning the skill
 * @returns {'high'|'medium'|'low'} Priority level
 */
function getPriorityLevel(count) {
  if (count >= 10) return 'high'
  if (count >= 5) return 'medium'
  return 'low'
}

/**
 * Check if a profile skill matches a job keyword
 *
 * @param {string} profileSkill - Skill from profile (lowercase)
 * @param {string} jobKeyword - Keyword from job description (lowercase)
 * @returns {boolean} True if skills match
 */
function skillsMatch(profileSkill, jobKeyword) {
  const ps = profileSkill.toLowerCase()
  const jk = jobKeyword.toLowerCase()

  // Exact match
  if (ps === jk) return true

  // Profile skill contains job keyword
  if (ps.includes(jk)) return true

  // Job keyword contains profile skill (for short skills)
  if (jk.includes(ps) && ps.length >= 2) return true

  return false
}

/**
 * Extract skills from profile
 *
 * @param {object} profile - Profile data with skills array
 * @returns {string[]} Array of lowercase skill names
 */
function getProfileSkills(profile) {
  if (!profile || !profile.skills || !Array.isArray(profile.skills)) {
    return []
  }

  return profile.skills
    .map(s => s.name?.toLowerCase())
    .filter(Boolean)
}

/**
 * Aggregate skill gaps from job descriptions
 *
 * Processes job descriptions to identify skills that are:
 * 1. Requested in JDs but not in profile
 * 2. Appear at least 3 times across all JDs (minimum occurrence filter)
 *
 * @param {Array<object>} jobs - Array of job objects with description/notes
 * @param {object} profile - Profile data with skills array
 * @returns {Array<{skill: string, count: number, industries: string[], roles: string[], priority: 'high'|'medium'|'low'}>}
 */
export function aggregateSkillGaps(jobs, profile) {
  // Handle empty/invalid inputs
  if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
    return []
  }

  const profileSkills = getProfileSkills(profile)
  const gapCounts = new Map()
  const gapContext = new Map()

  // Process each job with description or notes
  for (const job of jobs) {
    const text = job.description || job.notes
    if (!text || typeof text !== 'string') continue

    const { skills } = extractJobKeywords(text)

    for (const skill of skills) {
      // Check if profile has this skill
      const hasSkill = profileSkills.some(ps => skillsMatch(ps, skill))

      if (!hasSkill) {
        // Increment gap count
        gapCounts.set(skill, (gapCounts.get(skill) || 0) + 1)

        // Track context (which industries/roles request this)
        if (!gapContext.has(skill)) {
          gapContext.set(skill, { industries: new Set(), roles: new Set() })
        }

        const context = gapContext.get(skill)
        if (job.industry) context.industries.add(job.industry)
        if (job.title) context.roles.add(job.title)
      }
    }
  }

  // Filter by minimum occurrence (3+) and sort by frequency
  const gaps = [...gapCounts.entries()]
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([skill, count]) => ({
      skill,
      count,
      industries: [...(gapContext.get(skill)?.industries || [])],
      roles: [...(gapContext.get(skill)?.roles || [])],
      priority: getPriorityLevel(count)
    }))

  return gaps
}

/**
 * Filter jobs by date range
 *
 * @param {Array<object>} jobs - Array of jobs with found/created dates
 * @param {Date} start - Start date (inclusive)
 * @param {Date} end - End date (inclusive)
 * @returns {Array<object>} Filtered jobs
 */
function filterJobsByDateRange(jobs, start, end) {
  return jobs.filter(job => {
    const dateStr = job.found || job.created || job.createdAt
    if (!dateStr) return false

    const jobDate = new Date(dateStr)
    return jobDate >= start && jobDate <= end
  })
}

/**
 * Get gap trends across date ranges
 *
 * Compares skill gaps between two time periods to identify:
 * - Closed gaps: Skills that were gaps but now in profile
 * - New gaps: Skills appearing in current period but not previous
 * - Persistent gaps: Skills that remain gaps across both periods
 * - Trending: Gaps with significant count changes (>50%)
 *
 * @param {Array<object>} jobs - Array of job objects
 * @param {object} profile - Profile data with skills
 * @param {{current: {start: Date, end: Date}, previous: {start: Date, end: Date}}} dateRanges
 * @returns {{closed: string[], new: string[], persistent: string[], trending: {up: string[], down: string[]}}}
 */
export function getGapTrends(jobs, profile, dateRanges) {
  // Handle missing/invalid inputs
  if (!jobs || !Array.isArray(jobs) || !dateRanges) {
    return { closed: [], new: [], persistent: [], trending: { up: [], down: [] } }
  }

  const { current, previous } = dateRanges
  if (!current || !previous) {
    return { closed: [], new: [], persistent: [], trending: { up: [], down: [] } }
  }

  // Get jobs for each period
  const previousJobs = filterJobsByDateRange(jobs, previous.start, previous.end)
  const currentJobs = filterJobsByDateRange(jobs, current.start, current.end)

  // For detecting closed gaps: extract ALL skills from previous period JDs (regardless of profile)
  // These are skills that WERE requested in previous period
  const previousRequestedSkills = extractAllSkillsFromJobs(previousJobs)

  // Aggregate current gaps (skills not in profile)
  const currentGaps = aggregateGapsRaw(currentJobs, profile)
  const currentSkills = new Set(Object.keys(currentGaps))

  // Closed gaps: skills requested in previous period that are NOW in profile
  const profileSkills = getProfileSkills(profile)
  const closed = [...previousRequestedSkills].filter(skill => {
    const nowInProfile = profileSkills.some(ps => skillsMatch(ps, skill))
    return nowInProfile
  })

  // For new/persistent analysis: get gaps from previous period (skills not in profile)
  const previousGaps = aggregateGapsRaw(previousJobs, profile)
  const previousGapSkills = new Set(Object.keys(previousGaps))

  // New gaps: in current gaps but not in previous gaps
  const newGaps = [...currentSkills].filter(skill => !previousGapSkills.has(skill))

  // Persistent gaps: in both periods (still gaps, not closed)
  const persistent = [...currentSkills].filter(skill =>
    previousGapSkills.has(skill) && !closed.includes(skill)
  )

  // Trending: compare counts between periods
  const up = []
  const down = []

  for (const skill of persistent) {
    const prevCount = previousGaps[skill] || 0
    const currCount = currentGaps[skill] || 0

    if (prevCount === 0) continue

    const changeRatio = (currCount - prevCount) / prevCount

    if (changeRatio > 0.5) {
      up.push(skill)
    } else if (changeRatio < -0.5) {
      down.push(skill)
    }
  }

  return {
    closed,
    new: newGaps,
    persistent,
    trending: { up, down }
  }
}

/**
 * Extract all skills mentioned in jobs (regardless of profile)
 *
 * @param {Array<object>} jobs - Array of jobs
 * @returns {Set<string>} Set of all skills mentioned
 */
function extractAllSkillsFromJobs(jobs) {
  const skills = new Set()

  if (!jobs || !Array.isArray(jobs)) return skills

  for (const job of jobs) {
    const text = job.description || job.notes
    if (!text || typeof text !== 'string') continue

    const { skills: extractedSkills } = extractJobKeywords(text)
    for (const skill of extractedSkills) {
      skills.add(skill)
    }
  }

  return skills
}

/**
 * Aggregate skill gaps without minimum filter (for internal use)
 *
 * @param {Array<object>} jobs - Array of jobs
 * @param {object} profile - Profile data
 * @returns {Object<string, number>} Map of skill to count
 */
function aggregateGapsRaw(jobs, profile) {
  if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
    return {}
  }

  const profileSkills = getProfileSkills(profile)
  const gapCounts = {}

  for (const job of jobs) {
    const text = job.description || job.notes
    if (!text || typeof text !== 'string') continue

    const { skills } = extractJobKeywords(text)

    for (const skill of skills) {
      const hasSkill = profileSkills.some(ps => skillsMatch(ps, skill))

      if (!hasSkill) {
        gapCounts[skill] = (gapCounts[skill] || 0) + 1
      }
    }
  }

  return gapCounts
}

/**
 * Generate actionable recommendations for addressing skill gaps
 *
 * Prioritizes gaps based on frequency and alignment with target roles.
 *
 * @param {Array<{skill: string, count: number, industries: string[], roles: string[], priority: string}>} gaps
 * @param {string[]} [targetRoles] - Target role titles from profile preferences
 * @returns {Array<{skill: string, priority: 'high'|'medium'|'low', rationale: string, actionType: 'learn'|'highlight'|'research'}>}
 */
export function getGapRecommendations(gaps, targetRoles = []) {
  if (!gaps || !Array.isArray(gaps) || gaps.length === 0) {
    return []
  }

  const normalizedTargetRoles = targetRoles.map(r => r.toLowerCase())

  return gaps.map(gap => {
    // Determine if this gap aligns with target roles
    const alignsWithTargets = gap.roles.some(role =>
      normalizedTargetRoles.some(target =>
        role.toLowerCase().includes(target) || target.includes(role.toLowerCase())
      )
    )

    // Build rationale
    const industryContext = gap.industries.length > 0
      ? `, common for ${gap.industries.slice(0, 2).join(' and ')} roles`
      : ''

    const rationale = `Requested in ${gap.count} JDs${industryContext}${alignsWithTargets ? ', aligns with your target roles' : ''}`

    // Determine action type based on priority and context
    let actionType
    if (gap.priority === 'high') {
      actionType = 'learn' // High frequency = worth investing in learning
    } else if (gap.priority === 'medium') {
      actionType = alignsWithTargets ? 'learn' : 'highlight' // Medium + relevant = learn; otherwise highlight existing adjacent skills
    } else {
      actionType = 'research' // Low priority = just be prepared to discuss
    }

    return {
      skill: gap.skill,
      priority: gap.priority,
      rationale,
      actionType
    }
  })
}
