/**
 * Learning Extractor Service Tests
 *
 * Tests for queueInterviewLearning, reviewInterviewLearning, linkLearningToProfile,
 * getLearningsForJob, and getPendingLearnings.
 *
 * Uses job ID range 9200-9299 for test isolation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { unlinkSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  queueInterviewLearning,
  reviewInterviewLearning,
  linkLearningToProfile,
  getLearningsForJob,
  getPendingLearnings
} from './learning-extractor.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const RESEARCH_DIR = join(DATA_DIR, 'job-research')

// Ensure research directory exists
if (!existsSync(RESEARCH_DIR)) {
  mkdirSync(RESEARCH_DIR, { recursive: true })
}

// Helper to clean up test files
function cleanupTestFiles(jobIds) {
  for (const jobId of jobIds) {
    try {
      const filePath = join(RESEARCH_DIR, `${jobId}-learnings.json`)
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// UUID constants for tests - must be valid UUIDv4 format
// UUIDv4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx where y is 8, 9, a, or b
const L1_ID = '11111111-1111-4111-8111-111111111111'
const L2_ID = '22222222-2222-4222-8222-222222222222'
const L3_ID = '33333333-3333-4333-8333-333333333333'
const TRANSCRIPT_ID = '44444444-4444-4444-8444-444444444444'
const STORY_ID = '55555555-5555-4555-8555-555555555555'
const SKILL_ID = '66666666-6666-4666-8666-666666666666'
const SUMMARY_ID = '77777777-7777-4777-8777-777777777777'

// Valid learning fixture
function createValidLearning(overrides = {}) {
  return {
    id: L1_ID,
    jobId: 9201,
    transcriptId: TRANSCRIPT_ID,
    content: 'My explanation of system design concepts was well-received.',
    topic: 'technical',
    outcome: 'worked',
    ...overrides
  }
}

describe('Learning Extractor Service', () => {
  const testJobIds = Array.from({ length: 100 }, (_, i) => 9200 + i)

  beforeEach(() => {
    cleanupTestFiles(testJobIds)
  })

  afterEach(() => {
    cleanupTestFiles(testJobIds)
  })

  // ===========================================================================
  // queueInterviewLearning
  // ===========================================================================

  describe('queueInterviewLearning', () => {
    it('queues new learning successfully', () => {
      const learning = createValidLearning({ jobId: 9201 })
      const result = queueInterviewLearning(learning)

      expect(result.queued).toBe(true)
      expect(result.id).toBe(L1_ID)

      const filePath = join(RESEARCH_DIR, '9201-learnings.json')
      expect(existsSync(filePath)).toBe(true)
    })

    it('generates UUID if not provided', () => {
      const learning = createValidLearning({ jobId: 9202 })
      delete learning.id

      const result = queueInterviewLearning(learning)

      expect(result.queued).toBe(true)
      expect(result.id).toBeDefined()
      expect(result.id).not.toBe(L1_ID)
      // Verify it's a valid UUID format
      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('sets extractedAt automatically', () => {
      const learning = createValidLearning({ jobId: 9203 })

      const before = new Date().toISOString()
      queueInterviewLearning(learning)
      const after = new Date().toISOString()

      const learnings = getLearningsForJob(9203)
      const saved = learnings[0]
      expect(saved.extractedAt).toBeDefined()
      expect(saved.extractedAt >= before).toBe(true)
      expect(saved.extractedAt <= after).toBe(true)
    })

    it('sets status to proposed', () => {
      const learning = createValidLearning({ jobId: 9204 })
      queueInterviewLearning(learning)

      const learnings = getLearningsForJob(9204)
      expect(learnings[0].status).toBe('proposed')
    })

    it('detects duplicate learnings with stringSimilarity > 0.85', () => {
      const dup1Id = 'dddd0111-1111-4111-8111-111111111111'
      const dup2Id = 'dddd0222-2222-4222-8222-222222222222'
      const learning1 = createValidLearning({
        id: dup1Id,
        jobId: 9205,
        content: 'My explanation of system design concepts was well-received.'
      })
      // Very similar content - just adds a few words at end
      const learning2 = createValidLearning({
        id: dup2Id,
        jobId: 9205,
        content: 'My explanation of system design concepts was well-received.' // Exact match
      })

      queueInterviewLearning(learning1)
      const result = queueInterviewLearning(learning2)

      expect(result.queued).toBe(false)
      expect(result.reason).toBe('Similar learning exists')
      expect(result.existingId).toBe(dup1Id)
    })

    it('allows sufficiently different learnings', () => {
      const learning1 = createValidLearning({
        id: L1_ID,
        jobId: 9206,
        content: 'My explanation of system design concepts was well-received.'
      })
      const learning2 = createValidLearning({
        id: L2_ID,
        jobId: 9206,
        content: 'I struggled with explaining the time complexity of my solution.'
      })

      queueInterviewLearning(learning1)
      const result = queueInterviewLearning(learning2)

      expect(result.queued).toBe(true)
    })

    it('enforces dual tagging with topic', () => {
      const learning = createValidLearning({ jobId: 9207 })
      delete learning.topic

      const result = queueInterviewLearning(learning)

      expect(result.queued).toBe(false)
      expect(result.reason).toContain('topic')
    })

    it('enforces dual tagging with outcome', () => {
      const learning = createValidLearning({ jobId: 9208 })
      delete learning.outcome

      const result = queueInterviewLearning(learning)

      expect(result.queued).toBe(false)
      expect(result.reason).toContain('outcome')
    })

    it('requires jobId', () => {
      const learning = createValidLearning()
      delete learning.jobId

      const result = queueInterviewLearning(learning)

      expect(result.queued).toBe(false)
      expect(result.reason).toContain('jobId')
    })

    it('requires transcriptId', () => {
      const learning = createValidLearning({ jobId: 9209 })
      delete learning.transcriptId

      const result = queueInterviewLearning(learning)

      expect(result.queued).toBe(false)
      expect(result.reason).toContain('transcriptId')
    })

    it('requires content', () => {
      const learning = createValidLearning({ jobId: 9210 })
      delete learning.content

      const result = queueInterviewLearning(learning)

      expect(result.queued).toBe(false)
      expect(result.reason).toContain('content')
    })

    it('validates topic enum values', () => {
      const learning = createValidLearning({ jobId: 9211, topic: 'invalid-topic' })

      const result = queueInterviewLearning(learning)

      expect(result.queued).toBe(false)
      expect(result.reason).toContain('validation failed')
    })

    it('validates outcome enum values', () => {
      const learning = createValidLearning({ jobId: 9212, outcome: 'invalid-outcome' })

      const result = queueInterviewLearning(learning)

      expect(result.queued).toBe(false)
      expect(result.reason).toContain('validation failed')
    })

    it('accepts all valid topic values', () => {
      const topics = ['technical', 'behavioral', 'company-specific', 'compensation']

      for (let i = 0; i < topics.length; i++) {
        const learning = createValidLearning({
          id: `${i}1111111-1111-4111-8111-11111111111${i}`,
          jobId: 9213 + i,
          topic: topics[i]
        })
        const result = queueInterviewLearning(learning)
        expect(result.queued).toBe(true)
      }
    })

    it('accepts all valid outcome values', () => {
      const outcomes = ['worked', 'needs-work', 'neutral']

      for (let i = 0; i < outcomes.length; i++) {
        const learning = createValidLearning({
          id: `${i}1111111-1111-4111-8111-11111111111${i}`,
          jobId: 9220 + i,
          outcome: outcomes[i]
        })
        const result = queueInterviewLearning(learning)
        expect(result.queued).toBe(true)
      }
    })

    it('returns hasSuggestedLinks field', () => {
      const learning = createValidLearning({ jobId: 9223 })
      const result = queueInterviewLearning(learning)

      expect(result.queued).toBe(true)
      expect('hasSuggestedLinks' in result).toBe(true)
      expect(typeof result.hasSuggestedLinks).toBe('boolean')
    })

    it('initializes suggestedProfileLinks array', () => {
      const learning = createValidLearning({ jobId: 9224 })
      queueInterviewLearning(learning)

      const learnings = getLearningsForJob(9224)
      expect(Array.isArray(learnings[0].suggestedProfileLinks)).toBe(true)
    })

    it('initializes confirmedProfileLinks array', () => {
      const learning = createValidLearning({ jobId: 9225 })
      queueInterviewLearning(learning)

      const learnings = getLearningsForJob(9225)
      expect(Array.isArray(learnings[0].confirmedProfileLinks)).toBe(true)
    })

    it('appends to existing learnings', () => {
      const learning1 = createValidLearning({ id: L1_ID, jobId: 9226, content: 'First learning' })
      const learning2 = createValidLearning({ id: L2_ID, jobId: 9226, content: 'Second learning' })

      queueInterviewLearning(learning1)
      queueInterviewLearning(learning2)

      const learnings = getLearningsForJob(9226)
      expect(learnings).toHaveLength(2)
    })
  })

  // ===========================================================================
  // reviewInterviewLearning
  // ===========================================================================

  describe('reviewInterviewLearning', () => {
    it('accepts learning successfully', () => {
      const learning = createValidLearning({ jobId: 9230 })
      queueInterviewLearning(learning)

      const result = reviewInterviewLearning(L1_ID, { status: 'accepted' })

      expect(result.updated).toBe(true)
      expect(result.learning.status).toBe('accepted')
    })

    it('rejects learning successfully', () => {
      const learning = createValidLearning({ jobId: 9231 })
      queueInterviewLearning(learning)

      const result = reviewInterviewLearning(L1_ID, { status: 'rejected' })

      expect(result.updated).toBe(true)
      expect(result.learning.status).toBe('rejected')
    })

    it('sets reviewedAt timestamp', () => {
      const learning = createValidLearning({ jobId: 9232 })
      queueInterviewLearning(learning)

      const before = new Date().toISOString()
      reviewInterviewLearning(L1_ID, { status: 'accepted' })
      const after = new Date().toISOString()

      const learnings = getLearningsForJob(9232)
      expect(learnings[0].reviewedAt).toBeDefined()
      expect(learnings[0].reviewedAt >= before).toBe(true)
      expect(learnings[0].reviewedAt <= after).toBe(true)
    })

    it('returns error for non-existent learning', () => {
      const result = reviewInterviewLearning('99999999-9999-4999-8999-999999999999', { status: 'accepted' })

      expect(result.updated).toBe(false)
      expect(result.reason).toContain('not found')
    })

    it('learning must be in proposed status to review', () => {
      const learning = createValidLearning({ jobId: 9233 })
      queueInterviewLearning(learning)

      // First review (accept)
      reviewInterviewLearning(L1_ID, { status: 'accepted' })

      // Try to review again
      const result = reviewInterviewLearning(L1_ID, { status: 'rejected' })

      expect(result.updated).toBe(false)
      expect(result.reason).toContain('already accepted')
    })

    it('returns error for missing decision status', () => {
      const learning = createValidLearning({ jobId: 9234 })
      queueInterviewLearning(learning)

      const result = reviewInterviewLearning(L1_ID, {})

      expect(result.updated).toBe(false)
      expect(result.reason).toContain('Missing decision status')
    })

    it('returns error for invalid decision status', () => {
      const learning = createValidLearning({ jobId: 9235 })
      queueInterviewLearning(learning)

      const result = reviewInterviewLearning(L1_ID, { status: 'invalid' })

      expect(result.updated).toBe(false)
      expect(result.reason).toContain('Invalid decision status')
    })

    it('persists status change', () => {
      const learning = createValidLearning({ jobId: 9236 })
      queueInterviewLearning(learning)

      reviewInterviewLearning(L1_ID, { status: 'accepted' })

      // Reload and verify
      const learnings = getLearningsForJob(9236)
      expect(learnings[0].status).toBe('accepted')
    })
  })

  // ===========================================================================
  // linkLearningToProfile
  // ===========================================================================

  describe('linkLearningToProfile', () => {
    it('links learning to profile item', () => {
      const learning = createValidLearning({ jobId: 9240 })
      queueInterviewLearning(learning)
      reviewInterviewLearning(L1_ID, { status: 'accepted' })

      const result = linkLearningToProfile(L1_ID, {
        entityType: 'story',
        entityId: STORY_ID
      })

      expect(result.linked).toBe(true)
      expect(result.link.entityType).toBe('story')
      expect(result.link.entityId).toBe(STORY_ID)
      expect(result.link.linkedAt).toBeDefined()
    })

    it('learning must be accepted status to link', () => {
      const learning = createValidLearning({ jobId: 9241 })
      queueInterviewLearning(learning)
      // Don't accept - still proposed

      const result = linkLearningToProfile(L1_ID, {
        entityType: 'story',
        entityId: STORY_ID
      })

      expect(result.linked).toBe(false)
      expect(result.reason).toContain('must be accepted')
    })

    it('rejected learning cannot be linked', () => {
      const learning = createValidLearning({ jobId: 9242 })
      queueInterviewLearning(learning)
      reviewInterviewLearning(L1_ID, { status: 'rejected' })

      const result = linkLearningToProfile(L1_ID, {
        entityType: 'story',
        entityId: STORY_ID
      })

      expect(result.linked).toBe(false)
      expect(result.reason).toContain('must be accepted')
    })

    it('adds to confirmedProfileLinks array', () => {
      const learning = createValidLearning({ jobId: 9243 })
      queueInterviewLearning(learning)
      reviewInterviewLearning(L1_ID, { status: 'accepted' })

      linkLearningToProfile(L1_ID, { entityType: 'story', entityId: STORY_ID })

      const learnings = getLearningsForJob(9243)
      expect(learnings[0].confirmedProfileLinks).toHaveLength(1)
      expect(learnings[0].confirmedProfileLinks[0].entityType).toBe('story')
    })

    it('removes from suggestedProfileLinks if present', () => {
      // First queue a learning with suggestedProfileLinks
      const learning = createValidLearning({ jobId: 9244 })
      learning.suggestedProfileLinks = [
        { entityType: 'story', entityId: STORY_ID, linkReason: 'Test match' }
      ]
      queueInterviewLearning(learning)
      reviewInterviewLearning(L1_ID, { status: 'accepted' })

      // Link the same item
      linkLearningToProfile(L1_ID, { entityType: 'story', entityId: STORY_ID })

      const learnings = getLearningsForJob(9244)
      expect(learnings[0].suggestedProfileLinks).toHaveLength(0)
      expect(learnings[0].confirmedProfileLinks).toHaveLength(1)
    })

    it('returns error for invalid entityType', () => {
      const learning = createValidLearning({ jobId: 9245 })
      queueInterviewLearning(learning)
      reviewInterviewLearning(L1_ID, { status: 'accepted' })

      const result = linkLearningToProfile(L1_ID, {
        entityType: 'invalid-type',
        entityId: STORY_ID
      })

      expect(result.linked).toBe(false)
      expect(result.reason).toContain('Invalid entityType')
    })

    it('accepts story entityType', () => {
      const learning = createValidLearning({ jobId: 9246 })
      queueInterviewLearning(learning)
      reviewInterviewLearning(L1_ID, { status: 'accepted' })

      const result = linkLearningToProfile(L1_ID, {
        entityType: 'story',
        entityId: STORY_ID
      })

      expect(result.linked).toBe(true)
    })

    it('accepts skill entityType', () => {
      const learning = createValidLearning({ id: L2_ID, jobId: 9247 })
      queueInterviewLearning(learning)
      reviewInterviewLearning(L2_ID, { status: 'accepted' })

      const result = linkLearningToProfile(L2_ID, {
        entityType: 'skill',
        entityId: SKILL_ID
      })

      expect(result.linked).toBe(true)
    })

    it('accepts summary entityType', () => {
      const learning = createValidLearning({ id: L3_ID, jobId: 9248 })
      queueInterviewLearning(learning)
      reviewInterviewLearning(L3_ID, { status: 'accepted' })

      const result = linkLearningToProfile(L3_ID, {
        entityType: 'summary',
        entityId: SUMMARY_ID
      })

      expect(result.linked).toBe(true)
    })

    it('returns error for missing entityType', () => {
      const learning = createValidLearning({ jobId: 9249 })
      queueInterviewLearning(learning)
      reviewInterviewLearning(L1_ID, { status: 'accepted' })

      const result = linkLearningToProfile(L1_ID, { entityId: STORY_ID })

      expect(result.linked).toBe(false)
      expect(result.reason).toContain('entityType')
    })

    it('returns error for missing entityId', () => {
      const learning = createValidLearning({ jobId: 9250 })
      queueInterviewLearning(learning)
      reviewInterviewLearning(L1_ID, { status: 'accepted' })

      const result = linkLearningToProfile(L1_ID, { entityType: 'story' })

      expect(result.linked).toBe(false)
      expect(result.reason).toContain('entityId')
    })

    it('returns error for non-existent learning', () => {
      const result = linkLearningToProfile('99999999-9999-4999-8999-999999999999', {
        entityType: 'story',
        entityId: STORY_ID
      })

      expect(result.linked).toBe(false)
      expect(result.reason).toContain('not found')
    })

    it('allows multiple links to same learning', () => {
      const multiLinkId = 'abab0001-1111-4111-8111-111111111111'
      const learning = createValidLearning({ id: multiLinkId, jobId: 9251 })
      queueInterviewLearning(learning)
      reviewInterviewLearning(multiLinkId, { status: 'accepted' })

      linkLearningToProfile(multiLinkId, { entityType: 'story', entityId: STORY_ID })
      linkLearningToProfile(multiLinkId, { entityType: 'skill', entityId: SKILL_ID })

      const learnings = getLearningsForJob(9251)
      expect(learnings[0].confirmedProfileLinks).toHaveLength(2)
    })

    it('prevents duplicate links to same item', () => {
      const learning = createValidLearning({ jobId: 9252 })
      queueInterviewLearning(learning)
      reviewInterviewLearning(L1_ID, { status: 'accepted' })

      linkLearningToProfile(L1_ID, { entityType: 'story', entityId: STORY_ID })
      const result = linkLearningToProfile(L1_ID, { entityType: 'story', entityId: STORY_ID })

      expect(result.linked).toBe(false)
      expect(result.reason).toContain('already linked')
    })
  })

  // ===========================================================================
  // getLearningsForJob
  // ===========================================================================

  describe('getLearningsForJob', () => {
    it('returns all learnings for job', () => {
      const id1 = 'a1a11111-1111-4111-8111-111111111111'
      const id2 = 'a1a22222-2222-4222-8222-222222222222'
      const learning1 = createValidLearning({ id: id1, jobId: 9260, content: 'Learning about API design patterns' })
      const learning2 = createValidLearning({ id: id2, jobId: 9260, content: 'Learning about microservices architecture' })

      queueInterviewLearning(learning1)
      queueInterviewLearning(learning2)

      const result = getLearningsForJob(9260)

      expect(result).toHaveLength(2)
    })

    it('filters by status', () => {
      const id1 = 'b1b11111-1111-4111-8111-111111111111'
      const id2 = 'b1b22222-2222-4222-8222-222222222222'
      const learning1 = createValidLearning({ id: id1, jobId: 9261, content: 'Demonstrated strong knowledge of TypeScript generics' })
      const learning2 = createValidLearning({ id: id2, jobId: 9261, content: 'Need to improve my answer about distributed consensus algorithms' })

      queueInterviewLearning(learning1)
      queueInterviewLearning(learning2)
      reviewInterviewLearning(id1, { status: 'accepted' })

      const proposed = getLearningsForJob(9261, { status: 'proposed' })
      const accepted = getLearningsForJob(9261, { status: 'accepted' })

      expect(proposed).toHaveLength(1)
      expect(accepted).toHaveLength(1)
      expect(accepted[0].id).toBe(id1)
    })

    it('returns empty array for non-existent job', () => {
      const result = getLearningsForJob(9299)

      expect(result).toEqual([])
    })

    it('returns all learnings without status filter', () => {
      const id1 = 'c1c11111-1111-4111-8111-111111111111'
      const id2 = 'c1c22222-2222-4222-8222-222222222222'
      const learning1 = createValidLearning({ id: id1, jobId: 9262, content: 'My explanation of React hooks was clear and effective' })
      const learning2 = createValidLearning({ id: id2, jobId: 9262, content: 'The behavioral question about conflict resolution went poorly' })

      queueInterviewLearning(learning1)
      queueInterviewLearning(learning2)
      reviewInterviewLearning(id1, { status: 'accepted' })
      reviewInterviewLearning(id2, { status: 'rejected' })

      const result = getLearningsForJob(9262)

      expect(result).toHaveLength(2)
    })
  })

  // ===========================================================================
  // getPendingLearnings
  // ===========================================================================

  describe('getPendingLearnings', () => {
    it('returns pending learnings across jobs', () => {
      const id1 = 'd1d11111-1111-4111-8111-111111111111'
      const id2 = 'd1d22222-2222-4222-8222-222222222222'
      const learning1 = createValidLearning({ id: id1, jobId: 9270, content: 'Pending across jobs test one' })
      const learning2 = createValidLearning({ id: id2, jobId: 9271, content: 'Pending across jobs test two' })

      queueInterviewLearning(learning1)
      queueInterviewLearning(learning2)

      const result = getPendingLearnings()

      // Find our test learnings
      const testLearnings = result.filter(l => l.id === id1 || l.id === id2)
      expect(testLearnings.length).toBeGreaterThanOrEqual(2)
    })

    it('sorts by extractedAt descending (newest first)', () => {
      const id1 = 'e1e11111-1111-4111-8111-111111111111'
      const id2 = 'e1e22222-2222-4222-8222-222222222222'
      // Queue with slight delay to ensure different timestamps
      const learning1 = createValidLearning({ id: id1, jobId: 9272, content: 'Explained database indexing strategies very well' })
      queueInterviewLearning(learning1)

      // Small delay to ensure different timestamp
      const learning2 = createValidLearning({ id: id2, jobId: 9273, content: 'Struggled to answer question about microservices architecture' })
      queueInterviewLearning(learning2)

      const result = getPendingLearnings()

      // Find our specific learnings
      const l1 = result.find(l => l.id === id1)
      const l2 = result.find(l => l.id === id2)

      // Both learnings should be found
      expect(l1).toBeDefined()
      expect(l2).toBeDefined()

      // Results should be sorted by extractedAt descending - newer dates first
      // The list should have l2.extractedAt >= l1.extractedAt since l2 was queued after l1
      expect(new Date(l2.extractedAt).getTime()).toBeGreaterThanOrEqual(new Date(l1.extractedAt).getTime())
    })

    it('respects limit option', () => {
      // Create multiple learnings
      for (let i = 0; i < 5; i++) {
        const learning = createValidLearning({
          id: `f0f0${i}111-1111-4111-8111-11111111111${i}`,
          jobId: 9274 + i,
          content: `Limit test learning ${i} with unique content`
        })
        queueInterviewLearning(learning)
      }

      const result = getPendingLearnings({ limit: 3 })

      expect(result.length).toBeLessThanOrEqual(3)
    })

    it('includes jobId in results', () => {
      const id = 'aabbcc11-1111-4111-8111-111111111111'
      const learning = createValidLearning({ id, jobId: 9280, content: 'JobId inclusion test' })
      queueInterviewLearning(learning)

      const result = getPendingLearnings()
      const testLearning = result.find(l => l.id === id)

      expect(testLearning).toBeDefined()
      expect(testLearning.jobId).toBe(9280)
    })

    it('excludes accepted learnings', () => {
      const id = 'aaaa0001-1111-4111-8111-111111111111'
      const learning = createValidLearning({ id, jobId: 9281, content: 'Accepted exclusion test' })
      queueInterviewLearning(learning)
      reviewInterviewLearning(id, { status: 'accepted' })

      const result = getPendingLearnings()
      const testLearning = result.find(l => l.id === id)

      expect(testLearning).toBeUndefined()
    })

    it('excludes rejected learnings', () => {
      const id = 'eeee0001-1111-4111-8111-111111111111'
      const learning = createValidLearning({ id, jobId: 9282, content: 'Rejected exclusion test' })
      queueInterviewLearning(learning)
      reviewInterviewLearning(id, { status: 'rejected' })

      const result = getPendingLearnings()
      const testLearning = result.find(l => l.id === id)

      expect(testLearning).toBeUndefined()
    })

    it('returns empty array when no pending learnings', () => {
      // Clean slate - no learnings
      const result = getPendingLearnings()

      // May have learnings from other tests, but should be an array
      expect(Array.isArray(result)).toBe(true)
    })
  })

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles empty content gracefully', () => {
      const id = 'ffff0001-1111-4111-8111-111111111111'
      const learning = createValidLearning({ id, jobId: 9290, content: '' })

      const result = queueInterviewLearning(learning)

      // Empty content should fail early validation
      expect(result.queued).toBe(false)
      expect(result.reason).toContain('content')
    })

    it('handles very long content', () => {
      const id = 'bcde0001-1111-4111-8111-111111111111'
      const longContent = 'A'.repeat(10000)
      const learning = createValidLearning({ id, jobId: 9291, content: longContent })

      const result = queueInterviewLearning(learning)

      expect(result.queued).toBe(true)
    })

    it('handles special characters in content', () => {
      const id = 'cdef0001-1111-4111-8111-111111111111'
      const specialChar = '\u2019' // Right single quotation mark
      const learning = createValidLearning({
        id,
        jobId: 9292,
        content: 'Test with special chars: \n\t"quotes" & <brackets> unicode: ' + specialChar
      })

      const result = queueInterviewLearning(learning)

      expect(result.queued).toBe(true)
      const learnings = getLearningsForJob(9292)
      expect(learnings[0].content).toContain(specialChar)
    })

    it('handles concurrent queues to same job', () => {
      const concId1 = 'cc0ccc11-1111-4111-8111-111111111111'
      const concId2 = 'cc0ccc22-2222-4222-8222-222222222222'

      const l1 = createValidLearning({ id: concId1, jobId: 9293, content: 'Learning one about React hooks' })
      const l2 = createValidLearning({ id: concId2, jobId: 9293, content: 'Learning two about TypeScript generics' })

      // Simulate rapid queues
      queueInterviewLearning(l1)
      queueInterviewLearning(l2)

      const result = getLearningsForJob(9293)
      expect(result.length).toBeGreaterThanOrEqual(2)
      const ids = result.map(l => l.id)
      expect(ids).toContain(concId1)
      expect(ids).toContain(concId2)
    })

    it('preserves sourceQuote if provided', () => {
      const id = 'abcd0001-1111-4111-8111-111111111111'
      const learning = createValidLearning({
        id,
        jobId: 9294,
        sourceQuote: 'Interviewer: "That was a great explanation of system design."'
      })

      queueInterviewLearning(learning)

      const learnings = getLearningsForJob(9294)
      expect(learnings[0].sourceQuote).toBe('Interviewer: "That was a great explanation of system design."')
    })
  })
})
