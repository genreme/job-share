/**
 * Fit Config Service - Manage configurable fit criteria
 *
 * Provides:
 * - loadFitConfig: Load criteria from JSON or return defaults
 * - saveFitConfig: Persist config changes atomically
 * - updateFitCriteria: Update specific criteria fields
 * - logOutcome: Track job outcomes for evolution
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const CONFIG_PATH = join(DATA_DIR, 'fit-config.json')

// Default fit criteria (fallback when config file missing)
const DEFAULT_FIT_CRITERIA = {
  titles: {
    exact: [
      'Creative Director', 'VP of Creative', 'VP Creative Services', 'Director of Creative Services',
      'Head of Creative', 'Head of Design', 'Design Director', 'Executive Creative Director',
      'Senior Creative Director', 'Creative Operations Director'
    ],
    partial: ['Creative', 'Design', 'Brand', 'Visual', 'Art Director', 'UX Director']
  },
  industries: {
    preferred: [
      'healthcare', 'health', 'nonprofit', 'non-profit', 'education', 'social impact',
      'mission-driven', 'public health', 'mental health', 'wellness'
    ],
    acceptable: ['technology', 'saas', 'startup', 'b2b']
  },
  locations: {
    preferred: ['boston', 'massachusetts', 'ma', 'remote', 'hybrid'],
    acceptable: ['new york', 'ny', 'northeast', 'east coast']
  },
  salaryMin: 120000
}

// Default scoring weights
const DEFAULT_WEIGHTS = {
  BASE: 50,
  ROLE_EXACT: 25,
  ROLE_PARTIAL: 15,
  INDUSTRY_PREFERRED: 20,
  INDUSTRY_ACCEPTABLE: 10,
  LOCATION_PREFERRED: 15,
  LOCATION_ACCEPTABLE: 8,
  SALARY_MEETS: 15,
  SKILL_MATCH: 2,
  MAX_SKILL_MATCHES: 5,
  MAX_TOTAL: 100
}

/**
 * Create empty/default config structure
 *
 * @returns {object} Default config structure
 */
export function createDefaultConfig() {
  const now = new Date().toISOString()
  return {
    version: '1.0',
    createdAt: now,
    updatedAt: now,
    criteria: { ...DEFAULT_FIT_CRITERIA },
    weights: { ...DEFAULT_WEIGHTS },
    evolutionLog: []
  }
}

/**
 * Load fit config from disk
 *
 * Returns config from file if exists, otherwise returns default config.
 * Does NOT create file if missing (lazy creation on save).
 *
 * @returns {object} The loaded or default config
 */
export function loadFitConfig() {
  if (!existsSync(CONFIG_PATH)) {
    console.warn('Fit config not found, using defaults:', CONFIG_PATH)
    return createDefaultConfig()
  }

  try {
    const content = readFileSync(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(content)

    // Validate required fields exist, merge with defaults if missing
    return {
      version: config.version || '1.0',
      createdAt: config.createdAt || new Date().toISOString(),
      updatedAt: config.updatedAt || new Date().toISOString(),
      criteria: {
        titles: config.criteria?.titles || DEFAULT_FIT_CRITERIA.titles,
        industries: config.criteria?.industries || DEFAULT_FIT_CRITERIA.industries,
        locations: config.criteria?.locations || DEFAULT_FIT_CRITERIA.locations,
        salaryMin: config.criteria?.salaryMin ?? DEFAULT_FIT_CRITERIA.salaryMin
      },
      weights: { ...DEFAULT_WEIGHTS, ...config.weights },
      evolutionLog: config.evolutionLog || []
    }
  } catch (e) {
    console.error('Error loading fit config, using defaults:', e.message)
    return createDefaultConfig()
  }
}

/**
 * Save fit config to disk with atomic write
 *
 * Uses write-then-rename pattern to prevent corruption.
 *
 * @param {object} config - The config to save
 * @returns {{ success: boolean, error?: string }} Save result
 */
export function saveFitConfig(config) {
  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }

  try {
    // Update timestamp
    const toSave = {
      ...config,
      updatedAt: new Date().toISOString()
    }

    // Atomic write: write to temp, then rename
    const tempPath = CONFIG_PATH + '.tmp'
    writeFileSync(tempPath, JSON.stringify(toSave, null, 2))
    renameSync(tempPath, CONFIG_PATH)

    return { success: true }
  } catch (e) {
    console.error('Error saving fit config:', e.message)
    return { success: false, error: e.message }
  }
}

/**
 * Update specific fit criteria fields
 *
 * Merges updates into existing config and saves.
 *
 * @param {object} updates - Partial criteria updates
 * @param {string} [reason] - Reason for the update (logged to evolution)
 * @returns {{ success: boolean, config?: object, error?: string }}
 */
export function updateFitCriteria(updates, reason) {
  if (!updates || typeof updates !== 'object') {
    return { success: false, error: 'Updates must be an object' }
  }

  const config = loadFitConfig()

  // Deep merge criteria updates
  if (updates.titles) {
    config.criteria.titles = {
      ...config.criteria.titles,
      ...updates.titles
    }
  }

  if (updates.industries) {
    config.criteria.industries = {
      ...config.criteria.industries,
      ...updates.industries
    }
  }

  if (updates.locations) {
    config.criteria.locations = {
      ...config.criteria.locations,
      ...updates.locations
    }
  }

  if (updates.salaryMin !== undefined) {
    config.criteria.salaryMin = updates.salaryMin
  }

  // Log the update to evolution history
  if (reason) {
    config.evolutionLog.push({
      timestamp: new Date().toISOString(),
      type: 'criteria_update',
      reason,
      changes: Object.keys(updates)
    })
  }

  const result = saveFitConfig(config)

  if (result.success) {
    return { success: true, config }
  }

  return { success: false, error: result.error }
}

/**
 * Log a job outcome for evolution tracking
 *
 * Records whether a job with certain criteria led to a positive/negative outcome.
 * Used to inform future criteria evolution.
 *
 * @param {object} params - Outcome parameters
 * @param {number} params.jobId - ID of the job
 * @param {string} params.outcome - 'positive' | 'negative' | 'neutral'
 * @param {number} params.fitScore - Fit score when job was assessed
 * @param {string} [params.notes] - Additional context
 * @returns {{ success: boolean, error?: string }}
 */
export function logOutcome({ jobId, outcome, fitScore, notes }) {
  // Validate required params
  if (jobId === undefined || jobId === null) {
    return { success: false, error: 'jobId is required' }
  }

  const validOutcomes = ['positive', 'negative', 'neutral']
  if (!outcome || !validOutcomes.includes(outcome)) {
    return { success: false, error: `outcome must be one of: ${validOutcomes.join(', ')}` }
  }

  if (fitScore === undefined || fitScore === null || typeof fitScore !== 'number') {
    return { success: false, error: 'fitScore is required and must be a number' }
  }

  const config = loadFitConfig()

  // Add to evolution log
  const entry = {
    timestamp: new Date().toISOString(),
    type: 'outcome',
    jobId,
    outcome,
    fitScore
  }

  if (notes) {
    entry.notes = notes
  }

  config.evolutionLog.push(entry)

  // Keep evolution log manageable (last 100 entries)
  if (config.evolutionLog.length > 100) {
    config.evolutionLog = config.evolutionLog.slice(-100)
  }

  const result = saveFitConfig(config)

  if (result.success) {
    return { success: true }
  }

  return { success: false, error: result.error }
}

/**
 * Get config file path (for testing)
 *
 * @returns {string} Absolute path to config file
 */
export function getConfigPath() {
  return CONFIG_PATH
}

/**
 * Get default criteria (for backward compatibility checks)
 *
 * @returns {object} Default fit criteria
 */
export function getDefaultCriteria() {
  return { ...DEFAULT_FIT_CRITERIA }
}

/**
 * Get default weights (for backward compatibility checks)
 *
 * @returns {object} Default scoring weights
 */
export function getDefaultWeights() {
  return { ...DEFAULT_WEIGHTS }
}
