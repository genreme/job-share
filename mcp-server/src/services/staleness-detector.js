/**
 * Staleness Detector - Find profile items that may need updating
 *
 * An item is considered stale when BOTH conditions are met:
 * 1. Not updated in AGE_DAYS (180 days)
 * 2. Not used in documents within USAGE_DAYS (90 days)
 *
 * This prevents flagging items that are still actively being used
 * even if they haven't been edited recently.
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DOCUMENT_HISTORY_PATH = join(
  __dirname,
  '..',
  '..',
  'data',
  'document-history.json'
)

// Staleness thresholds per RESEARCH.md
export const STALENESS_THRESHOLDS = {
  AGE_DAYS: 180, // Item not updated in this many days
  USAGE_DAYS: 90 // Item not used in documents in this many days
}

/**
 * Detect stale items in a profile
 *
 * @param {object} profile - The profile to analyze
 * @param {object} options - Detection options
 * @param {string} options.documentHistoryPath - Path to document-history.json
 * @returns {Array} Array of CleanupFinding objects for stale items
 */
export function detectStaleItems(profile, options = {}) {
  const { documentHistoryPath = DEFAULT_DOCUMENT_HISTORY_PATH } = options
  const findings = []
  const now = new Date()
  const timestamp = now.toISOString()

  // Load document history to check usage
  const documentHistory = loadDocumentHistory(documentHistoryPath)

  // Check skills
  findings.push(...checkStaleness(profile.skills || [], 'skill', documentHistory, now, timestamp))

  // Check stories
  findings.push(...checkStaleness(profile.stories || [], 'story', documentHistory, now, timestamp))

  // Check summary blocks
  findings.push(
    ...checkStaleness(profile.summaryBlocks || [], 'summary', documentHistory, now, timestamp)
  )

  // Check experience entries
  findings.push(
    ...checkStaleness(profile.experience || [], 'experience', documentHistory, now, timestamp)
  )

  return findings
}

/**
 * Load document history from file
 * Returns empty structure if file doesn't exist (graceful degradation)
 */
function loadDocumentHistory(path) {
  try {
    if (!existsSync(path)) {
      // File doesn't exist yet - treat all items as unused
      // This is expected on first runs before Plan 03-02 creates the file
      return { records: [] }
    }
    const content = readFileSync(path, 'utf-8')
    return JSON.parse(content)
  } catch (e) {
    // On error, return empty structure
    return { records: [] }
  }
}

/**
 * Get the last usage date for an item from document history
 *
 * @param {string} itemId - The item ID to look up
 * @param {string} itemType - The item type (skill, story, summary, experience)
 * @param {object} documentHistory - The loaded document history
 * @returns {Date|null} Last usage date or null if never used
 */
function getItemUsage(itemId, itemType, documentHistory) {
  if (!documentHistory.records || documentHistory.records.length === 0) {
    return null // No history means never used
  }

  let lastUsed = null

  for (const record of documentHistory.records) {
    if (!record.usedItems) continue

    // Check if this item was used in this document
    const wasUsed = record.usedItems.some(
      (item) => item.itemId === itemId && item.itemType === itemType
    )

    if (wasUsed) {
      const recordDate = new Date(record.generatedAt || record.createdAt)
      if (!lastUsed || recordDate > lastUsed) {
        lastUsed = recordDate
      }
    }
  }

  return lastUsed
}

/**
 * Check items for staleness (both age AND usage conditions)
 */
function checkStaleness(items, entityType, documentHistory, now, timestamp) {
  const findings = []
  const ageCutoff = new Date(now.getTime() - STALENESS_THRESHOLDS.AGE_DAYS * 24 * 60 * 60 * 1000)
  const usageCutoff = new Date(now.getTime() - STALENESS_THRESHOLDS.USAGE_DAYS * 24 * 60 * 60 * 1000)

  for (const item of items) {
    // Check age condition
    const updatedAt = new Date(item.updatedAt)
    const isOld = updatedAt < ageCutoff
    const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (24 * 60 * 60 * 1000))

    if (!isOld) continue // Skip items that are recently updated

    // Check usage condition
    const lastUsed = getItemUsage(item.id, entityType, documentHistory)
    const isUnused = !lastUsed || lastUsed < usageCutoff
    const daysSinceUsage = lastUsed
      ? Math.floor((now.getTime() - lastUsed.getTime()) / (24 * 60 * 60 * 1000))
      : null

    // BOTH conditions must be true for staleness
    if (isOld && isUnused) {
      const usageText = daysSinceUsage
        ? `and not used in documents for ${daysSinceUsage} days`
        : 'and never used in documents'

      findings.push({
        type: 'stale',
        entityType: entityType,
        ids: [item.id],
        reason: `Not updated in ${daysSinceUpdate} days ${usageText}`,
        suggestion: generateStaleSuggestion(item, entityType),
        createdAt: timestamp
      })
    }
  }

  return findings
}

/**
 * Generate appropriate suggestion for stale items
 */
function generateStaleSuggestion(item, entityType) {
  switch (entityType) {
    case 'skill':
      return `Review if '${item.name}' is still relevant. If still a current skill, update with recent examples. If outdated, consider removing or demoting to 'familiar'.`

    case 'story':
      return `Review if '${item.title}' is still your best example. Consider updating with fresher details or replacing with a more recent story.`

    case 'summary':
      return `This summary block may contain outdated language or achievements. Review and refresh with current accomplishments.`

    case 'experience':
      return `Review this role's project descriptions and achievements. Consider adding recent metrics or accomplishments if still relevant.`

    default:
      return `Review and update or remove if no longer relevant`
  }
}
