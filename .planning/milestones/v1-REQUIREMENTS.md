# Requirements Archive: v1 Job Search Operating System MVP

**Archived:** 2026-02-03
**Status:** SHIPPED

This is the archived requirements specification for v1.
For current requirements, see `.planning/REQUIREMENTS.md` (created for next milestone).

---

# Requirements: Job Search Operating System

**Defined:** 2026-01-29
**Core Value:** Present the best version of myself to the right opportunities, informed by a comprehensive understanding of who I am professionally

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Self-Profile

- [x] **PROF-01**: Centralized master-profile.json stores all professional identity data
- [x] **PROF-02**: Profile includes experience entries with quantified achievements
- [x] **PROF-03**: Profile includes skills inventory (explicit + inferred from experience)
- [x] **PROF-04**: Profile includes multiple professional summaries for different audiences
- [x] **PROF-05**: Profile includes interview stories in STAR format
- [x] **PROF-06**: Profile includes target role criteria and preferences
- [x] **PROF-07**: Profile includes communication style and tone preferences
- [x] **PROF-08**: Weekly profile cleanup routine consolidates and deduplicates data
- [x] **PROF-08a**: Profile gaps are surfaced for user review, never auto-filled
- [x] **PROF-08b**: Gap recommendations include why it matters and suggested ways to address
- [x] **PROF-09**: Profile data feeds into resume generation
- [x] **PROF-10**: Profile data feeds into cover letter generation
- [x] **PROF-11**: Profile data feeds into interview prep
- [x] **PROF-12**: Conversation-based profile learning extracts insights from natural chat
- [x] **PROF-13**: Extracted insights surfaced for user confirmation before adding to profile
- [x] **PROF-14**: Learning runs passively during normal system interactions

### Discovery

- [x] **DISC-01**: Discovery funnel scans configured job boards (quick scan stage)
- [x] **DISC-02**: Quick scan filters hundreds of jobs to top candidates (filter stage)
- [x] **DISC-03**: Deep research on shortlisted jobs verifies activity status and fit (research stage)
- [x] **DISC-04**: Shortlist presented with reasoning for user review (present stage)
- [x] **DISC-05**: User can confirm add to dashboard or defer
- [x] **DISC-06**: User can manually submit jobs via URL for deep research
- [x] **DISC-06a**: Manual submissions go through full research -> score -> reasoning flow
- [x] **DISC-06b**: User confirms add to dashboard or defer with notes
- [x] **DISC-07**: Friend job submission flows through same research process
- [x] **DISC-07a**: Friends can include context (connections, benefits, why they thought of you)
- [x] **DISC-07b**: Friend context displayed alongside research findings
- [x] **DISC-08**: Job descriptions archived in PDF format for pattern analysis
- [x] **DISC-09**: Periodic job status verification (still active, fit score refresh)
- [x] **DISC-10**: Fit criteria are configurable and evolve based on outcomes
- [x] **DISC-11**: Job board registry maintains list of sources with quality ratings
- [x] **DISC-12**: New job boards can be tested and quality-assessed
- [x] **DISC-13**: High-quality boards prioritized in scans
- [x] **DISC-14**: Low-quality boards can be blacklisted after user confirmation

### Application

- [x] **APPL-01**: Resume-JD matching score shows how well resume matches before applying
- [x] **APPL-02**: Matching identifies gaps and keywords to add
- [x] **APPL-03**: Contact tracking per job (recruiter, hiring manager, connections)
- [x] **APPL-04**: Contact entries include name, title, LinkedIn URL, last interaction
- [x] **APPL-05**: Follow-up reminders based on date and status
- [x] **APPL-06**: Smart follow-up suggestions based on time elapsed and stage
- [x] **APPL-07**: User can add updates to job entries (notes, connections, status changes)
- [x] **APPL-08**: Deep research workflow for company (culture, recent news, funding, challenges)
- [x] **APPL-09**: Deep research workflow for hiring manager (background, interests, interview style)
- [x] **APPL-10**: Custom resume generation using profile + job research + playbook
- [x] **APPL-11**: Custom cover letter generation using profile + job research + playbook
- [x] **APPL-12**: Generated materials reviewed for format, grammar, match score before use
- [x] **APPL-13**: Email response assistance references job research + hiring manager intel + profile
- [x] **APPL-14**: Playbook research outputs stored per job for reference in later communications

### Interview

- [x] **INTV-01**: Interviewer research workflow (background, interests, interview style signals)
- [x] **INTV-02**: Interview questions generated from JD + profile + company/HM research
- [x] **INTV-03**: Practice mode allows recording/writing answers
- [x] **INTV-04**: Self-scoring against profile stories and target talking points
- [x] **INTV-05**: Gap identification ("You mentioned X but didn't quantify the result")
- [x] **INTV-06**: DEFERRED — External calendar integration out of MCP scope (moved to v2)
- [x] **INTV-07**: Interview prep outputs remember conversation history per job
- [x] **INTV-08**: Practice session transcripts/notes added to self-profile database
- [x] **INTV-09**: Real interview transcripts/notes added to self-profile database
- [x] **INTV-10**: Interview learnings inform profile evolution (what worked, what didn't)

### Analytics

- [x] **ANLT-01**: Analytics dashboard visualizes application -> interview -> offer funnel
- [x] **ANLT-02**: Response rates shown by company size, industry, application method
- [x] **ANLT-03**: Skill gap identification from accumulated JD patterns
- [x] **ANLT-04**: Criteria evolution recommendations based on outcomes
- [x] **ANLT-05**: Time-in-stage metrics identify bottlenecks

### QA Layer

- [x] **QALY-01**: Self-testing framework validates each component before proceeding
- [x] **QALY-02**: Functional tests verify core operations work
- [x] **QALY-03**: Visual tests verify UI renders correctly
- [x] **QALY-04**: Logical tests verify workflow flows make sense
- [x] **QALY-05**: QA runs automatically on each phase completion
- [x] **QALY-06**: QA failures block proceeding to next phase

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| QALY-01 | Phase 1 | Complete |
| QALY-02 | Phase 1 | Complete |
| QALY-03 | Phase 1 | Complete |
| QALY-04 | Phase 1 | Complete |
| QALY-05 | Phase 1 | Complete |
| QALY-06 | Phase 1 | Complete |
| PROF-01 | Phase 2 | Complete |
| PROF-02 | Phase 2 | Complete |
| PROF-03 | Phase 2 | Complete |
| PROF-04 | Phase 2 | Complete |
| PROF-05 | Phase 2 | Complete |
| PROF-06 | Phase 2 | Complete |
| PROF-07 | Phase 2 | Complete |
| PROF-08 | Phase 3 | Complete |
| PROF-08a | Phase 3 | Complete |
| PROF-08b | Phase 3 | Complete |
| PROF-09 | Phase 3 | Complete |
| PROF-10 | Phase 3 | Complete |
| PROF-11 | Phase 3 | Complete |
| PROF-12 | Phase 3 | Complete |
| PROF-13 | Phase 3 | Complete |
| PROF-14 | Phase 3 | Complete |
| DISC-01 | Phase 4 | Complete |
| DISC-02 | Phase 4 | Complete |
| DISC-03 | Phase 4 | Complete |
| DISC-04 | Phase 4 | Complete |
| DISC-05 | Phase 4 | Complete |
| DISC-06 | Phase 4 | Complete |
| DISC-06a | Phase 4 | Complete |
| DISC-06b | Phase 4 | Complete |
| DISC-07 | Phase 5 | Complete |
| DISC-07a | Phase 5 | Complete |
| DISC-07b | Phase 5 | Complete |
| DISC-08 | Phase 5 | Complete |
| DISC-09 | Phase 5 | Complete |
| DISC-10 | Phase 5 | Complete |
| DISC-11 | Phase 5 | Complete |
| DISC-12 | Phase 5 | Complete |
| DISC-13 | Phase 5 | Complete |
| DISC-14 | Phase 5 | Complete |
| APPL-01 | Phase 6 | Complete |
| APPL-02 | Phase 6 | Complete |
| APPL-03 | Phase 6 | Complete |
| APPL-04 | Phase 6 | Complete |
| APPL-05 | Phase 6 | Complete |
| APPL-06 | Phase 6 | Complete |
| APPL-07 | Phase 6 | Complete |
| APPL-08 | Phase 7 | Complete |
| APPL-09 | Phase 7 | Complete |
| APPL-10 | Phase 7 | Complete |
| APPL-11 | Phase 7 | Complete |
| APPL-12 | Phase 7 | Complete |
| APPL-13 | Phase 7 | Complete |
| APPL-14 | Phase 7 | Complete |
| INTV-01 | Phase 8 | Complete |
| INTV-02 | Phase 8 | Complete |
| INTV-03 | Phase 8 | Complete |
| INTV-04 | Phase 8 | Complete |
| INTV-05 | Phase 8 | Complete |
| INTV-06 | Phase 8 | Deferred → v2 |
| INTV-07 | Phase 9 | Complete |
| INTV-08 | Phase 9 | Complete |
| INTV-09 | Phase 9 | Complete |
| INTV-10 | Phase 9 | Complete |
| ANLT-01 | Phase 10 | Complete |
| ANLT-02 | Phase 10 | Complete |
| ANLT-03 | Phase 10 | Complete |
| ANLT-04 | Phase 10 | Complete |
| ANLT-05 | Phase 10 | Complete |

---

## Milestone Summary

**Shipped:** 68 of 69 v1 requirements
**Deferred:** 1 (INTV-06 — external calendar integration)
**Dropped:** 0

---
*Archived: 2026-02-03 as part of v1 milestone completion*
