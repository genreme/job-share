# Phase 8: Interview Preparation - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Prepare for interviews with research on interviewers, generated questions based on JD + profile + research, practice mode for answering, and self-scoring against profile stories. This phase focuses on preparation tooling — actual interview transcript capture and learning belongs in Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Interviewer research depth
- Comprehensive search: LinkedIn, company bio, news mentions, conference talks, blog posts
- Style inference: Role-based heuristics as baseline, content analysis from their writing/talks to refine
- Key outputs: Both talking points (shared interests, mutual connections) AND interview style signals (question types, depth expectations)

### Question generation approach
- Full interview simulation: Behavioral, technical, system design, culture fit questions
- Personalization: Balanced mix — some gap questions, some strength opportunities, all JD-relevant
- Difficulty: Label questions by difficulty tags, user picks their order
- Story linking: Each question suggests relevant STAR stories from profile AND key talking points to hit

### Practice mode experience
- Answer input: Both text and voice recording available — user chooses per session
- Timing: No timer — focus on content quality over speed
- Feedback timing: User chooses immediate (per question) or batched (end of session)
- Persistence: All practice sessions saved automatically per job for later review

### Self-scoring mechanics
- Evaluation criteria: Comprehensive — story coverage + STAR structure + relevance to question + clarity
- Score format: Numeric score (out of 100) PLUS qualitative breakdown of strengths/improvements
- Improvement suggestions: Specific rewrites showing how the answer could be improved with concrete examples
- Progress tracking: Overall trend dashboard showing readiness across all practice

### Claude's Discretion
- Interviewer research scope: Per-person vs per-interview-loop (Claude decides based on implementation)
- Voice recording implementation details
- Exact scoring algorithm and weighting
- Dashboard visualization approach for progress tracking

</decisions>

<specifics>
## Specific Ideas

- Interviewer research should feel like having an insider brief before meeting someone
- Questions should map to stories I already have, not ask me to invent new ones
- Practice should build confidence, not stress — hence no timer
- Specific rewrites are more useful than vague "be more specific" feedback

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-interview-preparation*
*Context gathered: 2026-02-02*
