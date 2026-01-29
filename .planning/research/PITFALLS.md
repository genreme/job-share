# Domain Pitfalls

**Domain:** Job Search Operating System / Personal AI-Integrated Productivity Tool
**Researched:** 2026-01-29
**Confidence:** MEDIUM (WebSearch findings from multiple credible sources)

## Critical Pitfalls

Mistakes that cause rewrites, system breakage, or major setbacks.

---

### Pitfall 1: LinkedIn Account Ban from Browser Automation

**What goes wrong:** Browser extensions for LinkedIn automation carry a 60% higher detection risk than cloud platforms. LinkedIn uses machine learning to detect automation through browser fingerprinting, missing expected signatures, and DOM manipulation patterns. Account gets temporarily restricted or permanently banned.

**Why it happens:**
- Browser extensions execute within your local browser, creating forensic evidence LinkedIn identifies
- Extensions share your actual IP address, linking automated actions directly to your account
- Cannot randomize browser fingerprints effectively because they operate in your real browser instance
- Exceeding rate limits: more than 100 connection requests/week or browsing profiles too quickly

**Consequences:**
- Temporary restriction: limited messaging, connecting, or posting
- Permanent ban: lose access to profile, connections, messages, and all data
- New accounts traced to same IP face scrutiny and potential bans
- Your job search network becomes inaccessible during critical period

**Prevention:**
1. **Start manual-only for 14 days** before any automation - establishes behavioral baseline
2. **Respect strict rate limits:** Connection requests: max 3% of total connections/day; Profile visits: 100/day (free), 250/day (premium)
3. **Use user's logged-in session passively** - read-only where possible, avoid write operations
4. **Implement warm-up protocol:** Week 1-2: manual only; Week 3-4: light automation at 40% of limits; Week 5+: gradual scaling
5. **Never automate connection requests** - only use automation for read operations (viewing jobs, checking connections)
6. **Build detection recovery:** If restricted, stop ALL automation for 1 week minimum

**Detection (warning signs):**
- "We've noticed some unusual activity" messages
- CAPTCHA challenges appearing frequently
- Features being temporarily limited
- Profile views dropping dramatically

**Phase relevance:** Browser Automation phase - CRITICAL. Research deeply before implementation. Consider read-only approach.

**Sources:**
- [LinkedIn Automation Safety Guide 2026](https://www.dux-soup.com/blog/linkedin-automation-safety-guide-how-to-avoid-account-restrictions-in-2026)
- [23% Ban Risk Explained - Growleads](https://growleads.io/blog/linkedin-automation-ban-risk-2026-safe-use/)
- [LinkedIn Jail Tips - Evaboot](https://evaboot.com/blog/linkedin-jail)

---

### Pitfall 2: Web Scraping Breaks Silently When Site Structure Changes

**What goes wrong:** Job board scrapers are designed for a specific page configuration. Even a small update to the structure of a page (e.g., switching the location of a job's title and its salary) can prevent a scrape from gathering data or populating it in the right place. Scrapes fail silently, returning incomplete or incorrect data.

**Why it happens:**
- CSS selectors become invalid when classes/IDs change
- HTML structure changes break DOM traversal
- Each company has its own web interface requiring separate crawler setup
- Job boards update frequently without warning

**Consequences:**
- Outdated listings in your database
- Missing or duplicate posts
- Poorly categorized jobs with wrong titles, companies, or locations
- Fit scores calculated from garbage data
- User makes decisions based on incorrect information during active job search

**Prevention:**
1. **Prefer JSON-LD structured data** (as current code does) - more stable than CSS selectors
2. **Use multiple fallback selectors** - ordered by stability (current code has this pattern)
3. **Validate extracted data:** Check for null/empty, unreasonably short strings, expected patterns
4. **Implement health checks:** Periodically verify extraction accuracy against known jobs
5. **Flag suspicious extractions:** Title < 5 chars, company < 2 chars, missing location
6. **Design for graceful degradation:** Partial data is better than no data; mark confidence level
7. **Monitor for breakage:** Track extraction success rates over time

**Detection (warning signs):**
- Sudden increase in null/empty fields
- Fit scores clustering at baseline (50)
- Jobs showing wrong company names from URL parsing
- Duplicate rate increasing unexpectedly

**Phase relevance:** Discovery Funnel phase - HIGH priority. Build validation layer before scaling scraping.

**Sources:**
- [Common Problems with Web Scrapes - SpiderMount](https://www.webspidermount.com/common-problems-with-web-scrapes-for-job-listings/)
- [Job Board Scraping Guide - JobBoardly](https://www.jobboardly.com/blog/job-board-scraping-complete-guide-2025)

---

### Pitfall 3: Data Corruption During System Evolution

**What goes wrong:** Migrating a working system while actively using it leads to data corruption or loss. Schema changes break existing data. Writes during migration corrupt files. Job data becomes inconsistent between old and new components.

**Why it happens:**
- Big bang migration with no transition period
- Changing data schema without migration strategy
- Concurrent writes to same files during development
- Inadequate backup before making changes

**Consequences:**
- Lost job applications and tracking history
- Corrupted jobs.json requiring manual recovery
- System unusable during critical job search period
- Hours lost reconstructing data from memory

**Prevention:**
1. **Never modify jobs.json schema without migration script**
2. **Atomic writes always** (current code has this pattern - preserve it)
3. **Backup before EVERY development session:** `cp jobs.json jobs.json.bak.$(date +%Y%m%d)`
4. **Run new features in parallel** - read from same DB, write to test location first
5. **Implement phased migration:** Migrate individual features/modules incrementally
6. **Verify compatibility** before switching: Run sample data through both old and new paths
7. **Keep rollback path clear:** Can always revert to previous code + backup data

**Detection (warning signs):**
- JSON parse errors when loading jobs
- Jobs missing fields that should exist
- Duplicate IDs in database
- Status values that don't match expected enum

**Phase relevance:** ALL phases - CRITICAL. Establish backup discipline before any development.

**Sources:**
- [Migration Strategies Guide - Medium](https://medium.com/@jaredlwong/migration-strategies-a-comprehensive-guide-for-effective-system-evolution-b28dc4ce9f08)
- [System Migration Risks - Hyland](https://www.hyland.com/en/resources/articles/system-migration-risks-to-evaluate)

---

### Pitfall 4: Self-Profile Becomes Stale and Diverges from Reality

**What goes wrong:** Self-profile data extracted from resumes, chats, and LinkedIn becomes outdated. Profile says one thing, user presents differently in interviews. AI-generated content sounds disconnected from how user actually speaks.

**Why it happens:**
- Initial extraction is a snapshot, not a living document
- Skills and priorities evolve during job search
- No mechanism to capture learnings from interviews
- Profile bloat: accumulates everything, surfaces nothing relevant

**Consequences:**
- AI outputs sound generic or inconsistent with user's voice
- Cover letters emphasize wrong aspects
- Interview prep based on outdated priorities
- User has to override AI suggestions constantly, defeating the purpose

**Prevention:**
1. **Design for evolution, not extraction:** Profile should be easy to update, not just created once
2. **Weekly cleanup routine:** User reviews and prunes profile (not just AI consolidation)
3. **Capture interview feedback:** After each interview, prompt user for what worked/didn't
4. **Separate stable vs. evolving data:** Core identity (stable) vs. current priorities (evolving)
5. **Version the profile:** Track changes over time, can revert or see evolution
6. **Test output quality:** Generate sample content, user validates before trusting automated outputs

**Detection (warning signs):**
- User frequently edits AI-generated content
- Generated cover letters feel generic
- Profile has contradictory statements
- Important recent experiences missing from profile

**Phase relevance:** Self-Profile Layer phase - HIGH priority. Build update mechanisms alongside extraction.

**Sources:**
- [Identity Management Challenges - Avatier](https://www.avatier.com/blog/unexpected-challenges-identity-management/)
- [AI Productivity Paradox - Workday/Axios](https://www.axios.com/2026/01/14/ai-jobs-productivity-workslop)

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt.

---

### Pitfall 5: AI Workflow Error Cascading

**What goes wrong:** One early mistake in AI-assisted workflow cascades through subsequent decisions, compounding into larger failures. Fit score miscalculation leads to wrong prioritization leads to missed opportunity.

**Why it happens:**
- Error propagation is multiplicative, not additive
- AI outputs fed into subsequent AI operations without validation
- Automation bias: over-trusting AI recommendations without scrutiny
- No checkpoints to catch errors early

**Prevention:**
1. **Human checkpoints at phase boundaries:** User confirms before system acts on AI output
2. **Validate fit scores manually for first 20 jobs** - calibrate before trusting
3. **Show reasoning, not just output:** User can spot errors in logic
4. **Implement confidence scores:** Low confidence triggers review
5. **Avoid long automation chains:** Each AI operation should be independently verifiable

**Detection (warning signs):**
- Jobs consistently miscategorized
- User surprised by what's in "apply-now" vs "probably-not"
- AI reasoning doesn't match user's intuition
- Outcomes don't improve despite system use

**Phase relevance:** Discovery Funnel, Application Engine - validate early, trust incrementally.

**Sources:**
- [Agent Failure Modes - Galileo](https://galileo.ai/blog/agent-failure-modes-guide)
- [12 Failure Patterns of Agentic AI - Concentrix](https://www.concentrix.com/insights/blog/12-failure-patterns-of-agentic-ai-systems/)

---

### Pitfall 6: Testing That Doesn't Catch Real Problems

**What goes wrong:** Tests pass but system breaks in production. Automation tests brittle and flaky. Test suite becomes maintenance burden that slows development without catching bugs.

**Why it happens:**
- Testing only the "happy path" - users make mistakes, networks fail, data is weird
- UI-heavy automation (most expensive and least stable type)
- Trying to automate everything instead of testing what matters
- Tests coupled to implementation details, break on refactor

**Prevention:**
1. **Test at the right layer:** Data validation > API layer > UI (pyramid, not inverted)
2. **Test real failure modes:** What happens when LinkedIn returns 403? When JSON is malformed?
3. **Keep test suite lean:** 10 tests that catch real bugs > 100 tests that pass regardless
4. **Test extraction accuracy:** Known job URLs with expected extraction results
5. **Visual tests only for critical UI:** Dashboard renders, key elements present
6. **Accept some manual testing:** Exploratory testing catches what automation misses

**Detection (warning signs):**
- Tests pass but bugs appear in use
- Tests fail randomly (flaky)
- Afraid to refactor because tests will break
- Test runs take > 30 seconds for simple changes

**Phase relevance:** Self-Testing Framework phase - design for value, not coverage metrics.

**Sources:**
- [Test Automation Pitfalls - Industrial Logic](https://www.industriallogic.com/blog/avoiding-automated-testing-pitfalls/)
- [7 Common Test Automation Mistakes - Medium](https://ambahera.medium.com/7-common-test-automation-mistakes-and-how-to-avoid-them-4aff75e185b0)

---

### Pitfall 7: Manifest V3 Service Worker Limitations

**What goes wrong:** Browser extension functionality breaks after Chrome updates. Service workers shut down when not needed, losing state. Persistent listeners impossible in MV3.

**Why it happens:**
- Manifest V3 uses service workers instead of persistent background pages
- Service workers shut down after ~30 seconds of inactivity
- No DOM access in service workers
- webRequestBlocking replaced with limited declarativeNetRequest

**Prevention:**
1. **Store state in chrome.storage, not memory** - service worker can restart and recover
2. **Use Offscreen documents** for operations requiring DOM access
3. **Design for intermittent execution:** Each message handler self-contained
4. **Test extension after Chrome updates** - behavior may change
5. **Avoid complex background processing:** Keep it simple, defer to content scripts or server

**Detection (warning signs):**
- Extension stops working after browser idle period
- State lost between operations
- "Service worker was destroyed" errors in console
- Features work inconsistently

**Phase relevance:** Browser Extension updates if needed - existing extension should be audited.

**Sources:**
- [Manifest V3 Known Issues - Chrome Developers](https://developer.chrome.com/docs/extensions/develop/migrate/known-issues)
- [MV3 Migration Guide - Firefox](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/)

---

### Pitfall 8: Rate Limiting and IP Blocking from Job Boards

**What goes wrong:** Job boards detect high request volume from single IP. Access blocked, requiring waiting period or different approach. Discovery funnel can't operate at scale.

**Why it happens:**
- Scanning hundreds of postings from one IP triggers rate limits
- User-Agent and request patterns flag automated traffic
- No delays between requests
- Same IP hits same endpoints repeatedly

**Prevention:**
1. **Implement delays between requests:** 2-5 seconds minimum, randomized
2. **Respect robots.txt:** Check before scraping, document which sites allow what
3. **Rotate User-Agent strings** within reasonable browser variants
4. **Use HEAD requests where possible** (current code does this for status checks)
5. **Batch requests thoughtfully:** Don't check 100 jobs in 10 seconds
6. **Consider API alternatives where available:** Indeed, LinkedIn have APIs (with restrictions)
7. **Cache aggressively:** Don't re-fetch what hasn't changed

**Detection (warning signs):**
- HTTP 429 (Too Many Requests) responses
- CAPTCHAs appearing
- Blank pages or "please verify you're human"
- Validation worker returning high error rates

**Phase relevance:** Discovery Funnel phase - build rate limiting from the start.

**Sources:**
- [Web Scraping Challenges 2025 - GroupBWT](https://groupbwt.com/blog/challenges-in-web-scraping/)
- [Stealth Scraping at Scale - Browserless](https://www.browserless.io/blog/stealth-scraping-puppeteer-playwright)

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

---

### Pitfall 9: Duplicate Jobs from Multiple Sources

**What goes wrong:** Same job appears via LinkedIn, company careers page, and Indeed. Tracker shows 3 entries for one opportunity. User applies thinking they're different.

**Why it happens:**
- Same job posted on multiple boards
- URLs different but content identical
- Company name variations: "Acme Inc" vs "Acme" vs "ACME Corporation"
- Title variations: "Senior Engineer" vs "Sr. Engineer" vs "Senior Software Engineer"

**Prevention:**
1. **Normalize company names** before comparison (current code does this)
2. **Use fuzzy matching on titles** (current code has Levenshtein similarity)
3. **Consider job content hash** as secondary dedup signal
4. **Show potential duplicates to user** for confirmation rather than auto-merging
5. **Track original source when merging:** Know where job came from

**Phase relevance:** Already partially handled - extend during Discovery Funnel expansion.

---

### Pitfall 10: JSON Corruption from Manual Editing

**What goes wrong:** User edits jobs.json directly, introduces syntax error, entire database unreadable.

**Why it happens:**
- JSON doesn't allow trailing commas (unlike JavaScript)
- Single quote instead of double quote
- Missing comma between properties
- Copy-paste introduces invisible characters

**Prevention:**
1. **Never manually edit jobs.json** - use dashboard or MCP tools
2. **Validate JSON on load:** Catch parse errors with helpful messages
3. **Implement JSON repair:** Auto-fix common issues (trailing commas, etc.)
4. **Backup before any operation that touches the file**
5. **Use JSON schema validation:** Catch structural issues early

**Phase relevance:** Ongoing - add validation to existing file operations.

**Sources:**
- [Common JSON Mistakes - JSONLint](https://jsonlint.com/common-mistakes-in-json-and-how-to-avoid-them)

---

### Pitfall 11: Stale Job Listings Waste Application Effort

**What goes wrong:** Jobs in tracker appear active but have been filled. User spends time on applications that won't be reviewed.

**Why it happens:**
- Job boards don't always remove filled positions immediately
- "Active" status check passes (HTTP 200) but job is actually closed
- Companies leave listings up for talent pipeline
- No mechanism to detect "position filled" language

**Prevention:**
1. **Check for closed indicators in page content** (current code does this)
2. **Implement periodic re-validation** of active jobs (weekly recommended)
3. **Flag jobs older than 30 days** for user review
4. **Track "days since posted"** and surface in UI
5. **Quick re-check before application:** One-click status refresh

**Phase relevance:** Discovery Funnel - add periodic validation routine.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Self-Profile Layer | Profile staleness (#4) | Build update mechanisms alongside extraction; weekly user review |
| Discovery Funnel | Scraper breakage (#2), Rate limiting (#8) | Multiple fallback selectors; delays between requests; validation layer |
| Browser Automation (LinkedIn) | Account ban (#1) | Read-only operations; manual-first for 14 days; strict rate limits |
| Application Engine | AI error cascading (#5) | Human checkpoints; show reasoning; validate first 20 outputs |
| Self-Testing Framework | Useless tests (#6) | Test failure modes, not happy paths; keep suite lean |
| All phases | Data corruption (#3) | Atomic writes; backup before dev session; phased migration |

---

## Domain-Specific Insights

### The AI Productivity Paradox

Research from Workday (2026) found that 85% of AI tool users reported saving 1-7 hours/week, but 37% of that time was lost to "rework" - correcting errors, rewriting content, and verifying output. Only 14% reported consistently positive outcomes.

**Implication for this project:** Don't assume AI-generated content (fit scores, cover letters, interview prep) is correct. Build verification into the workflow. The goal is augmentation, not replacement - user should always be able to quickly validate and override.

### The LinkedIn Automation Risk Calculus

Sales operations teams are being advised to "migrate off browser extensions by Q1 2026" due to 60% higher detection risk. For job seekers, the risk is even higher - you can't create a new account and rebuild your network.

**Implication for this project:** The LinkedIn automation feature should be designed as read-only from the start. Viewing job postings, checking for connections at a company, and reading connection information are lower-risk than connection requests, messages, or profile views at scale. Consider whether the value justifies the risk.

### The Working System Constraint

This project has a critical constraint most projects don't: the current system must remain functional during evolution because you're actively job searching.

**Implication for this project:**
1. Never break existing functionality - additive changes only
2. New features should be toggleable - can disable if problematic
3. Test with production data but write to test locations first
4. Keep a known-good backup state you can always revert to

---

## Sources Summary

**HIGH confidence (official documentation):**
- [Chrome Manifest V3 Documentation](https://developer.chrome.com/docs/extensions/develop/migrate)
- [LinkedIn Official Policy on Automation](https://www.linkedin.com/help/linkedin/answer/a1340567)

**MEDIUM confidence (multiple credible sources agree):**
- LinkedIn automation risks: Dux-Soup, Growleads, Evaboot guides
- Web scraping challenges: SpiderMount, JobBoardly, GroupBWT
- AI agent failures: Galileo, Concentrix research
- Test automation pitfalls: Industrial Logic, Software Testing Magazine

**LOW confidence (general patterns, not domain-specific):**
- Migration strategy patterns
- JSON handling best practices
- Profile management principles

---

*This document focuses on pitfalls specific to building a job search operating system with AI integration and browser automation. Generic software development pitfalls (version control, documentation, etc.) are excluded.*
