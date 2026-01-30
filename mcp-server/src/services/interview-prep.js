/**
 * Interview Prep Service
 *
 * Generates interview preparation materials from profile data.
 * Organizes stories by category, generates talking points, and suggests practice questions.
 */

import { detectGaps } from './gap-detector.js'

/**
 * Get relevant STAR stories for interview prep
 *
 * @param {object} profile - The profile data
 * @param {object} jobContext - Job context (company, title, interviewType)
 * @returns {Array} Stories sorted by relevance with scores
 */
export function getRelevantStories(profile, jobContext = {}) {
  const stories = profile.stories || []

  if (stories.length === 0) {
    return []
  }

  const keywords = extractKeywords(jobContext)
  const interviewType = jobContext.interviewType || 'behavioral'

  const scored = stories.map((story) => {
    let score = 0

    // Score by question category match with interview type
    const categories = (story.questionCategories || []).map((c) => c.toLowerCase())

    // Behavioral interview - all stories relevant but prioritize conflict, leadership, teamwork
    if (interviewType === 'behavioral') {
      if (categories.some((c) => c.includes('conflict'))) score += 15
      if (categories.some((c) => c.includes('leadership'))) score += 15
      if (categories.some((c) => c.includes('teamwork'))) score += 15
      if (categories.some((c) => c.includes('challenge'))) score += 10
      if (categories.some((c) => c.includes('failure'))) score += 10
    }

    // Technical interview - prioritize problem-solving, technical decisions
    if (interviewType === 'technical') {
      if (categories.some((c) => c.includes('technical'))) score += 20
      if (categories.some((c) => c.includes('problem'))) score += 15
      if (categories.some((c) => c.includes('architecture'))) score += 15
      if (categories.some((c) => c.includes('debugging'))) score += 10
    }

    // Leadership interview
    if (interviewType === 'leadership') {
      if (categories.some((c) => c.includes('leadership'))) score += 25
      if (categories.some((c) => c.includes('team'))) score += 15
      if (categories.some((c) => c.includes('mentoring'))) score += 15
      if (categories.some((c) => c.includes('hiring'))) score += 10
      if (categories.some((c) => c.includes('conflict'))) score += 10
    }

    // Score by keyword match
    const storyText =
      `${story.title} ${story.situation} ${story.action} ${story.result} ${(story.themes || []).join(' ')}`.toLowerCase()

    for (const keyword of keywords) {
      if (storyText.includes(keyword.toLowerCase())) {
        score += 10
      }
    }

    // Score by project reference (linked to concrete experience)
    if (story.projectRef) {
      score += 5
    }

    return { ...story, relevanceScore: score }
  })

  return scored.sort((a, b) => b.relevanceScore - a.relevanceScore)
}

/**
 * Generate complete interview prep package
 *
 * @param {object} profile - The profile data
 * @param {object} jobContext - Job context
 * @returns {object} Interview prep package
 */
export function generateInterviewPrep(profile, jobContext = {}) {
  // Find matching target role
  const targetRole = findMatchingTargetRole(profile.preferences?.targetRoles || [], jobContext)

  // Generate talking points from summaries and target role
  const talkingPoints = generateTalkingPoints(profile, targetRole, jobContext)

  // Organize stories by category
  const storiesByCategory = organizeStoriesByCategory(profile.stories || [])

  // Get stories ranked by relevance
  const rankedStories = getRelevantStories(profile, jobContext)

  // Get strengths to emphasize from communication prefs
  const strengthsToEmphasize = profile.preferences?.communication?.emphasisAreas || []

  // Detect gaps relevant to this interview
  const gapsToAddress = detectGaps(profile, jobContext)

  // Generate practice questions
  const practiceQuestions = generatePracticeQuestions(storiesByCategory, jobContext)

  return {
    targetRole: targetRole || inferTargetRole(jobContext),
    talkingPoints,
    stories: {
      byCategory: storiesByCategory,
      ranked: rankedStories.slice(0, 10).map((s) => ({
        id: s.id,
        title: s.title,
        relevanceScore: s.relevanceScore,
        categories: s.questionCategories
      }))
    },
    strengthsToEmphasize,
    gapsToAddress: gapsToAddress.filter((g) => g.severity !== 'thin-evidence'),
    practiceQuestions
  }
}

/**
 * Find matching target role from preferences
 */
function findMatchingTargetRole(targetRoles, jobContext) {
  if (!targetRoles || targetRoles.length === 0) {
    return null
  }

  if (!jobContext.title) {
    return targetRoles[0]
  }

  const titleLower = jobContext.title.toLowerCase()

  // Try exact title match first
  const exactMatch = targetRoles.find((role) => role.title.toLowerCase() === titleLower)
  if (exactMatch) return exactMatch

  // Try partial match
  const partialMatch = targetRoles.find(
    (role) =>
      titleLower.includes(role.title.toLowerCase()) ||
      role.title.toLowerCase().includes(titleLower)
  )
  if (partialMatch) return partialMatch

  // Return first as default
  return targetRoles[0]
}

/**
 * Infer target role from job context when none defined
 */
function inferTargetRole(jobContext) {
  if (!jobContext.title) {
    return null
  }

  // Infer level from title
  let level = 'ic'
  const titleLower = jobContext.title.toLowerCase()
  if (titleLower.includes('c-level') || titleLower.includes('chief')) level = 'c-level'
  else if (titleLower.includes('vp') || titleLower.includes('vice president')) level = 'vp'
  else if (titleLower.includes('director')) level = 'director'
  else if (titleLower.includes('manager') || titleLower.includes('head')) level = 'manager'
  else if (titleLower.includes('lead') || titleLower.includes('senior')) level = 'lead'

  return {
    title: jobContext.title,
    level,
    inferred: true
  }
}

/**
 * Generate talking points from profile and target role
 */
function generateTalkingPoints(profile, targetRole, jobContext) {
  const points = []

  // From summary blocks matching audience
  const audience = jobContext.audience || 'technical'
  const summaries = profile.summaryBlocks || []
  const matchingSummary = summaries.find((s) => (s.audiences || []).includes(audience))

  if (matchingSummary) {
    // Extract key phrases from summary
    const sentences = matchingSummary.content.split(/[.!?]+/).filter((s) => s.trim())
    for (const sentence of sentences.slice(0, 3)) {
      points.push({
        type: 'value-prop',
        content: sentence.trim(),
        source: 'summary'
      })
    }
  }

  // From target role priorities
  if (targetRole?.priorities) {
    for (const priority of targetRole.priorities.slice(0, 3)) {
      points.push({
        type: 'priority',
        content: `Focus on ${priority} in this role`,
        source: 'target-role'
      })
    }
  }

  // From recent achievements (projects with metrics)
  for (const exp of (profile.experience || []).slice(0, 2)) {
    for (const proj of (exp.projects || []).slice(0, 2)) {
      if (proj.metrics) {
        const metricStr = formatMetric(proj.metrics)
        points.push({
          type: 'achievement',
          content: `${proj.name}: ${metricStr}`,
          source: 'experience'
        })
      }
    }
  }

  return points
}

/**
 * Organize stories by question category
 */
function organizeStoriesByCategory(stories) {
  const categories = {
    leadership: [],
    technical: [],
    conflict: [],
    teamwork: [],
    challenge: [],
    failure: [],
    success: [],
    other: []
  }

  for (const story of stories) {
    let categorized = false

    for (const cat of story.questionCategories || []) {
      const catLower = cat.toLowerCase()

      if (catLower.includes('leadership')) {
        categories.leadership.push(formatStoryForPrep(story))
        categorized = true
      }
      if (catLower.includes('technical')) {
        categories.technical.push(formatStoryForPrep(story))
        categorized = true
      }
      if (catLower.includes('conflict')) {
        categories.conflict.push(formatStoryForPrep(story))
        categorized = true
      }
      if (catLower.includes('team')) {
        categories.teamwork.push(formatStoryForPrep(story))
        categorized = true
      }
      if (catLower.includes('challenge') || catLower.includes('difficult')) {
        categories.challenge.push(formatStoryForPrep(story))
        categorized = true
      }
      if (catLower.includes('failure') || catLower.includes('mistake')) {
        categories.failure.push(formatStoryForPrep(story))
        categorized = true
      }
      if (catLower.includes('success') || catLower.includes('achievement')) {
        categories.success.push(formatStoryForPrep(story))
        categorized = true
      }
    }

    if (!categorized) {
      categories.other.push(formatStoryForPrep(story))
    }
  }

  // Remove empty categories
  return Object.fromEntries(Object.entries(categories).filter(([_, arr]) => arr.length > 0))
}

/**
 * Format story for interview prep display
 */
function formatStoryForPrep(story) {
  return {
    id: story.id,
    title: story.title,
    situation: story.situation,
    task: story.task,
    action: story.action,
    result: story.result,
    projectRef: story.projectRef,
    themes: story.themes || []
  }
}

/**
 * Generate practice questions based on available stories
 */
function generatePracticeQuestions(storiesByCategory, jobContext) {
  const questions = []

  // Common behavioral questions mapped to categories
  const questionTemplates = {
    leadership: [
      'Tell me about a time you led a team through a difficult project.',
      'Describe a situation where you had to make a tough decision as a leader.',
      'How have you handled underperforming team members?'
    ],
    technical: [
      'Walk me through a complex technical challenge you solved.',
      'Tell me about a time you had to learn a new technology quickly.',
      'Describe your approach to debugging a difficult issue.'
    ],
    conflict: [
      'Tell me about a time you disagreed with a coworker or manager.',
      'Describe a situation where you had to navigate conflicting priorities.',
      'How have you handled giving difficult feedback?'
    ],
    teamwork: [
      'Describe your experience working on cross-functional teams.',
      'Tell me about a successful collaboration.',
      'How do you build relationships with stakeholders?'
    ],
    challenge: [
      'Tell me about the most challenging project you worked on.',
      'Describe a time you had to overcome a significant obstacle.',
      'How do you handle working under pressure?'
    ],
    failure: [
      'Tell me about a time you failed and what you learned.',
      'Describe a mistake you made and how you handled it.',
      'What would you do differently if you could go back?'
    ],
    success: [
      'What accomplishment are you most proud of?',
      'Tell me about exceeding expectations.',
      'Describe your biggest professional achievement.'
    ]
  }

  // Add questions for categories we have stories for
  for (const [category, templates] of Object.entries(questionTemplates)) {
    if (storiesByCategory[category] && storiesByCategory[category].length > 0) {
      const story = storiesByCategory[category][0]
      questions.push({
        category,
        question: templates[0],
        suggestedStory: story.title,
        storyId: story.id
      })
    }
  }

  // Add role-specific questions
  if (jobContext.title) {
    const titleLower = jobContext.title.toLowerCase()
    if (titleLower.includes('lead') || titleLower.includes('manager')) {
      questions.push({
        category: 'role-specific',
        question: `What makes you qualified for the ${jobContext.title} role?`,
        suggestedStory: null
      })
    }
  }

  return questions
}

/**
 * Extract keywords from job context
 */
function extractKeywords(jobContext) {
  const keywords = []

  if (jobContext.keywords) {
    keywords.push(...jobContext.keywords)
  }

  if (jobContext.title) {
    keywords.push(...jobContext.title.split(/\s+/).filter((w) => w.length > 2))
  }

  if (jobContext.company) {
    keywords.push(jobContext.company)
  }

  return [...new Set(keywords)]
}

/**
 * Format a metric object to string
 */
function formatMetric(metrics) {
  if (!metrics) return ''

  const { value, unit, context } = metrics
  let str = `${value}`

  if (unit === 'percent') {
    str = `${value}%`
  } else if (unit) {
    str = `${value} ${unit}`
  }

  if (context) {
    str += ` ${context}`
  }

  return str
}

/**
 * Get list of profile item IDs used in interview prep
 * (for document history tracking)
 *
 * @param {object} profile - The profile
 * @param {object} jobContext - Job context
 * @returns {Array} Array of { itemType, itemId } objects
 */
export function getUsedInterviewPrepItems(profile, jobContext = {}) {
  const usedItems = []

  // Get relevant stories
  const stories = getRelevantStories(profile, jobContext)
  for (const story of stories.slice(0, 10)) {
    usedItems.push({ itemType: 'story', itemId: story.id })
  }

  // Get summaries used for talking points
  const audience = jobContext.audience || 'technical'
  const matchingSummary = (profile.summaryBlocks || []).find((s) =>
    (s.audiences || []).includes(audience)
  )
  if (matchingSummary) {
    usedItems.push({ itemType: 'summary', itemId: matchingSummary.id })
  }

  return usedItems
}
