/**
 * Research Schema - Zod validation for company and hiring manager research
 *
 * Provides structured schemas for deep company investigation (APPL-08) and
 * hiring manager research focused on style and connection (APPL-09).
 * Research persists per job in both JSON and markdown formats (APPL-14).
 */

import { z } from 'zod'

// Confidence level for research quality
const ConfidenceLevel = z.enum(['high', 'medium', 'low'])

// News relevance level
const RelevanceLevel = z.enum(['high', 'medium', 'low'])

// Leadership quote object
const LeadershipQuoteSchema = z.object({
  quote: z.string(),
  speaker: z.string(),
  source: z.string().optional()
})

// News item object
const NewsItemSchema = z.object({
  headline: z.string(),
  date: z.string().optional(),
  source: z.string().optional(),
  relevance: RelevanceLevel.default('medium')
})

// Product/service object
const ProductSchema = z.object({
  name: z.string(),
  description: z.string().optional()
})

/**
 * Company Research Schema
 * APPL-08: Culture, news, funding, challenges
 *
 * Deep investigation covering firmographics, funding, culture signals,
 * news, challenges, competitors, and products.
 */
export const CompanyResearchSchema = z.object({
  // Identification
  id: z.string().uuid(),
  jobId: z.number(),
  companyName: z.string(),
  researchedAt: z.string(), // ISO date string
  refreshedAt: z.string().optional(),

  // Firmographics
  firmographics: z.object({
    size: z.string().optional(), // e.g., "50-200 employees"
    industry: z.string().optional(),
    founded: z.string().optional(),
    headquarters: z.string().optional(),
    website: z.string().optional() // URL or domain
  }).default({}),

  // Funding and financial signals
  funding: z.object({
    stage: z.string().optional(), // e.g., "Series B"
    totalRaised: z.string().optional(), // e.g., "$50M"
    lastRound: z.string().optional(), // e.g., "$20M Series B, Jan 2026"
    investors: z.array(z.string()).default([]),
    signals: z.array(z.string()).default([]) // e.g., "Growing headcount", "Recent profitability"
  }).default({ investors: [], signals: [] }),

  // Culture signals
  culture: z.object({
    values: z.array(z.string()).default([]),
    glassdoorThemes: z.array(z.string()).default([]),
    leadershipQuotes: z.array(LeadershipQuoteSchema).default([]),
    workStyle: z.string().optional() // e.g., "Remote-first", "Hybrid", "Fast-paced"
  }).default({ values: [], glassdoorThemes: [], leadershipQuotes: [] }),

  // Recent news
  news: z.array(NewsItemSchema).default([]),

  // Challenges and competitors
  challenges: z.array(z.string()).default([]),
  competitors: z.array(z.string()).default([]),

  // Products/services
  products: z.array(ProductSchema).default([]),

  // Research quality indicators
  confidence: ConfidenceLevel,
  sources: z.array(z.string()).default([]),

  // Summary for quick reference
  highlights: z.array(z.string()).default([])
})

/**
 * Hiring Manager Research Schema
 * APPL-09: Focus on style and connection
 *
 * Primary focus on interview style signals, communication patterns,
 * LinkedIn activity, shared interests, mutual connections, and talking points.
 * Background is secondary.
 */
export const HiringManagerResearchSchema = z.object({
  // Identification
  id: z.string().uuid(),
  jobId: z.number(),
  managerName: z.string(),
  researchedAt: z.string(), // ISO date string

  // Professional background (secondary priority per CONTEXT.md)
  background: z.object({
    currentRole: z.string().optional(),
    company: z.string().optional(),
    yearsInRole: z.number().optional(),
    previousRoles: z.array(z.string()).default([]),
    education: z.string().optional()
  }).default({ previousRoles: [] }),

  // Interview style and communication (primary priority per CONTEXT.md)
  interviewStyle: z.object({
    signals: z.array(z.string()).default([]), // From reviews, patterns
    communicationPattern: z.string().optional(), // e.g., "Direct", "Collaborative"
    commonQuestions: z.array(z.string()).default([])
  }).default({ signals: [], commonQuestions: [] }),

  // LinkedIn presence
  linkedIn: z.object({
    url: z.string().optional(),
    activity: z.array(z.string()).default([]), // Recent posts/engagement
    connections: z.number().optional()
  }).default({ activity: [] }),

  // Connection building (primary focus per CONTEXT.md)
  sharedInterests: z.array(z.string()).default([]),
  mutualConnections: z.array(z.string()).default([]),
  talkingPoints: z.array(z.string()).default([]),

  // Research quality indicators
  confidence: ConfidenceLevel,
  sources: z.array(z.string()).default([])
})

// Type exports for consumers
export const CompanyResearch = CompanyResearchSchema._type
export const HiringManagerResearch = HiringManagerResearchSchema._type
