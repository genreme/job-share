/**
 * Job Schema Tests
 *
 * Tests Zod schema validation for job data structure.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  JobSchema,
  JobsDataSchema,
  JobStatusSchema,
  validateJobsData,
  validateJob,
  VALID_TRANSITIONS,
  isValidTransition
} from './job.schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '..', 'test', 'fixtures')

// Load test fixtures
const validJob = JSON.parse(readFileSync(join(fixturesDir, 'valid-job.json'), 'utf-8'))
const invalidJobs = JSON.parse(readFileSync(join(fixturesDir, 'invalid-jobs.json'), 'utf-8'))

describe('JobStatusSchema', () => {
  it('accepts all valid statuses including inbox', () => {
    const validStatuses = ['inbox', 'apply-now', 'maybe', 'probably-not', 'applied', 'archived']

    for (const status of validStatuses) {
      const result = JobStatusSchema.safeParse(status)
      expect(result.success, `Status "${status}" should be valid`).toBe(true)
    }
  })

  it('accepts inbox as the first status for new jobs', () => {
    const result = JobStatusSchema.safeParse('inbox')
    expect(result.success).toBe(true)
    expect(result.data).toBe('inbox')
  })

  it('rejects invalid statuses', () => {
    const invalidStatuses = ['pending', 'active', 'rejected', 'interviewing', '']

    for (const status of invalidStatuses) {
      const result = JobStatusSchema.safeParse(status)
      expect(result.success, `Status "${status}" should be invalid`).toBe(false)
    }
  })
})

describe('Status Transitions', () => {
  describe('VALID_TRANSITIONS', () => {
    it('defines transitions for all statuses', () => {
      const allStatuses = ['inbox', 'apply-now', 'maybe', 'probably-not', 'applied', 'archived']
      for (const status of allStatuses) {
        expect(VALID_TRANSITIONS).toHaveProperty(status)
        expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true)
      }
    })

    it('inbox can transition to review statuses but not directly to applied', () => {
      expect(VALID_TRANSITIONS['inbox']).toContain('apply-now')
      expect(VALID_TRANSITIONS['inbox']).toContain('maybe')
      expect(VALID_TRANSITIONS['inbox']).toContain('probably-not')
      expect(VALID_TRANSITIONS['inbox']).toContain('archived')
      expect(VALID_TRANSITIONS['inbox']).not.toContain('applied')
    })

    it('archived is a terminal state with no transitions', () => {
      expect(VALID_TRANSITIONS['archived']).toEqual([])
    })
  })

  describe('isValidTransition', () => {
    it('allows valid inbox transitions', () => {
      expect(isValidTransition('inbox', 'apply-now')).toBe(true)
      expect(isValidTransition('inbox', 'maybe')).toBe(true)
      expect(isValidTransition('inbox', 'probably-not')).toBe(true)
      expect(isValidTransition('inbox', 'archived')).toBe(true)
    })

    it('rejects inbox -> applied transition', () => {
      expect(isValidTransition('inbox', 'applied')).toBe(false)
    })

    it('allows apply-now -> applied transition', () => {
      expect(isValidTransition('apply-now', 'applied')).toBe(true)
    })

    it('allows maybe -> applied transition', () => {
      expect(isValidTransition('maybe', 'applied')).toBe(true)
    })

    it('rejects probably-not -> applied transition', () => {
      expect(isValidTransition('probably-not', 'applied')).toBe(false)
    })

    it('rejects all transitions from archived', () => {
      expect(isValidTransition('archived', 'inbox')).toBe(false)
      expect(isValidTransition('archived', 'apply-now')).toBe(false)
      expect(isValidTransition('archived', 'maybe')).toBe(false)
    })

    it('returns false for unknown statuses', () => {
      expect(isValidTransition('unknown', 'apply-now')).toBe(false)
      expect(isValidTransition('inbox', 'unknown')).toBe(false)
    })
  })
})

describe('JobSchema', () => {
  describe('valid job', () => {
    it('passes validation for complete valid job', () => {
      const result = JobSchema.safeParse(validJob)
      expect(result.success).toBe(true)
    })

    it('accepts job with minimal required fields', () => {
      const minimalJob = {
        id: 1,
        title: 'Creative Director',
        company: 'Acme Corp',
        fitScore: 85,
        status: 'apply-now'
      }

      const result = JobSchema.safeParse(minimalJob)
      expect(result.success).toBe(true)
    })

    it('accepts job with empty string URL (valid case)', () => {
      const jobWithEmptyUrl = {
        id: 1,
        title: 'Creative Director',
        company: 'Acme Corp',
        fitScore: 85,
        status: 'apply-now',
        url: ''
      }

      const result = JobSchema.safeParse(jobWithEmptyUrl)
      expect(result.success).toBe(true)
    })

    it('accepts both legacy string and object connections', () => {
      const jobWithMixedConnections = {
        id: 1,
        title: 'Creative Director',
        company: 'Acme Corp',
        fitScore: 85,
        status: 'apply-now',
        connections: [
          'John Doe (referral)',
          { name: 'Jane Smith', role: 'VP', isPrimary: true }
        ]
      }

      const result = JobSchema.safeParse(jobWithMixedConnections)
      expect(result.success).toBe(true)
    })

    it('accepts fitScore at boundary values (0 and 100)', () => {
      const jobWithZeroScore = { ...validJob, id: 10, fitScore: 0 }
      const jobWithMaxScore = { ...validJob, id: 11, fitScore: 100 }

      expect(JobSchema.safeParse(jobWithZeroScore).success).toBe(true)
      expect(JobSchema.safeParse(jobWithMaxScore).success).toBe(true)
    })
  })

  describe('invalid jobs', () => {
    it.each(invalidJobs)('catches error for: $name', ({ job, expectedErrors }) => {
      const result = JobSchema.safeParse(job)
      expect(result.success).toBe(false)

      // Check that expected error paths are present
      const errorPaths = result.error.issues.map(issue => issue.path[0])

      for (const expectedError of expectedErrors) {
        expect(
          errorPaths.includes(expectedError),
          `Expected error for "${expectedError}" but got errors for: ${errorPaths.join(', ')}`
        ).toBe(true)
      }
    })
  })

  describe('edge cases', () => {
    it('handles null for nullable fields', () => {
      const jobWithNulls = {
        id: 1,
        title: 'Creative Director',
        company: 'Acme Corp',
        fitScore: 85,
        status: 'apply-now',
        applied: null,
        followup: null,
        posted: null,
        found: null
      }

      const result = JobSchema.safeParse(jobWithNulls)
      expect(result.success).toBe(true)
    })

    it('handles undefined for optional fields', () => {
      const jobWithUndefined = {
        id: 1,
        title: 'Creative Director',
        company: 'Acme Corp',
        fitScore: 85,
        status: 'apply-now'
        // All optional fields are undefined
      }

      const result = JobSchema.safeParse(jobWithUndefined)
      expect(result.success).toBe(true)
    })
  })
})

describe('JobsDataSchema', () => {
  it('validates complete jobs data structure', () => {
    const jobsData = {
      jobs: [validJob],
      searchHistory: [
        {
          timestamp: '2026-01-20T10:00:00.000Z',
          jobsFound: 10,
          newJobs: 5,
          sources: ['LinkedIn'],
          notes: 'Found good opportunities'
        }
      ],
      settings: { theme: 'dark' },
      version: 1,
      lastUpdated: '2026-01-20T10:00:00.000Z'
    }

    const result = JobsDataSchema.safeParse(jobsData)
    expect(result.success).toBe(true)
  })

  it('validates minimal jobs data (just jobs array)', () => {
    const minimalData = {
      jobs: []
    }

    const result = JobsDataSchema.safeParse(minimalData)
    expect(result.success).toBe(true)
  })

  it('rejects missing jobs array', () => {
    const noJobs = {
      settings: {}
    }

    const result = JobsDataSchema.safeParse(noJobs)
    expect(result.success).toBe(false)
  })
})

describe('validateJobsData', () => {
  describe('advisory mode (default)', () => {
    it('returns valid: true for valid data', () => {
      const validData = { jobs: [validJob] }
      const result = validateJobsData(validData)

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.data).toBeDefined()
    })

    it('returns valid: false with errors but still returns data', () => {
      const invalidData = {
        jobs: [{ id: -1, title: '', company: '', fitScore: 200, status: 'invalid' }]
      }

      const result = validateJobsData(invalidData)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      // Advisory mode returns original data even on failure
      expect(result.data).toEqual(invalidData)
    })

    it('includes descriptive error messages', () => {
      const invalidData = {
        jobs: [{ id: 1, title: 'Test', company: 'Test', fitScore: 150, status: 'apply-now' }]
      }

      const result = validateJobsData(invalidData)

      expect(result.valid).toBe(false)
      const fitScoreError = result.errors.find(e => e.path.includes('fitScore'))
      expect(fitScoreError).toBeDefined()
      expect(fitScoreError.message).toBeDefined()
    })
  })

  describe('strict mode', () => {
    it('returns valid data in strict mode', () => {
      const validData = { jobs: [validJob] }
      const result = validateJobsData(validData, { mode: 'strict' })

      expect(result.valid).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('throws error in strict mode for invalid data', () => {
      const invalidData = { jobs: [{ id: -1 }] }

      expect(() => validateJobsData(invalidData, { mode: 'strict' })).toThrow()
    })
  })
})

describe('validateJob', () => {
  it('validates a single valid job', () => {
    const result = validateJob(validJob)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('returns errors for invalid job in advisory mode', () => {
    const invalidJob = { id: -1, title: '', company: '' }
    const result = validateJob(invalidJob)

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.data).toEqual(invalidJob)
  })

  it('throws in strict mode for invalid job', () => {
    const invalidJob = { id: -1 }

    expect(() => validateJob(invalidJob, { mode: 'strict' })).toThrow()
  })
})
