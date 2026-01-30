# Phase 2: Self-Profile Schema - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Create the centralized data structure that stores all professional identity information. The schema defines how experience, skills, summaries, and stories are structured, validated, and accessed via MCP. This phase builds the data foundation — integration with outputs (resume generation, interview prep) is Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Schema Structure
- File organization: Claude's discretion (single vs modular based on technical tradeoffs)
- Validation mode: Advisory — warn about issues but allow saves (consistent with Phase 1)
- Extensibility: Claude's discretion on whether to allow custom fields
- Versioning: Full history tracking — keep previous versions of entries to see how profile evolved

### Experience Representation
- Primary unit: Project-level (projects are first-class, not just bullets under roles)
- Projects nest under roles: Projects belong to a specific role at a specific company
- Achievement structure: Hybrid — human-readable text + optional structured fields for key metrics
- Tagging: Both predefined core tags (leadership, technical, cross-functional) + custom tags allowed

### Skills Organization
- Categorization: Hierarchical (Categories > subcategories > skills)
- Proficiency: Simple tiers — familiar, proficient, expert
- Source tracking: Confidence score 0-100% based on evidence strength
- Evidence linking: Required — every skill must have at least one project/experience reference

### Audience Adaptation
- Summaries: Generated on demand from building blocks (not pre-written variants)
- Building blocks: Modular paragraphs to mix and match for different audiences
- STAR stories: Tagged by theme + mapped to common interview question categories
- Story versions: Multiple versions of same story for different audiences (technical, leadership, etc.)

### Claude's Discretion
- Single file vs modular files for storage
- Whether to allow extension fields beyond core schema
- History storage mechanism (separate files, embedded versions, etc.)
- Exact hierarchy structure for skill categories

</decisions>

<specifics>
## Specific Ideas

- Skills must link to evidence — this enables "show me where you used React" queries
- History tracking means we can see profile evolution over time (useful for self-reflection)
- Project-level granularity allows reusing accomplishments across different resume versions
- Confidence scores on skills enable filtering by evidence strength when generating materials

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-self-profile-schema*
*Context gathered: 2026-01-30*
