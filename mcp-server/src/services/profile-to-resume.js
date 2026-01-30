/**
 * Profile-to-Resume Transformation Service
 *
 * Transforms profile data into the format expected by the Python resume generator.
 * Provides preview of data sources and relevance-based selection.
 */

import { detectGaps } from './gap-detector.js'

/**
 * Preview which profile sections will be used for resume generation
 *
 * @param {object} profile - The profile data
 * @param {object} jobContext - Job context (company, title, keywords, audience)
 * @returns {object} Preview of data sources that will be used
 */
export function previewResumeSources(profile, jobContext = {}) {
  const audience = jobContext.audience || 'technical'

  // Preview summary blocks
  const matchingBlocks = (profile.summaryBlocks || []).filter((block) =>
    (block.audiences || []).includes(audience)
  )

  const summaryPreview = {
    blocks: matchingBlocks.map((block) => ({
      id: block.id,
      preview: block.content.substring(0, 50) + (block.content.length > 50 ? '...' : ''),
      audiences: block.audiences
    })),
    matchingAudience: audience
  }

  // Preview experience
  const experiencePreview = {
    roles: (profile.experience || []).map((exp) => {
      const relevantProjects = selectRelevantProjects(exp.projects || [], jobContext)
      return {
        id: exp.id,
        title: exp.role?.title,
        company: exp.role?.company,
        projectCount: (exp.projects || []).length,
        relevantProjects: relevantProjects.slice(0, 3).map((p) => p.name)
      }
    }),
    totalProjects: (profile.experience || []).reduce(
      (sum, exp) => sum + (exp.projects || []).length,
      0
    )
  }

  // Preview skills
  const relevantSkills = selectRelevantSkills(profile.skills || [], jobContext)
  const skillsPreview = {
    relevant: relevantSkills.slice(0, 10).map((skill) => ({
      name: skill.name,
      proficiency: skill.proficiency
    })),
    total: (profile.skills || []).length,
    categories: [...new Set((profile.skills || []).map((s) => s.category))]
  }

  // Detect gaps
  const gaps = detectGaps(profile, jobContext)

  return {
    summary: summaryPreview,
    experience: experiencePreview,
    skills: skillsPreview,
    gaps
  }
}

/**
 * Build resume data from profile in format expected by Python generator
 *
 * @param {object} profile - The profile data
 * @param {object} jobContext - Job context (company, title, keywords, audience)
 * @param {object} options - Build options
 * @returns {object} Resume data matching resume_data_v9_1.json structure
 */
export function buildResumeFromProfile(profile, jobContext = {}, options = {}) {
  const audience = jobContext.audience || 'technical'
  const maxExperienceItems = options.maxExperienceItems || 5
  const maxSkills = options.maxSkills || 20

  // Select summary block
  const summary = selectSummaryBlock(profile.summaryBlocks || [], audience)

  // Select and transform experience
  const experience = selectRelevantExperience(profile, jobContext, maxExperienceItems)
  const transformedExperience = transformExperience(experience)

  // Select and transform skills
  const relevantSkills = selectRelevantSkills(profile.skills || [], jobContext)
  const transformedSkills = transformSkills(relevantSkills.slice(0, maxSkills))

  // Build contact from profile or defaults
  const contact = {
    name: profile.metadata?.name || 'John Ra',
    email: profile.metadata?.email || '',
    phone: profile.metadata?.phone || '',
    location: profile.metadata?.location || '',
    linkedin: profile.metadata?.linkedin || '',
    website: profile.metadata?.website || ''
  }

  return {
    contact,
    summary: summary?.content || '',
    experience: transformedExperience,
    skills: transformedSkills,
    education: profile.education || [],
    target_company: jobContext.company || '',
    target_title: jobContext.title || ''
  }
}

/**
 * Select the most appropriate summary block for the audience
 *
 * @param {Array} summaryBlocks - Available summary blocks
 * @param {string} audience - Target audience
 * @returns {object|null} Best matching summary block
 */
export function selectSummaryBlock(summaryBlocks, audience) {
  if (!summaryBlocks || summaryBlocks.length === 0) {
    return null
  }

  // First try exact audience match
  const exactMatch = summaryBlocks.find((block) => (block.audiences || []).includes(audience))

  if (exactMatch) {
    return exactMatch
  }

  // Fall back to first available
  return summaryBlocks[0]
}

/**
 * Select relevant experience entries based on job context
 *
 * @param {object} profile - The profile data
 * @param {object} jobContext - Job context with keywords
 * @param {number} maxItems - Maximum number of experience entries to return
 * @returns {Array} Selected experience entries with relevant projects
 */
export function selectRelevantExperience(profile, jobContext = {}, maxItems = 5) {
  const experience = profile.experience || []

  if (experience.length === 0) {
    return []
  }

  // Score and sort experience by relevance
  const scored = experience.map((exp) => {
    const relevantProjects = selectRelevantProjects(exp.projects || [], jobContext)
    const score = calculateExperienceScore(exp, relevantProjects, jobContext)

    return {
      ...exp,
      relevanceScore: score,
      relevantProjects
    }
  })

  // Sort by relevance, then by date (most recent first)
  scored.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore
    }
    // Fall back to chronological (most recent first)
    const dateA = new Date(a.role?.endDate || a.role?.startDate || 0)
    const dateB = new Date(b.role?.endDate || b.role?.startDate || 0)
    return dateB - dateA
  })

  return scored.slice(0, maxItems)
}

/**
 * Select relevant projects based on job context keywords
 *
 * @param {Array} projects - Available projects
 * @param {object} jobContext - Job context with keywords
 * @returns {Array} Projects sorted by relevance
 */
export function selectRelevantProjects(projects, jobContext = {}) {
  if (!projects || projects.length === 0) {
    return []
  }

  const keywords = extractKeywords(jobContext)

  const scored = projects.map((project) => {
    const score = calculateProjectScore(project, keywords)
    return { ...project, relevanceScore: score }
  })

  return scored.sort((a, b) => b.relevanceScore - a.relevanceScore)
}

/**
 * Select relevant skills based on job context
 *
 * @param {Array} skills - Available skills
 * @param {object} jobContext - Job context with keywords
 * @returns {Array} Skills sorted by relevance
 */
export function selectRelevantSkills(skills, jobContext = {}) {
  if (!skills || skills.length === 0) {
    return []
  }

  const keywords = extractKeywords(jobContext)

  const scored = skills.map((skill) => {
    let score = 0

    // Score by proficiency
    if (skill.proficiency === 'expert') score += 30
    else if (skill.proficiency === 'proficient') score += 20
    else if (skill.proficiency === 'familiar') score += 10

    // Score by keyword match
    const skillText = `${skill.name} ${skill.category} ${skill.subcategory}`.toLowerCase()
    for (const keyword of keywords) {
      if (skillText.includes(keyword.toLowerCase())) {
        score += 20
      }
    }

    // Score by evidence strength
    score += (skill.evidence?.length || 0) * 5

    return { ...skill, relevanceScore: score }
  })

  return scored.sort((a, b) => b.relevanceScore - a.relevanceScore)
}

/**
 * Transform experience entries to resume format
 *
 * @param {Array} experience - Experience entries with relevant projects
 * @returns {Array} Transformed experience for resume
 */
function transformExperience(experience) {
  return experience.map((exp) => {
    // Transform projects to bullets
    const bullets = (exp.relevantProjects || exp.projects || []).map((project) => {
      // Build bullet from project description and metrics
      let bullet = project.description || project.name

      if (project.metrics) {
        const metricStr = formatMetric(project.metrics)
        if (metricStr && !bullet.includes(metricStr)) {
          bullet = bullet.replace(/\.$/, '') + ` (${metricStr}).`
        }
      }

      return bullet
    })

    return {
      title: exp.role?.title || '',
      company: exp.role?.company || '',
      location: exp.role?.location || '',
      startDate: exp.role?.startDate || '',
      endDate: exp.role?.endDate,
      bullets: bullets.slice(0, 5) // Max 5 bullets per role
    }
  })
}

/**
 * Transform skills to resume format
 *
 * @param {Array} skills - Selected skills
 * @returns {object} Transformed skills grouped by category
 */
function transformSkills(skills) {
  const grouped = {}

  for (const skill of skills) {
    const category = skill.category || 'Other'
    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push(skill.name)
  }

  return grouped
}

/**
 * Calculate experience entry score based on relevance
 */
function calculateExperienceScore(exp, relevantProjects, jobContext) {
  let score = 0

  // Score based on relevant projects
  score += relevantProjects.filter((p) => p.relevanceScore > 0).length * 10

  // Score based on role title match
  if (jobContext.title && exp.role?.title) {
    const titleWords = jobContext.title.toLowerCase().split(/\s+/)
    const roleTitle = exp.role.title.toLowerCase()
    for (const word of titleWords) {
      if (roleTitle.includes(word)) {
        score += 15
      }
    }
  }

  // Current role gets bonus
  if (exp.role?.endDate === null) {
    score += 10
  }

  return score
}

/**
 * Calculate project score based on keyword match
 */
function calculateProjectScore(project, keywords) {
  let score = 0

  const projectText =
    `${project.name} ${project.description} ${(project.tags || []).join(' ')}`.toLowerCase()

  for (const keyword of keywords) {
    if (projectText.includes(keyword.toLowerCase())) {
      score += 10
    }
  }

  // Bonus for having metrics
  if (project.metrics) {
    score += 5
  }

  return score
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
 * Get list of profile item IDs used in resume generation
 * (for document history tracking)
 *
 * @param {object} profile - The profile
 * @param {object} jobContext - Job context
 * @returns {Array} Array of { itemType, itemId } objects
 */
export function getUsedProfileItems(profile, jobContext = {}) {
  const usedItems = []

  // Get selected summary block
  const summaryBlock = selectSummaryBlock(
    profile.summaryBlocks || [],
    jobContext.audience || 'technical'
  )
  if (summaryBlock) {
    usedItems.push({ itemType: 'summary', itemId: summaryBlock.id })
  }

  // Get selected experience
  const experience = selectRelevantExperience(profile, jobContext)
  for (const exp of experience) {
    usedItems.push({ itemType: 'experience', itemId: exp.id })
    for (const proj of exp.relevantProjects || exp.projects || []) {
      usedItems.push({ itemType: 'project', itemId: proj.id })
    }
  }

  // Get selected skills
  const skills = selectRelevantSkills(profile.skills || [], jobContext).slice(0, 20)
  for (const skill of skills) {
    usedItems.push({ itemType: 'skill', itemId: skill.id })
  }

  return usedItems
}
