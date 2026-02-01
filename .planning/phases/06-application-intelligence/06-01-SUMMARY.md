---
phase: 06-application-intelligence
plan: 01
subsystem: matching
tags: [resume-matching, gap-analysis, mcp-tools, skills]
completed: 2026-02-01
duration: 4 min

dependency_graph:
  requires: [01-qa-layer, 02-self-profile-schema, 03-self-profile-integration]
  provides: [resume-matcher-service, matching-tools]
  affects: [06-02, 06-03, future-application-workflows]

tech_stack:
  added: []
  patterns: [keyword-extraction, profile-jd-comparison, gap-analysis]

key_files:
  created:
    - mcp-server/src/services/resume-matcher.js
    - mcp-server/src/services/resume-matcher.test.js
    - mcp-server/src/tools/matching.js
    - mcp-server/src/tools/matching.test.js
  modified: []

decisions:
  - id: "06-01-D1"
    area: matching-algorithm
    decision: "Use regex-based keyword extraction (no external NLP libraries)"
    rationale: "Simple approach sufficient for single-user, no dependency on external ML models"
  - id: "06-01-D2"
    area: skill-patterns
    decision: "Organize patterns by category (design tools, frontend, backend, soft skills, etc.)"
    rationale: "Maintainable structure, easy to extend for new domains"
  - id: "06-01-D3"
    area: partial-matching
    decision: "Support partial keyword matching (substring contains)"
    rationale: "Handles variations like 'React' matching 'React Native' or 'JavaScript' matching 'TypeScript'"
  - id: "06-01-D4"
    area: confidence-levels
    decision: "Three confidence levels: high (5+ keywords), medium (2-4), low (<2)"
    rationale: "Provides actionable signal about match quality"
  - id: "06-01-D5"
    area: neutral-score
    decision: "Return 50% score when no keywords extracted (not 0%)"
    rationale: "Neutral score is more honest than penalizing lack of keyword data"

metrics:
  tests_added: 83
  total_tests: 1180
  files_created: 4
  lines_of_code: ~1590
---

# Phase 06 Plan 01: Resume-JD Matching Service Summary

Keyword-based resume-JD matching with gap analysis using regex patterns for skill extraction and profile comparison.

## Objective Achieved

Created a resume-JD matching service that extracts keywords from job descriptions, compares against profile skills/experience, and identifies gaps with suggestions. Exposed via two MCP tools for pre-application assessment.

## What Was Built

### 1. Resume Matcher Service (`resume-matcher.js`)

**extractJobKeywords(description)**
- Normalizes text (lowercase, remove bullets, collapse whitespace)
- Extracts keywords using regex patterns for 9 categories:
  - Design tools: figma, sketch, adobe suite, invision, etc.
  - Frontend: react, angular, vue, typescript, etc.
  - Backend: node.js, python, java, graphql, etc.
  - Databases: sql, postgres, mongodb, redis, etc.
  - Methodologies: agile, scrum, kanban, design thinking
  - Soft skills: leadership, management, collaboration
  - Domain: ux, ui, brand, product design, accessibility
  - Cloud: aws, azure, docker, kubernetes
  - Data: analytics, tableau, a/b testing
- Returns `{ skills: string[], rawText: string }`

**matchResumeToJob(profile, jobDescription)**
- Extracts profile skills from `profile.skills[].name`
- Extracts experience keywords from `profile.experience[].projects[].tags` and descriptions
- Compares against extracted job keywords with partial matching
- Returns:
  - `score`: 0-100 match percentage (APPL-01)
  - `matched`: keywords found in both
  - `missing`: keywords in JD but not profile (APPL-02 gaps)
  - `suggestions`: actionable advice for each gap
  - `confidence`: high/medium/low based on keyword count

### 2. MCP Tools (`matching.js`)

**getResumeMatch({ jobId, jobDescription })**
- Get match score for a single job
- Accepts jobId (loads from jobs.json) or direct description
- Returns score, confidence, matched skills, gaps, suggestions, summary
- Error handling for missing profile, missing job, no description

**getMatchScoresForActiveJobs({ limit })**
- Get match scores for all active jobs (apply-now, maybe, inbox)
- Returns ranked list sorted by resumeMatch descending
- Includes summary stats: total, averageMatchScore, highMatches, noData
- Jobs without description get `resumeMatch: null, confidence: 'no-data'`

## Test Coverage

| Component | Tests | Coverage |
|-----------|-------|----------|
| resume-matcher.js | 47 | extractJobKeywords, matchResumeToJob, edge cases |
| matching.js | 36 | both tools, error handling, edge cases |
| **Total new** | 83 | - |
| **Project total** | 1180 | All passing |

## Requirements Addressed

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| APPL-01 | getResumeMatch returns 0-100 score with confidence | Complete |
| APPL-02 | matchResumeToJob identifies gaps with suggestions | Complete |

## Key Files

```
mcp-server/src/services/
  resume-matcher.js          # Keyword extraction and matching logic
  resume-matcher.test.js     # 47 tests

mcp-server/src/tools/
  matching.js                # MCP tools for resume-JD matching
  matching.test.js           # 36 tests
```

## Decisions Made

1. **Regex-based extraction over NLP**: Simple patterns sufficient for single-user system, no external dependencies needed
2. **Category-organized patterns**: Easy to maintain and extend
3. **Partial keyword matching**: Handles skill name variations naturally
4. **Neutral default score (50%)**: Honest when no keywords extracted
5. **Three confidence levels**: Actionable signal about match quality

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

### Dependencies Satisfied
- Resume matcher service ready for use by contact tracking (06-02)
- MCP tools registered and callable

### Blockers
None.

### Recommendations
- Consider adding wink-nlp if keyword extraction proves insufficient for niche industries
- Follow-up timing could use match scores to prioritize which jobs to follow up on first
