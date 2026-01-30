# Phase 3: Self-Profile Integration - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Profile data flows into all outputs (resume, cover letter, interview prep) and the system learns from natural interactions. The profile schema exists (Phase 2); this phase connects it to document generation and enables learning from conversations.

</domain>

<decisions>
## Implementation Decisions

### Weekly cleanup routine
- Runs Saturday late night (scheduled)
- Findings presented in dedicated dashboard section
- Staleness triggered by BOTH age (time since update) AND relevance (not used in documents)
- Claude's discretion on duplicate detection threshold (exact vs fuzzy matching)

### Gap detection & recommendations
- Gap = missing required fields OR thin evidence (skills/achievements without supporting stories/metrics)
- Recommendations shown contextually — when relevant to current task (e.g., "missing leadership story" when applying to leadership role)
- User chooses each time whether to fill gap now or defer to backlog
- Gaps warn but don't block document generation — show prominently, ask confirmation, then proceed

### Document generation flow
- Triggered by explicit command only (no automatic triggers on status change)
- Quick summary of which profile sections will be used before generating
- Data sources: profile + current conversation + job context (previous conversations scraped to profile, job context in current chat)
- Output location: flat folder with descriptive naming (e.g., resume-acme-pm-2026-01.pdf)

### Conversation-based learning
- Claude proactively detects profile-relevant info and asks before saving
- Detect ALL professional info: skills, preferences, tone, achievements, stories
- Also observe: types of products worked on, conversations with Claude, growth efforts
- Claude's discretion on confirmation timing (inline for important, batched for minor)
- When overlap with existing data detected: ask whether to update, add as variant, or skip

### Claude's Discretion
- Duplicate detection similarity threshold
- Confirmation timing (inline vs batched)
- Exact staleness thresholds (age days, usage recency)

</decisions>

<specifics>
## Specific Ideas

- "Observe type of products I work on and convos I have with Claude to add to the profile. There's a lot of work and growth effort being done here."
- Learning should capture not just explicit achievements but patterns of work and growth over time

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-self-profile-integration*
*Context gathered: 2026-01-30*
