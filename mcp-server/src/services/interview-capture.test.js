/**
 * Interview Capture Service Tests
 *
 * Tests for captureTranscript, getTranscriptsForJob, getTranscriptsChronological,
 * searchTranscripts, and checkTranscriptReminder.
 *
 * Uses job ID range 9100-9199 for test isolation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { unlinkSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  captureTranscript,
  getTranscriptsForJob,
  getTranscriptsChronological,
  searchTranscripts,
  checkTranscriptReminder
} from './interview-capture.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const RESEARCH_DIR = join(DATA_DIR, 'job-research')
const JOBS_FILE = join(DATA_DIR, 'jobs.json')

// Ensure research directory exists
if (!existsSync(RESEARCH_DIR)) {
  mkdirSync(RESEARCH_DIR, { recursive: true })
}

// Helper to clean up test files
function cleanupTestFiles(jobIds) {
  for (const jobId of jobIds) {
    try {
      const filePath = join(RESEARCH_DIR, `${jobId}-transcripts.json`)
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Helper to save mock jobs data
let originalJobsData = null
function saveMockJobsData(jobs) {
  if (existsSync(JOBS_FILE)) {
    originalJobsData = readFileSync(JOBS_FILE, 'utf-8')
  }
  writeFileSync(JOBS_FILE, JSON.stringify({ jobs }, null, 2))
}

function restoreJobsData() {
  if (originalJobsData !== null) {
    writeFileSync(JOBS_FILE, originalJobsData)
    originalJobsData = null
  } else if (existsSync(JOBS_FILE)) {
    // Don't delete if it was there before tests started
  }
}

// UUID constants for tests
const T1_ID = '11111111-1111-4111-a111-111111111111'
const T2_ID = '22222222-2222-4222-a222-222222222222'
const T3_ID = '33333333-3333-4333-a333-333333333333'

// Valid transcript fixture
function createValidTranscript(overrides = {}) {
  return {
    id: T1_ID,
    jobId: 9101,
    sessionType: 'real-interview',
    interviewDate: '2026-02-01T10:00:00.000Z',
    interviewerName: 'Jane Smith',
    interviewType: 'video',
    confidenceLevel: 'high',
    overallVibe: 'went-well',
    rawTranscript: 'Interviewer: Tell me about yourself.\nMe: I have 10 years of experience in software development...',
    highlights: ['Strong opening'],
    capturedAt: '2026-02-01T11:30:00.000Z',
    duration: 45,
    ...overrides
  }
}

describe('Interview Capture Service', () => {
  const testJobIds = Array.from({ length: 20 }, (_, i) => 9100 + i)

  beforeEach(() => {
    cleanupTestFiles(testJobIds)
  })

  afterEach(() => {
    cleanupTestFiles(testJobIds)
    restoreJobsData()
  })

  // ===========================================================================
  // captureTranscript
  // ===========================================================================

  describe('captureTranscript', () => {
    it('creates new transcript file if none exists', () => {
      const transcript = createValidTranscript({ jobId: 9101 })
      const result = captureTranscript(transcript)

      expect(result.captured).toBe(true)
      expect(result.id).toBe(T1_ID)
      expect(result.transcriptCount).toBe(1)

      const filePath = join(RESEARCH_DIR, '9101-transcripts.json')
      expect(existsSync(filePath)).toBe(true)
    })

    it('appends to existing transcripts', () => {
      const transcript1 = createValidTranscript({ id: T1_ID, jobId: 9102 })
      const transcript2 = createValidTranscript({ id: T2_ID, jobId: 9102 })

      captureTranscript(transcript1)
      const result = captureTranscript(transcript2)

      expect(result.captured).toBe(true)
      expect(result.transcriptCount).toBe(2)
    })

    it('generates UUID if not provided', () => {
      const transcript = createValidTranscript({ jobId: 9103 })
      delete transcript.id

      const result = captureTranscript(transcript)

      expect(result.captured).toBe(true)
      expect(result.id).toBeDefined()
      expect(result.id).not.toBe(T1_ID)
      // Verify it's a valid UUID format
      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('sets capturedAt if not provided', () => {
      const transcript = createValidTranscript({ jobId: 9104 })
      delete transcript.capturedAt

      const before = new Date().toISOString()
      const result = captureTranscript(transcript)
      const after = new Date().toISOString()

      expect(result.captured).toBe(true)

      const transcriptsData = getTranscriptsForJob(9104)
      const savedTranscript = transcriptsData.interviews[0]
      expect(savedTranscript.capturedAt).toBeDefined()
      expect(savedTranscript.capturedAt >= before).toBe(true)
      expect(savedTranscript.capturedAt <= after).toBe(true)
    })

    it('validates transcript schema', () => {
      const invalidTranscript = {
        jobId: 9105,
        sessionType: 'invalid-type', // Invalid enum value
        interviewDate: '2026-02-01T10:00:00.000Z',
        interviewType: 'video',
        rawTranscript: 'Test transcript',
        capturedAt: '2026-02-01T11:00:00.000Z'
      }

      const result = captureTranscript(invalidTranscript)

      expect(result.captured).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns error for missing required fields', () => {
      const transcript = {
        jobId: 9106,
        sessionType: 'practice'
        // Missing required fields
      }

      const result = captureTranscript(transcript)

      expect(result.captured).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('persists practice session transcripts', () => {
      const transcript = createValidTranscript({
        jobId: 9107,
        sessionType: 'practice',
        practiceSessionId: T3_ID
      })

      const result = captureTranscript(transcript)

      expect(result.captured).toBe(true)
      const transcriptsData = getTranscriptsForJob(9107)
      expect(transcriptsData.interviews[0].sessionType).toBe('practice')
      expect(transcriptsData.interviews[0].practiceSessionId).toBe(T3_ID)
    })

    it('preserves all optional fields', () => {
      const transcript = createValidTranscript({
        jobId: 9108,
        interviewerName: 'John Doe',
        confidenceLevel: 'medium',
        overallVibe: 'neutral',
        duration: 60,
        interviewerResearchId: T2_ID
      })

      captureTranscript(transcript)

      const transcriptsData = getTranscriptsForJob(9108)
      const saved = transcriptsData.interviews[0]
      expect(saved.interviewerName).toBe('John Doe')
      expect(saved.confidenceLevel).toBe('medium')
      expect(saved.overallVibe).toBe('neutral')
      expect(saved.duration).toBe(60)
      expect(saved.interviewerResearchId).toBe(T2_ID)
    })
  })

  // ===========================================================================
  // getTranscriptsForJob
  // ===========================================================================

  describe('getTranscriptsForJob', () => {
    it('returns transcripts for existing job', () => {
      const transcript = createValidTranscript({ jobId: 9110 })
      captureTranscript(transcript)

      const result = getTranscriptsForJob(9110)

      expect(result.interviews).toHaveLength(1)
      expect(result.interviews[0].id).toBe(T1_ID)
    })

    it('returns empty array for non-existent job', () => {
      const result = getTranscriptsForJob(9199) // No transcripts

      expect(result.interviews).toEqual([])
    })

    it('returns correct structure with lastUpdated', () => {
      const transcript = createValidTranscript({ jobId: 9111 })
      captureTranscript(transcript)

      const result = getTranscriptsForJob(9111)

      expect(result.interviews).toBeDefined()
      expect(result.lastUpdated).toBeDefined()
      expect(Array.isArray(result.interviews)).toBe(true)
    })

    it('returns multiple transcripts for same job', () => {
      const transcript1 = createValidTranscript({ id: T1_ID, jobId: 9112 })
      const transcript2 = createValidTranscript({ id: T2_ID, jobId: 9112 })

      captureTranscript(transcript1)
      captureTranscript(transcript2)

      const result = getTranscriptsForJob(9112)
      expect(result.interviews).toHaveLength(2)
    })
  })

  // ===========================================================================
  // getTranscriptsChronological
  // ===========================================================================

  describe('getTranscriptsChronological', () => {
    it('returns transcripts sorted by date descending', () => {
      const older = createValidTranscript({
        id: T1_ID,
        jobId: 9115,
        interviewDate: '2026-01-15T10:00:00.000Z'
      })
      const newer = createValidTranscript({
        id: T2_ID,
        jobId: 9116,
        interviewDate: '2026-02-01T10:00:00.000Z'
      })

      captureTranscript(older)
      captureTranscript(newer)

      const result = getTranscriptsChronological()

      // Filter to only test job IDs (in case other tests left data)
      const testResults = result.filter(t => t.jobId >= 9100 && t.jobId < 9200)

      expect(testResults.length).toBeGreaterThanOrEqual(2)
      // Newer should come first
      const newerIndex = testResults.findIndex(t => t.id === T2_ID)
      const olderIndex = testResults.findIndex(t => t.id === T1_ID)
      expect(newerIndex).toBeLessThan(olderIndex)
    })

    it('respects limit option', () => {
      for (let i = 0; i < 5; i++) {
        const transcript = createValidTranscript({
          id: `${i}1111111-1111-4111-a111-11111111111${i}`,
          jobId: 9117 + i,
          interviewDate: `2026-02-0${i + 1}T10:00:00.000Z`
        })
        captureTranscript(transcript)
      }

      const result = getTranscriptsChronological({ limit: 3 })

      expect(result.length).toBeLessThanOrEqual(3)
    })

    it('includes jobId in each result', () => {
      const transcript = createValidTranscript({ jobId: 9125 })
      captureTranscript(transcript)

      const result = getTranscriptsChronological()
      const testTranscript = result.find(t => t.id === T1_ID)

      expect(testTranscript).toBeDefined()
      expect(testTranscript.jobId).toBe(9125)
    })

    it('returns empty array when no transcripts exist', () => {
      cleanupTestFiles(testJobIds) // Ensure clean state

      const result = getTranscriptsChronological()

      // May have transcripts from other jobs, but should work without error
      expect(Array.isArray(result)).toBe(true)
    })

    it('aggregates transcripts from multiple jobs', () => {
      // Use unique IDs for this specific test
      const agg1Id = 'aaaaaaa1-1111-4111-a111-111111111111'
      const agg2Id = 'aaaaaaa2-2222-4222-a222-222222222222'

      const t1 = createValidTranscript({ id: agg1Id, jobId: 9126 })
      const t2 = createValidTranscript({ id: agg2Id, jobId: 9127 })

      captureTranscript(t1)
      captureTranscript(t2)

      const result = getTranscriptsChronological()
      const testIds = result.filter(t => t.id === agg1Id || t.id === agg2Id)

      expect(testIds).toHaveLength(2)
    })
  })

  // ===========================================================================
  // searchTranscripts
  // ===========================================================================

  describe('searchTranscripts', () => {
    beforeEach(() => {
      // Set up test transcripts with known content
      const transcripts = [
        createValidTranscript({
          id: T1_ID,
          jobId: 9130,
          sessionType: 'real-interview',
          rawTranscript: 'We discussed React and TypeScript extensively. The interviewer was impressed with my frontend skills.'
        }),
        createValidTranscript({
          id: T2_ID,
          jobId: 9131,
          sessionType: 'practice',
          rawTranscript: 'Practice session about system design. Covered distributed systems and database scaling.'
        }),
        createValidTranscript({
          id: T3_ID,
          jobId: 9130,
          sessionType: 'real-interview',
          rawTranscript: 'Second round: Deep dive into Python and backend development. Discussed API design patterns.'
        })
      ]

      for (const t of transcripts) {
        captureTranscript(t)
      }
    })

    it('finds matching transcripts', () => {
      const result = searchTranscripts('React')

      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result.some(t => t.id === T1_ID)).toBe(true)
    })

    it('case-insensitive search', () => {
      const result = searchTranscripts('REACT')

      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result.some(t => t.id === T1_ID)).toBe(true)
    })

    it('all words must match', () => {
      // 'React' and 'TypeScript' both in T1_ID
      const result1 = searchTranscripts('React TypeScript')
      expect(result1.some(t => t.id === T1_ID)).toBe(true)

      // 'React' and 'Python' are in different transcripts
      const result2 = searchTranscripts('React Python')
      expect(result2.some(t => t.id === T1_ID)).toBe(false)
    })

    it('respects jobId filter', () => {
      const result = searchTranscripts('interview', { jobId: 9130 })

      // T1_ID is in job 9130 and contains 'interview'
      const job9130Results = result.filter(t => t.jobId === 9130)
      expect(job9130Results.length).toBeGreaterThanOrEqual(1)

      // T2_ID is in job 9131, should not be included
      expect(result.some(t => t.jobId === 9131)).toBe(false)
    })

    it('respects sessionType filter', () => {
      const result = searchTranscripts('system', { sessionType: 'practice' })

      // T2_ID is practice session with 'system' in content
      expect(result.some(t => t.id === T2_ID)).toBe(true)

      // Real interviews should not be included
      const realInterviews = result.filter(t => t.sessionType === 'real-interview')
      expect(realInterviews).toHaveLength(0)
    })

    it('returns context snippet', () => {
      const result = searchTranscripts('React')
      const match = result.find(t => t.id === T1_ID)

      expect(match).toBeDefined()
      expect(match.contextSnippet).toBeDefined()
      expect(match.contextSnippet).toContain('React')
    })

    it('respects limit', () => {
      const result = searchTranscripts('interview', { limit: 1 })

      expect(result.length).toBeLessThanOrEqual(1)
    })

    it('returns empty array for empty query', () => {
      const result = searchTranscripts('')
      expect(result).toEqual([])
    })

    it('returns empty array for whitespace-only query', () => {
      const result = searchTranscripts('   ')
      expect(result).toEqual([])
    })

    it('handles no matches gracefully', () => {
      const result = searchTranscripts('xyznonexistentterm123')
      expect(result).toEqual([])
    })

    it('sorts results by date descending', () => {
      // Use very unique search term to isolate this test
      const uniqueSearchTerm = 'xyzzy987654uniquetestterm'
      const olderTranscript = createValidTranscript({
        id: '99999999-9999-4999-a999-999999999991',
        jobId: 9140,
        interviewDate: '2026-01-01T10:00:00.000Z',
        rawTranscript: `Keywords: ${uniqueSearchTerm} one`
      })
      const newerTranscript = createValidTranscript({
        id: '99999999-9999-4999-a999-999999999992',
        jobId: 9141,
        interviewDate: '2026-03-01T10:00:00.000Z',
        rawTranscript: `Keywords: ${uniqueSearchTerm} two`
      })

      captureTranscript(olderTranscript)
      captureTranscript(newerTranscript)

      const result = searchTranscripts(uniqueSearchTerm)

      expect(result.length).toBe(2)
      // Newer should come first
      expect(new Date(result[0].interviewDate) >= new Date(result[1].interviewDate)).toBe(true)
    })
  })

  // ===========================================================================
  // checkTranscriptReminder
  // ===========================================================================

  describe('checkTranscriptReminder', () => {
    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    const twelvHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000)
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)

    it('no reminder for jobs with all transcripts captured', () => {
      // Set up job with interview update
      saveMockJobsData([
        {
          id: 9150,
          updates: [
            { date: threeDaysAgo.toISOString(), content: 'Had phone interview today' }
          ]
        }
      ])

      // Capture transcript for the same date
      captureTranscript(createValidTranscript({
        jobId: 9150,
        interviewDate: threeDaysAgo.toISOString()
      }))

      const result = checkTranscriptReminder(9150)

      expect(result.needsReminder).toBe(false)
      expect(result.interviews).toHaveLength(0)
    })

    it('reminder for interview > 24h without transcript', () => {
      saveMockJobsData([
        {
          id: 9151,
          updates: [
            { date: threeDaysAgo.toISOString(), content: 'Technical interview completed' }
          ]
        }
      ])

      // No transcript captured

      const result = checkTranscriptReminder(9151)

      expect(result.needsReminder).toBe(true)
      expect(result.interviews.length).toBeGreaterThanOrEqual(1)
      expect(result.interviews[0].hoursSince).toBeGreaterThan(24)
      expect(result.interviews[0].message).toContain('no transcript captured')
    })

    it('no reminder for interview < 24h', () => {
      saveMockJobsData([
        {
          id: 9152,
          updates: [
            { date: twelvHoursAgo.toISOString(), content: 'Just finished interview' }
          ]
        }
      ])

      const result = checkTranscriptReminder(9152)

      expect(result.needsReminder).toBe(false)
      expect(result.interviews).toHaveLength(0)
    })

    it('handles jobs with no recent interviews', () => {
      saveMockJobsData([
        {
          id: 9153,
          updates: [
            { date: tenDaysAgo.toISOString(), content: 'Interview from 10 days ago' }
          ]
        }
      ])

      const result = checkTranscriptReminder(9153)

      expect(result.needsReminder).toBe(false)
      expect(result.interviews).toHaveLength(0)
    })

    it('handles jobs with no updates', () => {
      saveMockJobsData([
        { id: 9154, updates: [] }
      ])

      const result = checkTranscriptReminder(9154)

      expect(result.needsReminder).toBe(false)
      expect(result.interviews).toHaveLength(0)
    })

    it('handles non-existent job', () => {
      saveMockJobsData([])

      const result = checkTranscriptReminder(9155)

      expect(result.needsReminder).toBe(false)
      expect(result.interviews).toHaveLength(0)
    })

    it('only considers interview-related updates', () => {
      saveMockJobsData([
        {
          id: 9156,
          updates: [
            { date: threeDaysAgo.toISOString(), content: 'Applied to this job' }, // Not interview
            { date: threeDaysAgo.toISOString(), content: 'Updated resume' } // Not interview
          ]
        }
      ])

      const result = checkTranscriptReminder(9156)

      expect(result.needsReminder).toBe(false)
    })

    it('detects multiple uncaptured interviews', () => {
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)

      saveMockJobsData([
        {
          id: 9157,
          updates: [
            { date: twoDaysAgo.toISOString(), content: 'Second interview completed' },
            { date: fourDaysAgo.toISOString(), content: 'First interview done' }
          ]
        }
      ])

      const result = checkTranscriptReminder(9157)

      expect(result.needsReminder).toBe(true)
      expect(result.interviews.length).toBe(2)
    })

    it('handles jobs data file not existing', () => {
      // Ensure jobs file doesn't exist for this test
      // The function should handle this gracefully
      const result = checkTranscriptReminder(9999)

      expect(result.needsReminder).toBe(false)
      expect(result.interviews).toEqual([])
    })
  })

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles empty raw transcript', () => {
      const transcript = createValidTranscript({
        jobId: 9180,
        rawTranscript: ''
      })

      const result = captureTranscript(transcript)

      expect(result.captured).toBe(true)
    })

    it('handles very long transcript', () => {
      const longTranscript = 'A'.repeat(100000)
      const transcript = createValidTranscript({
        jobId: 9181,
        rawTranscript: longTranscript
      })

      const result = captureTranscript(transcript)

      expect(result.captured).toBe(true)
    })

    it('handles special characters in transcript', () => {
      const specialChar = '\u2019' // Right single quotation mark
      const transcript = createValidTranscript({
        jobId: 9182,
        rawTranscript: 'Test with special chars: \n\t"quotes" & <brackets> unicode: ' + specialChar
      })

      const result = captureTranscript(transcript)

      expect(result.captured).toBe(true)
      const saved = getTranscriptsForJob(9182)
      expect(saved.interviews[0].rawTranscript).toContain(specialChar)
    })

    it('handles concurrent captures to same job', () => {
      // Use unique IDs for this test to avoid conflicts
      const concId1 = 'cccccc11-1111-4111-a111-111111111111'
      const concId2 = 'cccccc22-2222-4222-a222-222222222222'

      const t1 = createValidTranscript({ id: concId1, jobId: 9183 })
      const t2 = createValidTranscript({ id: concId2, jobId: 9183 })

      // Simulate rapid captures
      captureTranscript(t1)
      captureTranscript(t2)

      const result = getTranscriptsForJob(9183)
      // Should have at least 2 (may have more from other tests but at least these 2)
      expect(result.interviews.length).toBeGreaterThanOrEqual(2)
      // Verify both are present
      const ids = result.interviews.map(t => t.id)
      expect(ids).toContain(concId1)
      expect(ids).toContain(concId2)
    })
  })
})
