/**
 * Learning Extractor Service
 * Phase 9: Interview Learning - Learning extraction, review, and profile linking
 *
 * Provides:
 * - queueInterviewLearning: Queue learning for review with duplicate detection
 * - reviewInterviewLearning: Accept or reject proposed learnings
 * - linkLearningToProfile: Confirm profile links for accepted learnings
 * - getLearningsForJob: Get learnings for a specific job
 * - getPendingLearnings: Get all pending learnings across jobs
 *
 * Per CONTEXT.md:
 * - Each learning tagged with BOTH topic AND outcome (dual tagging)
 * - Learnings are proposed for user review (user accepts/rejects)
 * - Profile links are suggested, user confirms before link is made
 */

import { v4 as uuidv4 } from 'uuid'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import { stringSimilarity, getOverlapCandidates } from '../data/learning-queue.js'
import { loadProfile } from '../data/profile-loader.js'
import { validateInterviewLearning, validateLearningStorage } from '../../../schemas/interview-learning.schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const RESEARCH_DIR = join(DATA_DIR, 'job-research')

// Similarity threshold for duplicate detection
const DUPLICATE_SIMILARITY_THRESHOLD = 0.85
// Similarity threshold for profile link suggestions
const LINK_SUGGESTION_THRESHOLD = 0.7

// Ensure research directory exists
if (!existsSync(RESEARCH_DIR)) {
  mkdirSync(RESEARCH_DIR, { recursive: true })
}

/**
 * Atomic file write using temp file + rename pattern
 */
function atomicWriteSync(filePath, data) {
  const tempPath = join(tmpdir(), `learning-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`)
  try {
    writeFileSync(tempPath, data, 'utf-8')
    renameSync(tempPath, filePath)
  } catch (err) {
    try { unlinkSync(tempPath) } catch (e) { /* ignore */ }
    throw err
  }
}

/**
 * Get learnings file path for a job
 */
function getLearningsPath(jobId) {
  return join(RESEARCH_DIR, `${jobId}-learnings.json`)
}

/**
 * Load learnings data for a job
 *
 * @param {number} jobId - Job ID
 * @returns {{ learnings: Array, lastUpdated: string }}
 */
function loadLearningsData(jobId) {
  const learningsPath = getLearningsPath(jobId)

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
  const learningsPath = getLearningsPath(jobId)
  data.lastUpdated = new Date().toISOString()
  atomicWriteSync(learningsPath, JSON.stringify(data, null, 2))
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
 * Find suggested profile links for a learning based on topic
 *
 * @param {object} learning - The learning to find links for
 * @returns {Array<{ entityType: string, entityId: string, linkReason: string }>}
 */
function findSuggestedProfileLinks(learning) {
  const profile = loadProfile()
  const suggestions = []

  // Determine which profile items to search based on topic
  if (learning.topic === 'behavioral') {
    // Search stories
    for (const story of profile.stories || []) {
      const titleSim = stringSimilarity(learning.content, story.title || '')
      const situationSim = stringSimilarity(learning.content, story.situation || '')
      const similarity = Math.max(titleSim, situationSim)
      if (similarity >= LINK_SUGGESTION_THRESHOLD) {
        suggestions.push({
          entityType: 'story',
          entityId: story.id,
          linkReason: `Similar to story: ${story.title} (${Math.round(similarity * 100)}% match)`
        })
      }
    }
  } else if (learning.topic === 'technical') {
    // Search skills
    for (const skill of profile.skills || []) {
      const similarity = stringSimilarity(learning.content, skill.name || '')
      if (similarity >= LINK_SUGGESTION_THRESHOLD) {
        suggestions.push({
          entityType: 'skill',
          entityId: skill.id,
          linkReason: `Related to skill: ${skill.name} (${Math.round(similarity * 100)}% match)`
        })
      }
    }
  } else if (learning.topic === 'company-specific' || learning.topic === 'compensation') {
    // Search summaries
    for (const summary of profile.summaryBlocks || []) {
      const similarity = stringSimilarity(learning.content, summary.content || '')
      if (similarity >= LINK_SUGGESTION_THRESHOLD) {
        suggestions.push({
          entityType: 'summary',
          entityId: summary.id,
          linkReason: `Related to summary: ${summary.label || 'Untitled'} (${Math.round(similarity * 100)}% match)`
        })
      }
    }
  }

  // Sort by relevance (implied by order of checks) and limit
  return suggestions.slice(0, 5)
}

/**
 * Queue an interview learning for user review
 *
 * Required fields: jobId, transcriptId, content, topic, outcome
 *
 * @param {object} learning - Learning data to queue
 * @returns {{ queued: boolean, id?: string, hasSuggestedLinks?: boolean, reason?: string }}
 */
export function queueInterviewLearning(learning) {
  try {
    // Validate required fields
    if (!learning.jobId) {
      return { queued: false, reason: 'Missing required field: jobId' }
    }
    if (!learning.transcriptId) {
      return { queued: false, reason: 'Missing required field: transcriptId' }
    }
    if (!learning.content || learning.content.trim() === '') {
      return { queued: false, reason: 'Missing required field: content' }
    }
    if (!learning.topic) {
      return { queued: false, reason: 'Missing required field: topic' }
    }
    if (!learning.outcome) {
      return { queued: false, reason: 'Missing required field: outcome' }
    }

    // Generate UUID if not provided
    if (!learning.id) {
      learning.id = uuidv4()
    }

    // Set extractedAt to now
    learning.extractedAt = new Date().toISOString()

    // Set status to proposed
    learning.status = 'proposed'

    // Initialize arrays if not present
    learning.suggestedProfileLinks = learning.suggestedProfileLinks || []
    learning.confirmedProfileLinks = learning.confirmedProfileLinks || []

    // Load existing learnings for job to check for duplicates
    const learningsData = loadLearningsData(learning.jobId)

    // Check for duplicate (stringSimilarity > 0.85 with existing learnings)
    for (const existing of learningsData.learnings) {
      const similarity = stringSimilarity(learning.content, existing.content)
      if (similarity > DUPLICATE_SIMILARITY_THRESHOLD) {
        return {
          queued: false,
          reason: 'Similar learning exists',
          existingId: existing.id,
          similarity: Math.round(similarity * 100)
        }
      }
    }

    // Find suggested profile links
    const suggestedLinks = findSuggestedProfileLinks(learning)
    learning.suggestedProfileLinks = suggestedLinks

    // Validate with InterviewLearningSchema
    const validation = validateInterviewLearning(learning, { mode: 'strict' })
    if (!validation.valid) {
      return {
        queued: false,
        reason: `Validation failed: ${JSON.stringify(validation.errors)}`
      }
    }

    const validatedLearning = validation.data

    // Add to learnings array
    learningsData.learnings.push(validatedLearning)

    // Save with atomic write
    saveLearningsData(learning.jobId, learningsData)

    return {
      queued: true,
      id: validatedLearning.id,
      hasSuggestedLinks: suggestedLinks.length > 0
    }
  } catch (err) {
    return {
      queued: false,
      reason: err.message
    }
  }
}

/**
 * Review an interview learning (accept or reject)
 *
 * @param {string} learningId - UUID of the learning to review
 * @param {{ status: 'accepted' | 'rejected' }} decision - Review decision
 * @returns {{ updated: boolean, learning?: object, reason?: string }}
 */
export function reviewInterviewLearning(learningId, decision) {
  try {
    // Validate decision
    if (!decision || !decision.status) {
      return { updated: false, reason: 'Missing decision status' }
    }
    if (!['accepted', 'rejected'].includes(decision.status)) {
      return { updated: false, reason: 'Invalid decision status. Must be "accepted" or "rejected"' }
    }

    // Find the learning
    const { learning, jobId, index } = findLearning(learningId)

    if (!learning) {
      return { updated: false, reason: 'Learning not found' }
    }

    // Learning must be in 'proposed' status to review
    if (learning.status !== 'proposed') {
      return { updated: false, reason: `Learning is already ${learning.status}. Only proposed learnings can be reviewed.` }
    }

    // Load learnings data to update
    const learningsData = loadLearningsData(jobId)

    // Update status and reviewedAt
    learningsData.learnings[index].status = decision.status
    learningsData.learnings[index].reviewedAt = new Date().toISOString()

    // Save changes
    saveLearningsData(jobId, learningsData)

    return {
      updated: true,
      learning: learningsData.learnings[index]
    }
  } catch (err) {
    return {
      updated: false,
      reason: err.message
    }
  }
}

/**
 * Confirm a profile link for an accepted learning
 *
 * @param {string} learningId - UUID of the learning
 * @param {{ entityType: 'story'|'skill'|'summary', entityId: string }} profileLink - Link to confirm
 * @returns {{ linked: boolean, link?: object, reason?: string }}
 */
export function linkLearningToProfile(learningId, profileLink) {
  try {
    // Validate profile link
    if (!profileLink || !profileLink.entityType || !profileLink.entityId) {
      return { linked: false, reason: 'Missing entityType or entityId' }
    }
    if (!['story', 'skill', 'summary'].includes(profileLink.entityType)) {
      return { linked: false, reason: 'Invalid entityType. Must be "story", "skill", or "summary"' }
    }

    // Find the learning
    const { learning, jobId, index } = findLearning(learningId)

    if (!learning) {
      return { linked: false, reason: 'Learning not found' }
    }

    // Learning must be 'accepted' status to link
    if (learning.status !== 'accepted') {
      return { linked: false, reason: `Learning must be accepted before linking. Current status: ${learning.status}` }
    }

    // Check if already linked to this item
    const existingLink = (learning.confirmedProfileLinks || []).find(
      l => l.entityType === profileLink.entityType && l.entityId === profileLink.entityId
    )
    if (existingLink) {
      return { linked: false, reason: 'Profile item is already linked to this learning' }
    }

    // Create confirmed link
    const confirmedLink = {
      entityType: profileLink.entityType,
      entityId: profileLink.entityId,
      linkedAt: new Date().toISOString()
    }

    // Load learnings data to update
    const learningsData = loadLearningsData(jobId)

    // Initialize confirmedProfileLinks if not present
    if (!learningsData.learnings[index].confirmedProfileLinks) {
      learningsData.learnings[index].confirmedProfileLinks = []
    }

    // Add to confirmedProfileLinks
    learningsData.learnings[index].confirmedProfileLinks.push(confirmedLink)

    // Remove from suggestedProfileLinks if present
    if (learningsData.learnings[index].suggestedProfileLinks) {
      learningsData.learnings[index].suggestedProfileLinks =
        learningsData.learnings[index].suggestedProfileLinks.filter(
          l => !(l.entityType === profileLink.entityType && l.entityId === profileLink.entityId)
        )
    }

    // Save changes
    saveLearningsData(jobId, learningsData)

    return {
      linked: true,
      link: confirmedLink
    }
  } catch (err) {
    return {
      linked: false,
      reason: err.message
    }
  }
}

/**
 * Get all learnings for a job
 *
 * @param {number} jobId - Job ID
 * @param {object} options - Filter options
 * @param {string} [options.status] - Filter by status ('proposed'|'accepted'|'rejected')
 * @returns {Array<object>} Array of learnings
 */
export function getLearningsForJob(jobId, options = {}) {
  const { status } = options
  const learningsData = loadLearningsData(jobId)

  if (status) {
    return learningsData.learnings.filter(l => l.status === status)
  }

  return learningsData.learnings
}

/**
 * Get all pending learnings across all jobs
 *
 * @param {object} options - Options
 * @param {number} [options.limit=20] - Maximum number to return
 * @returns {Array<object>} Array of pending learnings with jobId included
 */
export function getPendingLearnings(options = { limit: 20 }) {
  const { limit = 20 } = options
  const pendingLearnings = []

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

      // Filter for proposed status and add jobId
      for (const learning of learningsData.learnings) {
        if (learning.status === 'proposed') {
          pendingLearnings.push({
            ...learning,
            jobId // Ensure jobId is included
          })
        }
      }
    }

    // Sort by extractedAt descending (newest first)
    pendingLearnings.sort((a, b) => {
      const dateA = new Date(a.extractedAt)
      const dateB = new Date(b.extractedAt)
      return dateB - dateA
    })

    // Apply limit
    return pendingLearnings.slice(0, limit)
  } catch (e) {
    console.error('Error getting pending learnings:', e.message)
    return []
  }
}
