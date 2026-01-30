/**
 * Profile-to-Cover-Letter Transformation Service
 *
 * Transforms profile data into the format expected by the cover letter generator.
 * Selects relevant stories and achievements based on job context.
 */

import { detectGaps } from './gap-detector.js'

/**
 * Preview which profile sections will be used for cover letter generation
 *
 * @param {object} profile - The profile data
 * @param {object} jobContext - Job context (company, title, keywords)
 * @returns {object} Preview of data sources that will be used
 */
export function previewCoverLetterSources(profile, jobContext = {}) {
  const communication = profile.preferences?.communication

  // Get matching stories
  const stories = getRelevantStoriesForCoverLetter(profile.stories || [], jobContext)

  // Get matching achievements from experience
  const achievements = extractAchievements(profile.experience || [], jobContext)

  // Detect gaps
  const gaps = detectGaps(profile, jobContext)

  return {
    tone: communication?.tone || 'conversational',
    verbosity: communication?.verbosity || 'balanced',
    avoidPhrases: communication?.avoidPhrases || [],
    emphasisAreas: communication?.emphasisAreas || [],
    matchingStories: stories.slice(0, 5).map((story) => ({
      id: story.id,
      title: story.title,
      relevance: story.relevanceScore
    })),
    matchingAchievements: achievements.slice(0, 5).map((ach) => ({
      project: ach.projectName,
      metric: ach.metric,
      relevance: ach.relevanceScore
    })),
    gaps
  }
}

/**
 * Build cover letter data from profile in format expected by generator
 *
 * @param {object} profile - The profile data
 * @param {object} jobContext - Job context (company, title, hiringManager, keywords)
 * @param {object} options - Build options
 * @returns {object} Cover letter data for generator
 */
export function buildCoverLetterFromProfile(profile, jobContext = {}, options = {}) {
  const communication = profile.preferences?.communication || {}

  // Select best story for cover letter (1-2 max)
  const stories = getRelevantStoriesForCoverLetter(profile.stories || [], jobContext)
  const selectedStory = stories.length > 0 ? formatStoryForCoverLetter(stories[0]) : null

  // Select key achievements
  const achievements = extractAchievements(profile.experience || [], jobContext)
  const keyAchievements = achievements.slice(0, 3).map((ach) => ({
    description: ach.description,
    metric: ach.metric,
    context: ach.context
  }))

  // Build contact info
  const contact = {
    name: profile.metadata?.name || 'John Ra',
    email: profile.metadata?.email || '',
    phone: profile.metadata?.phone || '',
    location: profile.metadata?.location || '',
    linkedin: profile.metadata?.linkedin || ''
  }

  return {
    contact,
    tone: communication.tone || 'conversational',
    verbosity: communication.verbosity || 'balanced',
    avoid_phrases: communication.avoidPhrases || [],
    emphasis_areas: communication.emphasisAreas || [],
    key_achievements: keyAchievements,
    relevant_story: selectedStory,
    target_company: jobContext.company || '',
    target_title: jobContext.title || '',
    hiring_manager: jobContext.hiringManager || 'Hiring Manager'
  }
}

/**
 * Get relevant stories for cover letter based on job context
 *
 * @param {Array} stories - Available STAR stories
 * @param {object} jobContext - Job context
 * @returns {Array} Stories sorted by relevance
 */
function getRelevantStoriesForCoverLetter(stories, jobContext = {}) {
  if (!stories || stories.length === 0) {
    return []
  }

  const keywords = extractKeywords(jobContext)

  const scored = stories.map((story) => {
    let score = 0

    // Score by keyword match in title, situation, and result
    const storyText =
      `${story.title} ${story.situation} ${story.result} ${(story.themes || []).join(' ')}`.toLowerCase()

    for (const keyword of keywords) {
      if (storyText.includes(keyword.toLowerCase())) {
        score += 15
      }
    }

    // Score by question category relevance
    const categories = story.questionCategories || []

    // Leadership stories for leadership roles
    if (jobContext.title?.toLowerCase().match(/lead|manager|director|head|vp/)) {
      if (categories.some((cat) => cat.toLowerCase().includes('leadership'))) {
        score += 20
      }
    }

    // Problem-solving stories are generally good for cover letters
    if (categories.some((cat) => cat.toLowerCase().includes('problem'))) {
      score += 10
    }

    // Impact/achievement stories
    if (categories.some((cat) => cat.toLowerCase().match(/achievement|impact|success/))) {
      score += 15
    }

    return { ...story, relevanceScore: score }
  })

  return scored.sort((a, b) => b.relevanceScore - a.relevanceScore)
}

/**
 * Format a STAR story for cover letter use
 *
 * @param {object} story - The STAR story
 * @returns {object} Formatted story
 */
function formatStoryForCoverLetter(story) {
  return {
    title: story.title,
    situation: story.situation,
    action: story.action,
    result: story.result,
    // Combine into a narrative suitable for cover letter
    narrative: `${story.situation} ${story.action} ${story.result}`
  }
}

/**
 * Extract achievements with metrics from experience
 *
 * @param {Array} experience - Experience entries
 * @param {object} jobContext - Job context for relevance scoring
 * @returns {Array} Achievements sorted by relevance
 */
function extractAchievements(experience, jobContext = {}) {
  const achievements = []
  const keywords = extractKeywords(jobContext)

  for (const exp of experience) {
    for (const project of exp.projects || []) {
      if (project.metrics || project.description?.match(/\d+%|\d+ percent|\$\d+/i)) {
        let metric = ''
        if (project.metrics) {
          metric = formatMetric(project.metrics)
        } else {
          // Extract metric from description
          const metricMatch = project.description.match(/(\d+%|\d+ percent|\$[\d,]+|\d+x)/i)
          metric = metricMatch ? metricMatch[0] : ''
        }

        // Score relevance
        let relevanceScore = 0
        const projectText =
          `${project.name} ${project.description} ${(project.tags || []).join(' ')}`.toLowerCase()
        for (const keyword of keywords) {
          if (projectText.includes(keyword.toLowerCase())) {
            relevanceScore += 10
          }
        }

        // Bonus for having explicit metrics
        if (project.metrics) {
          relevanceScore += 5
        }

        achievements.push({
          projectName: project.name,
          description: project.description,
          metric,
          context: project.metrics?.context || '',
          relevanceScore,
          projectId: project.id
        })
      }
    }
  }

  return achievements.sort((a, b) => b.relevanceScore - a.relevanceScore)
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
 * Get list of profile item IDs used in cover letter generation
 * (for document history tracking)
 *
 * @param {object} profile - The profile
 * @param {object} jobContext - Job context
 * @returns {Array} Array of { itemType, itemId } objects
 */
export function getUsedCoverLetterItems(profile, jobContext = {}) {
  const usedItems = []

  // Get selected stories
  const stories = getRelevantStoriesForCoverLetter(profile.stories || [], jobContext)
  if (stories.length > 0) {
    usedItems.push({ itemType: 'story', itemId: stories[0].id })
  }

  // Get achievements (projects with metrics)
  const achievements = extractAchievements(profile.experience || [], jobContext)
  for (const ach of achievements.slice(0, 3)) {
    usedItems.push({ itemType: 'project', itemId: ach.projectId })
  }

  return usedItems
}
