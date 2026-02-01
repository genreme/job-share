#!/usr/bin/env node

/**
 * Job Search Command Center - MCP Server
 *
 * Exposes job data, resume context, and generation tools to Claude Chat
 * for deep research, document generation, and interview prep.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import tool implementations
import {
  getJobs,
  getJobDetail,
  getJobsByCompany,
  getApplicationStats,
  findSimilarJobs,
  getSearchHistory
} from './tools/jobs.js';

import {
  getResumeData,
  getResumeSections,
  getCoverLetterTemplate,
  getDocumentHistory,
  getDocumentsForCompany,
  getExperienceByTheme,
  getPortfolioHighlights,
  getKeyMetrics,
  getCustomizationSuggestions
} from './tools/resume.js';

import {
  generateResume,
  generateCoverLetter,
  generateInterviewPrep,
  previewDocumentSources,
  validateResume,
  validateCoverLetter,
  assessPageFit
} from './tools/documents.js';

import {
  updateJob,
  archiveJob,
  archiveJobs,
  setHiringManager,
  addJobNote,
  bulkUpdateJobs
} from './tools/updates.js';

import {
  getProfile,
  getExperienceByTheme as getProfileExperienceByTheme,
  getStoriesByCategory,
  getSkillsByCategory,
  getSummaryBlocksByAudience,
  getTargetRoles,
  getCommunicationPrefs
} from './tools/profile.js';

import {
  queueProfileExtraction,
  getPendingExtractions,
  confirmExtraction,
  batchConfirmExtractions,
  getExtractionHistory
} from './tools/learning.js';

import {
  runWeeklyCleanup,
  getCleanupFindings,
  dismissCleanupFinding
} from './tools/cleanup.js';

import {
  researchJobUrl,
  getInboxForReview,
  confirmJobToDashboard,
  deferJob
} from './tools/discovery.js';

// Phase 6: Application Intelligence tools
import {
  getResumeMatch,
  getMatchScoresForActiveJobs
} from './tools/matching.js';

import {
  addJobContact,
  logContactInteraction,
  getJobContacts,
  addJobUpdate
} from './tools/contacts.js';

import {
  getFollowups,
  getJobFollowupStatus,
  getFollowupSummary
} from './tools/followup.js';

// Create server
const server = new Server(
  {
    name: 'jscc-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
const TOOLS = [
  // === Job Management ===
  {
    name: 'get_jobs',
    description: 'Get list of jobs from the dashboard. Filter by status (apply-now, maybe, probably-not, applied, archived) or minimum fit score. Returns job summaries sorted by fit score.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by job status',
          enum: ['apply-now', 'maybe', 'probably-not', 'applied', 'archived']
        },
        minFitScore: {
          type: 'number',
          description: 'Minimum fit score (0-100)'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (default: 50)'
        }
      }
    }
  },
  {
    name: 'get_job_detail',
    description: 'Get detailed information about a specific job including notes, updates, connections, and full history.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'number',
          description: 'The job ID'
        }
      },
      required: ['jobId']
    }
  },
  {
    name: 'get_jobs_by_company',
    description: 'Find all jobs at a specific company or similar company names.',
    inputSchema: {
      type: 'object',
      properties: {
        companyName: {
          type: 'string',
          description: 'Company name to search for'
        }
      },
      required: ['companyName']
    }
  },
  {
    name: 'get_application_stats',
    description: 'Get statistics about job applications including response rates, interview rates, and distribution by status/industry.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'find_similar_jobs',
    description: 'Find jobs similar to a given job based on industry, title, and location.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'number',
          description: 'The job ID to find similar jobs for'
        }
      },
      required: ['jobId']
    }
  },
  {
    name: 'get_search_history',
    description: 'Get history of job searches including dates, sources, and jobs found.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  // === Resume Context ===
  {
    name: 'get_resume_data',
    description: 'Get the full master resume data including all experience, skills, education, and contact info.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_resume_sections',
    description: 'Get resume sections with character counts and limit warnings. Useful for checking if content fits page limits.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_cover_letter_template',
    description: 'Get the cover letter structure and template with recommended lengths.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_document_history',
    description: 'Get list of previously generated resume and cover letter PDFs.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_documents_for_company',
    description: 'Get documents (resumes, cover letters) previously generated for a specific company.',
    inputSchema: {
      type: 'object',
      properties: {
        companyName: {
          type: 'string',
          description: 'Company name to search for'
        }
      },
      required: ['companyName']
    }
  },
  {
    name: 'get_experience_by_theme',
    description: 'Find experience bullets that match a specific theme or skill (e.g., "leadership", "design systems", "team scaling").',
    inputSchema: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          description: 'Theme or skill to search for'
        }
      },
      required: ['theme']
    }
  },
  {
    name: 'get_portfolio_highlights',
    description: 'Get relevant portfolio highlights and case study material for a role type.',
    inputSchema: {
      type: 'object',
      properties: {
        roleType: {
          type: 'string',
          description: 'Type of role',
          enum: ['creative_director', 'design_lead', 'brand_manager', 'general']
        }
      }
    }
  },
  {
    name: 'get_key_metrics',
    description: 'Get experience bullets that contain quantifiable metrics and achievements.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_customization_suggestions',
    description: 'Get suggestions for customizing resume/cover letter for a specific job.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Job title'
        },
        company: {
          type: 'string',
          description: 'Company name'
        },
        industry: {
          type: 'string',
          description: 'Industry/sector'
        }
      },
      required: ['title']
    }
  },

  // === Document Generation ===
  {
    name: 'generate_resume',
    description: 'Generate a tailored resume PDF for a specific company/role. Uses profile data as primary source, with gap warnings that can be bypassed.',
    inputSchema: {
      type: 'object',
      properties: {
        company: {
          type: 'string',
          description: 'Target company name'
        },
        title: {
          type: 'string',
          description: 'Target job title'
        },
        audience: {
          type: 'string',
          description: 'Audience type for summary selection',
          enum: ['technical', 'leadership', 'executive', 'mission-driven']
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Keywords for relevance matching'
        },
        customizations: {
          type: 'object',
          description: 'Customization options (bullets to include/exclude, summary tweaks, etc.)'
        },
        outputPath: {
          type: 'string',
          description: 'Optional custom output filename'
        },
        proceedWithGaps: {
          type: 'boolean',
          description: 'Set to true to proceed despite profile gaps'
        }
      },
      required: ['company', 'title']
    }
  },
  {
    name: 'generate_cover_letter',
    description: 'Generate a tailored cover letter PDF for a specific company/role. Uses profile tone preferences and STAR stories.',
    inputSchema: {
      type: 'object',
      properties: {
        company: {
          type: 'string',
          description: 'Target company name'
        },
        title: {
          type: 'string',
          description: 'Target job title'
        },
        hiringManager: {
          type: 'string',
          description: 'Name of hiring manager (defaults to "Hiring Manager")'
        },
        keyPoints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key points to emphasize in the letter'
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Keywords for relevance matching'
        },
        outputPath: {
          type: 'string',
          description: 'Optional custom output filename'
        },
        proceedWithGaps: {
          type: 'boolean',
          description: 'Set to true to proceed despite profile gaps'
        }
      },
      required: ['company', 'title']
    }
  },
  {
    name: 'generate_interview_prep',
    description: 'Generate interview preparation materials from profile STAR stories and target role information.',
    inputSchema: {
      type: 'object',
      properties: {
        company: {
          type: 'string',
          description: 'Target company name'
        },
        title: {
          type: 'string',
          description: 'Target job title'
        },
        interviewType: {
          type: 'string',
          description: 'Type of interview',
          enum: ['behavioral', 'technical', 'leadership']
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Keywords for relevance matching'
        }
      },
      required: ['company', 'title']
    }
  },
  {
    name: 'preview_document_sources',
    description: 'Preview which profile sections will be used before generating a document. Shows summary blocks, experience, skills, and any gaps.',
    inputSchema: {
      type: 'object',
      properties: {
        documentType: {
          type: 'string',
          description: 'Type of document to preview',
          enum: ['resume', 'cover_letter', 'interview_prep']
        },
        company: {
          type: 'string',
          description: 'Target company name'
        },
        title: {
          type: 'string',
          description: 'Target job title'
        },
        audience: {
          type: 'string',
          description: 'Audience type (for resume)',
          enum: ['technical', 'leadership', 'executive', 'mission-driven']
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Keywords for relevance matching'
        }
      },
      required: ['documentType']
    }
  },
  {
    name: 'validate_resume',
    description: 'Validate resume content fits within page limits. Checks character counts for summary, bullets, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Professional summary text'
        },
        experienceBullets: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of experience bullet points'
        },
        skills: {
          type: 'string',
          description: 'Skills section text'
        },
        education: {
          type: 'string',
          description: 'Education section text'
        }
      }
    }
  },
  {
    name: 'validate_cover_letter',
    description: 'Validate cover letter content fits within page limits.',
    inputSchema: {
      type: 'object',
      properties: {
        opening: {
          type: 'string',
          description: 'Opening paragraph'
        },
        body: {
          type: 'string',
          description: 'Body paragraphs'
        },
        closing: {
          type: 'string',
          description: 'Closing paragraph'
        },
        keyAlignment: {
          type: 'string',
          description: 'Key alignment box content (optional)'
        }
      }
    }
  },
  {
    name: 'assess_page_fit',
    description: 'Assess how well the current master resume data fits within page limits. Returns section analysis and recommendations.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  // === Job Updates (Write-Back) ===
  {
    name: 'update_job',
    description: 'Update a job\'s fields in the dashboard. Can update any field: title, company, location, salary, fitScore, industry, url, notes, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'number',
          description: 'The job ID to update'
        },
        updates: {
          type: 'object',
          description: 'Object with field:value pairs to update (e.g., {salary: "$150k", fitScore: 85})'
        }
      },
      required: ['jobId', 'updates']
    }
  },
  {
    name: 'archive_job',
    description: 'Archive a single job (set status to archived). Use when a posting is closed or no longer relevant.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'number',
          description: 'The job ID to archive'
        },
        reason: {
          type: 'string',
          description: 'Reason for archiving (e.g., "Posting closed", "Position filled")'
        }
      },
      required: ['jobId']
    }
  },
  {
    name: 'archive_jobs',
    description: 'Archive multiple jobs at once. Use for bulk cleanup of closed postings.',
    inputSchema: {
      type: 'object',
      properties: {
        jobIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of job IDs to archive'
        },
        reason: {
          type: 'string',
          description: 'Reason for archiving'
        }
      },
      required: ['jobIds']
    }
  },
  {
    name: 'set_hiring_manager',
    description: 'Record hiring manager information for a job. Stores name, title, LinkedIn URL, and adds to connections.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'number',
          description: 'The job ID'
        },
        manager: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Hiring manager name' },
            title: { type: 'string', description: 'Their job title' },
            linkedin: { type: 'string', description: 'LinkedIn profile URL' },
            notes: { type: 'string', description: 'Additional notes' }
          },
          required: ['name']
        }
      },
      required: ['jobId', 'manager']
    }
  },
  {
    name: 'add_job_note',
    description: 'Add a note or update entry to a job\'s history log.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'number',
          description: 'The job ID'
        },
        type: {
          type: 'string',
          description: 'Type of update (e.g., "Research", "Status Check", "Interview", "Note")'
        },
        notes: {
          type: 'string',
          description: 'The note content'
        }
      },
      required: ['jobId', 'notes']
    }
  },
  {
    name: 'bulk_update_jobs',
    description: 'Update multiple jobs at once. Efficient for applying many changes from research.',
    inputSchema: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              jobId: { type: 'number' },
              updates: { type: 'object' }
            }
          },
          description: 'Array of {jobId, updates} objects'
        }
      },
      required: ['updates']
    }
  },

  // === Profile Access ===
  {
    name: 'get_profile',
    description: 'Get the full professional profile including experience, skills, summaries, stories, and preferences.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_experience_by_theme',
    description: 'Get experience entries filtered by theme/tag. Returns experience where any project has the matching tag. Useful for "show me where you demonstrated leadership".',
    inputSchema: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          description: 'Theme or tag to filter by (e.g., "leadership", "technical", "cross-functional")'
        }
      },
      required: ['theme']
    }
  },
  {
    name: 'get_stories_by_category',
    description: 'Get STAR stories filtered by interview question category. Useful for "find stories about conflict resolution".',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Question category to filter by (e.g., "leadership", "conflict-resolution", "change-management")'
        }
      },
      required: ['category']
    }
  },
  {
    name: 'get_skills_by_category',
    description: 'Get skills filtered by category or subcategory. Returns skills with their evidence references.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Skill category to filter by (e.g., "Technical", "Leadership", "Frontend Frameworks")'
        }
      },
      required: ['category']
    }
  },
  {
    name: 'get_summary_blocks_by_audience',
    description: 'Get summary blocks appropriate for a specific audience. Useful for generating audience-specific summaries.',
    inputSchema: {
      type: 'object',
      properties: {
        audience: {
          type: 'string',
          description: 'Audience to filter by',
          enum: ['technical', 'leadership', 'executive', 'mission-driven']
        }
      },
      required: ['audience']
    }
  },
  {
    name: 'get_target_roles',
    description: 'Get target roles defining job search criteria (title, level, industries, locations, salary range, etc.).',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_communication_prefs',
    description: 'Get communication preferences (tone, verbosity, emphasis areas, phrases to avoid) for content generation.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  // === Profile Cleanup ===
  {
    name: 'run_weekly_cleanup',
    description: 'Run cleanup analysis on profile to find duplicates (similar skills/stories), stale items (not updated AND not used), and gaps (missing fields, thin evidence). Returns findings for review - never auto-modifies profile.',
    inputSchema: {
      type: 'object',
      properties: {
        jobContext: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Job title being applied for' },
            company: { type: 'string', description: 'Company name' }
          },
          description: 'Optional job context for contextual gap detection'
        }
      }
    }
  },
  {
    name: 'get_cleanup_findings',
    description: 'Get stored cleanup findings from the most recent run. Returns duplicates, stale items, and gaps with reasons and suggestions.',
    inputSchema: {
      type: 'object',
      properties: {
        filterType: {
          type: 'string',
          description: 'Filter findings by type',
          enum: ['duplicate', 'stale', 'gap']
        }
      }
    }
  },
  {
    name: 'dismiss_finding',
    description: 'Dismiss a cleanup finding (mark as acknowledged). Dismissed findings won\'t show in future get_cleanup_findings results.',
    inputSchema: {
      type: 'object',
      properties: {
        findingHash: {
          type: 'string',
          description: 'Hash identifying the finding (from get_cleanup_findings)'
        },
        reason: {
          type: 'string',
          description: 'Optional reason for dismissing'
        }
      },
      required: ['findingHash']
    }
  },

  // === Profile Learning ===
  {
    name: 'queue_profile_extraction',
    description: 'Queue a profile insight extracted from conversation for user confirmation. Call this proactively during normal conversations when you detect professional information worth capturing - skills mentioned, achievements discussed, preferences expressed, story elements shared, or work patterns observed. The user confirms before any profile changes.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Type of insight',
          enum: ['skill', 'achievement', 'preference', 'story', 'pattern']
        },
        content: {
          type: 'string',
          description: 'The extracted insight (e.g., skill name, achievement description)'
        },
        confidence: {
          type: 'string',
          description: 'Confidence in the extraction accuracy',
          enum: ['high', 'medium', 'low']
        },
        sourceQuote: {
          type: 'string',
          description: 'Supporting text from the conversation'
        },
        targetField: {
          type: 'string',
          description: 'Specific profile field path if known'
        }
      },
      required: ['category', 'content', 'confidence']
    }
  },
  {
    name: 'get_pending_extractions',
    description: 'Get pending profile extractions awaiting user confirmation. Sorted by confidence (high first).',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by category',
              enum: ['skill', 'achievement', 'preference', 'story', 'pattern']
            },
            confidence: {
              type: 'string',
              description: 'Filter by confidence level',
              enum: ['high', 'medium', 'low']
            }
          }
        },
        limit: {
          type: 'number',
          description: 'Maximum number to return'
        }
      }
    }
  },
  {
    name: 'confirm_extraction',
    description: 'Confirm, reject, or merge a pending extraction. Confirm adds to profile, reject discards, merge updates existing profile item.',
    inputSchema: {
      type: 'object',
      properties: {
        extractionId: {
          type: 'string',
          description: 'The extraction ID to process'
        },
        action: {
          type: 'string',
          description: 'Action to take',
          enum: ['confirm', 'reject', 'merge']
        },
        targetField: {
          type: 'string',
          description: 'Override target field for confirm'
        },
        mergeWith: {
          type: 'string',
          description: 'Profile item ID to merge with (required for merge action)'
        }
      },
      required: ['extractionId', 'action']
    }
  },
  {
    name: 'batch_confirm_extractions',
    description: 'Confirm or reject multiple extractions at once. Useful for end-of-conversation batch processing.',
    inputSchema: {
      type: 'object',
      properties: {
        extractionIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of extraction IDs to process'
        },
        action: {
          type: 'string',
          description: 'Action to take on all',
          enum: ['confirm', 'reject']
        }
      },
      required: ['extractionIds', 'action']
    }
  },
  {
    name: 'get_extraction_history',
    description: 'Get history of processed extractions (confirmed, rejected, merged).',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by status',
          enum: ['confirmed', 'rejected', 'merged']
        },
        limit: {
          type: 'number',
          description: 'Maximum number to return'
        }
      }
    }
  },

  // === Discovery ===
  {
    name: 'research_job_url',
    description: 'Research a job posting URL to extract details, calculate fit score, and generate reasoning. Returns job data ready for user confirmation. Use this for manual job submissions.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full URL of the job posting' },
        notes: { type: 'string', description: 'Optional notes about the submission' }
      },
      required: ['url']
    }
  },
  {
    name: 'get_inbox',
    description: 'Get jobs awaiting review in the inbox. Returns jobs sorted by fit score with summary stats.',
    inputSchema: {
      type: 'object',
      properties: {
        sortBy: { type: 'string', enum: ['fitScore', 'found'], description: 'Sort order (default: fitScore)' }
      }
    }
  },
  {
    name: 'confirm_job',
    description: 'Confirm an inbox job and add it to the dashboard with a status. Valid statuses: apply-now, maybe, probably-not.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'number', description: 'ID of the job to confirm' },
        status: { type: 'string', enum: ['apply-now', 'maybe', 'probably-not'], description: 'Target status' },
        notes: { type: 'string', description: 'Optional confirmation notes' }
      },
      required: ['jobId', 'status']
    }
  },
  {
    name: 'defer_job',
    description: 'Defer an inbox job for later review. Job stays in inbox but is marked with reason and optional review date.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'number', description: 'ID of the job to defer' },
        reason: { type: 'string', description: 'Why deferring (e.g., "waiting for more info")' },
        reviewAfter: { type: 'string', description: 'ISO date to review again (optional)' }
      },
      required: ['jobId', 'reason']
    }
  },

  // === Application Intelligence (Phase 6) ===

  // Resume Matching (APPL-01, APPL-02)
  {
    name: 'get_resume_match',
    description: 'Get resume-JD match score for a job with gap analysis. Shows how well your profile matches the job requirements and identifies missing skills to add. Use before applying to understand fit.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'number',
          description: 'Job ID to match against (uses job notes/description)'
        },
        jobDescription: {
          type: 'string',
          description: 'Direct job description text (alternative to jobId)'
        }
      }
    }
  },
  {
    name: 'get_match_scores_for_active_jobs',
    description: 'Get resume match scores for all active jobs (apply-now, maybe, inbox). Helps prioritize which jobs to apply to based on profile fit.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of jobs to return'
        }
      }
    }
  },

  // Contact Tracking (APPL-03, APPL-04, APPL-07)
  {
    name: 'add_job_contact',
    description: 'Add or update a contact (recruiter, hiring manager, referral) for a job. Supports structured format with LinkedIn URL, title, and interaction tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'number',
          description: 'Job ID to add contact to'
        },
        contact: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Contact name (required)' },
            role: {
              type: 'string',
              description: 'Contact role',
              enum: ['recruiter', 'hiring_manager', 'referral', 'internal_contact', 'other']
            },
            title: { type: 'string', description: 'Job title (e.g., "Senior Technical Recruiter")' },
            linkedInUrl: { type: 'string', description: 'LinkedIn profile URL' },
            email: { type: 'string', description: 'Email address' },
            notes: { type: 'string', description: 'Notes about the contact' },
            isPrimary: { type: 'boolean', description: 'Mark as primary contact for this job' }
          },
          required: ['name']
        }
      },
      required: ['jobId', 'contact']
    }
  },
  {
    name: 'log_contact_interaction',
    description: 'Log an interaction with a contact (email, LinkedIn message, call, meeting). Updates lastInteraction and adds to interaction history.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'number',
          description: 'Job ID'
        },
        contactId: {
          type: 'string',
          description: 'Contact UUID (from get_job_contacts)'
        },
        interaction: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'Interaction type',
              enum: ['email', 'linkedin', 'call', 'meeting', 'other']
            },
            notes: { type: 'string', description: 'Notes about the interaction' }
          },
          required: ['type']
        }
      },
      required: ['jobId', 'contactId', 'interaction']
    }
  },
  {
    name: 'get_job_contacts',
    description: 'Get all contacts for a job. Returns structured contacts with full details and legacy string contacts separately.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'number',
          description: 'Job ID'
        }
      },
      required: ['jobId']
    }
  },
  {
    name: 'add_job_update',
    description: 'Add a comprehensive update to a job: note, contact, status change, or append to notes field. Handles all update types in one call.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'number',
          description: 'Job ID'
        },
        update: {
          type: 'object',
          properties: {
            note: { type: 'string', description: 'Note to add to job history' },
            type: { type: 'string', description: 'Type of update (e.g., "Interview", "Research")' },
            connection: {
              type: 'object',
              description: 'Contact to add (same format as add_job_contact)'
            },
            status: {
              type: 'string',
              description: 'New status (validated transition)',
              enum: ['inbox', 'apply-now', 'maybe', 'probably-not', 'applied', 'archived']
            },
            appendToNotes: { type: 'string', description: 'Text to append to notes field with timestamp' }
          }
        }
      },
      required: ['jobId', 'update']
    }
  },

  // Follow-up Engine (APPL-05, APPL-06)
  {
    name: 'get_followups',
    description: 'Get prioritized follow-up queue. Returns jobs needing follow-up sorted by priority (high/medium/low) with smart suggestions based on status and elapsed time.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum items to return (default: 10)'
        }
      }
    }
  },
  {
    name: 'get_job_followup_status',
    description: 'Get detailed follow-up status for a specific job including priority, suggestions, and contact information.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'number',
          description: 'Job ID'
        }
      },
      required: ['jobId']
    }
  },
  {
    name: 'get_followup_summary',
    description: 'Get summary of all follow-up needs: counts by priority and status, top actions to take. Dashboard-level overview.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      // Job Management
      case 'get_jobs':
        result = getJobs(args || {});
        break;
      case 'get_job_detail':
        result = getJobDetail(args.jobId);
        break;
      case 'get_jobs_by_company':
        result = getJobsByCompany(args.companyName);
        break;
      case 'get_application_stats':
        result = getApplicationStats();
        break;
      case 'find_similar_jobs':
        result = findSimilarJobs(args.jobId);
        break;
      case 'get_search_history':
        result = getSearchHistory();
        break;

      // Resume Context
      case 'get_resume_data':
        result = getResumeData();
        break;
      case 'get_resume_sections':
        result = getResumeSections();
        break;
      case 'get_cover_letter_template':
        result = getCoverLetterTemplate();
        break;
      case 'get_document_history':
        result = getDocumentHistory();
        break;
      case 'get_documents_for_company':
        result = getDocumentsForCompany(args.companyName);
        break;
      case 'get_experience_by_theme':
        result = getExperienceByTheme(args.theme);
        break;
      case 'get_portfolio_highlights':
        result = getPortfolioHighlights(args?.roleType || 'general');
        break;
      case 'get_key_metrics':
        result = getKeyMetrics();
        break;
      case 'get_customization_suggestions':
        result = getCustomizationSuggestions({
          title: args.title,
          company: args.company,
          industry: args.industry
        });
        break;

      // Document Generation
      case 'generate_resume':
        result = generateResume({
          company: args.company,
          title: args.title,
          audience: args.audience,
          keywords: args.keywords,
          customizations: args.customizations,
          outputPath: args.outputPath,
          proceedWithGaps: args.proceedWithGaps
        });
        break;
      case 'generate_cover_letter':
        result = generateCoverLetter({
          company: args.company,
          title: args.title,
          hiringManager: args.hiringManager,
          keyPoints: args.keyPoints,
          keywords: args.keywords,
          outputPath: args.outputPath,
          proceedWithGaps: args.proceedWithGaps
        });
        break;
      case 'generate_interview_prep':
        result = generateInterviewPrep({
          company: args.company,
          title: args.title,
          interviewType: args.interviewType,
          keywords: args.keywords
        });
        break;
      case 'preview_document_sources':
        result = previewDocumentSources({
          documentType: args.documentType,
          company: args.company,
          title: args.title,
          audience: args.audience,
          keywords: args.keywords
        });
        break;
      case 'validate_resume':
        result = validateResume({
          summary: args.summary,
          experienceBullets: args.experienceBullets,
          skills: args.skills,
          education: args.education
        });
        break;
      case 'validate_cover_letter':
        result = validateCoverLetter({
          opening: args.opening,
          body: args.body,
          closing: args.closing,
          keyAlignment: args.keyAlignment
        });
        break;
      case 'assess_page_fit':
        result = assessPageFit();
        break;

      // Job Updates (Write-Back)
      case 'update_job':
        result = updateJob(args.jobId, args.updates);
        break;
      case 'archive_job':
        result = archiveJob(args.jobId, args.reason);
        break;
      case 'archive_jobs':
        result = archiveJobs(args.jobIds, args.reason);
        break;
      case 'set_hiring_manager':
        result = setHiringManager(args.jobId, args.manager);
        break;
      case 'add_job_note':
        result = addJobNote(args.jobId, args.type, args.notes);
        break;
      case 'bulk_update_jobs':
        result = bulkUpdateJobs(args.updates);
        break;

      // Profile Access
      case 'get_profile':
        result = getProfile();
        break;
      case 'get_experience_by_theme':
        result = getProfileExperienceByTheme({ theme: args.theme });
        break;
      case 'get_stories_by_category':
        result = getStoriesByCategory({ category: args.category });
        break;
      case 'get_skills_by_category':
        result = getSkillsByCategory({ category: args.category });
        break;
      case 'get_summary_blocks_by_audience':
        result = getSummaryBlocksByAudience({ audience: args.audience });
        break;
      case 'get_target_roles':
        result = getTargetRoles();
        break;
      case 'get_communication_prefs':
        result = getCommunicationPrefs();
        break;

      // Profile Cleanup
      case 'run_weekly_cleanup':
        result = runWeeklyCleanup({ jobContext: args?.jobContext });
        break;
      case 'get_cleanup_findings':
        result = getCleanupFindings({ filterType: args?.filterType });
        break;
      case 'dismiss_finding':
        result = dismissCleanupFinding({ findingHash: args.findingHash, reason: args?.reason });
        break;

      // Profile Learning
      case 'queue_profile_extraction':
        result = queueProfileExtraction({
          category: args.category,
          content: args.content,
          confidence: args.confidence,
          sourceQuote: args.sourceQuote,
          targetField: args.targetField
        });
        break;
      case 'get_pending_extractions':
        result = getPendingExtractions({
          filter: args?.filter,
          limit: args?.limit
        });
        break;
      case 'confirm_extraction':
        result = confirmExtraction({
          extractionId: args.extractionId,
          action: args.action,
          targetField: args?.targetField,
          mergeWith: args?.mergeWith
        });
        break;
      case 'batch_confirm_extractions':
        result = batchConfirmExtractions({
          extractionIds: args.extractionIds,
          action: args.action
        });
        break;
      case 'get_extraction_history':
        result = getExtractionHistory({
          status: args?.status,
          limit: args?.limit
        });
        break;

      // Discovery
      case 'research_job_url':
        result = await researchJobUrl(args);
        break;
      case 'get_inbox':
        result = getInboxForReview(args);
        break;
      case 'confirm_job':
        result = confirmJobToDashboard(args);
        break;
      case 'defer_job':
        result = deferJob(args);
        break;

      // Application Intelligence (Phase 6)
      // Resume Matching
      case 'get_resume_match':
        result = getResumeMatch({
          jobId: args?.jobId,
          jobDescription: args?.jobDescription
        });
        break;
      case 'get_match_scores_for_active_jobs':
        result = getMatchScoresForActiveJobs({
          limit: args?.limit
        });
        break;

      // Contact Tracking
      case 'add_job_contact':
        result = addJobContact(args.jobId, args.contact);
        break;
      case 'log_contact_interaction':
        result = logContactInteraction(args.jobId, args.contactId, args.interaction);
        break;
      case 'get_job_contacts':
        result = getJobContacts(args.jobId);
        break;
      case 'add_job_update':
        result = addJobUpdate(args.jobId, args.update);
        break;

      // Follow-up Engine
      case 'get_followups':
        result = getFollowups({
          limit: args?.limit
        });
        break;
      case 'get_job_followup_status':
        result = getJobFollowupStatus(args.jobId);
        break;
      case 'get_followup_summary':
        result = getFollowupSummary();
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('JSCC MCP Server running on stdio');
}

main().catch(console.error);
