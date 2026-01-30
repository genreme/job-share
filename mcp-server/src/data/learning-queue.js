/**
 * Learning Queue - Queue persistence and management for profile extractions
 *
 * Handles:
 * - Queue persistence with atomic writes
 * - Extraction queueing with overlap detection
 * - String similarity for finding related profile items
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { validateLearningQueue } from '../../../schemas/learning.schema.js'
import { loadProfile } from './profile-loader.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..', '..', '..')
const DATA_DIR = join(PROJECT_ROOT, 'mcp-server', 'data')
const QUEUE_PATH = join(DATA_DIR, 'learning-queue.json')

/**
 * Calculate string similarity using Levenshtein distance
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Similarity score between 0 and 1
 */
export function stringSimilarity(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1

  const aLower = a.toLowerCase().trim()
  const bLower = b.toLowerCase().trim()

  if (aLower === bLower) return 1

  // Check if one contains the other
  if (aLower.includes(bLower) || bLower.includes(aLower)) {
    return 0.8
  }

  // Levenshtein distance
  const matrix = []
  const aLen = aLower.length
  const bLen = bLower.length

  if (aLen === 0) return 0
  if (bLen === 0) return 0

  for (let i = 0; i <= bLen; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= aLen; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= bLen; i++) {
    for (let j = 1; j <= aLen; j++) {
      if (bLower.charAt(i - 1) === aLower.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        )
      }
    }
  }

  const distance = matrix[bLen][aLen]
  const maxLen = Math.max(aLen, bLen)
  return 1 - distance / maxLen
}

/**
 * Create an empty learning queue
 *
 * @returns {object} Empty queue structure
 */
export function createEmptyQueue() {
  return {
    pending: [],
    history: [],
    lastProcessed: null
  }
}

/**
 * Load learning queue from disk
 *
 * Creates an empty queue if none exists.
 * Validates loaded queue and logs warnings in advisory mode.
 *
 * @returns {object} The loaded or newly created queue
 */
export function loadLearningQueue() {
  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }

  // If queue doesn't exist, create and save empty queue
  if (!existsSync(QUEUE_PATH)) {
    const emptyQueue = createEmptyQueue()
    saveLearningQueue(emptyQueue)
    console.error('Created new empty learning queue at:', QUEUE_PATH)
    return emptyQueue
  }

  // Load and validate existing queue
  try {
    const content = readFileSync(QUEUE_PATH, 'utf-8')
    const data = JSON.parse(content)

    const validation = validateLearningQueue(data)
    if (!validation.valid) {
      console.error('Learning queue validation warnings:', validation.errors)
    }

    console.error('Loaded learning queue from:', QUEUE_PATH)
    return validation.data
  } catch (e) {
    console.error('Error loading learning queue:', e.message)
    // Return empty queue on error
    return createEmptyQueue()
  }
}

/**
 * Save learning queue to disk with atomic write
 *
 * Uses write-then-rename pattern to prevent corruption.
 * Validates before save and logs warnings in advisory mode.
 *
 * @param {object} queue - The queue to save
 * @returns {{ success: boolean, warnings: Array }} Save result
 */
export function saveLearningQueue(queue) {
  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }

  // Validate before save
  const validation = validateLearningQueue(queue)
  if (!validation.valid) {
    console.error('Learning queue validation warnings (saving anyway - advisory mode):', validation.errors)
  }

  try {
    // Atomic write: write to temp, then rename
    const tempPath = QUEUE_PATH + '.tmp'
    writeFileSync(tempPath, JSON.stringify(queue, null, 2))
    renameSync(tempPath, QUEUE_PATH)

    return { success: true, warnings: validation.errors }
  } catch (e) {
    console.error('Error saving learning queue:', e.message)
    return { success: false, warnings: validation.errors }
  }
}

/**
 * Get overlap candidates from profile for a given extraction
 *
 * Searches profile for items that might overlap with the extraction.
 * Uses string similarity to find potential matches.
 *
 * @param {object} extraction - The extraction to find overlaps for
 * @returns {Array<{ profileItemId: string, similarity: number, field: string }>}
 */
export function getOverlapCandidates(extraction) {
  const profile = loadProfile()
  const candidates = []
  const SIMILARITY_THRESHOLD = 0.7

  switch (extraction.category) {
    case 'skill':
      // Compare with existing skills
      for (const skill of profile.skills || []) {
        const similarity = stringSimilarity(extraction.content, skill.name)
        if (similarity >= SIMILARITY_THRESHOLD) {
          candidates.push({
            profileItemId: skill.id,
            similarity,
            field: 'skills'
          })
        }
      }
      break

    case 'story':
      // Compare with existing stories (by title and situation)
      for (const story of profile.stories || []) {
        const titleSim = stringSimilarity(extraction.content, story.title)
        const sitSim = stringSimilarity(extraction.content, story.situation)
        const similarity = Math.max(titleSim, sitSim)
        if (similarity >= SIMILARITY_THRESHOLD) {
          candidates.push({
            profileItemId: story.id,
            similarity,
            field: 'stories'
          })
        }
      }
      break

    case 'achievement':
      // Compare with project descriptions
      for (const exp of profile.experience || []) {
        for (const project of exp.projects || []) {
          const similarity = stringSimilarity(extraction.content, project.description)
          if (similarity >= SIMILARITY_THRESHOLD) {
            candidates.push({
              profileItemId: project.id,
              similarity,
              field: `experience.${exp.id}.projects`
            })
          }
        }
      }
      break

    case 'preference':
      // Check existing preferences - harder to match, use content analysis
      const prefs = profile.preferences || {}
      if (prefs.communication) {
        // Check emphasis areas and custom guidelines
        const emphasisMatch = (prefs.communication.emphasisAreas || []).some(
          (area) => stringSimilarity(extraction.content, area) >= SIMILARITY_THRESHOLD
        )
        if (emphasisMatch) {
          candidates.push({
            profileItemId: 'preferences.communication',
            similarity: 0.75,
            field: 'preferences.communication'
          })
        }
      }
      break

    case 'pattern':
      // Patterns are typically new, check metadata if patterns field exists
      if (profile.metadata?.patterns) {
        for (const pattern of profile.metadata.patterns) {
          const similarity = stringSimilarity(extraction.content, pattern)
          if (similarity >= SIMILARITY_THRESHOLD) {
            candidates.push({
              profileItemId: 'metadata.patterns',
              similarity,
              field: 'metadata.patterns'
            })
          }
        }
      }
      break
  }

  // Sort by similarity descending
  return candidates.sort((a, b) => b.similarity - a.similarity)
}

/**
 * Queue an extraction for user confirmation
 *
 * Assigns UUID if not present, sets status to 'pending',
 * checks for overlap with existing profile data.
 *
 * @param {object} extraction - The extraction to queue
 * @returns {{ queued: boolean, id: string, hasOverlap: boolean, overlapWith?: string }}
 */
export function queueExtraction(extraction) {
  // Assign UUID if not present
  const id = extraction.id || uuidv4()

  // Set status and timestamp
  const now = new Date().toISOString()
  const fullExtraction = {
    ...extraction,
    id,
    status: 'pending',
    detectedAt: extraction.detectedAt || now
  }

  // Check for overlaps
  const overlaps = getOverlapCandidates(fullExtraction)
  const hasOverlap = overlaps.length > 0

  if (hasOverlap) {
    fullExtraction.overlapWith = overlaps[0].profileItemId
  }

  // Load queue, add extraction, save
  const queue = loadLearningQueue()
  queue.pending.push(fullExtraction)
  saveLearningQueue(queue)

  return {
    queued: true,
    id,
    hasOverlap,
    overlapWith: hasOverlap ? overlaps[0].profileItemId : undefined
  }
}

/**
 * Get the queue file path (for testing purposes)
 *
 * @returns {string} The absolute path to the queue file
 */
export function getQueuePath() {
  return QUEUE_PATH
}
