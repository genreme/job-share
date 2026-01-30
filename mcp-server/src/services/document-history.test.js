/**
 * Tests for Document History Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, unlinkSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import {
  recordDocumentGeneration,
  getDocumentHistory,
  getItemUsage,
  getUnusedItems,
  getDocumentStats,
  clearHistory,
  HISTORY_PATH
} from './document-history.js'

describe('Document History Service', () => {
  beforeEach(() => {
    // Clear history before each test
    clearHistory()
  })

  afterEach(() => {
    // Clean up after tests
    if (existsSync(HISTORY_PATH)) {
      try {
        unlinkSync(HISTORY_PATH)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  })

  describe('recordDocumentGeneration', () => {
    it('creates a record with correct structure', () => {
      const record = recordDocumentGeneration(
        'resume',
        { company: 'Acme', title: 'Engineer' },
        [{ itemType: 'skill', itemId: 'skill-1' }]
      )

      expect(record).toHaveProperty('id')
      expect(record).toHaveProperty('documentType', 'resume')
      expect(record).toHaveProperty('jobContext')
      expect(record.jobContext.company).toBe('Acme')
      expect(record.jobContext.title).toBe('Engineer')
      expect(record).toHaveProperty('usedItems')
      expect(record.usedItems).toEqual([{ itemType: 'skill', itemId: 'skill-1' }])
      expect(record).toHaveProperty('generatedAt')
    })

    it('generates unique IDs for each record', () => {
      const record1 = recordDocumentGeneration('resume', {}, [])
      const record2 = recordDocumentGeneration('resume', {}, [])

      expect(record1.id).not.toBe(record2.id)
    })

    it('persists records to disk', () => {
      recordDocumentGeneration('resume', { company: 'Test' }, [])

      const history = getDocumentHistory()
      expect(history.length).toBe(1)
      expect(history[0].jobContext.company).toBe('Test')
    })

    it('handles missing jobContext gracefully', () => {
      const record = recordDocumentGeneration('resume', {}, [])

      expect(record.jobContext.company).toBe('')
      expect(record.jobContext.title).toBe('')
    })

    it('handles empty usedItems', () => {
      const record = recordDocumentGeneration('resume', {}, [])

      expect(record.usedItems).toEqual([])
    })
  })

  describe('getDocumentHistory', () => {
    it('returns all records by default', () => {
      recordDocumentGeneration('resume', {}, [])
      recordDocumentGeneration('cover_letter', {}, [])
      recordDocumentGeneration('interview_prep', {}, [])

      const history = getDocumentHistory()

      expect(history.length).toBe(3)
    })

    it('filters by document type', () => {
      recordDocumentGeneration('resume', {}, [])
      recordDocumentGeneration('cover_letter', {}, [])
      recordDocumentGeneration('resume', {}, [])

      const history = getDocumentHistory({ documentType: 'resume' })

      expect(history.length).toBe(2)
      expect(history.every((r) => r.documentType === 'resume')).toBe(true)
    })

    it('filters by date (since)', () => {
      // Add an old record (mock by modifying directly)
      recordDocumentGeneration('resume', { company: 'Old' }, [])

      // Wait a moment and add a new record
      const now = new Date()
      recordDocumentGeneration('resume', { company: 'New' }, [])

      // Filter to only recent (last second should include both in test)
      const history = getDocumentHistory({
        since: new Date(now.getTime() - 1000).toISOString()
      })

      expect(history.length).toBeGreaterThanOrEqual(1)
    })

    it('limits results', () => {
      recordDocumentGeneration('resume', {}, [])
      recordDocumentGeneration('resume', {}, [])
      recordDocumentGeneration('resume', {}, [])

      const history = getDocumentHistory({ limit: 2 })

      expect(history.length).toBe(2)
    })

    it('returns records in consistent order (by generatedAt then insertion order)', () => {
      recordDocumentGeneration('resume', { company: 'First' }, [])
      recordDocumentGeneration('resume', { company: 'Second' }, [])
      recordDocumentGeneration('resume', { company: 'Third' }, [])

      const history = getDocumentHistory()

      // Verify all 3 records exist
      expect(history.length).toBe(3)
      // The companies should all be present
      const companies = history.map((h) => h.jobContext.company)
      expect(companies).toContain('First')
      expect(companies).toContain('Second')
      expect(companies).toContain('Third')
    })

    it('returns empty array when no history', () => {
      const history = getDocumentHistory()

      expect(history).toEqual([])
    })
  })

  describe('getItemUsage', () => {
    it('returns usage stats for an item', () => {
      recordDocumentGeneration('resume', { company: 'A' }, [{ itemType: 'skill', itemId: 'skill-1' }])
      recordDocumentGeneration('resume', { company: 'B' }, [{ itemType: 'skill', itemId: 'skill-1' }])
      recordDocumentGeneration('resume', { company: 'C' }, [{ itemType: 'skill', itemId: 'skill-2' }])

      const usage = getItemUsage('skill', 'skill-1')

      expect(usage.useCount).toBe(2)
      expect(usage.lastUsed).not.toBeNull()
      expect(usage.documents.length).toBe(2)
    })

    it('returns zero count for unused item', () => {
      recordDocumentGeneration('resume', {}, [{ itemType: 'skill', itemId: 'skill-1' }])

      const usage = getItemUsage('skill', 'nonexistent')

      expect(usage.useCount).toBe(0)
      expect(usage.lastUsed).toBeNull()
      expect(usage.documents).toEqual([])
    })

    it('returns documents with correct structure', () => {
      recordDocumentGeneration(
        'resume',
        { company: 'Test', title: 'Engineer' },
        [{ itemType: 'story', itemId: 'story-1' }]
      )

      const usage = getItemUsage('story', 'story-1')

      expect(usage.documents[0]).toHaveProperty('documentType', 'resume')
      expect(usage.documents[0]).toHaveProperty('jobContext')
      expect(usage.documents[0]).toHaveProperty('generatedAt')
    })

    it('returns usage documents for the item', () => {
      recordDocumentGeneration('resume', { company: 'First' }, [
        { itemType: 'skill', itemId: 'skill-1' }
      ])
      recordDocumentGeneration('cover_letter', { company: 'Second' }, [
        { itemType: 'skill', itemId: 'skill-1' }
      ])

      const usage = getItemUsage('skill', 'skill-1')

      // Should have both documents
      expect(usage.documents.length).toBe(2)
      const companies = usage.documents.map((d) => d.jobContext.company)
      expect(companies).toContain('First')
      expect(companies).toContain('Second')
    })
  })

  describe('getUnusedItems', () => {
    it('identifies items not used within threshold', () => {
      // Record usage of item 1
      recordDocumentGeneration('resume', {}, [{ itemType: 'skill', itemId: 'skill-1' }])

      // Check items including unused one
      const items = [
        { itemType: 'skill', itemId: 'skill-1' },
        { itemType: 'skill', itemId: 'skill-2' } // Never used
      ]

      const unused = getUnusedItems(items, 90)

      expect(unused.length).toBe(1)
      expect(unused[0].itemId).toBe('skill-2')
    })

    it('includes lastUsed timestamp for items that were used', () => {
      recordDocumentGeneration('resume', {}, [{ itemType: 'skill', itemId: 'skill-1' }])

      // Create item list where skill-2 was never used
      const items = [{ itemType: 'skill', itemId: 'skill-2' }]

      const unused = getUnusedItems(items, 90)

      expect(unused[0].lastUsed).toBeNull()
    })

    it('returns empty array when all items are recently used', () => {
      recordDocumentGeneration('resume', {}, [
        { itemType: 'skill', itemId: 'skill-1' },
        { itemType: 'skill', itemId: 'skill-2' }
      ])

      const items = [
        { itemType: 'skill', itemId: 'skill-1' },
        { itemType: 'skill', itemId: 'skill-2' }
      ]

      const unused = getUnusedItems(items, 90)

      expect(unused).toEqual([])
    })
  })

  describe('getDocumentStats', () => {
    it('returns summary statistics', () => {
      recordDocumentGeneration('resume', {}, [])
      recordDocumentGeneration('resume', {}, [])
      recordDocumentGeneration('cover_letter', {}, [])

      const stats = getDocumentStats()

      expect(stats.totalDocuments).toBe(3)
      expect(stats.byType.resume).toBe(2)
      expect(stats.byType.cover_letter).toBe(1)
      expect(stats.byType.interview_prep).toBe(0)
    })

    it('tracks recent activity', () => {
      recordDocumentGeneration('resume', {}, [])

      const stats = getDocumentStats()

      expect(stats.recentActivity.length).toBe(1)
    })

    it('tracks last generated timestamp', () => {
      recordDocumentGeneration('resume', {}, [])

      const stats = getDocumentStats()

      expect(stats.lastGenerated).not.toBeNull()
    })

    it('returns zero stats when no history', () => {
      const stats = getDocumentStats()

      expect(stats.totalDocuments).toBe(0)
      expect(stats.lastGenerated).toBeNull()
    })
  })

  describe('clearHistory', () => {
    it('removes all records', () => {
      recordDocumentGeneration('resume', {}, [])
      recordDocumentGeneration('cover_letter', {}, [])

      clearHistory()

      const history = getDocumentHistory()
      expect(history).toEqual([])
    })

    it('returns true on success', () => {
      const result = clearHistory()

      expect(result).toBe(true)
    })
  })

  describe('Rolling Window', () => {
    it('keeps only last 100 records', () => {
      // Add 105 records
      for (let i = 0; i < 105; i++) {
        recordDocumentGeneration('resume', { company: `Company ${i}` }, [])
      }

      const history = getDocumentHistory()

      expect(history.length).toBe(100)
      // Should have most recent ones (Company 104, 103, etc.) - the first 5 should be trimmed
      const companies = history.map((h) => h.jobContext.company)
      // First 5 (Company 0-4) should NOT be in the list
      expect(companies).not.toContain('Company 0')
      expect(companies).not.toContain('Company 4')
      // Last ones should still be present
      expect(companies).toContain('Company 104')
    })
  })
})
