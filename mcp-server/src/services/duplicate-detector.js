/**
 * Duplicate Detector - Find similar entries in profile using fuzzy matching
 *
 * Uses string-similarity for fuzzy comparison of:
 * - Skills by name (case-insensitive)
 * - Stories by title + situation (weighted)
 * - Summary blocks by content (first 100 chars)
 */

import stringSimilarity from 'string-similarity'

// Default threshold for considering items duplicates (85%)
export const DEFAULT_THRESHOLD = 0.85

/**
 * Detect duplicate entries in a profile
 *
 * @param {object} profile - The profile to analyze
 * @param {object} options - Detection options
 * @param {number} options.threshold - Similarity threshold (0-1), defaults to 0.85
 * @param {string[]} options.excludeCategories - Entity types to skip
 * @returns {Array} Array of CleanupFinding objects for duplicates
 */
export function detectDuplicates(profile, options = {}) {
  const { threshold = DEFAULT_THRESHOLD, excludeCategories = [] } = options
  const findings = []
  const now = new Date().toISOString()

  // Detect skill duplicates
  if (!excludeCategories.includes('skill')) {
    findings.push(...detectSkillDuplicates(profile.skills || [], threshold, now))
  }

  // Detect story duplicates
  if (!excludeCategories.includes('story')) {
    findings.push(...detectStoryDuplicates(profile.stories || [], threshold, now))
  }

  // Detect summary block duplicates
  if (!excludeCategories.includes('summary')) {
    findings.push(...detectSummaryDuplicates(profile.summaryBlocks || [], threshold, now))
  }

  return findings
}

/**
 * Detect duplicate skills by comparing names (case-insensitive)
 */
function detectSkillDuplicates(skills, threshold, timestamp) {
  const findings = []
  const compared = new Set()

  for (let i = 0; i < skills.length; i++) {
    for (let j = i + 1; j < skills.length; j++) {
      const pairKey = `${skills[i].id}-${skills[j].id}`
      if (compared.has(pairKey)) continue
      compared.add(pairKey)

      const name1 = (skills[i].name || '').toLowerCase()
      const name2 = (skills[j].name || '').toLowerCase()

      if (!name1 || !name2) continue

      const similarity = stringSimilarity.compareTwoStrings(name1, name2)

      if (similarity >= threshold) {
        const similarityPercent = Math.round(similarity * 100)
        findings.push({
          type: 'duplicate',
          entityType: 'skill',
          ids: [skills[i].id, skills[j].id],
          similarity: similarityPercent,
          reason: `'${skills[i].name}' and '${skills[j].name}' are ${similarityPercent}% similar`,
          suggestion: generateSkillSuggestion(skills[i], skills[j], similarityPercent),
          createdAt: timestamp
        })
      }
    }
  }

  return findings
}

/**
 * Generate appropriate suggestion for skill duplicates
 */
function generateSkillSuggestion(skill1, skill2, similarity) {
  // If exact or near-exact match, suggest merge
  if (similarity >= 95) {
    return `Consider merging these skills into one entry to avoid redundancy`
  }

  // If different categories, might be valid variants
  if (skill1.category !== skill2.category || skill1.subcategory !== skill2.subcategory) {
    return `These skills are in different categories - verify if they represent distinct competencies or should be consolidated`
  }

  // If one has significantly more evidence, suggest keeping that one
  const ev1 = (skill1.evidence || []).length
  const ev2 = (skill2.evidence || []).length
  if (ev1 > ev2 + 1) {
    return `'${skill1.name}' has more evidence - consider removing '${skill2.name}' if it represents the same skill`
  }
  if (ev2 > ev1 + 1) {
    return `'${skill2.name}' has more evidence - consider removing '${skill1.name}' if it represents the same skill`
  }

  return `Review whether these represent the same skill and should be merged`
}

/**
 * Detect duplicate stories by comparing title + situation (weighted)
 */
function detectStoryDuplicates(stories, threshold, timestamp) {
  const findings = []
  const compared = new Set()

  for (let i = 0; i < stories.length; i++) {
    for (let j = i + 1; j < stories.length; j++) {
      const pairKey = `${stories[i].id}-${stories[j].id}`
      if (compared.has(pairKey)) continue
      compared.add(pairKey)

      // Weight: 40% title, 60% situation
      const title1 = (stories[i].title || '').toLowerCase()
      const title2 = (stories[j].title || '').toLowerCase()
      const situation1 = (stories[i].situation || '').toLowerCase()
      const situation2 = (stories[j].situation || '').toLowerCase()

      if (!title1 || !title2) continue

      const titleSim = stringSimilarity.compareTwoStrings(title1, title2)
      const situationSim =
        situation1 && situation2 ? stringSimilarity.compareTwoStrings(situation1, situation2) : 0

      // Weighted average
      const similarity = titleSim * 0.4 + situationSim * 0.6

      if (similarity >= threshold) {
        const similarityPercent = Math.round(similarity * 100)
        findings.push({
          type: 'duplicate',
          entityType: 'story',
          ids: [stories[i].id, stories[j].id],
          similarity: similarityPercent,
          reason: `Stories '${stories[i].title}' and '${stories[j].title}' are ${similarityPercent}% similar`,
          suggestion: generateStorySuggestion(stories[i], stories[j], similarityPercent),
          createdAt: timestamp
        })
      }
    }
  }

  return findings
}

/**
 * Generate appropriate suggestion for story duplicates
 */
function generateStorySuggestion(story1, story2, similarity) {
  if (similarity >= 95) {
    return `These stories appear to be duplicates - consider removing one`
  }

  // Check if they have different question categories
  const cats1 = new Set(story1.questionCategories || [])
  const cats2 = new Set(story2.questionCategories || [])
  const overlap = [...cats1].filter((c) => cats2.has(c))

  if (overlap.length === 0) {
    return `Stories share similar content but target different interview questions - consider merging into one story with multiple variants`
  }

  // Check if one has a project reference
  if (story1.projectRef && !story2.projectRef) {
    return `'${story1.title}' has a project reference - consider keeping it and removing '${story2.title}'`
  }
  if (story2.projectRef && !story1.projectRef) {
    return `'${story2.title}' has a project reference - consider keeping it and removing '${story1.title}'`
  }

  return `Review whether these stories should be merged or differentiated more clearly`
}

/**
 * Detect duplicate summary blocks by comparing content (first 100 chars)
 */
function detectSummaryDuplicates(summaryBlocks, threshold, timestamp) {
  const findings = []
  const compared = new Set()

  for (let i = 0; i < summaryBlocks.length; i++) {
    for (let j = i + 1; j < summaryBlocks.length; j++) {
      const pairKey = `${summaryBlocks[i].id}-${summaryBlocks[j].id}`
      if (compared.has(pairKey)) continue
      compared.add(pairKey)

      // Compare first 100 characters for quick similarity check
      const content1 = (summaryBlocks[i].content || '').substring(0, 100).toLowerCase()
      const content2 = (summaryBlocks[j].content || '').substring(0, 100).toLowerCase()

      if (!content1 || !content2) continue

      const similarity = stringSimilarity.compareTwoStrings(content1, content2)

      if (similarity >= threshold) {
        const similarityPercent = Math.round(similarity * 100)
        findings.push({
          type: 'duplicate',
          entityType: 'summary',
          ids: [summaryBlocks[i].id, summaryBlocks[j].id],
          similarity: similarityPercent,
          reason: `Summary blocks are ${similarityPercent}% similar in their opening text`,
          suggestion: generateSummarySuggestion(summaryBlocks[i], summaryBlocks[j]),
          createdAt: timestamp
        })
      }
    }
  }

  return findings
}

/**
 * Generate appropriate suggestion for summary duplicates
 */
function generateSummarySuggestion(summary1, summary2) {
  // Check if they target different audiences
  const aud1 = new Set(summary1.audiences || [])
  const aud2 = new Set(summary2.audiences || [])
  const overlap = [...aud1].filter((a) => aud2.has(a))

  if (overlap.length === 0) {
    return `These summaries target different audiences - verify content is appropriately differentiated`
  }

  if (overlap.length === aud1.size && overlap.length === aud2.size) {
    return `These summaries target the same audiences and are similar - consider merging or removing one`
  }

  return `Review whether these summary blocks should be consolidated or better differentiated`
}
