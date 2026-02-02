---
phase: 07-application-generation
plan: 02
subsystem: application-generation
tags: [document-review, keyword-optimization, languagetool, ats, zod]
requires: [06-application-intelligence]
provides: [document-review-service, keyword-optimizer-service, review-schema]
affects: [07-03-MCP-tools, 08-interview-prep]
tech-stack:
  added: []
  patterns: [LanguageTool API integration, keyword reordering]
key-files:
  created:
    - schemas/review.schema.js
    - mcp-server/src/services/document-review.js
    - mcp-server/src/services/document-review.test.js
    - mcp-server/src/services/keyword-optimizer.js
    - mcp-server/src/services/keyword-optimizer.test.js
decisions:
  - "Grammar checking uses LanguageTool free API (20 req/min limit)"
  - "ATS compatibility checks for non-ASCII, HTML tags, tabs, pipes"
  - "Keyword optimization reorders only; does not rewrite content"
  - "Document readyToUse requires no blockers AND overall score >= 75"
metrics:
  duration: 7 min
  completed: 2026-02-02
---

# Phase 7 Plan 2: Document Review and Keyword Optimization Summary

**One-liner:** LanguageTool-integrated document review with ATS/factual/tone checks plus keyword-aware resume optimization that reorders without rewriting.

## What Was Built

### 1. Review Schema (`schemas/review.schema.js`)
- **ReviewIssueSchema**: Validates individual issues with type, message, context, offset, length, suggestions, severity
- **DocumentReviewSchema**: Complete review result with grammar, ATS, tone, length, factual checks
- **Validation helpers**: `validateReviewIssue()`, `validateDocumentReview()`
- Issue types: spelling, grammar, style, punctuation, ats, tone, factual
- Severity levels: error, warning, info
- Document types: resume, cover_letter, email

### 2. Document Review Service (`mcp-server/src/services/document-review.js`)
- **checkGrammar(text, language)**: Calls LanguageTool API, returns issues and score (100 - 5/error - 2/warning)
- **checkATSCompatibility(text, keywords)**: Detects non-ASCII, HTML, tabs, pipes; calculates keyword coverage
- **checkFactualAccuracy(text, profile)**: Verifies dates and company names against profile experience
- **analyzeTone(text, prefs)**: Detects casual/formal/balanced tone, checks consistency with profile
- **reviewDocument(type, content, jd, profile)**: Full review combining all checks with overall score and blockers

### 3. Keyword Optimizer Service (`mcp-server/src/services/keyword-optimizer.js`)
- **scoreTextRelevance(text, keywords)**: Counts matching keywords in text
- **reorderSkillsByRelevance(skills, keywords)**: Reorders grouped or flat skills by keyword match
- **analyzeKeywordCoverage(resumeData, keywords)**: Returns matched/missing breakdown with percentage
- **optimizeResumeForJob(resume, jd, research)**: Full optimization with skill and bullet reordering

## Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| LanguageTool free API | 20 req/min sufficient for single-document reviews; no cost |
| Score formula: 5/error, 2/warning | Weighted to prioritize spelling errors over style suggestions |
| ATS deductions: 5 (non-ASCII), 10 (HTML), 3 (tabs), 2 (pipes) | Based on common ATS parsing failures |
| Blockers: >3 grammar errors, ATS <70, any factual conflicts | Prevents shipping seriously flawed documents |
| Keyword optimization preserves structure | Per CONTEXT.md: "same structure preserved, reorder and emphasize" |
| Deep copy before optimization | Prevents mutation of original resume data |

## Test Coverage

| File | Tests | Coverage Areas |
|------|-------|----------------|
| document-review.test.js | 52 | Grammar API (mocked), ATS checks, factual accuracy, tone analysis, full review |
| keyword-optimizer.test.js | 43 | Skill reordering (grouped/flat), text scoring, coverage analysis, full optimization |
| **Total** | **95** | |

## Deviations from Plan

None - plan executed exactly as written.

## Files Changed

| File | Change |
|------|--------|
| `schemas/review.schema.js` | Created - Zod schemas for review results |
| `mcp-server/src/services/document-review.js` | Created - Grammar, ATS, factual, tone checking |
| `mcp-server/src/services/document-review.test.js` | Created - 52 tests |
| `mcp-server/src/services/keyword-optimizer.js` | Created - Keyword-based optimization |
| `mcp-server/src/services/keyword-optimizer.test.js` | Created - 43 tests |

## Commit History

| Commit | Description |
|--------|-------------|
| `fd633f9` | feat(07-02): create document review schema |
| `62473e8` | feat(07-02): create document review service with LanguageTool integration |
| `de1ed47` | feat(07-02): create keyword optimizer service |

## Requirements Progress

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| APPL-10 (Keyword optimization) | optimizeResumeForJob reorders skills/bullets | Complete |
| APPL-12 (Full review) | reviewDocument with grammar, ATS, tone, length, factual | Complete |

## Next Phase Readiness

**Ready for Plan 07-03:** MCP tools can now use:
- `reviewDocument()` for comprehensive document quality checks
- `optimizeResumeForJob()` for keyword-aware resume optimization
- `analyzeKeywordCoverage()` for coverage analysis before generation

**Dependencies satisfied:**
- Document review schema for validating review results
- Grammar checking with graceful API failure handling
- ATS compatibility scoring with actionable suggestions
- Keyword optimization that preserves resume structure
