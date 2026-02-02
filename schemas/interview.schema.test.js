/**
 * Interview Schema Tests
 *
 * Tests Zod validation for interview preparation domain schemas:
 * - InterviewerResearchSchema
 * - InterviewQuestionSchema
 * - PracticeAnswerSchema
 * - PracticeSessionSchema
 * - PrepProgressSchema
 */

import { describe, it, expect } from 'vitest'
import {
  InterviewerResearchSchema,
  InterviewQuestionSchema,
  PracticeAnswerSchema,
  PracticeSessionSchema,
  PrepProgressSchema,
  validateInterviewerResearch,
  validateInterviewQuestion,
  validatePracticeAnswer,
  validatePracticeSession,
  validatePrepProgress
} from './interview.schema.js'

// =============================================================================
// TEST FIXTURES
// =============================================================================

const validInterviewerResearch = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  jobId: 1001,
  interviewerName: 'Jane Smith',
  interviewerTitle: 'Engineering Manager',
  interviewRound: 'onsite',
  researchedAt: '2026-02-02T10:00:00.000Z',
  background: {
    currentRole: 'Engineering Manager',
    company: 'TechCorp',
    previousRoles: ['Senior Engineer at PrevCo', 'Tech Lead at OldCorp'],
    yearsInRole: 3,
    linkedInUrl: 'https://linkedin.com/in/janesmith'
  },
  interviewStyle: {
    signals: ['Values technical depth', 'Asks behavioral questions'],
    expectedQuestionTypes: ['behavioral', 'technical', 'system-design'],
    communicationPattern: 'Direct and efficient',
    depthExpectation: 'deep'
  },
  talkingPoints: [
    'Discuss her recent post on distributed systems',
    'Mention shared interest in mentoring'
  ],
  sharedInterests: ['Distributed systems', 'Engineering leadership'],
  confidence: 'medium',
  sources: ['LinkedIn', 'Glassdoor reviews']
}

const validInterviewQuestion = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  jobId: 1001,
  questionText: 'Tell me about a time you handled a conflict with a teammate.',
  category: 'behavioral',
  difficulty: 'medium',
  source: 'jd-requirement',
  sourceDetail: 'JD mentions strong collaboration skills',
  suggestedStories: [
    {
      storyId: '550e8400-e29b-41d4-a716-446655440002',
      storyTitle: 'Resolved API design disagreement',
      relevanceScore: 85
    }
  ],
  talkingPoints: ['Emphasize empathy', 'Show compromise'],
  generatedAt: '2026-02-02T10:00:00.000Z',
  interviewerId: '550e8400-e29b-41d4-a716-446655440000'
}

const validPracticeAnswer = {
  questionId: '550e8400-e29b-41d4-a716-446655440001',
  answerText: 'In my previous role, I worked with a colleague who had a different vision for our API design...',
  inputMethod: 'text',
  answeredAt: '2026-02-02T11:00:00.000Z',
  score: {
    overall: 78,
    storyCoverage: 85,
    starStructure: 72,
    relevance: 80,
    clarity: 75
  },
  feedback: {
    strengths: ['Good use of STAR structure', 'Clear situation description'],
    improvements: ['Could elaborate more on the Result', 'Consider quantifying the impact'],
    suggestedRewrite: 'Consider adding: "As a result, our API latency improved by 40%..."'
  }
}

const validVoiceAnswer = {
  questionId: '550e8400-e29b-41d4-a716-446655440001',
  answerText: 'Transcribed voice answer about handling conflict...',
  inputMethod: 'voice',
  answeredAt: '2026-02-02T11:30:00.000Z',
  duration: 120 // 2 minutes in seconds
}

const validPracticeSession = {
  id: '550e8400-e29b-41d4-a716-446655440003',
  jobId: 1001,
  sessionType: 'full-interview',
  startedAt: '2026-02-02T10:00:00.000Z',
  completedAt: '2026-02-02T11:00:00.000Z',
  answers: [validPracticeAnswer],
  feedbackTiming: 'immediate',
  summary: {
    questionsAttempted: 5,
    averageScore: 78,
    strongCategories: ['behavioral', 'culture-fit'],
    improvementAreas: ['technical', 'system-design']
  }
}

const validPrepProgress = {
  jobId: 1001,
  lastUpdated: '2026-02-02T12:00:00.000Z',
  totalSessions: 3,
  totalQuestionsAnswered: 15,
  scoreHistory: [
    { date: '2026-02-01T10:00:00.000Z', category: 'behavioral', score: 70 },
    { date: '2026-02-02T10:00:00.000Z', category: 'behavioral', score: 78 }
  ],
  readiness: {
    overall: 72,
    byCategory: { behavioral: 78, technical: 65, 'culture-fit': 80 },
    confidenceLevel: 'needs-work'
  },
  focusAreas: [
    {
      category: 'technical',
      reason: 'Lowest average score across sessions',
      recommendedPractice: 'Practice 3 more system design questions'
    }
  ]
}

// =============================================================================
// INTERVIEWER RESEARCH SCHEMA TESTS
// =============================================================================

describe('InterviewerResearchSchema', () => {
  describe('valid data', () => {
    it('validates complete interviewer research', () => {
      const result = InterviewerResearchSchema.safeParse(validInterviewerResearch)
      expect(result.success).toBe(true)
      expect(result.data.interviewerName).toBe('Jane Smith')
    })

    it('validates minimal required fields', () => {
      const minimal = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        jobId: 1001,
        interviewerName: 'John Doe',
        researchedAt: '2026-02-02T10:00:00.000Z',
        confidence: 'low'
      }
      const result = InterviewerResearchSchema.safeParse(minimal)
      expect(result.success).toBe(true)
    })

    it('applies default values for optional arrays', () => {
      const minimal = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        jobId: 1001,
        interviewerName: 'John Doe',
        researchedAt: '2026-02-02T10:00:00.000Z',
        confidence: 'low'
      }
      const result = InterviewerResearchSchema.safeParse(minimal)
      expect(result.success).toBe(true)
      expect(result.data.talkingPoints).toEqual([])
      expect(result.data.sharedInterests).toEqual([])
      expect(result.data.sources).toEqual([])
      expect(result.data.background.previousRoles).toEqual([])
      expect(result.data.interviewStyle.signals).toEqual([])
      expect(result.data.interviewStyle.expectedQuestionTypes).toEqual([])
    })
  })

  describe('required field validation', () => {
    it('rejects missing id', () => {
      const { id, ...data } = validInterviewerResearch
      const result = InterviewerResearchSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('rejects missing jobId', () => {
      const { jobId, ...data } = validInterviewerResearch
      const result = InterviewerResearchSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('rejects missing interviewerName', () => {
      const { interviewerName, ...data } = validInterviewerResearch
      const result = InterviewerResearchSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('rejects empty interviewerName', () => {
      const data = { ...validInterviewerResearch, interviewerName: '' }
      const result = InterviewerResearchSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('rejects missing confidence', () => {
      const { confidence, ...data } = validInterviewerResearch
      const result = InterviewerResearchSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('rejects invalid uuid', () => {
      const data = { ...validInterviewerResearch, id: 'not-a-uuid' }
      const result = InterviewerResearchSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('confidence level enum', () => {
    it('accepts high confidence', () => {
      const data = { ...validInterviewerResearch, confidence: 'high' }
      const result = InterviewerResearchSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('accepts medium confidence', () => {
      const data = { ...validInterviewerResearch, confidence: 'medium' }
      const result = InterviewerResearchSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('accepts low confidence', () => {
      const data = { ...validInterviewerResearch, confidence: 'low' }
      const result = InterviewerResearchSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('rejects invalid confidence', () => {
      const data = { ...validInterviewerResearch, confidence: 'invalid' }
      const result = InterviewerResearchSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('interviewStyle validation', () => {
    it('accepts valid question types', () => {
      const questionTypes = ['behavioral', 'technical', 'system-design', 'culture-fit', 'case-study']
      questionTypes.forEach(type => {
        const data = {
          ...validInterviewerResearch,
          interviewStyle: { ...validInterviewerResearch.interviewStyle, expectedQuestionTypes: [type] }
        }
        const result = InterviewerResearchSchema.safeParse(data)
        expect(result.success).toBe(true)
      })
    })

    it('rejects invalid question type', () => {
      const data = {
        ...validInterviewerResearch,
        interviewStyle: { ...validInterviewerResearch.interviewStyle, expectedQuestionTypes: ['invalid-type'] }
      }
      const result = InterviewerResearchSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('accepts valid depth expectations', () => {
      const depths = ['surface', 'moderate', 'deep']
      depths.forEach(depth => {
        const data = {
          ...validInterviewerResearch,
          interviewStyle: { ...validInterviewerResearch.interviewStyle, depthExpectation: depth }
        }
        const result = InterviewerResearchSchema.safeParse(data)
        expect(result.success).toBe(true)
      })
    })

    it('rejects invalid depth expectation', () => {
      const data = {
        ...validInterviewerResearch,
        interviewStyle: { ...validInterviewerResearch.interviewStyle, depthExpectation: 'invalid' }
      }
      const result = InterviewerResearchSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })
})

// =============================================================================
// INTERVIEW QUESTION SCHEMA TESTS
// =============================================================================

describe('InterviewQuestionSchema', () => {
  describe('valid data', () => {
    it('validates complete interview question', () => {
      const result = InterviewQuestionSchema.safeParse(validInterviewQuestion)
      expect(result.success).toBe(true)
      expect(result.data.questionText).toContain('conflict')
    })

    it('validates minimal required fields', () => {
      const minimal = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        jobId: 1001,
        questionText: 'Describe your experience with React.',
        category: 'technical',
        difficulty: 'easy',
        source: 'jd-requirement',
        generatedAt: '2026-02-02T10:00:00.000Z'
      }
      const result = InterviewQuestionSchema.safeParse(minimal)
      expect(result.success).toBe(true)
    })

    it('applies default empty arrays', () => {
      const minimal = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        jobId: 1001,
        questionText: 'Test question',
        category: 'behavioral',
        difficulty: 'medium',
        source: 'profile-gap',
        generatedAt: '2026-02-02T10:00:00.000Z'
      }
      const result = InterviewQuestionSchema.safeParse(minimal)
      expect(result.success).toBe(true)
      expect(result.data.suggestedStories).toEqual([])
      expect(result.data.talkingPoints).toEqual([])
    })
  })

  describe('category enum', () => {
    it('accepts all valid categories', () => {
      const categories = ['behavioral', 'technical', 'system-design', 'culture-fit']
      categories.forEach(category => {
        const data = { ...validInterviewQuestion, category }
        const result = InterviewQuestionSchema.safeParse(data)
        expect(result.success).toBe(true)
      })
    })

    it('rejects invalid category', () => {
      const data = { ...validInterviewQuestion, category: 'invalid' }
      const result = InterviewQuestionSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('difficulty enum', () => {
    it('accepts all valid difficulties', () => {
      const difficulties = ['easy', 'medium', 'hard']
      difficulties.forEach(difficulty => {
        const data = { ...validInterviewQuestion, difficulty }
        const result = InterviewQuestionSchema.safeParse(data)
        expect(result.success).toBe(true)
      })
    })

    it('rejects invalid difficulty', () => {
      const data = { ...validInterviewQuestion, difficulty: 'expert' }
      const result = InterviewQuestionSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('source enum', () => {
    it('accepts all valid sources', () => {
      const sources = ['jd-requirement', 'profile-gap', 'profile-strength', 'company-research', 'interviewer-style']
      sources.forEach(source => {
        const data = { ...validInterviewQuestion, source }
        const result = InterviewQuestionSchema.safeParse(data)
        expect(result.success).toBe(true)
      })
    })

    it('rejects invalid source', () => {
      const data = { ...validInterviewQuestion, source: 'random' }
      const result = InterviewQuestionSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('suggestedStories validation', () => {
    it('validates story with all fields', () => {
      const result = InterviewQuestionSchema.safeParse(validInterviewQuestion)
      expect(result.success).toBe(true)
      expect(result.data.suggestedStories[0].storyId).toBeDefined()
      expect(result.data.suggestedStories[0].storyTitle).toBe('Resolved API design disagreement')
      expect(result.data.suggestedStories[0].relevanceScore).toBe(85)
    })

    it('rejects story with invalid uuid', () => {
      const data = {
        ...validInterviewQuestion,
        suggestedStories: [{ storyId: 'not-uuid', storyTitle: 'Test', relevanceScore: 50 }]
      }
      const result = InterviewQuestionSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('rejects story with score over 100', () => {
      const data = {
        ...validInterviewQuestion,
        suggestedStories: [{ storyId: '550e8400-e29b-41d4-a716-446655440002', storyTitle: 'Test', relevanceScore: 150 }]
      }
      const result = InterviewQuestionSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('rejects story with negative score', () => {
      const data = {
        ...validInterviewQuestion,
        suggestedStories: [{ storyId: '550e8400-e29b-41d4-a716-446655440002', storyTitle: 'Test', relevanceScore: -10 }]
      }
      const result = InterviewQuestionSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })
})

// =============================================================================
// PRACTICE ANSWER SCHEMA TESTS
// =============================================================================

describe('PracticeAnswerSchema', () => {
  describe('valid data', () => {
    it('validates complete text answer with score and feedback', () => {
      const result = PracticeAnswerSchema.safeParse(validPracticeAnswer)
      expect(result.success).toBe(true)
      expect(result.data.inputMethod).toBe('text')
    })

    it('validates voice answer with duration', () => {
      const result = PracticeAnswerSchema.safeParse(validVoiceAnswer)
      expect(result.success).toBe(true)
      expect(result.data.inputMethod).toBe('voice')
      expect(result.data.duration).toBe(120)
    })

    it('validates minimal answer without score/feedback', () => {
      const minimal = {
        questionId: '550e8400-e29b-41d4-a716-446655440001',
        answerText: 'My answer...',
        inputMethod: 'text',
        answeredAt: '2026-02-02T11:00:00.000Z'
      }
      const result = PracticeAnswerSchema.safeParse(minimal)
      expect(result.success).toBe(true)
      expect(result.data.score).toBeUndefined()
      expect(result.data.feedback).toBeUndefined()
    })
  })

  describe('inputMethod enum', () => {
    it('accepts text input method', () => {
      const data = { ...validPracticeAnswer, inputMethod: 'text' }
      const result = PracticeAnswerSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('accepts voice input method', () => {
      const data = { ...validPracticeAnswer, inputMethod: 'voice' }
      const result = PracticeAnswerSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('rejects invalid input method', () => {
      const data = { ...validPracticeAnswer, inputMethod: 'video' }
      const result = PracticeAnswerSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('score validation', () => {
    it('validates scores at boundaries', () => {
      const data = {
        ...validPracticeAnswer,
        score: { overall: 0, storyCoverage: 100, starStructure: 50, relevance: 0, clarity: 100 }
      }
      const result = PracticeAnswerSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('rejects score below 0', () => {
      const data = {
        ...validPracticeAnswer,
        score: { ...validPracticeAnswer.score, overall: -1 }
      }
      const result = PracticeAnswerSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('rejects score above 100', () => {
      const data = {
        ...validPracticeAnswer,
        score: { ...validPracticeAnswer.score, overall: 101 }
      }
      const result = PracticeAnswerSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('feedback validation', () => {
    it('validates complete feedback', () => {
      const result = PracticeAnswerSchema.safeParse(validPracticeAnswer)
      expect(result.success).toBe(true)
      expect(result.data.feedback.strengths).toHaveLength(2)
      expect(result.data.feedback.improvements).toHaveLength(2)
      expect(result.data.feedback.suggestedRewrite).toContain('API latency')
    })

    it('applies default empty arrays for feedback', () => {
      const data = {
        ...validPracticeAnswer,
        feedback: { suggestedRewrite: 'Try this instead...' }
      }
      const result = PracticeAnswerSchema.safeParse(data)
      expect(result.success).toBe(true)
      expect(result.data.feedback.strengths).toEqual([])
      expect(result.data.feedback.improvements).toEqual([])
    })

    it('allows feedback without suggestedRewrite', () => {
      const data = {
        ...validPracticeAnswer,
        feedback: { strengths: ['Good structure'], improvements: ['Add metrics'] }
      }
      const result = PracticeAnswerSchema.safeParse(data)
      expect(result.success).toBe(true)
      expect(result.data.feedback.suggestedRewrite).toBeUndefined()
    })
  })
})

// =============================================================================
// PRACTICE SESSION SCHEMA TESTS
// =============================================================================

describe('PracticeSessionSchema', () => {
  describe('valid data', () => {
    it('validates complete practice session', () => {
      const result = PracticeSessionSchema.safeParse(validPracticeSession)
      expect(result.success).toBe(true)
      expect(result.data.sessionType).toBe('full-interview')
      expect(result.data.answers).toHaveLength(1)
    })

    it('validates minimal session without summary', () => {
      const minimal = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        jobId: 1001,
        sessionType: 'single-question',
        startedAt: '2026-02-02T10:00:00.000Z',
        feedbackTiming: 'immediate'
      }
      const result = PracticeSessionSchema.safeParse(minimal)
      expect(result.success).toBe(true)
      expect(result.data.answers).toEqual([])
      expect(result.data.summary).toBeUndefined()
    })

    it('validates incomplete session (no completedAt)', () => {
      const { completedAt, ...incomplete } = validPracticeSession
      const result = PracticeSessionSchema.safeParse(incomplete)
      expect(result.success).toBe(true)
      expect(result.data.completedAt).toBeUndefined()
    })
  })

  describe('sessionType enum', () => {
    it('accepts full-interview type', () => {
      const data = { ...validPracticeSession, sessionType: 'full-interview' }
      const result = PracticeSessionSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('accepts category-focus type', () => {
      const data = { ...validPracticeSession, sessionType: 'category-focus' }
      const result = PracticeSessionSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('accepts single-question type', () => {
      const data = { ...validPracticeSession, sessionType: 'single-question' }
      const result = PracticeSessionSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('rejects invalid session type', () => {
      const data = { ...validPracticeSession, sessionType: 'quick-drill' }
      const result = PracticeSessionSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('feedbackTiming enum', () => {
    it('accepts immediate timing', () => {
      const data = { ...validPracticeSession, feedbackTiming: 'immediate' }
      const result = PracticeSessionSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('accepts batched timing', () => {
      const data = { ...validPracticeSession, feedbackTiming: 'batched' }
      const result = PracticeSessionSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('rejects invalid feedback timing', () => {
      const data = { ...validPracticeSession, feedbackTiming: 'delayed' }
      const result = PracticeSessionSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('summary validation', () => {
    it('validates complete summary', () => {
      const result = PracticeSessionSchema.safeParse(validPracticeSession)
      expect(result.success).toBe(true)
      expect(result.data.summary.questionsAttempted).toBe(5)
      expect(result.data.summary.averageScore).toBe(78)
      expect(result.data.summary.strongCategories).toContain('behavioral')
    })

    it('applies default empty arrays in summary', () => {
      const data = {
        ...validPracticeSession,
        summary: { questionsAttempted: 3 }
      }
      const result = PracticeSessionSchema.safeParse(data)
      expect(result.success).toBe(true)
      expect(result.data.summary.strongCategories).toEqual([])
      expect(result.data.summary.improvementAreas).toEqual([])
    })
  })
})

// =============================================================================
// PREP PROGRESS SCHEMA TESTS
// =============================================================================

describe('PrepProgressSchema', () => {
  describe('valid data', () => {
    it('validates complete prep progress', () => {
      const result = PrepProgressSchema.safeParse(validPrepProgress)
      expect(result.success).toBe(true)
      expect(result.data.totalSessions).toBe(3)
      expect(result.data.readiness.overall).toBe(72)
    })

    it('validates minimal prep progress', () => {
      const minimal = {
        jobId: 1001,
        lastUpdated: '2026-02-02T12:00:00.000Z'
      }
      const result = PrepProgressSchema.safeParse(minimal)
      expect(result.success).toBe(true)
      expect(result.data.totalSessions).toBe(0)
      expect(result.data.totalQuestionsAnswered).toBe(0)
      expect(result.data.scoreHistory).toEqual([])
      expect(result.data.focusAreas).toEqual([])
    })
  })

  describe('readiness validation', () => {
    it('validates readiness with all fields', () => {
      const result = PrepProgressSchema.safeParse(validPrepProgress)
      expect(result.success).toBe(true)
      expect(result.data.readiness.byCategory).toHaveProperty('behavioral')
    })

    it('accepts all confidence levels', () => {
      const levels = ['not-ready', 'needs-work', 'ready', 'well-prepared']
      levels.forEach(level => {
        const data = {
          ...validPrepProgress,
          readiness: { ...validPrepProgress.readiness, confidenceLevel: level }
        }
        const result = PrepProgressSchema.safeParse(data)
        expect(result.success).toBe(true)
      })
    })

    it('rejects invalid confidence level', () => {
      const data = {
        ...validPrepProgress,
        readiness: { ...validPrepProgress.readiness, confidenceLevel: 'excellent' }
      }
      const result = PrepProgressSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('rejects readiness overall above 100', () => {
      const data = {
        ...validPrepProgress,
        readiness: { ...validPrepProgress.readiness, overall: 150 }
      }
      const result = PrepProgressSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('scoreHistory validation', () => {
    it('validates score history entries', () => {
      const result = PrepProgressSchema.safeParse(validPrepProgress)
      expect(result.success).toBe(true)
      expect(result.data.scoreHistory).toHaveLength(2)
      expect(result.data.scoreHistory[0].category).toBe('behavioral')
    })

    it('rejects score history with invalid score', () => {
      const data = {
        ...validPrepProgress,
        scoreHistory: [{ date: '2026-02-01T10:00:00.000Z', category: 'behavioral', score: 150 }]
      }
      const result = PrepProgressSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('focusAreas validation', () => {
    it('validates focus areas', () => {
      const result = PrepProgressSchema.safeParse(validPrepProgress)
      expect(result.success).toBe(true)
      expect(result.data.focusAreas[0].category).toBe('technical')
      expect(result.data.focusAreas[0].reason).toContain('Lowest')
    })

    it('requires all fields in focus area', () => {
      const data = {
        ...validPrepProgress,
        focusAreas: [{ category: 'technical', reason: 'needs work' }] // missing recommendedPractice
      }
      const result = PrepProgressSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })
})

// =============================================================================
// VALIDATION FUNCTION TESTS
// =============================================================================

describe('validateInterviewerResearch', () => {
  describe('advisory mode (default)', () => {
    it('returns valid=true for valid data', () => {
      const result = validateInterviewerResearch(validInterviewerResearch)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid=false with errors for invalid data', () => {
      const invalid = { interviewerName: 'Test' }
      const result = validateInterviewerResearch(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.data).toEqual(invalid) // Returns original in advisory mode
    })
  })

  describe('strict mode', () => {
    it('returns valid=true for valid data', () => {
      const result = validateInterviewerResearch(validInterviewerResearch, { mode: 'strict' })
      expect(result.valid).toBe(true)
    })

    it('throws error for invalid data', () => {
      const invalid = { interviewerName: 'Test' }
      expect(() => validateInterviewerResearch(invalid, { mode: 'strict' })).toThrow(
        /Interviewer research validation failed/
      )
    })
  })
})

describe('validateInterviewQuestion', () => {
  describe('advisory mode (default)', () => {
    it('returns valid=true for valid data', () => {
      const result = validateInterviewQuestion(validInterviewQuestion)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid=false with errors for invalid data', () => {
      const invalid = { questionText: 'Test?' }
      const result = validateInterviewQuestion(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('strict mode', () => {
    it('throws error for invalid data', () => {
      const invalid = { questionText: 'Test?' }
      expect(() => validateInterviewQuestion(invalid, { mode: 'strict' })).toThrow(
        /Interview question validation failed/
      )
    })
  })
})

describe('validatePracticeAnswer', () => {
  describe('advisory mode (default)', () => {
    it('returns valid=true for valid data', () => {
      const result = validatePracticeAnswer(validPracticeAnswer)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid=false with errors for invalid data', () => {
      const invalid = { answerText: 'My answer' }
      const result = validatePracticeAnswer(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('strict mode', () => {
    it('throws error for invalid data', () => {
      const invalid = { answerText: 'My answer' }
      expect(() => validatePracticeAnswer(invalid, { mode: 'strict' })).toThrow(
        /Practice answer validation failed/
      )
    })
  })
})

describe('validatePracticeSession', () => {
  describe('advisory mode (default)', () => {
    it('returns valid=true for valid data', () => {
      const result = validatePracticeSession(validPracticeSession)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid=false with errors for invalid data', () => {
      const invalid = { jobId: 'not-a-number' }
      const result = validatePracticeSession(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('strict mode', () => {
    it('throws error for invalid data', () => {
      const invalid = { jobId: 'not-a-number' }
      expect(() => validatePracticeSession(invalid, { mode: 'strict' })).toThrow(
        /Practice session validation failed/
      )
    })
  })
})

describe('validatePrepProgress', () => {
  describe('advisory mode (default)', () => {
    it('returns valid=true for valid data', () => {
      const result = validatePrepProgress(validPrepProgress)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid=false with errors for invalid data', () => {
      const invalid = { jobId: 'not-a-number' }
      const result = validatePrepProgress(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('strict mode', () => {
    it('throws error for invalid data', () => {
      const invalid = { jobId: 'not-a-number' }
      expect(() => validatePrepProgress(invalid, { mode: 'strict' })).toThrow(
        /Prep progress validation failed/
      )
    })
  })
})
