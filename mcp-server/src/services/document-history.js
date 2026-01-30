/**
 * Document History Service
 *
 * Tracks which profile items are used in generated documents.
 * Enables staleness detection by tracking item usage over time.
 */

import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..', '..', '..')
const DATA_DIR = join(PROJECT_ROOT, 'mcp-server', 'data')
export const HISTORY_PATH = join(DATA_DIR, 'document-history.json')

// Maximum history records to keep (rolling window)
const MAX_HISTORY_RECORDS = 100

/**
 * Record a document generation event
 *
 * @param {string} documentType - 'resume' | 'cover_letter' | 'interview_prep'
 * @param {object} jobContext - { company, title }
 * @param {Array} usedItems - Array of { itemType, itemId }
 * @returns {object} The created record
 */
export function recordDocumentGeneration(documentType, jobContext, usedItems) {
  const record = {
    id: uuidv4(),
    documentType,
    jobContext: {
      company: jobContext.company || '',
      title: jobContext.title || ''
    },
    usedItems: usedItems || [],
    generatedAt: new Date().toISOString()
  }

  // Load existing history
  const history = loadHistory()

  // Add new record
  history.records.push(record)

  // Trim to max records (keep most recent)
  if (history.records.length > MAX_HISTORY_RECORDS) {
    history.records = history.records.slice(-MAX_HISTORY_RECORDS)
  }

  // Update lastUpdated
  history.lastUpdated = new Date().toISOString()

  // Save atomically
  saveHistory(history)

  return record
}

/**
 * Get document generation history
 *
 * @param {object} options - { limit?, documentType?, since? }
 * @returns {Array} Filtered/limited history records
 */
export function getDocumentHistory(options = {}) {
  const history = loadHistory()
  let records = history.records || []

  // Filter by document type
  if (options.documentType) {
    records = records.filter((r) => r.documentType === options.documentType)
  }

  // Filter by date (since)
  if (options.since) {
    const sinceDate = new Date(options.since)
    records = records.filter((r) => new Date(r.generatedAt) >= sinceDate)
  }

  // Sort by date (most recent first)
  records.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))

  // Apply limit
  if (options.limit && options.limit > 0) {
    records = records.slice(0, options.limit)
  }

  return records
}

/**
 * Get usage statistics for a specific profile item
 *
 * @param {string} itemType - 'skill' | 'story' | 'experience' | 'project' | 'summary'
 * @param {string} itemId - The item UUID
 * @returns {object} { lastUsed: timestamp | null, useCount: number, documents: [...] }
 */
export function getItemUsage(itemType, itemId) {
  const history = loadHistory()
  const records = history.records || []

  const usageRecords = records.filter((record) =>
    (record.usedItems || []).some((item) => item.itemType === itemType && item.itemId === itemId)
  )

  if (usageRecords.length === 0) {
    return {
      lastUsed: null,
      useCount: 0,
      documents: []
    }
  }

  // Sort by date (most recent first)
  usageRecords.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))

  return {
    lastUsed: usageRecords[0].generatedAt,
    useCount: usageRecords.length,
    documents: usageRecords.map((r) => ({
      documentType: r.documentType,
      jobContext: r.jobContext,
      generatedAt: r.generatedAt
    }))
  }
}

/**
 * Get items that haven't been used within a given number of days
 *
 * @param {Array} itemIds - Array of { itemType, itemId } to check
 * @param {number} days - Number of days threshold
 * @returns {Array} Items not used within threshold
 */
export function getUnusedItems(itemIds, days = 90) {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - days)

  const unused = []

  for (const item of itemIds) {
    const usage = getItemUsage(item.itemType, item.itemId)

    if (!usage.lastUsed || new Date(usage.lastUsed) < threshold) {
      unused.push({
        ...item,
        lastUsed: usage.lastUsed,
        daysSinceUse: usage.lastUsed
          ? Math.floor((Date.now() - new Date(usage.lastUsed).getTime()) / (1000 * 60 * 60 * 24))
          : null
      })
    }
  }

  return unused
}

/**
 * Get summary statistics for document generation
 *
 * @returns {object} Statistics summary
 */
export function getDocumentStats() {
  const history = loadHistory()
  const records = history.records || []

  const stats = {
    totalDocuments: records.length,
    byType: {
      resume: 0,
      cover_letter: 0,
      interview_prep: 0
    },
    recentActivity: [],
    lastGenerated: null
  }

  for (const record of records) {
    if (stats.byType[record.documentType] !== undefined) {
      stats.byType[record.documentType]++
    }
  }

  // Recent activity (last 7 days)
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  stats.recentActivity = records
    .filter((r) => new Date(r.generatedAt) >= weekAgo)
    .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))

  // Last generated
  if (records.length > 0) {
    const sorted = [...records].sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))
    stats.lastGenerated = sorted[0].generatedAt
  }

  return stats
}

/**
 * Clear document history (for testing)
 *
 * @returns {boolean} Success
 */
export function clearHistory() {
  const emptyHistory = {
    records: [],
    lastUpdated: new Date().toISOString()
  }
  saveHistory(emptyHistory)
  return true
}

// =============================================================================
// Internal Functions
// =============================================================================

/**
 * Load history from disk
 */
function loadHistory() {
  if (!existsSync(HISTORY_PATH)) {
    return {
      records: [],
      lastUpdated: new Date().toISOString()
    }
  }

  try {
    const content = readFileSync(HISTORY_PATH, 'utf-8')
    return JSON.parse(content)
  } catch (e) {
    console.error('Error loading document history:', e.message)
    return {
      records: [],
      lastUpdated: new Date().toISOString()
    }
  }
}

/**
 * Save history to disk atomically
 */
function saveHistory(history) {
  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }

  try {
    const tempPath = HISTORY_PATH + '.tmp'
    writeFileSync(tempPath, JSON.stringify(history, null, 2))
    renameSync(tempPath, HISTORY_PATH)
    return true
  } catch (e) {
    console.error('Error saving document history:', e.message)
    return false
  }
}
