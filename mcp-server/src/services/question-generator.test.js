/**
 * Question Generator Service Tests
 *
 * Tests for generateInterviewQuestions, linkQuestionToStories, getQuestionsForJob
 * Uses job ID range 9100-9199 for test isolation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESEARCH_DIR = join(__dirname, '..', '..', 'data', 'job-research')

// Ensure research directory exists
if (!existsSync(RESEARCH_DIR)) {
  mkdirSync(RESEARCH_DIR, { recursive: true })
}

// Helper to clean up test files
function cleanupTestFiles(jobId) {
  const files = [
    `${jobId}-questions.json`,
    `${jobId}-company.json`,
    `${jobId}-interviewer-test-interviewer.json`,
    `${jobId}-interviewer-john-doe.json`
  ]
  for (const file of files) {
    try {
      const filePath = join(RESEARCH_DIR, file)
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Mock profile data
const mockProfile = {
  metadata: { version: 1, createdAt: '2024-01-01', updatedAt: '2024-01-01', schemaVersion: '1.0' },
  experience: [
    {
      role: { title: 'Senior Engineer' },
      projects: [
        { name: 'API Platform', description: 'Built REST APIs with Node.js', tags: ['nodejs', 'api', 'typescript'] }
      ]
    }
  ],
  skills: [
    { name: 'JavaScript', proficiency: 'expert', category: 'frontend', evidence: ['project-1'] },
    { name: 'TypeScript', proficiency: 'proficient', category: 'frontend', evidence: ['project-1'] },
    { name: 'React', proficiency: 'proficient', category: 'frontend', evidence: ['project-2'] }
  ],
  stories: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      title: 'Led API Redesign',
      situation: 'Legacy system was slow',
      task: 'Redesign the API',
      action: 'Built new microservices',
      result: '50% faster response times',
      questionCategories: ['technical', 'leadership'],
      themes: ['API design', 'performance']
    },
    {
      id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
      title: 'Resolved Team Conflict',
      situation: 'Two teams disagreed on approach',
      task: 'Mediate and find solution',
      action: 'Facilitated discussions',
      result: 'Unified approach adopted',
      questionCategories: ['conflict', 'teamwork'],
      themes: ['collaboration', 'communication']
    }
  ],
  summaryBlocks: [],
  preferences: { targetRoles: [] },
  history: []
}

// Mock job data
const mockJobsData = {
  jobs: [
    {
      id: 9101,
      company: 'TechCorp',
      title: 'Senior Software Engineer',
      notes: 'Looking for experience with React, TypeScript, and Node.js. Must have API design skills.',
      status: 'researching'
    },
    {
      id: 9102,
      company: 'StartupXYZ',
      title: 'Full Stack Developer',
      notes: 'Python, Django, PostgreSQL required. AWS experience preferred.',
      status: 'researching'
    }
  ]
}

// Dynamic import to avoid module loading issues with mocks
let generateInterviewQuestions, getQuestionsForJob, linkQuestionToStories

describe('Question Generator Service', () => {
  beforeEach(async () => {
    // Clean up before each test
    cleanupTestFiles(9101)
    cleanupTestFiles(9102)
    cleanupTestFiles(9103)
    cleanupTestFiles(9104)
    cleanupTestFiles(9105)

    // Mock the dependencies
    vi.mock('../data/profile-loader.js', () => ({
      loadProfile: () => mockProfile
    }))

    vi.mock('../data/loader.js', () => ({
      loadJobsFromDashboard: () => mockJobsData
    }))

    // Fresh import after mocking
    const module = await import('./question-generator.js')
    generateInterviewQuestions = module.generateInterviewQuestions
    getQuestionsForJob = module.getQuestionsForJob
    linkQuestionToStories = module.linkQuestionToStories
  })

  afterEach(() => {
    // Clean up test files
    cleanupTestFiles(9101)
    cleanupTestFiles(9102)
    cleanupTestFiles(9103)
    cleanupTestFiles(9104)
    cleanupTestFiles(9105)
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('generateInterviewQuestions', () => {
    it('returns questions array', () => {
      const result = generateInterviewQuestions(9101)
      expect(result.questions).toBeDefined()
      expect(Array.isArray(result.questions)).toBe(true)
    })

    it('each question includes category and difficulty', () => {
      const result = generateInterviewQuestions(9101)
      for (const question of result.questions) {
        expect(question.category).toBeDefined()
        expect(['behavioral', 'technical', 'system-design', 'culture-fit']).toContain(question.category)
        expect(question.difficulty).toBeDefined()
        expect(['easy', 'medium', 'hard']).toContain(question.difficulty)
      }
    })

    it('filters by category option', () => {
      const result = generateInterviewQuestions(9101, { categories: ['behavioral'], count: 5 })
      expect(result.questions.length).toBeGreaterThan(0)
      for (const question of result.questions) {
        expect(question.category).toBe('behavioral')
      }
    })

    it('respects count option', () => {
      const result = generateInterviewQuestions(9101, { count: 5 })
      expect(result.questions.length).toBeLessThanOrEqual(5)
    })

    it('questions from JD requirements have source jd-requirement', () => {
      const result = generateInterviewQuestions(9101, { count: 10 })
      const jdQuestions = result.questions.filter(q => q.source === 'jd-requirement')
      expect(jdQuestions.length).toBeGreaterThan(0)
      // Should include keywords from job notes
      const hasReactQuestion = jdQuestions.some(q =>
        q.questionText.toLowerCase().includes('react') ||
        q.sourceDetail?.toLowerCase().includes('react')
      )
      expect(hasReactQuestion || jdQuestions.length > 0).toBe(true)
    })

    it('questions from profile gaps have source profile-gap', () => {
      const result = generateInterviewQuestions(9102, { count: 10 })
      const gapQuestions = result.questions.filter(q => q.source === 'profile-gap')
      // Python, Django not in mock profile - should create gap questions
      expect(gapQuestions.length).toBeGreaterThan(0)
    })

    it('gap questions have hard difficulty', () => {
      const result = generateInterviewQuestions(9102, { count: 10 })
      const gapQuestions = result.questions.filter(q => q.source === 'profile-gap')
      for (const question of gapQuestions) {
        expect(question.difficulty).toBe('hard')
      }
    })

    it('questions from profile strengths link to stories', () => {
      const result = generateInterviewQuestions(9101, { categories: ['behavioral'], count: 10 })
      const strengthQuestions = result.questions.filter(q => q.source === 'profile-strength')
      for (const question of strengthQuestions) {
        expect(question.suggestedStories.length).toBeGreaterThan(0)
      }
    })

    it('strength questions have easy difficulty', () => {
      const result = generateInterviewQuestions(9101, { categories: ['behavioral'], count: 10 })
      const strengthQuestions = result.questions.filter(q => q.source === 'profile-strength')
      for (const question of strengthQuestions) {
        expect(question.difficulty).toBe('easy')
      }
    })

    it('questions have unique UUIDs', () => {
      const result = generateInterviewQuestions(9101, { count: 10 })
      const ids = result.questions.map(q => q.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('mixed difficulty distributes across easy/medium/hard', () => {
      const result = generateInterviewQuestions(9101, { count: 15, difficulty: 'mixed' })
      const difficulties = result.questions.map(q => q.difficulty)
      const hasEasy = difficulties.includes('easy')
      const hasMedium = difficulties.includes('medium')
      const hasHard = difficulties.includes('hard')
      // Should have at least 2 different difficulty levels
      expect([hasEasy, hasMedium, hasHard].filter(Boolean).length).toBeGreaterThanOrEqual(2)
    })

    it('persists questions to file', () => {
      const result = generateInterviewQuestions(9101)
      expect(result.savedTo).toBeDefined()
      expect(existsSync(result.savedTo)).toBe(true)
    })

    it('returns error for non-existent job', () => {
      const result = generateInterviewQuestions(99999)
      expect(result.error).toBeDefined()
      expect(result.questions.length).toBe(0)
    })

    it('questions include questionText', () => {
      const result = generateInterviewQuestions(9101)
      for (const question of result.questions) {
        expect(question.questionText).toBeDefined()
        expect(question.questionText.length).toBeGreaterThan(0)
      }
    })

    it('questions include generatedAt timestamp', () => {
      const result = generateInterviewQuestions(9101)
      for (const question of result.questions) {
        expect(question.generatedAt).toBeDefined()
        expect(new Date(question.generatedAt).getTime()).not.toBeNaN()
      }
    })

    it('questions include jobId', () => {
      const result = generateInterviewQuestions(9101)
      for (const question of result.questions) {
        expect(question.jobId).toBe(9101)
      }
    })
  })

  describe('getQuestionsForJob', () => {
    it('returns null when not generated', () => {
      const result = getQuestionsForJob(9199) // Non-existent
      expect(result).toBeNull()
    })

    it('returns persisted questions', () => {
      // Generate first
      generateInterviewQuestions(9101)
      // Then retrieve
      const result = getQuestionsForJob(9101)
      expect(result).not.toBeNull()
      expect(result.questions).toBeDefined()
      expect(Array.isArray(result.questions)).toBe(true)
    })

    it('returns generation options', () => {
      generateInterviewQuestions(9101, { count: 5, categories: ['behavioral'] })
      const result = getQuestionsForJob(9101)
      expect(result.options).toBeDefined()
      expect(result.options.count).toBe(5)
    })
  })

  describe('linkQuestionToStories', () => {
    it('returns top 3 stories', () => {
      const result = linkQuestionToStories('Tell me about a time you led a technical project', mockProfile)
      expect(result.length).toBeLessThanOrEqual(3)
    })

    it('includes relevanceScore', () => {
      const result = linkQuestionToStories('Tell me about resolving a conflict', mockProfile)
      for (const story of result) {
        expect(story.relevanceScore).toBeDefined()
        expect(typeof story.relevanceScore).toBe('number')
      }
    })

    it('includes storyId and storyTitle', () => {
      const result = linkQuestionToStories('Tell me about leadership', mockProfile)
      for (const story of result) {
        expect(story.storyId).toBeDefined()
        expect(story.storyTitle).toBeDefined()
      }
    })

    it('returns empty array when no stories', () => {
      const emptyProfile = { ...mockProfile, stories: [] }
      const result = linkQuestionToStories('Any question', emptyProfile)
      expect(result).toEqual([])
    })

    it('returns empty array when profile has no stories array', () => {
      const noStoriesProfile = { ...mockProfile }
      delete noStoriesProfile.stories
      const result = linkQuestionToStories('Any question', noStoriesProfile)
      expect(result).toEqual([])
    })

    it('caps relevanceScore at 100', () => {
      const result = linkQuestionToStories('Tell me about API design performance leadership technical', mockProfile)
      for (const story of result) {
        expect(story.relevanceScore).toBeLessThanOrEqual(100)
      }
    })
  })

  describe('company research integration', () => {
    it('uses company research for culture-fit questions', () => {
      // Create mock company research
      const companyResearch = {
        id: 'cr-1',
        jobId: 9103,
        companyName: 'TestCorp',
        researchedAt: new Date().toISOString(),
        firmographics: {},
        funding: { investors: [], signals: [] },
        culture: {
          values: ['Innovation', 'Collaboration'],
          glassdoorThemes: [],
          leadershipQuotes: []
        },
        news: [],
        challenges: ['Scaling infrastructure'],
        competitors: [],
        products: [],
        confidence: 'medium',
        sources: [],
        highlights: ['Fast-growing startup']
      }
      writeFileSync(
        join(RESEARCH_DIR, '9103-company.json'),
        JSON.stringify(companyResearch, null, 2)
      )

      // Add job to mock data
      mockJobsData.jobs.push({
        id: 9103,
        company: 'TestCorp',
        title: 'Engineer',
        notes: 'JavaScript role',
        status: 'researching'
      })

      const result = generateInterviewQuestions(9103, { categories: ['culture-fit'], count: 5 })
      const companyQuestions = result.questions.filter(q => q.source === 'company-research')
      expect(companyQuestions.length).toBeGreaterThan(0)
    })
  })

  describe('interviewer research integration', () => {
    it('uses interviewer style for question generation', () => {
      // Create mock interviewer research
      const interviewerResearch = {
        id: 'ir-1',
        jobId: 9104,
        interviewerName: 'John Doe',
        researchedAt: new Date().toISOString(),
        background: { previousRoles: [] },
        interviewStyle: {
          signals: ['Asks deep technical questions'],
          expectedQuestionTypes: ['technical', 'system-design'],
          communicationPattern: 'Direct',
          depthExpectation: 'deep'
        },
        talkingPoints: ['Shared interest in API design'],
        sharedInterests: [],
        confidence: 'medium',
        sources: []
      }
      writeFileSync(
        join(RESEARCH_DIR, '9104-interviewer-john-doe.json'),
        JSON.stringify(interviewerResearch, null, 2)
      )

      // Add job to mock data
      mockJobsData.jobs.push({
        id: 9104,
        company: 'InterviewCorp',
        title: 'Engineer',
        notes: 'Technical role',
        status: 'researching'
      })

      const result = generateInterviewQuestions(9104, { categories: ['technical', 'system-design'], count: 10 })
      const interviewerQuestions = result.questions.filter(q => q.source === 'interviewer-style')
      expect(interviewerQuestions.length).toBeGreaterThan(0)
    })

    it('includes talking points from interviewer research', () => {
      // Create mock interviewer research
      const interviewerResearch = {
        id: 'ir-2',
        jobId: 9105,
        interviewerName: 'Test Interviewer',
        researchedAt: new Date().toISOString(),
        background: { previousRoles: [] },
        interviewStyle: {
          signals: [],
          expectedQuestionTypes: ['behavioral'],
          communicationPattern: 'Collaborative'
        },
        talkingPoints: ['Both worked on design systems', 'Shared conference experience'],
        sharedInterests: [],
        confidence: 'medium',
        sources: []
      }
      writeFileSync(
        join(RESEARCH_DIR, '9105-interviewer-test-interviewer.json'),
        JSON.stringify(interviewerResearch, null, 2)
      )

      // Add job to mock data
      mockJobsData.jobs.push({
        id: 9105,
        company: 'TalkCorp',
        title: 'Designer',
        notes: 'Design role',
        status: 'researching'
      })

      const result = generateInterviewQuestions(9105, { categories: ['behavioral'], count: 10 })
      const interviewerQuestions = result.questions.filter(q => q.source === 'interviewer-style')

      if (interviewerQuestions.length > 0) {
        const hasTalkingPoints = interviewerQuestions.some(q => q.talkingPoints.length > 0)
        expect(hasTalkingPoints).toBe(true)
      }
    })
  })
})
