# Job Search Operating System

## What This Is

A personal job search operating system that integrates self-presentation, opportunity discovery, application customization, interview preparation, and continuous learning into a unified workflow. Built on the existing Job Search Command Center, it features a centralized self-profile that informs all outputs, profile-based fit scoring with reasoning, resume-JD matching with gap analysis, contact tracking, interview preparation with practice sessions, and analytics that evolve search criteria based on outcomes.

## Core Value

Present the best version of myself to the right opportunities, informed by a comprehensive understanding of who I am professionally — not just what fits on a resume.

## Current State (v1.0 Shipped)

**Shipped:** 2026-02-03
**Stats:** 10 phases, 35 plans, 87 MCP tools, 2,276 tests, 48,890 LOC

**What Claude Can Do:**
- Manage job pipeline with profile-based fit scoring and reasoning
- Generate tailored resumes, cover letters, and emails from profile data
- Track contacts per job with interaction history and follow-up reminders
- Research companies and hiring managers, persist findings per job
- Prepare for interviews with practice sessions and 4-dimension scoring
- Capture interview transcripts, extract learnings, update profile confidence
- Analyze application funnel, response rates, skill gaps
- Evolve fit criteria based on real outcomes with preview/apply workflow

## Requirements

### Validated (v1.0)

**Self-Profile:**
- Centralized master-profile.json with experience, skills, summaries, STAR stories
- Weekly cleanup routine surfaces duplicates, staleness, gaps
- Profile feeds resume, cover letter, and interview prep generation
- Conversation-based learning with user confirmation before profile updates

**Discovery:**
- Profile-based fit scoring with configurable criteria
- Human-readable reasoning explaining fit scores
- Friend submissions via Supabase with context preservation
- PDF archiving and periodic job status verification
- Job board registry with quality-based prioritization

**Application:**
- Resume-JD matching with gap analysis and keyword suggestions
- Contact tracking with LinkedIn URLs and interaction history
- Time-based follow-up reminders with smart suggestions
- Company and hiring manager research workflows
- Document review (grammar, ATS, factual, tone) before approval

**Interview:**
- Interviewer research with style-first focus
- Question generation from 5 sources (JD, gaps, strengths, company, interviewer)
- Practice sessions with text/voice input
- 4-dimension scoring (coverage, structure, relevance, clarity)
- Transcript capture and learning extraction
- Profile confidence tracking from interview outcomes

**Analytics:**
- Funnel visualization with Sankey diagram support
- Response rates by company size, industry, role type, job board
- Skill gap aggregation from JD patterns
- Criteria evolution recommendations with preview and apply

**QA:**
- Vitest test framework with 2,276 tests
- Schema validation wired into data operations
- Phase gating prevents proceeding without passing tests

### Active (v2 Candidates)

**Automation:**
- Browser automation for LinkedIn with user session
- Connections visibility at target companies
- Automated job board monitoring with alerts

**Integration:**
- LinkedIn profile sync (auto-import profile data)
- Calendar integration (interview events, prep time blocking)
- Email tracking (know when recruiters open emails)

**Advanced:**
- Network mapping (visualize who you know at targets)
- Salary intelligence (market rate comparison)
- Predictive analytics (which applications likely to convert)

### Out of Scope

- Mobile app — web-first, local-first
- Multi-user collaboration — friends can only submit leads
- Cloud-hosted self-profile — security risk, keeping local
- Mass auto-apply — misaligned with "present best version" philosophy
- Bypassing bot detection — respect CAPTCHA and verification systems
- Automated application submission — user must click apply

## Context

**Codebase:**
- 48,890 lines of JavaScript across mcp-server/src/
- 87 MCP tools for Claude Code integration
- 2,276 tests (Vitest + Playwright E2E)
- Browser extension for Lever, Greenhouse, LinkedIn, Workday, Ashby

**Data:**
- Job data: mcp-server/data/jobs.json
- Profile data: mcp-server/data/profile/master-profile.json
- Research data: mcp-server/data/job-research/{jobId}/
- Analytics: mcp-server/data/analytics-snapshots.json

**Tech Stack:**
- Node.js, Vanilla JS (no frameworks)
- Zod for schema validation
- Puppeteer for PDF archiving
- Supabase for friend submissions
- Vitest + Playwright for testing

## Constraints

- **Local-first**: Self-profile and sensitive data never leave local machine
- **Security**: No credentials stored in code, atomic writes prevent corruption
- **Single-user**: System designed for one person, not multi-tenant
- **Lean stack**: Vanilla JS, Node.js, no unnecessary frameworks
- **Quality over speed**: Bug-free UX prioritized over feature velocity

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| QA layer as Phase 1 | Gates all subsequent phases, prevents shipping bugs | Good — caught 6 schema validation issues |
| Profile-centric architecture | Single source of truth for all outputs | Good — consistent tone across documents |
| Profile is primary, legacy fallback | Migration path while preserving existing data | Good — zero data loss |
| INTV-06 deferred | External calendar out of MCP scope | Pending — may add in v2 |
| 85% similarity threshold | Duplicate detection without false positives | Good — no over-flagging |
| 5 question sources | Comprehensive interview prep coverage | Good — varied question types |
| 4-dimension scoring | Specific, actionable feedback | Good — users know exactly what to improve |
| 90-day snapshot window | Balance storage vs trend analysis | Pending — TBD after usage |

---
*Last updated: 2026-02-03 after v1.0 milestone*
