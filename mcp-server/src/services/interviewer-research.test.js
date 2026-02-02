/**
 * Interviewer Research Service Tests
 *
 * Tests for the interviewer research service following manager-research.js pattern.
 * Uses unique job ID range 9000-9099 for test isolation.
 */

import { describe, it, expect, afterEach } from 'vitest'
import {
  startInterviewerResearch,
  saveInterviewerResearch,
  getInterviewerResearch,
  listInterviewerResearchForJob,
  sanitizeName
} from './interviewer-research.js'
import { existsSync, readFileSync, rmSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESEARCH_DIR = join(__dirname, '..', '..', 'data', 'job-research')

// Helper to create valid interviewer research data
function createValidInterviewerData(overrides = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440100',
    jobId: 9000,
    interviewerName: 'Jane Smith',
    interviewerTitle: 'Engineering Manager',
    interviewRound: 'onsite',
    researchedAt: '2026-02-02T00:00:00Z',
    background: {
      currentRole: 'Engineering Manager',
      company: 'TechCorp',
      yearsInRole: 3,
      previousRoles: ['Senior Engineer at PrevCo', 'Tech Lead at OldCorp'],
      linkedInUrl: 'https://linkedin.com/in/janesmith'
    },
    interviewStyle: {
      signals: ['Values technical depth', 'Asks behavioral questions', 'Prefers structured responses'],
      expectedQuestionTypes: ['behavioral', 'technical', 'system-design'],
      communicationPattern: 'Direct and efficient',
      depthExpectation: 'deep'
    },
    talkingPoints: [
      'Discuss her recent post on distributed systems',
      'Mention shared interest in engineering leadership',
      'Ask about TechCorp engineering culture'
    ],
    sharedInterests: ['Distributed systems', 'Engineering leadership', 'Mentoring'],
    confidence: 'medium',
    sources: ['LinkedIn', 'Glassdoor reviews', 'Company blog'],
    ...overrides
  }
}

describe('Interviewer Research Service', () => {
  // Clean up test files after each test
  afterEach(() => {
    // Clean up all files in the 9000-9099 job ID range
    try {
      const files = readdirSync(RESEARCH_DIR)
      files.forEach(file => {
        const match = file.match(/^(90\d{2})-interviewer-/)
        if (match) {
          const filePath = join(RESEARCH_DIR, file)
          if (existsSync(filePath)) {
            rmSync(filePath)
          }
        }
      })
    } catch (err) {
      // Directory might not exist, that's ok
    }
  })

  describe('startInterviewerResearch', () => {
    it('returns template with status template_ready', () => {
      const result = startInterviewerResearch(9000, 'Jane Smith', 'Engineering Manager', 'onsite')

      expect(result.status).toBe('template_ready')
      expect(result.research).toBeDefined()
      expect(result.instructions).toBeDefined()
    })

    it('includes job ID and interviewer name in template', () => {
      const result = startInterviewerResearch(9001, 'John Doe', 'VP Engineering')

      expect(result.research.jobId).toBe(9001)
      expect(result.research.interviewerName).toBe('John Doe')
    })

    it('includes interviewer title when provided', () => {
      const result = startInterviewerResearch(9000, 'Jane Smith', 'Engineering Manager', 'onsite')

      expect(result.research.interviewerTitle).toBe('Engineering Manager')
    })

    it('includes interview round when provided', () => {
      const result = startInterviewerResearch(9000, 'Jane Smith', 'Engineering Manager', 'final')

      expect(result.research.interviewRound).toBe('final')
    })

    it('handles missing optional parameters', () => {
      const result = startInterviewerResearch(9000, 'Jane Smith')

      expect(result.research.interviewerTitle).toBeUndefined()
      expect(result.research.interviewRound).toBeUndefined()
    })

    it('generates unique ID for each call', () => {
      const result1 = startInterviewerResearch(9000, 'Jane Smith')
      const result2 = startInterviewerResearch(9001, 'John Doe')

      expect(result1.research.id).toBeDefined()
      expect(result2.research.id).toBeDefined()
      expect(result1.research.id).not.toBe(result2.research.id)
    })

    it('includes timestamp', () => {
      const result = startInterviewerResearch(9000, 'Jane Smith')

      expect(result.research.researchedAt).toBeDefined()
      expect(new Date(result.research.researchedAt)).toBeInstanceOf(Date)
    })

    it('starts with low confidence', () => {
      const result = startInterviewerResearch(9000, 'Jane Smith')
      expect(result.research.confidence).toBe('low')
    })

    it('initializes with default empty arrays', () => {
      const result = startInterviewerResearch(9000, 'Jane Smith')

      expect(result.research.background.previousRoles).toEqual([])
      expect(result.research.interviewStyle.signals).toEqual([])
      expect(result.research.interviewStyle.expectedQuestionTypes).toEqual([])
      expect(result.research.talkingPoints).toEqual([])
      expect(result.research.sharedInterests).toEqual([])
      expect(result.research.sources).toEqual([])
    })

    it('mentions style signals in instructions', () => {
      const result = startInterviewerResearch(9000, 'Jane Smith')

      expect(result.instructions).toContain('Interview Style Signals')
      expect(result.instructions).toContain('Talking Points')
    })

    it('includes interviewer context in instructions', () => {
      const result = startInterviewerResearch(9000, 'Jane Smith', 'Engineering Manager', 'onsite')

      expect(result.instructions).toContain('Jane Smith')
      expect(result.instructions).toContain('Engineering Manager')
      expect(result.instructions).toContain('onsite')
    })

    it('mentions all research sources to check', () => {
      const result = startInterviewerResearch(9000, 'Jane Smith')

      expect(result.instructions).toContain('LinkedIn')
      expect(result.instructions).toContain('Glassdoor')
      expect(result.instructions).toContain('Conference talks')
      expect(result.instructions).toContain('Blog posts')
    })
  })

  describe('saveInterviewerResearch', () => {
    it('saves valid research to JSON file', () => {
      const data = createValidInterviewerData()
      const result = saveInterviewerResearch(9000, data)

      expect(result.success).toBe(true)
      expect(result.saved).toBeDefined()
      expect(existsSync(result.saved.json)).toBe(true)
    })

    it('saves markdown file', () => {
      const data = createValidInterviewerData()
      const result = saveInterviewerResearch(9000, data)

      expect(result.saved.markdown).toBeDefined()
      expect(existsSync(result.saved.markdown)).toBe(true)
    })

    it('persists data that can be read back', () => {
      const data = createValidInterviewerData()
      saveInterviewerResearch(9000, data)

      const savedData = JSON.parse(readFileSync(join(RESEARCH_DIR, '9000-interviewer-jane-smith.json'), 'utf-8'))
      expect(savedData.interviewerName).toBe('Jane Smith')
      expect(savedData.background.currentRole).toBe('Engineering Manager')
    })

    it('generates markdown with talking points first', () => {
      const data = createValidInterviewerData()
      saveInterviewerResearch(9000, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '9000-interviewer-jane-smith.md'), 'utf-8')

      // Talking points should be the first content section
      const talkingPointsIndex = markdown.indexOf('## Talking Points')
      const interviewStyleIndex = markdown.indexOf('## Interview Style')
      const backgroundIndex = markdown.indexOf('## Background')

      expect(talkingPointsIndex).toBeGreaterThan(0)
      expect(talkingPointsIndex).toBeLessThan(interviewStyleIndex)
      expect(interviewStyleIndex).toBeLessThan(backgroundIndex)
    })

    it('includes all major sections in markdown', () => {
      const data = createValidInterviewerData()
      saveInterviewerResearch(9000, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '9000-interviewer-jane-smith.md'), 'utf-8')

      expect(markdown).toContain('# Jane Smith - Engineering Manager')
      expect(markdown).toContain('## Talking Points')
      expect(markdown).toContain('## Interview Style')
      expect(markdown).toContain('## Shared Interests')
      expect(markdown).toContain('## LinkedIn Presence')
      expect(markdown).toContain('## Background')
    })

    it('rejects invalid research data', () => {
      const invalidData = {
        // Missing required fields
        interviewerName: 'Jane Smith'
      }

      const result = saveInterviewerResearch(9000, invalidData)

      expect(result.error).toBe('Invalid research format')
      expect(result.details).toBeDefined()
      expect(result.details.length).toBeGreaterThan(0)
    })

    it('rejects invalid confidence level', () => {
      const data = createValidInterviewerData({ confidence: 'invalid' })
      const result = saveInterviewerResearch(9000, data)

      expect(result.error).toBe('Invalid research format')
    })

    it('accepts minimal valid data', () => {
      const minimalData = {
        id: '550e8400-e29b-41d4-a716-446655440100',
        jobId: 9000,
        interviewerName: 'Minimal Person',
        researchedAt: '2026-02-02T00:00:00Z',
        confidence: 'low'
      }

      const result = saveInterviewerResearch(9000, minimalData)
      expect(result.success).toBe(true)
    })

    it('overrides jobId from parameter', () => {
      const data = createValidInterviewerData({ jobId: 999 })
      saveInterviewerResearch(9001, data)

      const savedData = JSON.parse(readFileSync(join(RESEARCH_DIR, '9001-interviewer-jane-smith.json'), 'utf-8'))
      expect(savedData.jobId).toBe(9001)
    })
  })

  describe('getInterviewerResearch', () => {
    it('returns null for non-existent interviewer', () => {
      const result = getInterviewerResearch(9050, 'Nobody')
      expect(result).toBeNull()
    })

    it('returns saved research data', () => {
      const data = createValidInterviewerData()
      saveInterviewerResearch(9000, data)

      const result = getInterviewerResearch(9000, 'Jane Smith')
      expect(result).not.toBeNull()
      expect(result.interviewerName).toBe('Jane Smith')
      expect(result.confidence).toBe('medium')
    })

    it('retrieves research with all fields preserved', () => {
      const data = createValidInterviewerData()
      saveInterviewerResearch(9000, data)

      const result = getInterviewerResearch(9000, 'Jane Smith')
      expect(result.talkingPoints).toHaveLength(3)
      expect(result.interviewStyle.signals).toHaveLength(3)
      expect(result.background.previousRoles).toHaveLength(2)
    })

    it('handles name case insensitively for lookup', () => {
      const data = createValidInterviewerData()
      saveInterviewerResearch(9000, data)

      // The sanitizeName function lowercases, so both should work
      const result1 = getInterviewerResearch(9000, 'Jane Smith')
      const result2 = getInterviewerResearch(9000, 'jane smith')

      expect(result1).not.toBeNull()
      expect(result2).not.toBeNull()
    })
  })

  describe('listInterviewerResearchForJob', () => {
    it('returns empty array when no research exists', () => {
      const result = listInterviewerResearchForJob(9060)
      expect(result).toEqual([])
    })

    it('returns all interviewers for a job', () => {
      // Save multiple interviewers for the same job
      const interviewer1 = createValidInterviewerData({ interviewerName: 'Alice Wong', id: '550e8400-e29b-41d4-a716-446655440101' })
      const interviewer2 = createValidInterviewerData({ interviewerName: 'Bob Chen', id: '550e8400-e29b-41d4-a716-446655440102' })

      saveInterviewerResearch(9002, interviewer1)
      saveInterviewerResearch(9002, interviewer2)

      const result = listInterviewerResearchForJob(9002)
      expect(result).toHaveLength(2)
      expect(result.map(r => r.name)).toContain('Alice Wong')
      expect(result.map(r => r.name)).toContain('Bob Chen')
    })

    it('returns summary with name, researchedAt, and confidence', () => {
      const data = createValidInterviewerData()
      saveInterviewerResearch(9003, data)

      const result = listInterviewerResearchForJob(9003)
      expect(result[0]).toHaveProperty('name', 'Jane Smith')
      expect(result[0]).toHaveProperty('researchedAt', '2026-02-02T00:00:00Z')
      expect(result[0]).toHaveProperty('confidence', 'medium')
    })

    it('does not return interviewers from other jobs', () => {
      const data1 = createValidInterviewerData({ interviewerName: 'Job1 Person', id: '550e8400-e29b-41d4-a716-446655440103' })
      const data2 = createValidInterviewerData({ interviewerName: 'Job2 Person', id: '550e8400-e29b-41d4-a716-446655440104' })

      saveInterviewerResearch(9004, data1)
      saveInterviewerResearch(9005, data2)

      const result = listInterviewerResearchForJob(9004)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Job1 Person')
    })
  })

  describe('sanitizeName', () => {
    it('converts to lowercase', () => {
      expect(sanitizeName('Jane Smith')).toBe('jane-smith')
    })

    it('replaces spaces with dashes', () => {
      expect(sanitizeName('John A Doe')).toBe('john-a-doe')
    })

    it('removes special characters', () => {
      expect(sanitizeName("Jane O'Connor")).toBe('jane-oconnor')
      expect(sanitizeName('John@Doe.com')).toBe('johndoecom')
    })

    it('handles multiple spaces by collapsing to single dash', () => {
      // Multiple consecutive spaces collapse to a single dash
      expect(sanitizeName('Jane   Smith')).toBe('jane-smith')
    })

    it('handles already lowercase names', () => {
      expect(sanitizeName('jane')).toBe('jane')
    })

    it('removes non-alphanumeric characters', () => {
      expect(sanitizeName('Dr. Jane Smith, PhD')).toBe('dr-jane-smith-phd')
    })
  })

  describe('Markdown Generation', () => {
    it('numbers talking points', () => {
      const data = createValidInterviewerData()
      saveInterviewerResearch(9010, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '9010-interviewer-jane-smith.md'), 'utf-8')
      expect(markdown).toContain('1. Discuss her recent post')
      expect(markdown).toContain('2. Mention shared interest')
    })

    it('formats interview style signals as bullets', () => {
      const data = createValidInterviewerData()
      saveInterviewerResearch(9011, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '9011-interviewer-jane-smith.md'), 'utf-8')
      expect(markdown).toContain('- Values technical depth')
    })

    it('includes expected question types', () => {
      const data = createValidInterviewerData()
      saveInterviewerResearch(9012, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '9012-interviewer-jane-smith.md'), 'utf-8')
      expect(markdown).toContain('behavioral, technical, system-design')
    })

    it('includes depth expectation', () => {
      const data = createValidInterviewerData()
      saveInterviewerResearch(9013, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '9013-interviewer-jane-smith.md'), 'utf-8')
      expect(markdown).toContain('**Depth Expectation:** deep')
    })

    it('includes LinkedIn URL', () => {
      const data = createValidInterviewerData()
      saveInterviewerResearch(9014, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '9014-interviewer-jane-smith.md'), 'utf-8')
      expect(markdown).toContain('https://linkedin.com/in/janesmith')
    })

    it('handles empty optional fields gracefully', () => {
      const minimalData = {
        id: '550e8400-e29b-41d4-a716-446655440110',
        jobId: 9015,
        interviewerName: 'Unknown Person',
        researchedAt: '2026-02-02T00:00:00Z',
        confidence: 'low'
      }

      saveInterviewerResearch(9015, minimalData)

      const markdown = readFileSync(join(RESEARCH_DIR, '9015-interviewer-unknown-person.md'), 'utf-8')
      expect(markdown).toContain('*None identified yet*') // For empty talking points
      expect(markdown).toContain('*None identified*') // For empty shared interests
      expect(markdown).toContain('*No style signals found*') // For empty interview style
    })

    it('shows previous roles in background section', () => {
      const data = createValidInterviewerData()
      saveInterviewerResearch(9016, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '9016-interviewer-jane-smith.md'), 'utf-8')
      expect(markdown).toContain('**Previous Roles:**')
      expect(markdown).toContain('- Senior Engineer at PrevCo')
    })

    it('lists shared interests as bullets', () => {
      const data = createValidInterviewerData()
      saveInterviewerResearch(9017, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '9017-interviewer-jane-smith.md'), 'utf-8')
      expect(markdown).toContain('- Distributed systems')
      expect(markdown).toContain('- Engineering leadership')
    })

    it('includes interview round when provided', () => {
      const data = createValidInterviewerData({ interviewRound: 'final' })
      saveInterviewerResearch(9018, data)

      const markdown = readFileSync(join(RESEARCH_DIR, '9018-interviewer-jane-smith.md'), 'utf-8')
      expect(markdown).toContain('**Interview Round:** final')
    })
  })

  describe('Multiple interviewers per job', () => {
    it('stores multiple interviewers independently', () => {
      const interviewer1 = createValidInterviewerData({
        interviewerName: 'Alice Wong',
        id: '550e8400-e29b-41d4-a716-446655440111',
        confidence: 'high'
      })
      const interviewer2 = createValidInterviewerData({
        interviewerName: 'Bob Chen',
        id: '550e8400-e29b-41d4-a716-446655440112',
        confidence: 'low'
      })

      saveInterviewerResearch(9020, interviewer1)
      saveInterviewerResearch(9020, interviewer2)

      const alice = getInterviewerResearch(9020, 'Alice Wong')
      const bob = getInterviewerResearch(9020, 'Bob Chen')

      expect(alice).not.toBeNull()
      expect(bob).not.toBeNull()
      expect(alice.confidence).toBe('high')
      expect(bob.confidence).toBe('low')
    })

    it('creates separate files for each interviewer', () => {
      const interviewer1 = createValidInterviewerData({
        interviewerName: 'Alice Wong',
        id: '550e8400-e29b-41d4-a716-446655440113'
      })
      const interviewer2 = createValidInterviewerData({
        interviewerName: 'Bob Chen',
        id: '550e8400-e29b-41d4-a716-446655440114'
      })

      saveInterviewerResearch(9021, interviewer1)
      saveInterviewerResearch(9021, interviewer2)

      expect(existsSync(join(RESEARCH_DIR, '9021-interviewer-alice-wong.json'))).toBe(true)
      expect(existsSync(join(RESEARCH_DIR, '9021-interviewer-bob-chen.json'))).toBe(true)
      expect(existsSync(join(RESEARCH_DIR, '9021-interviewer-alice-wong.md'))).toBe(true)
      expect(existsSync(join(RESEARCH_DIR, '9021-interviewer-bob-chen.md'))).toBe(true)
    })
  })
})
