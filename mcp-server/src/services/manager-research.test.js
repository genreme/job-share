/**
 * Manager Research Service Tests
 */

import { describe, it, expect, afterEach } from 'vitest'
import { researchHiringManager, updateManagerResearch } from './manager-research.js'
import { existsSync, readFileSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESEARCH_DIR = join(__dirname, '..', '..', 'data', 'job-research')

// Helper to create valid manager research data
function createValidManagerData(overrides = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440002',
    jobId: 20000,
    managerName: 'Jane Smith',
    researchedAt: '2026-02-02T00:00:00Z',
    background: {
      currentRole: 'VP Engineering',
      company: 'TechCorp',
      yearsInRole: 3,
      previousRoles: ['Engineering Director at PrevCo', 'Senior Manager at OldCorp'],
      education: 'MS Computer Science, Stanford'
    },
    interviewStyle: {
      signals: ['Values technical depth', 'Asks behavioral questions', 'Prefers structured responses'],
      communicationPattern: 'Direct and efficient',
      commonQuestions: ['Tell me about a challenging project', 'How do you handle conflict?']
    },
    linkedIn: {
      url: 'https://linkedin.com/in/janesmith',
      activity: ['Posted about AI trends', 'Shared engineering blog', 'Commented on remote work'],
      connections: 5000
    },
    sharedInterests: ['AI/ML', 'Remote work', 'Engineering leadership'],
    mutualConnections: ['John Doe (Former colleague)', 'Alice Chen (Mutual contact)'],
    talkingPoints: [
      'Discuss her recent post on AI integration in engineering',
      'Mention shared interest in remote team management',
      'Ask about engineering culture at TechCorp'
    ],
    confidence: 'medium',
    sources: ['LinkedIn', 'Glassdoor reviews', 'Company blog'],
    ...overrides
  }
}

describe('Manager Research Service', () => {
  // Clean up test files after each test
  afterEach(() => {
    const testFiles = [
      join(RESEARCH_DIR, '20000-manager.json'),
      join(RESEARCH_DIR, '20000-manager.md'),
      join(RESEARCH_DIR, '20001-manager.json'),
      join(RESEARCH_DIR, '20001-manager.md'),
      join(RESEARCH_DIR, '20002-manager.json'),
      join(RESEARCH_DIR, '20002-manager.md')
    ]
    testFiles.forEach(file => {
      if (existsSync(file)) {
        rmSync(file)
      }
    })
  })

  describe('researchHiringManager', () => {
    it('should return template with status template_ready', () => {
      const result = researchHiringManager(20000, 'Jane Smith', 'TechCorp')

      expect(result.status).toBe('template_ready')
      expect(result.research).toBeDefined()
      expect(result.instructions).toBeDefined()
    })

    it('should include job ID, manager name in template', () => {
      const result = researchHiringManager(20001, 'John Doe', 'SomeCorp')

      expect(result.research.jobId).toBe(20001)
      expect(result.research.managerName).toBe('John Doe')
    })

    it('should generate unique ID', () => {
      const result1 = researchHiringManager(1, 'Manager1', 'Corp1')
      const result2 = researchHiringManager(2, 'Manager2', 'Corp2')

      expect(result1.research.id).toBeDefined()
      expect(result2.research.id).toBeDefined()
      expect(result1.research.id).not.toBe(result2.research.id)
    })

    it('should include timestamp', () => {
      const result = researchHiringManager(20000, 'Jane Smith', 'TechCorp')

      expect(result.research.researchedAt).toBeDefined()
      expect(new Date(result.research.researchedAt)).toBeInstanceOf(Date)
    })

    it('should prioritize style and connection in instructions', () => {
      const result = researchHiringManager(20000, 'Jane Smith', 'TechCorp')

      // Primary items should appear first
      expect(result.instructions).toContain('**Primary (Style & Connection):**')
      expect(result.instructions).toContain('**Secondary (Background):**')

      // Check order - Primary should come before Secondary
      const primaryIndex = result.instructions.indexOf('Primary')
      const secondaryIndex = result.instructions.indexOf('Secondary')
      expect(primaryIndex).toBeLessThan(secondaryIndex)
    })

    it('should mention key research areas', () => {
      const result = researchHiringManager(20000, 'Jane Smith', 'TechCorp')

      expect(result.instructions).toContain('Interview Style')
      expect(result.instructions).toContain('Communication Style')
      expect(result.instructions).toContain('LinkedIn Activity')
      expect(result.instructions).toContain('Shared Interests')
      expect(result.instructions).toContain('Mutual Connections')
      expect(result.instructions).toContain('Talking Points')
    })

    it('should initialize with default empty arrays', () => {
      const result = researchHiringManager(20000, 'Jane Smith', 'TechCorp')

      expect(result.research.interviewStyle.signals).toEqual([])
      expect(result.research.interviewStyle.commonQuestions).toEqual([])
      expect(result.research.linkedIn.activity).toEqual([])
      expect(result.research.sharedInterests).toEqual([])
      expect(result.research.mutualConnections).toEqual([])
      expect(result.research.talkingPoints).toEqual([])
    })

    it('should start with low confidence', () => {
      const result = researchHiringManager(20000, 'Jane Smith', 'TechCorp')
      expect(result.research.confidence).toBe('low')
    })
  })

  describe('updateManagerResearch', () => {
    it('should save valid research to JSON file', () => {
      const data = createValidManagerData()
      const result = updateManagerResearch(20000, data)

      expect(result.success).toBe(true)
      expect(result.saved).toBeDefined()
      expect(existsSync(result.saved.json)).toBe(true)
    })

    it('should save markdown file', () => {
      const data = createValidManagerData()
      const result = updateManagerResearch(20000, data)

      expect(result.saved.markdown).toBeDefined()
      expect(existsSync(result.saved.markdown)).toBe(true)
    })

    it('should persist data that can be read back', () => {
      const data = createValidManagerData()
      updateManagerResearch(20000, data)

      const savedData = JSON.parse(readFileSync(join(RESEARCH_DIR, '20000-manager.json'), 'utf-8'))
      expect(savedData.managerName).toBe('Jane Smith')
      expect(savedData.background.currentRole).toBe('VP Engineering')
    })

    it('should generate markdown with talking points first', () => {
      const data = createValidManagerData()
      updateManagerResearch(20000, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '20000-manager.md'), 'utf-8')

      // Talking points should be the first content section
      const talkingPointsIndex = markdown.indexOf('## Talking Points')
      const interviewStyleIndex = markdown.indexOf('## Interview Style')
      const backgroundIndex = markdown.indexOf('## Background')

      expect(talkingPointsIndex).toBeGreaterThan(0)
      expect(talkingPointsIndex).toBeLessThan(interviewStyleIndex)
      expect(interviewStyleIndex).toBeLessThan(backgroundIndex)
    })

    it('should include all major sections in markdown', () => {
      const data = createValidManagerData()
      updateManagerResearch(20000, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '20000-manager.md'), 'utf-8')

      expect(markdown).toContain('# Jane Smith - Hiring Manager Research')
      expect(markdown).toContain('## Talking Points')
      expect(markdown).toContain('## Interview Style')
      expect(markdown).toContain('## Shared Interests')
      expect(markdown).toContain('## Mutual Connections')
      expect(markdown).toContain('## LinkedIn Presence')
      expect(markdown).toContain('## Background')
    })

    it('should reject invalid research data', () => {
      const invalidData = {
        // Missing required fields
        managerName: 'Jane Smith'
      }

      const result = updateManagerResearch(20000, invalidData)

      expect(result.error).toBe('Invalid research format')
      expect(result.details).toBeDefined()
      expect(result.details.length).toBeGreaterThan(0)
    })

    it('should reject invalid confidence level', () => {
      const data = createValidManagerData({ confidence: 'invalid' })
      const result = updateManagerResearch(20000, data)

      expect(result.error).toBe('Invalid research format')
    })

    it('should accept minimal valid data', () => {
      const minimalData = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        jobId: 20000,
        managerName: 'Minimal Manager',
        researchedAt: '2026-02-02T00:00:00Z',
        confidence: 'low'
      }

      const result = updateManagerResearch(20000, minimalData)
      expect(result.success).toBe(true)
    })

    it('should override jobId from parameter', () => {
      const data = createValidManagerData({ jobId: 999 })
      updateManagerResearch(20001, data)

      const savedData = JSON.parse(readFileSync(join(RESEARCH_DIR, '20001-manager.json'), 'utf-8'))
      expect(savedData.jobId).toBe(20001)
    })
  })

  describe('Markdown Generation', () => {
    it('should number talking points', () => {
      const data = createValidManagerData()
      updateManagerResearch(20000, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '20000-manager.md'), 'utf-8')
      expect(markdown).toContain('1. Discuss her recent post')
      expect(markdown).toContain('2. Mention shared interest')
    })

    it('should format interview style signals as bullets', () => {
      const data = createValidManagerData()
      updateManagerResearch(20000, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '20000-manager.md'), 'utf-8')
      expect(markdown).toContain('- Values technical depth')
    })

    it('should include LinkedIn URL and connections', () => {
      const data = createValidManagerData()
      updateManagerResearch(20000, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '20000-manager.md'), 'utf-8')
      expect(markdown).toContain('**Profile:** https://linkedin.com/in/janesmith')
      expect(markdown).toContain('**Connections:** 5,000')
    })

    it('should handle empty optional fields gracefully', () => {
      const minimalData = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        jobId: 999,
        managerName: 'Unknown Manager',
        researchedAt: '2026-02-02T00:00:00Z',
        confidence: 'low'
      }

      updateManagerResearch(20002, minimalData)

      const markdown = readFileSync(join(RESEARCH_DIR, '20002-manager.md'), 'utf-8')
      expect(markdown).toContain('*None identified yet*') // For empty talking points
      expect(markdown).toContain('*None found*') // For empty mutual connections
      expect(markdown).toContain('*No style signals found*') // For empty interview style
    })

    it('should show previous roles in background section', () => {
      const data = createValidManagerData()
      updateManagerResearch(20000, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '20000-manager.md'), 'utf-8')
      expect(markdown).toContain('**Previous Roles:**')
      expect(markdown).toContain('- Engineering Director at PrevCo')
    })

    it('should list shared interests as comma-separated', () => {
      const data = createValidManagerData()
      updateManagerResearch(20000, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '20000-manager.md'), 'utf-8')
      expect(markdown).toContain('AI/ML, Remote work, Engineering leadership')
    })
  })
})
