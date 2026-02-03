/**
 * Interview Learning Schema Tests
 *
 * Tests Zod validation for interview transcripts and learnings.
 * Uses test data that mirrors real use cases from CONTEXT.md.
 */

import { describe, it, expect } from 'vitest'
import {
  InterviewTranscriptSchema,
  InterviewLearningSchema,
  TranscriptStorageSchema,
  LearningStorageSchema,
  SuggestedProfileLinkSchema,
  ConfirmedProfileLinkSchema,
  validateInterviewTranscript,
  validateInterviewLearning,
  validateTranscriptStorage,
  validateLearningStorage
} from './interview-learning.schema.js'

// =============================================================================
// TEST FIXTURES
// =============================================================================

const validTranscriptFull = {
  id: '11111111-1111-4111-a111-111111111111',
  jobId: 123,
  sessionType: 'real-interview',
  interviewDate: '2026-02-01T10:00:00.000Z',
  interviewerName: 'Jane Smith',
  interviewType: 'video',
  confidenceLevel: 'high',
  overallVibe: 'went-well',
  rawTranscript: 'Interviewer: Tell me about yourself.\nMe: I have 10 years of experience...',
  highlights: ['Strong opening', 'Good technical explanation'],
  capturedAt: '2026-02-01T11:30:00.000Z',
  duration: 45,
  practiceSessionId: '22222222-2222-4222-a222-222222222222',
  interviewerResearchId: '33333333-3333-4333-a333-333333333333'
}

const validTranscriptMinimal = {
  id: '44444444-4444-4444-a444-444444444444',
  jobId: 456,
  sessionType: 'practice',
  interviewDate: '2026-02-01T10:00:00.000Z',
  interviewType: 'phone',
  rawTranscript: 'Practice session transcript...',
  capturedAt: '2026-02-01T10:30:00.000Z'
}

const validLearningFull = {
  id: '55555555-5555-4555-a555-555555555555',
  jobId: 123,
  transcriptId: '11111111-1111-4111-a111-111111111111',
  extractedAt: '2026-02-01T12:00:00.000Z',
  content: 'The STAR story about API redesign resonated well with interviewer',
  sourceQuote: 'That sounds like great experience with large-scale systems',
  topic: 'technical',
  outcome: 'worked',
  suggestedProfileLinks: [
    {
      entityType: 'story',
      entityId: '66666666-6666-4666-a666-666666666666',
      linkReason: 'API redesign story was specifically mentioned'
    }
  ],
  confirmedProfileLinks: [
    {
      entityType: 'skill',
      entityId: '77777777-7777-4777-a777-777777777777',
      linkedAt: '2026-02-01T12:30:00.000Z'
    }
  ],
  status: 'accepted',
  reviewedAt: '2026-02-01T12:30:00.000Z'
}

const validLearningMinimal = {
  id: '88888888-8888-4888-a888-888888888888',
  jobId: 456,
  transcriptId: '44444444-4444-4444-a444-444444444444',
  extractedAt: '2026-02-01T12:00:00.000Z',
  content: 'Need to improve explanation of system design approach',
  topic: 'behavioral',
  outcome: 'needs-work',
  status: 'proposed'
}

// =============================================================================
// INTERVIEW TRANSCRIPT SCHEMA TESTS
// =============================================================================

describe('InterviewTranscriptSchema', () => {
  describe('valid transcripts', () => {
    it('validates transcript with all fields', () => {
      const result = InterviewTranscriptSchema.safeParse(validTranscriptFull)
      expect(result.success).toBe(true)
      expect(result.data.interviewerName).toBe('Jane Smith')
      expect(result.data.duration).toBe(45)
    })

    it('validates transcript with minimal fields', () => {
      const result = InterviewTranscriptSchema.safeParse(validTranscriptMinimal)
      expect(result.success).toBe(true)
      expect(result.data.interviewerName).toBeUndefined()
      expect(result.data.confidenceLevel).toBeUndefined()
    })

    it('defaults highlights to empty array', () => {
      const result = InterviewTranscriptSchema.safeParse(validTranscriptMinimal)
      expect(result.success).toBe(true)
      expect(result.data.highlights).toEqual([])
    })

    it('preserves highlights array when provided', () => {
      const result = InterviewTranscriptSchema.safeParse(validTranscriptFull)
      expect(result.success).toBe(true)
      expect(result.data.highlights).toHaveLength(2)
    })
  })

  describe('required fields validation', () => {
    it('requires id', () => {
      const { id, ...transcript } = validTranscriptMinimal
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(false)
    })

    it('requires jobId', () => {
      const { jobId, ...transcript } = validTranscriptMinimal
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(false)
    })

    it('requires sessionType', () => {
      const { sessionType, ...transcript } = validTranscriptMinimal
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(false)
    })

    it('requires interviewDate', () => {
      const { interviewDate, ...transcript } = validTranscriptMinimal
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(false)
    })

    it('requires interviewType', () => {
      const { interviewType, ...transcript } = validTranscriptMinimal
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(false)
    })

    it('requires rawTranscript', () => {
      const { rawTranscript, ...transcript } = validTranscriptMinimal
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(false)
    })

    it('requires capturedAt', () => {
      const { capturedAt, ...transcript } = validTranscriptMinimal
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(false)
    })
  })

  describe('sessionType enum validation', () => {
    it('accepts practice', () => {
      const transcript = { ...validTranscriptMinimal, sessionType: 'practice' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(true)
    })

    it('accepts real-interview', () => {
      const transcript = { ...validTranscriptMinimal, sessionType: 'real-interview' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(true)
    })

    it('rejects invalid sessionType', () => {
      const transcript = { ...validTranscriptMinimal, sessionType: 'mock' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(false)
    })
  })

  describe('interviewType enum validation', () => {
    it('accepts phone', () => {
      const transcript = { ...validTranscriptMinimal, interviewType: 'phone' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(true)
    })

    it('accepts video', () => {
      const transcript = { ...validTranscriptMinimal, interviewType: 'video' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(true)
    })

    it('accepts onsite', () => {
      const transcript = { ...validTranscriptMinimal, interviewType: 'onsite' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(true)
    })

    it('rejects invalid interviewType', () => {
      const transcript = { ...validTranscriptMinimal, interviewType: 'email' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(false)
    })
  })

  describe('confidenceLevel enum validation', () => {
    it('accepts high', () => {
      const transcript = { ...validTranscriptMinimal, confidenceLevel: 'high' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(true)
    })

    it('accepts medium', () => {
      const transcript = { ...validTranscriptMinimal, confidenceLevel: 'medium' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(true)
    })

    it('accepts low', () => {
      const transcript = { ...validTranscriptMinimal, confidenceLevel: 'low' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(true)
    })

    it('rejects invalid confidenceLevel', () => {
      const transcript = { ...validTranscriptMinimal, confidenceLevel: 'very-high' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(false)
    })
  })

  describe('overallVibe enum validation', () => {
    it('accepts went-well', () => {
      const transcript = { ...validTranscriptMinimal, overallVibe: 'went-well' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(true)
    })

    it('accepts neutral', () => {
      const transcript = { ...validTranscriptMinimal, overallVibe: 'neutral' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(true)
    })

    it('accepts rough', () => {
      const transcript = { ...validTranscriptMinimal, overallVibe: 'rough' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(true)
    })

    it('rejects invalid overallVibe', () => {
      const transcript = { ...validTranscriptMinimal, overallVibe: 'terrible' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(false)
    })
  })

  describe('UUID validation', () => {
    it('requires valid UUID for id', () => {
      const transcript = { ...validTranscriptMinimal, id: 'not-a-uuid' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(false)
    })

    it('requires valid UUID for practiceSessionId', () => {
      const transcript = { ...validTranscriptMinimal, practiceSessionId: 'not-a-uuid' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(false)
    })

    it('requires valid UUID for interviewerResearchId', () => {
      const transcript = { ...validTranscriptMinimal, interviewerResearchId: 'not-a-uuid' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(false)
    })
  })

  describe('type validation', () => {
    it('requires jobId to be number', () => {
      const transcript = { ...validTranscriptMinimal, jobId: '123' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(false)
    })

    it('requires duration to be number', () => {
      const transcript = { ...validTranscriptMinimal, duration: '45' }
      const result = InterviewTranscriptSchema.safeParse(transcript)
      expect(result.success).toBe(false)
    })
  })
})

// =============================================================================
// INTERVIEW LEARNING SCHEMA TESTS
// =============================================================================

describe('InterviewLearningSchema', () => {
  describe('valid learnings', () => {
    it('validates learning with all fields', () => {
      const result = InterviewLearningSchema.safeParse(validLearningFull)
      expect(result.success).toBe(true)
      expect(result.data.sourceQuote).toBeDefined()
      expect(result.data.reviewedAt).toBeDefined()
    })

    it('validates learning with minimal fields', () => {
      const result = InterviewLearningSchema.safeParse(validLearningMinimal)
      expect(result.success).toBe(true)
      expect(result.data.sourceQuote).toBeUndefined()
      expect(result.data.reviewedAt).toBeUndefined()
    })

    it('defaults suggestedProfileLinks to empty array', () => {
      const result = InterviewLearningSchema.safeParse(validLearningMinimal)
      expect(result.success).toBe(true)
      expect(result.data.suggestedProfileLinks).toEqual([])
    })

    it('defaults confirmedProfileLinks to empty array', () => {
      const result = InterviewLearningSchema.safeParse(validLearningMinimal)
      expect(result.success).toBe(true)
      expect(result.data.confirmedProfileLinks).toEqual([])
    })
  })

  describe('topic enum validation', () => {
    it('accepts technical', () => {
      const learning = { ...validLearningMinimal, topic: 'technical' }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(true)
    })

    it('accepts behavioral', () => {
      const learning = { ...validLearningMinimal, topic: 'behavioral' }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(true)
    })

    it('accepts company-specific', () => {
      const learning = { ...validLearningMinimal, topic: 'company-specific' }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(true)
    })

    it('accepts compensation', () => {
      const learning = { ...validLearningMinimal, topic: 'compensation' }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(true)
    })

    it('rejects invalid topic', () => {
      const learning = { ...validLearningMinimal, topic: 'cultural' }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(false)
    })
  })

  describe('outcome enum validation', () => {
    it('accepts worked', () => {
      const learning = { ...validLearningMinimal, outcome: 'worked' }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(true)
    })

    it('accepts needs-work', () => {
      const learning = { ...validLearningMinimal, outcome: 'needs-work' }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(true)
    })

    it('accepts neutral', () => {
      const learning = { ...validLearningMinimal, outcome: 'neutral' }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(true)
    })

    it('rejects invalid outcome', () => {
      const learning = { ...validLearningMinimal, outcome: 'failed' }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(false)
    })
  })

  describe('status enum validation', () => {
    it('accepts proposed', () => {
      const learning = { ...validLearningMinimal, status: 'proposed' }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(true)
    })

    it('accepts accepted', () => {
      const learning = { ...validLearningMinimal, status: 'accepted' }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(true)
    })

    it('accepts rejected', () => {
      const learning = { ...validLearningMinimal, status: 'rejected' }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(true)
    })

    it('rejects invalid status', () => {
      const learning = { ...validLearningMinimal, status: 'pending' }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(false)
    })
  })

  describe('suggestedProfileLinks validation', () => {
    it('validates nested object structure', () => {
      const result = InterviewLearningSchema.safeParse(validLearningFull)
      expect(result.success).toBe(true)
      expect(result.data.suggestedProfileLinks[0].entityType).toBe('story')
      expect(result.data.suggestedProfileLinks[0].linkReason).toBeDefined()
    })

    it('requires entityType in suggestedProfileLinks', () => {
      const learning = {
        ...validLearningMinimal,
        suggestedProfileLinks: [{ entityId: '11111111-1111-4111-a111-111111111111', linkReason: 'test' }]
      }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(false)
    })

    it('requires entityId in suggestedProfileLinks', () => {
      const learning = {
        ...validLearningMinimal,
        suggestedProfileLinks: [{ entityType: 'story', linkReason: 'test' }]
      }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(false)
    })

    it('requires linkReason in suggestedProfileLinks', () => {
      const learning = {
        ...validLearningMinimal,
        suggestedProfileLinks: [{ entityType: 'story', entityId: '11111111-1111-4111-a111-111111111111' }]
      }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(false)
    })

    it('validates entityType enum in suggestedProfileLinks', () => {
      const learning = {
        ...validLearningMinimal,
        suggestedProfileLinks: [{
          entityType: 'experience',
          entityId: '11111111-1111-4111-a111-111111111111',
          linkReason: 'test'
        }]
      }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(false)
    })
  })

  describe('confirmedProfileLinks validation', () => {
    it('validates nested object structure', () => {
      const result = InterviewLearningSchema.safeParse(validLearningFull)
      expect(result.success).toBe(true)
      expect(result.data.confirmedProfileLinks[0].entityType).toBe('skill')
      expect(result.data.confirmedProfileLinks[0].linkedAt).toBeDefined()
    })

    it('requires linkedAt in confirmedProfileLinks', () => {
      const learning = {
        ...validLearningMinimal,
        confirmedProfileLinks: [{
          entityType: 'skill',
          entityId: '11111111-1111-4111-a111-111111111111'
        }]
      }
      const result = InterviewLearningSchema.safeParse(learning)
      expect(result.success).toBe(false)
    })
  })
})

// =============================================================================
// PROFILE LINK SCHEMA TESTS
// =============================================================================

describe('SuggestedProfileLinkSchema', () => {
  it('validates complete link', () => {
    const link = {
      entityType: 'story',
      entityId: '11111111-1111-4111-a111-111111111111',
      linkReason: 'Story was mentioned in interview'
    }
    const result = SuggestedProfileLinkSchema.safeParse(link)
    expect(result.success).toBe(true)
  })

  it('accepts skill entityType', () => {
    const link = {
      entityType: 'skill',
      entityId: '11111111-1111-4111-a111-111111111111',
      linkReason: 'Skill demonstrated effectively'
    }
    const result = SuggestedProfileLinkSchema.safeParse(link)
    expect(result.success).toBe(true)
  })

  it('accepts summary entityType', () => {
    const link = {
      entityType: 'summary',
      entityId: '11111111-1111-4111-a111-111111111111',
      linkReason: 'Summary needs update'
    }
    const result = SuggestedProfileLinkSchema.safeParse(link)
    expect(result.success).toBe(true)
  })

  it('rejects invalid entityType', () => {
    const link = {
      entityType: 'experience',
      entityId: '11111111-1111-4111-a111-111111111111',
      linkReason: 'test'
    }
    const result = SuggestedProfileLinkSchema.safeParse(link)
    expect(result.success).toBe(false)
  })
})

describe('ConfirmedProfileLinkSchema', () => {
  it('validates complete link', () => {
    const link = {
      entityType: 'story',
      entityId: '11111111-1111-4111-a111-111111111111',
      linkedAt: '2026-02-01T12:00:00.000Z'
    }
    const result = ConfirmedProfileLinkSchema.safeParse(link)
    expect(result.success).toBe(true)
  })
})

// =============================================================================
// STORAGE SCHEMA TESTS
// =============================================================================

describe('TranscriptStorageSchema', () => {
  it('validates storage with interviews', () => {
    const storage = {
      interviews: [validTranscriptMinimal, validTranscriptFull],
      lastUpdated: '2026-02-01T12:00:00.000Z'
    }
    const result = TranscriptStorageSchema.safeParse(storage)
    expect(result.success).toBe(true)
    expect(result.data.interviews).toHaveLength(2)
  })

  it('validates storage with empty interviews', () => {
    const storage = {
      interviews: [],
      lastUpdated: '2026-02-01T12:00:00.000Z'
    }
    const result = TranscriptStorageSchema.safeParse(storage)
    expect(result.success).toBe(true)
  })

  it('requires lastUpdated', () => {
    const storage = {
      interviews: []
    }
    const result = TranscriptStorageSchema.safeParse(storage)
    expect(result.success).toBe(false)
  })

  it('validates nested transcripts', () => {
    const storage = {
      interviews: [{ invalid: 'data' }],
      lastUpdated: '2026-02-01T12:00:00.000Z'
    }
    const result = TranscriptStorageSchema.safeParse(storage)
    expect(result.success).toBe(false)
  })
})

describe('LearningStorageSchema', () => {
  it('validates storage with learnings', () => {
    const storage = {
      learnings: [validLearningMinimal, validLearningFull],
      lastUpdated: '2026-02-01T12:00:00.000Z'
    }
    const result = LearningStorageSchema.safeParse(storage)
    expect(result.success).toBe(true)
    expect(result.data.learnings).toHaveLength(2)
  })

  it('validates storage with empty learnings', () => {
    const storage = {
      learnings: [],
      lastUpdated: '2026-02-01T12:00:00.000Z'
    }
    const result = LearningStorageSchema.safeParse(storage)
    expect(result.success).toBe(true)
  })

  it('requires lastUpdated', () => {
    const storage = {
      learnings: []
    }
    const result = LearningStorageSchema.safeParse(storage)
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// VALIDATION FUNCTION TESTS
// =============================================================================

describe('validateInterviewTranscript', () => {
  describe('advisory mode (default)', () => {
    it('returns valid=true for valid transcript', () => {
      const result = validateInterviewTranscript(validTranscriptFull)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.data.id).toBe(validTranscriptFull.id)
    })

    it('returns valid=false with errors for invalid transcript', () => {
      const invalid = { id: 'not-uuid' }
      const result = validateInterviewTranscript(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.data).toEqual(invalid)
    })

    it('includes descriptive error messages', () => {
      const invalid = { ...validTranscriptMinimal, sessionType: 'invalid' }
      const result = validateInterviewTranscript(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors[0].path).toBe('sessionType')
    })
  })

  describe('strict mode', () => {
    it('returns valid=true for valid transcript', () => {
      const result = validateInterviewTranscript(validTranscriptFull, { mode: 'strict' })
      expect(result.valid).toBe(true)
    })

    it('throws error for invalid transcript', () => {
      const invalid = { id: 'not-uuid' }
      expect(() => validateInterviewTranscript(invalid, { mode: 'strict' })).toThrow(
        /Interview transcript validation failed/
      )
    })
  })
})

describe('validateInterviewLearning', () => {
  describe('advisory mode (default)', () => {
    it('returns valid=true for valid learning', () => {
      const result = validateInterviewLearning(validLearningFull)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid=false with errors for invalid learning', () => {
      const invalid = { topic: 'invalid' }
      const result = validateInterviewLearning(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('strict mode', () => {
    it('returns valid=true for valid learning', () => {
      const result = validateInterviewLearning(validLearningFull, { mode: 'strict' })
      expect(result.valid).toBe(true)
    })

    it('throws error for invalid learning', () => {
      const invalid = { topic: 'invalid' }
      expect(() => validateInterviewLearning(invalid, { mode: 'strict' })).toThrow(
        /Interview learning validation failed/
      )
    })
  })
})

describe('validateTranscriptStorage', () => {
  describe('advisory mode (default)', () => {
    it('returns valid=true for valid storage', () => {
      const storage = { interviews: [validTranscriptMinimal], lastUpdated: '2026-02-01T12:00:00.000Z' }
      const result = validateTranscriptStorage(storage)
      expect(result.valid).toBe(true)
    })

    it('returns valid=false with errors for invalid storage', () => {
      const invalid = { interviews: 'not-array' }
      const result = validateTranscriptStorage(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('strict mode', () => {
    it('throws error for invalid storage', () => {
      const invalid = { interviews: 'not-array' }
      expect(() => validateTranscriptStorage(invalid, { mode: 'strict' })).toThrow(
        /Transcript storage validation failed/
      )
    })
  })
})

describe('validateLearningStorage', () => {
  describe('advisory mode (default)', () => {
    it('returns valid=true for valid storage', () => {
      const storage = { learnings: [validLearningMinimal], lastUpdated: '2026-02-01T12:00:00.000Z' }
      const result = validateLearningStorage(storage)
      expect(result.valid).toBe(true)
    })

    it('returns valid=false with errors for invalid storage', () => {
      const invalid = { learnings: 'not-array' }
      const result = validateLearningStorage(invalid)
      expect(result.valid).toBe(false)
    })
  })

  describe('strict mode', () => {
    it('throws error for invalid storage', () => {
      const invalid = { learnings: 'not-array' }
      expect(() => validateLearningStorage(invalid, { mode: 'strict' })).toThrow(
        /Learning storage validation failed/
      )
    })
  })
})
