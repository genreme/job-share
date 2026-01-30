/**
 * Cleanup Orchestrator - Coordinates all cleanup detectors
 *
 * Orchestrates:
 * - Duplicate detection (fuzzy matching)
 * - Staleness detection (age + usage)
 * - Gap detection (required fields, thin evidence)
 *
 * Findings are surfaced for user review - never auto-applied.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { loadProfile } from '../data/profile-loader.js'
import { detectDuplicates } from './duplicate-detector.js'
import { detectStaleItems } from './staleness-detector.js'
import { detectGaps } from './gap-detector.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const CLEANUP_FINDINGS_PATH = join(DATA_DIR, 'cleanup-findings.json')

// How often cleanup should run (7 days)
const CLEANUP_INTERVAL_DAYS = 7
const MAX_STORED_RUNS = 4

/**
 * Run full cleanup analysis on profile
 *
 * @param {object} profile - Profile to analyze (loads from file if not provided)
 * @param {object} options - Analysis options
 * @param {object} options.jobContext - Optional job context for contextual gaps
 * @param {object} options.duplicateOptions - Options for duplicate detection
 * @param {object} options.stalenessOptions - Options for staleness detection
 * @returns {object} CleanupResult with duplicates, stale, and gaps arrays
 */
export function runCleanupAnalysis(profile = null, options = {}) {
  const { jobContext = null, duplicateOptions = {}, stalenessOptions = {} } = options

  // Load profile if not provided
  const profileData = profile || loadProfile()

  const runAt = new Date().toISOString()
  let status = 'complete'

  try {
    // Run all detectors
    const duplicates = detectDuplicates(profileData, duplicateOptions)
    const stale = detectStaleItems(profileData, stalenessOptions)
    const gaps = detectGaps(profileData, jobContext)

    const result = {
      runAt,
      duplicates,
      stale,
      gaps,
      status
    }

    // Save findings for later retrieval
    saveCleanupFindings(result)

    return result
  } catch (error) {
    console.error('Cleanup analysis error:', error.message)
    return {
      runAt,
      duplicates: [],
      stale: [],
      gaps: [],
      status: 'error'
    }
  }
}

/**
 * Check if cleanup is overdue (hasn't run in CLEANUP_INTERVAL_DAYS)
 *
 * @returns {object} { overdue: boolean, daysSince: number, lastRun: string|null }
 */
export function checkCleanupOverdue() {
  const stored = loadStoredFindings()

  if (!stored || !stored.lastRun) {
    return { overdue: true, daysSince: null, lastRun: null }
  }

  const lastRun = new Date(stored.lastRun)
  const now = new Date()
  const daysSince = Math.floor((now.getTime() - lastRun.getTime()) / (24 * 60 * 60 * 1000))

  return {
    overdue: daysSince >= CLEANUP_INTERVAL_DAYS,
    daysSince,
    lastRun: stored.lastRun
  }
}

/**
 * Get stored cleanup findings
 *
 * @returns {object|null} Stored findings or null if none exist
 */
export function getStoredFindings() {
  return loadStoredFindings()
}

/**
 * Dismiss a finding (mark as acknowledged by user)
 *
 * @param {string} findingHash - Hash identifying the finding
 * @param {string} reason - Optional reason for dismissing
 * @returns {boolean} Success
 */
export function dismissFinding(findingHash, reason = null) {
  const stored = loadStoredFindings()

  if (!stored) {
    return false
  }

  // Add to dismissed list
  const dismissal = {
    findingHash,
    dismissedAt: new Date().toISOString()
  }

  if (reason) {
    dismissal.reason = reason
  }

  stored.dismissed = stored.dismissed || []
  stored.dismissed.push(dismissal)

  // Save updated findings
  try {
    ensureDataDir()
    const tempPath = CLEANUP_FINDINGS_PATH + '.tmp'
    writeFileSync(tempPath, JSON.stringify(stored, null, 2))
    renameSync(tempPath, CLEANUP_FINDINGS_PATH)
    return true
  } catch (error) {
    console.error('Error saving dismissed finding:', error.message)
    return false
  }
}

/**
 * Generate a hash for a finding (for identifying dismissals)
 *
 * @param {object} finding - The cleanup finding
 * @returns {string} Hash string
 */
export function generateFindingHash(finding) {
  // Create deterministic hash from finding properties
  const key = `${finding.type}-${finding.entityType}-${finding.ids.sort().join(',')}`
  // Simple hash for now - can use crypto.createHash later if needed
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16)
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Save cleanup findings to file
 * Preserves history of last MAX_STORED_RUNS runs
 */
function saveCleanupFindings(result) {
  try {
    ensureDataDir()

    const stored = loadStoredFindings() || {
      lastRun: null,
      runs: [],
      dismissed: []
    }

    // Update last run timestamp
    stored.lastRun = result.runAt

    // Add to runs history, keeping only last MAX_STORED_RUNS
    stored.runs.unshift(result)
    if (stored.runs.length > MAX_STORED_RUNS) {
      stored.runs = stored.runs.slice(0, MAX_STORED_RUNS)
    }

    // Atomic write
    const tempPath = CLEANUP_FINDINGS_PATH + '.tmp'
    writeFileSync(tempPath, JSON.stringify(stored, null, 2))
    renameSync(tempPath, CLEANUP_FINDINGS_PATH)
  } catch (error) {
    console.error('Error saving cleanup findings:', error.message)
  }
}

/**
 * Load stored findings from file
 */
function loadStoredFindings() {
  try {
    if (!existsSync(CLEANUP_FINDINGS_PATH)) {
      return null
    }
    const content = readFileSync(CLEANUP_FINDINGS_PATH, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('Error loading cleanup findings:', error.message)
    return null
  }
}

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}
