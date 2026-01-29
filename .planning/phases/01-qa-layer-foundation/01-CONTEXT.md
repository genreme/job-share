# Phase 1: QA Layer Foundation - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish a self-testing framework that validates components and gates progression to subsequent phases. Covers schema validation, UI visual tests, workflow logic tests, MCP tool tests, and phase-gating enforcement. The framework ensures quality before proceeding with new development.

</domain>

<decisions>
## Implementation Decisions

### Test framework choice
- Vitest as the test runner (fast, modern, native ESM support)
- Both npm scripts and CLI with flags for invocation
- Watch mode enabled by default during development
- Common cases via npm scripts, power users get CLI flexibility

### Failure handling
- Schema validation: warn and continue (advisory mode for development flexibility)
- Phase completion: strict gating — cannot mark phase complete until all tests pass
- CI integration from the start (GitHub Actions workflow)
- Detailed failure messages with fix hints (show expected vs actual, suggest remediation)

### Validation scope
- Jobs dashboard data validated first (job entries, status transitions, fit scores)
- UI testing: both snapshot testing and component render tests
- Workflow logic tests include edge cases from the start, not just happy paths
- MCP server tools included in Phase 1 testing scope

### Output & reporting
- Terminal output: minimal summary (pass/fail counts, details only for failures)
- Generate HTML report after each run (browsable test results)
- Code coverage tracked with enforced thresholds

### Claude's Discretion
- Test file organization (colocated vs separate folder based on codebase conventions)
- Coverage threshold percentage (will pick appropriate level)
- Specific snapshot testing configuration
- MCP test complexity based on tool structure

</decisions>

<specifics>
## Specific Ideas

- Tests should work well in watch mode since that's the default development workflow
- HTML reports should be browsable to review test history
- Phase gating should be strict — this is the foundation that enables confidence in subsequent phases

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-qa-layer-foundation*
*Context gathered: 2026-01-29*
