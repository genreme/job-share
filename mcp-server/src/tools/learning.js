/**
 * Learning Tools - MCP tool implementations for profile learning workflow
 *
 * Provides tools for:
 * - queue_profile_extraction: Queue insights from conversations (PROF-14 passive learning)
 * - get_pending_extractions: View pending extractions
 * - confirm_extraction: Confirm/reject/merge an extraction
 * - batch_confirm_extractions: Bulk confirm/reject
 * - get_extraction_history: View past extractions
 *
 * The "passive learning" (PROF-14) happens through Claude proactively calling
 * queue_profile_extraction during normal conversations when professional info is detected.
 */

import {
  loadLearningQueue,
  saveLearningQueue,
  queueExtraction,
  getOverlapCandidates
} from '../data/learning-queue.js'
import { loadProfile, saveProfile } from '../data/profile-loader.js'
import { addExtractionToProfile, mergeWithExisting } from '../services/extraction-mapper.js'

/**
 * Queue a profile extraction from conversation
 *
 * This tool enables PROF-14 (passive learning). Claude should proactively call
 * this tool during normal conversations whenever it detects professional
 * information worth capturing - skills mentioned, achievements discussed,
 * preferences expressed, story elements shared, or work patterns observed.
 *
 * @param {object} params - Parameters
 * @param {string} params.category - 'skill' | 'achievement' | 'preference' | 'story' | 'pattern'
 * @param {string} params.content - The extracted insight
 * @param {string} params.confidence - 'high' | 'medium' | 'low'
 * @param {string} [params.sourceQuote] - Supporting text from conversation
 * @param {string} [params.targetField] - Specific field path if known
 * @returns {{ queued: boolean, id: string, hasOverlap: boolean, suggestion: string }}
 */
export function queueProfileExtraction({ category, content, confidence, sourceQuote, targetField }) {
  if (!category || !content || !confidence) {
    return { error: 'category, content, and confidence are required' }
  }

  const validCategories = ['skill', 'achievement', 'preference', 'story', 'pattern']
  if (!validCategories.includes(category)) {
    return { error: `category must be one of: ${validCategories.join(', ')}` }
  }

  const validConfidences = ['high', 'medium', 'low']
  if (!validConfidences.includes(confidence)) {
    return { error: `confidence must be one of: ${validConfidences.join(', ')}` }
  }

  try {
    const extraction = {
      category,
      content,
      confidence,
      sourceQuote,
      targetField
    }

    const result = queueExtraction(extraction)

    // Determine suggestion based on confidence
    let suggestion = 'batch' // Default for low confidence
    if (confidence === 'high') {
      suggestion = 'confirm_inline'
    } else if (confidence === 'medium') {
      suggestion = 'review_soon'
    }

    return {
      queued: result.queued,
      id: result.id,
      hasOverlap: result.hasOverlap,
      overlapWith: result.overlapWith,
      suggestion
    }
  } catch (error) {
    return { error: `Failed to queue extraction: ${error.message}` }
  }
}

/**
 * Get pending extractions
 *
 * Returns pending extractions sorted by confidence (high first).
 *
 * @param {object} params - Parameters
 * @param {object} [params.filter] - Filter options
 * @param {string} [params.filter.category] - Filter by category
 * @param {string} [params.filter.confidence] - Filter by confidence
 * @param {number} [params.limit] - Maximum number to return
 * @returns {Array} Pending extractions with overlap info
 */
export function getPendingExtractions({ filter, limit } = {}) {
  try {
    const queue = loadLearningQueue()
    let pending = [...queue.pending]

    // Apply filters
    if (filter?.category) {
      pending = pending.filter((e) => e.category === filter.category)
    }
    if (filter?.confidence) {
      pending = pending.filter((e) => e.confidence === filter.confidence)
    }

    // Sort by confidence (high > medium > low)
    const confidenceOrder = { high: 0, medium: 1, low: 2 }
    pending.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence])

    // Apply limit
    if (limit && limit > 0) {
      pending = pending.slice(0, limit)
    }

    // Add overlap info for each
    const results = pending.map((extraction) => {
      const overlaps = getOverlapCandidates(extraction)
      return {
        ...extraction,
        overlaps: overlaps.slice(0, 3) // Top 3 overlap candidates
      }
    })

    return results
  } catch (error) {
    return { error: `Failed to get pending extractions: ${error.message}` }
  }
}

/**
 * Confirm, reject, or merge an extraction
 *
 * @param {object} params - Parameters
 * @param {string} params.extractionId - The extraction ID
 * @param {string} params.action - 'confirm' | 'reject' | 'merge'
 * @param {string} [params.targetField] - Override target field for confirm
 * @param {string} [params.mergeWith] - Profile item ID to merge with
 * @returns {{ success: boolean, profileUpdated: boolean, extraction: object }}
 */
export function confirmExtraction({ extractionId, action, targetField, mergeWith }) {
  if (!extractionId || !action) {
    return { error: 'extractionId and action are required' }
  }

  const validActions = ['confirm', 'reject', 'merge']
  if (!validActions.includes(action)) {
    return { error: `action must be one of: ${validActions.join(', ')}` }
  }

  if (action === 'merge' && !mergeWith) {
    return { error: 'mergeWith is required for merge action' }
  }

  try {
    const queue = loadLearningQueue()

    // Find the extraction
    const extractionIndex = queue.pending.findIndex((e) => e.id === extractionId)
    if (extractionIndex === -1) {
      return { error: 'Extraction not found in pending queue' }
    }

    const extraction = { ...queue.pending[extractionIndex] }
    let profileUpdated = false

    if (action === 'confirm') {
      // Add to profile
      const profile = loadProfile()
      const updatedProfile = addExtractionToProfile(profile, extraction, targetField)
      saveProfile(updatedProfile)
      extraction.status = 'confirmed'
      profileUpdated = true
    } else if (action === 'reject') {
      // Just update status
      extraction.status = 'rejected'
    } else if (action === 'merge') {
      // Merge with existing profile item
      const profile = loadProfile()
      const updatedProfile = mergeWithExisting(profile, extraction, mergeWith)
      saveProfile(updatedProfile)
      extraction.status = 'merged'
      profileUpdated = true
    }

    // Remove from pending, add to history
    queue.pending.splice(extractionIndex, 1)
    queue.history.push(extraction)
    queue.lastProcessed = new Date().toISOString()
    saveLearningQueue(queue)

    return {
      success: true,
      profileUpdated,
      extraction
    }
  } catch (error) {
    return { error: `Failed to confirm extraction: ${error.message}` }
  }
}

/**
 * Batch confirm or reject multiple extractions
 *
 * @param {object} params - Parameters
 * @param {string[]} params.extractionIds - Array of extraction IDs
 * @param {string} params.action - 'confirm' | 'reject'
 * @returns {{ processed: number, failed: Array, profileUpdated: boolean }}
 */
export function batchConfirmExtractions({ extractionIds, action }) {
  if (!extractionIds || !Array.isArray(extractionIds) || extractionIds.length === 0) {
    return { error: 'extractionIds must be a non-empty array' }
  }

  const validActions = ['confirm', 'reject']
  if (!action || !validActions.includes(action)) {
    return { error: `action must be one of: ${validActions.join(', ')}` }
  }

  const results = {
    processed: 0,
    failed: [],
    profileUpdated: false
  }

  for (const extractionId of extractionIds) {
    const result = confirmExtraction({ extractionId, action })

    if (result.error) {
      results.failed.push({ id: extractionId, error: result.error })
    } else {
      results.processed++
      if (result.profileUpdated) {
        results.profileUpdated = true
      }
    }
  }

  return results
}

/**
 * Get extraction history
 *
 * Returns past extractions that have been confirmed, rejected, or merged.
 *
 * @param {object} params - Parameters
 * @param {string} [params.status] - Filter by status: 'confirmed' | 'rejected' | 'merged'
 * @param {number} [params.limit] - Maximum number to return
 * @returns {Array} Past extractions
 */
export function getExtractionHistory({ status, limit } = {}) {
  try {
    const queue = loadLearningQueue()
    let history = [...queue.history]

    // Apply status filter
    if (status) {
      history = history.filter((e) => e.status === status)
    }

    // Sort by most recent first
    history.sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt))

    // Apply limit
    if (limit && limit > 0) {
      history = history.slice(0, limit)
    }

    return history
  } catch (error) {
    return { error: `Failed to get extraction history: ${error.message}` }
  }
}
