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
- [ ] **PROF-08**: Weekly profile cleanup routine consolidates and deduplicates data
- [ ] **PROF-08a**: Profile gaps are surfaced for user review, never auto-filled
- [ ] **PROF-08b**: Gap recommendations include why it matters and suggested ways to address
- [ ] **PROF-09**: Profile data feeds into resume generation
- [ ] **PROF-10**: Profile data feeds into cover letter generation
- [ ] **PROF-11**: Profile data feeds into interview prep
- [ ] **PROF-12**: Conversation-based profile learning extracts insights from natural chat
- [ ] **PROF-13**: Extracted insights surfaced for user confirmation before adding to profile
- [ ] **PROF-14**: Learning runs passively during normal system interactions

### Discovery

- [ ] **DISC-01**: Discovery funnel scans configured job boards (quick scan stage)
- [ ] **DISC-02**: Quick scan filters hundreds of jobs to top candidates (filter stage)
- [ ] **DISC-03**: Deep research on shortlisted jobs verifies activity status and fit (research stage)
- [ ] **DISC-04**: Shortlist presented with reasoning for user review (present stage)
- [ ] **DISC-05**: User can confirm add to dashboard or defer
- [ ] **DISC-06**: User can manually submit jobs via URL for deep research
- [ ] **DISC-06a**: Manual submissions go through full research -> score -> reasoning flow
- [ ] **DISC-06b**: User confirms add to dashboard or defer with notes
- [ ] **DISC-07**: Friend job submission flows through same research process
- [ ] **DISC-07a**: Friends can include context (connections, benefits, why they thought of you)
- [ ] **DISC-07b**: Friend context displayed alongside research findings
- [ ] **DISC-08**: Job descriptions archived in PDF format for pattern analysis
- [ ] **DISC-09**: Periodic job status verification (still active, fit score refresh)
- [ ] **DISC-10**: Fit criteria are configurable and evolve based on outcomes
- [ ] **DISC-11**: Job board registry maintains list of sources with quality ratings
- [ ] **DISC-12**: New job boards can be tested and quality-assessed
- [ ] **DISC-13**: High-quality boards prioritized in scans
- [ ] **DISC-14**: Low-quality boards can be blacklisted after user confirmation

### Application

- [ ] **APPL-01**: Resume-JD matching score shows how well resume matches before applying
- [ ] **APPL-02**: Matching identifies gaps and keywords to add
- [ ] **APPL-03**: Contact tracking per job (recruiter, hiring manager, connections)
- [ ] **APPL-04**: Contact entries include name, title, LinkedIn URL, last interaction
- [ ] **APPL-05**: Follow-up reminders based on date and status
- [ ] **APPL-06**: Smart follow-up suggestions based on time elapsed and stage
- [ ] **APPL-07**: User can add updates to job entries (notes, connections, status changes)
- [ ] **APPL-08**: Deep research workflow for company (culture, recent news, funding, challenges)
- [ ] **APPL-09**: Deep research workflow for hiring manager (background, interests, interview style)
- [ ] **APPL-10**: Custom resume generation using profile + job research + playbook
- [ ] **APPL-11**: Custom cover letter generation using profile + job research + playbook
- [ ] **APPL-12**: Generated materials reviewed for format, grammar, match score before use
- [ ] **APPL-13**: Email response assistance references job research + hiring manager intel + profile
- [ ] **APPL-14**: Playbook research outputs stored per job for reference in later communications

### Interview

- [ ] **INTV-01**: Interviewer research workflow (background, interests, interview style signals)
- [ ] **INTV-02**: Interview questions generated from JD + profile + company/HM research
- [ ] **INTV-03**: Practice mode allows recording/writing answers
- [ ] **INTV-04**: Self-scoring against profile stories and target talking points
- [ ] **INTV-05**: Gap identification ("You mentioned X but didn't quantify the result")
- [ ] **INTV-06**: Role-specific positioning customizes foundation positioning per opportunity
- [ ] **INTV-07**: Interview prep outputs remember conversation history per job
- [ ] **INTV-08**: Practice session transcripts/notes added to self-profile database
- [ ] **INTV-09**: Real interview transcripts/notes added to self-profile database
- [ ] **INTV-10**: Interview learnings inform profile evolution (what worked, what didn't)

### Analytics

- [ ] **ANLT-01**: Analytics dashboard visualizes application -> interview -> offer funnel
- [ ] **ANLT-02**: Response rates shown by company size, industry, application method
- [ ] **ANLT-03**: Skill gap identification from accumulated JD patterns
- [ ] **ANLT-04**: Criteria evolution recommendations based on outcomes
- [ ] **ANLT-05**: Time-in-stage metrics identify bottlenecks

### QA Layer

- [x] **QALY-01**: Self-testing framework validates each component before proceeding
- [x] **QALY-02**: Functional tests verify core operations work
- [x] **QALY-03**: Visual tests verify UI renders correctly
- [x] **QALY-04**: Logical tests verify workflow flows make sense
- [x] **QALY-05**: QA runs automatically on each phase completion
- [x] **QALY-06**: QA failures block proceeding to next phase

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Automation

- **AUTO-01**: Browser automation for LinkedIn with user session
- **AUTO-02**: Connections visibility at target companies
- **AUTO-03**: Automated job board monitoring with alerts

### Integration

- **INTG-01**: LinkedIn profile sync (auto-import profile data)
- **INTG-02**: Calendar integration (interview events, prep time blocking)
- **INTG-03**: Email tracking (know when recruiters open emails)

### Advanced

- **ADVN-01**: Network mapping (visualize who you know at targets)
- **ADVN-02**: Application playbook templates (codified workflows)
- **ADVN-03**: Salary intelligence (market rate comparison)
- **ADVN-04**: Predictive analytics (which applications likely to convert)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Mass auto-apply | Recruiters flag these; fundamentally misaligned with "present best version" philosophy |
| White-font keyword stuffing | Integrity concern; ATS systems detect; damages trust |
| Social media aggregation | Privacy concerns; scope creep; mixing personal/professional |
| Gamification / Streaks | Job search is stressful; adding pressure increases anxiety |
| Aggressive notifications | Push fatigue; job search already anxiety-inducing |
| Complex pricing tiers | Single-user system; not monetizing |
| Multi-user collaboration | Friends can submit leads only; full collab adds complexity |
| Cloud-hosted profile | Security risk; keeping local-first |
| Mobile app | Web-first; responsive design sufficient initially |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| QALY-01 | Phase 1 | Complete |
| QALY-02 | Phase 1 | Complete |
| QALY-03 | Phase 1 | Complete |
| QALY-04 | Phase 1 | Complete |
| QALY-05 | Phase 1 | Complete |
| QALY-06 | Phase 1 | Complete |
| PROF-01 | Phase 2 | Pending |
| PROF-02 | Phase 2 | Pending |
| PROF-03 | Phase 2 | Pending |
| PROF-04 | Phase 2 | Pending |
| PROF-05 | Phase 2 | Pending |
| PROF-06 | Phase 2 | Pending |
| PROF-07 | Phase 2 | Pending |
| PROF-08 | Phase 3 | Pending |
| PROF-08a | Phase 3 | Pending |
| PROF-08b | Phase 3 | Pending |
| PROF-09 | Phase 3 | Pending |
| PROF-10 | Phase 3 | Pending |
| PROF-11 | Phase 3 | Pending |
| PROF-12 | Phase 3 | Pending |
| PROF-13 | Phase 3 | Pending |
| PROF-14 | Phase 3 | Pending |
| DISC-01 | Phase 4 | Pending |
| DISC-02 | Phase 4 | Pending |
| DISC-03 | Phase 4 | Pending |
| DISC-04 | Phase 4 | Pending |
| DISC-05 | Phase 4 | Pending |
| DISC-06 | Phase 4 | Pending |
| DISC-06a | Phase 4 | Pending |
| DISC-06b | Phase 4 | Pending |
| DISC-07 | Phase 5 | Pending |
| DISC-07a | Phase 5 | Pending |
| DISC-07b | Phase 5 | Pending |
| DISC-08 | Phase 5 | Pending |
| DISC-09 | Phase 5 | Pending |
| DISC-10 | Phase 5 | Pending |
| DISC-11 | Phase 5 | Pending |
| DISC-12 | Phase 5 | Pending |
| DISC-13 | Phase 5 | Pending |
| DISC-14 | Phase 5 | Pending |
| APPL-01 | Phase 6 | Pending |
| APPL-02 | Phase 6 | Pending |
| APPL-03 | Phase 6 | Pending |
| APPL-04 | Phase 6 | Pending |
| APPL-05 | Phase 6 | Pending |
| APPL-06 | Phase 6 | Pending |
| APPL-07 | Phase 6 | Pending |
| APPL-08 | Phase 7 | Pending |
| APPL-09 | Phase 7 | Pending |
| APPL-10 | Phase 7 | Pending |
| APPL-11 | Phase 7 | Pending |
| APPL-12 | Phase 7 | Pending |
| APPL-13 | Phase 7 | Pending |
| APPL-14 | Phase 7 | Pending |
| INTV-01 | Phase 8 | Pending |
| INTV-02 | Phase 8 | Pending |
| INTV-03 | Phase 8 | Pending |
| INTV-04 | Phase 8 | Pending |
| INTV-05 | Phase 8 | Pending |
| INTV-06 | Phase 8 | Pending |
| INTV-07 | Phase 9 | Pending |
| INTV-08 | Phase 9 | Pending |
| INTV-09 | Phase 9 | Pending |
| INTV-10 | Phase 9 | Pending |
| ANLT-01 | Phase 10 | Pending |
| ANLT-02 | Phase 10 | Pending |
| ANLT-03 | Phase 10 | Pending |
| ANLT-04 | Phase 10 | Pending |
| ANLT-05 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 69 total
- Mapped to phases: 69
- Unmapped: 0

---
*Requirements defined: 2026-01-29*
*Last updated: 2026-01-29 after roadmap creation*
