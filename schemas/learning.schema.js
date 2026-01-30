/**
 * Learning Schema - Zod validation for learning queue, extraction, and cleanup data
 *
 * Validates:
 * - Extraction entries for profile learning from conversations
 * - Learning queue structure for pending/confirmed extractions
 * - Cleanup findings from duplicate detection, staleness detection, and gap analysis
 *
 * Supports both strict validation (throws on error) and advisory mode (warns but continues).
 */

import { z } from 'zod'

// =============================================================================
// EXTRACTION SCHEMA (Insights extracted from conversations)
// =============================================================================
export const ExtractionSchema = z.object({
  id: z.string().uuid(),
  category: z.enum(['skill', 'achievement', 'preference', 'story', 'pattern']),
  content: z.string().min(1), // The extracted insight
  confidence: z.enum(['high', 'medium', 'low']),
  sourceQuote: z.string().optional(), // Text that supports this extraction
  overlapWith: z.string().uuid().optional(), // Existing profile item ID if potential update
  targetField: z.string().optional(), // Where in profile this should go
  detectedAt: z.string(), // ISO timestamp
  status: z.enum(['pending', 'confirmed', 'rejected', 'merged'])
})

// =============================================================================
// LEARNING QUEUE SCHEMA (Queue for pending extractions)
// =============================================================================
export const LearningQueueSchema = z.object({
  pending: z.array(ExtractionSchema).default([]),
  history: z.array(ExtractionSchema).default([]), // Confirmed/rejected extractions
  lastProcessed: z.string().nullable().default(null)
})

// =============================================================================
// CLEANUP FINDING SCHEMA (Individual finding from any detector)
// =============================================================================
export const CleanupFindingSchema = z.object({
  type: z.enum(['duplicate', 'stale', 'gap']),
  entityType: z.enum(['skill', 'story', 'experience', 'summary']),
  ids: z.array(z.string()).min(1), // Affected entity IDs
  similarity: z.number().min(0).max(100).optional(), // For duplicates - percentage
  reason: z.string().min(1), // Human-readable explanation (WHY it matters)
  suggestion: z.string().min(1), // Actionable recommendation (HOW to fix)
  relevantTo: z.string().optional(), // Job context that triggered this
  createdAt: z.string() // ISO timestamp
})

// =============================================================================
// CLEANUP RESULT SCHEMA (Full result from cleanup analysis)
// =============================================================================
export const CleanupResultSchema = z.object({
  runAt: z.string(), // ISO timestamp
  duplicates: z.array(CleanupFindingSchema).default([]),
  stale: z.array(CleanupFindingSchema).default([]),
  gaps: z.array(CleanupFindingSchema).default([]),
  status: z.enum(['complete', 'partial', 'error'])
})

// =============================================================================
// DISMISSED FINDING SCHEMA (For tracking dismissed findings)
// =============================================================================
export const DismissedFindingSchema = z.object({
  findingHash: z.string(), // Hash of finding for identification
  dismissedAt: z.string(), // ISO timestamp
  reason: z.string().optional() // User's reason for dismissing
})

// =============================================================================
// STORED CLEANUP FINDINGS SCHEMA (For cleanup-findings.json)
// =============================================================================
export const StoredCleanupFindingsSchema = z.object({
  lastRun: z.string(), // ISO timestamp of most recent run
  runs: z.array(CleanupResultSchema).max(4), // Keep last 4 runs
  dismissed: z.array(DismissedFindingSchema).default([])
})

/**
 * Validate extraction data with configurable mode
 *
 * @param {object} data - The extraction data to validate
 * @param {object} options - Validation options
 * @param {string} options.mode - 'advisory' (warn and return data) or 'strict' (throw on error)
 * @returns {{ valid: boolean, errors: Array, data: object }}
 */
export function validateExtraction(data, options = { mode: 'advisory' }) {
  const result = ExtractionSchema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received
    }))

    if (options.mode === 'strict') {
      throw new Error(`Extraction validation failed: ${JSON.stringify(errors, null, 2)}`)
    }

    // Advisory mode: warn but return original data
    return { valid: false, errors, data }
  }

  return { valid: true, errors: [], data: result.data }
}

/**
 * Validate learning queue data with configurable mode
 *
 * @param {object} data - The learning queue data to validate
 * @param {object} options - Validation options
 * @param {string} options.mode - 'advisory' (warn and return data) or 'strict' (throw on error)
 * @returns {{ valid: boolean, errors: Array, data: object }}
 */
export function validateLearningQueue(data, options = { mode: 'advisory' }) {
  const result = LearningQueueSchema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received
    }))

    if (options.mode === 'strict') {
      throw new Error(`Learning queue validation failed: ${JSON.stringify(errors, null, 2)}`)
    }

    // Advisory mode: warn but return original data
    return { valid: false, errors, data }
  }

  return { valid: true, errors: [], data: result.data }
}

/**
 * Validate a cleanup finding with configurable mode
 *
 * @param {object} data - The cleanup finding to validate
 * @param {object} options - Validation options
 * @param {string} options.mode - 'advisory' (warn and return data) or 'strict' (throw on error)
 * @returns {{ valid: boolean, errors: Array, data: object }}
 */
export function validateCleanupFinding(data, options = { mode: 'advisory' }) {
  const result = CleanupFindingSchema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received
    }))

    if (options.mode === 'strict') {
      throw new Error(`Cleanup finding validation failed: ${JSON.stringify(errors, null, 2)}`)
    }

    // Advisory mode: warn but return original data
    return { valid: false, errors, data }
  }

  return { valid: true, errors: [], data: result.data }
}

/**
 * Validate a cleanup result with configurable mode
 *
 * @param {object} data - The cleanup result to validate
 * @param {object} options - Validation options
 * @param {string} options.mode - 'advisory' (warn and return data) or 'strict' (throw on error)
 * @returns {{ valid: boolean, errors: Array, data: object }}
 */
export function validateCleanupResult(data, options = { mode: 'advisory' }) {
  const result = CleanupResultSchema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received
    }))

    if (options.mode === 'strict') {
      throw new Error(`Cleanup result validation failed: ${JSON.stringify(errors, null, 2)}`)
    }

    // Advisory mode: warn but return original data
    return { valid: false, errors, data }
  }

  return { valid: true, errors: [], data: result.data }
}
