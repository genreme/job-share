/**
 * Gap Detector Tests
 *
 * Tests detection of required fields, thin evidence, and contextual gaps.
 */

import { describe, it, expect } from 'vitest'
import { detectGaps } from './gap-detector.js'

// =============================================================================
// TEST FIXTURES
// =============================================================================

const createSkill = (id, name, extras = {}) => ({
  id,
  name,
  category: extras.category || 'Technical',
  subcategory: extras.subcategory || 'General',
  proficiency: 'proficient',
  source: 'explicit',
  confidence: 85,
  evidence: extras.evidence || ['proj-1', 'proj-2'], // Default: meets minimum
  createdAt: '2026-01-30T10:00:00.000Z',
  updatedAt: '2026-01-30T10:00:00.000Z'
})

const createStory = (id, title, extras = {}) => ({
  id,
  title,
  situation: 'A challenge arose',
  task: 'Complete the task',
  action: 'Took action',
  result: 'Achieved result',
  questionCategories: extras.questionCategories || ['leadership'],
  themes: extras.themes || ['team'],
  variants: [],
  // Use 'projectRef' in extras to allow explicit null
  projectRef: 'projectRef' in extras ? extras.projectRef : 'proj-1',
  createdAt: '2026-01-30T10:00:00.000Z',
  updatedAt: '2026-01-30T10:00:00.000Z'
})

const createExperience = (id, title, projects = []) => ({
  id,
  role: { title, company: 'Company Inc', startDate: '2020-01-01', endDate: null },
  projects:
    projects.length > 0
      ? projects
      : [
          {
            id: `${id}-proj`,
            name: 'Project A',
            description: 'Built something',
            tags: [],
            skillRefs: [],
            metrics: { value: 40, unit: 'percent', context: 'improvement' },
            createdAt: '2026-01-30T10:00:00.000Z',
            updatedAt: '2026-01-30T10:00:00.000Z'
          }
        ],
  version: 1,
  createdAt: '2026-01-30T10:00:00.000Z',
  updatedAt: '2026-01-30T10:00:00.000Z'
})

const createSummary = (id, content, extras = {}) => ({
  id,
  content,
  audiences: extras.audiences || ['technical'],
  themes: extras.themes || ['general'],
  createdAt: '2026-01-30T10:00:00.000Z',
  updatedAt: '2026-01-30T10:00:00.000Z'
})

const createCompleteProfile = () => ({
  experience: [createExperience('exp-1', 'Software Engineer')],
  skills: [createSkill('skill-1', 'React')],
  summaryBlocks: [createSummary('sum-1', 'Experienced engineer.')],
  stories: [createStory('story-1', 'Leadership Challenge')],
  preferences: {
    targetRoles: [{ id: 'role-1', title: 'Senior Engineer' }],
    communication: { tone: 'conversational', verbosity: 'balanced' }
  }
})

// =============================================================================
// NULL/EMPTY PROFILE TESTS
// =============================================================================

describe('Gap Detector', () => {
  describe('null/empty profile handling', () => {
    it('returns gap for null profile', () => {
      const findings = detectGaps(null)

      expect(findings).toHaveLength(1)
      expect(findings[0].type).toBe('gap')
      expect(findings[0].reason).toContain('No profile data')
    })

    it('returns gap for undefined profile', () => {
      const findings = detectGaps(undefined)

      expect(findings).toHaveLength(1)
    })
  })

  // =============================================================================
  // REQUIRED FIELD GAPS TESTS
  // =============================================================================

  describe('required field gaps', () => {
    it('detects missing communication preferences', () => {
      const profile = {
        ...createCompleteProfile(),
        preferences: { targetRoles: [{ id: 'role-1', title: 'Engineer' }] }
      }

      const findings = detectGaps(profile)
      const commGap = findings.find((f) => f.ids.includes('preferences.communication'))

      expect(commGap).toBeDefined()
      expect(commGap.reason).toContain('communication')
      expect(commGap.suggestion).toContain('tone')
    })

    it('detects missing target roles', () => {
      const profile = {
        ...createCompleteProfile(),
        preferences: { targetRoles: [], communication: { tone: 'formal' } }
      }

      const findings = detectGaps(profile)
      const roleGap = findings.find((f) => f.ids.includes('preferences.targetRoles'))

      expect(roleGap).toBeDefined()
      expect(roleGap.reason).toContain('target roles')
      expect(roleGap.suggestion).toContain('Define')
    })

    it('detects empty experience array', () => {
      const profile = {
        ...createCompleteProfile(),
        experience: []
      }

      const findings = detectGaps(profile)
      const expGap = findings.find((f) => f.ids.includes('experience'))

      expect(expGap).toBeDefined()
      expect(expGap.entityType).toBe('experience')
      expect(expGap.reason).toContain('essential')
    })

    it('detects missing experience array', () => {
      const profile = {
        ...createCompleteProfile()
      }
      delete profile.experience

      const findings = detectGaps(profile)
      const expGap = findings.find((f) => f.ids.includes('experience'))

      expect(expGap).toBeDefined()
    })

    it('detects empty skills array', () => {
      const profile = {
        ...createCompleteProfile(),
        skills: []
      }

      const findings = detectGaps(profile)
      const skillGap = findings.find((f) => f.ids.includes('skills'))

      expect(skillGap).toBeDefined()
      expect(skillGap.entityType).toBe('skill')
    })

    it('detects empty summaryBlocks array', () => {
      const profile = {
        ...createCompleteProfile(),
        summaryBlocks: []
      }

      const findings = detectGaps(profile)
      const sumGap = findings.find((f) => f.ids.includes('summaryBlocks'))

      expect(sumGap).toBeDefined()
      expect(sumGap.entityType).toBe('summary')
    })

    it('detects empty stories array', () => {
      const profile = {
        ...createCompleteProfile(),
        stories: []
      }

      const findings = detectGaps(profile)
      const storyGap = findings.find((f) => f.ids.includes('stories'))

      expect(storyGap).toBeDefined()
      expect(storyGap.entityType).toBe('story')
      expect(storyGap.suggestion).toContain('STAR')
    })

    it('returns no required gaps for complete profile', () => {
      const profile = createCompleteProfile()

      const findings = detectGaps(profile)
      const requiredGaps = findings.filter(
        (f) =>
          f.ids.includes('experience') ||
          f.ids.includes('skills') ||
          f.ids.includes('summaryBlocks') ||
          f.ids.includes('stories')
      )

      expect(requiredGaps).toHaveLength(0)
    })
  })

  // =============================================================================
  // THIN EVIDENCE GAPS TESTS
  // =============================================================================

  describe('thin evidence gaps', () => {
    describe('skills with insufficient evidence', () => {
      it('detects skill with only 1 evidence link', () => {
        const profile = {
          ...createCompleteProfile(),
          skills: [createSkill('skill-1', 'React', { evidence: ['proj-1'] })]
        }

        const findings = detectGaps(profile)
        const thinSkill = findings.find((f) => f.ids.includes('skill-1'))

        expect(thinSkill).toBeDefined()
        expect(thinSkill.entityType).toBe('skill')
        expect(thinSkill.reason).toContain('1 evidence')
        expect(thinSkill.suggestion).toContain('project references')
      })

      it('detects skill with 0 evidence links', () => {
        const profile = {
          ...createCompleteProfile(),
          skills: [createSkill('skill-1', 'React', { evidence: [] })]
        }

        const findings = detectGaps(profile)
        const thinSkill = findings.find((f) => f.ids.includes('skill-1'))

        expect(thinSkill).toBeDefined()
        expect(thinSkill.reason).toContain('0 evidence')
      })

      it('does not flag skills with 2+ evidence links', () => {
        const profile = {
          ...createCompleteProfile(),
          skills: [createSkill('skill-1', 'React', { evidence: ['p1', 'p2'] })]
        }

        const findings = detectGaps(profile)
        const thinSkill = findings.find((f) => f.ids.includes('skill-1'))

        expect(thinSkill).toBeUndefined()
      })

      it('creates separate findings for each thin skill', () => {
        const profile = {
          ...createCompleteProfile(),
          skills: [
            createSkill('skill-1', 'React', { evidence: ['p1'] }),
            createSkill('skill-2', 'Node', { evidence: [] }),
            createSkill('skill-3', 'Python', { evidence: ['p1', 'p2'] }) // OK
          ]
        }

        const findings = detectGaps(profile)
        const thinSkills = findings.filter((f) => f.reason?.includes('evidence link'))

        expect(thinSkills).toHaveLength(2)
      })
    })

    describe('projects without metrics', () => {
      it('detects project lacking metrics', () => {
        const projectWithoutMetrics = {
          id: 'proj-no-metrics',
          name: 'Legacy Migration',
          description: 'Migrated old system',
          tags: [],
          skillRefs: [],
          createdAt: '2026-01-30T10:00:00.000Z',
          updatedAt: '2026-01-30T10:00:00.000Z'
          // No metrics field
        }

        const profile = {
          ...createCompleteProfile(),
          experience: [createExperience('exp-1', 'Engineer', [projectWithoutMetrics])]
        }

        const findings = detectGaps(profile)
        const metricsGap = findings.find((f) => f.ids.includes('proj-no-metrics'))

        expect(metricsGap).toBeDefined()
        expect(metricsGap.entityType).toBe('experience')
        expect(metricsGap.reason).toContain('metrics')
        expect(metricsGap.suggestion).toContain('40%')
      })

      it('does not flag projects with metrics', () => {
        const profile = createCompleteProfile() // Has metrics by default

        const findings = detectGaps(profile)
        const metricsGaps = findings.filter((f) => f.reason?.includes('metrics'))

        expect(metricsGaps).toHaveLength(0)
      })
    })

    describe('stories without project references', () => {
      it('detects story lacking projectRef', () => {
        const profile = {
          ...createCompleteProfile(),
          stories: [createStory('story-1', 'Leadership Challenge', { projectRef: null })]
        }

        const findings = detectGaps(profile)
        const refGap = findings.find((f) => f.ids.includes('story-1'))

        expect(refGap).toBeDefined()
        expect(refGap.entityType).toBe('story')
        expect(refGap.reason).toContain('no project reference')
      })

      it('does not flag stories with project references', () => {
        const profile = createCompleteProfile() // Has projectRef by default

        const findings = detectGaps(profile)
        const refGaps = findings.filter((f) => f.reason?.includes('project reference'))

        expect(refGaps).toHaveLength(0)
      })
    })
  })

  // =============================================================================
  // CONTEXTUAL GAPS TESTS
  // =============================================================================

  describe('contextual gaps', () => {
    describe('leadership roles', () => {
      const leadershipTitles = [
        'Engineering Lead',
        'Team Manager',
        'Director of Engineering',
        'Head of Product',
        'VP of Design',
        'Chief Technology Officer'
      ]

      leadershipTitles.forEach((title) => {
        it(`detects missing leadership stories for "${title}"`, () => {
          const profile = {
            ...createCompleteProfile(),
            stories: [
              createStory('story-1', 'Technical Challenge', {
                questionCategories: ['technical'],
                themes: ['coding']
              })
            ]
          }

          const findings = detectGaps(profile, { title, company: 'TechCorp' })
          const leadershipGap = findings.find(
            (f) => f.ids.includes('stories.leadership') && f.relevantTo
          )

          expect(leadershipGap).toBeDefined()
          expect(leadershipGap.reason).toContain('leadership role')
          expect(leadershipGap.relevantTo).toContain(title)
        })
      })

      it('does not flag when leadership stories exist', () => {
        const profile = {
          ...createCompleteProfile(),
          stories: [
            createStory('story-1', 'Team Leadership', {
              questionCategories: ['leadership'],
              themes: ['team']
            })
          ]
        }

        const findings = detectGaps(profile, { title: 'Engineering Manager' })
        const leadershipGap = findings.find((f) => f.ids.includes('stories.leadership'))

        expect(leadershipGap).toBeUndefined()
      })

      it('detects missing leadership skills for leadership roles', () => {
        const profile = {
          ...createCompleteProfile(),
          skills: [createSkill('skill-1', 'React', { category: 'Technical' })],
          stories: [
            createStory('story-1', 'Team Leading', { questionCategories: ['leadership'] })
          ]
        }

        const findings = detectGaps(profile, { title: 'Engineering Manager' })
        const skillGap = findings.find((f) => f.ids.includes('skills.leadership'))

        expect(skillGap).toBeDefined()
        expect(skillGap.suggestion).toContain('leadership skills')
      })
    })

    describe('technical roles', () => {
      const technicalTitles = [
        'Software Engineer',
        'Senior Developer',
        'Solutions Architect',
        'Technical Lead'
      ]

      technicalTitles.forEach((title) => {
        it(`detects few technical skills for "${title}"`, () => {
          const profile = {
            ...createCompleteProfile(),
            skills: [
              createSkill('skill-1', 'Team Management', { category: 'Leadership' }),
              createSkill('skill-2', 'Communication', { category: 'Soft Skills' })
            ]
          }

          const findings = detectGaps(profile, { title })
          const techGap = findings.find((f) => f.ids.includes('skills.technical'))

          expect(techGap).toBeDefined()
          expect(techGap.reason).toContain('technical role')
          expect(techGap.relevantTo).toContain(title)
        })
      })

      it('does not flag when 3+ technical skills exist', () => {
        const profile = {
          ...createCompleteProfile(),
          skills: [
            createSkill('skill-1', 'React', { category: 'Technical' }),
            createSkill('skill-2', 'Node.js', { category: 'Technical' }),
            createSkill('skill-3', 'Python', { category: 'Technical' })
          ]
        }

        const findings = detectGaps(profile, { title: 'Software Engineer' })
        const techGap = findings.find((f) => f.ids.includes('skills.technical'))

        expect(techGap).toBeUndefined()
      })
    })

    describe('design roles', () => {
      const designTitles = ['UX Designer', 'Creative Director', 'Brand Manager', 'Product Designer']

      designTitles.forEach((title) => {
        it(`detects missing design skills for "${title}"`, () => {
          const profile = {
            ...createCompleteProfile(),
            skills: [createSkill('skill-1', 'Python', { category: 'Technical' })]
          }

          const findings = detectGaps(profile, { title })
          const designGap = findings.find((f) => f.ids.includes('skills.design'))

          expect(designGap).toBeDefined()
          expect(designGap.reason).toContain('design role')
        })
      })

      it('does not flag when design skills exist', () => {
        const profile = {
          ...createCompleteProfile(),
          skills: [createSkill('skill-1', 'UX Research', { category: 'Design' })]
        }

        const findings = detectGaps(profile, { title: 'UX Designer' })
        const designGap = findings.find((f) => f.ids.includes('skills.design'))

        expect(designGap).toBeUndefined()
      })

      it('recognizes design tools as design skills', () => {
        const profile = {
          ...createCompleteProfile(),
          skills: [createSkill('skill-1', 'Figma Prototyping', { category: 'Tools' })]
        }

        const findings = detectGaps(profile, { title: 'Product Designer' })
        const designGap = findings.find((f) => f.ids.includes('skills.design'))

        expect(designGap).toBeUndefined()
      })
    })

    describe('no job context', () => {
      it('returns no contextual gaps when jobContext is null', () => {
        const profile = {
          ...createCompleteProfile(),
          stories: [],
          skills: []
        }

        // Without context, we get required gaps but not contextual
        const findings = detectGaps(profile, null)
        const contextualGaps = findings.filter((f) => f.relevantTo)

        expect(contextualGaps).toHaveLength(0)
      })
    })
  })

  // =============================================================================
  // FINDING STRUCTURE TESTS
  // =============================================================================

  describe('finding structure', () => {
    it('includes all required fields for gap findings', () => {
      const profile = {
        experience: [],
        skills: [],
        summaryBlocks: [],
        stories: [],
        preferences: {}
      }

      const findings = detectGaps(profile)

      findings.forEach((finding) => {
        expect(finding.type).toBe('gap')
        expect(finding.entityType).toBeDefined()
        expect(Array.isArray(finding.ids)).toBe(true)
        expect(finding.ids.length).toBeGreaterThanOrEqual(1)
        expect(typeof finding.reason).toBe('string')
        expect(finding.reason.length).toBeGreaterThan(0)
        expect(typeof finding.suggestion).toBe('string')
        expect(finding.suggestion.length).toBeGreaterThan(0)
        expect(finding.createdAt).toBeDefined()
      })
    })

    it('includes relevantTo for contextual gaps', () => {
      const profile = {
        ...createCompleteProfile(),
        stories: [] // Missing stories
      }

      const findings = detectGaps(profile, { title: 'Engineering Manager', company: 'TechCorp' })
      const contextualGap = findings.find((f) => f.ids.includes('stories.leadership'))

      expect(contextualGap.relevantTo).toBe('Engineering Manager at TechCorp')
    })

    it('handles missing company in context', () => {
      const profile = {
        ...createCompleteProfile(),
        stories: []
      }

      const findings = detectGaps(profile, { title: 'Engineering Manager' })
      const contextualGap = findings.find((f) => f.ids.includes('stories.leadership'))

      expect(contextualGap.relevantTo).toBe('Engineering Manager')
    })
  })
})
