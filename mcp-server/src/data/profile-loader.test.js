/**
 * Tests for Profile Loader
 *
 * Tests the profile loading, saving, and history tracking functions.
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
vi.mock('uuid', () => ({
  v4: vi.fn(() => '550e8400-e29b-41d4-a716-446655440000')
}))

// Import after mocking
import {
  createEmptyProfile,
  loadProfile,
  saveProfile,
  addHistoryEntry,
  getProfilePath
} from './profile-loader.js'

describe('createEmptyProfile', () => {
  it('returns a valid empty profile structure', () => {
    const profile = createEmptyProfile()

    expect(profile.metadata).toBeDefined()
    expect(profile.metadata.version).toBe(1)
    expect(profile.metadata.schemaVersion).toBe('1.0')
    expect(profile.metadata.createdAt).toBeDefined()
    expect(profile.metadata.updatedAt).toBeDefined()
  })

  it('has empty arrays for all collection fields', () => {
    const profile = createEmptyProfile()

    expect(profile.experience).toEqual([])
    expect(profile.skills).toEqual([])
    expect(profile.summaryBlocks).toEqual([])
    expect(profile.stories).toEqual([])
    expect(profile.history).toEqual([])
    expect(profile.preferences.targetRoles).toEqual([])
  })

  it('uses ISO timestamp format', () => {
    const profile = createEmptyProfile()

    // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
    expect(profile.metadata.createdAt).toMatch(isoRegex)
    expect(profile.metadata.updatedAt).toMatch(isoRegex)
  })
})

describe('loadProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates empty profile if none exists', () => {
    fs.existsSync.mockReturnValue(false)
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})

    const profile = loadProfile()

    expect(profile.metadata).toBeDefined()
    expect(profile.metadata.version).toBe(1)
    expect(profile.experience).toEqual([])
  })

  it('creates directory if it does not exist', () => {
    fs.existsSync.mockReturnValue(false)
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})

    loadProfile()

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true })
  })

  it('returns existing profile when present', () => {
    const existingProfile = {
      metadata: {
        version: 5,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
        schemaVersion: '1.0'
      },
      experience: [{ id: 'exp-1' }],
      skills: [],
      summaryBlocks: [],
      stories: [],
      preferences: { targetRoles: [] },
      history: []
    }

    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify(existingProfile))

    const profile = loadProfile()

    expect(profile.metadata.version).toBe(5)
    expect(profile.experience).toHaveLength(1)
  })

  it('validates and warns on invalid data', () => {
    const invalidProfile = {
      metadata: {
        version: -1, // Invalid
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
        schemaVersion: '2.0' // Invalid
      },
      experience: []
    }

    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify(invalidProfile))

    loadProfile()

    expect(console.error).toHaveBeenCalledWith(
      'Profile validation warnings:',
      expect.any(Array)
    )
  })

  it('handles JSON parse errors gracefully', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue('invalid json {{{')

    const profile = loadProfile()

    // Should return empty profile on parse error
    expect(profile.metadata).toBeDefined()
    expect(profile.metadata.version).toBe(1)
    expect(console.error).toHaveBeenCalled()
  })
})

describe('saveProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses atomic write (write to .tmp then rename)', () => {
    const profile = createEmptyProfile()
    fs.existsSync.mockReturnValue(true)
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})

    saveProfile(profile)

    // Should write to .tmp file first
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.tmp'),
      expect.any(String)
    )

    // Then rename to final path
    expect(fs.renameSync).toHaveBeenCalledWith(
      expect.stringContaining('.tmp'),
      expect.stringContaining('master-profile.json')
    )
  })

  it('returns success true on successful save', () => {
    const profile = createEmptyProfile()
    fs.existsSync.mockReturnValue(true)
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})

    const result = saveProfile(profile)

    expect(result.success).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it('warns but allows save in advisory mode for invalid data', () => {
    const invalidProfile = {
      metadata: {
        version: -1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
        schemaVersion: '2.0'
      }
    }

    fs.existsSync.mockReturnValue(true)
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})

    const result = saveProfile(invalidProfile)

    // Advisory mode: save succeeds even with validation errors
    expect(result.success).toBe(true)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('advisory mode'),
      expect.any(Array)
    )
  })

  it('returns success false on write error', () => {
    const profile = createEmptyProfile()
    fs.existsSync.mockReturnValue(true)
    fs.writeFileSync.mockImplementation(() => {
      throw new Error('Permission denied')
    })

    const result = saveProfile(profile)

    expect(result.success).toBe(false)
    expect(console.error).toHaveBeenCalled()
  })

  it('creates directory if needed', () => {
    const profile = createEmptyProfile()
    fs.existsSync.mockReturnValue(false)
    fs.mkdirSync.mockImplementation(() => {})
    fs.writeFileSync.mockImplementation(() => {})
    fs.renameSync.mockImplementation(() => {})

    saveProfile(profile)

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true })
  })
})

describe('addHistoryEntry', () => {
  it('creates valid history entry', () => {
    const profile = createEmptyProfile()

    const { entry, profile: updatedProfile } = addHistoryEntry(
      profile,
      'create',
      'skill',
      'skill-123',
      null,
      { name: 'React', proficiency: 'expert' },
      'Added React skill'
    )

    expect(entry.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(entry.action).toBe('create')
    expect(entry.entityType).toBe('skill')
    expect(entry.entityId).toBe('skill-123')
    expect(entry.previousValue).toBeNull()
    expect(entry.newValue).toEqual({ name: 'React', proficiency: 'expert' })
    expect(entry.reason).toBe('Added React skill')
    expect(entry.timestamp).toBeDefined()
  })

  it('does not mutate input profile', () => {
    const profile = createEmptyProfile()
    const originalHistoryLength = profile.history.length

    addHistoryEntry(
      profile,
      'create',
      'skill',
      'skill-123',
      null,
      { name: 'React' }
    )

    // Original profile should be unchanged
    expect(profile.history.length).toBe(originalHistoryLength)
  })

  it('returns new profile with history entry appended', () => {
    const profile = createEmptyProfile()

    const { profile: updatedProfile } = addHistoryEntry(
      profile,
      'update',
      'experience',
      'exp-456',
      { title: 'Junior Dev' },
      { title: 'Senior Dev' }
    )

    // Updated profile should have the new entry
    expect(updatedProfile.history.length).toBe(1)
    expect(updatedProfile.history[0].action).toBe('update')
    expect(updatedProfile.history[0].entityType).toBe('experience')
  })

  it('history entries are append-only', () => {
    const profile = createEmptyProfile()

    // Add first entry
    const { profile: profile1 } = addHistoryEntry(
      profile,
      'create',
      'skill',
      'skill-1',
      null,
      { name: 'TypeScript' }
    )

    // Add second entry
    const { profile: profile2 } = addHistoryEntry(
      profile1,
      'create',
      'skill',
      'skill-2',
      null,
      { name: 'Node.js' }
    )

    // Both entries should exist
    expect(profile2.history.length).toBe(2)
    expect(profile2.history[0].entityId).toBe('skill-1')
    expect(profile2.history[1].entityId).toBe('skill-2')
  })

  it('handles optional reason parameter', () => {
    const profile = createEmptyProfile()

    // Without reason
    const { entry: entryNoReason } = addHistoryEntry(
      profile,
      'delete',
      'story',
      'story-1',
      { title: 'Old Story' },
      null
    )

    expect(entryNoReason.reason).toBeUndefined()

    // With reason
    const { entry: entryWithReason } = addHistoryEntry(
      profile,
      'delete',
      'story',
      'story-2',
      { title: 'Old Story' },
      null,
      'Story was outdated'
    )

    expect(entryWithReason.reason).toBe('Story was outdated')
  })

  it('handles profiles with existing history', () => {
    const profile = {
      ...createEmptyProfile(),
      history: [
        {
          id: 'existing-entry',
          timestamp: '2026-01-01T00:00:00.000Z',
          action: 'create',
          entityType: 'skill',
          entityId: 'old-skill',
          previousValue: null,
          newValue: { name: 'CSS' }
        }
      ]
    }

    const { profile: updatedProfile } = addHistoryEntry(
      profile,
      'create',
      'skill',
      'new-skill',
      null,
      { name: 'JavaScript' }
    )

    expect(updatedProfile.history.length).toBe(2)
    expect(updatedProfile.history[0].entityId).toBe('old-skill')
    expect(updatedProfile.history[1].entityId).toBe('new-skill')
  })
})

describe('getProfilePath', () => {
  it('returns path to master-profile.json', () => {
    const path = getProfilePath()

    expect(path).toContain('master-profile.json')
    expect(path).toContain('mcp-server')
    expect(path).toContain('profile')
  })
})
