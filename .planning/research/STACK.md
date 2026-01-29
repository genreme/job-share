# Technology Stack

**Project:** Job Search Command Center - Milestone 2 (Profile, Discovery, Automation, QA)
**Researched:** 2026-01-29
**Overall Confidence:** HIGH (versions verified via npm, docs via WebFetch)

## Context

Building on existing vanilla JS + Node.js + Chrome Extension (Manifest V3) + MCP foundation. This research covers additions needed for:

1. Centralized self-profile data management
2. Automated job discovery funnel with web scraping
3. Browser automation for gated sites (LinkedIn, etc.)
4. Self-testing/QA framework

**Design Principles (inherited):**
- Local-first for security
- Single-user system
- Safari + Chrome support
- Lean stack (no unnecessary frameworks)
- Quality over speed

---

## Recommended Stack

### Data Layer - Self-Profile Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Native JSON files | N/A | Primary storage | Existing pattern works. Atomic writes via temp+rename already implemented. Under 100MB datasets work fine. | HIGH |
| Ajv | 8.17.1 | Schema validation | Fastest JSON schema validator. 50M+ weekly downloads. Supports JSON Schema 2020-12. Type-safe profile data without runtime overhead. | HIGH |
| Zod | 4.3.6 | Runtime type inference | Alternative to Ajv if TypeScript adoption grows. Better DX for complex nested types. Currently vanilla JS so Ajv preferred. | MEDIUM |

**Rationale:** The existing system uses JSON files with atomic writes (`atomicWriteSync()` pattern in server.js). This works well for single-user, local-first. Adding Ajv provides schema validation for profile data integrity without introducing a database.

**NOT recommended:**
- SQLite (node:sqlite) - Overkill for single-user JSON documents under 100MB. Adds complexity without benefit.
- lowdb - Adds abstraction layer over what's already working. The existing read/write helpers are sufficient.
- MongoDB/PostgreSQL - Wrong tool for local-first personal data.

### Web Scraping - Discovery Funnel

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Cheerio | 1.2.0 | HTML parsing | 8x faster than JSDOM. jQuery-like API. Perfect for static page extraction. Already standard for Node.js scraping. | HIGH |
| Axios | (current) | HTTP client | Simple, browser+Node compatible, good error handling. Pairs with Cheerio for static pages. | HIGH |

**Rationale:** For scraping public job boards and company career pages that server-render content, Cheerio + Axios is the proven lightweight approach. No browser overhead, fast parsing.

**When NOT sufficient:** JavaScript-rendered sites (React SPAs), sites requiring login. These need browser automation (below).

### Browser Automation - Gated Sites

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Playwright | 1.58.0 | Primary browser automation | Cross-browser (Chromium, Firefox, WebKit), auto-wait, better API than Puppeteer. Microsoft-maintained with active development. | HIGH |
| puppeteer-extra | 3.3.6 | Fallback for Chrome-specific | If Playwright WebKit limitations cause issues on macOS. Still actively maintained. | MEDIUM |
| puppeteer-extra-plugin-stealth | 2.11.2 | Anti-detection | 450k+ weekly downloads, still maintained. Patches automation fingerprints. Works with puppeteer-extra. | MEDIUM |

**Critical Decision: Playwright over Puppeteer**

Choose Playwright because:
1. **WebKit support** - Needed for Safari-like testing on macOS (closest to real Safari behavior)
2. **Auto-wait** - Reduces flakiness vs Puppeteer's manual waits
3. **Multi-browser from single API** - Test Chrome and WebKit without code changes
4. **Better maintained** - Microsoft backing, larger team

**WebKit/Safari Limitations (verified via playwright.dev/docs/browsers):**
- Playwright doesn't work with branded Safari - uses WebKit builds instead
- Media codecs vary by platform - run WebKit on macOS for accurate Safari-like behavior
- For closest-to-Safari experience, run WebKit tests on macOS (which you have)

**Stealth/Anti-Detection Strategy:**

For LinkedIn and other gated sites:
1. Use Playwright with default settings first (often sufficient)
2. If blocked, switch to puppeteer-extra + stealth plugin for Chromium
3. Implement request delays (1-3 seconds random), user-agent rotation
4. Consider residential proxy if persistent blocks (future enhancement)

**NOT recommended:**
- Selenium - Older, slower, more detectable, requires separate driver management
- Puppeteer-only - Lacks WebKit support needed for Safari testing
- playwright-stealth - Less mature than puppeteer-extra-plugin-stealth

### Testing Framework - Self-Testing/QA

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js native test runner | Built-in (Node 25.x) | Unit + integration tests | Zero dependencies. Stable since v20. Built-in mocking, coverage, snapshots. Matches "lean stack" philosophy. | HIGH |
| Playwright Test | 1.58.0 | E2E browser tests | Same Playwright you're using for automation. Built-in test runner with parallelization, screenshots, traces. | HIGH |

**Rationale:** The Node.js native test runner is now production-ready (stable v2.0 since Node 20). Key features verified via nodejs.org/api/test.html:

- **Mocking:** `mock.fn()`, `mock.method()`, `mock.module()` for ESM mocking
- **Assertions:** Works with built-in `assert` module, supports `assert/strict`
- **Coverage:** `--experimental-test-coverage` flag, supports lcov output
- **Snapshots:** `t.assert.snapshot()` for regression testing
- **Reporters:** spec, tap, dot, junit for CI integration
- **Watch mode:** `--test --watch` for development

**Test Structure Recommendation:**

```
tests/
  unit/              # Node.js native test runner
    profile.test.js
    scraper.test.js
    validator.test.js
  integration/       # Node.js native test runner
    api.test.js
    data-flow.test.js
  e2e/               # Playwright Test
    dashboard.spec.js
    extension.spec.js
```

**NOT recommended:**
- Jest - Large dependency, overkill when native runner exists
- Vitest - Great for Vite projects, adds unnecessary deps here
- Mocha - Requires assertion/mocking libraries separately

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| robotstxt-parser | (npm latest) | robots.txt parsing | Check scraping permissions before hitting sites | HIGH |
| p-limit | (npm latest) | Concurrency control | Limit parallel requests during scraping | HIGH |
| dotenv | (npm latest) | Environment config | Store API keys, proxy configs outside code | HIGH |
| node-cron | (npm latest) | Job scheduling | Scheduled discovery runs | MEDIUM |

### AI Integration (Existing)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| @anthropic-ai/sdk | 0.72.0 | Claude API | Already in use via MCP |
| @modelcontextprotocol/sdk | (current) | MCP integration | Already established |

No changes needed - existing MCP integration covers AI-powered analysis.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Browser automation | Playwright | Puppeteer | No WebKit support, less active development |
| Browser automation | Playwright | Selenium | Heavier, more detectable, driver management |
| HTML parsing | Cheerio | JSDOM | 8x slower, heavier memory |
| Testing | Node.js native | Jest | Unnecessary dependency, native runner is mature |
| Testing | Node.js native | Vitest | Better for Vite projects, not needed here |
| Data validation | Ajv | Joi | Ajv is faster, supports more schema drafts |
| Data storage | JSON files | SQLite | Overkill for single-user, adds complexity |

---

## Version Matrix

All versions verified 2026-01-29 via `npm view [package] version`:

| Package | Verified Version | Node.js Min |
|---------|------------------|-------------|
| playwright | 1.58.0 | 18+ |
| @playwright/test | 1.58.0 | 18+ |
| cheerio | 1.2.0 | 18+ |
| ajv | 8.17.1 | 10+ |
| zod | 4.3.6 | 18+ (ESM) |
| puppeteer | 24.36.1 | 18+ |
| puppeteer-extra | 3.3.6 | 18+ |
| puppeteer-extra-plugin-stealth | 2.11.2 | 18+ |

**Current Node.js:** v25.4.0 (verified) - All packages compatible.

---

## Installation

```bash
# Core additions for Milestone 2
npm install playwright cheerio ajv

# Stealth automation (optional, use if Playwright blocked)
npm install puppeteer-extra puppeteer-extra-plugin-stealth

# Supporting utilities
npm install p-limit dotenv node-cron

# Playwright browsers (includes WebKit for Safari-like testing)
npx playwright install

# Dev dependencies for testing
# Note: Node.js native test runner requires no installation
npm install -D @playwright/test
```

---

## Configuration Recommendations

### Playwright Configuration (`playwright.config.js`)

```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    // Use WebKit on macOS for Safari-like behavior
    browserName: 'webkit',
  },
  projects: [
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  reporter: [['html', { open: 'never' }]],
});
```

### Profile Schema (Ajv example)

```javascript
import Ajv from 'ajv';
const ajv = new Ajv({ allErrors: true });

const profileSchema = {
  type: 'object',
  required: ['name', 'experience', 'skills'],
  properties: {
    name: { type: 'string', minLength: 1 },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        required: ['company', 'role', 'startDate'],
        properties: {
          company: { type: 'string' },
          role: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          highlights: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    skills: { type: 'array', items: { type: 'string' } }
  }
};

const validate = ajv.compile(profileSchema);
```

### Node.js Native Test Runner (`package.json`)

```json
{
  "scripts": {
    "test": "node --test",
    "test:coverage": "node --test --experimental-test-coverage",
    "test:watch": "node --test --watch",
    "test:e2e": "playwright test"
  }
}
```

---

## Phase Implications for Roadmap

### Phase 1: Profile Layer
- **Stack needed:** Ajv for schema validation
- **Risk:** Low - JSON file patterns already work

### Phase 2: Discovery Funnel
- **Stack needed:** Cheerio + Axios for static scraping
- **Risk:** Low - well-established patterns

### Phase 3: Gated Site Automation
- **Stack needed:** Playwright (primary), puppeteer-extra-plugin-stealth (fallback)
- **Risk:** Medium - anti-detection is cat-and-mouse game
- **Mitigation:** Start with Playwright defaults, add stealth only if needed

### Phase 4: QA Framework
- **Stack needed:** Node.js native test runner + Playwright Test
- **Risk:** Low - mature tools

---

## Open Questions for Phase Research

1. **LinkedIn automation specifics:** What's the current detection landscape? May need phase-specific research.
2. **Safari Extension testing:** Can Playwright WebKit test the Safari extension, or need separate approach?
3. **Rate limiting strategy:** What delays/patterns work for each target site?

---

## Sources

### Verified via npm registry (2026-01-29)
- All package versions confirmed via `npm view [package] version`

### Official Documentation (WebFetch verified)
- [Playwright Browser Support](https://playwright.dev/docs/browsers) - WebKit limitations, platform support
- [Node.js Test Runner API](https://nodejs.org/api/test.html) - Features, stability status, mocking

### WebSearch (cross-referenced)
- [ZenRows - Node.js Web Scraping Libraries 2026](https://www.zenrows.com/blog/javascript-nodejs-web-scraping-libraries)
- [BrowserStack - Playwright vs Puppeteer 2026](https://www.browserstack.com/guide/playwright-vs-puppeteer)
- [Better Stack - Node.js Test Runner Guide](https://betterstack.com/community/guides/testing/nodejs-test-runner/)
- [ZenRows - Bypass Bot Detection 2026](https://www.zenrows.com/blog/bypass-bot-detection)
- [Ajv Documentation](https://ajv.js.org/)
