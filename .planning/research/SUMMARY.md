# Project Research Summary

**Project:** Job Search Command Center - Milestone 2 (Profile, Discovery, Automation, QA)
**Domain:** Personal Job Search Operating System with AI Integration
**Researched:** 2026-01-29
**Confidence:** MEDIUM-HIGH

## Executive Summary

The Job Search Command Center is a personal productivity system that transforms job searching from reactive application tracking to proactive opportunity management. Research reveals that modern job search tools follow a hub-and-spoke architecture with centralized professional identity (self-profile) feeding multiple output generators (resumes, cover letters, interview prep). The recommended approach builds on the existing vanilla JS foundation with careful additions: Playwright for browser automation, Cheerio for web scraping, Ajv for schema validation, and Node.js native testing for QA.

The critical finding is that this domain has evolved from "application trackers" to "professional identity managers" - users expect AI-powered tailoring, fit scoring, and intelligent discovery. The core differentiator is treating job search like a sales funnel: qualify opportunities before investing effort, codify strategy into reusable playbooks, and maintain a single source of truth for professional identity. The existing fit scoring system and browser extension already position this project ahead of competitors like Teal and Huntr.

Key risks center on LinkedIn automation (60% higher detection rate for browser extensions), web scraper brittleness (sites change structure without warning), and data corruption during active use (user is job searching while system evolves). Mitigation requires read-only LinkedIn operations, multiple fallback selectors with validation, and atomic writes with daily backups. The project must prioritize maintaining existing functionality - breaking the live system during development is unacceptable given active job search context.

## Key Findings

### Recommended Stack

The technology stack builds incrementally on the existing vanilla JS + Node.js + Chrome Extension + MCP foundation. Core additions focus on four capabilities: profile validation, web scraping, browser automation, and testing.

**Core technologies:**
- **Playwright 1.58.0**: Browser automation with WebKit support for Safari-like testing, better isolation than Puppeteer, Microsoft-backed with active development. Critical for LinkedIn read-only operations.
- **Cheerio 1.2.0**: HTML parsing for static job boards, 8x faster than JSDOM with jQuery-like API. Pairs with existing Axios for lightweight scraping.
- **Ajv 8.17.1**: JSON schema validation for self-profile data integrity. Fastest validator (50M+ weekly downloads), supports JSON Schema 2020-12 without runtime overhead.
- **Node.js native test runner**: Zero-dependency testing using built-in test runner (stable since v20). Includes mocking, coverage, snapshots. Matches "lean stack" philosophy.

**Version compatibility:** All packages verified compatible with Node.js v25.4.0. No breaking changes required to existing codebase.

**Strategic decisions:** Playwright chosen over Puppeteer for WebKit support (Safari testing on macOS). Node.js native testing preferred over Jest to avoid heavyweight dependencies. JSON files with Ajv validation preferred over SQLite - right-sized for single-user, local-first system under 100MB.

### Expected Features

Job search tools in 2026 have moved beyond basic tracking to AI-powered professional identity management. The competitive landscape includes Teal (all-in-one at $29/mo), Huntr (Kanban UI at $40/mo), Careerflow (LinkedIn optimization), and Dex (relationship-first CRM at $12/mo).

**Must have (table stakes):**
- Application status tracking — Core Kanban system (already implemented)
- One-click job capture — Browser extension (already implemented)
- Job description storage — Critical for AI features, keyword analysis
- Resume tailoring assistance — AI-powered matching to JD
- Contact/recruiter tracking — Lightweight, per-job attachment
- Follow-up reminders — Date-based triggers prevent dropped opportunities
- Search/filter/sort — Essential with 50+ jobs in system
- Data export — Trust feature, prevents lock-in concerns

**Should have (competitive differentiators):**
- Centralized self-profile (Professional Identity Hub) — Single source of truth for all materials; enables intelligent tailoring; most important differentiator
- Fit scoring system — Already implemented with 7-category scoring; pattern recognition over time
- AI resume-to-JD matching score — Shows gaps and keywords before applying
- Application playbook templates — Codified strategy for different job types; unique concept not found in competitors
- Discovery funnel with lead scoring — Treat jobs like sales leads; qualify before investing time
- Interview self-testing framework — Practice against YOUR materials, not generic rubrics
- Pattern analytics dashboard — What's working? Response rates by dimension

**Defer (v2+):**
- Network mapping — High complexity, requires contact enrichment
- Company research hub — Scope creep risk, many external sources exist
- Calendar integration — Manual tracking sufficient initially
- LinkedIn auto-sync — API complexity, manual import acceptable

**Anti-features (explicitly avoid):**
- Mass auto-apply — Recruiters flag this as red flag; strips intentionality
- White font keyword stuffing — Integrity issue, increasingly detected by ATS
- Gamification/streaks — Adds pressure to stressful process
- AI-generated content without review — Generic AI text is detectable

### Architecture Approach

The recommended architecture follows a hub-and-spoke pattern with pipeline processing. A central data hub (self-profile + jobs) acts as single source of truth, with specialized spoke components that read from the hub and write results back. Processing happens through pipes-and-filters pipelines where each stage transforms data independently.

**Major components:**
1. **Self-Profile (Hub)** — Centralized professional identity owns master-profile.json; all output generators read from it; updates through dedicated learning routines only
2. **Data Hub** — Job storage (jobs.json), search history, analytics; communicates with all components
3. **Discovery Funnel (Pipeline)** — Scan/filter/research/present stages process jobs from hundreds to shortlist; each filter independent and testable
4. **Application Engine** — Playbook execution, document generation from profile + job context
5. **Browser Automation** — Playwright-based LinkedIn sessions, gated site access; session state only, no persistent data
6. **QA Layer** — Test pyramid (unit/service/E2E) with self-healing selectors; validates components before deployment

**Data flow:** Self-profile uses write-once, read-many pattern. Discovery funnel uses pipeline processing with intermediate JSON files between stages. All components validate inputs with Ajv schemas.

**Key patterns:**
- Hub-and-spoke with single source of truth (profile consistency across outputs)
- Pipes and filters for discovery (independent stages with different performance profiles)
- MCP mediated access for AI integration (security broker pattern)
- Browser context isolation for automation (session management without cross-contamination)
- Test pyramid with self-healing (AI-assisted selector recovery when UI changes)

**Anti-patterns avoided:**
- Monolithic profile updates (maintain audit trail, validate changes)
- Tight coupling between pipeline stages (enable debugging, parallelization)
- Embedded credentials in automation (use persistent browser contexts)
- Polling-based data sync (file watchers or explicit refresh for local-first)
- Testing after deployment (QA layer gates changes before production)

### Critical Pitfalls

Research identified 11 domain-specific pitfalls across critical, moderate, and minor severity levels.

1. **LinkedIn account ban from browser automation** — Browser extensions have 60% higher detection risk than cloud platforms. LinkedIn uses ML to detect automation through browser fingerprinting and DOM manipulation patterns. Prevention: Start manual-only for 14 days to establish baseline; respect strict rate limits (connection requests max 3%/day, profile visits 100/day free, 250/day premium); use read-only operations where possible; implement warm-up protocol; never automate connection requests.

2. **Web scraping breaks silently when site structure changes** — CSS selectors become invalid without warning. Scrapes return incomplete or incorrect data. Fit scores calculated from garbage input. Prevention: Prefer JSON-LD structured data over CSS selectors; use multiple fallback selectors; validate extracted data (check for nulls, string lengths, expected patterns); implement health checks; flag suspicious extractions; design for graceful degradation with confidence levels.

3. **Data corruption during system evolution** — Migrating working system while actively using it leads to corruption or loss. Schema changes break existing data. User is actively job searching - cannot tolerate downtime. Prevention: Never modify jobs.json schema without migration script; atomic writes always (existing pattern); backup before EVERY dev session; run new features in parallel first; implement phased migration; keep rollback path clear.

4. **Self-profile becomes stale and diverges from reality** — Initial extraction is snapshot, not living document. Skills and priorities evolve during job search. AI outputs sound disconnected from how user actually speaks. Prevention: Design for evolution not extraction; weekly cleanup routine; capture interview feedback; separate stable vs evolving data; version the profile; test output quality before trusting.

5. **AI workflow error cascading** — One early mistake cascades through subsequent decisions. Fit score miscalculation leads to wrong prioritization leads to missed opportunity. Prevention: Human checkpoints at phase boundaries; validate fit scores manually for first 20 jobs; show reasoning not just output; implement confidence scores triggering review; avoid long automation chains.

## Implications for Roadmap

Based on research, the recommended build order follows dependency chains and risk profiles. Self-profile must come first as foundation. QA layer comes second to validate each subsequent phase. Discovery and automation can proceed in parallel after foundations established.

### Phase 1: Self-Profile Foundation
**Rationale:** Everything depends on having stable, well-defined profile schema. The centralized self-profile is the primary differentiator and enabler for all AI-powered features. Build and validate this foundation before proceeding.

**Delivers:**
- master-profile.json schema with Ajv validation
- Experience entries with quantified achievements
- Skills inventory (explicit + inferred)
- Professional summaries (multiple versions)
- Interview stories (STAR format)
- Target role criteria and preferences

**Addresses:** Centralized self-profile (top differentiator from FEATURES.md), hub component from architecture

**Avoids:** Profile staleness pitfall (#4) by building update mechanisms alongside extraction

**Research needed:** None - well-documented patterns for JSON schemas and personal data models

### Phase 2: QA Layer Foundation
**Rationale:** Following "self-testing framework as Phase 1" decision from PROJECT.md. Build validation early so each subsequent component can be tested before deployment. Critical given user is actively job searching - cannot tolerate bugs in production.

**Delivers:**
- Node.js native test runner setup with scripts
- Schema validators for all data structures
- Functional validators for existing components
- Test fixtures and mock data
- Validation reporting

**Uses:** Node.js native test runner (zero dependencies)

**Implements:** QA Layer component from architecture

**Avoids:** Testing pitfall (#6) - design for value not coverage; data corruption (#3) - catch issues before production

**Research needed:** None - test runner is mature and documented

### Phase 3: Discovery Funnel (Pipeline Processing)
**Rationale:** With profile and QA in place, build the job discovery system. Pipeline architecture allows building/testing each stage independently. Static scraping (Cheerio) is lower risk than browser automation, so starts here.

**Delivers:**
- Scan filter for job sources (initially manual import)
- Fit filter using existing 7-category scoring + profile
- Research filter for company enrichment
- Dedup filter with fuzzy matching
- Present filter for user review

**Uses:** Cheerio for HTML parsing, Axios for HTTP, Ajv for validation

**Implements:** Discovery Funnel component with pipes-and-filters pattern

**Addresses:** Discovery funnel with lead scoring (differentiator), fit scoring integration

**Avoids:** Scraper breakage pitfall (#2) with multiple fallback selectors and validation; rate limiting (#8) with delays and caching

**Research needed:** MEDIUM - Each target site (LinkedIn, Indeed, company pages) may need site-specific research for selector strategies

### Phase 4: Enhanced Application Engine
**Rationale:** With profile stable and discovery producing qualified opportunities, enhance the application workflow with playbook templates and improved generation.

**Delivers:**
- Application playbook templates (dream company, quick apply, networking-first)
- Enhanced resume-JD matching score
- Improved cover letter generation with profile voice
- Contact tracking per job
- Follow-up reminder system

**Uses:** Self-profile as single source of truth, existing MCP AI integration

**Implements:** Application Engine component

**Addresses:** Application playbook templates (unique differentiator), contact tracking (table stakes), follow-up reminders (table stakes)

**Avoids:** AI error cascading (#5) with human checkpoints and reasoning display

**Research needed:** LOW - Standard document generation patterns

### Phase 5: Browser Automation Integration (High Risk)
**Rationale:** Build this last as highest risk component. Requires careful implementation with fallbacks. With other phases working, user has value even if automation proves problematic. Start read-only to minimize ban risk.

**Delivers:**
- Playwright setup with WebKit support
- LinkedIn read-only integration (job viewing, connection checking)
- Browser context isolation for session management
- Rate limiting and anti-detection measures
- Fallback to puppeteer-extra-plugin-stealth if needed

**Uses:** Playwright 1.58.0 (primary), puppeteer-extra + stealth plugin (fallback)

**Implements:** Browser Automation component

**Addresses:** Automated LinkedIn integration for discovery funnel

**Avoids:** LinkedIn ban pitfall (#1) with read-only ops, rate limiting, warm-up protocol

**Research needed:** HIGH - LinkedIn's current detection landscape changes frequently; may need phase-specific research on 2026 detection methods before implementation

### Phase 6: Interview Self-Testing & Analytics
**Rationale:** Build after core workflow established and sufficient data accumulated. Analytics requires historical data to be meaningful.

**Delivers:**
- Interview question generation from JD
- Practice mode with self-scoring against profile stories
- Preparation progress tracking
- Analytics dashboard (response rates, time-in-stage, patterns)

**Uses:** Self-profile stories, job data, MCP AI integration

**Addresses:** Interview self-testing (differentiator), pattern analytics (differentiator)

**Avoids:** AI error cascading with confidence scoring and validation

**Research needed:** LOW - Interview prep is well-documented domain

### Phase Ordering Rationale

- **Profile first:** Foundation for all AI features; everything depends on stable schema
- **QA second:** Validate each component before proceeding; critical for active-use system
- **Discovery third:** Lower risk than automation; produces value immediately; can work with manual inputs
- **Application fourth:** Depends on stable profile; enhances existing workflow
- **Automation fifth:** Highest risk; user has value from previous phases even if this fails
- **Analytics last:** Requires accumulated data; not blocking for core workflow

**Dependency chain:** Profile → QA → {Discovery, Application} → Automation → Analytics

**Risk profile:** Low-risk foundations first, high-risk automation deferred until value established

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Browser Automation):** LinkedIn detection landscape evolves rapidly; may need `/gsd:research-phase` for current 2026 detection methods, working anti-detection strategies, and safe rate limits
- **Phase 3 (Discovery Funnel):** Each target site (LinkedIn job search, Indeed, Glassdoor, company career pages) has different selectors; may need site-specific research

Phases with standard patterns (skip additional research):
- **Phase 1 (Self-Profile):** JSON schema validation is well-documented; personal data models are standard
- **Phase 2 (QA Layer):** Node.js native test runner has comprehensive documentation; test pyramid is established pattern
- **Phase 4 (Application Engine):** Document generation patterns well-known; playbook concept is internal design
- **Phase 6 (Interview & Analytics):** Interview prep and analytics patterns well-established

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via npm; official docs reviewed; technology choices align with existing codebase and lean-stack philosophy |
| Features | MEDIUM | Based on competitor analysis across multiple sources; no single authoritative "state of job search tools" report; anti-features section has strong consensus from recruiter feedback |
| Architecture | MEDIUM | Patterns verified against existing codebase structure; hub-and-spoke and pipeline processing are proven patterns; browser context isolation confirmed via Playwright docs |
| Pitfalls | MEDIUM | Critical pitfalls (LinkedIn ban, scraper breakage, data corruption) verified across multiple credible sources; LinkedIn automation risks confirmed by multiple sales/automation platforms |

**Overall confidence:** MEDIUM-HIGH

The stack recommendations are high confidence (verified versions, official docs). Feature landscape is medium confidence (multiple sources agree on trends but competitor features may have changed). Architecture patterns are medium confidence (proven patterns but adapted to this specific use case). Pitfalls are medium confidence for critical issues (consensus across sources) but lower for moderate/minor issues.

### Gaps to Address

Several areas need attention during implementation:

- **LinkedIn automation specifics:** Detection methods evolve faster than documentation. Phase 5 should begin with small-scale testing and monitoring for detection signals before scaling. Consider starting with manual LinkedIn use and deferring automation until patterns established.

- **Safari extension testing:** Playwright WebKit provides Safari-like behavior on macOS, but cannot test the actual Safari extension. May need separate manual testing protocol for Safari-specific features. Extension already works in Safari; main concern is ensuring new features don't break Safari compatibility.

- **Site-specific scraping strategies:** Each job board has different structure, rate limits, and robots.txt policies. Discovery Funnel (Phase 3) should start with one well-documented site (e.g., Indeed) before expanding. Build selector validation for each new site.

- **Profile update workflow:** Research covered data structure but not user interaction patterns for keeping profile current. Phase 1 should include user testing of profile editing UX. Weekly review prompts may need experimentation to find right frequency.

- **Backup automation:** Manual `cp jobs.json jobs.json.bak.$(date +%Y%m%d)` before dev sessions is error-prone. Consider automated pre-commit hook or daily cron job for backups. Critical given active use context.

## Sources

### Primary (HIGH confidence)
- [Playwright Browser Support](https://playwright.dev/docs/browsers) — WebKit limitations, platform support, context isolation
- [Node.js Test Runner API](https://nodejs.org/api/test.html) — Native test runner features, stability status, mocking capabilities
- [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture) — Official MCP specification and patterns
- npm registry — All package versions verified 2026-01-29 via `npm view [package] version`

### Secondary (MEDIUM confidence)
- [Dux-Soup LinkedIn Automation Safety Guide 2026](https://www.dux-soup.com/blog/linkedin-automation-safety-guide-how-to-avoid-account-restrictions-in-2026) — LinkedIn detection risks
- [Growleads: LinkedIn Automation Ban Risk 2026](https://growleads.io/blog/linkedin-automation-ban-risk-2026-safe-use/) — 23% ban risk statistics, 60% higher detection for browser extensions
- [BrowserStack: Playwright vs Puppeteer 2026](https://www.browserstack.com/guide/playwright-vs-puppeteer) — Architecture comparison, WebKit support
- [ZenRows: Node.js Web Scraping Libraries 2026](https://www.zenrows.com/blog/javascript-nodejs-web-scraping-libraries) — Cheerio vs alternatives
- [Teal Job Search CRM](https://www.tealhq.com/tool/job-search-crm) — Competitor feature analysis
- [Huntr Job Tracker](https://huntr.co/product/job-tracker) — Competitor feature analysis
- [Jobsolv: Why Recruiters Flag Auto-Apply](https://www.jobsolv.com/blog/why-recruiters-flag-auto-apply-job-applications-and-how-to-avoid-it) — Anti-patterns in job search automation
- [SpiderMount: Common Problems with Web Scrapes for Job Listings](https://www.webspidermount.com/common-problems-with-web-scrapes-for-job-listings/) — Scraper brittleness
- [Microsoft: Pipes and Filters Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/pipes-and-filters) — Pipeline architecture guidance

### Tertiary (LOW confidence - requires validation)
- Various articles on test automation, migration strategies, JSON best practices — General patterns applied to domain

### User Context (HIGH confidence)
- Existing codebase at `/Users/genre/Claude/Job Search Command Center` — Current implementation patterns
- strategy.md — User's existing frameworks and philosophy

---
*Research completed: 2026-01-29*
*Ready for roadmap: yes*
