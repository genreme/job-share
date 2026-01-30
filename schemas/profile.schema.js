/**
 * Profile Schema - Zod validation for professional profile data structure
 *
 * Validates profile entries including metadata, experience, skills,
 * summaries, stories, preferences, and history tracking.
 * Supports both strict validation (throws on error) and advisory mode (warns but continues).
 */

import { z } from 'zod'

// =============================================================================
// METRICS SCHEMA (Optional structured metrics for achievements)
// =============================================================================
export const MetricsSchema = z.object({
  value: z.union([z.number(), z.string()]), // "40%" or 40
  unit: z.string(), // "percent", "users", "dollars"
  context: z.string().optional() // "year-over-year", "within 6 months"
})

// =============================================================================
// PROJECT SCHEMA (Primary unit of achievement)
// =============================================================================
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(), // Human-readable narrative with achievement
  metrics: MetricsSchema.optional(), // Optional structured metrics
  tags: z.array(z.string()).default([]), // Core + custom tags
  skillRefs: z.array(z.string()).default([]), // Skill IDs demonstrated
  createdAt: z.string(),
  updatedAt: z.string()
})

// =============================================================================
// ROLE SCHEMA (Context for projects)
// =============================================================================
export const RoleSchema = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  startDate: z.string(), // ISO date (YYYY-MM-DD)
  endDate: z.string().nullable() // null = current role
})

// =============================================================================
// EXPERIENCE ENTRY SCHEMA (Role + Projects)
// =============================================================================
export const ExperienceEntrySchema = z.object({
  id: z.string().uuid(),
  role: RoleSchema,
  projects: z.array(ProjectSchema).min(1), // At least one project per role
  version: z.number().int().positive().default(1),
  createdAt: z.string(),
  updatedAt: z.string()
})

// =============================================================================
// SKILL SCHEMA (Hierarchical with evidence linking)
// =============================================================================
export const SkillSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  category: z.string().min(1), // e.g., "Technical", "Leadership", "Domain", "Soft Skills"
  subcategory: z.string().min(1), // e.g., "Design Systems", "Team Management"
  proficiency: z.enum(['familiar', 'proficient', 'expert']),
  source: z.enum(['explicit', 'inferred']), // User-stated vs derived from experience
  confidence: z.number().min(0).max(100), // Evidence strength percentage
  evidence: z.array(z.string()).min(1), // Project IDs demonstrating this skill (REQUIRED)
  createdAt: z.string(),
  updatedAt: z.string()
})

// =============================================================================
// PROFILE METADATA SCHEMA
// =============================================================================

// Profile metadata schema
export const ProfileMetadataSchema = z.object({
  version: z.number().int().positive(),
  createdAt: z.string(), // ISO timestamp
  updatedAt: z.string(), // ISO timestamp
  schemaVersion: z.literal('1.0') // For future migrations
})

// History entry schema for tracking profile changes
export const HistoryEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string(), // ISO timestamp
  action: z.enum(['create', 'update', 'delete']),
  entityType: z.enum(['experience', 'skill', 'summary', 'story', 'preference']),
  entityId: z.string(),
  previousValue: z.unknown().nullable(),
  newValue: z.unknown().nullable(),
  reason: z.string().optional()
})

// Base profile structure with placeholder arrays for Plans 02-02 and 02-03
export const ProfileSchema = z.object({
  metadata: ProfileMetadataSchema,
  experience: z.array(ExperienceEntrySchema).default([]), // Project-centric structure
  skills: z.array(SkillSchema).default([]), // Hierarchical with evidence linking
  summaryBlocks: z.array(z.unknown()).default([]), // Populated in 02-03
  stories: z.array(z.unknown()).default([]), // Populated in 02-03
  preferences: z
    .object({
      targetRoles: z.array(z.unknown()).default([]), // Populated in 02-03
      communication: z.unknown().optional() // Populated in 02-03
    })
    .default({}),
  history: z.array(HistoryEntrySchema).default([])
})

/**
 * Validate profile data with configurable mode
 *
 * @param {object} data - The profile data to validate
 * @param {object} options - Validation options
 * @param {string} options.mode - 'advisory' (warn and return data) or 'strict' (throw on error)
 * @returns {{ valid: boolean, errors: Array, data: object }}
 */
export function validateProfile(data, options = { mode: 'advisory' }) {
  const result = ProfileSchema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received
    }))

    if (options.mode === 'strict') {
      throw new Error(`Profile validation failed: ${JSON.stringify(errors, null, 2)}`)
    }

    // Advisory mode: warn but return original data
    return { valid: false, errors, data }
  }

  return { valid: true, errors: [], data: result.data }
}

/**
 * Validate a single history entry
 *
 * @param {object} entry - The history entry to validate
 * @param {object} options - Validation options
 * @returns {{ valid: boolean, errors: Array, data: object }}
 */
export function validateHistoryEntry(entry, options = { mode: 'advisory' }) {
  const result = HistoryEntrySchema.safeParse(entry)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received
    }))

    if (options.mode === 'strict') {
      throw new Error(`History entry validation failed: ${JSON.stringify(errors, null, 2)}`)
    }

    return { valid: false, errors, data: entry }
  }

  return { valid: true, errors: [], data: result.data }
}
