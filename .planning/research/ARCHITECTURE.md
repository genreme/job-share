# Architecture Patterns

**Domain:** Personal Productivity System with AI Integration (Job Search Operating System)
**Researched:** 2026-01-29
**Confidence:** MEDIUM (patterns verified against existing codebase and industry sources)

## Executive Summary

The Job Search Operating System requires architecture patterns that support: centralized profile data feeding multiple outputs, a discovery funnel that processes hundreds of job postings down to a curated shortlist, browser automation that integrates with the existing extension, and a self-testing layer that validates components before deployment.

The recommended architecture follows a **Hub-and-Spoke pattern with Pipeline Processing** — a central data hub (profile + jobs) with specialized spoke components (discovery, application, interview prep) that read from the hub and write results back. Processing happens through pipes-and-filters pipelines where each stage transforms data independently.

## Recommended Architecture

```
                     +------------------+
                     |   Self-Profile   |
                     | (master-profile) |
                     +--------+---------+
                              |
                              v
+-------------+      +--------+--------+      +---------------+
|  Discovery  |----->|                 |----->|  Application  |
|   Funnel    |      |    Data Hub     |      |    Engine     |
| (pipeline)  |      |   (jobs.json)   |      |  (playbook)   |
+-------------+      |                 |      +---------------+
                     +--------+--------+
                              |
                              v
                     +--------+--------+
                     |   Dashboard     |
                     |   (existing)    |
                     +-----------------+
                              |
                              v
                     +--------+--------+
                     |   QA Layer      |
                     | (validators)    |
                     +-----------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | Data Owns |
|-----------|---------------|-------------------|-----------|
| **Self-Profile** | Centralized professional identity | All output generators | master-profile.json |
| **Data Hub** | Job storage, search history, analytics | All components | jobs.json, learning-log.json |
| **Discovery Funnel** | Scan, filter, research, present | Data Hub, Browser Automation | job-scan-cache.json |
| **Application Engine** | Playbook execution, document generation | Self-Profile, Data Hub | Generated artifacts |
| **Browser Automation** | LinkedIn sessions, gated site access | Discovery Funnel, Extension | Session state only |
| **Dashboard** | User interface, status management | Data Hub (read/write) | UI state only |
| **QA Layer** | Component validation, regression tests | All components (read-only) | Test results |
| **MCP Server** | Claude Code integration, tool exposure | Data Hub, Self-Profile | None (stateless) |

### Data Flow

**Profile-to-Output Flow (Write Once, Read Many):**

```
Self-Profile Data
       |
       +---> Resume Generator ---> Tailored Resume
       |
       +---> Cover Letter Generator ---> Cover Letter
       |
       +---> Interview Prep ---> Talking Points
       |
       +---> Fit Scorer ---> Job Fit Assessment
```

The self-profile acts as the "single source of truth" for professional identity. All output generators read from it but never write to it directly. Profile updates happen through dedicated learning/consolidation routines.

**Discovery Funnel Flow (Pipeline Processing):**

```
Job Sources (LinkedIn, etc.)
       |
       v
[Scan Filter] --> Raw postings (hundreds)
       |
       v
[Fit Filter] --> Candidates (dozens)
       |
       v
[Research Filter] --> Enriched candidates
       |
       v
[Dedup Filter] --> Unique opportunities
       |
       v
[Present Filter] --> Shortlist for review
       |
       v
Data Hub (user-confirmed jobs)
```

Each filter in the pipeline is independent, stateless, and can be run/debugged in isolation. Filters communicate through intermediate JSON files or in-memory data structures.

**Validation Flow (QA Layer):**

```
Component Under Test
       |
       v
[Functional Validator] --> Does it work?
       |
       v
[Schema Validator] --> Is data well-formed?
       |
       v
[Visual Validator] --> Does UI render correctly? (if applicable)
       |
       v
[Logic Validator] --> Does the flow make sense?
       |
       v
QA Report (pass/fail with diagnostics)
```

## Patterns to Follow

### Pattern 1: Hub-and-Spoke with Single Source of Truth

**What:** Centralize core data (profile, jobs) in a hub that all components read from. Components (spokes) are specialized for specific tasks but share the same data foundation.

**When:** You have multiple outputs that derive from the same underlying data (resume, cover letter, interview prep all derive from self-profile).

**Why this fits:** The project requires presenting "the best version of myself" across different formats. A centralized profile ensures consistency — update once, reflect everywhere.

**Example:**
```javascript
// All generators import from the same profile loader
import { loadProfile } from '../data/profile-loader.js';

// Resume generator
export function generateResume(job) {
  const profile = loadProfile();
  return tailorProfile(profile, job);
}

// Cover letter generator
export function generateCoverLetter(job) {
  const profile = loadProfile();
  return emphasizeAlignment(profile, job);
}

// Interview prep generator
export function generateInterviewPrep(job) {
  const profile = loadProfile();
  return extractTalkingPoints(profile, job);
}
```

### Pattern 2: Pipes and Filters for Discovery Funnel

**What:** Decompose the discovery process into independent, reusable filters connected by pipes. Each filter performs one transformation.

**When:** Processing can be broken into independent steps with different scalability requirements.

**Why this fits:** Job discovery involves: scan (fast, broad), filter (quick checks), research (slow, deep), present (UI concerns). These have different performance profiles and failure modes.

**Example:**
```javascript
// Each filter is a standalone function
const scanFilter = async (sources) => {
  // Returns: { postings: [...], metadata: {...} }
};

const fitFilter = (postings, profile) => {
  // Returns: postings with fitScore >= threshold
};

const researchFilter = async (candidates) => {
  // Returns: enriched candidates with company data
};

// Pipeline orchestrator
async function runDiscoveryPipeline(sources, profile) {
  const raw = await scanFilter(sources);
  const candidates = fitFilter(raw.postings, profile);
  const enriched = await researchFilter(candidates);
  const unique = dedupFilter(enriched);
  return presentFilter(unique);
}
```

### Pattern 3: MCP Mediated Access for AI Integration

**What:** Use Model Context Protocol as the interface between Claude and all system data. The MCP server acts as a security broker and capability discovery layer.

**When:** AI needs structured access to system data and actions without direct file access.

**Why this fits:** The existing MCP server already provides this pattern. Extend it to include profile data, discovery triggers, and validation tools.

**Example:**
```javascript
// MCP tool registration (extends existing pattern)
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // Existing tools
    { name: 'get_jobs', ... },
    { name: 'get_job_detail', ... },

    // New profile tools
    { name: 'get_profile_section', inputSchema: { section: 'string' } },
    { name: 'update_profile_learning', inputSchema: { insight: 'object' } },

    // New discovery tools
    { name: 'run_discovery_scan', inputSchema: { sources: 'array' } },
    { name: 'review_shortlist', inputSchema: { action: 'string' } },

    // New QA tools
    { name: 'validate_component', inputSchema: { component: 'string' } }
  ]
}));
```

### Pattern 4: Test Pyramid with Self-Healing

**What:** Structure tests in three layers (unit/service/E2E) with AI-assisted self-healing when UI elements change.

**When:** Building a system that needs to remain functional during active use while evolving.

**Why this fits:** The user is actively job searching. QA layer catches regressions before they impact the live workflow.

**Example:**
```javascript
// QA validator structure
export const validators = {
  // Unit level: individual functions
  unit: {
    profileLoader: () => validateProfileSchema(loadProfile()),
    fitScorer: () => validateFitRange(calculateFit(testJob, testProfile))
  },

  // Service level: API endpoints
  service: {
    jobsEndpoint: () => validateApiResponse(fetch('/api/jobs')),
    inboxEndpoint: () => validateApiResponse(fetch('/api/inbox'))
  },

  // E2E level: full workflows
  e2e: {
    captureToReview: () => validateCaptureWorkflow(),
    profileToResume: () => validateGenerationWorkflow()
  }
};

// Self-healing: when selector fails, try alternatives
async function resilientSelect(selectors, page) {
  for (const selector of selectors) {
    try {
      const el = await page.waitForSelector(selector, { timeout: 1000 });
      if (el) return el;
    } catch (e) { continue; }
  }
  throw new Error('All selectors failed');
}
```

### Pattern 5: Browser Context Isolation for Automation

**What:** Use Playwright's browser context isolation to maintain user sessions without cross-contamination.

**When:** Automating against gated sites (LinkedIn) that require authentication.

**Why this fits:** User wants to leverage their LinkedIn session for connections visibility. Browser contexts share a process but have isolated state.

**Example:**
```javascript
import { chromium } from 'playwright';

// Reuse user's browser profile for authenticated sessions
const userDataDir = '/Users/genre/Library/Application Support/Google/Chrome/Default';

async function createLinkedInContext() {
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // User can see what's happening
    viewport: { width: 1280, height: 800 }
  });

  // Navigate to LinkedIn with existing session
  const page = await browser.newPage();
  await page.goto('https://www.linkedin.com/jobs/');

  return { browser, page };
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Profile Updates

**What:** Allowing any component to directly modify the self-profile.
**Why bad:** Profile becomes inconsistent as different components apply conflicting updates. No audit trail.
**Instead:** Profile updates go through a dedicated learning routine that validates, consolidates, and versions changes.

### Anti-Pattern 2: Tight Coupling Between Pipeline Stages

**What:** Filters that depend on internal state of other filters or require specific ordering beyond data dependencies.
**Why bad:** Makes debugging difficult, prevents parallelization, creates fragile chains.
**Instead:** Each filter receives all context it needs via input, produces complete output. Filters are unaware of each other.

### Anti-Pattern 3: Embedded Credentials in Automation Scripts

**What:** Hardcoding LinkedIn passwords or API keys in browser automation code.
**Why bad:** Security risk, credentials leak to git history.
**Instead:** Use persistent browser contexts with existing user sessions. Never store credentials in code.

### Anti-Pattern 4: Polling-Based Data Sync

**What:** Dashboard constantly polling server for updates.
**Why bad:** Wastes resources, can miss rapid changes, introduces latency.
**Instead:** For local-first system, either use file watchers (fs.watch) or explicit refresh triggers. The existing manual refresh pattern is appropriate for single-user system.

### Anti-Pattern 5: Testing After Deployment

**What:** Running QA validation only after pushing changes to production.
**Why bad:** User experiences bugs during active job search.
**Instead:** QA layer runs as gate before any changes affect the live system. Phase completion triggers validation.

## Component Build Order

Based on dependency analysis:

### Phase 1: Self-Profile Foundation (No dependencies)

Build the centralized profile data structure first. This is the foundation that all output generators will read from.

**Rationale:** Everything else depends on having a stable, well-defined profile schema. Build and validate this before anything else.

**Dependencies:** None (new component)
**Blocks:** Application Engine, Fit Scoring improvements, Discovery relevance

### Phase 2: QA Layer (Minimal dependencies)

Build the validation framework early so it can test each subsequent component.

**Rationale:** Following the "self-testing framework as Phase 1" decision from PROJECT.md. Each subsequent phase can be validated before proceeding.

**Dependencies:** Existing components (to validate)
**Blocks:** Safe evolution of all other components

### Phase 3: Discovery Funnel (Depends on Profile)

Build the pipeline for job discovery. Can test against existing extension data.

**Rationale:** Once profile exists, can build accurate fit filtering. Discovery produces inputs for the existing dashboard.

**Dependencies:** Self-Profile (for fit scoring), Data Hub (for dedup)
**Blocks:** Automated job finding

### Phase 4: Browser Automation Integration (Depends on Discovery)

Integrate Playwright for LinkedIn automation to feed the discovery funnel.

**Rationale:** This is the riskiest component (external dependencies, rate limits, CAPTCHA). Build after discovery pipeline works with manual inputs.

**Dependencies:** Discovery Funnel (to receive results)
**Blocks:** Fully automated discovery

### Phase 5: Application Engine (Depends on Profile)

Build playbook integration and document generation.

**Rationale:** Requires stable profile schema. Lower risk than automation.

**Dependencies:** Self-Profile (for content), Data Hub (for job context)
**Blocks:** Automated application workflow

## Technology Alignment with Existing Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Self-Profile | JSON file (master-profile.json) | Matches existing jobs.json pattern |
| Discovery Funnel | Node.js functions | Matches server.js patterns |
| Browser Automation | Playwright | Cross-browser, better isolation than Puppeteer, active development |
| QA Layer | Node.js test runner | Native, no new dependencies |
| MCP Extensions | Existing MCP SDK | Already integrated |

## Scalability Considerations

This is a single-user, local-first system. Scalability concerns are different from multi-tenant systems.

| Concern | Current (1 user) | Future (still 1 user, more data) |
|---------|------------------|----------------------------------|
| Profile size | Single JSON file | Split by section if >10MB |
| Job volume | Hundreds in jobs.json | Archive old jobs yearly |
| Discovery speed | Sequential is fine | Pipeline parallelization available |
| Browser automation | One context at a time | Sufficient for personal use |

## Sources

**Architecture Patterns:**
- [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture) - Official MCP specification
- [Pipes and Filters Pattern - Microsoft](https://learn.microsoft.com/en-us/azure/architecture/patterns/pipes-and-filters) - Pipeline architecture guidance
- [Google's Multi-Agent Design Patterns](https://www.infoq.com/news/2026/01/multi-agent-design-patterns/) - Agent orchestration patterns

**Browser Automation:**
- [Playwright vs Puppeteer 2026](https://www.browserstack.com/guide/playwright-vs-puppeteer) - Architecture comparison
- [Playwright Architecture Deep Dive](https://leapcell.io/blog/inside-playwright-puppeteer-architecture-to-scenarios) - Context isolation patterns

**AI Integration:**
- [AI Operating System for Personal Productivity](https://motyl.dev/news/ai-operating-system-personal-productivity-2026) - Treating AI as collaborator
- [Agentic Design Patterns](https://venturebeat.com/infrastructure/agentic-design-patterns-the-missing-link-between-ai-demos-and-enterprise/) - Context engineering principles

**Single Source of Truth:**
- [Why PKM needs SSOT](https://www.dsebastien.net/2022-04-19-single-source-of-truth/) - Personal knowledge management patterns

**QA Architecture:**
- [Test Automation Architecture](https://katalon.com/resources-center/blog/test-automation-architecture) - Framework layering
- [Self-Healing Test Patterns](https://www.accelq.com/blog/ai-testing-frameworks/) - Resilient testing approaches

---

*Architecture research: 2026-01-29*
