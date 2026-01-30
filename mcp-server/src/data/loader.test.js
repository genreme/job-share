/**
 * Tests for Data Loader
 *
 * Tests the data loading functions with mocked file system.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn()
}))

// Import after mocking
import { loadJobsFromDashboard, loadLearningData, saveLearningData } from './loader.js'

describe('loadJobsFromDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress console.error during tests
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns data when file exists', () => {
    const mockData = {
      jobs: [
        { id: 1, title: 'Creative Director', company: 'Acme' }
      ],
      searchHistory: [],
      settings: {}
    }

    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify(mockData))

    const result = loadJobsFromDashboard()

    expect(result.jobs).toHaveLength(1)
    expect(result.jobs[0].title).toBe('Creative Director')
  })

  it('returns empty structure when file missing', () => {
    fs.existsSync.mockReturnValue(false)

    const result = loadJobsFromDashboard()

    expect(result).toEqual({ jobs: [], searchHistory: [], settings: {} })
  })

  it('handles JSON parse errors', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue('invalid json {{{')

    const result = loadJobsFromDashboard()

    expect(result).toEqual({ jobs: [], searchHistory: [], settings: {} })
    expect(console.error).toHaveBeenCalled()
  })

  it('returns searchHistory from loaded data', () => {
    const mockData = {
      jobs: [],
      searchHistory: [
        { query: 'design lead boston', date: '2026-01-20' }
      ],
      settings: {}
    }

    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify(mockData))

    const result = loadJobsFromDashboard()

    expect(result.searchHistory).toHaveLength(1)
    expect(result.searchHistory[0].query).toBe('design lead boston')
  })

  it('logs job count to console.error', () => {
    const mockData = {
      jobs: [
        { id: 1, title: 'Job 1' },
        { id: 2, title: 'Job 2' },
        { id: 3, title: 'Job 3' }
      ]
    }

    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify(mockData))

    loadJobsFromDashboard()

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('3 jobs'))
  })
})

describe('loadLearningData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns data when file exists', () => {
    const mockData = {
      fit_feedback: [{ jobId: 1, feedback: 'Good fit' }],
      presentation_insights: [],
      interview_patterns: [],
      evolution_log: [],
      chat_insights: []
    }

    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify(mockData))

    const result = loadLearningData()

    expect(result.fit_feedback).toHaveLength(1)
    expect(result.fit_feedback[0].feedback).toBe('Good fit')
  })

  it('returns empty structure when file missing', () => {
    fs.existsSync.mockReturnValue(false)

    const result = loadLearningData()

    expect(result).toEqual({
      fit_feedback: [],
      presentation_insights: [],
      interview_patterns: [],
      evolution_log: [],
      chat_insights: []
    })
  })

  it('handles JSON parse errors', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue('not valid json')

    const result = loadLearningData()

    expect(result).toEqual({
      fit_feedback: [],
      presentation_insights: [],
      interview_patterns: [],
      evolution_log: [],
      chat_insights: []
    })
  })
})

describe('saveLearningData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes data to file and returns true', () => {
    fs.writeFileSync.mockImplementation(() => {})

    const data = { fit_feedback: [{ jobId: 1, feedback: 'Test' }] }
    const result = saveLearningData(data)

    expect(result).toBe(true)
    expect(fs.writeFileSync).toHaveBeenCalled()
  })

  it('returns false on write error', () => {
    fs.writeFileSync.mockImplementation(() => {
      throw new Error('Permission denied')
    })

    const data = { fit_feedback: [] }
    const result = saveLearningData(data)

    expect(result).toBe(false)
    expect(console.error).toHaveBeenCalled()
  })
})

describe('Data Validation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs validation warnings for malformed data', () => {
    // Mock console.error to capture validation warnings
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock readFileSync to return data with validation issues
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      jobs: [{ id: 'not-a-number', title: '', company: '', fitScore: 999, status: 'invalid-status' }]
    }))

    const result = loadJobsFromDashboard()

    // Should log validation warnings
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('validation warnings'),
      expect.any(Array)
    )

    consoleError.mockRestore()
  })

  it('applies Zod defaults to loaded data', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      jobs: [{ id: 1, title: 'Test', company: 'Corp', fitScore: 50, status: 'apply-now' }]
      // Missing: searchHistory, settings - should get defaults
    }))

    const result = loadJobsFromDashboard()

    // Zod should have applied defaults
    expect(result.searchHistory).toEqual([])
    expect(result.settings).toEqual({})
  })
})
