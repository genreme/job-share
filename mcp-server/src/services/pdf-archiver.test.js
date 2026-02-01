/**
 * PDF Archiver Service Tests
 *
 * Tests PDF generation from job data with mocked puppeteer.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock puppeteer before importing the module
vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn()
  }
}))

// Mock fs operations
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn()
  }
})

import puppeteer from 'puppeteer'
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import {
  archiveJobAsPdf,
  listArchivedJobs,
  generateArchiveHtml,
  sanitizeFilename
} from './pdf-archiver.js'

/**
 * Create mock page object
 */
function createMockPage() {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    setContent: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(undefined)
  }
}

/**
 * Create mock browser object
 */
function createMockBrowser(mockPage) {
  return {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined)
  }
}

/**
 * Create a mock job for testing
 */
function createMockJob(overrides = {}) {
  return {
    id: 123,
    title: 'Software Engineer',
    company: 'Acme Corp',
    location: 'Boston, MA',
    salary: '$150,000',
    description: 'Great job opportunity',
    url: 'https://example.com/job/123',
    fitScore: 85,
    status: 'interested',
    ...overrides
  }
}

describe('sanitizeFilename', () => {
  it('converts string to lowercase with dashes', () => {
    expect(sanitizeFilename('Acme Corp Inc')).toBe('acme-corp-inc')
  })

  it('replaces non-alphanumeric characters with dashes', () => {
    expect(sanitizeFilename('Test@Company#2024!')).toBe('test-company-2024')
  })

  it('removes leading and trailing dashes', () => {
    expect(sanitizeFilename('--Test Company--')).toBe('test-company')
  })

  it('limits to 50 characters', () => {
    const longName = 'a'.repeat(100)
    expect(sanitizeFilename(longName).length).toBe(50)
  })

  it('returns "unknown" for null', () => {
    expect(sanitizeFilename(null)).toBe('unknown')
  })

  it('returns "unknown" for undefined', () => {
    expect(sanitizeFilename(undefined)).toBe('unknown')
  })

  it('returns "unknown" for empty string', () => {
    expect(sanitizeFilename('')).toBe('unknown')
  })

  it('returns "unknown" for non-string types', () => {
    expect(sanitizeFilename(123)).toBe('unknown')
    expect(sanitizeFilename({})).toBe('unknown')
  })

  it('handles strings with only special characters', () => {
    expect(sanitizeFilename('!!!@@@###')).toBe('unknown')
  })
})

describe('generateArchiveHtml', () => {
  it('generates HTML with job title and company', () => {
    const job = createMockJob()
    const html = generateArchiveHtml(job)

    expect(html).toContain('Software Engineer')
    expect(html).toContain('Acme Corp')
  })

  it('includes location and salary', () => {
    const job = createMockJob()
    const html = generateArchiveHtml(job)

    expect(html).toContain('Boston, MA')
    expect(html).toContain('$150,000')
  })

  it('includes fit score', () => {
    const job = createMockJob({ fitScore: 92 })
    const html = generateArchiveHtml(job)

    expect(html).toContain('Fit Score: 92')
  })

  it('includes job description', () => {
    const job = createMockJob({ description: 'Looking for talented engineers' })
    const html = generateArchiveHtml(job)

    expect(html).toContain('Looking for talented engineers')
  })

  it('uses notes when description is missing', () => {
    const job = createMockJob({ description: null, notes: 'My notes about the job' })
    const html = generateArchiveHtml(job)

    expect(html).toContain('My notes about the job')
  })

  it('includes friend context when present', () => {
    const job = createMockJob({ friendContext: 'John referred me' })
    const html = generateArchiveHtml(job)

    expect(html).toContain('Friend Connection')
    expect(html).toContain('John referred me')
  })

  it('includes original URL in footer', () => {
    const job = createMockJob({ url: 'https://jobs.example.com/123' })
    const html = generateArchiveHtml(job)

    expect(html).toContain('https://jobs.example.com/123')
  })

  it('handles missing data gracefully', () => {
    const job = {
      id: 1
    }
    const html = generateArchiveHtml(job)

    expect(html).toContain('Untitled Position')
    expect(html).toContain('Unknown Company')
    expect(html).toContain('Location not specified')
    expect(html).toContain('Salary not listed')
  })
})

describe('archiveJobAsPdf', () => {
  let mockPage
  let mockBrowser

  beforeEach(() => {
    vi.clearAllMocks()

    mockPage = createMockPage()
    mockBrowser = createMockBrowser(mockPage)

    puppeteer.launch.mockResolvedValue(mockBrowser)
    existsSync.mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates archive directory if missing', async () => {
    existsSync.mockReturnValue(false)

    await archiveJobAsPdf(createMockJob())

    expect(mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('archives'),
      { recursive: true }
    )
  })

  it('launches browser with headless mode', async () => {
    await archiveJobAsPdf(createMockJob())

    expect(puppeteer.launch).toHaveBeenCalledWith({ headless: 'new' })
  })

  it('generates correct filename format', async () => {
    const result = await archiveJobAsPdf(createMockJob({
      company: 'Test Company',
      id: 456
    }))

    expect(result.filename).toMatch(/^test-company-456-\d+\.pdf$/)
  })

  it('fetches live URL when available', async () => {
    const job = createMockJob({ url: 'https://example.com/job' })

    await archiveJobAsPdf(job)

    expect(mockPage.goto).toHaveBeenCalledWith(
      'https://example.com/job',
      expect.objectContaining({
        waitUntil: 'networkidle0',
        timeout: 30000
      })
    )
  })

  it('falls back to HTML when URL fetch fails', async () => {
    mockPage.goto.mockRejectedValue(new Error('Navigation failed'))

    const result = await archiveJobAsPdf(createMockJob())

    expect(mockPage.setContent).toHaveBeenCalled()
    expect(result.success).toBe(true)
    expect(result.usedFallback).toBe(true)
  })

  it('uses generated HTML when no URL provided', async () => {
    const job = createMockJob({ url: null })

    const result = await archiveJobAsPdf(job)

    expect(mockPage.goto).not.toHaveBeenCalled()
    expect(mockPage.setContent).toHaveBeenCalled()
    expect(result.usedFallback).toBe(true)
  })

  it('generates PDF with correct options', async () => {
    await archiveJobAsPdf(createMockJob())

    expect(mockPage.pdf).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      })
    )
  })

  it('returns success with file info', async () => {
    const result = await archiveJobAsPdf(createMockJob())

    expect(result.success).toBe(true)
    expect(result.filename).toBeDefined()
    expect(result.path).toBeDefined()
    expect(result.archivedAt).toBeDefined()
  })

  it('always closes browser on success', async () => {
    await archiveJobAsPdf(createMockJob())

    expect(mockBrowser.close).toHaveBeenCalled()
  })

  it('always closes browser on error', async () => {
    mockPage.pdf.mockRejectedValue(new Error('PDF generation failed'))

    await archiveJobAsPdf(createMockJob())

    expect(mockBrowser.close).toHaveBeenCalled()
  })

  it('always closes browser when URL fetch fails', async () => {
    mockPage.goto.mockRejectedValue(new Error('Network error'))

    await archiveJobAsPdf(createMockJob())

    expect(mockBrowser.close).toHaveBeenCalled()
  })

  it('returns error on failure', async () => {
    mockPage.pdf.mockRejectedValue(new Error('PDF error'))

    const result = await archiveJobAsPdf(createMockJob())

    expect(result.success).toBe(false)
    expect(result.error).toBe('PDF error')
  })
})

describe('listArchivedJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when archive directory does not exist', () => {
    existsSync.mockReturnValue(false)

    const result = listArchivedJobs()

    expect(result).toEqual([])
  })

  it('returns empty array when no PDF files exist', () => {
    existsSync.mockReturnValue(true)
    readdirSync.mockReturnValue(['readme.txt', 'data.json'])

    const result = listArchivedJobs()

    expect(result).toEqual([])
  })

  it('lists PDF files with correct metadata', () => {
    existsSync.mockReturnValue(true)
    readdirSync.mockReturnValue(['job1.pdf', 'job2.pdf'])
    statSync.mockImplementation((path) => ({
      mtime: new Date('2024-01-15T10:00:00Z')
    }))

    const result = listArchivedJobs()

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      filename: expect.stringMatching(/\.pdf$/),
      path: expect.stringContaining('archives'),
      createdAt: expect.any(String)
    })
  })

  it('sorts by creation time, newest first', () => {
    existsSync.mockReturnValue(true)
    readdirSync.mockReturnValue(['old.pdf', 'new.pdf'])

    let callCount = 0
    statSync.mockImplementation(() => {
      callCount++
      return {
        mtime: callCount === 1
          ? new Date('2024-01-01T00:00:00Z')
          : new Date('2024-02-01T00:00:00Z')
      }
    })

    const result = listArchivedJobs()

    expect(result[0].filename).toBe('new.pdf')
    expect(result[1].filename).toBe('old.pdf')
  })

  it('handles read errors gracefully', () => {
    existsSync.mockReturnValue(true)
    readdirSync.mockImplementation(() => {
      throw new Error('Permission denied')
    })

    const result = listArchivedJobs()

    expect(result).toEqual([])
  })
})
