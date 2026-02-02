/**
 * Research Persistence Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getJobResearch,
  getResearchHighlights,
  loadResearch,
  hasResearch,
  getResearchDirectory
} from './research-persistence.js'
import { updateCompanyResearch } from './company-research.js'
import { updateManagerResearch } from './manager-research.js'
import { existsSync, rmSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESEARCH_DIR = join(__dirname, '..', '..', 'data', 'job-research')

// Helper to create valid company research data
function createCompanyData(overrides = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    jobId: 30000,
    companyName: 'TechCorp',
    researchedAt: '2026-02-02T00:00:00Z',
    firmographics: { size: '50-200', industry: 'SaaS' },
    funding: { stage: 'Series B', investors: ['Sequoia'] },
    culture: { values: ['Innovation'], workStyle: 'Remote-first' },
    news: [],
    challenges: ['Scaling'],
    competitors: ['Rival'],
    products: [{ name: 'MainProduct' }],
    confidence: 'high',
    sources: ['crunchbase'],
    highlights: [
      'Recently raised Series B',
      'Remote-first culture',
      'Strong engineering team'
    ],
    ...overrides
  }
}

// Helper to create valid manager research data
function createManagerData(overrides = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440001',
    jobId: 30000,
    managerName: 'Jane Smith',
    researchedAt: '2026-02-02T12:00:00Z',
    background: { currentRole: 'VP Engineering', company: 'TechCorp' },
    interviewStyle: { signals: ['Technical depth'], communicationPattern: 'Direct' },
    linkedIn: { url: 'https://linkedin.com/in/janesmith', activity: ['Posted about AI'] },
    sharedInterests: ['AI', 'Remote work'],
    mutualConnections: ['John Doe'],
    talkingPoints: [
      'Discuss AI integration in engineering',
      'Ask about remote team management'
    ],
    confidence: 'medium',
    sources: ['LinkedIn'],
    ...overrides
  }
}

describe('Research Persistence Service', () => {
  // Ensure research directory exists
  beforeEach(() => {
    if (!existsSync(RESEARCH_DIR)) {
      mkdirSync(RESEARCH_DIR, { recursive: true })
    }
  })

  // Clean up test files after each test
  afterEach(() => {
    const testFiles = [
      join(RESEARCH_DIR, '30000-company.json'),
      join(RESEARCH_DIR, '30000-company.md'),
      join(RESEARCH_DIR, '30000-manager.json'),
      join(RESEARCH_DIR, '30000-manager.md'),
      join(RESEARCH_DIR, '30001-company.json'),
      join(RESEARCH_DIR, '30001-company.md'),
      join(RESEARCH_DIR, '30002-manager.json'),
      join(RESEARCH_DIR, '30002-manager.md')
    ]
    testFiles.forEach(file => {
      if (existsSync(file)) {
        rmSync(file)
      }
    })
  })

  describe('getJobResearch', () => {
    it('should return empty result when no research exists', () => {
      const result = getJobResearch(39999)

      expect(result.jobId).toBe(39999)
      expect(result.company).toBeNull()
      expect(result.manager).toBeNull()
      expect(result.hasResearch).toBe(false)
    })

    it('should load company research when it exists', () => {
      const companyData = createCompanyData()
      updateCompanyResearch(30000, companyData)

      const result = getJobResearch(30000)

      expect(result.hasResearch).toBe(true)
      expect(result.company).toBeDefined()
      expect(result.company.companyName).toBe('TechCorp')
    })

    it('should load manager research when it exists', () => {
      const managerData = createManagerData()
      updateManagerResearch(30000, managerData)

      const result = getJobResearch(30000)

      expect(result.hasResearch).toBe(true)
      expect(result.manager).toBeDefined()
      expect(result.manager.managerName).toBe('Jane Smith')
    })

    it('should load both company and manager research', () => {
      updateCompanyResearch(30000, createCompanyData())
      updateManagerResearch(30000, createManagerData())

      const result = getJobResearch(30000)

      expect(result.hasResearch).toBe(true)
      expect(result.company).toBeDefined()
      expect(result.manager).toBeDefined()
    })

    it('should filter by type=company', () => {
      updateCompanyResearch(30000, createCompanyData())
      updateManagerResearch(30000, createManagerData())

      const result = getJobResearch(30000, 'company')

      expect(result.company).toBeDefined()
      expect(result.manager).toBeNull()
    })

    it('should filter by type=manager', () => {
      updateCompanyResearch(30000, createCompanyData())
      updateManagerResearch(30000, createManagerData())

      const result = getJobResearch(30000, 'manager')

      expect(result.company).toBeNull()
      expect(result.manager).toBeDefined()
    })
  })

  describe('getResearchHighlights', () => {
    it('should return null when no research exists', () => {
      const result = getResearchHighlights(39999)
      expect(result).toBeNull()
    })

    it('should return company highlights', () => {
      updateCompanyResearch(30000, createCompanyData())

      const result = getResearchHighlights(30000)

      expect(result).toBeDefined()
      expect(result.highlights.length).toBeGreaterThan(0)
      expect(result.highlights).toContain('Recently raised Series B')
    })

    it('should include funding stage if not in highlights', () => {
      const companyData = createCompanyData({
        highlights: ['Good team']
      })
      updateCompanyResearch(30000, companyData)

      const result = getResearchHighlights(30000)

      expect(result.highlights.some(h => h.includes('Funding'))).toBe(true)
    })

    it('should include culture work style if not in highlights', () => {
      const companyData = createCompanyData({
        highlights: ['Good team']
      })
      updateCompanyResearch(30000, companyData)

      const result = getResearchHighlights(30000)

      expect(result.highlights.some(h => h.includes('Culture'))).toBe(true)
    })

    it('should include manager talking point', () => {
      updateManagerResearch(30000, createManagerData())

      const result = getResearchHighlights(30000)

      expect(result.highlights.some(h => h.includes('Talking point'))).toBe(true)
    })

    it('should limit to 5 highlights', () => {
      const companyData = createCompanyData({
        highlights: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6']
      })
      updateCompanyResearch(30000, companyData)
      updateManagerResearch(30000, createManagerData())

      const result = getResearchHighlights(30000)

      expect(result.highlights.length).toBeLessThanOrEqual(5)
    })

    it('should include lastUpdated from most recent research', () => {
      updateCompanyResearch(30000, createCompanyData({ researchedAt: '2026-02-01T00:00:00Z' }))
      updateManagerResearch(30000, createManagerData({ researchedAt: '2026-02-02T12:00:00Z' }))

      const result = getResearchHighlights(30000)

      expect(result.lastUpdated).toBe('2026-02-02T12:00:00Z')
    })

    it('should set fullResearchAvailable to true', () => {
      updateCompanyResearch(30000, createCompanyData())

      const result = getResearchHighlights(30000)

      expect(result.fullResearchAvailable).toBe(true)
    })

    it('should not duplicate funding info if already in highlights', () => {
      const companyData = createCompanyData({
        highlights: ['Funding: Series B just closed', 'Other highlight'],
        funding: { stage: 'Series B' }
      })
      updateCompanyResearch(30000, companyData)

      const result = getResearchHighlights(30000)

      const fundingHighlights = result.highlights.filter(h => h.toLowerCase().includes('funding'))
      expect(fundingHighlights.length).toBe(1)
    })
  })

  describe('loadResearch', () => {
    it('should be an alias for getJobResearch', () => {
      updateCompanyResearch(30000, createCompanyData())

      const result1 = getJobResearch(30000)
      const result2 = loadResearch(30000)

      expect(result1.company.companyName).toBe(result2.company.companyName)
    })

    it('should support type parameter', () => {
      updateCompanyResearch(30000, createCompanyData())
      updateManagerResearch(30000, createManagerData())

      const companyOnly = loadResearch(30000, 'company')
      const managerOnly = loadResearch(30000, 'manager')

      expect(companyOnly.manager).toBeNull()
      expect(managerOnly.company).toBeNull()
    })
  })

  describe('hasResearch', () => {
    it('should return false when no research exists', () => {
      expect(hasResearch(39999)).toBe(false)
      expect(hasResearch(39999, 'company')).toBe(false)
      expect(hasResearch(39999, 'manager')).toBe(false)
    })

    it('should return true when company research exists', () => {
      updateCompanyResearch(30001, createCompanyData({ jobId: 456 }))

      expect(hasResearch(30001)).toBe(true)
      expect(hasResearch(30001, 'company')).toBe(true)
      expect(hasResearch(30001, 'manager')).toBe(false)
    })

    it('should return true when manager research exists', () => {
      updateManagerResearch(30002, createManagerData({ jobId: 789 }))

      expect(hasResearch(30002)).toBe(true)
      expect(hasResearch(30002, 'manager')).toBe(true)
      expect(hasResearch(30002, 'company')).toBe(false)
    })

    it('should return true for any when either exists', () => {
      updateCompanyResearch(30000, createCompanyData())

      expect(hasResearch(30000, 'any')).toBe(true)
    })
  })

  describe('getResearchDirectory', () => {
    it('should return the research directory path', () => {
      const dir = getResearchDirectory()

      expect(dir).toContain('job-research')
      expect(existsSync(dir)).toBe(true)
    })
  })

  describe('Integration', () => {
    it('should handle full research workflow', () => {
      // 1. Check no research exists
      expect(hasResearch(30000)).toBe(false)

      // 2. Add company research
      updateCompanyResearch(30000, createCompanyData())
      expect(hasResearch(30000, 'company')).toBe(true)

      // 3. Add manager research
      updateManagerResearch(30000, createManagerData())
      expect(hasResearch(30000, 'manager')).toBe(true)

      // 4. Get full research
      const fullResearch = getJobResearch(30000)
      expect(fullResearch.company).toBeDefined()
      expect(fullResearch.manager).toBeDefined()

      // 5. Get highlights
      const highlights = getResearchHighlights(30000)
      expect(highlights.highlights.length).toBeGreaterThan(0)
    })
  })
})
