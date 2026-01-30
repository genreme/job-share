/**
 * Extraction Mapper - Maps extractions to profile fields
 *
 * Handles:
 * - Adding extractions to the appropriate profile section
 * - Merging extractions with existing profile items
 * - Determining target fields for extractions
 * - Creating properly structured profile entries
 */

import { v4 as uuidv4 } from 'uuid'
import { addHistoryEntry } from '../data/profile-loader.js'

// Category to profile field mapping
const CATEGORY_TO_FIELD = {
  skill: 'skills',
  achievement: 'experience.projects', // Needs role context
  preference: 'preferences',
  story: 'stories',
  pattern: 'metadata.patterns' // Optional field for observed patterns
}

// Confidence level to percentage mapping
const CONFIDENCE_TO_PERCENTAGE = {
  high: 90,
  medium: 70,
  low: 50
}

/**
 * Create a skill entry from an extraction
 *
 * @param {object} extraction - The extraction to convert
 * @returns {object} SkillSchema-compliant object
 */
function createSkillFromExtraction(extraction) {
  const now = new Date().toISOString()
  const projectId = uuidv4() // Placeholder evidence - user can link later

  return {
    id: uuidv4(),
    name: extraction.content,
    category: 'Uncategorized', // User can categorize later
    subcategory: 'General',
    proficiency: 'familiar', // Conservative default
    source: 'inferred',
    confidence: CONFIDENCE_TO_PERCENTAGE[extraction.confidence] || 70,
    evidence: [projectId], // Placeholder - min(1) required
    createdAt: now,
    updatedAt: now
  }
}

/**
 * Create a story entry from an extraction
 *
 * @param {object} extraction - The extraction to convert
 * @returns {object} STARStorySchema-compliant object
 */
function createStoryFromExtraction(extraction) {
  const now = new Date().toISOString()

  // Try to parse STAR components from content
  // Format: "SITUATION: ... TASK: ... ACTION: ... RESULT: ..."
  const content = extraction.content
  let situation = 'To be completed'
  let task = 'To be completed'
  let action = 'To be completed'
  let result = 'To be completed'
  let title = extraction.content.substring(0, 50)

  // Simple parsing for structured content
  if (content.includes('SITUATION:') || content.includes('Situation:')) {
    const parts = content.split(/(?:SITUATION|Situation|TASK|Task|ACTION|Action|RESULT|Result):/i)
    if (parts.length >= 5) {
      situation = parts[1]?.trim() || situation
      task = parts[2]?.trim() || task
      action = parts[3]?.trim() || action
      result = parts[4]?.trim() || result
      title = situation.substring(0, 50)
    }
  }

  return {
    id: uuidv4(),
    title,
    situation,
    task,
    action,
    result,
    questionCategories: [], // User can categorize later
    themes: [],
    variants: [],
    createdAt: now,
    updatedAt: now
  }
}

/**
 * Create a preference update from an extraction
 *
 * @param {object} extraction - The extraction to convert
 * @param {object} existingPrefs - Existing preferences object
 * @returns {object} Updated preferences
 */
function createPreferenceFromExtraction(extraction, existingPrefs = {}) {
  const now = new Date().toISOString()
  const content = extraction.content.toLowerCase()

  // Clone existing prefs
  const prefs = { ...existingPrefs }

  // Determine preference type and update
  if (content.includes('remote') || content.includes('hybrid') || content.includes('onsite')) {
    // Target role preference
    if (!prefs.targetRoles) prefs.targetRoles = []
    // Add as note to first target role or create placeholder
    // Since we can't create full TargetRoleSchema from just a preference,
    // we'll add to communication custom guidelines
    if (!prefs.communication) {
      prefs.communication = {
        tone: 'conversational',
        verbosity: 'balanced',
        emphasisAreas: [],
        avoidPhrases: [],
        customGuidelines: extraction.content,
        createdAt: now,
        updatedAt: now
      }
    } else {
      prefs.communication = {
        ...prefs.communication,
        customGuidelines: prefs.communication.customGuidelines
          ? `${prefs.communication.customGuidelines}\n${extraction.content}`
          : extraction.content,
        updatedAt: now
      }
    }
  } else if (
    content.includes('tone') ||
    content.includes('style') ||
    content.includes('formal') ||
    content.includes('casual')
  ) {
    // Communication preference
    if (!prefs.communication) {
      prefs.communication = {
        tone: 'conversational',
        verbosity: 'balanced',
        emphasisAreas: [],
        avoidPhrases: [],
        createdAt: now,
        updatedAt: now
      }
    }

    // Update based on content
    if (content.includes('formal')) {
      prefs.communication.tone = 'formal'
    } else if (content.includes('casual') || content.includes('conversational')) {
      prefs.communication.tone = 'conversational'
    } else if (content.includes('direct')) {
      prefs.communication.tone = 'direct'
    }
    prefs.communication.updatedAt = now
  } else {
    // General preference - add to emphasis areas or custom guidelines
    if (!prefs.communication) {
      prefs.communication = {
        tone: 'conversational',
        verbosity: 'balanced',
        emphasisAreas: [extraction.content],
        avoidPhrases: [],
        createdAt: now,
        updatedAt: now
      }
    } else {
      prefs.communication = {
        ...prefs.communication,
        emphasisAreas: [...(prefs.communication.emphasisAreas || []), extraction.content],
        updatedAt: now
      }
    }
  }

  return prefs
}

/**
 * Determine the target field for an extraction
 *
 * @param {object} extraction - The extraction to analyze
 * @returns {string} Target field path in profile
 */
export function determineTargetField(extraction) {
  if (extraction.targetField) {
    return extraction.targetField
  }

  return CATEGORY_TO_FIELD[extraction.category] || 'metadata.notes'
}

/**
 * Add an extraction to a profile
 *
 * Creates properly structured profile entries based on extraction category.
 * Returns a new profile object (immutable pattern).
 *
 * @param {object} profile - Current profile (not mutated)
 * @param {object} extraction - The extraction to add
 * @param {string} [targetField] - Override target field
 * @returns {object} Updated profile
 */
export function addExtractionToProfile(profile, extraction, targetField) {
  const field = targetField || determineTargetField(extraction)
  let updatedProfile = { ...profile }
  let newValue = null

  switch (extraction.category) {
    case 'skill': {
      const skill = createSkillFromExtraction(extraction)
      newValue = skill
      updatedProfile = {
        ...updatedProfile,
        skills: [...(updatedProfile.skills || []), skill]
      }
      break
    }

    case 'story': {
      const story = createStoryFromExtraction(extraction)
      newValue = story
      updatedProfile = {
        ...updatedProfile,
        stories: [...(updatedProfile.stories || []), story]
      }
      break
    }

    case 'preference': {
      const prefs = createPreferenceFromExtraction(extraction, updatedProfile.preferences)
      newValue = prefs
      updatedProfile = {
        ...updatedProfile,
        preferences: prefs
      }
      break
    }

    case 'achievement': {
      // For achievements, add a note to metadata since we don't have role context
      const achievementNote = {
        id: uuidv4(),
        content: extraction.content,
        sourceQuote: extraction.sourceQuote,
        createdAt: new Date().toISOString()
      }
      newValue = achievementNote
      updatedProfile = {
        ...updatedProfile,
        metadata: {
          ...updatedProfile.metadata,
          achievementNotes: [...(updatedProfile.metadata?.achievementNotes || []), achievementNote]
        }
      }
      break
    }

    case 'pattern': {
      // Add to patterns array in metadata
      const pattern = extraction.content
      newValue = pattern
      updatedProfile = {
        ...updatedProfile,
        metadata: {
          ...updatedProfile.metadata,
          patterns: [...(updatedProfile.metadata?.patterns || []), pattern]
        }
      }
      break
    }

    default:
      // Unknown category - store in metadata notes
      updatedProfile = {
        ...updatedProfile,
        metadata: {
          ...updatedProfile.metadata,
          notes: [...(updatedProfile.metadata?.notes || []), extraction.content]
        }
      }
  }

  // Add history entry
  const { profile: profileWithHistory } = addHistoryEntry(
    updatedProfile,
    'create',
    extraction.category === 'preference' ? 'preference' : extraction.category,
    newValue?.id || extraction.id,
    null,
    newValue,
    `Added from extraction: ${extraction.sourceQuote || 'conversation'}`
  )

  return profileWithHistory
}

/**
 * Find an item in the profile by ID
 *
 * @param {object} profile - The profile to search
 * @param {string} itemId - The item ID to find
 * @returns {{ item: object | null, field: string, index: number }}
 */
function findProfileItem(profile, itemId) {
  // Check skills
  const skillIndex = (profile.skills || []).findIndex((s) => s.id === itemId)
  if (skillIndex >= 0) {
    return { item: profile.skills[skillIndex], field: 'skills', index: skillIndex }
  }

  // Check stories
  const storyIndex = (profile.stories || []).findIndex((s) => s.id === itemId)
  if (storyIndex >= 0) {
    return { item: profile.stories[storyIndex], field: 'stories', index: storyIndex }
  }

  // Check experience projects
  for (let expIdx = 0; expIdx < (profile.experience || []).length; expIdx++) {
    const exp = profile.experience[expIdx]
    const projIndex = (exp.projects || []).findIndex((p) => p.id === itemId)
    if (projIndex >= 0) {
      return {
        item: exp.projects[projIndex],
        field: `experience.${expIdx}.projects`,
        index: projIndex
      }
    }
  }

  // Check summary blocks
  const summaryIndex = (profile.summaryBlocks || []).findIndex((s) => s.id === itemId)
  if (summaryIndex >= 0) {
    return { item: profile.summaryBlocks[summaryIndex], field: 'summaryBlocks', index: summaryIndex }
  }

  // Check target roles
  const roleIndex = (profile.preferences?.targetRoles || []).findIndex((r) => r.id === itemId)
  if (roleIndex >= 0) {
    return {
      item: profile.preferences.targetRoles[roleIndex],
      field: 'preferences.targetRoles',
      index: roleIndex
    }
  }

  return { item: null, field: '', index: -1 }
}

/**
 * Merge an extraction with an existing profile item
 *
 * Updates fields based on extraction content and tracks in history.
 * Returns a new profile object (immutable pattern).
 *
 * @param {object} profile - Current profile (not mutated)
 * @param {object} extraction - The extraction to merge
 * @param {string} existingItemId - ID of the existing profile item
 * @returns {object} Updated profile
 */
export function mergeWithExisting(profile, extraction, existingItemId) {
  const { item, field, index } = findProfileItem(profile, existingItemId)

  if (!item) {
    // Item not found - fall back to adding as new
    return addExtractionToProfile(profile, extraction)
  }

  let updatedProfile = { ...profile }
  const now = new Date().toISOString()
  const previousValue = { ...item }

  // Update based on category
  switch (extraction.category) {
    case 'skill': {
      // Update confidence if higher
      const newConfidence = CONFIDENCE_TO_PERCENTAGE[extraction.confidence] || 70
      const updatedSkill = {
        ...item,
        confidence: Math.max(item.confidence || 0, newConfidence),
        updatedAt: now
      }

      // If sourceQuote provided, could indicate more evidence
      if (extraction.sourceQuote) {
        // Note: In a real scenario, we'd link to an actual project
        // For now, just update the confidence
      }

      const skills = [...updatedProfile.skills]
      skills[index] = updatedSkill
      updatedProfile = { ...updatedProfile, skills }
      break
    }

    case 'story': {
      // Update story components if extraction provides more detail
      const updatedStory = {
        ...item,
        updatedAt: now
      }

      // Try to extract STAR components and update if more detailed
      const content = extraction.content
      if (content.includes('RESULT:') || content.includes('Result:')) {
        const resultMatch = content.match(/(?:RESULT|Result):\s*(.+)/i)
        if (resultMatch && resultMatch[1].length > (item.result || '').length) {
          updatedStory.result = resultMatch[1].trim()
        }
      }

      const stories = [...updatedProfile.stories]
      stories[index] = updatedStory
      updatedProfile = { ...updatedProfile, stories }
      break
    }

    case 'preference': {
      // Merge preferences
      const prefs = createPreferenceFromExtraction(extraction, updatedProfile.preferences)
      updatedProfile = { ...updatedProfile, preferences: prefs }
      break
    }

    case 'achievement': {
      // Update project description if in experience
      if (field.startsWith('experience.')) {
        const [, expIdxStr, , projIdxStr] = field.split('.')
        const expIdx = parseInt(expIdxStr, 10)
        const projIdx = parseInt(projIdxStr, 10) || index

        const experience = [...updatedProfile.experience]
        const exp = { ...experience[expIdx] }
        const projects = [...exp.projects]
        projects[projIdx] = {
          ...projects[projIdx],
          description: extraction.content,
          updatedAt: now
        }
        exp.projects = projects
        experience[expIdx] = exp
        updatedProfile = { ...updatedProfile, experience }
      }
      break
    }

    default:
      // For other categories, just add to metadata notes
      updatedProfile = {
        ...updatedProfile,
        metadata: {
          ...updatedProfile.metadata,
          notes: [...(updatedProfile.metadata?.notes || []), extraction.content]
        }
      }
  }

  // Add history entry with previousValue
  const entityType =
    extraction.category === 'preference'
      ? 'preference'
      : extraction.category === 'story'
        ? 'story'
        : extraction.category
  const { profile: profileWithHistory } = addHistoryEntry(
    updatedProfile,
    'update',
    entityType,
    existingItemId,
    previousValue,
    field === 'skills'
      ? updatedProfile.skills[index]
      : field === 'stories'
        ? updatedProfile.stories[index]
        : extraction.content,
    `Merged from extraction: ${extraction.sourceQuote || 'conversation'}`
  )

  return profileWithHistory
}
