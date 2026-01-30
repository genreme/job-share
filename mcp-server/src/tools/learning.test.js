/**
 * Learning Tools Tests
 *
 * Tests MCP tool implementations for profile learning workflow.
 * Uses mocking to isolate tests from file system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock uuid
let uuidCounter = 0
vi.mock('uuid', () => ({
  v4: vi.fn(() => `550e8400-e29b-41d4-a716-44665544000${uuidCounter++}`)
}))

// Mock learning-queue module
vi.mock('../data/learning-queue.js', () => ({
  loadLearningQueue: vi.fn(),
  saveLearningQueue: vi.fn(),
  queueExtraction: vi.fn(),
  getOverlapCandidates: vi.fn()
}))

// Mock profile-loader module
vi.mock('../data/profile-loader.js', () => ({
  loadProfile: vi.fn(),
  saveProfile: vi.fn()
}))

// Mock extraction-mapper module
vi.mock('../services/extraction-mapper.js', () => ({
  addExtractionToProfile: vi.fn(),
  mergeWithExisting: vi.fn()
}))

// Import tools under test
import {
  queueProfileExtraction,
  getPendingExtractions,
  confirmExtraction,
  batchConfirmExtractions,
  getExtractionHistory
} from './learning.js'

// Import mocked modules
import {
  loadLearningQueue,
  saveLearningQueue,
  queueExtraction,
  getOverlapCandidates
} from '../data/learning-queue.js'
import { loadProfile, saveProfile } from '../data/profile-loader.js'
import { addExtractionToProfile, mergeWithExisting } from '../services/extraction-mapper.js'

// Test fixtures - functions to create fresh copies each time
function createTestQueue() {
  return {
    pending: [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        category: 'skill',
        content: 'TypeScript expertise',
        confidence: 'high',
        detectedAt: '2026-01-30T10:00:00.000Z',
        status: 'pending'
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        category: 'achievement',
        content: 'Led team of 10',
        confidence: 'medium',
        detectedAt: '2026-01-30T11:00:00.000Z',
        status: 'pending'
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        category: 'pattern',
        content: 'Works well under pressure',
        confidence: 'low',
        detectedAt: '2026-01-30T12:00:00.000Z',
        status: 'pending'
      }
    ],
    history: [
      {
        id: '550e8400-e29b-41d4-a716-446655440010',
        category: 'skill',
        content: 'React',
        confidence: 'high',
        detectedAt: '2026-01-29T10:00:00.000Z',
        status: 'confirmed'
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440011',
        category: 'preference',
        content: 'Remote work',
        confidence: 'medium',
        detectedAt: '2026-01-29T11:00:00.000Z',
        status: 'rejected'
      }
    ],
    lastProcessed: '2026-01-29T11:00:00.000Z'
  }
}

function createTestProfile() {
  return {
    metadata: {
      version: 1,
      createdAt: '2026-01-30T10:00:00.000Z',
      updatedAt: '2026-01-30T10:00:00.000Z',
      schemaVersion: '1.0'
    },
    skills: [],
    stories: [],
    experience: [],
    summaryBlocks: [],
    preferences: { targetRoles: [] },
    history: []
  }
}

describe('queueProfileExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uuidCounter = 0
  })

  it('queues extraction and returns result', () => {
    vi.mocked(queueExtraction).mockReturnValue({
      queued: true,
      id: '550e8400-e29b-41d4-a716-446655440000',
      hasOverlap: false
    })

    const result = queueProfileExtraction({
      category: 'skill',
      content: 'GraphQL expertise',
      confidence: 'high'
    })

    expect(result.queued).toBe(true)
    expect(result.id).toBeDefined()
    expect(result.suggestion).toBe('confirm_inline')
    expect(queueExtraction).toHaveBeenCalled()
  })

  it('returns confirm_inline suggestion for high confidence', () => {
    vi.mocked(queueExtraction).mockReturnValue({
      queued: true,
      id: 'test-id',
      hasOverlap: false
    })

    const result = queueProfileExtraction({
      category: 'skill',
      content: 'Test',
      confidence: 'high'
    })

    expect(result.suggestion).toBe('confirm_inline')
  })

  it('returns review_soon suggestion for medium confidence', () => {
    vi.mocked(queueExtraction).mockReturnValue({
      queued: true,
      id: 'test-id',
      hasOverlap: false
    })

    const result = queueProfileExtraction({
      category: 'skill',
      content: 'Test',
      confidence: 'medium'
    })

    expect(result.suggestion).toBe('review_soon')
  })

  it('returns batch suggestion for low confidence', () => {
    vi.mocked(queueExtraction).mockReturnValue({
      queued: true,
      id: 'test-id',
      hasOverlap: false
    })

    const result = queueProfileExtraction({
      category: 'skill',
      content: 'Test',
      confidence: 'low'
    })

    expect(result.suggestion).toBe('batch')
  })

  it('includes hasOverlap in result', () => {
    vi.mocked(queueExtraction).mockReturnValue({
      queued: true,
      id: 'test-id',
      hasOverlap: true,
      overlapWith: 'existing-skill-id'
    })

    const result = queueProfileExtraction({
      category: 'skill',
      content: 'React',
      confidence: 'high'
    })

    expect(result.hasOverlap).toBe(true)
    expect(result.overlapWith).toBe('existing-skill-id')
  })

  it('returns error for missing parameters', () => {
    const result = queueProfileExtraction({
      category: 'skill'
      // missing content and confidence
    })

    expect(result.error).toContain('required')
  })

  it('returns error for invalid category', () => {
    const result = queueProfileExtraction({
      category: 'invalid',
      content: 'Test',
      confidence: 'high'
    })

    expect(result.error).toContain('category must be')
  })

  it('returns error for invalid confidence', () => {
    const result = queueProfileExtraction({
      category: 'skill',
      content: 'Test',
      confidence: 'invalid'
    })

    expect(result.error).toContain('confidence must be')
  })
})

describe('getPendingExtractions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadLearningQueue).mockReturnValue(createTestQueue())
    vi.mocked(getOverlapCandidates).mockReturnValue([])
  })

  it('returns all pending extractions', () => {
    const result = getPendingExtractions({})

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(3)
  })

  it('sorts by confidence (high first)', () => {
    const result = getPendingExtractions({})

    expect(result[0].confidence).toBe('high')
    expect(result[1].confidence).toBe('medium')
    expect(result[2].confidence).toBe('low')
  })

  it('filters by category', () => {
    const result = getPendingExtractions({ filter: { category: 'skill' } })

    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('skill')
  })

  it('filters by confidence', () => {
    const result = getPendingExtractions({ filter: { confidence: 'medium' } })

    expect(result).toHaveLength(1)
    expect(result[0].confidence).toBe('medium')
  })

  it('applies limit', () => {
    const result = getPendingExtractions({ limit: 2 })

    expect(result).toHaveLength(2)
  })

  it('includes overlap info for each extraction', () => {
    vi.mocked(getOverlapCandidates).mockReturnValue([
      { profileItemId: 'skill-1', similarity: 0.9, field: 'skills' }
    ])

    const result = getPendingExtractions({})

    expect(result[0].overlaps).toBeDefined()
    expect(result[0].overlaps).toHaveLength(1)
  })
})

describe('confirmExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadLearningQueue).mockReturnValue(createTestQueue())
    vi.mocked(loadProfile).mockReturnValue(createTestProfile())
    vi.mocked(addExtractionToProfile).mockImplementation((profile) => profile)
    vi.mocked(mergeWithExisting).mockImplementation((profile) => profile)
  })

  it('confirms extraction and adds to profile', () => {
    const result = confirmExtraction({
      extractionId: '550e8400-e29b-41d4-a716-446655440001',
      action: 'confirm'
    })

    expect(result.success).toBe(true)
    expect(result.profileUpdated).toBe(true)
    expect(result.extraction.status).toBe('confirmed')
    expect(saveProfile).toHaveBeenCalled()
    expect(saveLearningQueue).toHaveBeenCalled()
  })

  it('rejects extraction without updating profile', () => {
    const result = confirmExtraction({
      extractionId: '550e8400-e29b-41d4-a716-446655440001',
      action: 'reject'
    })

    expect(result.success).toBe(true)
    expect(result.profileUpdated).toBe(false)
    expect(result.extraction.status).toBe('rejected')
    expect(saveProfile).not.toHaveBeenCalled()
    expect(saveLearningQueue).toHaveBeenCalled()
  })

  it('merges extraction with existing profile item', () => {
    const result = confirmExtraction({
      extractionId: '550e8400-e29b-41d4-a716-446655440001',
      action: 'merge',
      mergeWith: 'existing-skill-id'
    })

    expect(result.success).toBe(true)
    expect(result.profileUpdated).toBe(true)
    expect(result.extraction.status).toBe('merged')
    expect(mergeWithExisting).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'existing-skill-id'
    )
  })

  it('moves extraction from pending to history', () => {
    let savedQueue = null
    vi.mocked(saveLearningQueue).mockImplementation((q) => {
      savedQueue = q
    })

    confirmExtraction({
      extractionId: '550e8400-e29b-41d4-a716-446655440001',
      action: 'confirm'
    })

    expect(savedQueue).not.toBeNull()
    expect(savedQueue.pending.find((e) => e.id === '550e8400-e29b-41d4-a716-446655440001')).toBeUndefined()
    expect(savedQueue.history.find((e) => e.id === '550e8400-e29b-41d4-a716-446655440001')).toBeDefined()
  })

  it('returns error for missing parameters', () => {
    const result = confirmExtraction({})

    expect(result.error).toContain('required')
  })

  it('returns error for invalid action', () => {
    const result = confirmExtraction({
      extractionId: 'test-id',
      action: 'invalid'
    })

    expect(result.error).toContain('action must be')
  })

  it('returns error for merge without mergeWith', () => {
    const result = confirmExtraction({
      extractionId: 'test-id',
      action: 'merge'
      // missing mergeWith
    })

    expect(result.error).toContain('mergeWith is required')
  })

  it('returns error for non-existent extraction', () => {
    const result = confirmExtraction({
      extractionId: 'non-existent-id',
      action: 'confirm'
    })

    expect(result.error).toContain('not found')
  })
})

describe('batchConfirmExtractions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadLearningQueue).mockReturnValue(createTestQueue())
    vi.mocked(loadProfile).mockReturnValue(createTestProfile())
    vi.mocked(addExtractionToProfile).mockImplementation((profile) => profile)
  })

  it('processes multiple extractions', () => {
    const result = batchConfirmExtractions({
      extractionIds: [
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002'
      ],
      action: 'confirm'
    })

    expect(result.processed).toBe(2)
    expect(result.failed).toHaveLength(0)
    expect(result.profileUpdated).toBe(true)
  })

  it('handles partial failures', () => {
    const result = batchConfirmExtractions({
      extractionIds: [
        '550e8400-e29b-41d4-a716-446655440001',
        'non-existent-id'
      ],
      action: 'confirm'
    })

    expect(result.processed).toBe(1)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].id).toBe('non-existent-id')
  })

  it('returns error for missing extractionIds', () => {
    const result = batchConfirmExtractions({
      action: 'confirm'
    })

    expect(result.error).toContain('non-empty array')
  })

  it('returns error for empty extractionIds', () => {
    const result = batchConfirmExtractions({
      extractionIds: [],
      action: 'confirm'
    })

    expect(result.error).toContain('non-empty array')
  })

  it('returns error for invalid action', () => {
    const result = batchConfirmExtractions({
      extractionIds: ['id-1'],
      action: 'invalid'
    })

    expect(result.error).toContain('action must be')
  })
})

describe('getExtractionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadLearningQueue).mockReturnValue(createTestQueue())
  })

  it('returns all history entries', () => {
    const result = getExtractionHistory({})

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(2)
  })

  it('filters by status', () => {
    const confirmed = getExtractionHistory({ status: 'confirmed' })
    expect(confirmed).toHaveLength(1)
    expect(confirmed[0].status).toBe('confirmed')

    const rejected = getExtractionHistory({ status: 'rejected' })
    expect(rejected).toHaveLength(1)
    expect(rejected[0].status).toBe('rejected')
  })

  it('applies limit', () => {
    const result = getExtractionHistory({ limit: 1 })

    expect(result).toHaveLength(1)
  })

  it('sorts by most recent first', () => {
    const result = getExtractionHistory({})

    // 2026-01-29T11:00 should come before 2026-01-29T10:00
    expect(new Date(result[0].detectedAt) >= new Date(result[1].detectedAt)).toBe(true)
  })
})
