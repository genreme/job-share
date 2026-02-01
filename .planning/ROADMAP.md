# Roadmap: Job Search Operating System

## Overview

This roadmap transforms the existing Job Search Command Center into a comprehensive operating system for job searching. The journey begins with a QA layer that gates all subsequent work, followed by building the self-profile foundation that powers all AI features. With stable foundations, we implement the discovery funnel for proactive opportunity finding, then enhance application workflows with intelligence and generation capabilities. Interview preparation and learning follow, culminating in analytics that inform continuous evolution. The existing system remains fully functional throughout, with new capabilities building alongside.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: QA Layer Foundation** - Self-testing framework that validates each component before proceeding
- [x] **Phase 2: Self-Profile Schema** - Centralized professional identity data structure
- [x] **Phase 3: Self-Profile Integration** - Profile feeds into outputs and learns from interactions
- [x] **Phase 4: Discovery Core** - Scan, filter, research, and present job opportunities
- [ ] **Phase 5: Discovery Management** - Friend submissions, archiving, and job board curation
- [ ] **Phase 6: Application Intelligence** - Matching, contacts, and follow-up tracking
- [ ] **Phase 7: Application Generation** - Deep research and document generation
- [ ] **Phase 8: Interview Preparation** - Research, question generation, and practice
- [ ] **Phase 9: Interview Learning** - History persistence and profile evolution
- [ ] **Phase 10: Analytics & Insights** - Funnel visualization and criteria evolution

## Phase Details

### Phase 1: QA Layer Foundation
**Goal**: Establish a self-testing framework that validates components and gates progression to subsequent phases
**Depends on**: Nothing (first phase)
**Requirements**: QALY-01, QALY-02, QALY-03, QALY-04, QALY-05, QALY-06
**Success Criteria** (what must be TRUE):
  1. Running test command produces clear pass/fail results for all tested components
  2. Schema validation catches malformed data before it corrupts the system
  3. UI renders correctly in browser (visual tests confirm layout/styling)
  4. Workflow logic validates sensibly (e.g., status transitions follow allowed paths)
  5. Completing any phase requires passing QA before marking complete
**Plans**: 6 plans

Plans:
- [x] 01-01-PLAN.md - Install Vitest, create Zod schemas for job/workflow validation
- [x] 01-02-PLAN.md - Functional tests for MCP tools and dashboard rendering
- [x] 01-03-PLAN.md - GitHub Actions CI and phase-gating mechanism
- [x] 01-04-PLAN.md - Wire schema validation into application code (Gap Closure)
- [x] 01-05-PLAN.md - Add E2E tests for actual UI rendering (Gap Closure)
- [x] 01-06-PLAN.md - Adjust coverage threshold to realistic baseline (Gap Closure)

### Phase 2: Self-Profile Schema
**Goal**: Create the centralized data structure that stores all professional identity information
**Depends on**: Phase 1
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06, PROF-07
**Success Criteria** (what must be TRUE):
  1. master-profile.json exists with validated schema (Zod rejects invalid data)
  2. Profile contains experience entries with quantified achievements accessible via MCP
  3. Skills inventory distinguishes explicit skills from inferred skills
  4. Multiple professional summaries exist for different audiences (e.g., technical, leadership)
  5. Interview stories in STAR format are stored and retrievable
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md - Core profile schema, loader with atomic writes, history tracking
- [x] 02-02-PLAN.md - Experience entries with project-centric structure, skills with evidence linking
- [x] 02-03-PLAN.md - Summary blocks, STAR stories, target roles, communication preferences, MCP tools

### Phase 3: Self-Profile Integration
**Goal**: Profile data flows into all outputs and the system learns from natural interactions
**Depends on**: Phase 2
**Requirements**: PROF-08, PROF-08a, PROF-08b, PROF-09, PROF-10, PROF-11, PROF-12, PROF-13, PROF-14
**Success Criteria** (what must be TRUE):
  1. Weekly cleanup routine runs and surfaces duplicate/stale data for review
  2. Profile gaps are surfaced with recommendations, never auto-filled
  3. Resume generation pulls from profile data (not separate source files)
  4. Cover letter generation uses profile tone and achievements
  5. Interview prep references profile stories and target talking points
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md - Cleanup services (duplicate/staleness/gap detection) with MCP tools
- [x] 03-02-PLAN.md - Profile-driven document generation (resume, cover letter, interview prep)
- [x] 03-03-PLAN.md - Conversation-based learning with confirmation queue

### Phase 4: Discovery Core
**Goal**: Discover and evaluate job opportunities through a structured funnel
**Depends on**: Phase 3
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-06, DISC-06a, DISC-06b
**Success Criteria** (what must be TRUE):
  1. Quick scan ingests jobs from configured sources (even if initially manual)
  2. Filter stage reduces hundreds of jobs to top candidates with fit scores
  3. Deep research verifies job activity status and enriches with company data
  4. Shortlist displays jobs with reasoning explaining why each was included
  5. User can confirm add to dashboard or defer with notes
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md - Fix JobStatusSchema for inbox, create profile-based fit scoring service
- [x] 04-02-PLAN.md - Discovery MCP tools (research_job_url, get_inbox, confirm_job, defer_job)
- [x] 04-03-PLAN.md - Integration tests and end-to-end workflow verification

### Phase 5: Discovery Management
**Goal**: Extend discovery with friend submissions, archiving, and job board curation
**Depends on**: Phase 4
**Requirements**: DISC-07, DISC-07a, DISC-07b, DISC-08, DISC-09, DISC-10, DISC-11, DISC-12, DISC-13, DISC-14
**Success Criteria** (what must be TRUE):
  1. Friend submissions flow through research process with context preserved
  2. Job descriptions are archived in accessible format (PDF) for pattern analysis
  3. Periodic verification detects stale/closed jobs and refreshes fit scores
  4. Fit criteria are configurable and can evolve based on outcomes
  5. Job board registry exists with quality ratings that influence scan priority
**Plans**: TBD

Plans:
- [ ] 05-01: Friend submission workflow with context
- [ ] 05-02: Job archiving and status verification
- [ ] 05-03: Job board registry and quality management

### Phase 6: Application Intelligence
**Goal**: Enhance applications with matching, contact tracking, and follow-up systems
**Depends on**: Phase 5
**Requirements**: APPL-01, APPL-02, APPL-03, APPL-04, APPL-05, APPL-06, APPL-07
**Success Criteria** (what must be TRUE):
  1. Resume-JD matching score shows before applying with specific gap analysis
  2. Contacts (recruiters, hiring managers) are tracked per job with LinkedIn URLs
  3. Follow-up reminders trigger based on days elapsed and application stage
  4. Smart follow-up suggestions adapt based on time and stage context
  5. User can add notes, connections, and status updates to any job entry
**Plans**: TBD

Plans:
- [ ] 06-01: Resume-JD matching and gap analysis
- [ ] 06-02: Contact tracking system
- [ ] 06-03: Follow-up reminders and suggestions

### Phase 7: Application Generation
**Goal**: Generate tailored application materials informed by deep research
**Depends on**: Phase 6
**Requirements**: APPL-08, APPL-09, APPL-10, APPL-11, APPL-12, APPL-13, APPL-14
**Success Criteria** (what must be TRUE):
  1. Company deep research produces culture, news, funding, and challenges summary
  2. Hiring manager research surfaces background, interests, and interview style
  3. Custom resume generation uses profile + job research + playbook templates
  4. Generated materials pass format and grammar review before use
  5. Research outputs persist per job for reference in later communications
**Plans**: TBD

Plans:
- [ ] 07-01: Company deep research workflow
- [ ] 07-02: Resume and cover letter generation pipeline
- [ ] 07-03: Email assistance and research persistence

### Phase 8: Interview Preparation
**Goal**: Prepare for interviews with research, generated questions, and practice
**Depends on**: Phase 7
**Requirements**: INTV-01, INTV-02, INTV-03, INTV-04, INTV-05, INTV-06
**Success Criteria** (what must be TRUE):
  1. Interviewer research produces background and interview style signals
  2. Interview questions generated from JD + profile + company/HM research
  3. Practice mode allows recording or writing answers
  4. Self-scoring compares answers against profile stories and target points
  5. Role-specific positioning customizes foundation positioning per opportunity
**Plans**: TBD

Plans:
- [ ] 08-01: Interviewer research workflow
- [ ] 08-02: Question generation and practice mode
- [ ] 08-03: Self-scoring and positioning

### Phase 9: Interview Learning
**Goal**: Capture interview learnings and feed them back into the system
**Depends on**: Phase 8
**Requirements**: INTV-07, INTV-08, INTV-09, INTV-10
**Success Criteria** (what must be TRUE):
  1. Interview prep outputs remember conversation history per job
  2. Practice session transcripts/notes are added to self-profile database
  3. Real interview transcripts/notes are captured and stored
  4. Interview learnings inform profile evolution (what worked, what did not)
**Plans**: TBD

Plans:
- [ ] 09-01: Conversation history persistence
- [ ] 09-02: Transcript capture and profile integration

### Phase 10: Analytics & Insights
**Goal**: Visualize patterns and evolve strategy based on outcomes
**Depends on**: Phase 9
**Requirements**: ANLT-01, ANLT-02, ANLT-03, ANLT-04, ANLT-05
**Success Criteria** (what must be TRUE):
  1. Analytics dashboard visualizes application to interview to offer funnel
  2. Response rates shown by company size, industry, and application method
  3. Skill gaps identified from accumulated JD patterns
  4. Criteria evolution recommendations generated based on outcomes
  5. Time-in-stage metrics identify bottlenecks in the process
**Plans**: TBD

Plans:
- [ ] 10-01: Funnel visualization dashboard
- [ ] 10-02: Pattern analysis and recommendations

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. QA Layer Foundation | 6/6 | Complete | 2026-01-30 |
| 2. Self-Profile Schema | 3/3 | Complete | 2026-01-30 |
| 3. Self-Profile Integration | 3/3 | Complete | 2026-01-30 |
| 4. Discovery Core | 3/3 | Complete | 2026-01-31 |
| 5. Discovery Management | 0/3 | Ready | - |
| 6. Application Intelligence | 0/3 | Not started | - |
| 7. Application Generation | 0/3 | Not started | - |
| 8. Interview Preparation | 0/3 | Not started | - |
| 9. Interview Learning | 0/2 | Not started | - |
| 10. Analytics & Insights | 0/2 | Not started | - |

---
*Roadmap created: 2026-01-29*
*Total phases: 10 | Total plans: 31 | Requirements covered: 69/69*
