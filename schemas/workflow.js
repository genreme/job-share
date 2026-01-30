/**
 * Workflow Schema - Status transition validation
 *
 * Defines valid job status transitions and provides validation functions.
 * The job workflow has terminal states (archived) and restricted transitions
 * (applied can only move to archived).
 */

/**
 * Valid status transitions
 *
 * Maps each status to the list of statuses it can transition to.
 * - apply-now: Active job ready to apply, can move to any evaluation or completion state
 * - maybe: Under consideration, can be promoted or demoted
 * - probably-not: Low priority, can be reconsidered or archived
 * - applied: Already applied, can only be archived (no going back)
 * - archived: Terminal state, no transitions allowed
 */
export const VALID_TRANSITIONS = {
  'apply-now': ['maybe', 'probably-not', 'applied', 'archived'],
  'maybe': ['apply-now', 'probably-not', 'applied', 'archived'],
  'probably-not': ['maybe', 'apply-now', 'archived'],
  'applied': ['archived'], // Terminal except archive
  'archived': [] // Terminal state
}

/**
 * All valid statuses
 */
export const VALID_STATUSES = Object.keys(VALID_TRANSITIONS)

/**
 * Check if a status transition is valid
 *
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Target status
 * @returns {boolean} True if transition is allowed
 */
export function isValidTransition(fromStatus, toStatus) {
  // Handle null/undefined inputs
  if (fromStatus == null || toStatus == null) {
    return false
  }

  // Self-transitions are not allowed
  if (fromStatus === toStatus) {
    return false
  }

  // Check if fromStatus is valid
  if (!VALID_TRANSITIONS[fromStatus]) {
    return false
  }

  // Check if transition is allowed
  return VALID_TRANSITIONS[fromStatus].includes(toStatus)
}

/**
 * Get list of valid next statuses from current status
 *
 * @param {string} currentStatus - Current job status
 * @returns {string[]} Array of valid next statuses (empty if status is terminal or invalid)
 */
export function getValidNextStatuses(currentStatus) {
  if (currentStatus == null || !VALID_TRANSITIONS[currentStatus]) {
    return []
  }

  return [...VALID_TRANSITIONS[currentStatus]]
}

/**
 * Validate a status transition with descriptive error message
 *
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Target status
 * @returns {{ valid: boolean, error?: string }} Validation result with optional error message
 */
export function validateStatusTransition(fromStatus, toStatus) {
  // Handle null/undefined inputs
  if (fromStatus == null) {
    return {
      valid: false,
      error: 'Current status is required'
    }
  }

  if (toStatus == null) {
    return {
      valid: false,
      error: 'Target status is required'
    }
  }

  // Check if fromStatus is valid
  if (!VALID_TRANSITIONS[fromStatus]) {
    return {
      valid: false,
      error: `Unknown current status: "${fromStatus}". Valid statuses are: ${VALID_STATUSES.join(', ')}`
    }
  }

  // Check if toStatus is valid
  if (!VALID_TRANSITIONS[toStatus]) {
    return {
      valid: false,
      error: `Unknown target status: "${toStatus}". Valid statuses are: ${VALID_STATUSES.join(', ')}`
    }
  }

  // Self-transitions are not allowed
  if (fromStatus === toStatus) {
    return {
      valid: false,
      error: `Cannot transition to same status: "${fromStatus}"`
    }
  }

  // Check if transition is allowed
  if (!VALID_TRANSITIONS[fromStatus].includes(toStatus)) {
    const validNextStatuses = VALID_TRANSITIONS[fromStatus]

    if (validNextStatuses.length === 0) {
      return {
        valid: false,
        error: `Status "${fromStatus}" is terminal and cannot transition to any other status`
      }
    }

    return {
      valid: false,
      error: `Cannot transition from "${fromStatus}" to "${toStatus}". Valid transitions: ${validNextStatuses.join(', ')}`
    }
  }

  return { valid: true }
}
