# Phase 7: Application Generation - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate tailored application materials (resumes, cover letters, emails) informed by deep research on companies and hiring managers. Research is stored per job for reference in later communications. Does not include interview preparation (Phase 8) or automated sending (out of scope).

</domain>

<decisions>
## Implementation Decisions

### Research Depth
- **Company research:** Deep investigation — company size, industry, mission, funding stage, products, culture signals, recent news, challenges, competitors, leadership quotes, Glassdoor themes, financial signals. Expect 20+ min equivalent effort.
- **Hiring manager research:** Focus on style and connection — interview style signals (from reviews), communication patterns, LinkedIn activity, shared interests, mutual connections, talking points for rapport. Career background is secondary.
- **Sources:** Public web + premium signals — company website, news, LinkedIn, Glassdoor, Crunchbase, plus financial databases, job board patterns, GitHub/social presence where available.
- **Trigger:** On demand only — user explicitly requests research for a specific job. No auto-research at confirmation or before generation.

### Document Generation
- **Resume customization:** Keyword optimization — same structure preserved, reorder and emphasize sections based on JD keywords. Not full rewrites per job.
- **Cover letter approach:** Structure + generation — fixed structure (opener, body, close) but content generated fresh per job using profile + research + JD.
- **Email responses:** Multiple options — provide 2-3 tone variations, user picks and edits.
- **Research references:** User choice — offer versions with and without explicit company references in cover letters.

### Review Workflow
- **Automated checks:** Full review — grammar, spelling, ATS compatibility, JD keyword coverage, tone consistency, length limits, factual accuracy against profile.
- **Issue handling:** Flag + suggest — issues highlighted with suggested fixes, user approves each change.
- **Edit flow:** Section-by-section — review each section, approve or edit before moving to next.
- **Final gate:** Explicit approval required — user must explicitly approve before document is marked 'ready to use'.

### Research Persistence
- **Storage format:** Both structured JSON (parsed fields for programmatic access) and markdown summary (human-readable notes).
- **Refresh policy:** Never auto-refresh — only refresh when user explicitly requests it.
- **Surfacing:** Highlights only — key points (funding, culture) shown when discussing a job, full research available on request.
- **Company reuse:** Prompt for reuse — when researching a new job at a company with existing research, suggest reusing, user confirms.

### Claude's Discretion
- Specific research source priorities based on company type (startup vs enterprise)
- Markdown formatting and organization of research notes
- How to handle cases where research sources conflict
- Exact structure of cover letter sections

</decisions>

<specifics>
## Specific Ideas

- Research should be deep enough to inform genuine personalization, not just keyword stuffing
- Cover letters should feel human-written, not templated — structure provides consistency, content provides authenticity
- Section-by-section review helps user stay engaged with what's being generated
- Explicit approval gate prevents accidental use of unreviewed materials

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-application-generation*
*Context gathered: 2026-02-02*
