/**
 * Job Schema - Zod validation for job data structure
 *
 * Validates job entries from the dashboard JSON file.
 * Supports both strict validation (throws on error) and advisory mode (warns but continues).
 */

import { z } from 'zod'

// Valid job statuses
export const JobStatusSchema = z.enum([
  'apply-now',
  'maybe',
  'probably-not',
  'applied',
  'archived'
])

// Connection can be legacy string or structured object
export const ConnectionSchema = z.union([
  z.string(), // Legacy format: "Name (notes)"
  z.object({
    name: z.string(),
    role: z.string().optional().default(''),
    linkedIn: z.string().optional().default(''),
    notes: z.string().optional().default(''),
    isPrimary: z.boolean().optional().default(false),
    reachedOut: z.boolean().optional().default(false)
  })
])

// Update entry in job history
export const UpdateSchema = z.object({
  date: z.string().optional(),
  timestamp: z.string().optional(),
  type: z.string().optional(),
  notes: z.string().optional(),
  text: z.string().optional()
})

// Full job object
export const JobSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  company: z.string().min(1),
  industry: z.string().optional(),
  location: z.string().optional(),
  salary: z.string().optional(),
  fitScore: z.number().min(0).max(100),
  status: JobStatusSchema,
  posted: z.string().optional().nullable(),
  found: z.string().optional().nullable(),
  applied: z.string().optional().nullable(),
  followup: z.string().optional().nullable(),
  url: z.union([
    z.literal(''), // Empty string is valid (URL pending)
    z.string().url() // Or must be valid URL
  ]).optional().default(''),
  symbols: z.array(z.string()).optional().default([]),
  connections: z.array(ConnectionSchema).optional().default([]),
  sources: z.array(z.string()).optional().default([]),
  notes: z.string().optional().default(''),
  updates: z.array(UpdateSchema).optional().default([]),
  hiringManager: z.string().optional(),
  // Additional fields that may be present
  scoreFeedback: z.string().optional(),
  scoreFeedbackNote: z.string().optional(),
  submittedVia: z.string().optional(),
  submittedAt: z.string().optional()
})

// Search history entry
export const SearchHistorySchema = z.object({
  timestamp: z.string(),
  jobsFound: z.number().int().min(0),
  newJobs: z.number().int().min(0),
  sources: z.array(z.string()).optional().default([]),
  notes: z.string().optional()
})

// Full jobs data wrapper
export const JobsDataSchema = z.object({
  jobs: z.array(JobSchema),
  searchHistory: z.array(SearchHistorySchema).optional().default([]),
  settings: z.object({}).passthrough().optional().default({}),
  version: z.number().optional(),
  lastUpdated: z.string().optional(),
  exportedAt: z.string().optional()
})

/**
 * Validate jobs data with configurable mode
 *
 * @param {object} data - The jobs data to validate
 * @param {object} options - Validation options
 * @param {string} options.mode - 'advisory' (warn and return data) or 'strict' (throw on error)
 * @returns {{ valid: boolean, errors: Array, data: object }}
 */
export function validateJobsData(data, options = { mode: 'advisory' }) {
  const result = JobsDataSchema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received
    }))

    if (options.mode === 'strict') {
      throw new Error(`Schema validation failed: ${JSON.stringify(errors, null, 2)}`)
    }

    // Advisory mode: warn but return original data
    return { valid: false, errors, data }
  }

  return { valid: true, errors: [], data: result.data }
}

/**
 * Validate a single job
 *
 * @param {object} job - The job to validate
 * @param {object} options - Validation options
 * @returns {{ valid: boolean, errors: Array, data: object }}
 */
export function validateJob(job, options = { mode: 'advisory' }) {
  const result = JobSchema.safeParse(job)

  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received
    }))

    if (options.mode === 'strict') {
      throw new Error(`Job validation failed: ${JSON.stringify(errors, null, 2)}`)
    }

    return { valid: false, errors, data: job }
  }

  return { valid: true, errors: [], data: result.data }
}
