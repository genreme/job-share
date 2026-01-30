/**
 * Tests for Profile-to-Resume Transformation Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  previewResumeSources,
  buildResumeFromProfile,
  selectSummaryBlock,
  selectRelevantExperience,
  selectRelevantProjects,
  selectRelevantSkills,
  getUsedProfileItems
} from './profile-to-resume.js'

// Mock gap-detector
vi.mock('./gap-detector.js', () => ({
  detectGaps: vi.fn(() => [])
}))

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
      schemaVersion: '1.0',
      name: 'Test User',
      email: 'test@example.com',
      ...overrides.metadata
    },
    experience: overrides.experience || [
      {
        id: 'exp-1',
        role: {
          title: 'Senior Engineer',
          company: 'Tech Corp',
          location: 'San Francisco',
          startDate: '2020-01-01',
          endDate: null
        },
        projects: [
          {
            id: 'proj-1',
            name: 'Design System',
            description: 'Built a comprehensive design system',
            tags: ['design', 'frontend', 'react'],
            metrics: { value: 40, unit: 'percent', context: 'faster development' },
            skillRefs: ['skill-1'],
            createdAt: now,
            updatedAt: now
          },
          {
            id: 'proj-2',
            name: 'API Gateway',
            description: 'Implemented API gateway for microservices',
            tags: ['backend', 'nodejs', 'architecture'],
            skillRefs: ['skill-2'],
            createdAt: now,
            updatedAt: now
          }
        ],
        version: 1,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'exp-2',
        role: {
          title: 'Frontend Developer',
          company: 'Startup Inc',
          location: 'Remote',
          startDate: '2018-01-01',
          endDate: '2019-12-31'
        },
        projects: [
          {
            id: 'proj-3',
            name: 'Mobile App',
            description: 'Developed mobile app with React Native',
            tags: ['mobile', 'react-native'],
            createdAt: now,
            updatedAt: now
          }
        ],
        version: 1,
        createdAt: now,
        updatedAt: now
      }
    ],
    skills: overrides.skills || [
      {
        id: 'skill-1',
        name: 'React',
        category: 'Technical',
        subcategory: 'Frontend Frameworks',
        proficiency: 'expert',
        source: 'explicit',
        confidence: 90,
        evidence: ['proj-1', 'proj-3'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'skill-2',
        name: 'Node.js',
        category: 'Technical',
        subcategory: 'Backend',
        proficiency: 'proficient',
        source: 'explicit',
        confidence: 80,
        evidence: ['proj-2'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'skill-3',
        name: 'Team Leadership',
        category: 'Leadership',
        subcategory: 'Management',
        proficiency: 'proficient',
        source: 'explicit',
        confidence: 75,
        evidence: ['proj-1'],
        createdAt: now,
        updatedAt: now
      }
    ],
    summaryBlocks: overrides.summaryBlocks || [
      {
        id: 'summary-1',
        content:
          'Technical leader with extensive experience in building scalable systems and leading high-performing teams.',
        audiences: ['technical', 'leadership'],
        themes: ['technical', 'leadership'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'summary-2',
        content: 'Executive with proven track record of driving business growth through technology.',
        audiences: ['executive'],
        themes: ['business', 'growth'],
        createdAt: now,
        updatedAt: now
      }
    ],
    stories: overrides.stories || [],
    preferences: {
      targetRoles: overrides.targetRoles || [],
      communication: overrides.communication || {
        tone: 'conversational',
        verbosity: 'balanced',
        emphasisAreas: ['impact-driven'],
        avoidPhrases: ['synergy']
      }
    },
    history: []
  }
}

describe('previewResumeSources', () => {
  it('returns correct structure with all sections', () => {
    const profile = createMockProfile()
    const jobContext = { company: 'Acme', title: 'Senior Engineer', audience: 'technical' }

    const preview = previewResumeSources(profile, jobContext)

    expect(preview).toHaveProperty('summary')
    expect(preview).toHaveProperty('experience')
    expect(preview).toHaveProperty('skills')
    expect(preview).toHaveProperty('gaps')
  })

  it('shows matching summary blocks for audience', () => {
    const profile = createMockProfile()
    const jobContext = { audience: 'technical' }

    const preview = previewResumeSources(profile, jobContext)

    expect(preview.summary.matchingAudience).toBe('technical')
    expect(preview.summary.blocks.length).toBeGreaterThan(0)
    expect(preview.summary.blocks[0]).toHaveProperty('id')
    expect(preview.summary.blocks[0]).toHaveProperty('preview')
  })

  it('shows experience roles with project counts', () => {
    const profile = createMockProfile()
    const jobContext = {}

    const preview = previewResumeSources(profile, jobContext)

    expect(preview.experience.roles.length).toBe(2)
    expect(preview.experience.roles[0]).toHaveProperty('id')
    expect(preview.experience.roles[0]).toHaveProperty('title')
    expect(preview.experience.roles[0]).toHaveProperty('company')
    expect(preview.experience.roles[0]).toHaveProperty('projectCount')
    expect(preview.experience.totalProjects).toBe(3)
  })

  it('shows relevant skills with total count', () => {
    const profile = createMockProfile()
    const jobContext = { keywords: ['react'] }

    const preview = previewResumeSources(profile, jobContext)

    expect(preview.skills.total).toBe(3)
    expect(preview.skills.relevant.length).toBeGreaterThan(0)
    expect(preview.skills.relevant[0]).toHaveProperty('name')
    expect(preview.skills.relevant[0]).toHaveProperty('proficiency')
    expect(preview.skills.categories).toContain('Technical')
  })

  it('handles empty profile gracefully', () => {
    const profile = {
      metadata: { version: 1, createdAt: '', updatedAt: '', schemaVersion: '1.0' },
      experience: [],
      skills: [],
      summaryBlocks: [],
      preferences: {}
    }

    const preview = previewResumeSources(profile, {})

    expect(preview.summary.blocks).toEqual([])
    expect(preview.experience.roles).toEqual([])
    expect(preview.skills.total).toBe(0)
  })
})

describe('buildResumeFromProfile', () => {
  it('transforms profile to resume format', () => {
    const profile = createMockProfile()
    const jobContext = { company: 'Acme', title: 'Senior Engineer' }

    const resume = buildResumeFromProfile(profile, jobContext)

    expect(resume).toHaveProperty('contact')
    expect(resume).toHaveProperty('summary')
    expect(resume).toHaveProperty('experience')
    expect(resume).toHaveProperty('skills')
    expect(resume).toHaveProperty('target_company', 'Acme')
    expect(resume).toHaveProperty('target_title', 'Senior Engineer')
  })

  it('includes contact information from profile metadata', () => {
    const profile = createMockProfile({
      metadata: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-1234'
      }
    })

    const resume = buildResumeFromProfile(profile, {})

    expect(resume.contact.name).toBe('John Doe')
    expect(resume.contact.email).toBe('john@example.com')
  })

  it('selects summary for audience', () => {
    const profile = createMockProfile()
    const jobContext = { audience: 'technical' }

    const resume = buildResumeFromProfile(profile, jobContext)

    expect(resume.summary).toContain('Technical leader')
  })

  it('transforms experience to bullets format', () => {
    const profile = createMockProfile()

    const resume = buildResumeFromProfile(profile, {})

    expect(resume.experience.length).toBeGreaterThan(0)
    expect(resume.experience[0]).toHaveProperty('title')
    expect(resume.experience[0]).toHaveProperty('company')
    expect(resume.experience[0]).toHaveProperty('bullets')
    expect(Array.isArray(resume.experience[0].bullets)).toBe(true)
  })

  it('groups skills by category', () => {
    const profile = createMockProfile()

    const resume = buildResumeFromProfile(profile, {})

    expect(resume.skills).toHaveProperty('Technical')
    expect(resume.skills.Technical).toContain('React')
  })

  it('handles missing profile sections gracefully', () => {
    const profile = {
      metadata: { version: 1, createdAt: '', updatedAt: '', schemaVersion: '1.0' },
      experience: [],
      skills: [],
      summaryBlocks: []
    }

    const resume = buildResumeFromProfile(profile, {})

    expect(resume.summary).toBe('')
    expect(resume.experience).toEqual([])
    expect(resume.skills).toEqual({})
  })

  it('respects maxExperienceItems option', () => {
    const profile = createMockProfile()
    const options = { maxExperienceItems: 1 }

    const resume = buildResumeFromProfile(profile, {}, options)

    expect(resume.experience.length).toBeLessThanOrEqual(1)
  })
})

describe('selectSummaryBlock', () => {
  it('returns block matching audience', () => {
    const blocks = [
      { id: '1', content: 'Technical content', audiences: ['technical'] },
      { id: '2', content: 'Executive content', audiences: ['executive'] }
    ]

    const result = selectSummaryBlock(blocks, 'technical')

    expect(result.id).toBe('1')
  })

  it('returns first block when no audience match', () => {
    const blocks = [{ id: '1', content: 'Only block', audiences: ['leadership'] }]

    const result = selectSummaryBlock(blocks, 'technical')

    expect(result.id).toBe('1')
  })

  it('returns null for empty blocks array', () => {
    const result = selectSummaryBlock([], 'technical')

    expect(result).toBeNull()
  })

  it('returns null for null/undefined blocks', () => {
    expect(selectSummaryBlock(null, 'technical')).toBeNull()
    expect(selectSummaryBlock(undefined, 'technical')).toBeNull()
  })
})

describe('selectRelevantExperience', () => {
  it('sorts experience by relevance to job context', () => {
    const profile = createMockProfile()
    const jobContext = { title: 'Frontend Developer', keywords: ['react'] }

    const result = selectRelevantExperience(profile, jobContext)

    expect(result.length).toBeGreaterThan(0)
    // Each result should have relevanceScore
    expect(result[0]).toHaveProperty('relevanceScore')
  })

  it('prioritizes current role (endDate null)', () => {
    const profile = createMockProfile()

    const result = selectRelevantExperience(profile, {})

    // Current role (endDate null) should have bonus
    const currentRole = result.find((exp) => exp.role.endDate === null)
    expect(currentRole).toBeDefined()
  })

  it('limits results to maxItems', () => {
    const profile = createMockProfile()

    const result = selectRelevantExperience(profile, {}, 1)

    expect(result.length).toBe(1)
  })

  it('returns empty array for profile with no experience', () => {
    const profile = createMockProfile({ experience: [] })

    const result = selectRelevantExperience(profile, {})

    expect(result).toEqual([])
  })
})

describe('selectRelevantProjects', () => {
  it('scores projects by keyword match', () => {
    const projects = [
      { id: '1', name: 'React App', description: 'React frontend', tags: ['react'] },
      { id: '2', name: 'Backend API', description: 'Node API', tags: ['node'] }
    ]
    const jobContext = { keywords: ['react'] }

    const result = selectRelevantProjects(projects, jobContext)

    expect(result[0].name).toBe('React App')
    expect(result[0].relevanceScore).toBeGreaterThan(result[1].relevanceScore)
  })

  it('gives bonus for projects with metrics', () => {
    const projects = [
      { id: '1', name: 'Project A', description: 'A project', tags: [] },
      {
        id: '2',
        name: 'Project B',
        description: 'B project',
        tags: [],
        metrics: { value: 50, unit: 'percent' }
      }
    ]

    const result = selectRelevantProjects(projects, {})

    expect(result[0].id).toBe('2') // With metrics comes first
  })

  it('returns empty array for null/undefined projects', () => {
    expect(selectRelevantProjects(null, {})).toEqual([])
    expect(selectRelevantProjects(undefined, {})).toEqual([])
  })
})

describe('selectRelevantSkills', () => {
  it('scores skills by proficiency', () => {
    const skills = [
      {
        id: '1',
        name: 'Skill A',
        category: 'Technical',
        subcategory: 'Test',
        proficiency: 'familiar',
        evidence: []
      },
      {
        id: '2',
        name: 'Skill B',
        category: 'Technical',
        subcategory: 'Test',
        proficiency: 'expert',
        evidence: []
      }
    ]

    const result = selectRelevantSkills(skills, {})

    expect(result[0].name).toBe('Skill B') // Expert first
  })

  it('boosts skills matching keywords', () => {
    const skills = [
      {
        id: '1',
        name: 'Python',
        category: 'Technical',
        subcategory: 'Languages',
        proficiency: 'expert',
        evidence: []
      },
      {
        id: '2',
        name: 'React',
        category: 'Technical',
        subcategory: 'Frontend',
        proficiency: 'expert',
        evidence: []
      }
    ]
    const jobContext = { keywords: ['react', 'frontend'] }

    const result = selectRelevantSkills(skills, jobContext)

    expect(result[0].name).toBe('React') // Matches keywords
  })

  it('scores by evidence length', () => {
    const skills = [
      {
        id: '1',
        name: 'Skill A',
        category: 'Technical',
        subcategory: 'Test',
        proficiency: 'proficient',
        evidence: ['p1']
      },
      {
        id: '2',
        name: 'Skill B',
        category: 'Technical',
        subcategory: 'Test',
        proficiency: 'proficient',
        evidence: ['p1', 'p2', 'p3']
      }
    ]

    const result = selectRelevantSkills(skills, {})

    expect(result[0].name).toBe('Skill B') // More evidence
  })
})

describe('getUsedProfileItems', () => {
  it('returns list of used item IDs', () => {
    const profile = createMockProfile()
    const jobContext = { audience: 'technical' }

    const usedItems = getUsedProfileItems(profile, jobContext)

    expect(usedItems.length).toBeGreaterThan(0)
    expect(usedItems.some((item) => item.itemType === 'summary')).toBe(true)
    expect(usedItems.some((item) => item.itemType === 'experience')).toBe(true)
    expect(usedItems.some((item) => item.itemType === 'skill')).toBe(true)
  })

  it('includes project IDs from selected experience', () => {
    const profile = createMockProfile()

    const usedItems = getUsedProfileItems(profile, {})

    const projectItems = usedItems.filter((item) => item.itemType === 'project')
    expect(projectItems.length).toBeGreaterThan(0)
  })

  it('handles empty profile', () => {
    const profile = {
      metadata: {},
      experience: [],
      skills: [],
      summaryBlocks: []
    }

    const usedItems = getUsedProfileItems(profile, {})

    expect(usedItems).toEqual([])
  })
})
