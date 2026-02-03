/**
 * Interview Learning Schema - Zod validation for interview transcripts and learnings
 *
 * Validates:
 * - Interview transcripts with metadata (date, type, vibe, confidence)
 * - Learning extractions with topic and outcome tagging
 * - Storage structures for per-job files
 *
 * Supports both strict validation (throws on error) and advisory mode (warns but continues).
 */

import { z } from 'zod'

// =============================================================================
// INTERVIEW TRANSCRIPT SCHEMA
// =============================================================================
export const InterviewTranscriptSchema = z.object({
  id: z.string().uuid(),
  jobId: z.number(),
  sessionType: z.enum(['practice', 'real-interview']),
  interviewDate: z.string(), // ISO date
  interviewerName: z.string().optional(),
  interviewType: z.enum(['phone', 'video', 'onsite']),
  confidenceLevel: z.enum(['high', 'medium', 'low']).optional(),
  overallVibe: z.enum(['went-well', 'neutral', 'rough']).optional(),
  rawTranscript: z.string(),
  highlights: z.array(z.string()).default([]),
  capturedAt: z.string(), // ISO date
  duration: z.number().optional(), // minutes
  practiceSessionId: z.string().uuid().optional(), // links to Phase 8 practice
  interviewerResearchId: z.string().uuid().optional()
})

// =============================================================================
// PROFILE LINK SCHEMAS (for suggested and confirmed links)
// =============================================================================
export const SuggestedProfileLinkSchema = z.object({
  entityType: z.enum(['story', 'skill', 'summary']),
  entityId: z.string().uuid(),
  linkReason: z.string()
})

export const ConfirmedProfileLinkSchema = z.object({
  entityType: z.enum(['story', 'skill', 'summary']),
  entityId: z.string().uuid(),
  linkedAt: z.string() // ISO date
})

// =============================================================================
// INTERVIEW LEARNING SCHEMA
// =============================================================================
export const InterviewLearningSchema = z.object({
  id: z.string().uuid(),
  jobId: z.number(),
  transcriptId: z.string().uuid(),
  extractedAt: z.string(), // ISO date
  content: z.string(),
  sourceQuote: z.string().optional(),
  topic: z.enum(['technical', 'behavioral', 'company-specific', 'compensation']),
  outcome: z.enum(['worked', 'needs-work', 'neutral']),
  suggestedProfileLinks: z.array(SuggestedProfileLinkSchema).default([]),
  confirmedProfileLinks: z.array(ConfirmedProfileLinkSchema).default([]),
  status: z.enum(['proposed', 'accepted', 'rejected']),
  reviewedAt: z.string().optional() // ISO date
})

// =============================================================================
// STORAGE SCHEMAS (for per-job JSON files)
// =============================================================================
export const TranscriptStorageSchema = z.object({
  interviews: z.array(InterviewTranscriptSchema),
  lastUpdated: z.string() // ISO date
})

export const LearningStorageSchema = z.object({
  learnings: z.array(InterviewLearningSchema),
  lastUpdated: z.string() // ISO date
})

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate interview transcript data with configurable mode
 *
 * @param {object} data - The transcript data to validate
 * @param {object} options - Validation options
 * @param {string} options.mode - 'advisory' (warn and return data) or 'strict' (throw on error)
 * @returns {{ valid: boolean, errors: Array, data: object }}
 */
export function validateInterviewTranscript(data, options = { mode: 'advisory' }) {
  const result = InterviewTranscriptSchema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received
    }))

    if (options.mode === 'strict') {
      throw new Error(`Interview transcript validation failed: ${JSON.stringify(errors, null, 2)}`)
    }

    // Advisory mode: warn but return original data
    return { valid: false, errors, data }
  }

  return { valid: true, errors: [], data: result.data }
}

/**
 * Validate interview learning data with configurable mode
 *
 * @param {object} data - The learning data to validate
 * @param {object} options - Validation options
 * @param {string} options.mode - 'advisory' (warn and return data) or 'strict' (throw on error)
 * @returns {{ valid: boolean, errors: Array, data: object }}
 */
export function validateInterviewLearning(data, options = { mode: 'advisory' }) {
  const result = InterviewLearningSchema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received
    }))

    if (options.mode === 'strict') {
      throw new Error(`Interview learning validation failed: ${JSON.stringify(errors, null, 2)}`)
    }

    // Advisory mode: warn but return original data
    return { valid: false, errors, data }
  }

  return { valid: true, errors: [], data: result.data }
}

/**
 * Validate transcript storage data with configurable mode
 *
 * @param {object} data - The storage data to validate
 * @param {object} options - Validation options
 * @param {string} options.mode - 'advisory' (warn and return data) or 'strict' (throw on error)
 * @returns {{ valid: boolean, errors: Array, data: object }}
 */
export function validateTranscriptStorage(data, options = { mode: 'advisory' }) {
  const result = TranscriptStorageSchema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received
    }))

    if (options.mode === 'strict') {
      throw new Error(`Transcript storage validation failed: ${JSON.stringify(errors, null, 2)}`)
    }

    // Advisory mode: warn but return original data
    return { valid: false, errors, data }
  }

  return { valid: true, errors: [], data: result.data }
}

/**
 * Validate learning storage data with configurable mode
 *
 * @param {object} data - The storage data to validate
 * @param {object} options - Validation options
 * @param {string} options.mode - 'advisory' (warn and return data) or 'strict' (throw on error)
 * @returns {{ valid: boolean, errors: Array, data: object }}
 */
export function validateLearningStorage(data, options = { mode: 'advisory' }) {
  const result = LearningStorageSchema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received
    }))

    if (options.mode === 'strict') {
      throw new Error(`Learning storage validation failed: ${JSON.stringify(errors, null, 2)}`)
    }

    // Advisory mode: warn but return original data
    return { valid: false, errors, data }
  }

  return { valid: true, errors: [], data: result.data }
}
