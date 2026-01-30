/**
 * Profile Tools - MCP tool implementations for profile access
 *
 * Provides tools for querying profile data:
 * - get_profile: Returns full profile data
 * - get_experience_by_theme: Filter experience by project tags
 * - get_stories_by_category: Filter STAR stories by question category
 * - get_skills_by_category: Filter skills by category
 */

import { loadProfile } from '../data/profile-loader.js'

/**
 * Get the full profile data
 *
 * @returns {object} The complete profile object
 */
export function getProfile() {
  try {
    const profile = loadProfile()
    return profile
  } catch (error) {
    return { error: `Failed to load profile: ${error.message}` }
  }
}

/**
 * Get experience entries filtered by theme/tag
 *
 * Returns experience entries where any project has the matching tag.
 * Useful for queries like "show me where you demonstrated leadership"
 *
 * @param {object} params - Parameters
 * @param {string} params.theme - Tag to filter by (e.g., 'leadership', 'technical')
 * @returns {Array} Matching experience entries
 */
export function getExperienceByTheme({ theme }) {
  if (!theme) {
    return { error: 'theme parameter is required' }
  }

  try {
    const profile = loadProfile()
    const normalizedTheme = theme.toLowerCase()

    const matching = (profile.experience || []).filter((exp) =>
      exp.projects.some((proj) =>
        (proj.tags || []).some((tag) => tag.toLowerCase().includes(normalizedTheme))
      )
    )

    return matching
  } catch (error) {
    return { error: `Failed to filter experience: ${error.message}` }
  }
}

/**
 * Get STAR stories filtered by question category
 *
 * Returns stories matching the interview question category.
 * Useful for queries like "find stories about conflict resolution"
 *
 * @param {object} params - Parameters
 * @param {string} params.category - Question category to filter by
 * @returns {Array} Matching STAR stories
 */
export function getStoriesByCategory({ category }) {
  if (!category) {
    return { error: 'category parameter is required' }
  }

  try {
    const profile = loadProfile()
    const normalizedCategory = category.toLowerCase()

    const matching = (profile.stories || []).filter((story) =>
      (story.questionCategories || []).some((cat) =>
        cat.toLowerCase().includes(normalizedCategory)
      )
    )

    return matching
  } catch (error) {
    return { error: `Failed to filter stories: ${error.message}` }
  }
}

/**
 * Get skills filtered by category
 *
 * Returns skills in the specified category with their evidence references.
 * Useful for queries like "what technical skills do you have?"
 *
 * @param {object} params - Parameters
 * @param {string} params.category - Skill category to filter by (e.g., 'Technical', 'Leadership')
 * @returns {Array} Matching skills with evidence
 */
export function getSkillsByCategory({ category }) {
  if (!category) {
    return { error: 'category parameter is required' }
  }

  try {
    const profile = loadProfile()
    const normalizedCategory = category.toLowerCase()

    const matching = (profile.skills || []).filter(
      (skill) =>
        skill.category.toLowerCase().includes(normalizedCategory) ||
        skill.subcategory.toLowerCase().includes(normalizedCategory)
    )

    return matching
  } catch (error) {
    return { error: `Failed to filter skills: ${error.message}` }
  }
}

/**
 * Get summary blocks filtered by audience
 *
 * Returns summary blocks appropriate for a specific audience.
 * Useful for generating audience-specific summaries.
 *
 * @param {object} params - Parameters
 * @param {string} params.audience - Audience to filter by (e.g., 'technical', 'leadership')
 * @returns {Array} Matching summary blocks
 */
export function getSummaryBlocksByAudience({ audience }) {
  if (!audience) {
    return { error: 'audience parameter is required' }
  }

  try {
    const profile = loadProfile()
    const normalizedAudience = audience.toLowerCase()

    const matching = (profile.summaryBlocks || []).filter((block) =>
      (block.audiences || []).some((aud) => aud.toLowerCase() === normalizedAudience)
    )

    return matching
  } catch (error) {
    return { error: `Failed to filter summary blocks: ${error.message}` }
  }
}

/**
 * Get target roles (job search criteria)
 *
 * Returns all defined target roles for job matching.
 *
 * @returns {Array} Target roles
 */
export function getTargetRoles() {
  try {
    const profile = loadProfile()
    return profile.preferences?.targetRoles || []
  } catch (error) {
    return { error: `Failed to get target roles: ${error.message}` }
  }
}

/**
 * Get communication preferences
 *
 * Returns tone and style preferences for content generation.
 *
 * @returns {object|null} Communication preferences or null if not set
 */
export function getCommunicationPrefs() {
  try {
    const profile = loadProfile()
    return profile.preferences?.communication || null
  } catch (error) {
    return { error: `Failed to get communication preferences: ${error.message}` }
  }
}
