/**
 * Interview Scorer Service
 * INTV-04: Comprehensive self-scoring with actionable feedback
 *
 * Provides:
 * - scoreAnswer: Evaluate answer across 4 dimensions
 * - generateFeedback: Generate strengths, improvements, and suggested rewrites
 * - suggestRewrite: Provide concrete improved answer structure
 *
 * Per CONTEXT.md:
 * - Comprehensive evaluation: story coverage + STAR structure + relevance + clarity
 * - Numeric score (0-100) PLUS qualitative feedback
 * - Specific rewrites showing how the answer could be improved with concrete examples
 */

/**
 * Score weights for overall calculation
 */
const SCORE_WEIGHTS = {
  relevance: 0.30,
  starStructure: 0.25,
  storyCoverage: 0.25,
  clarity: 0.20
}

/**
 * STAR structure indicators
 */
const STAR_INDICATORS = {
  situation: [
    'at', 'when', 'while', 'during', 'in my role', 'working at', 'last year',
    'ago', 'there was', 'we were', 'i was', 'the team', 'project', 'company'
  ],
  task: [
    'needed to', 'had to', 'responsible', 'goal', 'objective', 'challenge',
    'requirement', 'asked to', 'tasked with', 'mission', 'mandate', 'expectation'
  ],
  action: [
    'i', 'decided', 'implemented', 'created', 'led', 'built', 'designed',
    'developed', 'organized', 'coordinated', 'initiated', 'analyzed', 'researched',
    'collaborated', 'presented', 'convinced', 'negotiated', 'proposed'
  ],
  result: [
    'result', 'outcome', 'achieved', 'increased', 'decreased', 'reduced', 'improved',
    'saved', 'generated', 'delivered', 'completed', 'launched', 'successful',
    '%', 'percent', 'million', 'thousand', 'metric', 'kpi', 'revenue', 'growth'
  ]
}

/**
 * Filler words that reduce clarity
 */
const FILLER_WORDS = [
  'um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally',
  'kind of', 'sort of', 'i think', 'i guess', 'i mean', 'really', 'very',
  'just', 'stuff', 'things', 'whatever'
]

/**
 * Score an answer against a question
 *
 * @param {object} answer - The answer to score
 * @param {string} answer.answerText - The answer text
 * @param {string} [answer.inputMethod] - 'text' or 'voice'
 * @param {object} question - The question being answered
 * @param {string} question.questionText - The question text
 * @param {string} question.category - Question category
 * @param {Array} [question.suggestedStories] - Stories suggested for this question
 * @param {Array} [question.talkingPoints] - Talking points to include
 * @param {object} [profile] - Profile for additional context
 * @returns {{ overall: number, storyCoverage: number, starStructure: number, relevance: number, clarity: number }}
 */
export function scoreAnswer(answer, question, profile = {}) {
  const answerText = (answer.answerText || '').toLowerCase()
  const questionText = (question.questionText || '').toLowerCase()
  const suggestedStories = question.suggestedStories || []
  const talkingPoints = question.talkingPoints || []

  // Score each dimension
  const storyCoverage = scoreStoryCoverage(answerText, suggestedStories, talkingPoints, profile)
  const starStructure = scoreStarStructure(answerText)
  const relevance = scoreRelevance(answerText, questionText)
  const clarity = scoreClarity(answerText)

  // Calculate weighted overall
  const overall = Math.round(
    storyCoverage * SCORE_WEIGHTS.storyCoverage +
    starStructure * SCORE_WEIGHTS.starStructure +
    relevance * SCORE_WEIGHTS.relevance +
    clarity * SCORE_WEIGHTS.clarity
  )

  return {
    overall,
    storyCoverage,
    starStructure,
    relevance,
    clarity
  }
}

/**
 * Score story coverage - did they use suggested stories/talking points?
 */
function scoreStoryCoverage(answerText, suggestedStories, talkingPoints, profile) {
  let score = 50 // Base score if no suggestions

  if (suggestedStories.length === 0 && talkingPoints.length === 0) {
    // No suggestions to match - give decent score if answer is substantive
    return answerText.length > 100 ? 70 : 50
  }

  let matchCount = 0
  let totalSuggestions = 0

  // Check story coverage
  for (const story of suggestedStories) {
    totalSuggestions++
    // Check if story title or themes mentioned
    const storyTitle = (story.storyTitle || '').toLowerCase()
    const titleWords = storyTitle.split(/\s+/).filter(w => w.length > 3)

    // Check title keywords
    if (titleWords.some(word => answerText.includes(word))) {
      matchCount++
      continue
    }

    // Check if profile has story with themes
    if (profile?.stories) {
      const fullStory = profile.stories.find(s => s.id === story.storyId)
      if (fullStory?.themes?.some(theme => answerText.includes(theme.toLowerCase()))) {
        matchCount++
      }
    }
  }

  // Check talking points coverage
  for (const point of talkingPoints) {
    totalSuggestions++
    const pointLower = point.toLowerCase()
    const pointWords = pointLower.split(/\s+/).filter(w => w.length > 3)
    if (pointWords.some(word => answerText.includes(word))) {
      matchCount++
    }
  }

  if (totalSuggestions > 0) {
    const coverageRatio = matchCount / totalSuggestions
    score = Math.round(40 + coverageRatio * 60) // 40-100 scale
  }

  return Math.min(100, Math.max(0, score))
}

/**
 * Score STAR structure - S-T-A-R components present?
 */
function scoreStarStructure(answerText) {
  let score = 0
  const components = { situation: 0, task: 0, action: 0, result: 0 }

  // Check each STAR component
  for (const [component, indicators] of Object.entries(STAR_INDICATORS)) {
    for (const indicator of indicators) {
      if (answerText.includes(indicator)) {
        components[component]++
      }
    }
  }

  // Score based on presence and strength of each component
  // Situation: 20 points
  if (components.situation >= 3) score += 20
  else if (components.situation >= 1) score += 10

  // Task: 20 points
  if (components.task >= 2) score += 20
  else if (components.task >= 1) score += 10

  // Action: 30 points (most important)
  if (components.action >= 5) score += 30
  else if (components.action >= 3) score += 20
  else if (components.action >= 1) score += 10

  // Result: 30 points (shows impact)
  if (components.result >= 3) score += 30
  else if (components.result >= 1) score += 15

  return Math.min(100, Math.max(0, score))
}

/**
 * Score relevance - does answer address the question?
 */
function scoreRelevance(answerText, questionText) {
  // Extract question keywords
  const questionWords = questionText
    .split(/\s+/)
    .filter(w => w.length > 3)
    .filter(w => !['tell', 'about', 'time', 'when', 'describe', 'walk', 'through', 'what', 'your', 'have', 'would', 'that', 'with', 'example'].includes(w))

  if (questionWords.length === 0) {
    // If no meaningful question keywords, give base score
    return answerText.length > 100 ? 70 : 50
  }

  // Count keyword matches
  let matches = 0
  for (const word of questionWords) {
    if (answerText.includes(word)) {
      matches++
    }
  }

  const matchRatio = matches / questionWords.length

  // Scale: 50 base + up to 50 for keyword coverage
  return Math.round(50 + matchRatio * 50)
}

/**
 * Score clarity - clear, concise communication?
 */
function scoreClarity(answerText) {
  let score = 100

  // Check length - too short or too long is bad
  const wordCount = answerText.split(/\s+/).length

  if (wordCount < 30) {
    score -= 30 // Too brief
  } else if (wordCount > 500) {
    score -= 20 // Too verbose
  } else if (wordCount < 50) {
    score -= 15 // A bit brief
  }

  // Check for filler words
  let fillerCount = 0
  for (const filler of FILLER_WORDS) {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi')
    const matches = answerText.match(regex)
    if (matches) {
      fillerCount += matches.length
    }
  }

  // Penalize filler words
  const fillerRatio = fillerCount / Math.max(1, wordCount)
  if (fillerRatio > 0.1) score -= 30
  else if (fillerRatio > 0.05) score -= 15
  else if (fillerRatio > 0.02) score -= 5

  // Check for concrete vs abstract language
  const concreteIndicators = ['number', 'percent', '%', 'team', 'people', 'days', 'weeks', 'months', 'hours', 'revenue', 'cost', 'users', 'customers']
  let concreteCount = 0
  for (const indicator of concreteIndicators) {
    if (answerText.includes(indicator)) {
      concreteCount++
    }
  }

  if (concreteCount >= 3) score += 10
  else if (concreteCount === 0) score -= 10

  // Check sentence structure - avoid very long sentences
  const sentences = answerText.split(/[.!?]+/).filter(s => s.trim())
  const avgSentenceLength = sentences.length > 0
    ? answerText.split(/\s+/).length / sentences.length
    : 100

  if (avgSentenceLength > 50) score -= 20
  else if (avgSentenceLength > 35) score -= 10

  return Math.min(100, Math.max(0, score))
}

/**
 * Generate feedback based on scores
 *
 * @param {object} score - The score object from scoreAnswer
 * @param {object} answer - The original answer
 * @param {object} question - The question
 * @returns {{ strengths: string[], improvements: string[], suggestedRewrite?: string }}
 */
export function generateFeedback(score, answer, question) {
  const strengths = []
  const improvements = []

  // Analyze each dimension
  if (score.storyCoverage >= 75) {
    strengths.push('Good use of relevant stories and talking points')
  } else if (score.storyCoverage < 70) {
    if (question.suggestedStories?.length > 0) {
      improvements.push('Consider incorporating more of the suggested stories')
    }
    if (question.talkingPoints?.length > 0) {
      improvements.push('Try to weave in more of the key talking points')
    }
  }

  if (score.starStructure >= 75) {
    strengths.push('Strong STAR structure with clear situation, task, action, and result')
  } else if (score.starStructure < 70) {
    const answerText = (answer.answerText || '').toLowerCase()
    const hasResult = STAR_INDICATORS.result.some(r => answerText.includes(r))
    const hasSituation = STAR_INDICATORS.situation.some(s => answerText.includes(s))

    if (!hasResult) {
      improvements.push('Add specific results or metrics to show impact')
    }
    if (!hasSituation) {
      improvements.push('Start with clearer context setting (the situation)')
    }
    if (score.starStructure < 50) {
      improvements.push('Structure your answer using the STAR format (Situation, Task, Action, Result)')
    }
  }

  if (score.relevance >= 75) {
    strengths.push('Answer directly addresses the question asked')
  } else if (score.relevance < 70) {
    improvements.push('Focus more on the specific question being asked')
  }

  if (score.clarity >= 75) {
    strengths.push('Clear and well-organized response')
  } else if (score.clarity < 70) {
    const wordCount = (answer.answerText || '').split(/\s+/).length
    if (wordCount < 50) {
      improvements.push('Provide more detail and context in your response')
    } else if (wordCount > 400) {
      improvements.push('Consider being more concise - focus on key points')
    }

    // Check for filler words
    const fillerCount = FILLER_WORDS.filter(f =>
      (answer.answerText || '').toLowerCase().includes(f)
    ).length

    if (fillerCount > 2) {
      improvements.push('Reduce filler words (like "basically", "kind of", etc.)')
    }
  }

  // Add suggested rewrite for low scores per CONTEXT.md
  let suggestedRewrite
  if (score.overall < 70) {
    suggestedRewrite = generateConcreteRewrite(answer, question, score)
  }

  return { strengths, improvements, suggestedRewrite }
}

/**
 * Generate a concrete rewrite suggestion
 * Per CONTEXT.md: "Specific rewrites showing how the answer could be improved with concrete examples"
 */
function generateConcreteRewrite(answer, question, score) {
  const category = question.category || 'behavioral'
  const answerText = answer.answerText || ''

  // Build improved structure based on what's missing
  const parts = []

  // Check what STAR components are weak
  const answerLower = answerText.toLowerCase()
  const hasSituation = STAR_INDICATORS.situation.some(s => answerLower.includes(s))
  const hasTask = STAR_INDICATORS.task.some(t => answerLower.includes(t))
  const hasAction = STAR_INDICATORS.action.filter(a => answerLower.includes(a)).length >= 3
  const hasResult = STAR_INDICATORS.result.some(r => answerLower.includes(r))

  // Build suggested structure
  if (!hasSituation) {
    parts.push('**Situation:** Start with context - "At [Company], when I was [role], we faced [challenge]..."')
  } else {
    parts.push('**Situation:** (Your context was good)')
  }

  if (!hasTask) {
    parts.push('**Task:** Clarify your specific responsibility - "I was responsible for..." or "My goal was to..."')
  } else {
    parts.push('**Task:** (Clear goal stated)')
  }

  if (!hasAction) {
    parts.push('**Action:** Use more active voice with "I" statements - "I analyzed...", "I led...", "I implemented..."')
  } else {
    parts.push('**Action:** (Good action verbs)')
  }

  if (!hasResult) {
    parts.push('**Result:** Add specific metrics - "This resulted in X% improvement..." or "We achieved [outcome] within [timeframe]..."')
  } else {
    parts.push('**Result:** (Impact shown)')
  }

  // Add category-specific tips
  if (category === 'behavioral') {
    parts.push('')
    parts.push('*Behavioral Tip:* Focus on what YOU did, not what the team did. Use "I" not "we" for key actions.')
  } else if (category === 'technical') {
    parts.push('')
    parts.push('*Technical Tip:* Include specific technologies, explain your reasoning for technical decisions.')
  } else if (category === 'culture-fit') {
    parts.push('')
    parts.push('*Culture Fit Tip:* Connect your answer to company values and show self-awareness.')
  }

  return parts.join('\n')
}

/**
 * Generate a full suggested rewrite using profile stories
 *
 * @param {object} answer - The original answer
 * @param {object} question - The question
 * @param {object} profile - Profile data with stories
 * @returns {string} A concrete improved answer structure
 */
export function suggestRewrite(answer, question, profile = {}) {
  const suggestedStories = question.suggestedStories || []
  const talkingPoints = question.talkingPoints || []

  // Find best matching story from profile
  let bestStory = null
  if (profile.stories && suggestedStories.length > 0) {
    // Use the highest relevance suggested story
    const sortedSuggestions = [...suggestedStories].sort((a, b) =>
      (b.relevanceScore || 0) - (a.relevanceScore || 0)
    )

    const topSuggestion = sortedSuggestions[0]
    bestStory = profile.stories.find(s => s.id === topSuggestion?.storyId)
  }

  // If no suggested stories, try to find a relevant one
  if (!bestStory && profile.stories?.length > 0) {
    const questionLower = question.questionText.toLowerCase()

    // Simple keyword matching
    bestStory = profile.stories.find(story => {
      const storyText = `${story.title} ${story.situation} ${story.action}`.toLowerCase()
      const questionWords = questionLower.split(/\s+/).filter(w => w.length > 4)
      return questionWords.some(word => storyText.includes(word))
    })

    // Fall back to first story if no match
    if (!bestStory) {
      bestStory = profile.stories[0]
    }
  }

  // Build improved answer structure
  const parts = []

  parts.push('## Suggested Improved Answer Structure')
  parts.push('')

  if (bestStory) {
    parts.push(`### Using Story: "${bestStory.title}"`)
    parts.push('')
    parts.push('**SITUATION:**')
    parts.push(bestStory.situation || '[Describe the context and background]')
    parts.push('')
    parts.push('**TASK:**')
    parts.push(bestStory.task || '[Clarify your specific responsibility or goal]')
    parts.push('')
    parts.push('**ACTION:**')
    parts.push(bestStory.action || '[Detail the specific steps YOU took]')
    parts.push('')
    parts.push('**RESULT:**')
    if (bestStory.result) {
      parts.push(bestStory.result)
    } else {
      parts.push('[Add quantified results: "Resulted in X% improvement..." or "Delivered [outcome]"]')
    }
  } else {
    parts.push('**SITUATION:**')
    parts.push('[Start with context: "At [Company], when I was [role], we faced [challenge]..."]')
    parts.push('')
    parts.push('**TASK:**')
    parts.push('[Clarify your responsibility: "I was responsible for..." or "My goal was to..."]')
    parts.push('')
    parts.push('**ACTION:**')
    parts.push('[Use active voice: "I analyzed...", "I led...", "I implemented...", "I collaborated with..."]')
    parts.push('')
    parts.push('**RESULT:**')
    parts.push('[Add specific metrics: "This resulted in X% improvement within Y months..." or "We achieved [outcome]"]')
  }

  // Add talking points if available
  if (talkingPoints.length > 0) {
    parts.push('')
    parts.push('### Key Points to Include:')
    for (const point of talkingPoints.slice(0, 3)) {
      parts.push(`- ${point}`)
    }
  }

  // Add tips based on question category
  const category = question.category || 'behavioral'
  parts.push('')
  parts.push('### Tips for This Question Type:')

  if (category === 'behavioral') {
    parts.push('- Use first person ("I") for key actions, not "we"')
    parts.push('- Show self-awareness and learning')
    parts.push('- Connect to how this experience applies to the role')
  } else if (category === 'technical') {
    parts.push('- Mention specific technologies and tools used')
    parts.push('- Explain your technical decision-making process')
    parts.push('- Show awareness of tradeoffs')
  } else if (category === 'system-design') {
    parts.push('- Start high-level, then dive into details')
    parts.push('- Discuss scalability considerations')
    parts.push('- Mention monitoring and observability')
  } else if (category === 'culture-fit') {
    parts.push('- Show alignment with company values')
    parts.push('- Demonstrate self-awareness')
    parts.push('- Give specific examples, not generic statements')
  }

  return parts.join('\n')
}
