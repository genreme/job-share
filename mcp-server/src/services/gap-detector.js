/**
 * Gap Detector - Find missing required fields and thin evidence in profile
 *
 * Detects three types of gaps:
 * 1. Required field gaps - Missing essential profile sections
 * 2. Thin evidence gaps - Skills/achievements without supporting stories/metrics
 * 3. Contextual gaps - Missing content relevant to a specific job context
 *
 * Each gap includes:
 * - reason: WHY this matters (per PROF-08b)
 * - suggestion: HOW to address it (per PROF-08b)
 */

/**
 * Minimum number of evidence links required for a skill
 */
const MIN_EVIDENCE_COUNT = 2

/**
 * Detect gaps in a profile
 *
 * @param {object} profile - The profile to analyze
 * @param {object} jobContext - Optional job context for contextual gaps
 * @param {string} jobContext.title - Job title being applied for
 * @param {string} jobContext.company - Company name
 * @returns {Array} Array of CleanupFinding objects for gaps
 */
export function detectGaps(profile, jobContext = null) {
  const findings = []
  const timestamp = new Date().toISOString()

  if (!profile) {
    return [
      {
        type: 'gap',
        entityType: 'experience',
        ids: ['profile'],
        reason: 'No profile data available - cannot generate any documents',
        suggestion: 'Create a profile with basic information including experience and skills',
        createdAt: timestamp
      }
    ]
  }

  // Detect required field gaps
  findings.push(...detectRequiredFieldGaps(profile, timestamp))

  // Detect thin evidence gaps
  findings.push(...detectThinEvidenceGaps(profile, timestamp))

  // Detect contextual gaps (if job context provided)
  if (jobContext) {
    findings.push(...detectContextualGaps(profile, jobContext, timestamp))
  }

  return findings
}

/**
 * Detect missing required profile sections
 */
function detectRequiredFieldGaps(profile, timestamp) {
  const findings = []

  // No communication preferences set
  if (!profile.preferences?.communication) {
    findings.push({
      type: 'gap',
      entityType: 'summary',
      ids: ['preferences.communication'],
      reason:
        'No communication preferences set - AI-generated content may not match your voice and style',
      suggestion:
        'Set tone (formal/conversational), verbosity (concise/detailed), and phrases to avoid for consistent content generation',
      createdAt: timestamp
    })
  }

  // No target roles defined
  if (!profile.preferences?.targetRoles || profile.preferences.targetRoles.length === 0) {
    findings.push({
      type: 'gap',
      entityType: 'experience',
      ids: ['preferences.targetRoles'],
      reason: 'No target roles defined - job matching and content tailoring will be less effective',
      suggestion:
        'Define at least one target role with title, level, industries, and preferences to improve job matching',
      createdAt: timestamp
    })
  }

  // Empty experience array
  if (!profile.experience || profile.experience.length === 0) {
    findings.push({
      type: 'gap',
      entityType: 'experience',
      ids: ['experience'],
      reason: 'No work experience recorded - this is essential for resumes and job applications',
      suggestion: 'Add your work history with roles, companies, and key projects/achievements',
      createdAt: timestamp
    })
  }

  // Empty skills array
  if (!profile.skills || profile.skills.length === 0) {
    findings.push({
      type: 'gap',
      entityType: 'skill',
      ids: ['skills'],
      reason: 'No skills recorded - skills are essential for job matching and resume generation',
      suggestion: 'Add your key technical and professional skills with proficiency levels',
      createdAt: timestamp
    })
  }

  // No summary blocks
  if (!profile.summaryBlocks || profile.summaryBlocks.length === 0) {
    findings.push({
      type: 'gap',
      entityType: 'summary',
      ids: ['summaryBlocks'],
      reason: 'No summary blocks - professional summaries cannot be generated for different audiences',
      suggestion:
        'Create summary blocks for different audiences (technical, leadership, executive) to enable tailored content',
      createdAt: timestamp
    })
  }

  // No STAR stories
  if (!profile.stories || profile.stories.length === 0) {
    findings.push({
      type: 'gap',
      entityType: 'story',
      ids: ['stories'],
      reason: 'No STAR stories recorded - interview prep and behavioral questions cannot be supported',
      suggestion:
        'Add STAR stories (Situation, Task, Action, Result) for common interview categories like leadership, conflict resolution, and achievements',
      createdAt: timestamp
    })
  }

  return findings
}

/**
 * Detect thin evidence (skills/achievements without supporting stories/metrics)
 */
function detectThinEvidenceGaps(profile, timestamp) {
  const findings = []

  // Skills with thin evidence - one finding per skill
  for (const skill of profile.skills || []) {
    const evidenceCount = (skill.evidence || []).length

    if (evidenceCount < MIN_EVIDENCE_COUNT) {
      findings.push({
        type: 'gap',
        entityType: 'skill',
        ids: [skill.id],
        reason: `Skill '${skill.name}' has only ${evidenceCount} evidence link${evidenceCount === 1 ? '' : 's'} - makes claims harder to verify`,
        suggestion: `Add more project references to strengthen this skill claim. Link to ${MIN_EVIDENCE_COUNT - evidenceCount} more project(s) where you demonstrated ${skill.name}.`,
        createdAt: timestamp
      })
    }
  }

  // Experience projects without metrics - one finding per project
  for (const experience of profile.experience || []) {
    for (const project of experience.projects || []) {
      if (!project.metrics) {
        findings.push({
          type: 'gap',
          entityType: 'experience',
          ids: [project.id],
          reason: `Project '${project.name}' lacks metrics - quantified achievements are more compelling`,
          suggestion: `Add metrics (e.g., "reduced load time by 40%", "increased user engagement by 2x") to make this achievement more impactful`,
          createdAt: timestamp
        })
      }
    }
  }

  // Stories without project references
  for (const story of profile.stories || []) {
    if (!story.projectRef) {
      findings.push({
        type: 'gap',
        entityType: 'story',
        ids: [story.id],
        reason: `Story '${story.title}' has no project reference - linking stories to projects improves credibility`,
        suggestion: `Link this story to a specific project in your experience to strengthen the narrative`,
        createdAt: timestamp
      })
    }
  }

  return findings
}

/**
 * Detect gaps relevant to a specific job context
 */
function detectContextualGaps(profile, jobContext, timestamp) {
  const findings = []
  const titleLower = (jobContext.title || '').toLowerCase()
  const relevantTo = `${jobContext.title}${jobContext.company ? ` at ${jobContext.company}` : ''}`

  // Leadership role but no leadership stories
  const isLeadershipRole =
    titleLower.includes('lead') ||
    titleLower.includes('manager') ||
    titleLower.includes('director') ||
    titleLower.includes('head') ||
    titleLower.includes('vp') ||
    titleLower.includes('chief')

  if (isLeadershipRole) {
    const hasLeadershipStories = (profile.stories || []).some(
      (story) =>
        (story.questionCategories || []).some(
          (cat) =>
            cat.toLowerCase().includes('leadership') ||
            cat.toLowerCase().includes('management') ||
            cat.toLowerCase().includes('team')
        ) ||
        (story.themes || []).some(
          (theme) =>
            theme.toLowerCase().includes('leadership') ||
            theme.toLowerCase().includes('management') ||
            theme.toLowerCase().includes('team')
        )
    )

    if (!hasLeadershipStories) {
      findings.push({
        type: 'gap',
        entityType: 'story',
        ids: ['stories.leadership'],
        reason: `This is a leadership role but no leadership stories are recorded - you may struggle with behavioral questions`,
        suggestion: `Add STAR stories about leading teams, making difficult decisions, developing people, or driving organizational change`,
        relevantTo,
        createdAt: timestamp
      })
    }

    // Check for leadership skills
    const hasLeadershipSkills = (profile.skills || []).some(
      (skill) =>
        skill.category?.toLowerCase() === 'leadership' ||
        skill.subcategory?.toLowerCase().includes('leadership') ||
        skill.subcategory?.toLowerCase().includes('management')
    )

    if (!hasLeadershipSkills) {
      findings.push({
        type: 'gap',
        entityType: 'skill',
        ids: ['skills.leadership'],
        reason: `This is a leadership role but no leadership skills are recorded - your profile may appear misaligned`,
        suggestion: `Add leadership skills like team management, mentoring, stakeholder communication, or strategic planning`,
        relevantTo,
        createdAt: timestamp
      })
    }
  }

  // Technical role but few technical skills
  const isTechnicalRole =
    titleLower.includes('engineer') ||
    titleLower.includes('developer') ||
    titleLower.includes('architect') ||
    titleLower.includes('technical')

  if (isTechnicalRole) {
    const technicalSkillCount = (profile.skills || []).filter(
      (skill) =>
        skill.category?.toLowerCase() === 'technical' ||
        skill.category?.toLowerCase().includes('tech')
    ).length

    if (technicalSkillCount < 3) {
      findings.push({
        type: 'gap',
        entityType: 'skill',
        ids: ['skills.technical'],
        reason: `This is a technical role but only ${technicalSkillCount} technical skill${technicalSkillCount === 1 ? '' : 's'} recorded - your profile may appear weak`,
        suggestion: `Add more technical skills relevant to this role (languages, frameworks, tools, methodologies)`,
        relevantTo,
        createdAt: timestamp
      })
    }
  }

  // Design role checks
  const isDesignRole =
    titleLower.includes('design') ||
    titleLower.includes('ux') ||
    titleLower.includes('creative') ||
    titleLower.includes('brand')

  if (isDesignRole) {
    const hasDesignSkills = (profile.skills || []).some(
      (skill) =>
        skill.category?.toLowerCase() === 'design' ||
        skill.name?.toLowerCase().includes('design') ||
        skill.name?.toLowerCase().includes('ux') ||
        skill.name?.toLowerCase().includes('figma') ||
        skill.name?.toLowerCase().includes('creative')
    )

    if (!hasDesignSkills) {
      findings.push({
        type: 'gap',
        entityType: 'skill',
        ids: ['skills.design'],
        reason: `This is a design role but no design skills are recorded - your profile may appear misaligned`,
        suggestion: `Add design skills like UX research, visual design, design systems, prototyping tools, or brand strategy`,
        relevantTo,
        createdAt: timestamp
      })
    }
  }

  return findings
}
