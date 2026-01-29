# Job Search Operating System

## What This Is

A personal job search operating system that integrates self-presentation, opportunity discovery, application customization, and interview preparation into a unified workflow. Built on the existing Job Search Command Center, it adds a centralized self-profile that informs all outputs, an automated discovery funnel that surfaces high-fit opportunities, and integration with a structured application playbook. The system learns from interactions and evolves its criteria based on application outcomes.

## Core Value

Present the best version of myself to the right opportunities, informed by a comprehensive understanding of who I am professionally — not just what fits on a resume.

## Requirements

### Validated

<!-- Shipped and confirmed valuable — existing functionality from Job Search Command Center -->

- [x] Capture jobs from LinkedIn, Lever, Greenhouse, Workday, Ashby via browser extension
- [x] Dashboard displays jobs with fit scores, status tracking, filtering
- [x] Friend job submission via Supabase inbox
- [x] MCP tools expose job data to Claude Code
- [x] Resume/cover letter generation from master data
- [x] Job status management (apply-now, maybe, probably-not, applied, archived)
- [x] Duplicate detection across captured jobs
- [x] Atomic file operations preventing data corruption
- [x] Check All Status button for bulk re-analysis

### Active

<!-- Current scope. Building toward these. -->

**Self-Profile Layer:**
- [ ] Centralized self-profile data structure (master-profile.json)
- [ ] Initial profile extraction from resume, chats, LinkedIn
- [ ] Conversation-based profile learning (extracts insights from natural chat)
- [ ] Weekly profile cleanup/consolidation routine
- [ ] Profile informs application tone, emphasis, and gaps to address

**Discovery Funnel:**
- [ ] Quick scan across configured job boards (hundreds of postings)
- [ ] Filter to top candidates based on fit criteria + breakthrough likelihood
- [ ] Deep research on shortlisted jobs (company, role, connections, activity status)
- [ ] Present shortlist with reasoning for review
- [ ] User confirms add to dashboard or defer
- [ ] Archive job descriptions (PDF/HTML/TXT) for pattern analysis
- [ ] Periodic job status verification (still active, fit score refresh)
- [ ] Browser automation for gated sites (LinkedIn with user session)

**Application Engine:**
- [ ] Playbook integration (Assessment → Research → Outreach → Resume → Cover Letter)
- [ ] Profile-fed prompt generation (auto-populate from self-profile + job data)
- [ ] Interview prep generation informed by self-profile tone/philosophy

**Self-Testing/QA:**
- [ ] Automated validation layer for each component
- [ ] Functional tests (does it work?)
- [ ] Visual tests (does it render correctly?)
- [ ] Logical tests (does the flow make sense?)
- [ ] Runs on each phase completion before proceeding

**Analytics:**
- [ ] Visualize trends (application → interview → offer funnel)
- [ ] Evolve fit criteria based on outcomes
- [ ] Identify skill gaps from job description patterns
- [ ] Inform self-profile evolution

### Out of Scope

- Mobile app — web-first, local-first
- Multi-user collaboration — friends can only submit leads, not view/edit
- Cloud-hosted self-profile — security risk, keeping local
- OAuth/social login — unnecessary complexity for single-user system
- Real-time sync — polling/manual refresh sufficient
- Bypassing bot detection — respect CAPTCHA and verification systems
- Automated application submission — user must click apply

## Context

**Existing System:**
Job Search Command Center is a working prototype with dashboard, browser extension, and MCP integration. The codebase has been mapped (.planning/codebase/). Current job data lives in mcp-server/data/jobs.json. Resume data at /Users/genre/Claude/resume/.

**Application Playbook:**
Job Application Playbook v3 exists as an HTML reference with structured prompts for the full application lifecycle. Currently copy-paste workflow into Claude Chat. Goal is to integrate this flow with automated data population.

**Scattered Self Data:**
Professional identity currently fragmented across ChatGPT history, Gemini, Claude chats, multiple resume versions, LinkedIn, and personal notes. This fragmentation means every new conversation starts partially blind.

**Browser Automation:**
User comfortable with Claude using logged-in browser session for gated sites. Safari primary, Chrome available. Claude in Chrome MCP available for browser control.

**Timeline:**
Actively job searching now. Current system must remain functional during evolution. New development builds alongside, sharing job database for smooth transition.

## Constraints

- **Local-first**: Self-profile and sensitive data never leave local machine
- **Security**: No credentials stored in code, atomic writes prevent corruption, respect rate limits
- **Single-user**: System designed for one person, not multi-tenant
- **Safari + Chrome**: Browser automation may need Chrome for extension/MCP compatibility
- **Lean stack**: Vanilla JS, Node.js, no unnecessary frameworks
- **Quality over speed**: Bug-free UX prioritized over feature velocity

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Evolve existing system vs rebuild | Active job search requires working tools; existing data structures solid | — Pending |
| Self-testing framework as Phase 1 | Validates each subsequent phase before proceeding | — Pending |
| Local-only self-profile | Security/corruption risk of cloud storage | — Pending |
| Browser automation for LinkedIn | Needed for connections visibility, user consented | — Pending |
| Playbook integration via data population | Automates manual copy-paste while preserving proven prompts | — Pending |

---
*Last updated: 2026-01-29 after initialization*
