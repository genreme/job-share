/**
 * Document Review MCP Tools
 *
 * Provides document review and approval workflow.
 * Per CONTEXT.md: "Flag + suggest" for issues, "Explicit approval required
 * before document is marked 'ready to use'"
 *
 * APPL-12: Full review (grammar, ATS, tone, length, factual accuracy)
 */

import { loadJobsFromDashboard, writeJobsData } from '../data/loader.js'
import { loadProfile } from '../data/profile-loader.js'
import { reviewDocument } from '../services/document-review.js'

/**
 * Review a generated document for issues
 * Checks grammar, ATS compatibility, tone, length, and factual accuracy
 *
 * Per CONTEXT.md: "Issues highlighted with suggested fixes, user approves each change"
 *
 * APPL-12
 *
 * @param {{ documentType: string, content: string, jobId?: number }} params
 * @returns {Promise<{ reviewId: string, documentType: string, scores: object, issues: Array, ... }>}
 */
export async function reviewGeneratedDocument({ documentType, content, jobId }) {
  if (!documentType) {
    return {
      error: 'Document type is required',
      validTypes: ['resume', 'cover_letter', 'email']
    }
  }

  if (!content || typeof content !== 'string') {
    return { error: 'Document content is required (string)' }
  }

  // Load profile for factual checking
  let profile = null
  try {
    profile = loadProfile()
  } catch (error) {
    console.error('Could not load profile for factual check:', error.message)
  }

  // Get job description if jobId provided
  let jobDescription = ''
  if (jobId) {
    const data = loadJobsFromDashboard()
    const job = data.jobs.find(j => j.id === jobId)
    if (job) {
      jobDescription = job.notes || job.description || ''
    }
  }

  // Run the full review
  const review = await reviewDocument(documentType, content, jobDescription, profile)

  // Format issues for user review (per CONTEXT.md: "flag + suggest")
  const formattedIssues = []

  // Grammar issues
  if (review.grammar?.issues?.length > 0) {
    for (const issue of review.grammar.issues) {
      formattedIssues.push({
        category: 'grammar',
        type: issue.type,
        severity: issue.severity,
        message: issue.message,
        context: issue.context,
        suggestions: issue.suggestions,
        action: 'Review and fix if needed'
      })
    }
  }

  // ATS issues
  if (review.ats?.issues?.length > 0) {
    for (const issue of review.ats.issues) {
      formattedIssues.push({
        category: 'ats',
        type: 'ats_compatibility',
        severity: issue.severity,
        message: issue.message,
        suggestions: issue.suggestions,
        action: 'Fix for better ATS parsing'
      })
    }
  }

  // Tone issues
  if (review.tone?.issues?.length > 0) {
    for (const issue of review.tone.issues) {
      formattedIssues.push({
        category: 'tone',
        type: 'tone_consistency',
        severity: 'warning',
        message: issue,
        action: 'Adjust tone to match profile preferences'
      })
    }
  }

  // Length issues
  if (!review.length?.withinLimits) {
    formattedIssues.push({
      category: 'length',
      type: 'length_limit',
      severity: 'warning',
      message: `Document is ${review.length?.wordCount} words (expected: varies by type)`,
      details: {
        wordCount: review.length?.wordCount,
        charCount: review.length?.charCount,
        pageEstimate: review.length?.pageEstimate
      },
      action: 'Trim content to fit within standard limits'
    })
  }

  // Factual issues
  if (review.factual?.unverified?.length > 0) {
    for (const item of review.factual.unverified) {
      formattedIssues.push({
        category: 'factual',
        type: 'unverified',
        severity: 'info',
        message: item,
        action: 'Verify accuracy against your records'
      })
    }
  }

  if (review.factual?.conflicts?.length > 0) {
    for (const conflict of review.factual.conflicts) {
      formattedIssues.push({
        category: 'factual',
        type: 'conflict',
        severity: 'error',
        message: conflict,
        action: 'Resolve conflict with profile data'
      })
    }
  }

  // Determine if document is ready to use
  const blockers = review.blockers || []
  const criticalIssues = formattedIssues.filter(i => i.severity === 'error').length

  return {
    reviewId: review.id,
    documentType,
    reviewedAt: review.reviewedAt,
    scores: {
      grammar: review.grammar?.score ?? null,
      ats: review.ats?.score ?? null,
      overall: review.overallScore
    },
    length: {
      words: review.length?.wordCount || 0,
      chars: review.length?.charCount || 0,
      pages: review.length?.pageEstimate || 1,
      withinLimits: review.length?.withinLimits ?? true
    },
    tone: {
      detected: review.tone?.detected || 'unknown',
      consistent: review.tone?.consistent ?? true
    },
    keywordCoverage: review.ats?.keywordCoverage || null,
    issues: formattedIssues,
    totalIssues: formattedIssues.length,
    criticalIssues,
    readyToUse: review.readyToUse,
    blockers,
    nextStep: review.readyToUse
      ? 'Call approve_document to mark as ready for use'
      : `Fix ${criticalIssues} critical issue(s) before approval`
  }
}

/**
 * Approve a document for use after review
 * Records approval in job history
 *
 * Per CONTEXT.md: "Explicit approval required before document is marked 'ready to use'"
 *
 * APPL-12
 *
 * @param {{ documentType: string, jobId: number, documentPath?: string }} params
 * @returns {{ success: boolean, jobId: number, documentType: string, approvedAt: string, status: string }}
 */
export function approveDocument({ documentType, jobId, documentPath }) {
  if (!documentType) {
    return {
      error: 'Document type is required',
      validTypes: ['resume', 'cover_letter', 'email']
    }
  }

  if (!jobId) {
    return { error: 'Job ID is required' }
  }

  // Load job data
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job with ID ${jobId} not found` }
  }

  const now = new Date().toISOString()
  const dateStr = now.split('T')[0]

  // Initialize updates array if needed
  if (!job.updates) {
    job.updates = []
  }

  // Add approval to job history
  const approvalNote = documentPath
    ? `${documentType} approved: ${documentPath}`
    : `${documentType} approved for use`

  job.updates.push({
    date: dateStr,
    timestamp: now,
    type: 'Document Approved',
    notes: approvalNote,
    documentType,
    documentPath: documentPath || null
  })

  // Save updated job data
  writeJobsData(data)

  return {
    success: true,
    jobId,
    company: job.company,
    title: job.title,
    documentType,
    approvedAt: now,
    status: 'ready_to_use',
    message: `${documentType} marked as ready to use for ${job.company}`
  }
}
