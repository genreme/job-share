/**
 * Interview Schema - Zod validation for interview preparation domain
 *
 * Provides structured schemas for:
 * - Interviewer research (per-person research with style and connection focus)
 * - Interview questions (linked to stories and talking points)
 * - Practice answers (with comprehensive scoring)
 * - Practice sessions (all sessions saved per job)
 * - Prep progress (overall trend dashboard)
 *
 * Supports both strict validation (throws on error) and advisory mode (warns but continues).
 */

import { z } from 'zod'

// =============================================================================
// SHARED ENUMS AND CONSTANTS
// =============================================================================

// Confidence level for research quality
const ConfidenceLevel = z.enum(['high', 'medium', 'low'])

// Question types for interviews
const QuestionType = z.enum(['behavioral', 'technical', 'system-design', 'culture-fit', 'case-study'])

// Question difficulty levels
const DifficultyLevel = z.enum(['easy', 'medium', 'hard'])

// Sources for question generation
const QuestionSource = z.enum([
  'jd-requirement',
  'profile-gap',
  'profile-strength',
  'company-research',
  'interviewer-style'
])

// Input methods for practice answers
const InputMethod = z.enum(['text', 'voice'])

// Session types for practice
const SessionType = z.enum(['full-interview', 'category-focus', 'single-question'])

// Feedback timing options
const FeedbackTiming = z.enum(['immediate', 'batched'])

// Depth expectation for interviews
const DepthExpectation = z.enum(['surface', 'moderate', 'deep'])

// Readiness confidence levels
const ReadinessLevel = z.enum(['not-ready', 'needs-work', 'ready', 'well-prepared'])

// =============================================================================
// INTERVIEWER RESEARCH SCHEMA
// =============================================================================

/**
 * Interviewer Research Schema
 * Per-person research following manager-research.js pattern
 *
 * Primary focus: Interview style signals and connection building
 * Secondary focus: Professional background
 */
export const InterviewerResearchSchema = z.object({
  // Identification
  id: z.string().uuid(),
  jobId: z.number(),
  interviewerName: z.string().min(1),
  interviewerTitle: z.string().optional(),
  interviewRound: z.string().optional(), // e.g., "phone screen", "onsite", "final"
  researchedAt: z.string(), // ISO date string

  // Professional background (secondary priority per CONTEXT.md)
  background: z.object({
    currentRole: z.string().optional(),
    company: z.string().optional(),
    previousRoles: z.array(z.string()).default([]),
    yearsInRole: z.number().optional(),
    linkedInUrl: z.string().optional()
  }).default({ previousRoles: [] }),

  // Interview style signals (PRIMARY focus per CONTEXT.md)
  interviewStyle: z.object({
    signals: z.array(z.string()).default([]), // From Glassdoor reviews, patterns
    expectedQuestionTypes: z.array(QuestionType).default([]),
    communicationPattern: z.string().optional(), // "Direct", "Collaborative", etc.
    depthExpectation: DepthExpectation.optional()
  }).default({ signals: [], expectedQuestionTypes: [] }),

  // Connection building (primary focus per CONTEXT.md)
  talkingPoints: z.array(z.string()).default([]),
  sharedInterests: z.array(z.string()).default([]),

  // Research quality indicators
  confidence: ConfidenceLevel,
  sources: z.array(z.string()).default([])
})

// =============================================================================
// INTERVIEW QUESTION SCHEMA
// =============================================================================

/**
 * Suggested Story Reference
 * Links questions to STAR stories from profile
 */
const SuggestedStorySchema = z.object({
  storyId: z.string().uuid(),
  storyTitle: z.string(),
  relevanceScore: z.number().min(0).max(100)
})

/**
 * Interview Question Schema
 * Per CONTEXT.md: Linked to stories and talking points
 */
export const InterviewQuestionSchema = z.object({
  // Identification
  id: z.string().uuid(),
  jobId: z.number(),
  questionText: z.string().min(1),

  // Classification
  category: z.enum(['behavioral', 'technical', 'system-design', 'culture-fit']),
  difficulty: DifficultyLevel,

  // Personalization context
  source: QuestionSource,
  sourceDetail: z.string().optional(), // e.g., "Missing: Kubernetes experience"

  // Suggested answers
  suggestedStories: z.array(SuggestedStorySchema).default([]),
  talkingPoints: z.array(z.string()).default([]),

  // Metadata
  generatedAt: z.string(), // ISO date string
  interviewerId: z.string().uuid().optional() // If generated for specific interviewer
})

// =============================================================================
// PRACTICE ANSWER SCHEMA
// =============================================================================

/**
 * Score breakdown for practice answers
 * Per CONTEXT.md: Comprehensive scoring
 */
const AnswerScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  storyCoverage: z.number().min(0).max(100),
  starStructure: z.number().min(0).max(100),
  relevance: z.number().min(0).max(100),
  clarity: z.number().min(0).max(100)
})

/**
 * Feedback for practice answers
 * Per CONTEXT.md: Specific rewrites showing improvements
 */
const AnswerFeedbackSchema = z.object({
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  suggestedRewrite: z.string().optional() // Per CONTEXT.md: Specific rewrites
})

/**
 * Practice Answer Schema
 * Per CONTEXT.md: Both text and voice, comprehensive scoring
 */
export const PracticeAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answerText: z.string(), // Transcribed if voice
  inputMethod: InputMethod,
  answeredAt: z.string(), // ISO date string
  duration: z.number().optional(), // Seconds if voice

  // Self-scoring (per CONTEXT.md: Comprehensive evaluation)
  score: AnswerScoreSchema.optional(),

  // Feedback (per CONTEXT.md: Strengths, improvements, rewrites)
  feedback: AnswerFeedbackSchema.optional()
})

// =============================================================================
// PRACTICE SESSION SCHEMA
// =============================================================================

/**
 * Session Summary
 * Calculated on completion
 */
const SessionSummarySchema = z.object({
  questionsAttempted: z.number(),
  averageScore: z.number().optional(),
  strongCategories: z.array(z.string()).default([]),
  improvementAreas: z.array(z.string()).default([])
})

/**
 * Practice Session Schema
 * Per CONTEXT.md: All sessions saved automatically per job
 */
export const PracticeSessionSchema = z.object({
  // Identification
  id: z.string().uuid(),
  jobId: z.number(),

  // Session type
  sessionType: SessionType,

  // Timing
  startedAt: z.string(), // ISO date string
  completedAt: z.string().optional(), // ISO date string

  // Answers
  answers: z.array(PracticeAnswerSchema).default([]),

  // Session settings (per CONTEXT.md)
  feedbackTiming: FeedbackTiming,

  // Summary (calculated on completion)
  summary: SessionSummarySchema.optional()
})

// =============================================================================
// PREP PROGRESS SCHEMA
// =============================================================================

/**
 * Score history entry for tracking trends
 */
const ScoreHistoryEntrySchema = z.object({
  date: z.string(), // ISO date string
  category: z.string(),
  score: z.number().min(0).max(100)
})

/**
 * Readiness assessment
 * Per CONTEXT.md: Overall trend dashboard
 */
const ReadinessSchema = z.object({
  overall: z.number().min(0).max(100),
  byCategory: z.record(z.number()).default({}), // Category name -> score
  confidenceLevel: ReadinessLevel
})

/**
 * Focus area for improvement
 */
const FocusAreaSchema = z.object({
  category: z.string(),
  reason: z.string(),
  recommendedPractice: z.string()
})

/**
 * Prep Progress Schema
 * Per CONTEXT.md: Overall trend dashboard showing readiness
 */
export const PrepProgressSchema = z.object({
  // Identification
  jobId: z.number(),
  lastUpdated: z.string(), // ISO date string

  // Session history summary
  totalSessions: z.number().default(0),
  totalQuestionsAnswered: z.number().default(0),

  // Score trends
  scoreHistory: z.array(ScoreHistoryEntrySchema).default([]),

  // Readiness assessment
  readiness: ReadinessSchema.optional(),

  // Areas needing attention
  focusAreas: z.array(FocusAreaSchema).default([])
})

// =============================================================================
// VALIDATION HELPER FUNCTIONS
// =============================================================================

/**
 * Validate interviewer research data with configurable mode
 *
 * @param {object} data - The interviewer research data to validate
 * @param {object} options - Validation options
 * @param {string} options.mode - 'advisory' (warn and return data) or 'strict' (throw on error)
 * @returns {{ valid: boolean, errors: Array, data: object }}
 */
export function validateInterviewerResearch(data, options = { mode: 'advisory' }) {
  const result = InterviewerResearchSchema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received
    }))

    if (options.mode === 'strict') {
      throw new Error(`Interviewer research validation failed: ${JSON.stringify(errors, null, 2)}`)
    }

    // Advisory mode: warn but return original data
    return { valid: false, errors, data }
  }

  return { valid: true, errors: [], data: result.data }
}

/**
 * Validate interview question data with configurable mode
 *
 * @param {object} data - The interview question data to validate
 * @param {object} options - Validation options
 * @param {string} options.mode - 'advisory' (warn and return data) or 'strict' (throw on error)
 * @returns {{ valid: boolean, errors: Array, data: object }}
 */
export function validateInterviewQuestion(data, options = { mode: 'advisory' }) {
  const result = InterviewQuestionSchema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received
    }))

    if (options.mode === 'strict') {
      throw new Error(`Interview question validation failed: ${JSON.stringify(errors, null, 2)}`)
    }

    // Advisory mode: warn but return original data
    return { valid: false, errors, data }
  }

  return { valid: true, errors: [], data: result.data }
}

/**
 * Validate practice answer data with configurable mode
 *
 * @param {object} data - The practice answer data to validate
 * @param {object} options - Validation options
 * @param {string} options.mode - 'advisory' (warn and return data) or 'strict' (throw on error)
 * @returns {{ valid: boolean, errors: Array, data: object }}
 */
export function validatePracticeAnswer(data, options = { mode: 'advisory' }) {
  const result = PracticeAnswerSchema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received
    }))

    if (options.mode === 'strict') {
      throw new Error(`Practice answer validation failed: ${JSON.stringify(errors, null, 2)}`)
    }

    // Advisory mode: warn but return original data
    return { valid: false, errors, data }
  }

  return { valid: true, errors: [], data: result.data }
}

/**
 * Validate practice session data with configurable mode
 *
 * @param {object} data - The practice session data to validate
 * @param {object} options - Validation options
 * @param {string} options.mode - 'advisory' (warn and return data) or 'strict' (throw on error)
 * @returns {{ valid: boolean, errors: Array, data: object }}
 */
export function validatePracticeSession(data, options = { mode: 'advisory' }) {
  const result = PracticeSessionSchema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received
    }))

    if (options.mode === 'strict') {
      throw new Error(`Practice session validation failed: ${JSON.stringify(errors, null, 2)}`)
    }

    // Advisory mode: warn but return original data
    return { valid: false, errors, data }
  }

  return { valid: true, errors: [], data: result.data }
}

/**
 * Validate prep progress data with configurable mode
 *
 * @param {object} data - The prep progress data to validate
 * @param {object} options - Validation options
 * @param {string} options.mode - 'advisory' (warn and return data) or 'strict' (throw on error)
 * @returns {{ valid: boolean, errors: Array, data: object }}
 */
export function validatePrepProgress(data, options = { mode: 'advisory' }) {
  const result = PrepProgressSchema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received
    }))

    if (options.mode === 'strict') {
      throw new Error(`Prep progress validation failed: ${JSON.stringify(errors, null, 2)}`)
    }

    // Advisory mode: warn but return original data
    return { valid: false, errors, data }
  }

  return { valid: true, errors: [], data: result.data }
}

// Type exports for consumers
export const InterviewerResearch = InterviewerResearchSchema._type
export const InterviewQuestion = InterviewQuestionSchema._type
export const PracticeAnswer = PracticeAnswerSchema._type
export const PracticeSession = PracticeSessionSchema._type
export const PrepProgress = PrepProgressSchema._type
