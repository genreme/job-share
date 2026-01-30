/**
 * Profile Loader - Load/save profile with validation and history tracking
 *
 * Handles profile persistence with:
 * - Automatic creation of empty profile if none exists
 * - Validation on load/save (advisory mode by default)
 * - Atomic writes to prevent corruption
 * - Append-only history tracking
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { validateProfile } from '../../../schemas/profile.schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..', '..', '..')
const PROFILE_DIR = join(PROJECT_ROOT, 'mcp-server', 'data', 'profile')
const PROFILE_PATH = join(PROFILE_DIR, 'master-profile.json')

/**
 * Create an empty profile with valid metadata
 *
 * @returns {object} Empty profile structure
 */
export function createEmptyProfile() {
  const now = new Date().toISOString()

  return {
    metadata: {
      version: 1,
      createdAt: now,
      updatedAt: now,
      schemaVersion: '1.0'
    },
    experience: [],
    skills: [],
    summaryBlocks: [],
    stories: [],
    preferences: {
      targetRoles: [],
      communication: null
    },
    history: []
  }
}

/**
 * Load profile from disk
 *
 * Creates an empty profile if none exists.
 * Validates loaded profile and logs warnings in advisory mode.
 *
 * @returns {object} The loaded or newly created profile
 */
export function loadProfile() {
  // Ensure profile directory exists
  if (!existsSync(PROFILE_DIR)) {
    mkdirSync(PROFILE_DIR, { recursive: true })
  }

  // If profile doesn't exist, create and save empty profile
  if (!existsSync(PROFILE_PATH)) {
    const emptyProfile = createEmptyProfile()
    saveProfile(emptyProfile)
    console.error('Created new empty profile at:', PROFILE_PATH)
    return emptyProfile
  }

  // Load and validate existing profile
  try {
    const content = readFileSync(PROFILE_PATH, 'utf-8')
    const data = JSON.parse(content)

    const validation = validateProfile(data)
    if (!validation.valid) {
      console.error('Profile validation warnings:', validation.errors)
    }

    console.error('Loaded profile from:', PROFILE_PATH)
    return validation.data
  } catch (e) {
    console.error('Error loading profile:', e.message)
    // Return empty profile on error
    const emptyProfile = createEmptyProfile()
    return emptyProfile
  }
}

/**
 * Save profile to disk with atomic write
 *
 * Uses write-then-rename pattern to prevent corruption.
 * Validates before save and logs warnings in advisory mode.
 *
 * @param {object} profile - The profile to save
 * @returns {{ success: boolean, warnings: Array }} Save result
 */
export function saveProfile(profile) {
  // Ensure profile directory exists
  if (!existsSync(PROFILE_DIR)) {
    mkdirSync(PROFILE_DIR, { recursive: true })
  }

  // Validate before save
  const validation = validateProfile(profile)
  if (!validation.valid) {
    console.error('Profile validation warnings (saving anyway - advisory mode):', validation.errors)
  }

  try {
    // Atomic write: write to temp, then rename
    const tempPath = PROFILE_PATH + '.tmp'
    writeFileSync(tempPath, JSON.stringify(profile, null, 2))
    renameSync(tempPath, PROFILE_PATH)

    return { success: true, warnings: validation.errors }
  } catch (e) {
    console.error('Error saving profile:', e.message)
    return { success: false, warnings: validation.errors }
  }
}

/**
 * Add a history entry to track profile changes
 *
 * Creates a new history entry and returns a NEW profile object
 * with the entry appended. Does NOT mutate the input profile.
 *
 * @param {object} profile - The current profile (not mutated)
 * @param {string} action - 'create' | 'update' | 'delete'
 * @param {string} entityType - 'experience' | 'skill' | 'summary' | 'story' | 'preference'
 * @param {string} entityId - Identifier of the changed entity
 * @param {*} previousValue - Value before change (null for create)
 * @param {*} newValue - Value after change (null for delete)
 * @param {string} [reason] - Optional reason for the change
 * @returns {{ entry: object, profile: object }} The new entry and updated profile
 */
export function addHistoryEntry(
  profile,
  action,
  entityType,
  entityId,
  previousValue,
  newValue,
  reason
) {
  const entry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    action,
    entityType,
    entityId,
    previousValue: previousValue ?? null,
    newValue: newValue ?? null
  }

  // Only add reason if provided
  if (reason) {
    entry.reason = reason
  }

  // Create new profile object (immutable - no mutation)
  const updatedProfile = {
    ...profile,
    history: [...(profile.history || []), entry]
  }

  return { entry, profile: updatedProfile }
}

/**
 * Get the profile file path (for testing purposes)
 *
 * @returns {string} The absolute path to the profile file
 */
export function getProfilePath() {
  return PROFILE_PATH
}
