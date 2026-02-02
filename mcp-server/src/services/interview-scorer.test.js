/**
 * Interview Scorer Tests
 * INTV-04: Comprehensive self-scoring with actionable feedback
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { scoreAnswer, generateFeedback, suggestRewrite } from './interview-scorer.js'

describe('interview-scorer', () => {
  describe('scoreAnswer', () => {
    it('returns all 4 score dimensions', () => {
      const answer = { answerText: 'At my previous company, I led a team of 5 engineers.' }
      const question = { questionText: 'Tell me about leadership', category: 'behavioral' }

      const score = scoreAnswer(answer, question, {})

      expect(score).toHaveProperty('overall')
      expect(score).toHaveProperty('storyCoverage')
      expect(score).toHaveProperty('starStructure')
      expect(score).toHaveProperty('relevance')
      expect(score).toHaveProperty('clarity')
    })

    it('overall is weighted average of dimensions', () => {
      const answer = { answerText: 'At my previous company, I led a team of 5 engineers.' }
      const question = { questionText: 'Tell me about leadership', category: 'behavioral' }

      const score = scoreAnswer(answer, question, {})

      // Overall should be between 0-100
      expect(score.overall).toBeGreaterThanOrEqual(0)
      expect(score.overall).toBeLessThanOrEqual(100)
    })

    it('detects STAR structure components - situation', () => {
      const answer = { answerText: 'At Company X, when I was working on the project last year...' }
      const question = { questionText: 'Tell me about a challenge', category: 'behavioral' }

      const score = scoreAnswer(answer, question, {})

      // Should detect situation indicators
      expect(score.starStructure).toBeGreaterThan(0)
    })

    it('detects STAR structure components - action', () => {
      const answer = { answerText: 'I implemented a new system, led the team, and coordinated with stakeholders.' }
      const question = { questionText: 'Tell me about a project', category: 'behavioral' }

      const score = scoreAnswer(answer, question, {})

      // Should detect action indicators
      expect(score.starStructure).toBeGreaterThan(20)
    })

    it('detects STAR structure components - result', () => {
      const answer = { answerText: 'The result was a 30% increase in revenue and successful delivery.' }
      const question = { questionText: 'Tell me about an achievement', category: 'behavioral' }

      const score = scoreAnswer(answer, question, {})

      // Should detect result indicators
      expect(score.starStructure).toBeGreaterThan(10)
    })

    it('detects story coverage when story keywords match', () => {
      const answer = { answerText: 'The payment integration project required coordination with vendors.' }
      const question = {
        questionText: 'Tell me about a technical challenge',
        category: 'technical',
        suggestedStories: [
          { storyId: 'abc', storyTitle: 'Payment Integration Challenge', relevanceScore: 80 }
        ],
        talkingPoints: []
      }

      const score = scoreAnswer(answer, question, {})

      // Should detect story keyword match (payment, integration)
      expect(score.storyCoverage).toBeGreaterThan(50)
    })

    it('evaluates relevance to question', () => {
      const answer = { answerText: 'I managed a team of engineers and led them through a difficult project.' }
      const question = { questionText: 'Tell me about managing engineers', category: 'leadership' }

      const score = scoreAnswer(answer, question, {})

      // Should have high relevance score for matching keywords
      expect(score.relevance).toBeGreaterThan(60)
    })

    it('evaluates clarity - penalizes short answers', () => {
      const answer = { answerText: 'I led a team.' }
      const question = { questionText: 'Tell me about leadership', category: 'behavioral' }

      const score = scoreAnswer(answer, question, {})

      // Short answer should have lower clarity
      expect(score.clarity).toBeLessThan(80)
    })

    it('evaluates clarity - penalizes filler words', () => {
      const answerWithFillers = {
        answerText: 'So basically, I like kind of led a team, you know, and we sort of just did things.'
      }
      const question = { questionText: 'Tell me about leadership', category: 'behavioral' }

      const score = scoreAnswer(answerWithFillers, question, {})

      // Many filler words should reduce clarity
      expect(score.clarity).toBeLessThan(80)
    })

    it('evaluates clarity - rewards concrete language', () => {
      const answer = {
        answerText: 'I led a team of 5 people over 3 months to deliver the project. We increased revenue by 20% and reduced costs by 15%.'
      }
      const question = { questionText: 'Tell me about leadership', category: 'behavioral' }

      const score = scoreAnswer(answer, question, {})

      // Concrete numbers should boost clarity
      expect(score.clarity).toBeGreaterThanOrEqual(60)
    })

    it('handles empty answer gracefully', () => {
      const answer = { answerText: '' }
      const question = { questionText: 'Tell me about leadership', category: 'behavioral' }

      const score = scoreAnswer(answer, question, {})

      expect(score.overall).toBeLessThan(50)
    })

    it('handles empty question gracefully', () => {
      const answer = { answerText: 'I led a team and delivered results.' }
      const question = { questionText: '', category: 'behavioral' }

      const score = scoreAnswer(answer, question, {})

      expect(score).toBeDefined()
      expect(score.overall).toBeGreaterThan(0)
    })
  })

  describe('generateFeedback', () => {
    it('identifies strengths for high scores', () => {
      const score = { overall: 85, storyCoverage: 80, starStructure: 85, relevance: 90, clarity: 80 }
      const answer = { answerText: 'Good answer' }
      const question = { questionText: 'Question', category: 'behavioral' }

      const feedback = generateFeedback(score, answer, question)

      expect(feedback.strengths.length).toBeGreaterThan(0)
    })

    it('identifies improvements for low scores', () => {
      const score = { overall: 50, storyCoverage: 40, starStructure: 50, relevance: 60, clarity: 50 }
      const answer = { answerText: 'Short answer' }
      const question = {
        questionText: 'Question',
        category: 'behavioral',
        suggestedStories: [{ storyId: 'abc', storyTitle: 'A Story', relevanceScore: 80 }]
      }

      const feedback = generateFeedback(score, answer, question)

      expect(feedback.improvements.length).toBeGreaterThan(0)
    })

    it('includes suggestedRewrite when overall < 70', () => {
      const score = { overall: 60, storyCoverage: 50, starStructure: 50, relevance: 70, clarity: 60 }
      const answer = { answerText: 'I did something at work.' }
      const question = { questionText: 'Tell me about leadership', category: 'behavioral' }

      const feedback = generateFeedback(score, answer, question)

      expect(feedback.suggestedRewrite).toBeDefined()
      expect(feedback.suggestedRewrite.length).toBeGreaterThan(0)
    })

    it('suggestedRewrite is concrete with STAR guidance', () => {
      const score = { overall: 50, storyCoverage: 40, starStructure: 30, relevance: 60, clarity: 50 }
      const answer = { answerText: 'I worked on something.' }
      const question = { questionText: 'Tell me about a challenge', category: 'behavioral' }

      const feedback = generateFeedback(score, answer, question)

      // Should contain STAR format guidance
      expect(feedback.suggestedRewrite).toContain('Situation')
      expect(feedback.suggestedRewrite).toContain('Action')
      expect(feedback.suggestedRewrite).toContain('Result')
    })

    it('does not include suggestedRewrite when score >= 70', () => {
      const score = { overall: 75, storyCoverage: 75, starStructure: 75, relevance: 75, clarity: 75 }
      const answer = { answerText: 'Good answer' }
      const question = { questionText: 'Question', category: 'behavioral' }

      const feedback = generateFeedback(score, answer, question)

      expect(feedback.suggestedRewrite).toBeUndefined()
    })

    it('provides structure-specific improvements for low STAR score', () => {
      const score = { overall: 55, storyCoverage: 70, starStructure: 40, relevance: 70, clarity: 60 }
      const answer = { answerText: 'I did something and got results.' }
      const question = { questionText: 'Tell me about leadership', category: 'behavioral' }

      const feedback = generateFeedback(score, answer, question)

      // Should suggest STAR structure
      expect(feedback.improvements.some(i => i.toLowerCase().includes('star'))).toBe(true)
    })

    it('provides coverage-specific improvements when stories not used', () => {
      const score = { overall: 55, storyCoverage: 40, starStructure: 70, relevance: 60, clarity: 60 }
      const answer = { answerText: 'At work, I led a team through challenges and delivered results.' }
      const question = {
        questionText: 'Tell me about leadership',
        category: 'behavioral',
        suggestedStories: [{ storyId: 'abc', storyTitle: 'Leading Cross-Functional Team', relevanceScore: 90 }]
      }

      const feedback = generateFeedback(score, answer, question)

      // Should suggest using stories
      expect(feedback.improvements.some(i => i.toLowerCase().includes('stor'))).toBe(true)
    })

    it('returns empty arrays when nothing to report', () => {
      const score = { overall: 85, storyCoverage: 85, starStructure: 85, relevance: 85, clarity: 85 }
      const answer = { answerText: 'Good answer' }
      const question = { questionText: 'Question', category: 'behavioral' }

      const feedback = generateFeedback(score, answer, question)

      expect(feedback.improvements).toBeDefined()
      expect(Array.isArray(feedback.improvements)).toBe(true)
    })
  })

  describe('suggestRewrite', () => {
    const mockProfile = {
      stories: [
        {
          id: 'story-1',
          title: 'Led Design System Migration',
          situation: 'At TechCorp, we had an inconsistent UI across 5 products.',
          task: 'I was responsible for unifying the design system.',
          action: 'I analyzed all components, created a component library, and led weekly sync meetings.',
          result: 'Reduced development time by 30% and improved UI consistency scores from 60% to 95%.',
          themes: ['leadership', 'design-systems', 'cross-functional']
        },
        {
          id: 'story-2',
          title: 'Debugging Production Outage',
          situation: 'Our main service went down during peak hours.',
          task: 'I needed to restore service and identify the root cause.',
          action: 'I led the incident response, coordinated with 3 teams, and implemented the fix.',
          result: 'Service restored in 45 minutes, preventing $500K in potential losses.',
          themes: ['technical', 'incident-response', 'pressure']
        }
      ]
    }

    it('uses profile stories in rewrite suggestion', () => {
      const answer = { answerText: 'I led a team.' }
      const question = {
        questionText: 'Tell me about leadership',
        category: 'behavioral',
        suggestedStories: [
          { storyId: 'story-1', storyTitle: 'Led Design System Migration', relevanceScore: 90 }
        ]
      }

      const rewrite = suggestRewrite(answer, question, mockProfile)

      // Should reference the suggested story
      expect(rewrite).toContain('Led Design System Migration')
    })

    it('includes STAR structure sections', () => {
      const answer = { answerText: 'I did something.' }
      const question = { questionText: 'Tell me about a challenge', category: 'behavioral' }

      const rewrite = suggestRewrite(answer, question, mockProfile)

      expect(rewrite).toContain('SITUATION')
      expect(rewrite).toContain('TASK')
      expect(rewrite).toContain('ACTION')
      expect(rewrite).toContain('RESULT')
    })

    it('includes category-specific tips for behavioral', () => {
      const answer = { answerText: 'I did something.' }
      const question = { questionText: 'Tell me about a challenge', category: 'behavioral' }

      const rewrite = suggestRewrite(answer, question, mockProfile)

      // Behavioral tips focus on first person and self-awareness
      expect(rewrite.toLowerCase()).toContain('first person')
    })

    it('includes category-specific tips for technical', () => {
      const answer = { answerText: 'I fixed a bug.' }
      const question = { questionText: 'Walk me through debugging', category: 'technical' }

      const rewrite = suggestRewrite(answer, question, mockProfile)

      expect(rewrite.toLowerCase()).toContain('technical')
    })

    it('includes talking points when provided', () => {
      const answer = { answerText: 'I worked on something.' }
      const question = {
        questionText: 'Tell me about collaboration',
        category: 'behavioral',
        talkingPoints: ['Cross-team alignment', 'Stakeholder management']
      }

      const rewrite = suggestRewrite(answer, question, mockProfile)

      expect(rewrite).toContain('Cross-team alignment')
    })

    it('provides generic structure when no stories match', () => {
      const answer = { answerText: 'I did something.' }
      const question = { questionText: 'Tell me about something', category: 'behavioral' }

      const rewrite = suggestRewrite(answer, question, {})

      // Should still provide STAR structure guidance
      expect(rewrite).toContain('SITUATION')
      expect(rewrite).toContain('RESULT')
    })

    it('finds best matching story by relevance score', () => {
      const answer = { answerText: 'I debugged an issue.' }
      const question = {
        questionText: 'Tell me about debugging',
        category: 'technical',
        suggestedStories: [
          { storyId: 'story-1', storyTitle: 'Led Design System Migration', relevanceScore: 60 },
          { storyId: 'story-2', storyTitle: 'Debugging Production Outage', relevanceScore: 95 }
        ]
      }

      const rewrite = suggestRewrite(answer, question, mockProfile)

      // Should use the higher relevance story
      expect(rewrite).toContain('Debugging Production Outage')
    })
  })
})
