/**
 * Keyword Optimizer Service Tests
 *
 * Tests for skill reordering, text scoring, coverage analysis,
 * and full resume optimization.
 */

import { describe, it, expect } from 'vitest'
import {
  scoreTextRelevance,
  reorderSkillsByRelevance,
  analyzeKeywordCoverage,
  optimizeResumeForJob
} from './keyword-optimizer.js'

describe('scoreTextRelevance', () => {
  it('returns 0 for empty text', () => {
    expect(scoreTextRelevance('', ['react', 'node'])).toBe(0)
  })

  it('returns 0 for null text', () => {
    expect(scoreTextRelevance(null, ['react', 'node'])).toBe(0)
  })

  it('returns 0 for empty keywords', () => {
    expect(scoreTextRelevance('Some text', [])).toBe(0)
  })

  it('returns 0 for null keywords', () => {
    expect(scoreTextRelevance('Some text', null)).toBe(0)
  })

  it('counts matching keywords case-insensitively', () => {
    const text = 'I am proficient in React and Node.js development'
    const keywords = ['react', 'node', 'python']
    expect(scoreTextRelevance(text, keywords)).toBe(2)
  })

  it('handles uppercase keywords', () => {
    const text = 'react developer with node experience'
    const keywords = ['REACT', 'NODE']
    expect(scoreTextRelevance(text, keywords)).toBe(2)
  })

  it('returns 0 when no keywords match', () => {
    const text = 'Python and Django developer'
    const keywords = ['react', 'node']
    expect(scoreTextRelevance(text, keywords)).toBe(0)
  })

  it('counts each keyword only once even if repeated in text', () => {
    const text = 'React React React developer'
    const keywords = ['react']
    expect(scoreTextRelevance(text, keywords)).toBe(1)
  })
})

describe('reorderSkillsByRelevance', () => {
  describe('grouped format', () => {
    it('returns null for null input', () => {
      expect(reorderSkillsByRelevance(null, ['react'])).toBeNull()
    })

    it('returns undefined for undefined input', () => {
      expect(reorderSkillsByRelevance(undefined, ['react'])).toBeUndefined()
    })

    it('reorders skills within each category', () => {
      const skills = {
        'Technical': ['Python', 'React', 'Java'],
        'Design': ['Sketch', 'Figma', 'Adobe XD']
      }
      const keywords = ['react', 'figma']

      const result = reorderSkillsByRelevance(skills, keywords)

      expect(result['Technical'][0]).toBe('React')
      expect(result['Design'][0]).toBe('Figma')
    })

    it('preserves relative order for non-matching skills', () => {
      const skills = {
        'Technical': ['Python', 'Java', 'Go', 'React']
      }
      const keywords = ['react']

      const result = reorderSkillsByRelevance(skills, keywords)

      expect(result['Technical'][0]).toBe('React')
      // Non-matching skills maintain their relative order
      expect(result['Technical'].indexOf('Python')).toBeLessThan(result['Technical'].indexOf('Java'))
    })

    it('handles empty keywords', () => {
      const skills = {
        'Technical': ['Python', 'React', 'Java']
      }

      const result = reorderSkillsByRelevance(skills, [])

      // Order should be unchanged
      expect(result['Technical']).toEqual(['Python', 'React', 'Java'])
    })

    it('handles partial keyword matches', () => {
      const skills = {
        'Technical': ['Python', 'Node.js', 'Java']
      }
      const keywords = ['node']

      const result = reorderSkillsByRelevance(skills, keywords)

      expect(result['Technical'][0]).toBe('Node.js')
    })

    it('handles non-array category values', () => {
      const skills = {
        'Technical': ['React'],
        'Other': 'Not an array'
      }
      const keywords = ['react']

      const result = reorderSkillsByRelevance(skills, keywords)

      expect(result['Other']).toBe('Not an array')
    })
  })

  describe('flat array format', () => {
    it('reorders string array', () => {
      const skills = ['Python', 'React', 'Java']
      const keywords = ['react']

      const result = reorderSkillsByRelevance(skills, keywords)

      expect(result[0]).toBe('React')
    })

    it('reorders object array by name', () => {
      const skills = [
        { name: 'Python', proficiency: 'expert' },
        { name: 'React', proficiency: 'proficient' },
        { name: 'Java', proficiency: 'familiar' }
      ]
      const keywords = ['react']

      const result = reorderSkillsByRelevance(skills, keywords)

      expect(result[0].name).toBe('React')
    })

    it('handles multiple matching skills', () => {
      const skills = ['Python', 'React', 'Node', 'Java']
      const keywords = ['react', 'node']

      const result = reorderSkillsByRelevance(skills, keywords)

      // Both React and Node should be at the front
      expect(['React', 'Node']).toContain(result[0])
      expect(['React', 'Node']).toContain(result[1])
    })

    it('preserves order when no keywords match', () => {
      const skills = ['Python', 'Java', 'Go']
      const keywords = ['rust']

      const result = reorderSkillsByRelevance(skills, keywords)

      expect(result).toEqual(['Python', 'Java', 'Go'])
    })
  })
})

describe('analyzeKeywordCoverage', () => {
  it('returns 100% coverage for empty keywords', () => {
    const result = analyzeKeywordCoverage({ skills: ['React'] }, [])
    expect(result.coveragePercent).toBe(100)
    expect(result.total).toBe(0)
  })

  it('returns 100% coverage for null keywords', () => {
    const result = analyzeKeywordCoverage({ skills: ['React'] }, null)
    expect(result.coveragePercent).toBe(100)
  })

  it('calculates coverage correctly', () => {
    const resumeData = {
      skills: { Technical: ['React', 'Node'] },
      experience: [{ bullets: ['Python development'] }]
    }
    const keywords = ['react', 'node', 'python', 'java']

    const result = analyzeKeywordCoverage(resumeData, keywords)

    expect(result.total).toBe(4)
    expect(result.matched).toBe(3)
    expect(result.missing).toBe(1)
    expect(result.matchedKeywords).toContain('react')
    expect(result.matchedKeywords).toContain('node')
    expect(result.matchedKeywords).toContain('python')
    expect(result.missingKeywords).toContain('java')
    expect(result.coveragePercent).toBe(75)
  })

  it('searches stringified data', () => {
    const resumeData = {
      nested: {
        deep: {
          value: 'Contains react somewhere'
        }
      }
    }
    const keywords = ['react']

    const result = analyzeKeywordCoverage(resumeData, keywords)

    expect(result.matched).toBe(1)
  })

  it('handles case-insensitive matching', () => {
    const resumeData = { skills: ['REACT'] }
    const keywords = ['react']

    const result = analyzeKeywordCoverage(resumeData, keywords)

    expect(result.matched).toBe(1)
  })

  it('returns all missing when no matches', () => {
    const resumeData = { skills: ['Python'] }
    const keywords = ['react', 'node']

    const result = analyzeKeywordCoverage(resumeData, keywords)

    expect(result.matched).toBe(0)
    expect(result.missing).toBe(2)
    expect(result.coveragePercent).toBe(0)
  })
})

describe('optimizeResumeForJob', () => {
  const sampleResumeData = {
    contact: { name: 'John Doe' },
    summary: 'Experienced developer',
    skills: {
      'Technical': ['Python', 'React', 'Java'],
      'Design': ['Sketch', 'Figma']
    },
    experience: [
      {
        company: 'Acme Corp',
        title: 'Developer',
        bullets: [
          'Built Python microservices',
          'Created React dashboard',
          'Led team of 5 developers'
        ]
      }
    ]
  }

  const reactJobDescription = 'Looking for a React developer with Node.js experience to build modern web applications. Experience with TypeScript and testing frameworks preferred.'

  it('returns empty optimizations for null resume data', () => {
    const result = optimizeResumeForJob(null, reactJobDescription)

    expect(result.optimizedData).toBeNull()
    expect(result.optimizations).toEqual([])
    expect(result.summary).toBe('No resume data provided')
  })

  it('does not mutate original resume data', () => {
    const original = JSON.stringify(sampleResumeData)
    optimizeResumeForJob(sampleResumeData, reactJobDescription)

    expect(JSON.stringify(sampleResumeData)).toBe(original)
  })

  it('reorders skills based on job keywords', () => {
    const result = optimizeResumeForJob(sampleResumeData, reactJobDescription)

    expect(result.optimizedData.skills['Technical'][0]).toBe('React')
  })

  it('tracks skill reordering optimization', () => {
    const result = optimizeResumeForJob(sampleResumeData, reactJobDescription)

    const skillOpt = result.optimizations.find(o => o.section === 'skills')
    expect(skillOpt).toBeDefined()
    expect(skillOpt.action).toBe('reordered')
    expect(skillOpt.reason).toContain('job-relevant')
  })

  it('reorders experience bullets by relevance', () => {
    const result = optimizeResumeForJob(sampleResumeData, reactJobDescription)

    // 'Created React dashboard' should be first (has 'react')
    const bullets = result.optimizedData.experience[0].bullets
    expect(bullets[0]).toContain('React')
  })

  it('tracks bullet reordering optimization', () => {
    const result = optimizeResumeForJob(sampleResumeData, reactJobDescription)

    const bulletOpt = result.optimizations.find(o => o.action === 'reordered_bullets')
    expect(bulletOpt).toBeDefined()
    expect(bulletOpt.section).toContain('Acme Corp')
    expect(bulletOpt.reason).toContain('relevant')
  })

  it('calculates keyword coverage', () => {
    const result = optimizeResumeForJob(sampleResumeData, reactJobDescription)

    expect(result.keywordCoverage).toHaveProperty('total')
    expect(result.keywordCoverage).toHaveProperty('matched')
    expect(result.keywordCoverage).toHaveProperty('missing')
    expect(result.keywordCoverage).toHaveProperty('coveragePercent')
  })

  it('includes research integration when research provided', () => {
    const research = {
      highlights: ['Fast-growing startup', 'Remote-first culture']
    }

    const result = optimizeResumeForJob(sampleResumeData, reactJobDescription, research)

    expect(result.researchIntegration).not.toBeNull()
    expect(result.researchIntegration.available).toBe(true)
    expect(result.researchIntegration.suggested).toContain('Fast-growing startup')
  })

  it('returns null research integration when no research', () => {
    const result = optimizeResumeForJob(sampleResumeData, reactJobDescription)

    expect(result.researchIntegration).toBeNull()
  })

  it('returns null research integration when research has no highlights', () => {
    const research = { highlights: [] }

    const result = optimizeResumeForJob(sampleResumeData, reactJobDescription, research)

    expect(result.researchIntegration).toBeNull()
  })

  it('generates summary with optimization count and coverage', () => {
    const result = optimizeResumeForJob(sampleResumeData, reactJobDescription)

    expect(result.summary).toMatch(/\d+ optimizations applied/)
    expect(result.summary).toMatch(/\d+\/\d+ keywords covered/)
  })

  it('handles empty job description', () => {
    const result = optimizeResumeForJob(sampleResumeData, '')

    expect(result.optimizations).toEqual([])
    expect(result.keywordCoverage.total).toBe(0)
  })

  it('handles resume with flat skills array', () => {
    const resumeWithFlatSkills = {
      skills: ['Python', 'React', 'Java'],
      experience: []
    }

    const result = optimizeResumeForJob(resumeWithFlatSkills, reactJobDescription)

    expect(result.optimizedData.skills[0]).toBe('React')
  })

  it('handles experience without bullets', () => {
    const resumeNoBullets = {
      skills: { Technical: ['React'] },
      experience: [
        { company: 'Acme', title: 'Dev' }
      ]
    }

    const result = optimizeResumeForJob(resumeNoBullets, reactJobDescription)

    expect(result.optimizedData.experience[0].company).toBe('Acme')
  })

  it('handles experience with single bullet', () => {
    const resumeSingleBullet = {
      skills: { Technical: ['React'] },
      experience: [
        { company: 'Acme', bullets: ['Only one bullet'] }
      ]
    }

    const result = optimizeResumeForJob(resumeSingleBullet, reactJobDescription)

    // Should not add reordering optimization for single bullet
    const bulletOpt = result.optimizations.find(o => o.action === 'reordered_bullets')
    expect(bulletOpt).toBeUndefined()
  })

  it('does not add optimization when skills order unchanged', () => {
    const alreadyOptimized = {
      skills: { Technical: ['React', 'Python', 'Java'] },
      experience: []
    }

    const result = optimizeResumeForJob(alreadyOptimized, reactJobDescription)

    const skillOpt = result.optimizations.find(o => o.section === 'skills')
    expect(skillOpt).toBeUndefined()
  })

  it('does not add optimization when bullets order unchanged', () => {
    const alreadyOptimized = {
      skills: { Technical: ['React'] },
      experience: [
        {
          company: 'Acme',
          bullets: [
            'React dashboard development',
            'Python backend work'
          ]
        }
      ]
    }

    const result = optimizeResumeForJob(alreadyOptimized, reactJobDescription)

    const bulletOpt = result.optimizations.find(o =>
      o.action === 'reordered_bullets' && o.section.includes('Acme')
    )
    // If React bullet is already first, no reordering needed
    if (alreadyOptimized.experience[0].bullets[0].includes('React')) {
      expect(bulletOpt).toBeUndefined()
    }
  })

  it('uses title when company is missing for section name', () => {
    const resumeNoCompany = {
      skills: {},
      experience: [
        {
          title: 'Senior Developer',
          bullets: [
            'Python work',
            'React development'
          ]
        }
      ]
    }

    const result = optimizeResumeForJob(resumeNoCompany, reactJobDescription)

    const bulletOpt = result.optimizations.find(o => o.action === 'reordered_bullets')
    if (bulletOpt) {
      expect(bulletOpt.section).toContain('Senior Developer')
    }
  })
})
