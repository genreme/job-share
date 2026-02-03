/**
 * Response Rate Analyzer Service - Calculate response rates by dimension
 *
 * Provides dimension-based response rate calculations with confidence levels (ANLT-02).
 * Tracks both acknowledgment rate (any response) and positive response rate (interview/offer).
 *
 * Confidence thresholds per RESEARCH.md:
 * - n < 5: 'very-low' (too small for meaningful inference)
 * - n < 10: 'low' (flag for user)
 * - n < 30: 'medium' (use t-distribution)
 * - n >= 30: 'high' (normal distribution)
 */

// Confidence thresholds
const CONFIDENCE_THRESHOLDS = {
  VERY_LOW: 5,
  LOW: 10,
  MEDIUM: 30
}

// Valid dimensions for breakdown analysis
export const VALID_DIMENSIONS = [
  'companySize',
  'industry',
  'applicationMethod',
  'jobBoard',
  'roleType'
]

// Interview/offer keywords for positive response detection
const POSITIVE_RESPONSE_KEYWORDS = [
  'interview', 'phone screen', 'screening', 'call scheduled',
  'meeting', 'chat', 'conversation', 'assessment', 'technical',
  'offer', 'offered', 'compensation', 'package', 'accepted'
]

// Any response keywords (including rejections)
const ANY_RESPONSE_KEYWORDS = [
  ...POSITIVE_RESPONSE_KEYWORDS,
  'reject', 'rejected', 'unfortunately', 'not moving forward',
  'decided to pursue', 'filled', 'position filled', 'closed',
  'response', 'replied', 'got back', 'heard back'
]

/**
 * Calculate confidence level based on sample size
 *
 * @param {number} n - Sample size
 * @returns {'very-low' | 'low' | 'medium' | 'high'}
 */
function getConfidenceLevel(n) {
  if (n < CONFIDENCE_THRESHOLDS.VERY_LOW) return 'very-low'
  if (n < CONFIDENCE_THRESHOLDS.LOW) return 'low'
  if (n < CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium'
  return 'high'
}

/**
 * Format rate display with confidence indicator
 *
 * @param {number} rate - Rate as decimal (0-1)
 * @param {number} sampleSize - Sample size (n)
 * @param {string} confidence - Confidence level
 * @returns {string} Formatted display string
 */
function formatRateDisplay(rate, sampleSize, confidence) {
  const ratePercent = Math.round(rate * 100)
  const confidenceFlag = (confidence === 'very-low' || confidence === 'low')
    ? ' low confidence'
    : ''
  return `${ratePercent}% (n=${sampleSize})${confidenceFlag}`
}

/**
 * Check if job has been applied to
 *
 * @param {object} job - Job object
 * @returns {boolean} True if job has been applied to
 */
function isApplied(job) {
  return job.status === 'applied' || !!job.applied
}

/**
 * Check if job has received any response (acknowledgment)
 *
 * @param {object} job - Job object
 * @returns {boolean} True if job has any response indicator
 */
function hasAnyResponse(job) {
  // Check status progression beyond applied
  const progressedStatuses = ['interviewing', 'offer', 'accepted', 'rejected', 'withdrawn']
  if (progressedStatuses.includes(job.status)) {
    return true
  }

  // Check updates for response keywords
  if (!job.updates || !Array.isArray(job.updates)) {
    return false
  }

  return job.updates.some(update => {
    const text = [
      update.notes || '',
      update.text || '',
      update.type || ''
    ].join(' ').toLowerCase()

    return ANY_RESPONSE_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()))
  })
}

/**
 * Check if job has received a positive response (interview/offer)
 *
 * @param {object} job - Job object
 * @returns {boolean} True if job has positive response indicator
 */
function hasPositiveResponse(job) {
  // Check status progression to interview or beyond
  const positiveStatuses = ['interviewing', 'offer', 'accepted']
  if (positiveStatuses.includes(job.status)) {
    return true
  }

  // Check updates for interview/offer keywords
  if (!job.updates || !Array.isArray(job.updates)) {
    return false
  }

  return job.updates.some(update => {
    const text = [
      update.notes || '',
      update.text || '',
      update.type || ''
    ].join(' ').toLowerCase()

    return POSITIVE_RESPONSE_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()))
  })
}

/**
 * Get dimension value from a job
 *
 * @param {object} job - Job object
 * @param {string} dimension - Dimension name
 * @returns {string|null} Dimension value or null
 */
function getDimensionValue(job, dimension) {
  switch (dimension) {
    case 'companySize':
      return job.companySize || null
    case 'industry':
      return job.industry || null
    case 'applicationMethod':
      return job.applicationMethod || job.submittedVia || null
    case 'jobBoard':
      // Return first source as job board (sources is an array)
      return (job.sources && job.sources.length > 0) ? job.sources[0] : null
    case 'roleType':
      return job.roleType || null
    default:
      return null
  }
}

/**
 * Filter jobs by dimension value
 *
 * @param {Array} jobs - Array of jobs
 * @param {string} dimension - Dimension name
 * @param {string} value - Dimension value
 * @returns {Array} Filtered jobs
 */
function filterByDimension(jobs, dimension, value) {
  return jobs.filter(job => {
    const jobValue = getDimensionValue(job, dimension)
    return jobValue === value
  })
}

/**
 * Calculate response rate for a specific dimension value
 *
 * @param {Array} jobs - Array of job objects
 * @param {string} dimension - Dimension to filter by
 * @param {string|null} value - Specific value to filter (null for all)
 * @returns {{ dimension: string, value: string, rate: number, sampleSize: number, confidence: string, positiveResponses: number, display: string }}
 */
export function calculateResponseRate(jobs, dimension = null, value = null) {
  if (!jobs || !Array.isArray(jobs)) {
    return {
      dimension: dimension || 'overall',
      value: value || 'all',
      rate: 0,
      sampleSize: 0,
      confidence: 'very-low',
      positiveResponses: 0,
      display: '0% (n=0) low confidence'
    }
  }

  // Filter by dimension if specified
  let filteredJobs = jobs
  if (dimension && value) {
    filteredJobs = filterByDimension(jobs, dimension, value)
  }

  // Get applied jobs only
  const appliedJobs = filteredJobs.filter(isApplied)
  const total = appliedJobs.length

  // Count positive responses (interview/offer)
  const positiveResponses = appliedJobs.filter(hasPositiveResponse).length

  // Calculate rate
  const rate = total > 0 ? positiveResponses / total : 0
  const confidence = getConfidenceLevel(total)
  const display = formatRateDisplay(rate, total, confidence)

  return {
    dimension: dimension || 'overall',
    value: value || 'all',
    rate: Math.round(rate * 100) / 100, // Round to 2 decimal places
    sampleSize: total,
    confidence,
    positiveResponses,
    display
  }
}

/**
 * Calculate acknowledgment rate (any response including rejections)
 *
 * @param {Array} jobs - Array of job objects
 * @param {string} dimension - Dimension to filter by
 * @param {string|null} value - Specific value to filter (null for all)
 * @returns {{ dimension: string, value: string, rate: number, sampleSize: number, confidence: string, acknowledgedCount: number, display: string }}
 */
export function calculateAcknowledgmentRate(jobs, dimension = null, value = null) {
  if (!jobs || !Array.isArray(jobs)) {
    return {
      dimension: dimension || 'overall',
      value: value || 'all',
      rate: 0,
      sampleSize: 0,
      confidence: 'very-low',
      acknowledgedCount: 0,
      display: '0% (n=0) low confidence'
    }
  }

  // Filter by dimension if specified
  let filteredJobs = jobs
  if (dimension && value) {
    filteredJobs = filterByDimension(jobs, dimension, value)
  }

  // Get applied jobs only
  const appliedJobs = filteredJobs.filter(isApplied)
  const total = appliedJobs.length

  // Count any responses (including rejections)
  const acknowledgedCount = appliedJobs.filter(hasAnyResponse).length

  // Calculate rate
  const rate = total > 0 ? acknowledgedCount / total : 0
  const confidence = getConfidenceLevel(total)
  const display = formatRateDisplay(rate, total, confidence)

  return {
    dimension: dimension || 'overall',
    value: value || 'all',
    rate: Math.round(rate * 100) / 100, // Round to 2 decimal places
    sampleSize: total,
    confidence,
    acknowledgedCount,
    display
  }
}

/**
 * Calculate response rates for all values of a dimension
 *
 * @param {Array} jobs - Array of job objects
 * @param {string} dimension - Dimension to analyze
 * @returns {Array<{ dimension: string, value: string, rate: number, sampleSize: number, confidence: string, positiveResponses: number, display: string }>}
 */
export function calculateRatesByDimension(jobs, dimension) {
  if (!jobs || !Array.isArray(jobs) || !dimension) {
    return []
  }

  if (!VALID_DIMENSIONS.includes(dimension)) {
    console.warn(`Invalid dimension: ${dimension}. Valid dimensions: ${VALID_DIMENSIONS.join(', ')}`)
    return []
  }

  // Get unique values for dimension (including Unknown for null/undefined)
  const valueSet = new Set()
  for (const job of jobs) {
    const value = getDimensionValue(job, dimension)
    valueSet.add(value || 'Unknown')
  }

  // Calculate rate for each value
  const results = []
  for (const value of valueSet) {
    const filteredJobs = value === 'Unknown'
      ? jobs.filter(job => getDimensionValue(job, dimension) === null)
      : filterByDimension(jobs, dimension, value)

    const appliedJobs = filteredJobs.filter(isApplied)
    const total = appliedJobs.length

    // Skip if no applied jobs in this category
    if (total === 0) continue

    const positiveResponses = appliedJobs.filter(hasPositiveResponse).length
    const rate = positiveResponses / total
    const confidence = getConfidenceLevel(total)
    const display = formatRateDisplay(rate, total, confidence)

    results.push({
      dimension,
      value,
      rate: Math.round(rate * 100) / 100,
      sampleSize: total,
      confidence,
      positiveResponses,
      display
    })
  }

  // Sort by sample size (largest first)
  results.sort((a, b) => b.sampleSize - a.sampleSize)

  // Add overall for the dimension at the beginning
  const overallRate = calculateResponseRate(jobs, null, null)
  results.unshift({
    ...overallRate,
    dimension,
    value: 'Overall'
  })

  return results
}

/**
 * Calculate acknowledgment rates for all values of a dimension
 *
 * @param {Array} jobs - Array of job objects
 * @param {string} dimension - Dimension to analyze
 * @returns {Array}
 */
export function calculateAcknowledgmentRatesByDimension(jobs, dimension) {
  if (!jobs || !Array.isArray(jobs) || !dimension) {
    return []
  }

  if (!VALID_DIMENSIONS.includes(dimension)) {
    console.warn(`Invalid dimension: ${dimension}. Valid dimensions: ${VALID_DIMENSIONS.join(', ')}`)
    return []
  }

  // Get unique values for dimension (including Unknown for null/undefined)
  const valueSet = new Set()
  for (const job of jobs) {
    const value = getDimensionValue(job, dimension)
    valueSet.add(value || 'Unknown')
  }

  // Calculate rate for each value
  const results = []
  for (const value of valueSet) {
    const filteredJobs = value === 'Unknown'
      ? jobs.filter(job => getDimensionValue(job, dimension) === null)
      : filterByDimension(jobs, dimension, value)

    const appliedJobs = filteredJobs.filter(isApplied)
    const total = appliedJobs.length

    // Skip if no applied jobs in this category
    if (total === 0) continue

    const acknowledgedCount = appliedJobs.filter(hasAnyResponse).length
    const rate = acknowledgedCount / total
    const confidence = getConfidenceLevel(total)
    const display = formatRateDisplay(rate, total, confidence)

    results.push({
      dimension,
      value,
      rate: Math.round(rate * 100) / 100,
      sampleSize: total,
      confidence,
      acknowledgedCount,
      display
    })
  }

  // Sort by sample size (largest first)
  results.sort((a, b) => b.sampleSize - a.sampleSize)

  // Add overall at the beginning
  const overallRate = calculateAcknowledgmentRate(jobs, null, null)
  results.unshift({
    ...overallRate,
    dimension,
    value: 'Overall'
  })

  return results
}
