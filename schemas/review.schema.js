/**
 * Review Schema - Zod validation for document review results
 *
 * Provides validation for grammar, ATS compatibility, tone, length,
 * and factual accuracy checks on generated documents.
 *
 * APPL-12: Full review before use (grammar, spelling, ATS, keyword coverage,
 * tone consistency, length limits, factual accuracy against profile)
 */

import { z } from 'zod'

/**
 * Issue types for document review
 */
export const IssueTypeSchema = z.enum([
  'spelling',
  'grammar',
  'style',
  'punctuation',
  'ats',
  'tone',
  'factual'
])

/**
 * Severity levels for issues
 */
export const IssueSeveritySchema = z.enum([
  'error',
  'warning',
  'info'
])

/**
 * ReviewIssueSchema - Individual issue found during review
 *
 * Per CONTEXT.md: "Flag + suggest - issues highlighted with suggested fixes"
 */
export const ReviewIssueSchema = z.object({
  type: IssueTypeSchema,
  message: z.string().min(1, 'Message is required'),
  context: z.string().optional(),        // Surrounding text for context
  offset: z.number().optional(),          // Character offset in document
  length: z.number().optional(),          // Length of issue span
  suggestions: z.array(z.string()).default([]),  // Suggested fixes
  severity: IssueSeveritySchema
})

/**
 * Document types that can be reviewed
 */
export const DocumentTypeSchema = z.enum([
  'resume',
  'cover_letter',
  'email'
])

/**
 * Grammar check result
 */
export const GrammarResultSchema = z.object({
  issues: z.array(ReviewIssueSchema),
  score: z.number().min(0).max(100).nullable()  // null if API failed
})

/**
 * ATS compatibility result
 */
export const ATSResultSchema = z.object({
  score: z.number().min(0).max(100),
  issues: z.array(ReviewIssueSchema),
  keywordCoverage: z.number().min(0).max(100)
})

/**
 * Tone analysis result
 */
export const ToneResultSchema = z.object({
  detected: z.string(),           // 'casual', 'formal', 'balanced'
  consistent: z.boolean(),        // Matches profile preferences
  issues: z.array(z.string())     // Description of tone issues
})

/**
 * Length check result
 */
export const LengthResultSchema = z.object({
  wordCount: z.number(),
  charCount: z.number(),
  withinLimits: z.boolean(),
  pageEstimate: z.number()        // Estimated pages (3500 chars per page)
})

/**
 * Factual conflict entry
 */
export const FactualConflictSchema = z.object({
  claim: z.string(),              // What the document claims
  profileValue: z.string(),       // What the profile says
  issue: z.string()               // Description of the conflict
})

/**
 * Factual accuracy result
 */
export const FactualResultSchema = z.object({
  verified: z.array(z.string()),          // Claims verified against profile
  unverified: z.array(z.string()),        // Claims that couldn't be verified
  conflicts: z.array(FactualConflictSchema)  // Claims that conflict with profile
})

/**
 * DocumentReviewSchema - Complete review result
 *
 * Per CONTEXT.md: "Explicit approval required - user must explicitly
 * approve before document is marked 'ready to use'"
 */
export const DocumentReviewSchema = z.object({
  id: z.string().uuid(),
  documentType: DocumentTypeSchema,
  reviewedAt: z.string(),         // ISO timestamp

  // Component results
  grammar: GrammarResultSchema,
  ats: ATSResultSchema,
  tone: ToneResultSchema,
  length: LengthResultSchema,
  factual: FactualResultSchema,

  // Overall assessment
  overallScore: z.number().min(0).max(100),
  readyToUse: z.boolean(),        // false until blockers resolved + user approves
  blockers: z.array(z.string())   // Issues that must be resolved before use
})

/**
 * Validate a review issue
 *
 * @param {object} issue - Issue data to validate
 * @returns {{ valid: boolean, errors: Array, data?: object }}
 */
export function validateReviewIssue(issue) {
  const result = ReviewIssueSchema.safeParse(issue)

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code
      })),
      data: null
    }
  }

  return {
    valid: true,
    errors: [],
    data: result.data
  }
}

/**
 * Validate a complete document review
 *
 * @param {object} review - Review data to validate
 * @returns {{ valid: boolean, errors: Array, data?: object }}
 */
export function validateDocumentReview(review) {
  const result = DocumentReviewSchema.safeParse(review)

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code
      })),
      data: null
    }
  }

  return {
    valid: true,
    errors: [],
    data: result.data
  }
}
