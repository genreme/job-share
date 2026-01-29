# Technology Stack

**Analysis Date:** 2026-01-29

## Languages

**Primary:**
- JavaScript (ES modules) - Used for all backend and browser code
- HTML5 - Dashboard and extension UI
- CSS3 - Styling for dashboard and extension

**Secondary:**
- TOML - Cloudflare Worker configuration (`wrangler.toml`)

## Runtime

**Environment:**
- Node.js 25.4.0 (current version, no pinned .nvmrc or .node-version file)

**Package Manager:**
- npm (uses `package.json` and `package-lock.json`)
- Supports both root and nested package configurations

## Frameworks

**Core Backend:**
- Node.js built-in `http` module - Local development server at `server.js`
- ES modules (`"type": "module"` in `package.json`)

**MCP Integration:**
- @modelcontextprotocol/sdk ^1.0.0 - Exposes tools to Claude Chat via MCP server at `mcp-server/src/index.js`

**Browser Extension:**
- Chrome Extensions API (Manifest V3) - Browser extension for job capture
- Chrome Storage API - Local persistent storage for extension data

**Frontend:**
- Vanilla JavaScript - No framework, direct DOM manipulation in `index.html`
- Fetch API - HTTP communication from dashboard and extension
- Supabase JS SDK v2 - Loaded dynamically from CDN

## Key Dependencies

**Critical:**
- @modelcontextprotocol/sdk ^1.0.0 - Enables Claude integration via Model Context Protocol
  - Provides Server, StdioServerTransport, request/response schemas
  - Located: `mcp-server/package.json`

**Infrastructure:**
- Node.js built-in fs module - File system operations for jobs.json, learning-log.json, resume data
- Node.js built-in path module - Directory and file path resolution
- Node.js built-in url module - URL parsing and fileURL conversion

## Configuration

**Environment:**
- PORT: Defaults to 3000, configurable via `process.env.PORT`
- ENVIRONMENT: Cloudflare Worker sets "production" in `wrangler.toml`
- Supabase configuration: Hardcoded in `index.html` (URL and anon key visible in script)
- Job Validator: Cloudflare Worker URL hardcoded as `https://job-validator.genreme.workers.dev`

**Build:**
- No build step required - code runs directly with Node.js
- MCP server starts with `node mcp-server/src/index.js`
- Development server starts with `node --watch server.js` (auto-reload enabled)

**File Paths:**
- Resume data root: `/Users/genre/Claude/resume` (hardcoded in `loader.js` and `server.js`)
- Jobs data: `mcp-server/data/jobs.json` (relative to project root)
- Learning log: `mcp-server/data/learning-log.json`
- Dashboard: `index.html` at project root

## Data Storage

**Local File System:**
- `jobs.json` - Primary job database (JSON format, atomic writes with temp file pattern)
- `learning-log.json` - Learning preferences, decisions, and metrics
- Resume data files - External location at `/Users/genre/Claude/resume/`
- Cover letter data - External location at `/Users/genre/Claude/resume/cover letter generator - claude/`

**Resume Data Structure:**
- `resume_data_v9_1.json` - Resume sections and experience data
- `cover_letter_data.json` - Cover letter templates

## Platform Requirements

**Development:**
- Node.js 25.4.0 or compatible (no lockdown enforced)
- Chromium-based browser (Chrome, Edge, etc.) for extension development
- Local server running on `localhost:3000`
- File system access to resume directory

**Production/Deployment:**
- Chrome Web Store for browser extension deployment
- Cloudflare Workers platform (free tier) for job-validator worker
- Supabase PostgreSQL backend (remote, SaaS)
- Local development: can run on any machine with Node.js

## External Services

**Cloudflare Workers:**
- Job Validator Worker: `https://job-validator.genreme.workers.dev`
- Validates job URLs, extracts details, calculates fit scores
- Deployed via wrangler CLI

**Supabase:**
- Project: `ivssytvekpfnaqcbhxkz`
- Purpose: Friend job submissions (inbox feature)
- Client: Supabase JS SDK v2 loaded from CDN (`https://unpkg.com/@supabase/supabase-js@2`)
- URL: `https://ivssytvekpfnaqcbhxkz.supabase.co`

## Project Structure

**Monorepo-like Layout:**
- `server.js` - Local development server (port 3000)
- `mcp-server/` - MCP server for Claude integration
- `extension/` - Chrome browser extension
- `worker/` - Cloudflare worker for job validation
- `index.html` - Main dashboard UI
- `package.json` - Root project metadata (no dependencies listed)
- `mcp-server/package.json` - MCP server dependencies only

## Package Management

**Root package.json:**
- No production dependencies declared
- Scripts: `npm start`, `npm run dev`, `npm run mcp`, `npm run extract`
- Type: `"module"` (ES modules)

**MCP Server package.json:**
- Single dependency: @modelcontextprotocol/sdk
- Scripts for development and production

**Cloudflare Worker:**
- No npm package.json - deployed via wrangler directly
- Single JS file: `job-validator.js`

---

*Stack analysis: 2026-01-29*
