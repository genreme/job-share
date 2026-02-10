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
  statSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn()
}))

// Mock os.tmpdir
vi.mock('os', () => ({
  tmpdir: vi.fn(() => '/tmp')
}))

// Import after mocking
import {
  loadJobsFromDashboard,
  loadLearningData,
  saveLearningData,
  writeJobsData,
  loadResumeData,
  loadCoverLetterData,
  getGeneratedDocuments
} from './loader.js'

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

describe('writeJobsData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes data atomically with version and timestamp', () => {
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})

    const data = { jobs: [{ id: 1, title: 'Test Job' }], version: 5 }
    writeJobsData(data)

    expect(fs.writeFileSync).toHaveBeenCalled()
    expect(fs.renameSync).toHaveBeenCalled()

    // Check that version was incremented
    const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1])
    expect(writtenData.version).toBe(6)
    expect(writtenData.lastUpdated).toBeDefined()
  })

  it('starts version at 1 if no version exists', () => {
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})

    const data = { jobs: [] }
    writeJobsData(data)

    const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1])
    expect(writtenData.version).toBe(1)
  })

  it('cleans up temp file on rename failure', () => {
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {
      throw new Error('Rename failed')
    })
    fs.unlinkSync.mockImplementation(() => {})

    expect(() => writeJobsData({ jobs: [] })).toThrow('Rename failed')
    expect(fs.unlinkSync).toHaveBeenCalled()
  })

  it('handles unlinkSync failure silently', () => {
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {
      throw new Error('Rename failed')
    })
    fs.unlinkSync.mockImplementation(() => {
      throw new Error('Unlink failed')
    })

    // Should still throw the original error, not the unlink error
    expect(() => writeJobsData({ jobs: [] })).toThrow('Rename failed')
  })
})

describe('loadResumeData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns resume data when file exists', () => {
    const mockResume = {
      name: 'John Ra',
      experience: [{ company: 'Acme', title: 'Designer' }]
    }

    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify(mockResume))

    const result = loadResumeData()

    expect(result.name).toBe('John Ra')
    expect(result.experience).toHaveLength(1)
  })

  it('returns null when file does not exist', () => {
    fs.existsSync.mockReturnValue(false)

    const result = loadResumeData()

    expect(result).toBeNull()
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Resume data not found'),
      expect.any(String)
    )
  })

  it('returns null on JSON parse error', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue('invalid json')

    const result = loadResumeData()

    expect(result).toBeNull()
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error loading resume data'),
      expect.any(String)
    )
  })
})

describe('loadCoverLetterData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns cover letter data when file exists', () => {
    const mockCL = {
      template: 'Dear Hiring Manager...',
      sections: ['intro', 'body', 'closing']
    }

    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify(mockCL))

    const result = loadCoverLetterData()

    expect(result.template).toBe('Dear Hiring Manager...')
    expect(result.sections).toHaveLength(3)
  })

  it('returns null when file does not exist', () => {
    fs.existsSync.mockReturnValue(false)

    const result = loadCoverLetterData()

    expect(result).toBeNull()
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Cover letter data not found'),
      expect.any(String)
    )
  })

  it('returns null on JSON parse error', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue('not valid json')

    const result = loadCoverLetterData()

    expect(result).toBeNull()
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error loading cover letter data'),
      expect.any(String)
    )
  })
})

describe('getGeneratedDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns list of PDF documents sorted by date', () => {
    fs.readdirSync.mockReturnValue([
      'John Ra Resume - Acme Corp.pdf',
      'John Ra Cover Letter - Beta Inc.pdf',
      'notes.txt'
    ])

    fs.statSync.mockImplementation((path) => {
      if (path.includes('Acme')) {
        return { mtime: new Date('2026-01-15'), size: 50000 }
      }
      return { mtime: new Date('2026-01-20'), size: 30000 }
    })

    const result = getGeneratedDocuments()

    expect(result).toHaveLength(2) // Only PDFs
    expect(result[0].company).toBe('Beta Inc') // Most recent first
    expect(result[0].type).toBe('cover_letter')
    expect(result[1].company).toBe('Acme Corp')
    expect(result[1].type).toBe('resume')
  })

  it('returns empty array when readdirSync throws', () => {
    fs.readdirSync.mockImplementation(() => {
      throw new Error('Directory not found')
    })

    const result = getGeneratedDocuments()

    expect(result).toEqual([])
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error listing documents'),
      expect.any(String)
    )
  })

  it('categorizes unknown PDF types as other', () => {
    fs.readdirSync.mockReturnValue(['random-document.pdf'])
    fs.statSync.mockReturnValue({ mtime: new Date(), size: 10000 })

    const result = getGeneratedDocuments()

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('other')
  })

  it('extracts company name from filename with dash separator', () => {
    fs.readdirSync.mockReturnValue(['John Ra Resume - Boston Childrens Hospital.pdf'])
    fs.statSync.mockReturnValue({ mtime: new Date(), size: 25000 })

    const result = getGeneratedDocuments()

    expect(result[0].company).toBe('Boston Childrens Hospital')
  })

  it('returns Unknown company when pattern does not match', () => {
    fs.readdirSync.mockReturnValue(['resume.pdf'])
    fs.statSync.mockReturnValue({ mtime: new Date(), size: 15000 })

    const result = getGeneratedDocuments()

    expect(result[0].company).toBe('Unknown')
  })
})
