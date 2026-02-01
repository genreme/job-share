/**
 * Reasoning Generator Service - Generate explanatory text for shortlist inclusion
 *
 * Takes fit score results and generates human-readable explanations
 * for why a job was included in the shortlist.
 */

/**
 * Generate reasoning for a job's fit score
 *
 * @param {object} job - Job data with title, company, location, salary, etc.
 * @param {object} fitResult - Fit score result from fit-scorer.js
 * @returns {object} Reasoning object with summary, whyIncluded, considerations, breakdown
 */
export function generateReasoning(job, fitResult) {
  const { score, breakdown, usingDefaults } = fitResult
  const whyIncluded = []
  const considerations = []

  const title = job.title || 'Unknown Title'
  const location = job.location || ''
  const salary = job.salary || ''

  // Role reasoning
  if (breakdown.role >= 20) {
    whyIncluded.push(`'${title}' matches your target roles`)
  } else if (breakdown.role >= 10) {
    whyIncluded.push('Title has partial alignment with your targets')
  } else if (breakdown.role < 10 && breakdown.role === 0) {
    considerations.push('Title may not directly match target roles')
  }

  // Industry reasoning
  if (breakdown.industry >= 15) {
    whyIncluded.push('Industry aligns with your preferences')
  } else if (breakdown.industry > 0) {
    whyIncluded.push('Industry is in acceptable range')
  }

  // Location reasoning
  if (breakdown.location >= 10) {
    const locationText = location ? ` (${location})` : ''
    whyIncluded.push(`Location${locationText} is preferred`)
  } else if (breakdown.location > 0) {
    whyIncluded.push('Location is acceptable')
  }

  // Salary reasoning
  if (breakdown.salary >= 10) {
    whyIncluded.push('Salary meets your threshold')
  } else if (breakdown.salary === 0 && (!salary || salary.trim() === '')) {
    considerations.push('Salary not disclosed')
  } else if (breakdown.salary === 0) {
    considerations.push('Salary may be below target')
  }

  // Skills reasoning
  if (breakdown.skills >= 5) {
    whyIncluded.push('Multiple skill matches found')
  } else if (breakdown.skills > 0) {
    whyIncluded.push('Some skill matches found')
  }

  // Using defaults warning
  if (usingDefaults) {
    considerations.push('Using default criteria - populate profile for personalized scoring')
  }

  // Generate breakdown explanations
  const breakdownExplanation = generateBreakdownExplanation(job, breakdown)

  // Generate summary
  const summary = generateSummary(score, whyIncluded, considerations)

  return {
    score,
    summary,
    whyIncluded,
    considerations,
    breakdown: breakdownExplanation
  }
}

/**
 * Generate score breakdown explanation
 *
 * @param {object} job - Job data
 * @param {object} breakdown - Score breakdown from fit-scorer
 * @returns {object} Human-readable breakdown explanations
 */
function generateBreakdownExplanation(job, breakdown) {
  const title = job.title || 'Unknown Title'
  const location = job.location || 'Not specified'
  const industry = job.industry || 'Not specified'
  const salary = job.salary || 'Not disclosed'

  // Role explanation
  let roleExplanation
  if (breakdown.role >= 20) {
    roleExplanation = `${breakdown.role}/25 points - '${title}' is an exact match`
  } else if (breakdown.role >= 10) {
    roleExplanation = `${breakdown.role}/25 points - Partial match for '${title}'`
  } else {
    roleExplanation = `${breakdown.role}/25 points - No match for '${title}'`
  }

  // Industry explanation
  let industryExplanation
  if (breakdown.industry >= 15) {
    industryExplanation = `${breakdown.industry}/20 points - '${industry}' is preferred`
  } else if (breakdown.industry > 0) {
    industryExplanation = `${breakdown.industry}/20 points - '${industry}' is acceptable`
  } else {
    industryExplanation = `${breakdown.industry}/20 points - '${industry}' not in preferences`
  }

  // Location explanation
  let locationExplanation
  if (breakdown.location >= 10) {
    locationExplanation = `${breakdown.location}/15 points - '${location}' is preferred`
  } else if (breakdown.location > 0) {
    locationExplanation = `${breakdown.location}/15 points - '${location}' is acceptable`
  } else {
    locationExplanation = `${breakdown.location}/15 points - '${location}' not preferred`
  }

  // Salary explanation
  let salaryExplanation
  if (breakdown.salary >= 10) {
    salaryExplanation = `${breakdown.salary}/15 points - '${salary}' meets threshold`
  } else if (salary && salary.trim() !== '' && salary !== 'Not disclosed') {
    salaryExplanation = `${breakdown.salary}/15 points - '${salary}' below target`
  } else {
    salaryExplanation = `${breakdown.salary}/15 points - Salary not disclosed`
  }

  // Skills explanation
  const skillPoints = breakdown.skills || 0
  let skillsExplanation
  if (skillPoints >= 10) {
    skillsExplanation = `${skillPoints}/10 points - 5+ skills matched`
  } else if (skillPoints >= 5) {
    skillsExplanation = `${skillPoints}/10 points - Multiple skills matched`
  } else if (skillPoints > 0) {
    skillsExplanation = `${skillPoints}/10 points - Some skills matched`
  } else {
    skillsExplanation = `${skillPoints}/10 points - No skill matches in description`
  }

  return {
    role: roleExplanation,
    industry: industryExplanation,
    location: locationExplanation,
    salary: salaryExplanation,
    skills: skillsExplanation
  }
}

/**
 * Generate a one-line summary of the fit
 *
 * @param {number} score - Fit score (0-100)
 * @param {string[]} reasons - Positive reasons (whyIncluded)
 * @param {string[]} concerns - Concerns/considerations
 * @returns {string} Summary one-liner
 */
export function generateSummary(score, reasons, concerns) {
  const firstReason = reasons && reasons.length > 0 ? reasons[0] : null
  const firstConcern = concerns && concerns.length > 0 ? concerns[0] : null

  if (score >= 90) {
    return `Excellent match (${score}/100). ${firstReason || 'Strong alignment across all criteria'}`
  } else if (score >= 80) {
    return `Strong match (${score}/100). ${firstReason || 'Good alignment with preferences'}`
  } else if (score >= 70) {
    return `Good potential (${score}/100). Worth reviewing: ${firstReason || 'Some alignment found'}`
  } else if (score >= 60) {
    return `Moderate fit (${score}/100). Consider: ${firstReason || firstConcern || 'May be stretch role'}`
  } else {
    return `Lower fit (${score}/100). ${firstConcern || firstReason || 'May be stretch role'}`
  }
}
