/**
 * Company Research Service Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { researchCompany, updateCompanyResearch, checkForExistingCompanyResearch } from './company-research.js'
import { existsSync, readFileSync, rmSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESEARCH_DIR = join(__dirname, '..', '..', 'data', 'job-research')

// Helper to create valid research data
function createValidResearchData(overrides = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    jobId: 123,
    companyName: 'TechCorp',
    researchedAt: '2026-02-02T00:00:00Z',
    firmographics: {
      size: '50-200 employees',
      industry: 'SaaS',
      founded: '2015',
      headquarters: 'San Francisco, CA',
      website: 'https://techcorp.example.com'
    },
    funding: {
      stage: 'Series B',
      totalRaised: '$50M',
      lastRound: '$20M Series B, Jan 2026',
      investors: ['Sequoia', 'a16z'],
      signals: ['Growing headcount', 'Expanding internationally']
    },
    culture: {
      values: ['Innovation', 'Transparency', 'Customer-first'],
      glassdoorThemes: ['Great work-life balance', 'Supportive management'],
      leadershipQuotes: [
        { quote: 'We build products that matter', speaker: 'CEO Jane Smith', source: 'TechCrunch interview' }
      ],
      workStyle: 'Remote-first'
    },
    news: [
      { headline: 'TechCorp raises $20M Series B', date: '2026-01', source: 'TechCrunch', relevance: 'high' },
      { headline: 'New product launch planned', relevance: 'medium' }
    ],
    challenges: ['Scaling engineering team', 'Enterprise market competition'],
    competitors: ['RivalCo', 'CompetitorInc'],
    products: [
      { name: 'MainProduct', description: 'Core SaaS platform' },
      { name: 'SecondaryTool' }
    ],
    confidence: 'high',
    sources: ['Crunchbase', 'Glassdoor', 'Company website', 'TechCrunch'],
    highlights: [
      'Recently raised $20M Series B from top-tier investors',
      'Remote-first culture with strong work-life balance',
      'Growing headcount - actively hiring'
    ],
    ...overrides
  }
}

describe('Company Research Service', () => {
  // Clean up test files after each test
  afterEach(() => {
    const testFiles = [
      join(RESEARCH_DIR, '123-company.json'),
      join(RESEARCH_DIR, '123-company.md'),
      join(RESEARCH_DIR, '456-company.json'),
      join(RESEARCH_DIR, '456-company.md'),
      join(RESEARCH_DIR, '999-company.json'),
      join(RESEARCH_DIR, '999-company.md')
    ]
    testFiles.forEach(file => {
      if (existsSync(file)) {
        rmSync(file)
      }
    })
  })

  describe('researchCompany', () => {
    it('should return template with status template_ready', () => {
      const result = researchCompany(123, 'TechCorp')

      expect(result.status).toBe('template_ready')
      expect(result.research).toBeDefined()
      expect(result.instructions).toBeDefined()
    })

    it('should include job ID and company name in template', () => {
      const result = researchCompany(456, 'AnotherCorp')

      expect(result.research.jobId).toBe(456)
      expect(result.research.companyName).toBe('AnotherCorp')
    })

    it('should generate unique ID', () => {
      const result1 = researchCompany(1, 'Corp1')
      const result2 = researchCompany(2, 'Corp2')

      expect(result1.research.id).toBeDefined()
      expect(result2.research.id).toBeDefined()
      expect(result1.research.id).not.toBe(result2.research.id)
    })

    it('should include timestamp', () => {
      const result = researchCompany(123, 'TechCorp')

      expect(result.research.researchedAt).toBeDefined()
      expect(new Date(result.research.researchedAt)).toBeInstanceOf(Date)
    })

    it('should provide instructions for all research areas', () => {
      const result = researchCompany(123, 'TechCorp')

      expect(result.instructions).toContain('Firmographics')
      expect(result.instructions).toContain('Funding')
      expect(result.instructions).toContain('Culture')
      expect(result.instructions).toContain('News')
      expect(result.instructions).toContain('Challenges')
      expect(result.instructions).toContain('Competitors')
      expect(result.instructions).toContain('Products')
    })

    it('should initialize with default arrays', () => {
      const result = researchCompany(123, 'TechCorp')

      expect(result.research.funding.investors).toEqual([])
      expect(result.research.funding.signals).toEqual([])
      expect(result.research.culture.values).toEqual([])
      expect(result.research.news).toEqual([])
      expect(result.research.challenges).toEqual([])
      expect(result.research.competitors).toEqual([])
    })
  })

  describe('updateCompanyResearch', () => {
    it('should save valid research to JSON file', () => {
      const data = createValidResearchData()
      const result = updateCompanyResearch(123, data)

      expect(result.success).toBe(true)
      expect(result.saved).toBeDefined()
      expect(existsSync(result.saved.json)).toBe(true)
    })

    it('should save markdown file', () => {
      const data = createValidResearchData()
      const result = updateCompanyResearch(123, data)

      expect(result.saved.markdown).toBeDefined()
      expect(existsSync(result.saved.markdown)).toBe(true)
    })

    it('should return highlights from saved data', () => {
      const data = createValidResearchData()
      const result = updateCompanyResearch(123, data)

      expect(result.highlights).toEqual(data.highlights)
    })

    it('should persist data that can be read back', () => {
      const data = createValidResearchData()
      updateCompanyResearch(123, data)

      const savedData = JSON.parse(readFileSync(join(RESEARCH_DIR, '123-company.json'), 'utf-8'))
      expect(savedData.companyName).toBe('TechCorp')
      expect(savedData.funding.stage).toBe('Series B')
    })

    it('should generate markdown with all sections', () => {
      const data = createValidResearchData()
      updateCompanyResearch(123, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '123-company.md'), 'utf-8')
      expect(markdown).toContain('# TechCorp - Company Research')
      expect(markdown).toContain('## Quick Highlights')
      expect(markdown).toContain('## Firmographics')
      expect(markdown).toContain('## Funding')
      expect(markdown).toContain('## Culture')
      expect(markdown).toContain('## Recent News')
      expect(markdown).toContain('## Challenges')
      expect(markdown).toContain('## Competitors')
      expect(markdown).toContain('## Sources')
    })

    it('should reject invalid research data', () => {
      const invalidData = {
        // Missing required fields
        companyName: 'TechCorp'
      }

      const result = updateCompanyResearch(123, invalidData)

      expect(result.error).toBe('Invalid research format')
      expect(result.details).toBeDefined()
      expect(result.details.length).toBeGreaterThan(0)
    })

    it('should reject invalid confidence level', () => {
      const data = createValidResearchData({ confidence: 'invalid' })
      const result = updateCompanyResearch(123, data)

      expect(result.error).toBe('Invalid research format')
    })

    it('should accept minimal valid data', () => {
      const minimalData = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        jobId: 123,
        companyName: 'MinimalCorp',
        researchedAt: '2026-02-02T00:00:00Z',
        confidence: 'low'
      }

      const result = updateCompanyResearch(123, minimalData)
      expect(result.success).toBe(true)
    })

    it('should override jobId from parameter', () => {
      const data = createValidResearchData({ jobId: 999 })
      updateCompanyResearch(456, data)

      const savedData = JSON.parse(readFileSync(join(RESEARCH_DIR, '456-company.json'), 'utf-8'))
      expect(savedData.jobId).toBe(456)
    })
  })

  describe('checkForExistingCompanyResearch', () => {
    it('should return found: false when no research exists', () => {
      const result = checkForExistingCompanyResearch('NonexistentCorp')
      expect(result.found).toBe(false)
    })

    it('should find existing research by company name (case-insensitive)', () => {
      const data = createValidResearchData()
      updateCompanyResearch(123, data)

      const result = checkForExistingCompanyResearch('techcorp')
      expect(result.found).toBe(true)
      expect(result.companyName).toBe('TechCorp')
    })

    it('should return job ID of existing research', () => {
      const data = createValidResearchData()
      updateCompanyResearch(123, data)

      const result = checkForExistingCompanyResearch('TechCorp')
      expect(result.existingJobId).toBe(123)
    })

    it('should return research date and days since', () => {
      const data = createValidResearchData({ researchedAt: new Date().toISOString() })
      updateCompanyResearch(123, data)

      const result = checkForExistingCompanyResearch('TechCorp')
      expect(result.researchedAt).toBeDefined()
      expect(result.daysSinceResearch).toBe(0)
    })

    it('should return highlights from existing research', () => {
      const data = createValidResearchData()
      updateCompanyResearch(123, data)

      const result = checkForExistingCompanyResearch('TechCorp')
      expect(result.highlights).toEqual(data.highlights)
    })

    it('should suggest reuse for recent research (<30 days)', () => {
      const data = createValidResearchData({ researchedAt: new Date().toISOString() })
      updateCompanyResearch(123, data)

      const result = checkForExistingCompanyResearch('TechCorp')
      expect(result.suggestion).toBe('Recent research available. Reuse?')
    })

    it('should suggest refresh for older research (>=30 days)', () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 35)
      const data = createValidResearchData({ researchedAt: oldDate.toISOString() })
      updateCompanyResearch(123, data)

      const result = checkForExistingCompanyResearch('TechCorp')
      expect(result.suggestion).toBe('Older research available. Refresh recommended.')
    })

    it('should handle multiple companies, find correct one', () => {
      const data1 = createValidResearchData({ companyName: 'FirstCorp' })
      const data2 = createValidResearchData({ companyName: 'SecondCorp', id: '550e8400-e29b-41d4-a716-446655440001' })

      updateCompanyResearch(123, data1)
      updateCompanyResearch(456, data2)

      const result = checkForExistingCompanyResearch('SecondCorp')
      expect(result.found).toBe(true)
      expect(result.existingJobId).toBe(456)
    })
  })

  describe('Markdown Generation', () => {
    it('should format leadership quotes correctly', () => {
      const data = createValidResearchData()
      updateCompanyResearch(123, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '123-company.md'), 'utf-8')
      expect(markdown).toContain('> "We build products that matter" - CEO Jane Smith')
    })

    it('should handle news with different relevance levels', () => {
      const data = createValidResearchData()
      updateCompanyResearch(123, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '123-company.md'), 'utf-8')
      expect(markdown).toContain('[high]')
    })

    it('should handle empty optional fields gracefully', () => {
      const minimalData = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        jobId: 999,
        companyName: 'MinimalCorp',
        researchedAt: '2026-02-02T00:00:00Z',
        confidence: 'low'
      }

      updateCompanyResearch(999, minimalData)

      const markdown = readFileSync(join(RESEARCH_DIR, '999-company.md'), 'utf-8')
      expect(markdown).toContain('Unknown') // Should show Unknown for missing fields
      expect(markdown).toContain('None identified') // For empty challenges/competitors
    })

    it('should include products with descriptions', () => {
      const data = createValidResearchData()
      updateCompanyResearch(123, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '123-company.md'), 'utf-8')
      expect(markdown).toContain('**MainProduct:** Core SaaS platform')
    })
  })
})
