/**
 * Board Registry Service - Manage job board quality registry
 *
 * Provides:
 * - loadBoardRegistry: Load boards from JSON
 * - getBoardsForScan: Get active boards sorted by quality
 * - addBoardForTesting: Add a new board to testing queue
 * - updateBoardMetrics: Update scan metrics for a board
 * - blacklistBoard: Blacklist a board (requires user confirmation)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const REGISTRY_PATH = join(DATA_DIR, 'job-boards.json')

/**
 * Create default registry structure
 *
 * @returns {object} Default registry
 */
export function createDefaultRegistry() {
  const now = new Date().toISOString()
  return {
    version: '1.0',
    createdAt: now,
    updatedAt: now,
    boards: [],
    blacklist: [],
    testingBoards: []
  }
}

/**
 * Load board registry from disk
 *
 * @returns {object} The loaded or default registry
 */
export function loadBoardRegistry() {
  if (!existsSync(REGISTRY_PATH)) {
    console.warn('Board registry not found, using empty registry:', REGISTRY_PATH)
    return createDefaultRegistry()
  }

  try {
    const content = readFileSync(REGISTRY_PATH, 'utf-8')
    const registry = JSON.parse(content)

    // Ensure required fields
    return {
      version: registry.version || '1.0',
      createdAt: registry.createdAt || new Date().toISOString(),
      updatedAt: registry.updatedAt || new Date().toISOString(),
      boards: registry.boards || [],
      blacklist: registry.blacklist || [],
      testingBoards: registry.testingBoards || []
    }
  } catch (e) {
    console.error('Error loading board registry, using empty:', e.message)
    return createDefaultRegistry()
  }
}

/**
 * Save board registry to disk with atomic write
 *
 * @param {object} registry - The registry to save
 * @returns {{ success: boolean, error?: string }}
 */
export function saveBoardRegistry(registry) {
  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }

  try {
    const toSave = {
      ...registry,
      updatedAt: new Date().toISOString()
    }

    // Atomic write
    const tempPath = REGISTRY_PATH + '.tmp'
    writeFileSync(tempPath, JSON.stringify(toSave, null, 2))
    renameSync(tempPath, REGISTRY_PATH)

    return { success: true }
  } catch (e) {
    console.error('Error saving board registry:', e.message)
    return { success: false, error: e.message }
  }
}

/**
 * Get active boards for scanning, sorted by quality rating
 *
 * @param {object} [options] - Filter options
 * @param {number} [options.minQuality] - Minimum quality rating (0-100)
 * @param {boolean} [options.includeBlacklisted] - Include blacklisted boards
 * @returns {object[]} Sorted array of boards
 */
export function getBoardsForScan(options = {}) {
  const registry = loadBoardRegistry()
  const { minQuality = 0, includeBlacklisted = false } = options

  // Filter to active boards
  let boards = registry.boards.filter(board => board.status === 'active')

  // Apply quality filter
  if (minQuality > 0) {
    boards = boards.filter(board => (board.quality?.rating || 0) >= minQuality)
  }

  // Exclude blacklisted unless requested
  if (!includeBlacklisted && registry.blacklist.length > 0) {
    const blacklistedIds = new Set(registry.blacklist.map(b => b.boardId))
    boards = boards.filter(board => !blacklistedIds.has(board.id))
  }

  // Sort by quality rating (highest first)
  boards.sort((a, b) => (b.quality?.rating || 0) - (a.quality?.rating || 0))

  return boards
}

/**
 * Add a new board for testing
 *
 * Testing boards are not included in scan rotation until promoted.
 *
 * @param {object} params - Board parameters
 * @param {string} params.name - Board name
 * @param {string} params.domain - Domain pattern (e.g., "jobs.example.com")
 * @param {object} [params.selectors] - CSS selectors for extraction
 * @param {string} [params.notes] - Notes about the board
 * @returns {{ success: boolean, boardId?: string, error?: string }}
 */
export function addBoardForTesting({ name, domain, selectors, notes }) {
  if (!name || typeof name !== 'string') {
    return { success: false, error: 'name is required' }
  }

  if (!domain || typeof domain !== 'string') {
    return { success: false, error: 'domain is required' }
  }

  const registry = loadBoardRegistry()

  // Check for duplicate domain
  const existingBoard = registry.boards.find(b =>
    b.domain.toLowerCase() === domain.toLowerCase()
  )
  if (existingBoard) {
    return { success: false, error: `Board with domain '${domain}' already exists: ${existingBoard.name}` }
  }

  const existingTest = registry.testingBoards.find(b =>
    b.domain.toLowerCase() === domain.toLowerCase()
  )
  if (existingTest) {
    return { success: false, error: `Board with domain '${domain}' already in testing: ${existingTest.name}` }
  }

  // Generate ID from name
  const boardId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  const newBoard = {
    id: boardId,
    name,
    domain,
    status: 'testing',
    quality: {
      rating: 0,
      dataCompleteness: 0,
      lastUpdated: new Date().toISOString().split('T')[0]
    },
    metrics: {
      totalScanned: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      lastScanDate: null
    },
    selectors: selectors || {},
    notes: notes || '',
    addedAt: new Date().toISOString()
  }

  registry.testingBoards.push(newBoard)

  const result = saveBoardRegistry(registry)

  if (result.success) {
    return { success: true, boardId }
  }

  return { success: false, error: result.error }
}

/**
 * Update metrics for a board after scanning
 *
 * @param {object} params - Update parameters
 * @param {string} params.boardId - Board ID
 * @param {number} params.scanned - Number of jobs scanned
 * @param {number} params.successful - Successful extractions
 * @param {number} params.failed - Failed extractions
 * @returns {{ success: boolean, board?: object, error?: string }}
 */
export function updateBoardMetrics({ boardId, scanned, successful, failed }) {
  if (!boardId || typeof boardId !== 'string') {
    return { success: false, error: 'boardId is required' }
  }

  if (typeof scanned !== 'number' || scanned < 0) {
    return { success: false, error: 'scanned must be a non-negative number' }
  }

  if (typeof successful !== 'number' || successful < 0) {
    return { success: false, error: 'successful must be a non-negative number' }
  }

  if (typeof failed !== 'number' || failed < 0) {
    return { success: false, error: 'failed must be a non-negative number' }
  }

  const registry = loadBoardRegistry()

  // Find board in active boards or testing boards
  let board = registry.boards.find(b => b.id === boardId)
  let isTestingBoard = false

  if (!board) {
    board = registry.testingBoards.find(b => b.id === boardId)
    isTestingBoard = true
  }

  if (!board) {
    return { success: false, error: `Board '${boardId}' not found` }
  }

  // Update metrics
  board.metrics = board.metrics || {}
  board.metrics.totalScanned = (board.metrics.totalScanned || 0) + scanned
  board.metrics.successfulExtractions = (board.metrics.successfulExtractions || 0) + successful
  board.metrics.failedExtractions = (board.metrics.failedExtractions || 0) + failed
  board.metrics.lastScanDate = new Date().toISOString()

  // Recalculate quality rating based on success rate
  const totalExtractions = board.metrics.successfulExtractions + board.metrics.failedExtractions
  if (totalExtractions > 0) {
    const successRate = board.metrics.successfulExtractions / totalExtractions
    // Quality rating is weighted: 70% success rate + 30% base data completeness
    const baseCompleteness = board.quality?.dataCompleteness || 50
    board.quality = board.quality || {}
    board.quality.rating = Math.round(successRate * 70 + (baseCompleteness / 100) * 30)
    board.quality.lastUpdated = new Date().toISOString().split('T')[0]
  }

  const result = saveBoardRegistry(registry)

  if (result.success) {
    return { success: true, board }
  }

  return { success: false, error: result.error }
}

/**
 * Blacklist a board
 *
 * IMPORTANT: Requires userConfirmed=true to proceed.
 * This is a safety measure to prevent accidental blacklisting.
 *
 * @param {object} params - Blacklist parameters
 * @param {string} params.boardId - Board ID to blacklist
 * @param {string} params.reason - Reason for blacklisting
 * @param {boolean} params.userConfirmed - Must be true to proceed
 * @returns {{ success: boolean, error?: string }}
 */
export function blacklistBoard({ boardId, reason, userConfirmed }) {
  // Safety check: require explicit user confirmation
  if (userConfirmed !== true) {
    return {
      success: false,
      error: 'Blacklisting requires userConfirmed=true. This action will remove the board from scan rotation.',
      requiresConfirmation: true
    }
  }

  if (!boardId || typeof boardId !== 'string') {
    return { success: false, error: 'boardId is required' }
  }

  if (!reason || typeof reason !== 'string') {
    return { success: false, error: 'reason is required for blacklisting' }
  }

  const registry = loadBoardRegistry()

  // Find board
  const boardIndex = registry.boards.findIndex(b => b.id === boardId)
  const testBoardIndex = registry.testingBoards.findIndex(b => b.id === boardId)

  if (boardIndex === -1 && testBoardIndex === -1) {
    return { success: false, error: `Board '${boardId}' not found` }
  }

  // Check if already blacklisted
  if (registry.blacklist.some(b => b.boardId === boardId)) {
    return { success: false, error: `Board '${boardId}' is already blacklisted` }
  }

  // Get board name before removing
  let boardName
  if (boardIndex !== -1) {
    boardName = registry.boards[boardIndex].name
    // Mark as blacklisted (don't remove, just change status)
    registry.boards[boardIndex].status = 'blacklisted'
  } else {
    boardName = registry.testingBoards[testBoardIndex].name
    // Remove from testing boards
    registry.testingBoards.splice(testBoardIndex, 1)
  }

  // Add to blacklist
  registry.blacklist.push({
    boardId,
    boardName,
    reason,
    blacklistedAt: new Date().toISOString()
  })

  const result = saveBoardRegistry(registry)

  if (result.success) {
    return { success: true, message: `Board '${boardName}' has been blacklisted: ${reason}` }
  }

  return { success: false, error: result.error }
}

/**
 * Promote a testing board to active
 *
 * @param {object} params - Promotion parameters
 * @param {string} params.boardId - Board ID to promote
 * @returns {{ success: boolean, board?: object, error?: string }}
 */
export function promoteBoardToActive({ boardId }) {
  if (!boardId || typeof boardId !== 'string') {
    return { success: false, error: 'boardId is required' }
  }

  const registry = loadBoardRegistry()

  const testIndex = registry.testingBoards.findIndex(b => b.id === boardId)
  if (testIndex === -1) {
    return { success: false, error: `Board '${boardId}' not found in testing boards` }
  }

  // Move from testing to active
  const board = registry.testingBoards[testIndex]
  board.status = 'active'
  board.promotedAt = new Date().toISOString()

  registry.boards.push(board)
  registry.testingBoards.splice(testIndex, 1)

  const result = saveBoardRegistry(registry)

  if (result.success) {
    return { success: true, board }
  }

  return { success: false, error: result.error }
}

/**
 * Get a specific board by ID
 *
 * @param {string} boardId - Board ID
 * @returns {object|null} Board object or null if not found
 */
export function getBoardById(boardId) {
  if (!boardId) return null

  const registry = loadBoardRegistry()

  return registry.boards.find(b => b.id === boardId) ||
         registry.testingBoards.find(b => b.id === boardId) ||
         null
}

/**
 * Get registry file path (for testing)
 *
 * @returns {string} Absolute path to registry file
 */
export function getRegistryPath() {
  return REGISTRY_PATH
}
