/**
 * Tests for Learning Queue
 *
 * Tests queue loading, saving, extraction queueing, and overlap detection.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  renameSync: vi.fn()
}))

// Mock uuid to return predictable values
let uuidCounter = 0
vi.mock('uuid', () => ({
  v4: vi.fn(() => `550e8400-e29b-41d4-a716-44665544000${uuidCounter++}`)
}))

// Mock profile-loader
vi.mock('./profile-loader.js', () => ({
  loadProfile: vi.fn()
}))

// Import after mocking
import {
  createEmptyQueue,
  loadLearningQueue,
  saveLearningQueue,
  queueExtraction,
  getOverlapCandidates,
  stringSimilarity,
  getQueuePath
} from './learning-queue.js'

import { loadProfile } from './profile-loader.js'

describe('stringSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(stringSimilarity('React', 'React')).toBe(1)
  })

  it('returns 1 for case-insensitive matches', () => {
    expect(stringSimilarity('React', 'react')).toBe(1)
    expect(stringSimilarity('JAVASCRIPT', 'javascript')).toBe(1)
  })

  it('returns 0.8 for substring matches', () => {
    expect(stringSimilarity('React', 'React.js')).toBe(0.8)
    expect(stringSimilarity('JavaScript', 'Script')).toBe(0.8)
  })

  it('returns 0 for empty strings', () => {
    expect(stringSimilarity('', 'React')).toBe(0)
    expect(stringSimilarity('React', '')).toBe(0)
    expect(stringSimilarity('', '')).toBe(0)
  })

  it('returns low similarity for very different strings', () => {
    const sim = stringSimilarity('React', 'Python')
    expect(sim).toBeLessThan(0.5)
  })

  it('returns moderate similarity for related strings', () => {
    const sim = stringSimilarity('JavaScript', 'TypeScript')
    expect(sim).toBeGreaterThan(0.5)
  })
})

describe('createEmptyQueue', () => {
  it('returns a valid empty queue structure', () => {
    const queue = createEmptyQueue()

    expect(queue.pending).toEqual([])
    expect(queue.history).toEqual([])
    expect(queue.lastProcessed).toBeNull()
  })
})

describe('loadLearningQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uuidCounter = 0
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates empty queue if none exists', () => {
    fs.existsSync.mockReturnValue(false)
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})

    const queue = loadLearningQueue()

    expect(queue.pending).toEqual([])
    expect(queue.history).toEqual([])
    expect(queue.lastProcessed).toBeNull()
  })

  it('creates data directory if it does not exist', () => {
    fs.existsSync.mockReturnValue(false)
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})

    loadLearningQueue()

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true })
  })

  it('returns existing queue when present', () => {
    const existingQueue = {
      pending: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          category: 'skill',
          content: 'React expertise',
          confidence: 'high',
          detectedAt: '2026-01-30T10:00:00.000Z',
          status: 'pending'
        }
      ],
      history: [],
      lastProcessed: '2026-01-30T10:00:00.000Z'
    }

    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify(existingQueue))

    const queue = loadLearningQueue()

    expect(queue.pending).toHaveLength(1)
    expect(queue.pending[0].content).toBe('React expertise')
  })

  it('handles JSON parse errors gracefully', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue('invalid json {{{')

    const queue = loadLearningQueue()

    // Should return empty queue on parse error
    expect(queue.pending).toEqual([])
    expect(console.error).toHaveBeenCalled()
  })
})

describe('saveLearningQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses atomic write (write to .tmp then rename)', () => {
    const queue = createEmptyQueue()
    fs.existsSync.mockReturnValue(true)
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})

    saveLearningQueue(queue)

    // Should write to .tmp file first
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.tmp'),
      expect.any(String)
    )

    // Then rename to final path
    expect(fs.renameSync).toHaveBeenCalledWith(
      expect.stringContaining('.tmp'),
      expect.stringContaining('learning-queue.json')
    )
  })

  it('returns success true on successful save', () => {
    const queue = createEmptyQueue()
    fs.existsSync.mockReturnValue(true)
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})

    const result = saveLearningQueue(queue)

    expect(result.success).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it('returns success false on write error', () => {
    const queue = createEmptyQueue()
    fs.existsSync.mockReturnValue(true)
    fs.writeFileSync.mockImplementation(() => {
      throw new Error('Permission denied')
    })

    const result = saveLearningQueue(queue)

    expect(result.success).toBe(false)
    expect(console.error).toHaveBeenCalled()
  })
})

describe('getOverlapCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Setup mock profile with skills, stories, etc
    vi.mocked(loadProfile).mockReturnValue({
      metadata: {
        version: 1,
        createdAt: '2026-01-30T10:00:00.000Z',
        updatedAt: '2026-01-30T10:00:00.000Z',
        schemaVersion: '1.0'
      },
      skills: [
        {
          id: '550e8400-e29b-41d4-a716-446655440010',
          name: 'React',
          category: 'Technical',
          subcategory: 'Frontend',
          proficiency: 'expert',
          source: 'explicit',
          confidence: 95,
          evidence: ['proj-1'],
          createdAt: '2026-01-30T10:00:00.000Z',
          updatedAt: '2026-01-30T10:00:00.000Z'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440011',
          name: 'TypeScript',
          category: 'Technical',
          subcategory: 'Languages',
          proficiency: 'proficient',
          source: 'explicit',
          confidence: 85,
          evidence: ['proj-1'],
          createdAt: '2026-01-30T10:00:00.000Z',
          updatedAt: '2026-01-30T10:00:00.000Z'
        }
      ],
      stories: [
        {
          id: '550e8400-e29b-41d4-a716-446655440020',
          title: 'Design System Migration',
          situation: 'Legacy component library was causing bugs.',
          task: 'Lead migration',
          action: 'Created plan',
          result: 'Completed in 6 months',
          questionCategories: ['leadership'],
          themes: [],
          variants: [],
          createdAt: '2026-01-30T10:00:00.000Z',
          updatedAt: '2026-01-30T10:00:00.000Z'
        }
      ],
      experience: [
        {
          id: '550e8400-e29b-41d4-a716-446655440030',
          role: {
            title: 'Senior Engineer',
            company: 'Tech Co',
            startDate: '2022-01-01',
            endDate: null
          },
          projects: [
            {
              id: '550e8400-e29b-41d4-a716-446655440031',
              name: 'API Platform',
              description: 'Built scalable REST API platform serving 10M requests daily',
              tags: ['technical'],
              skillRefs: [],
              createdAt: '2026-01-30T10:00:00.000Z',
              updatedAt: '2026-01-30T10:00:00.000Z'
            }
          ],
          version: 1,
          createdAt: '2026-01-30T10:00:00.000Z',
          updatedAt: '2026-01-30T10:00:00.000Z'
        }
      ],
      summaryBlocks: [],
      preferences: {
        targetRoles: [],
        communication: {
          tone: 'conversational',
          verbosity: 'balanced',
          emphasisAreas: ['impact-driven', 'collaborative'],
          avoidPhrases: []
        }
      },
      history: []
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('finds similar skills with high similarity', () => {
    const extraction = {
      category: 'skill',
      content: 'React'
    }

    const candidates = getOverlapCandidates(extraction)

    expect(candidates).toHaveLength(1)
    expect(candidates[0].profileItemId).toBe('550e8400-e29b-41d4-a716-446655440010')
    expect(candidates[0].similarity).toBe(1)
    expect(candidates[0].field).toBe('skills')
  })

  it('finds similar skills with partial match', () => {
    const extraction = {
      category: 'skill',
      content: 'React.js'
    }

    const candidates = getOverlapCandidates(extraction)

    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates[0].field).toBe('skills')
  })

  it('returns empty for skills with no match', () => {
    const extraction = {
      category: 'skill',
      content: 'Kubernetes'
    }

    const candidates = getOverlapCandidates(extraction)

    expect(candidates).toHaveLength(0)
  })

  it('finds similar stories by title', () => {
    const extraction = {
      category: 'story',
      content: 'Design System Migration'
    }

    const candidates = getOverlapCandidates(extraction)

    expect(candidates).toHaveLength(1)
    expect(candidates[0].profileItemId).toBe('550e8400-e29b-41d4-a716-446655440020')
  })

  it('finds similar achievements by project description', () => {
    const extraction = {
      category: 'achievement',
      content: 'Built scalable REST API platform'
    }

    const candidates = getOverlapCandidates(extraction)

    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates[0].profileItemId).toBe('550e8400-e29b-41d4-a716-446655440031')
  })

  it('finds similar preferences', () => {
    const extraction = {
      category: 'preference',
      content: 'impact-driven'
    }

    const candidates = getOverlapCandidates(extraction)

    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates[0].field).toBe('preferences.communication')
  })

  it('sorts candidates by similarity descending', () => {
    // Add another skill that's less similar
    vi.mocked(loadProfile).mockReturnValue({
      ...loadProfile(),
      skills: [
        {
          id: 'skill-1',
          name: 'React',
          category: 'Technical',
          subcategory: 'Frontend',
          proficiency: 'expert',
          source: 'explicit',
          confidence: 95,
          evidence: ['proj-1'],
          createdAt: '2026-01-30T10:00:00.000Z',
          updatedAt: '2026-01-30T10:00:00.000Z'
        },
        {
          id: 'skill-2',
          name: 'React Native',
          category: 'Technical',
          subcategory: 'Mobile',
          proficiency: 'proficient',
          source: 'explicit',
          confidence: 75,
          evidence: ['proj-2'],
          createdAt: '2026-01-30T10:00:00.000Z',
          updatedAt: '2026-01-30T10:00:00.000Z'
        }
      ]
    })

    const extraction = {
      category: 'skill',
      content: 'React'
    }

    const candidates = getOverlapCandidates(extraction)

    // Exact match should be first
    expect(candidates[0].profileItemId).toBe('skill-1')
    expect(candidates[0].similarity).toBe(1)
  })
})

describe('queueExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uuidCounter = 0
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Setup empty queue
    fs.existsSync.mockReturnValue(false)
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})

    // Setup empty profile
    vi.mocked(loadProfile).mockReturnValue({
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
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('queues extraction and returns result', () => {
    const extraction = {
      category: 'skill',
      content: 'GraphQL expertise',
      confidence: 'high'
    }

    const result = queueExtraction(extraction)

    expect(result.queued).toBe(true)
    expect(result.id).toBeDefined()
    expect(result.hasOverlap).toBe(false)
  })

  it('assigns UUID if not present', () => {
    const extraction = {
      category: 'skill',
      content: 'New skill',
      confidence: 'medium'
    }

    const result = queueExtraction(extraction)

    expect(result.id).toMatch(/^550e8400-e29b-41d4-a716-/)
  })

  it('uses provided UUID if present', () => {
    const extraction = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      category: 'skill',
      content: 'New skill',
      confidence: 'medium'
    }

    const result = queueExtraction(extraction)

    expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000')
  })

  it('detects overlap with existing profile data', () => {
    // Setup profile with matching skill
    vi.mocked(loadProfile).mockReturnValue({
      metadata: {
        version: 1,
        createdAt: '2026-01-30T10:00:00.000Z',
        updatedAt: '2026-01-30T10:00:00.000Z',
        schemaVersion: '1.0'
      },
      skills: [
        {
          id: 'existing-skill-id',
          name: 'React',
          category: 'Technical',
          subcategory: 'Frontend',
          proficiency: 'expert',
          source: 'explicit',
          confidence: 95,
          evidence: ['proj-1'],
          createdAt: '2026-01-30T10:00:00.000Z',
          updatedAt: '2026-01-30T10:00:00.000Z'
        }
      ],
      stories: [],
      experience: [],
      summaryBlocks: [],
      preferences: { targetRoles: [] },
      history: []
    })

    const extraction = {
      category: 'skill',
      content: 'React',
      confidence: 'high'
    }

    const result = queueExtraction(extraction)

    expect(result.hasOverlap).toBe(true)
    expect(result.overlapWith).toBe('existing-skill-id')
  })

  it('saves queue after adding extraction', () => {
    const extraction = {
      category: 'story',
      content: 'New story about leadership',
      confidence: 'medium'
    }

    queueExtraction(extraction)

    // Verify save was called (atomic write pattern)
    expect(fs.writeFileSync).toHaveBeenCalled()
    expect(fs.renameSync).toHaveBeenCalled()
  })
})

describe('getQueuePath', () => {
  it('returns path to learning-queue.json', () => {
    const path = getQueuePath()

    expect(path).toContain('learning-queue.json')
    expect(path).toContain('mcp-server')
    expect(path).toContain('data')
  })
})
