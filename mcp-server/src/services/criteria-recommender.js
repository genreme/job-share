/**
 * Criteria Recommender Service - Suggest fit criteria evolution
 *
 * Provides:
 * - analyzeOutcomes: Correlate fit scores with job outcomes
 * - generateRecommendations: Generate data-driven criteria suggestions
 * - previewCriteriaChange: Preview impact on existing job scores
 * - applyCriteriaChange: Apply change with audit trail
 *
 * ANLT-04: Criteria evolution with outcome analysis and impact preview
 */

import { loadFitConfig, updateFitCriteria } from './fit-config.js'

// Minimum sample size for generating recommendations (per RESEARCH.md)
const MIN_SAMPLE_SIZE = 5

// Thresholds for score classification
const HIGH_SCORE_THRESHOLD = 75
const LOW_SCORE_THRESHOLD = 50

/**
 * Analyze outcomes from evolution log
 *
 * Correlates fit scores with outcomes to identify patterns and anomalies.
 *
 * @param {Array<{type: string, outcome?: string, fitScore?: number, jobId?: number}>} evolutionLog
 * @returns {{
 *   correlations: {highScorePositive: number, lowScoreNegative: number, anomalies: Array},
 *   sampleSize: number,
 *   confidence: 'high'|'medium'|'low'|'very-low'
 * }}
 */
export function analyzeOutcomes(evolutionLog) {
  // Handle empty/invalid input
  if (!evolutionLog || !Array.isArray(evolutionLog) || evolutionLog.length === 0) {
    return {
      correlations: { highScorePositive: 0, lowScoreNegative: 0, anomalies: [] },
      sampleSize: 0,
      confidence: 'very-low'
    }
  }

  // Filter to outcome entries only
  const outcomes = evolutionLog.filter(entry =>
    entry.type === 'outcome' &&
    entry.outcome &&
    typeof entry.fitScore === 'number'
  )

  if (outcomes.length === 0) {
    return {
      correlations: { highScorePositive: 0, lowScoreNegative: 0, anomalies: [] },
      sampleSize: 0,
      confidence: 'very-low'
    }
  }

  // Categorize outcomes
  const highScoreOutcomes = outcomes.filter(o => o.fitScore >= HIGH_SCORE_THRESHOLD)
  const lowScoreOutcomes = outcomes.filter(o => o.fitScore < LOW_SCORE_THRESHOLD)

  // Count correlations
  const highScorePositive = highScoreOutcomes.filter(o => o.outcome === 'positive').length
  const lowScoreNegative = lowScoreOutcomes.filter(o => o.outcome === 'negative').length

  // Find anomalies: high score + negative outcome OR low score + positive outcome
  const anomalies = outcomes.filter(o =>
    (o.fitScore >= HIGH_SCORE_THRESHOLD && o.outcome === 'negative') ||
    (o.fitScore < LOW_SCORE_THRESHOLD && o.outcome === 'positive')
  ).map(o => ({
    jobId: o.jobId,
    fitScore: o.fitScore,
    outcome: o.outcome,
    anomalyType: o.fitScore >= HIGH_SCORE_THRESHOLD ? 'high_score_rejected' : 'low_score_accepted'
  }))

  // Calculate confidence based on sample size
  let confidence
  if (outcomes.length >= 30) {
    confidence = 'high'
  } else if (outcomes.length >= 10) {
    confidence = 'medium'
  } else if (outcomes.length >= MIN_SAMPLE_SIZE) {
    confidence = 'low'
  } else {
    confidence = 'very-low'
  }

  return {
    correlations: {
      highScorePositive,
      lowScoreNegative,
      anomalies
    },
    sampleSize: outcomes.length,
    confidence
  }
}

/**
 * Generate criteria recommendations from job data and config
 *
 * Analyzes patterns in job applications and outcomes to suggest criteria changes.
 *
 * @param {Array<object>} jobs - Array of job objects with status, fitScore, etc.
 * @param {object} [config] - Fit config (loaded if not provided)
 * @returns {Array<{type: string, criteria: string, currentValue: any, suggestedValue: any, confidence: string, rationale: string}>}
 */
export function generateRecommendations(jobs, config) {
  const recommendations = []

  // Load config if not provided
  const fitConfig = config || loadFitConfig()

  // Handle empty/invalid input
  if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
    return recommendations
  }

  // Analyze evolution log for outcome patterns
  const outcomeAnalysis = analyzeOutcomes(fitConfig.evolutionLog || [])

  // Only generate recommendations if we have sufficient data
  if (outcomeAnalysis.sampleSize < MIN_SAMPLE_SIZE) {
    return recommendations
  }

  // Pattern 1: High-fit jobs consistently rejected (criteria too narrow)
  if (outcomeAnalysis.correlations.anomalies.length > 0) {
    const highScoreRejections = outcomeAnalysis.correlations.anomalies.filter(
      a => a.anomalyType === 'high_score_rejected'
    )

    if (highScoreRejections.length >= 2) {
      recommendations.push({
        type: 'review_criteria',
        criteria: 'titles',
        currentValue: fitConfig.criteria?.titles,
        suggestedValue: null, // Needs manual review
        confidence: outcomeAnalysis.confidence,
        rationale: `${highScoreRejections.length} high-fit jobs resulted in negative outcomes. Your fit criteria may be overestimating match quality. Review title and industry criteria for false positives.`
      })
    }
  }

  // Pattern 2: Analyze applied jobs by title to detect preference drift
  const appliedJobs = jobs.filter(j =>
    j.status === 'applied' ||
    j.appliedDate ||
    j.status === 'interviewing' ||
    j.status === 'offer'
  )

  if (appliedJobs.length >= MIN_SAMPLE_SIZE) {
    // Analyze titles user actually applies to
    const titleCounts = new Map()
    for (const job of appliedJobs) {
      if (job.title) {
        const normalizedTitle = job.title.toLowerCase()
        titleCounts.set(normalizedTitle, (titleCounts.get(normalizedTitle) || 0) + 1)
      }
    }

    // Find common titles not in exact criteria
    const currentExactTitles = (fitConfig.criteria?.titles?.exact || [])
      .map(t => t.toLowerCase())

    for (const [title, count] of titleCounts) {
      if (count >= 3 && !currentExactTitles.some(t => title.includes(t.toLowerCase()) || t.toLowerCase().includes(title))) {
        recommendations.push({
          type: 'add_title',
          criteria: 'titles.exact',
          currentValue: fitConfig.criteria?.titles?.exact,
          suggestedValue: [...(fitConfig.criteria?.titles?.exact || []), title],
          confidence: count >= 5 ? 'medium' : 'low',
          rationale: `You've applied to ${count} jobs with title "${title}" which isn't in your exact title matches. Consider adding it to improve scoring accuracy.`
        })
      }
    }

    // Analyze industries
    const industryCounts = new Map()
    for (const job of appliedJobs) {
      if (job.industry) {
        const normalizedIndustry = job.industry.toLowerCase()
        industryCounts.set(normalizedIndustry, (industryCounts.get(normalizedIndustry) || 0) + 1)
      }
    }

    const currentIndustries = [
      ...(fitConfig.criteria?.industries?.preferred || []),
      ...(fitConfig.criteria?.industries?.acceptable || [])
    ].map(i => i.toLowerCase())

    for (const [industry, count] of industryCounts) {
      if (count >= 3 && !currentIndustries.includes(industry)) {
        recommendations.push({
          type: 'add_industry',
          criteria: 'industries.acceptable',
          currentValue: fitConfig.criteria?.industries?.acceptable,
          suggestedValue: [...(fitConfig.criteria?.industries?.acceptable || []), industry],
          confidence: count >= 5 ? 'medium' : 'low',
          rationale: `You've applied to ${count} jobs in "${industry}" which isn't in your industry criteria. Consider adding it as acceptable.`
        })
      }
    }
  }

  // Pattern 3: Low score but positive outcome (criteria too strict)
  const lowScoreAccepted = outcomeAnalysis.correlations.anomalies.filter(
    a => a.anomalyType === 'low_score_accepted'
  )

  if (lowScoreAccepted.length >= 2) {
    recommendations.push({
      type: 'adjust_weight',
      criteria: 'weights',
      currentValue: fitConfig.weights,
      suggestedValue: null, // Needs manual review
      confidence: outcomeAnalysis.confidence,
      rationale: `${lowScoreAccepted.length} low-fit jobs resulted in positive outcomes. Your fit criteria may be too strict. Consider adjusting weights or expanding criteria.`
    })
  }

  return recommendations
}

/**
 * Preview how a criteria change would affect existing job scores
 *
 * @param {Array<object>} jobs - Array of jobs with current fitScore
 * @param {{type: string, criteria: string, newValue: any}} change - Proposed change
 * @returns {{affected: number, scoreChanges: Array<{jobId: number, title: string, company: string, oldScore: number, newScore: number, delta: number}>, summary: string}}
 */
export function previewCriteriaChange(jobs, change) {
  // Handle empty/invalid inputs
  if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
    return {
      affected: 0,
      scoreChanges: [],
      summary: 'No jobs to analyze'
    }
  }

  if (!change || !change.type || !change.criteria) {
    return {
      affected: 0,
      scoreChanges: [],
      summary: 'Invalid change specification'
    }
  }

  // Simulate the impact based on change type
  const scoreChanges = []

  for (const job of jobs) {
    if (typeof job.fitScore !== 'number') continue

    const oldScore = job.fitScore
    let newScore = oldScore

    // Simulate score changes based on change type
    switch (change.type) {
      case 'add_title':
        // If job title matches new title, increase score
        if (job.title && change.newValue) {
          const titleMatches = Array.isArray(change.newValue)
            ? change.newValue.some(t => job.title.toLowerCase().includes(t.toLowerCase()))
            : job.title.toLowerCase().includes(change.newValue.toLowerCase())

          if (titleMatches && !matchesCurrentCriteria(job.title, change.currentValue)) {
            newScore = Math.min(100, oldScore + 15) // Add ROLE_PARTIAL weight
          }
        }
        break

      case 'remove_title':
        // If job title matches removed title, decrease score
        if (job.title && change.removeValue) {
          const titleMatches = job.title.toLowerCase().includes(change.removeValue.toLowerCase())
          if (titleMatches) {
            newScore = Math.max(0, oldScore - 15)
          }
        }
        break

      case 'add_industry':
        // If job industry matches new industry, increase score
        if (job.industry && change.newValue) {
          const industryMatches = Array.isArray(change.newValue)
            ? change.newValue.some(i => job.industry.toLowerCase().includes(i.toLowerCase()))
            : job.industry.toLowerCase().includes(change.newValue.toLowerCase())

          if (industryMatches && !matchesCurrentCriteria(job.industry, change.currentValue)) {
            newScore = Math.min(100, oldScore + 10) // Add INDUSTRY_ACCEPTABLE weight
          }
        }
        break

      case 'adjust_salary':
        // If job salary now meets/doesn't meet minimum
        if (typeof job.salaryMin === 'number' || typeof job.salaryMax === 'number') {
          const jobSalary = job.salaryMax || job.salaryMin
          const currentMeets = change.currentValue ? jobSalary >= change.currentValue : true
          const newMeets = change.newValue ? jobSalary >= change.newValue : true

          if (newMeets && !currentMeets) {
            newScore = Math.min(100, oldScore + 15)
          } else if (currentMeets && !newMeets) {
            newScore = Math.max(0, oldScore - 15)
          }
        }
        break

      case 'adjust_weight':
        // For weight adjustments, we can't precisely simulate without recalculating
        // Just flag that these jobs would be affected
        if (change.criteria && job.fitScore > 0) {
          // Estimate based on percentage change
          const percentChange = change.percentChange || 0
          newScore = Math.min(100, Math.max(0, Math.round(oldScore * (1 + percentChange / 100))))
        }
        break

      default:
        // Unknown change type - no simulation
        break
    }

    if (newScore !== oldScore) {
      scoreChanges.push({
        jobId: job.id,
        title: job.title || 'Unknown',
        company: job.company || 'Unknown',
        oldScore,
        newScore,
        delta: newScore - oldScore
      })
    }
  }

  // Generate summary
  const affected = scoreChanges.length
  const increases = scoreChanges.filter(c => c.delta > 0).length
  const decreases = scoreChanges.filter(c => c.delta < 0).length
  const avgDelta = affected > 0
    ? Math.round(scoreChanges.reduce((sum, c) => sum + c.delta, 0) / affected)
    : 0

  let summary
  if (affected === 0) {
    summary = 'No jobs would be affected by this change'
  } else {
    const sign = avgDelta >= 0 ? '+' : ''
    summary = `${affected} jobs affected: ${increases} score increases, ${decreases} decreases, avg ${sign}${avgDelta} points`
  }

  return {
    affected,
    scoreChanges,
    summary
  }
}

/**
 * Check if a value matches current criteria
 *
 * @param {string} value - Value to check
 * @param {Array<string>} currentCriteria - Current criteria array
 * @returns {boolean} True if value matches current criteria
 */
function matchesCurrentCriteria(value, currentCriteria) {
  if (!value || !currentCriteria || !Array.isArray(currentCriteria)) {
    return false
  }

  const normalizedValue = value.toLowerCase()
  return currentCriteria.some(c =>
    normalizedValue.includes(c.toLowerCase()) || c.toLowerCase().includes(normalizedValue)
  )
}

/**
 * Apply a criteria change with audit trail
 *
 * Wrapper around fit-config.js updateFitCriteria that logs structured reason.
 *
 * @param {{type: string, criteria: string, currentValue: any, newValue: any}} change - The change to apply
 * @param {string} reason - Human-readable reason for the change
 * @returns {{success: boolean, config?: object, error?: string}}
 */
export function applyCriteriaChange(change, reason) {
  // Validate inputs
  if (!change || !change.type || !change.criteria) {
    return { success: false, error: 'Invalid change specification' }
  }

  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    return { success: false, error: 'Reason is required for audit trail' }
  }

  // Build updates object based on change type
  let updates = {}

  switch (change.type) {
    case 'add_title':
      if (change.criteria === 'titles.exact') {
        updates = { titles: { exact: change.newValue } }
      } else if (change.criteria === 'titles.partial') {
        updates = { titles: { partial: change.newValue } }
      }
      break

    case 'remove_title':
      // Remove from current value
      if (change.criteria === 'titles.exact' && Array.isArray(change.currentValue)) {
        updates = {
          titles: {
            exact: change.currentValue.filter(t =>
              t.toLowerCase() !== change.removeValue.toLowerCase()
            )
          }
        }
      }
      break

    case 'add_industry':
      if (change.criteria === 'industries.preferred') {
        updates = { industries: { preferred: change.newValue } }
      } else if (change.criteria === 'industries.acceptable') {
        updates = { industries: { acceptable: change.newValue } }
      }
      break

    case 'adjust_salary':
      updates = { salaryMin: change.newValue }
      break

    case 'adjust_weight':
      // Weight adjustments would need direct config manipulation
      // For now, return error as this requires manual review
      return { success: false, error: 'Weight adjustments require manual configuration' }

    default:
      return { success: false, error: `Unknown change type: ${change.type}` }
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'No valid updates to apply' }
  }

  // Build structured reason for audit
  const structuredReason = `[${change.type}] ${reason}`

  // Apply via fit-config
  return updateFitCriteria(updates, structuredReason)
}
