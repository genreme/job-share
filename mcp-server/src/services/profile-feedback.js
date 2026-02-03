/**
 * Profile Feedback Service
 * Phase 9: Interview Learning - Profile confidence tracking, suggestions, and pattern detection
 *
 * Provides:
 * - updateProfileConfidence: Update profile item confidence based on learning outcomes
 * - getProfileUpdateSuggestions: Batch/aggregate suggestions for profile updates
 * - getInterviewPatterns: Detect recurring patterns across interviews
 * - detectConflicts: Find conflicting learnings and profile content
 *
 * Per CONTEXT.md:
 * - Track visible confidence scores per story/skill
 * - Claude decides when to present updates (batch vs aggregate)
 * - Conflicts between learning and profile content flagged for review
 */

import { loadProfile, saveProfile } from '../data/profile-loader.js'
import { stringSimilarity } from '../data/learning-queue.js'
import { readFileSync, existsSync, readdirSync, writeFileSync, renameSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const RESEARCH_DIR = join(DATA_DIR, 'job-research')

// Constants
const PATTERN_MIN_OCCURRENCES = 3
const PATTERN_MIN_COMPANIES = 2
const CONFLICT_SIMILARITY_THRESHOLD = 0.7
const PATTERN_SIMILARITY_THRESHOLD = 0.7

/**
 * Load learnings data for a job
 *
 * @param {number} jobId - Job ID
 * @returns {{ learnings: Array, lastUpdated: string }}
 */
function loadLearningsData(jobId) {
  const learningsPath = join(RESEARCH_DIR, `${jobId}-learnings.json`)

  if (!existsSync(learningsPath)) {
    return { learnings: [], lastUpdated: new Date().toISOString() }
  }

  try {
    return JSON.parse(readFileSync(learningsPath, 'utf-8'))
  } catch (e) {
    console.error(`Error loading learnings for job ${jobId}:`, e.message)
    return { learnings: [], lastUpdated: new Date().toISOString() }
  }
}

/**
 * Save learnings data for a job
 *
 * @param {number} jobId - Job ID
 * @param {object} data - Learnings data to save
 */
function saveLearningsData(jobId, data) {
  const learningsPath = join(RESEARCH_DIR, `${jobId}-learnings.json`)
  data.lastUpdated = new Date().toISOString()
  const tempPath = join(tmpdir(), `learning-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`)
  try {
    writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8')
    renameSync(tempPath, learningsPath)
  } catch (err) {
    try { unlinkSync(tempPath) } catch (e) { /* ignore */ }
    throw err
  }
}

/**
 * Find a learning by ID across all job files
 *
 * @param {string} learningId - UUID of the learning to find
 * @returns {{ learning: object|null, jobId: number|null, index: number }}
 */
function findLearning(learningId) {
  if (!existsSync(RESEARCH_DIR)) {
    return { learning: null, jobId: null, index: -1 }
  }

  try {
    const files = readdirSync(RESEARCH_DIR)
    const learningFiles = files.filter(f => f.endsWith('-learnings.json'))

    for (const file of learningFiles) {
      const jobIdMatch = file.match(/^(\d+)-learnings\.json$/)
      if (!jobIdMatch) continue

      const jobId = parseInt(jobIdMatch[1], 10)
      const learningsData = loadLearningsData(jobId)

      const index = learningsData.learnings.findIndex(l => l.id === learningId)
      if (index !== -1) {
        return { learning: learningsData.learnings[index], jobId, index }
      }
    }
  } catch (e) {
    console.error('Error finding learning:', e.message)
  }

  return { learning: null, jobId: null, index: -1 }
}

/**
 * Load all accepted learnings across all jobs
 *
 * @returns {Array<object>} Array of accepted learnings with jobId
 */
function loadAllAcceptedLearnings() {
  const allLearnings = []

  if (!existsSync(RESEARCH_DIR)) {
    return []
  }

  try {
    const files = readdirSync(RESEARCH_DIR)
    const learningFiles = files.filter(f => f.endsWith('-learnings.json'))

    for (const file of learningFiles) {
      const jobIdMatch = file.match(/^(\d+)-learnings\.json$/)
      if (!jobIdMatch) continue

      const jobId = parseInt(jobIdMatch[1], 10)
      const learningsData = loadLearningsData(jobId)

      for (const learning of learningsData.learnings) {
        if (learning.status === 'accepted') {
          allLearnings.push({
            ...learning,
            jobId
          })
        }
      }
    }
  } catch (e) {
    console.error('Error loading accepted learnings:', e.message)
  }

  return allLearnings
}

/**
 * Find a profile item by entityType and entityId
 *
 * @param {object} profile - Profile object
 * @param {string} entityType - 'story' | 'skill' | 'summary'
 * @param {string} entityId - UUID of the entity
 * @returns {{ item: object|null, arrayName: string|null, index: number }}
 */
function findProfileItem(profile, entityType, entityId) {
  let arrayName = null
  let array = null

  switch (entityType) {
    case 'story':
      arrayName = 'stories'
      array = profile.stories || []
      break
    case 'skill':
      arrayName = 'skills'
      array = profile.skills || []
      break
    case 'summary':
      arrayName = 'summaryBlocks'
      array = profile.summaryBlocks || []
      break
    default:
      return { item: null, arrayName: null, index: -1 }
  }

  const index = array.findIndex(item => item.id === entityId)
  if (index === -1) {
    return { item: null, arrayName, index: -1 }
  }

  return { item: array[index], arrayName, index }
}

/**
 * Update profile item confidence based on learning outcome
 *
 * @param {string} learningId - UUID of the learning
 * @param {string} outcome - 'worked' | 'needs-work' | 'neutral'
 * @returns {{ updated: boolean, items?: Array, reason?: string }}
 */
export function updateProfileConfidence(learningId, outcome) {
  try {
    // Validate outcome
    if (!['worked', 'needs-work', 'neutral'].includes(outcome)) {
      return { updated: false, reason: 'Invalid outcome. Must be "worked", "needs-work", or "neutral"' }
    }

    // Find the learning
    const { learning, jobId } = findLearning(learningId)

    if (!learning) {
      return { updated: false, reason: 'Learning not found' }
    }

    // Get confirmed profile links
    const confirmedLinks = learning.confirmedProfileLinks || []

    if (confirmedLinks.length === 0) {
      return { updated: false, reason: 'No confirmed profile links for this learning' }
    }

    // Load and update profile
    const profile = loadProfile()
    const updatedItems = []

    for (const link of confirmedLinks) {
      const { item, arrayName, index } = findProfileItem(profile, link.entityType, link.entityId)

      if (!item) {
        continue // Skip if item not found
      }

      // Initialize interviewUsage if not present
      if (!item.interviewUsage) {
        item.interviewUsage = {
          totalUses: 0,
          workedCount: 0,
          needsWorkCount: 0
        }
      }

      // Increment counters
      item.interviewUsage.totalUses++

      if (outcome === 'worked') {
        item.interviewUsage.workedCount++
      } else if (outcome === 'needs-work') {
        item.interviewUsage.needsWorkCount++
      }
      // 'neutral' only increments totalUses

      // Calculate confidence score
      if (item.interviewUsage.totalUses > 0) {
        item.interviewUsage.interviewConfidence =
          Math.round((item.interviewUsage.workedCount / item.interviewUsage.totalUses) * 100)
      }

      // Update profile array
      profile[arrayName][index] = item

      updatedItems.push({
        entityType: link.entityType,
        entityId: link.entityId,
        entityName: item.title || item.name || item.label || 'Unknown',
        interviewUsage: item.interviewUsage
      })
    }

    // Save profile
    if (updatedItems.length > 0) {
      saveProfile(profile)
    }

    return {
      updated: updatedItems.length > 0,
      items: updatedItems
    }
  } catch (err) {
    return {
      updated: false,
      reason: err.message
    }
  }
}

/**
 * Get profile update suggestions based on accepted learnings
 *
 * @param {object} options - Options
 * @param {string} [options.mode='batch'] - 'batch' for individual items, 'aggregate' for grouped
 * @returns {Array<{ entityType: string, entityId: string, entityName: string, workedCount: number, needsWorkCount: number, recommendation: string, hasConflict: boolean }>}
 */
export function getProfileUpdateSuggestions(options = {}) {
  const { mode = 'batch' } = options

  // Load all accepted learnings with confirmed links
  const acceptedLearnings = loadAllAcceptedLearnings()

  // Group by profile item (entityType:entityId)
  const profileItemStats = new Map()

  for (const learning of acceptedLearnings) {
    for (const link of learning.confirmedProfileLinks || []) {
      const key = `${link.entityType}:${link.entityId}`

      if (!profileItemStats.has(key)) {
        profileItemStats.set(key, {
          entityType: link.entityType,
          entityId: link.entityId,
          workedCount: 0,
          needsWorkCount: 0,
          learnings: []
        })
      }

      const stats = profileItemStats.get(key)
      stats.learnings.push(learning)

      if (learning.outcome === 'worked') {
        stats.workedCount++
      } else if (learning.outcome === 'needs-work') {
        stats.needsWorkCount++
      }
    }
  }

  // Load profile to get entity names
  const profile = loadProfile()

  // Generate suggestions
  const suggestions = []

  for (const [key, stats] of profileItemStats) {
    const { item } = findProfileItem(profile, stats.entityType, stats.entityId)
    const entityName = item ? (item.title || item.name || item.label || 'Unknown') : 'Unknown'

    // Detect conflict: both worked AND needs-work outcomes
    const hasConflict = stats.workedCount > 0 && stats.needsWorkCount > 0

    // Generate recommendation
    let recommendation
    if (hasConflict) {
      recommendation = 'Review: Mixed results in interviews'
    } else if (stats.workedCount > stats.needsWorkCount) {
      recommendation = 'Working well - consider strengthening'
    } else if (stats.needsWorkCount > stats.workedCount) {
      recommendation = 'Consider revising based on feedback'
    } else {
      recommendation = 'Neutral results - monitor performance'
    }

    suggestions.push({
      entityType: stats.entityType,
      entityId: stats.entityId,
      entityName,
      workedCount: stats.workedCount,
      needsWorkCount: stats.needsWorkCount,
      recommendation,
      hasConflict
    })
  }

  // Sort by conflict status (conflicts first), then by total feedback count
  suggestions.sort((a, b) => {
    if (a.hasConflict && !b.hasConflict) return -1
    if (!a.hasConflict && b.hasConflict) return 1
    return (b.workedCount + b.needsWorkCount) - (a.workedCount + a.needsWorkCount)
  })

  return suggestions
}

/**
 * Detect recurring patterns across interviews
 *
 * @param {object} options - Options
 * @param {number} [options.minOccurrences=3] - Minimum occurrences to be a pattern
 * @param {number} [options.minCompanies=2] - Minimum different companies
 * @returns {Array<{ topic: string, occurrences: number, companies: Array<number>, outcomeDistribution: object, examples: Array<string> }>}
 */
export function getInterviewPatterns(options = {}) {
  const {
    minOccurrences = PATTERN_MIN_OCCURRENCES,
    minCompanies = PATTERN_MIN_COMPANIES
  } = options

  // Load all accepted learnings
  const acceptedLearnings = loadAllAcceptedLearnings()

  if (acceptedLearnings.length === 0) {
    return []
  }

  // Group by content similarity
  const groups = []

  for (const learning of acceptedLearnings) {
    let foundGroup = false

    for (const group of groups) {
      // Check similarity with first item in group
      const similarity = stringSimilarity(learning.content, group.representative)
      if (similarity >= PATTERN_SIMILARITY_THRESHOLD) {
        group.learnings.push(learning)
        foundGroup = true
        break
      }
    }

    if (!foundGroup) {
      groups.push({
        representative: learning.content,
        learnings: [learning]
      })
    }
  }

  // Filter and format patterns
  const patterns = []

  for (const group of groups) {
    // Get unique companies (jobIds)
    const companies = [...new Set(group.learnings.map(l => l.jobId))]

    // Check minimums
    if (group.learnings.length < minOccurrences || companies.length < minCompanies) {
      continue
    }

    // Get topic (use most common)
    const topicCounts = {}
    for (const learning of group.learnings) {
      topicCounts[learning.topic] = (topicCounts[learning.topic] || 0) + 1
    }
    const topic = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])[0][0]

    // Calculate outcome distribution
    const outcomeDistribution = {
      worked: 0,
      'needs-work': 0,
      neutral: 0
    }
    for (const learning of group.learnings) {
      outcomeDistribution[learning.outcome]++
    }

    // Get example contents (up to 3)
    const examples = group.learnings
      .slice(0, 3)
      .map(l => l.content)

    patterns.push({
      topic,
      occurrences: group.learnings.length,
      companies,
      outcomeDistribution,
      examples
    })
  }

  // Sort by occurrences descending
  patterns.sort((a, b) => b.occurrences - a.occurrences)

  return patterns
}

/**
 * Detect conflicts between learnings and profile content
 *
 * @param {object} options - Options (reserved for future use)
 * @returns {Array<{ entityType: string, entityId: string, conflictType: string, learnings: Array, suggestion: string }>}
 */
export function detectConflicts(options = {}) {
  // Load all accepted learnings
  const acceptedLearnings = loadAllAcceptedLearnings()

  // Load profile
  const profile = loadProfile()

  const conflicts = []

  // Group learnings by profile item
  const itemLearnings = new Map()

  for (const learning of acceptedLearnings) {
    for (const link of learning.confirmedProfileLinks || []) {
      const key = `${link.entityType}:${link.entityId}`

      if (!itemLearnings.has(key)) {
        itemLearnings.set(key, {
          entityType: link.entityType,
          entityId: link.entityId,
          learnings: []
        })
      }

      itemLearnings.get(key).learnings.push(learning)
    }
  }

  // Check for outcome conflicts on same item
  for (const [key, data] of itemLearnings) {
    const worked = data.learnings.filter(l => l.outcome === 'worked')
    const needsWork = data.learnings.filter(l => l.outcome === 'needs-work')

    if (worked.length > 0 && needsWork.length > 0) {
      const { item } = findProfileItem(profile, data.entityType, data.entityId)
      const entityName = item ? (item.title || item.name || item.label || 'Unknown') : 'Unknown'

      conflicts.push({
        entityType: data.entityType,
        entityId: data.entityId,
        entityName,
        conflictType: 'mixed-outcomes',
        learnings: data.learnings.map(l => ({
          id: l.id,
          content: l.content,
          outcome: l.outcome,
          jobId: l.jobId
        })),
        suggestion: `Review "${entityName}" - it has both positive and negative interview feedback. Consider if context matters or if revision is needed.`
      })
    }
  }

  // Check for content conflicts with profile
  // e.g., learning says "struggled with React hooks" but skill says "expert"
  for (const learning of acceptedLearnings) {
    if (learning.outcome !== 'needs-work') continue

    // Check if learning content conflicts with linked profile items
    for (const link of learning.confirmedProfileLinks || []) {
      const { item } = findProfileItem(profile, link.entityType, link.entityId)
      if (!item) continue

      // Get item content to compare
      let itemContent = ''
      if (link.entityType === 'skill') {
        // Check if skill level suggests high proficiency but learning indicates struggle
        const level = item.level || ''
        if (['expert', 'advanced'].includes(level.toLowerCase())) {
          // Check if learning content suggests struggle
          const struggleIndicators = ['struggled', 'difficult', 'failed', 'couldn\'t', 'unable', 'weak']
          const learningLower = learning.content.toLowerCase()
          const hasStruggle = struggleIndicators.some(s => learningLower.includes(s))

          if (hasStruggle) {
            const existingConflict = conflicts.find(
              c => c.entityId === link.entityId && c.conflictType === 'content-level-mismatch'
            )
            if (!existingConflict) {
              conflicts.push({
                entityType: link.entityType,
                entityId: link.entityId,
                entityName: item.name || 'Unknown',
                conflictType: 'content-level-mismatch',
                learnings: [{
                  id: learning.id,
                  content: learning.content,
                  outcome: learning.outcome,
                  jobId: learning.jobId
                }],
                suggestion: `Profile lists "${item.name}" as "${level}" but interview feedback suggests struggles. Consider reviewing skill level or identifying specific gaps.`
              })
            }
          }
        }
      }
    }
  }

  // Sort by conflict type (mixed-outcomes first as they're more actionable)
  conflicts.sort((a, b) => {
    if (a.conflictType === 'mixed-outcomes' && b.conflictType !== 'mixed-outcomes') return -1
    if (a.conflictType !== 'mixed-outcomes' && b.conflictType === 'mixed-outcomes') return 1
    return 0
  })

  return conflicts
}
