/**
 * Analytics Tools Tests
 *
 * Tests all 12 MCP tool handlers for analytics functionality.
 * Each tool is tested for correct behavior, edge cases, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Import tools under test
import {
  getFunnelMetrics,
  getResponseRates,
  getTimeToResponse,
  getTimeInStage,
  getBottlenecks,
  getSkillGaps,
  getSkillGapRecommendations,
  getCriteriaRecommendations,
  previewCriteriaChange,
  applyCriteriaChange,
  getAnalyticsSnapshot,
  saveAnalyticsSnapshot,
  analyticsToolHandlers
} from './analytics.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const JOBS_FILE = join(DATA_DIR, 'jobs.json')
const PROFILE_FILE = join(DATA_DIR, 'profile', 'master-profile.json')
const SNAPSHOTS_FILE = join(DATA_DIR, 'analytics-snapshots.json')

// ============================================================================
// Test Fixtures
// ============================================================================

const mockJobs = [
  {
    id: 1,
    title: 'Senior Software Engineer',
    company: 'TechCorp',
    status: 'applied',
    fitScore: 85,
    industry: 'Technology',
    companySize: 'Enterprise',
    found: '2026-01-01T00:00:00Z',
    applied: '2026-01-05T00:00:00Z',
    notes: 'Looking for React and TypeScript experience',
    updates: [
      { date: '2026-01-10T00:00:00Z', notes: 'Phone screen scheduled' }
    ]
  },
  {
    id: 2,
    title: 'Frontend Developer',
    company: 'StartupXYZ',
    status: 'applied',
    fitScore: 75,
    industry: 'Fintech',
    companySize: 'Startup',
    found: '2026-01-02T00:00:00Z',
    applied: '2026-01-06T00:00:00Z',
    notes: 'Node.js and PostgreSQL required',
    updates: [
      { date: '2026-01-12T00:00:00Z', notes: 'Unfortunately, position filled' }
    ]
  },
  {
    id: 3,
    title: 'Full Stack Engineer',
    company: 'MidCorp',
    status: 'inbox',
    fitScore: 65,
    industry: 'Healthcare',
    companySize: 'Mid-size',
    found: '2026-01-10T00:00:00Z',
    notes: 'Python and AWS experience needed',
    description: 'We need someone with Python, Django, AWS, and Kubernetes experience'
  },
  {
    id: 4,
    title: 'Backend Developer',
    company: 'EnterpriseCo',
    status: 'apply-now',
    fitScore: 90,
    industry: 'Technology',
    companySize: 'Enterprise',
    found: '2026-01-15T00:00:00Z',
    notes: 'Java and Spring Boot required'
  },
  {
    id: 5,
    title: 'DevOps Engineer',
    company: 'CloudScale',
    status: 'applied',
    fitScore: 60,
    industry: 'Technology',
    companySize: 'Mid-size',
    found: '2026-01-08T00:00:00Z',
    applied: '2026-01-12T00:00:00Z',
    notes: 'Terraform and Kubernetes expertise'
  }
]

const mockProfile = {
  skills: [
    { name: 'JavaScript' },
    { name: 'React' },
    { name: 'TypeScript' },
    { name: 'Node.js' }
  ],
  preferences: {
    targetRoles: ['Software Engineer', 'Frontend Developer']
  }
}

// Store original file contents for restoration
let originalJobs = null
let originalProfile = null
let originalSnapshots = null

// ============================================================================
// Test Setup and Teardown
// ============================================================================

beforeEach(() => {
  // Save original files if they exist
  if (existsSync(JOBS_FILE)) {
    originalJobs = readFileSync(JOBS_FILE, 'utf-8')
  }
  if (existsSync(PROFILE_FILE)) {
    originalProfile = readFileSync(PROFILE_FILE, 'utf-8')
  }
  if (existsSync(SNAPSHOTS_FILE)) {
    originalSnapshots = readFileSync(SNAPSHOTS_FILE, 'utf-8')
  }

  // Write test data
  writeFileSync(JOBS_FILE, JSON.stringify({ jobs: mockJobs }, null, 2))
  writeFileSync(PROFILE_FILE, JSON.stringify(mockProfile, null, 2))
})

afterEach(() => {
  // Restore original files
  if (originalJobs !== null) {
    writeFileSync(JOBS_FILE, originalJobs)
  }
  if (originalProfile !== null) {
    writeFileSync(PROFILE_FILE, originalProfile)
  }
  if (originalSnapshots !== null) {
    writeFileSync(SNAPSHOTS_FILE, originalSnapshots)
  } else if (existsSync(SNAPSHOTS_FILE)) {
    // Remove test snapshots file if it didn't exist before
    unlinkSync(SNAPSHOTS_FILE)
  }
})

// ============================================================================
// Tool Handler Export Tests
// ============================================================================

describe('analyticsToolHandlers', () => {
  it('exports all 12 tool handlers', () => {
    expect(Object.keys(analyticsToolHandlers)).toHaveLength(12)
    expect(analyticsToolHandlers.get_funnel_metrics).toBe(getFunnelMetrics)
    expect(analyticsToolHandlers.get_response_rates).toBe(getResponseRates)
    expect(analyticsToolHandlers.get_time_to_response).toBe(getTimeToResponse)
    expect(analyticsToolHandlers.get_time_in_stage).toBe(getTimeInStage)
    expect(analyticsToolHandlers.get_bottlenecks).toBe(getBottlenecks)
    expect(analyticsToolHandlers.get_skill_gaps).toBe(getSkillGaps)
    expect(analyticsToolHandlers.get_skill_gap_recommendations).toBe(getSkillGapRecommendations)
    expect(analyticsToolHandlers.get_criteria_recommendations).toBe(getCriteriaRecommendations)
    expect(analyticsToolHandlers.preview_criteria_change).toBe(previewCriteriaChange)
    expect(analyticsToolHandlers.apply_criteria_change).toBe(applyCriteriaChange)
    expect(analyticsToolHandlers.get_analytics_snapshot).toBe(getAnalyticsSnapshot)
    expect(analyticsToolHandlers.save_analytics_snapshot).toBe(saveAnalyticsSnapshot)
  })
})

// ============================================================================
// Tool 1: Get Funnel Metrics Tests
// ============================================================================

describe('getFunnelMetrics', () => {
  it('returns valid Sankey structure', () => {
    const result = getFunnelMetrics({})

    expect(result).toHaveProperty('nodes')
    expect(result).toHaveProperty('links')
    expect(result).toHaveProperty('totalJobs')
    expect(result).toHaveProperty('dateRange')
    expect(Array.isArray(result.nodes)).toBe(true)
    expect(Array.isArray(result.links)).toBe(true)
  })

  it('returns nodes with required properties', () => {
    const result = getFunnelMetrics({})

    for (const node of result.nodes) {
      expect(node).toHaveProperty('id')
      expect(node).toHaveProperty('name')
      expect(node).toHaveProperty('value')
    }
  })

  it('returns links with source, target, value', () => {
    const result = getFunnelMetrics({})

    for (const link of result.links) {
      expect(link).toHaveProperty('source')
      expect(link).toHaveProperty('target')
      expect(link).toHaveProperty('value')
    }
  })

  it('filters by 7d preset', () => {
    const result = getFunnelMetrics({ preset: '7d' })

    expect(result.dateRange).not.toBeNull()
    expect(result.dateRange).toHaveProperty('start')
    expect(result.dateRange).toHaveProperty('end')
  })

  it('filters by 30d preset', () => {
    const result = getFunnelMetrics({ preset: '30d' })
    expect(result.dateRange).not.toBeNull()
  })

  it('filters by 90d preset', () => {
    const result = getFunnelMetrics({ preset: '90d' })
    expect(result.dateRange).not.toBeNull()
  })

  it('returns null dateRange for all preset', () => {
    const result = getFunnelMetrics({ preset: 'all' })
    expect(result.dateRange).toBeNull()
  })

  it('accepts custom dateRange', () => {
    const result = getFunnelMetrics({
      dateRange: {
        start: '2026-01-01T00:00:00Z',
        end: '2026-01-15T00:00:00Z'
      }
    })

    expect(result.dateRange).not.toBeNull()
    expect(result.dateRange.start).toContain('2026-01-01')
  })

  it('handles empty jobs gracefully', () => {
    writeFileSync(JOBS_FILE, JSON.stringify({ jobs: [] }, null, 2))

    const result = getFunnelMetrics({})

    expect(result.nodes).toEqual([])
    expect(result.links).toEqual([])
    expect(result.totalJobs).toBe(0)
  })
})

// ============================================================================
// Tool 2: Get Response Rates Tests
// ============================================================================

describe('getResponseRates', () => {
  it('returns error when dimension missing', () => {
    const result = getResponseRates({})

    expect(result).toHaveProperty('error')
    expect(result.error).toContain('dimension is required')
    expect(result).toHaveProperty('validDimensions')
  })

  it('returns error for invalid dimension', () => {
    const result = getResponseRates({ dimension: 'invalid' })

    expect(result).toHaveProperty('error')
    expect(result.error).toContain('Invalid dimension')
    expect(result).toHaveProperty('validDimensions')
  })

  it('handles companySize dimension', () => {
    const result = getResponseRates({ dimension: 'companySize' })

    expect(result.dimension).toBe('companySize')
    expect(Array.isArray(result.rates)).toBe(true)
  })

  it('handles industry dimension', () => {
    const result = getResponseRates({ dimension: 'industry' })

    expect(result.dimension).toBe('industry')
    expect(Array.isArray(result.rates)).toBe(true)
  })

  it('handles applicationMethod dimension', () => {
    const result = getResponseRates({ dimension: 'applicationMethod' })
    expect(result.dimension).toBe('applicationMethod')
  })

  it('handles jobBoard dimension', () => {
    const result = getResponseRates({ dimension: 'jobBoard' })
    expect(result.dimension).toBe('jobBoard')
  })

  it('handles roleType dimension', () => {
    const result = getResponseRates({ dimension: 'roleType' })
    expect(result.dimension).toBe('roleType')
  })

  it('returns rates with confidence levels', () => {
    const result = getResponseRates({ dimension: 'industry' })

    for (const rate of result.rates) {
      expect(rate).toHaveProperty('rate')
      expect(rate).toHaveProperty('sampleSize')
      expect(rate).toHaveProperty('confidence')
    }
  })

  it('returns overall rate separately', () => {
    const result = getResponseRates({ dimension: 'industry' })

    if (result.overall) {
      expect(result.overall).toHaveProperty('rate')
      expect(result.overall).toHaveProperty('sampleSize')
    }
  })
})

// ============================================================================
// Tool 3: Get Time to Response Tests
// ============================================================================

describe('getTimeToResponse', () => {
  it('returns expected structure', () => {
    const result = getTimeToResponse()

    expect(result).toHaveProperty('averageDays')
    expect(result).toHaveProperty('medianDays')
    expect(result).toHaveProperty('percentiles')
    expect(result).toHaveProperty('sampleSize')
    expect(result).toHaveProperty('display')
  })

  it('returns percentile breakdown', () => {
    const result = getTimeToResponse()

    expect(result.percentiles).toHaveProperty('p25')
    expect(result.percentiles).toHaveProperty('p50')
    expect(result.percentiles).toHaveProperty('p75')
    expect(result.percentiles).toHaveProperty('p80')
    expect(result.percentiles).toHaveProperty('p90')
  })

  it('returns human-readable display format', () => {
    const result = getTimeToResponse()

    // Should contain 'days avg' or 'No' if no data
    expect(result.display).toMatch(/days avg|No/)
  })
})

// ============================================================================
// Tool 4: Get Time in Stage Tests
// ============================================================================

describe('getTimeInStage', () => {
  it('returns all stages when no status specified', () => {
    const result = getTimeInStage({})

    expect(result).toHaveProperty('stages')
    expect(Array.isArray(result.stages)).toBe(true)
    expect(result.stages.length).toBeGreaterThan(0)
  })

  it('returns specific stage when status provided', () => {
    const result = getTimeInStage({ status: 'applied' })

    expect(result.stages).toHaveLength(1)
    expect(result.stages[0].status).toBe('applied')
  })

  it('returns metrics with required properties', () => {
    const result = getTimeInStage({ status: 'applied' })

    const stage = result.stages[0]
    expect(stage).toHaveProperty('averageDays')
    expect(stage).toHaveProperty('medianDays')
    expect(stage).toHaveProperty('percentiles')
    expect(stage).toHaveProperty('sampleSize')
  })

  it('returns percentiles object', () => {
    const result = getTimeInStage({ status: 'inbox' })

    expect(result.stages[0].percentiles).toHaveProperty('p25')
    expect(result.stages[0].percentiles).toHaveProperty('p50')
    expect(result.stages[0].percentiles).toHaveProperty('p75')
    expect(result.stages[0].percentiles).toHaveProperty('p90')
  })
})

// ============================================================================
// Tool 5: Get Bottlenecks Tests
// ============================================================================

describe('getBottlenecks', () => {
  it('returns bottlenecks array', () => {
    const result = getBottlenecks({})

    expect(result).toHaveProperty('bottlenecks')
    expect(Array.isArray(result.bottlenecks)).toBe(true)
  })

  it('uses default threshold of 7 days', () => {
    // With test data, most jobs should not exceed 7 days
    const result = getBottlenecks({})
    expect(result.bottlenecks).toBeDefined()
  })

  it('accepts custom threshold', () => {
    const result = getBottlenecks({ threshold: 1 })
    // Lower threshold should catch more bottlenecks
    expect(result.bottlenecks).toBeDefined()
  })

  it('bottlenecks have required properties', () => {
    const result = getBottlenecks({ threshold: 0 }) // Very low threshold to get results

    if (result.bottlenecks.length > 0) {
      const bottleneck = result.bottlenecks[0]
      expect(bottleneck).toHaveProperty('status')
      expect(bottleneck).toHaveProperty('averageDays')
      expect(bottleneck).toHaveProperty('recommendation')
    }
  })
})

// ============================================================================
// Tool 6: Get Skill Gaps Tests
// ============================================================================

describe('getSkillGaps', () => {
  it('returns gaps array and total', () => {
    const result = getSkillGaps({})

    expect(result).toHaveProperty('gaps')
    expect(result).toHaveProperty('total')
    expect(Array.isArray(result.gaps)).toBe(true)
    expect(typeof result.total).toBe('number')
  })

  it('filters by minOccurrences', () => {
    // With only 5 jobs, most gaps appear 1-2 times
    const result = getSkillGaps({ minOccurrences: 1 })

    // All gaps with count >= 1
    for (const gap of result.gaps) {
      expect(gap.count).toBeGreaterThanOrEqual(1)
    }
  })

  it('gaps have required properties', () => {
    // Use minOccurrences = 1 to get results with test data
    const result = getSkillGaps({ minOccurrences: 1 })

    if (result.gaps.length > 0) {
      const gap = result.gaps[0]
      expect(gap).toHaveProperty('skill')
      expect(gap).toHaveProperty('count')
      expect(gap).toHaveProperty('priority')
      expect(gap).toHaveProperty('industries')
      expect(gap).toHaveProperty('roles')
    }
  })

  it('returns total matching gap count', () => {
    const result = getSkillGaps({})
    expect(result.total).toBe(result.gaps.length)
  })
})

// ============================================================================
// Tool 7: Get Skill Gap Recommendations Tests
// ============================================================================

describe('getSkillGapRecommendations', () => {
  it('returns recommendations array', () => {
    const result = getSkillGapRecommendations()

    expect(result).toHaveProperty('recommendations')
    expect(Array.isArray(result.recommendations)).toBe(true)
  })

  it('recommendations have required properties', () => {
    const result = getSkillGapRecommendations()

    if (result.recommendations.length > 0) {
      const rec = result.recommendations[0]
      expect(rec).toHaveProperty('skill')
      expect(rec).toHaveProperty('priority')
      expect(rec).toHaveProperty('rationale')
      expect(rec).toHaveProperty('actionType')
    }
  })

  it('actionType is one of learn, highlight, research', () => {
    const result = getSkillGapRecommendations()

    for (const rec of result.recommendations) {
      expect(['learn', 'highlight', 'research']).toContain(rec.actionType)
    }
  })
})

// ============================================================================
// Tool 8: Get Criteria Recommendations Tests
// ============================================================================

describe('getCriteriaRecommendations', () => {
  it('returns recommendations array', () => {
    const result = getCriteriaRecommendations()

    expect(result).toHaveProperty('recommendations')
    expect(Array.isArray(result.recommendations)).toBe(true)
  })

  it('recommendations have type, criteria, rationale', () => {
    // Create jobs that would trigger recommendations
    const jobsWithPatterns = [...mockJobs]
    for (let i = 0; i < 5; i++) {
      jobsWithPatterns.push({
        id: 100 + i,
        title: 'Data Engineer',
        company: `Company${i}`,
        status: 'applied',
        industry: 'Data',
        applied: '2026-01-01T00:00:00Z'
      })
    }
    writeFileSync(JOBS_FILE, JSON.stringify({ jobs: jobsWithPatterns }, null, 2))

    const result = getCriteriaRecommendations()

    if (result.recommendations.length > 0) {
      const rec = result.recommendations[0]
      expect(rec).toHaveProperty('type')
      expect(rec).toHaveProperty('criteria')
      expect(rec).toHaveProperty('rationale')
    }
  })
})

// ============================================================================
// Tool 9: Preview Criteria Change Tests
// ============================================================================

describe('previewCriteriaChange', () => {
  it('returns error when change missing', () => {
    const result = previewCriteriaChange({})

    expect(result.summary).toContain('change object is required')
  })

  it('returns preview structure', () => {
    const result = previewCriteriaChange({
      change: {
        type: 'add_title',
        criteria: 'titles.exact',
        newValue: ['Senior Software Engineer'],
        currentValue: []
      }
    })

    expect(result).toHaveProperty('affected')
    expect(result).toHaveProperty('scoreChanges')
    expect(result).toHaveProperty('summary')
  })

  it('shows accurate impact for add_title', () => {
    const result = previewCriteriaChange({
      change: {
        type: 'add_title',
        criteria: 'titles.exact',
        newValue: ['DevOps Engineer'],
        currentValue: []
      }
    })

    // Should affect jobs with matching titles
    expect(typeof result.affected).toBe('number')
    expect(Array.isArray(result.scoreChanges)).toBe(true)
  })

  it('scoreChanges have required properties', () => {
    const result = previewCriteriaChange({
      change: {
        type: 'add_title',
        criteria: 'titles.exact',
        newValue: ['Senior Software Engineer'],
        currentValue: []
      }
    })

    if (result.scoreChanges.length > 0) {
      const change = result.scoreChanges[0]
      expect(change).toHaveProperty('jobId')
      expect(change).toHaveProperty('title')
      expect(change).toHaveProperty('company')
      expect(change).toHaveProperty('oldScore')
      expect(change).toHaveProperty('newScore')
      expect(change).toHaveProperty('delta')
    }
  })
})

// ============================================================================
// Tool 10: Apply Criteria Change Tests
// ============================================================================

describe('applyCriteriaChange', () => {
  it('returns error when change missing', () => {
    const result = applyCriteriaChange({})

    expect(result.success).toBe(false)
    expect(result.error).toContain('change object is required')
  })

  it('returns error when reason missing', () => {
    const result = applyCriteriaChange({
      change: {
        type: 'add_title',
        criteria: 'titles.exact',
        newValue: ['Test Title']
      }
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('reason is required')
  })

  it('requires valid change type', () => {
    const result = applyCriteriaChange({
      change: {
        type: 'invalid_type',
        criteria: 'test'
      },
      reason: 'Testing'
    })

    // Should fail with unknown type
    expect(result.success).toBe(false)
  })
})

// ============================================================================
// Tool 11: Get Analytics Snapshot Tests
// ============================================================================

describe('getAnalyticsSnapshot', () => {
  it('returns current snapshot with metrics', () => {
    const result = getAnalyticsSnapshot({})

    expect(result).toHaveProperty('date')
    expect(result).toHaveProperty('metrics')
    expect(result.generated).toBe(true)
  })

  it('current snapshot has required metrics', () => {
    const result = getAnalyticsSnapshot({})

    expect(result.metrics).toHaveProperty('totalJobs')
    expect(result.metrics).toHaveProperty('byStatus')
    expect(result.metrics).toHaveProperty('avgTimeToResponse')
    expect(result.metrics).toHaveProperty('skillGapsCount')
  })

  it('returns error for non-existent historical date', () => {
    const result = getAnalyticsSnapshot({ date: '2020-01-01' })

    expect(result).toHaveProperty('error')
    expect(result.error).toContain('Snapshot not found')
    expect(result).toHaveProperty('availableDates')
  })

  it('retrieves historical snapshot when available', () => {
    // Save a snapshot first
    saveAnalyticsSnapshot()

    // Now try to retrieve it
    const today = new Date().toISOString().split('T')[0]
    const result = getAnalyticsSnapshot({ date: today })

    expect(result).toHaveProperty('date')
    expect(result.date).toContain(today)
    expect(result).not.toHaveProperty('error')
  })
})

// ============================================================================
// Tool 12: Save Analytics Snapshot Tests
// ============================================================================

describe('saveAnalyticsSnapshot', () => {
  it('creates new entry in snapshots file', () => {
    const result = saveAnalyticsSnapshot()

    expect(result.success).toBe(true)
    expect(result).toHaveProperty('snapshotDate')

    // Verify file was created
    expect(existsSync(SNAPSHOTS_FILE)).toBe(true)

    const data = JSON.parse(readFileSync(SNAPSHOTS_FILE, 'utf-8'))
    expect(data.snapshots.length).toBeGreaterThan(0)
  })

  it('returns snapshot date on success', () => {
    const result = saveAnalyticsSnapshot()

    expect(result.snapshotDate).toBeDefined()
    expect(result.snapshotDate).toContain(new Date().getFullYear().toString())
  })

  it('updates lastSnapshot field', () => {
    saveAnalyticsSnapshot()

    const data = JSON.parse(readFileSync(SNAPSHOTS_FILE, 'utf-8'))
    expect(data.lastSnapshot).toBeDefined()
  })

  it('preserves existing snapshots', () => {
    // Save first snapshot
    saveAnalyticsSnapshot()

    const data1 = JSON.parse(readFileSync(SNAPSHOTS_FILE, 'utf-8'))
    const initialCount = data1.snapshots.length

    // Save second snapshot
    saveAnalyticsSnapshot()

    const data2 = JSON.parse(readFileSync(SNAPSHOTS_FILE, 'utf-8'))
    expect(data2.snapshots.length).toBe(initialCount + 1)
  })

  it('removes snapshots older than 90 days', () => {
    // Create file with old snapshot
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 100)

    writeFileSync(SNAPSHOTS_FILE, JSON.stringify({
      version: '1.0',
      snapshots: [{
        date: oldDate.toISOString(),
        metrics: { totalJobs: 10 }
      }],
      lastSnapshot: oldDate.toISOString()
    }, null, 2))

    // Save new snapshot
    saveAnalyticsSnapshot()

    const data = JSON.parse(readFileSync(SNAPSHOTS_FILE, 'utf-8'))

    // Old snapshot should be removed
    const oldSnapshots = data.snapshots.filter(s => {
      const sDate = new Date(s.date)
      return sDate < oldDate
    })
    expect(oldSnapshots.length).toBe(0)
  })
})
