/**
 * Fit Scorer Service Tests
 *
 * Tests profile-based fit scoring with fallback to defaults.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { calculateFitScore, calculateDefaultFitScore, parseSalaryFromText } from './fit-scorer.js'

// Mock the profile loader
vi.mock('../data/profile-loader.js', () => ({
  loadProfile: vi.fn()
}))

import { loadProfile } from '../data/profile-loader.js'

/**
 * Create a mock profile for testing
 */
function createMockProfile(overrides = {}) {
  const now = new Date().toISOString()

  return {
    metadata: {
      version: 1,
      createdAt: now,
      updatedAt: now,
      schemaVersion: '1.0'
    },
    experience: [],
    skills: overrides.skills || [
      { id: 'skill-1', name: 'JavaScript', category: 'languages', proficiency: 'expert' },
      { id: 'skill-2', name: 'React', category: 'frameworks', proficiency: 'proficient' },
      { id: 'skill-3', name: 'Node.js', category: 'frameworks', proficiency: 'proficient' },
      { id: 'skill-4', name: 'TypeScript', category: 'languages', proficiency: 'proficient' },
      { id: 'skill-5', name: 'Design Systems', category: 'methodologies', proficiency: 'expert' },
      { id: 'skill-6', name: 'Figma', category: 'tools', proficiency: 'proficient' }
    ],
    summaryBlocks: [],
    stories: [],
    preferences: {
      targetRoles: overrides.targetRoles || [
        {
          id: 'role-1',
          titles: {
            exact: ['Creative Director', 'Design Director'],
            partial: ['Creative', 'Design Lead']
          },
          industries: {
            preferred: ['healthcare', 'nonprofit'],
            acceptable: ['technology', 'startup']
          },
          locations: {
            preferred: ['Boston', 'Remote'],
            acceptable: ['New York', 'Northeast']
          },
          salary: {
            minimum: 120000,
            target: 150000,
            currency: 'USD'
          }
        }
      ],
      communication: null
    },
    history: []
  }
}

/**
 * Create a mock job for testing
 */
function createMockJob(overrides = {}) {
  return {
    id: 1,
    title: overrides.title || 'Software Engineer',
    company: overrides.company || 'Tech Corp',
    industry: overrides.industry || 'Technology',
    location: overrides.location || 'San Francisco',
    salary: overrides.salary || '$100,000',
    description: overrides.description || 'Looking for a skilled engineer',
    status: 'inbox',
    fitScore: 0,
    ...overrides
  }
}

describe('parseSalaryFromText', () => {
  describe('valid salary strings', () => {
    it('parses "$120,000" correctly', () => {
      expect(parseSalaryFromText('$120,000')).toBe(120000)
    })

    it('parses "$120K" correctly', () => {
      expect(parseSalaryFromText('$120K')).toBe(120000)
    })

    it('parses "$120k" (lowercase) correctly', () => {
      expect(parseSalaryFromText('$120k')).toBe(120000)
    })

    it('parses "$120K - $150K" and returns minimum', () => {
      expect(parseSalaryFromText('$120K - $150K')).toBe(120000)
    })

    it('parses "$120,000 - $150,000" and returns minimum', () => {
      expect(parseSalaryFromText('$120,000 - $150,000')).toBe(120000)
    })

    it('parses "120000" without $ correctly', () => {
      expect(parseSalaryFromText('120000')).toBe(120000)
    })

    it('parses salary with text like "Salary: $130K/year"', () => {
      expect(parseSalaryFromText('Salary: $130K/year')).toBe(130000)
    })
  })

  describe('invalid/missing salary', () => {
    it('returns 0 for null', () => {
      expect(parseSalaryFromText(null)).toBe(0)
    })

    it('returns 0 for undefined', () => {
      expect(parseSalaryFromText(undefined)).toBe(0)
    })

    it('returns 0 for "Not listed"', () => {
      expect(parseSalaryFromText('Not listed')).toBe(0)
    })

    it('returns 0 for "Competitive"', () => {
      expect(parseSalaryFromText('Competitive')).toBe(0)
    })

    it('returns 0 for empty string', () => {
      expect(parseSalaryFromText('')).toBe(0)
    })

    it('returns 0 for non-string types', () => {
      expect(parseSalaryFromText(120000)).toBe(0)
      expect(parseSalaryFromText({ salary: 120000 })).toBe(0)
    })
  })
})

describe('calculateDefaultFitScore', () => {
  it('returns base score of 50 for unmatched job', () => {
    const job = createMockJob({
      title: 'Janitor',
      industry: 'Facilities',
      location: 'Alaska',
      salary: '$30,000'
    })

    const result = calculateDefaultFitScore(job)

    expect(result.score).toBe(50)
    expect(result.breakdown.base).toBe(50)
    expect(result.breakdown.role).toBe(0)
    expect(result.breakdown.industry).toBe(0)
    expect(result.breakdown.location).toBe(0)
    expect(result.breakdown.salary).toBe(0)
    expect(result.usingDefaults).toBe(true)
  })

  it('adds 25 points for exact title match', () => {
    const job = createMockJob({ title: 'Creative Director' })

    const result = calculateDefaultFitScore(job)

    expect(result.breakdown.role).toBe(25)
  })

  it('adds 15 points for partial title match', () => {
    const job = createMockJob({ title: 'Creative Manager' })

    const result = calculateDefaultFitScore(job)

    expect(result.breakdown.role).toBe(15)
  })

  it('adds 20 points for preferred industry', () => {
    const job = createMockJob({ industry: 'Healthcare Technology' })

    const result = calculateDefaultFitScore(job)

    expect(result.breakdown.industry).toBe(20)
  })

  it('adds 10 points for acceptable industry', () => {
    const job = createMockJob({ industry: 'SaaS Startup' })

    const result = calculateDefaultFitScore(job)

    expect(result.breakdown.industry).toBe(10)
  })

  it('adds 15 points for preferred location', () => {
    const job = createMockJob({ location: 'Boston, MA' })

    const result = calculateDefaultFitScore(job)

    expect(result.breakdown.location).toBe(15)
  })

  it('adds 8 points for acceptable location', () => {
    const job = createMockJob({ location: 'New York, NY' })

    const result = calculateDefaultFitScore(job)

    expect(result.breakdown.location).toBe(8)
  })

  it('adds 15 points for salary meeting minimum', () => {
    const job = createMockJob({ salary: '$150,000' })

    const result = calculateDefaultFitScore(job)

    expect(result.breakdown.salary).toBe(15)
  })

  it('caps total score at 100', () => {
    const job = createMockJob({
      title: 'Creative Director',
      industry: 'Healthcare',
      location: 'Remote',
      salary: '$200,000'
    })

    const result = calculateDefaultFitScore(job)

    // Base 50 + role 25 + industry 20 + location 15 + salary 15 = 125, capped at 100
    expect(result.score).toBe(100)
  })

  it('always sets usingDefaults to true', () => {
    const job = createMockJob()

    const result = calculateDefaultFitScore(job)

    expect(result.usingDefaults).toBe(true)
  })
})

describe('calculateFitScore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('profile-based scoring (targetRoles populated)', () => {
    it('uses profile targetRoles for scoring', () => {
      loadProfile.mockReturnValue(createMockProfile())

      const job = createMockJob({
        title: 'Creative Director',
        industry: 'Healthcare',
        location: 'Boston',
        salary: '$130,000'
      })

      const result = calculateFitScore(job)

      expect(result.usingDefaults).toBe(false)
      expect(result.breakdown.role).toBe(25) // Exact match
      expect(result.breakdown.industry).toBe(20) // Preferred
      expect(result.breakdown.location).toBe(15) // Preferred
      expect(result.breakdown.salary).toBe(15) // Meets minimum
    })

    it('gives 25 points for exact title match from profile', () => {
      loadProfile.mockReturnValue(createMockProfile())

      const job = createMockJob({ title: 'Design Director at Acme' })

      const result = calculateFitScore(job)

      expect(result.breakdown.role).toBe(25)
    })

    it('gives 15 points for partial title match from profile', () => {
      loadProfile.mockReturnValue(createMockProfile())

      const job = createMockJob({ title: 'Design Lead Manager' })

      const result = calculateFitScore(job)

      expect(result.breakdown.role).toBe(15)
    })

    it('gives 20 points for preferred industry from profile', () => {
      loadProfile.mockReturnValue(createMockProfile())

      const job = createMockJob({ industry: 'Nonprofit Education' })

      const result = calculateFitScore(job)

      expect(result.breakdown.industry).toBe(20)
    })

    it('gives 10 points for acceptable industry from profile', () => {
      loadProfile.mockReturnValue(createMockProfile())

      const job = createMockJob({ industry: 'Early Stage Startup' })

      const result = calculateFitScore(job)

      expect(result.breakdown.industry).toBe(10)
    })

    it('gives 15 points for preferred location from profile', () => {
      loadProfile.mockReturnValue(createMockProfile())

      const job = createMockJob({ location: 'Remote (US)' })

      const result = calculateFitScore(job)

      expect(result.breakdown.location).toBe(15)
    })

    it('gives 8 points for acceptable location from profile', () => {
      loadProfile.mockReturnValue(createMockProfile())

      const job = createMockJob({ location: 'New York City' })

      const result = calculateFitScore(job)

      expect(result.breakdown.location).toBe(8)
    })

    it('gives 15 points when salary meets minimum', () => {
      loadProfile.mockReturnValue(createMockProfile())

      const job = createMockJob({ salary: '$125,000' })

      const result = calculateFitScore(job)

      expect(result.breakdown.salary).toBe(15)
    })

    it('gives 0 salary points when salary is below minimum', () => {
      loadProfile.mockReturnValue(createMockProfile())

      const job = createMockJob({ salary: '$90,000' })

      const result = calculateFitScore(job)

      expect(result.breakdown.salary).toBe(0)
    })

    it('matches skills in job description (2 points each, max 10)', () => {
      loadProfile.mockReturnValue(createMockProfile())

      const job = createMockJob({
        description: 'Looking for expertise in JavaScript, React, Node.js, and TypeScript. Figma experience a plus.'
      })

      const result = calculateFitScore(job)

      // 5 skills matched at 2 points each = 10 points
      expect(result.breakdown.skills).toBe(10)
    })

    it('caps skill points at 10 (5 matches)', () => {
      loadProfile.mockReturnValue(createMockProfile())

      const job = createMockJob({
        description: 'Need JavaScript, React, Node.js, TypeScript, Design Systems, and Figma expertise.'
      })

      const result = calculateFitScore(job)

      // 6 skills in description but capped at 5 matches = 10 points
      expect(result.breakdown.skills).toBe(10)
    })

    it('gives 0 skill points when no skills match', () => {
      loadProfile.mockReturnValue(createMockProfile())

      const job = createMockJob({
        description: 'Looking for Python and Django expertise.'
      })

      const result = calculateFitScore(job)

      expect(result.breakdown.skills).toBe(0)
    })

    it('does not exceed 100 total score', () => {
      loadProfile.mockReturnValue(createMockProfile())

      const job = createMockJob({
        title: 'Creative Director',
        industry: 'Healthcare',
        location: 'Boston',
        salary: '$200,000',
        description: 'Need JavaScript, React, Node.js, TypeScript, Design Systems expertise.'
      })

      const result = calculateFitScore(job)

      // Base 50 + role 25 + industry 20 + location 15 + salary 15 + skills 10 = 135, capped at 100
      expect(result.score).toBe(100)
    })
  })

  describe('fallback behavior (empty targetRoles)', () => {
    it('uses defaults when targetRoles is empty array', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      loadProfile.mockReturnValue(createMockProfile({ targetRoles: [] }))

      const job = createMockJob()

      const result = calculateFitScore(job)

      expect(result.usingDefaults).toBe(true)
      expect(consoleWarnSpy).toHaveBeenCalledWith('Profile targetRoles is empty - using default fit criteria')

      consoleWarnSpy.mockRestore()
    })

    it('uses defaults when targetRoles is undefined', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      loadProfile.mockReturnValue({
        ...createMockProfile(),
        preferences: { communication: null }
      })

      const job = createMockJob()

      const result = calculateFitScore(job)

      expect(result.usingDefaults).toBe(true)

      consoleWarnSpy.mockRestore()
    })

    it('uses defaults when preferences is undefined', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      loadProfile.mockReturnValue({
        ...createMockProfile(),
        preferences: undefined
      })

      const job = createMockJob()

      const result = calculateFitScore(job)

      expect(result.usingDefaults).toBe(true)

      consoleWarnSpy.mockRestore()
    })

    it('uses defaults when profile load fails', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      loadProfile.mockImplementation(() => {
        throw new Error('File not found')
      })

      const job = createMockJob()

      const result = calculateFitScore(job)

      expect(result.usingDefaults).toBe(true)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to load profile - using default fit criteria:',
        'File not found'
      )

      consoleWarnSpy.mockRestore()
    })
  })

  describe('edge cases', () => {
    it('handles job with no description gracefully', () => {
      loadProfile.mockReturnValue(createMockProfile())

      const job = createMockJob({
        description: undefined
      })

      const result = calculateFitScore(job)

      expect(result.breakdown.skills).toBe(0)
      expect(result.score).toBeGreaterThanOrEqual(50)
    })

    it('handles job with empty description', () => {
      loadProfile.mockReturnValue(createMockProfile())

      const job = createMockJob({
        description: ''
      })

      const result = calculateFitScore(job)

      expect(result.breakdown.skills).toBe(0)
    })

    it('handles profile with no skills', () => {
      loadProfile.mockReturnValue(createMockProfile({ skills: [] }))

      const job = createMockJob({
        description: 'Looking for JavaScript expertise.'
      })

      const result = calculateFitScore(job)

      expect(result.breakdown.skills).toBe(0)
    })

    it('handles null job data fields', () => {
      loadProfile.mockReturnValue(createMockProfile())

      const job = {
        id: 1,
        title: null,
        company: null,
        industry: null,
        location: null,
        salary: null,
        description: null,
        status: 'inbox',
        fitScore: 0
      }

      const result = calculateFitScore(job)

      expect(result.score).toBe(50) // Just base score
      expect(result.breakdown.base).toBe(50)
      expect(result.breakdown.role).toBe(0)
      expect(result.breakdown.industry).toBe(0)
      expect(result.breakdown.location).toBe(0)
      expect(result.breakdown.salary).toBe(0)
      expect(result.breakdown.skills).toBe(0)
    })

    it('uses job notes as fallback when description is missing', () => {
      loadProfile.mockReturnValue(createMockProfile())

      const job = createMockJob({
        description: undefined,
        notes: 'Looking for JavaScript and React skills'
      })

      const result = calculateFitScore(job)

      expect(result.breakdown.skills).toBe(4) // 2 skills * 2 points
    })

    it('merges criteria from multiple target roles', () => {
      loadProfile.mockReturnValue(createMockProfile({
        targetRoles: [
          {
            id: 'role-1',
            titles: { exact: ['Creative Director'] },
            industries: { preferred: ['healthcare'] },
            locations: { preferred: ['Boston'] },
            salary: { minimum: 100000 }
          },
          {
            id: 'role-2',
            titles: { exact: ['Design Director'] },
            industries: { preferred: ['nonprofit'] },
            locations: { preferred: ['Remote'] },
            salary: { minimum: 120000 }
          }
        ]
      }))

      // Job matches criteria from role-2
      const job = createMockJob({
        title: 'Design Director',
        industry: 'Nonprofit Organization',
        location: 'Remote (US)',
        salary: '$125,000'
      })

      const result = calculateFitScore(job)

      expect(result.breakdown.role).toBe(25) // Matches Design Director from role-2
      expect(result.breakdown.industry).toBe(20) // Matches nonprofit from role-2
      expect(result.breakdown.location).toBe(15) // Matches Remote from role-2
      expect(result.breakdown.salary).toBe(15) // Meets higher minimum (120000)
    })

    it('uses highest salary minimum across target roles', () => {
      loadProfile.mockReturnValue(createMockProfile({
        targetRoles: [
          { id: 'role-1', salary: { minimum: 100000 } },
          { id: 'role-2', salary: { minimum: 150000 } }
        ]
      }))

      const job = createMockJob({ salary: '$125,000' })

      const result = calculateFitScore(job)

      // 125000 is below 150000 (highest minimum), so 0 salary points
      expect(result.breakdown.salary).toBe(0)
    })
  })
})
