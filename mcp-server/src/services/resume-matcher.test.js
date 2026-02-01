/**
 * Resume Matcher Service Tests
 *
 * Tests keyword extraction and profile-JD matching functionality.
 */

import { describe, it, expect } from 'vitest'
import { extractJobKeywords, matchResumeToJob } from './resume-matcher.js'

// =============================================================================
// extractJobKeywords Tests
// =============================================================================

describe('extractJobKeywords', () => {
  describe('empty/invalid input', () => {
    it('returns empty skills array for null input', () => {
      const result = extractJobKeywords(null)
      expect(result.skills).toEqual([])
      expect(result.rawText).toBe('')
    })

    it('returns empty skills array for undefined input', () => {
      const result = extractJobKeywords(undefined)
      expect(result.skills).toEqual([])
      expect(result.rawText).toBe('')
    })

    it('returns empty skills array for empty string', () => {
      const result = extractJobKeywords('')
      expect(result.skills).toEqual([])
      expect(result.rawText).toBe('')
    })

    it('returns empty skills array for non-string input', () => {
      const result = extractJobKeywords({ description: 'React developer' })
      expect(result.skills).toEqual([])
    })
  })

  describe('single skill extraction', () => {
    it('extracts single design tool', () => {
      const result = extractJobKeywords('Experience with Figma required')
      expect(result.skills).toContain('figma')
    })

    it('extracts single frontend technology', () => {
      const result = extractJobKeywords('Must know React')
      expect(result.skills).toContain('react')
    })

    it('extracts single backend technology', () => {
      const result = extractJobKeywords('Node.js experience preferred')
      expect(result.skills).toContain('node.js')
    })

    it('extracts methodology keywords', () => {
      const result = extractJobKeywords('Agile development environment')
      expect(result.skills).toContain('agile')
    })

    it('extracts soft skills', () => {
      const result = extractJobKeywords('Strong leadership abilities')
      expect(result.skills).toContain('leadership')
    })
  })

  describe('multiple categories', () => {
    it('extracts skills from multiple categories', () => {
      const description = `
        We are looking for a Senior Product Designer with:
        - Figma and Sketch expertise
        - React and TypeScript knowledge
        - Agile/Scrum experience
        - Strong leadership and collaboration skills
        - UX research background
      `
      const result = extractJobKeywords(description)

      expect(result.skills).toContain('figma')
      expect(result.skills).toContain('sketch')
      expect(result.skills).toContain('react')
      expect(result.skills).toContain('typescript')
      expect(result.skills).toContain('agile')
      expect(result.skills).toContain('scrum')
      expect(result.skills).toContain('leadership')
      expect(result.skills).toContain('collaboration')
      expect(result.skills).toContain('ux')
    })

    it('extracts design system and cloud keywords', () => {
      const description = 'Design systems expert with AWS and Docker experience'
      const result = extractJobKeywords(description)

      expect(result.skills).toContain('design systems')
      expect(result.skills).toContain('aws')
      expect(result.skills).toContain('docker')
    })

    it('extracts data/analytics keywords', () => {
      const description = 'Data analysis skills with Tableau and A/B testing experience'
      const result = extractJobKeywords(description)

      expect(result.skills).toContain('data analysis')
      expect(result.skills).toContain('tableau')
      expect(result.skills).toContain('a/b testing')
    })
  })

  describe('text normalization', () => {
    it('handles HTML entities', () => {
      const result = extractJobKeywords('React &amp; TypeScript required')
      expect(result.skills).toContain('react')
      expect(result.skills).toContain('typescript')
    })

    it('handles bullet points', () => {
      const result = extractJobKeywords('• React\n• TypeScript\n• Figma')
      expect(result.skills).toContain('react')
      expect(result.skills).toContain('typescript')
      expect(result.skills).toContain('figma')
    })

    it('handles mixed case', () => {
      const result = extractJobKeywords('REACT and TypeScript and figma')
      expect(result.skills).toContain('react')
      expect(result.skills).toContain('typescript')
      expect(result.skills).toContain('figma')
    })

    it('deduplicates repeated skills', () => {
      const result = extractJobKeywords('React, React.js, react experience')
      // Should not have multiple react entries
      const reactCount = result.skills.filter(s => s === 'react').length
      expect(reactCount).toBe(1)
    })
  })

  describe('compound skill names', () => {
    it('extracts Adobe suite products', () => {
      const result = extractJobKeywords('Adobe Photoshop and Adobe Illustrator')
      expect(result.skills).toContain('adobe photoshop')
      expect(result.skills).toContain('adobe illustrator')
    })

    it('extracts design thinking', () => {
      const result = extractJobKeywords('Design thinking methodology')
      expect(result.skills).toContain('design thinking')
    })

    it('extracts user research', () => {
      const result = extractJobKeywords('User research and usability testing')
      expect(result.skills).toContain('user research')
      expect(result.skills).toContain('usability')
    })

    it('extracts cross-functional', () => {
      const result = extractJobKeywords('Work cross-functional teams')
      // Regex normalizes to space-separated version
      expect(result.skills.some(s => s.includes('cross') && s.includes('functional'))).toBe(true)
    })
  })

  describe('returns rawText', () => {
    it('includes normalized raw text in output', () => {
      const result = extractJobKeywords('  React  and   TypeScript  ')
      expect(result.rawText).toBe('react and typescript')
    })
  })
})

// =============================================================================
// matchResumeToJob Tests
// =============================================================================

describe('matchResumeToJob', () => {
  // Helper to create a mock profile
  function createMockProfile(overrides = {}) {
    return {
      skills: overrides.skills || [
        { id: '1', name: 'JavaScript' },
        { id: '2', name: 'React' },
        { id: '3', name: 'TypeScript' },
        { id: '4', name: 'Figma' },
        { id: '5', name: 'Leadership' }
      ],
      experience: overrides.experience || [
        {
          id: 'exp-1',
          role: { title: 'Senior Designer' },
          projects: [
            {
              id: 'proj-1',
              name: 'Design System',
              description: 'Built a comprehensive design system',
              tags: ['design systems', 'component library']
            }
          ]
        }
      ]
    }
  }

  describe('empty inputs', () => {
    it('returns neutral score for empty profile', () => {
      const result = matchResumeToJob({ skills: [], experience: [] }, 'React developer needed')

      expect(result.score).toBeLessThan(100)
      expect(result.matched).toEqual([])
      expect(result.missing.length).toBeGreaterThan(0)
    })

    it('returns 50 score for empty job description', () => {
      const profile = createMockProfile()
      const result = matchResumeToJob(profile, '')

      expect(result.score).toBe(50)
      expect(result.matched).toEqual([])
      expect(result.missing).toEqual([])
      expect(result.confidence).toBe('low')
    })

    it('handles null profile gracefully', () => {
      const result = matchResumeToJob(null, 'React developer')

      expect(result.score).toBeLessThan(100)
      expect(result.matched).toEqual([])
    })

    it('handles undefined profile gracefully', () => {
      const result = matchResumeToJob(undefined, 'React developer')

      expect(result.score).toBeLessThan(100)
    })
  })

  describe('perfect match scenarios', () => {
    it('returns 100% when all job keywords are in profile', () => {
      const profile = createMockProfile()
      const result = matchResumeToJob(profile, 'Need React and TypeScript skills')

      expect(result.score).toBe(100)
      expect(result.matched.length).toBe(2)
      expect(result.missing).toEqual([])
    })

    it('matches skills from profile skills array', () => {
      const profile = createMockProfile({
        skills: [{ name: 'React' }, { name: 'Node.js' }]
      })
      const result = matchResumeToJob(profile, 'React and Node.js experience')

      expect(result.matched.some(m =>
        m === 'react' || (typeof m === 'object' && m.keyword === 'react')
      )).toBe(true)
      expect(result.matched.some(m =>
        m === 'node.js' || (typeof m === 'object' && m.keyword === 'node.js')
      )).toBe(true)
    })
  })

  describe('partial match scenarios', () => {
    it('calculates correct score for partial match', () => {
      const profile = createMockProfile({
        skills: [{ name: 'React' }],
        experience: []
      })
      const result = matchResumeToJob(profile, 'React and Python and Go experience')

      // 1 out of 3 keywords matched = 33%
      expect(result.score).toBe(33)
      expect(result.matched.length).toBe(1)
      expect(result.missing.length).toBe(2)
    })

    it('identifies gaps correctly', () => {
      const profile = createMockProfile({
        skills: [{ name: 'JavaScript' }],
        experience: []
      })
      const result = matchResumeToJob(profile, 'Python, Django, and AWS required')

      expect(result.missing).toContain('python')
      expect(result.missing).toContain('django')
      expect(result.missing).toContain('aws')
    })
  })

  describe('no match scenarios', () => {
    it('returns 0% when no keywords match', () => {
      const profile = createMockProfile({
        skills: [{ name: 'Cobol' }],
        experience: []
      })
      const result = matchResumeToJob(profile, 'React and Python developer')

      expect(result.score).toBe(0)
      expect(result.matched).toEqual([])
      expect(result.missing.length).toBe(2)
    })
  })

  describe('partial keyword matching', () => {
    it('matches when skill contains job keyword', () => {
      const profile = createMockProfile({
        skills: [{ name: 'React Native' }],
        experience: []
      })
      const result = matchResumeToJob(profile, 'React experience needed')

      // "react native" contains "react"
      expect(result.matched.length).toBe(1)
      const match = result.matched[0]
      expect(typeof match === 'object' ? match.keyword : match).toBe('react')
    })

    it('matches when job keyword contains skill (for short skills)', () => {
      const profile = createMockProfile({
        skills: [{ name: 'UX' }],
        experience: []
      })
      const result = matchResumeToJob(profile, 'UX Design experience')

      expect(result.matched.length).toBeGreaterThan(0)
    })
  })

  describe('experience keyword extraction', () => {
    it('extracts keywords from project tags', () => {
      const profile = createMockProfile({
        skills: [],
        experience: [{
          id: 'exp-1',
          role: { title: 'Designer' },
          projects: [{
            id: 'proj-1',
            name: 'Project',
            tags: ['react', 'typescript']
          }]
        }]
      })
      const result = matchResumeToJob(profile, 'React and TypeScript')

      expect(result.matched.length).toBe(2)
      expect(result.score).toBe(100)
    })

    it('extracts keywords from project descriptions', () => {
      const profile = createMockProfile({
        skills: [],
        experience: [{
          id: 'exp-1',
          role: { title: 'Engineer' },
          projects: [{
            id: 'proj-1',
            name: 'API Project',
            description: 'Built GraphQL APIs with Node.js',
            tags: []
          }]
        }]
      })
      const result = matchResumeToJob(profile, 'GraphQL and Node.js experience')

      expect(result.matched.some(m =>
        m === 'graphql' || (typeof m === 'object' && m.keyword === 'graphql')
      )).toBe(true)
      expect(result.matched.some(m =>
        m === 'node.js' || (typeof m === 'object' && m.keyword === 'node.js')
      )).toBe(true)
    })

    it('extracts keywords from role title', () => {
      const profile = createMockProfile({
        skills: [],
        experience: [{
          id: 'exp-1',
          role: { title: 'UX Lead' },
          projects: [{ id: 'proj-1', name: 'P1', tags: [] }]
        }]
      })
      const result = matchResumeToJob(profile, 'UX expertise required')

      expect(result.matched.some(m =>
        m === 'ux' || (typeof m === 'object' && m.keyword === 'ux')
      )).toBe(true)
    })
  })

  describe('confidence level calculation', () => {
    it('returns high confidence when 5+ keywords extracted', () => {
      const profile = createMockProfile()
      const result = matchResumeToJob(
        profile,
        'React, TypeScript, Figma, Agile, Leadership, and AWS experience'
      )

      expect(result.confidence).toBe('high')
    })

    it('returns medium confidence when 2-4 keywords extracted', () => {
      const profile = createMockProfile()
      const result = matchResumeToJob(profile, 'React and TypeScript')

      expect(result.confidence).toBe('medium')
    })

    it('returns low confidence when <2 keywords extracted', () => {
      const profile = createMockProfile()
      const result = matchResumeToJob(profile, 'Looking for a developer')

      expect(result.confidence).toBe('low')
    })

    it('returns low confidence when no keywords extracted (empty description)', () => {
      const profile = createMockProfile()
      const result = matchResumeToJob(profile, '')

      expect(result.confidence).toBe('low')
    })
  })

  describe('suggestions generation', () => {
    it('generates suggestions for missing skills', () => {
      const profile = createMockProfile({
        skills: [{ name: 'JavaScript' }],
        experience: []
      })
      const result = matchResumeToJob(profile, 'Python and Django required')

      expect(result.suggestions.length).toBe(2)
      expect(result.suggestions.some(s => s.keyword === 'python')).toBe(true)
      expect(result.suggestions.some(s => s.keyword === 'django')).toBe(true)
    })

    it('suggestions contain helpful text', () => {
      const profile = createMockProfile({
        skills: [],
        experience: []
      })
      const result = matchResumeToJob(profile, 'AWS experience')

      expect(result.suggestions[0].suggestion).toContain('aws')
      expect(result.suggestions[0].suggestion).toContain('highlight')
    })

    it('returns empty suggestions when all skills match', () => {
      const profile = createMockProfile({
        skills: [{ name: 'React' }],
        experience: []
      })
      const result = matchResumeToJob(profile, 'React experience')

      expect(result.suggestions).toEqual([])
    })
  })

  describe('return structure', () => {
    it('returns all expected fields', () => {
      const profile = createMockProfile()
      const result = matchResumeToJob(profile, 'React and Python developer')

      expect(result).toHaveProperty('score')
      expect(result).toHaveProperty('matched')
      expect(result).toHaveProperty('missing')
      expect(result).toHaveProperty('suggestions')
      expect(result).toHaveProperty('totalJobKeywords')
      expect(result).toHaveProperty('confidence')

      expect(typeof result.score).toBe('number')
      expect(Array.isArray(result.matched)).toBe(true)
      expect(Array.isArray(result.missing)).toBe(true)
      expect(Array.isArray(result.suggestions)).toBe(true)
      expect(typeof result.totalJobKeywords).toBe('number')
      expect(['high', 'medium', 'low']).toContain(result.confidence)
    })

    it('score is between 0 and 100', () => {
      const profile = createMockProfile()
      const result = matchResumeToJob(profile, 'React developer')

      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
    })

    it('totalJobKeywords matches actual extracted count', () => {
      const profile = createMockProfile()
      const result = matchResumeToJob(profile, 'React, TypeScript, and Python')

      expect(result.totalJobKeywords).toBe(3)
      expect(result.matched.length + result.missing.length).toBe(3)
    })
  })

  describe('real-world job descriptions', () => {
    it('handles a typical design job description', () => {
      const profile = createMockProfile({
        skills: [
          { name: 'Figma' },
          { name: 'Design Systems' },
          { name: 'User Research' },
          { name: 'Leadership' }
        ],
        experience: [{
          id: 'exp-1',
          role: { title: 'Product Designer' },
          projects: [{
            id: 'proj-1',
            name: 'App Redesign',
            description: 'Led UX research and prototyping',
            tags: ['ux', 'prototyping']
          }]
        }]
      })

      const jobDescription = `
        We're looking for a Senior Product Designer to join our team.

        Requirements:
        - 5+ years of product design experience
        - Expert in Figma and design systems
        - Strong UX and user research skills
        - Experience with agile/scrum methodologies
        - Leadership and mentoring abilities

        Nice to have:
        - Accessibility (a11y) knowledge
        - Data analysis experience
      `

      const result = matchResumeToJob(profile, jobDescription)

      // Score depends on how many unique keywords are in the JD vs profile
      // With many JD keywords and fewer profile matches, score may be moderate
      expect(result.score).toBeGreaterThan(30)
      expect(result.confidence).toBe('high')
      expect(result.matched.length).toBeGreaterThan(2)
    })

    it('handles a typical engineering job description', () => {
      const profile = createMockProfile({
        skills: [
          { name: 'React' },
          { name: 'TypeScript' },
          { name: 'Node.js' },
          { name: 'GraphQL' }
        ],
        experience: [{
          id: 'exp-1',
          role: { title: 'Software Engineer' },
          projects: [{
            id: 'proj-1',
            name: 'API Platform',
            description: 'Built REST APIs and microservices with Docker',
            tags: ['rest api', 'microservices', 'docker']
          }]
        }]
      })

      const jobDescription = `
        Full Stack Engineer

        Tech Stack:
        - React / Next.js
        - TypeScript
        - Node.js / Express
        - PostgreSQL
        - AWS (Lambda, S3, DynamoDB)
        - Docker / Kubernetes

        Requirements:
        - Experience with CI/CD pipelines
        - Agile development experience
        - Strong problem-solving skills
      `

      const result = matchResumeToJob(profile, jobDescription)

      expect(result.score).toBeGreaterThan(30)
      expect(result.confidence).toBe('high')
      // Should identify missing skills like AWS, Kubernetes
      expect(result.missing.length).toBeGreaterThan(0)
    })
  })
})
