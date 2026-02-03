# Phase 9: Interview Learning - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Capture interview experiences (practice and real) and feed learnings back into the profile for continuous improvement. Users paste transcripts from external transcription services. System extracts learnings and suggests profile updates.

</domain>

<decisions>
## Implementation Decisions

### Transcript Capture
- User pastes text transcripts (from external transcription services, not audio processing)
- Available anytime, but system reminds if >24h since interview with no notes captured
- Metadata captured: date, interviewer name, interview type (phone/video/onsite), confidence level, overall vibe (went well / neutral / rough)
- Store both raw transcript AND extracted highlights

### Learning Extraction
- Extract both "what worked" and "what didn't" plus recurring patterns across interviews
- Each learning tagged with BOTH topic (technical, behavioral, company-specific, compensation) AND outcome (worked, needs-work, neutral)
- Claude proposes learnings for user review (user accepts/rejects)
- Learnings link to profile items via suggestion (user confirms before link is made)

### Profile Feedback Loop
- Learnings can affect: STAR stories, skills, and professional summaries
- Claude decides when to present updates (batch after interview vs aggregate during weekly review)
- Conflicts between learning and existing profile content: flag for user review
- Track visible confidence scores — each story/skill shows how often it's worked in interviews

### History Organization
- Primary organization: by job (all interview rounds grouped)
- Secondary view: chronological timeline across all jobs
- Practice sessions stored alongside real interviews in same storage, tagged differently
- Full-text search across all transcript content
- Retain history forever (no auto-archiving)

### Claude's Discretion
- Exact reminder timing/phrasing for capture prompts
- How to phrase learning proposals
- When to batch vs aggregate profile update suggestions
- Internal data structure for search indexing

</decisions>

<specifics>
## Specific Ideas

- External transcription workflow: user records interview, uses service like Otter.ai or similar, pastes resulting text into Claude
- Confidence scores visible to help user see which stories/skills are "battle-tested"
- Pattern detection across interviews (e.g., "This question comes up a lot")

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-interview-learning*
*Context gathered: 2026-02-02*
