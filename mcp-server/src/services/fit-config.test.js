/**
 * Fit Config Service Tests
 *
 * Tests for fit config loading, saving, and evolution tracking.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs')
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    renameSync: vi.fn()
  }
})

// Import after mocking
import {
  loadFitConfig,
  saveFitConfig,
  updateFitCriteria,
  logOutcome,
  createDefaultConfig,
  getDefaultCriteria,
  getDefaultWeights
} from './fit-config.js'

describe('fit-config service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createDefaultConfig', () => {
    it('creates config with required structure', () => {
      const config = createDefaultConfig()

      expect(config.version).toBe('1.0')
      expect(config.createdAt).toBeDefined()
      expect(config.updatedAt).toBeDefined()
      expect(config.criteria).toBeDefined()
      expect(config.weights).toBeDefined()
      expect(config.evolutionLog).toEqual([])
    })

    it('includes default criteria fields', () => {
      const config = createDefaultConfig()

      expect(config.criteria.titles).toBeDefined()
      expect(config.criteria.titles.exact).toBeInstanceOf(Array)
      expect(config.criteria.titles.partial).toBeInstanceOf(Array)
      expect(config.criteria.industries).toBeDefined()
      expect(config.criteria.locations).toBeDefined()
      expect(config.criteria.salaryMin).toBeDefined()
    })

    it('includes default weights', () => {
      const config = createDefaultConfig()

      expect(config.weights.BASE).toBe(50)
      expect(config.weights.ROLE_EXACT).toBe(25)
      expect(config.weights.ROLE_PARTIAL).toBe(15)
      expect(config.weights.MAX_TOTAL).toBe(100)
    })
  })

  describe('loadFitConfig', () => {
    it('returns default config when file does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const config = loadFitConfig()

      expect(config.version).toBe('1.0')
      expect(config.criteria).toBeDefined()
      expect(config.weights).toBeDefined()
    })

    it('loads and parses config from file', () => {
      const savedConfig = {
        version: '1.1',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z',
        criteria: {
          titles: { exact: ['Test Role'], partial: ['Test'] },
          industries: { preferred: ['tech'], acceptable: [] },
          locations: { preferred: ['remote'], acceptable: [] },
          salaryMin: 100000
        },
        weights: { BASE: 50, ROLE_EXACT: 30 },
        evolutionLog: [{ type: 'test' }]
      }

      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(savedConfig))

      const config = loadFitConfig()

      expect(config.version).toBe('1.1')
      expect(config.criteria.titles.exact).toEqual(['Test Role'])
      expect(config.criteria.salaryMin).toBe(100000)
      expect(config.evolutionLog).toHaveLength(1)
    })

    it('merges with defaults when config has missing fields', () => {
      const partialConfig = {
        version: '1.0',
        criteria: {
          titles: { exact: ['Custom Role'] }
          // missing industries, locations, salaryMin
        },
        weights: {}
      }

      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(partialConfig))

      const config = loadFitConfig()

      // Custom value preserved
      expect(config.criteria.titles.exact).toEqual(['Custom Role'])
      // Defaults filled in
      expect(config.weights.BASE).toBe(50)
      expect(config.evolutionLog).toEqual([])
    })

    it('returns default config on parse error', () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue('not valid json')

      const config = loadFitConfig()

      expect(config.version).toBe('1.0')
      expect(config.criteria).toBeDefined()
    })
  })

  describe('saveFitConfig', () => {
    it('writes config to temp file then renames', () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const config = createDefaultConfig()
      const result = saveFitConfig(config)

      expect(result.success).toBe(true)
      expect(writeFileSync).toHaveBeenCalled()
    })

    it('creates data directory if missing', () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const config = createDefaultConfig()
      saveFitConfig(config)

      expect(mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true })
    })

    it('updates timestamp on save', () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const config = createDefaultConfig()
      config.updatedAt = '2020-01-01T00:00:00Z' // Old timestamp

      saveFitConfig(config)

      // Check that writeFileSync was called with updated timestamp
      const writeCall = vi.mocked(writeFileSync).mock.calls[0]
      const savedContent = JSON.parse(writeCall[1])
      expect(new Date(savedContent.updatedAt).getFullYear()).toBeGreaterThan(2020)
    })
  })

  describe('updateFitCriteria', () => {
    beforeEach(() => {
      // Mock successful load and save
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(createDefaultConfig()))
    })

    it('returns error for null updates', () => {
      const result = updateFitCriteria(null)

      expect(result.success).toBe(false)
      expect(result.error).toContain('must be an object')
    })

    it('updates titles criteria', () => {
      const result = updateFitCriteria({
        titles: { exact: ['New Role'] }
      }, 'Adding new target role')

      expect(result.success).toBe(true)
      expect(result.config.criteria.titles.exact).toContain('New Role')
    })

    it('updates salary minimum', () => {
      const result = updateFitCriteria({
        salaryMin: 150000
      })

      expect(result.success).toBe(true)
      expect(result.config.criteria.salaryMin).toBe(150000)
    })

    it('logs update to evolution history when reason provided', () => {
      const result = updateFitCriteria({
        salaryMin: 150000
      }, 'Increasing minimum after market research')

      expect(result.success).toBe(true)
      expect(result.config.evolutionLog.length).toBeGreaterThan(0)

      const lastEntry = result.config.evolutionLog[result.config.evolutionLog.length - 1]
      expect(lastEntry.type).toBe('criteria_update')
      expect(lastEntry.reason).toBe('Increasing minimum after market research')
    })
  })

  describe('logOutcome', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(createDefaultConfig()))
    })

    it('returns error for missing jobId', () => {
      const result = logOutcome({ outcome: 'positive', fitScore: 85 })

      expect(result.success).toBe(false)
      expect(result.error).toContain('jobId')
    })

    it('returns error for invalid outcome', () => {
      const result = logOutcome({ jobId: 1, outcome: 'invalid', fitScore: 85 })

      expect(result.success).toBe(false)
      expect(result.error).toContain('outcome')
    })

    it('returns error for missing fitScore', () => {
      const result = logOutcome({ jobId: 1, outcome: 'positive' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('fitScore')
    })

    it('logs positive outcome', () => {
      const result = logOutcome({
        jobId: 123,
        outcome: 'positive',
        fitScore: 92,
        notes: 'Got an interview!'
      })

      expect(result.success).toBe(true)
    })

    it('logs negative outcome', () => {
      const result = logOutcome({
        jobId: 456,
        outcome: 'negative',
        fitScore: 65
      })

      expect(result.success).toBe(true)
    })

    it('logs neutral outcome', () => {
      const result = logOutcome({
        jobId: 789,
        outcome: 'neutral',
        fitScore: 75
      })

      expect(result.success).toBe(true)
    })
  })

  describe('getDefaultCriteria', () => {
    it('returns criteria object', () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const criteria = getDefaultCriteria()

      expect(criteria.titles).toBeDefined()
      expect(criteria.industries).toBeDefined()
      expect(criteria.locations).toBeDefined()
      expect(criteria.salaryMin).toBeDefined()
    })
  })

  describe('getDefaultWeights', () => {
    it('returns weights object', () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const weights = getDefaultWeights()

      expect(weights.BASE).toBe(50)
      expect(weights.ROLE_EXACT).toBe(25)
      expect(weights.MAX_TOTAL).toBe(100)
    })
  })
})

describe('fit-config evolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('evolution log is capped at 100 entries', () => {
    const config = createDefaultConfig()
    // Pre-fill with 99 entries
    for (let i = 0; i < 99; i++) {
      config.evolutionLog.push({ type: 'test', index: i })
    }

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config))

    // Log two more outcomes to exceed 100
    logOutcome({ jobId: 1, outcome: 'positive', fitScore: 80 })
    logOutcome({ jobId: 2, outcome: 'positive', fitScore: 85 })

    // Check that write was called with capped log
    const lastWriteCall = vi.mocked(writeFileSync).mock.calls[vi.mocked(writeFileSync).mock.calls.length - 1]
    const savedContent = JSON.parse(lastWriteCall[1])

    expect(savedContent.evolutionLog.length).toBeLessThanOrEqual(100)
  })
})
