/**
 * Gap Detector Service - Detects missing fields and thin evidence in profile
 *
 * This is a minimal implementation for document generation.
 * Full implementation will be in Plan 03-01.
 */

/**
 * Detect gaps in profile data for document generation
 *
 * @param {object} profile - The profile to analyze
 * @param {object} jobContext - Optional job context for contextual gaps
 * @returns {Array} Array of gap findings
 */
export function detectGaps(profile, jobContext = null) {
  const gaps = []

  if (!profile) {
    return [
      {
        type: 'gap',
        field: 'profile',
        severity: 'required',
        reason: 'No profile data available',
        suggestion: 'Create a profile with basic information'
      }
    ]
  }

  // Required field gaps
  if (!profile.experience || profile.experience.length === 0) {
    gaps.push({
      type: 'gap',
      field: 'experience',
      severity: 'required',
      reason: 'No work experience documented',
      suggestion: 'Add at least one role with projects to your profile'
    })
  }

  if (!profile.skills || profile.skills.length === 0) {
    gaps.push({
      type: 'gap',
      field: 'skills',
      severity: 'required',
      reason: 'No skills documented',
      suggestion: 'Add skills with evidence linking to your projects'
    })
  }

  if (!profile.summaryBlocks || profile.summaryBlocks.length === 0) {
    gaps.push({
      type: 'gap',
      field: 'summaryBlocks',
      severity: 'required',
      reason: 'No summary blocks available for resume generation',
      suggestion: 'Add at least one summary block with appropriate audience tags'
    })
  }

  if (!profile.preferences?.communication) {
    gaps.push({
      type: 'gap',
      field: 'preferences.communication',
      severity: 'thin-evidence',
      reason: 'No communication preferences set',
      suggestion: 'Define tone and style preferences for consistent document generation'
    })
  }

  if (!profile.preferences?.targetRoles || profile.preferences.targetRoles.length === 0) {
    gaps.push({
      type: 'gap',
      field: 'preferences.targetRoles',
      severity: 'thin-evidence',
      reason: 'No target roles defined',
      suggestion: 'Add target roles to improve job matching and document generation'
    })
  }

  // Thin evidence gaps - skills without enough evidence
  const thinSkills = (profile.skills || []).filter(
    (skill) => !skill.evidence || skill.evidence.length < 2
  )
  if (thinSkills.length > 0) {
    gaps.push({
      type: 'gap',
      field: 'skills.evidence',
      severity: 'thin-evidence',
      reason: `${thinSkills.length} skill(s) have insufficient evidence (need at least 2 project references)`,
      suggestion: 'Link skills to additional projects that demonstrate them',
      affectedIds: thinSkills.map((s) => s.id)
    })
  }

  // Experience projects without metrics
  const projectsWithoutMetrics = []
  for (const exp of profile.experience || []) {
    for (const proj of exp.projects || []) {
      if (!proj.metrics) {
        projectsWithoutMetrics.push({ roleTitle: exp.role?.title, projectName: proj.name, id: proj.id })
      }
    }
  }
  if (projectsWithoutMetrics.length > 0) {
    gaps.push({
      type: 'gap',
      field: 'experience.projects.metrics',
      severity: 'thin-evidence',
      reason: `${projectsWithoutMetrics.length} project(s) lack quantifiable metrics`,
      suggestion: 'Add metrics (value, unit, context) to strengthen achievements',
      affectedCount: projectsWithoutMetrics.length
    })
  }

  // Contextual gaps based on job
  if (jobContext) {
    const isLeadershipRole =
      jobContext.title?.toLowerCase().includes('lead') ||
      jobContext.title?.toLowerCase().includes('manager') ||
      jobContext.title?.toLowerCase().includes('director') ||
      jobContext.title?.toLowerCase().includes('head') ||
      jobContext.title?.toLowerCase().includes('vp')

    if (isLeadershipRole) {
      const leadershipStories = (profile.stories || []).filter(
        (story) =>
          story.questionCategories?.some((cat) => cat.toLowerCase().includes('leadership')) ||
          story.themes?.some((theme) => theme.toLowerCase().includes('leadership'))
      )
      if (leadershipStories.length === 0) {
        gaps.push({
          type: 'gap',
          field: 'stories',
          severity: 'contextual',
          reason: 'Applying to leadership role but no leadership stories documented',
          suggestion: 'Add STAR stories demonstrating leadership experience',
          relevantTo: jobContext.title
        })
      }
    }

    const isTechnicalRole =
      jobContext.title?.toLowerCase().includes('engineer') ||
      jobContext.title?.toLowerCase().includes('developer') ||
      jobContext.title?.toLowerCase().includes('architect')

    if (isTechnicalRole) {
      const technicalSkills = (profile.skills || []).filter(
        (skill) => skill.category?.toLowerCase() === 'technical'
      )
      if (technicalSkills.length < 3) {
        gaps.push({
          type: 'gap',
          field: 'skills',
          severity: 'contextual',
          reason: 'Applying to technical role but few technical skills documented',
          suggestion: 'Add more technical skills with evidence',
          relevantTo: jobContext.title
        })
      }
    }
  }

  return gaps
}
