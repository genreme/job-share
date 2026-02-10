/**
 * Dashboard Main Script
 * Core job dashboard functionality
 *
 * Dependencies (loaded via index.html):
 * - js/utils.js (formatFileSize, escapeHtml, formatNotes, showToast)
 * - js/storage.js (window.storage, DocStore)
 * - js/data.js (exportData, importData, syncToMCP, etc.)
 * - js/analytics.js (loadAnalytics, loadInsights, etc.)
 */

// ============================================
// FILTER PERSISTENCE
// ============================================
const FILTER_STORAGE_KEY = 'job-tracker-filter-state';

function saveFilterState() {
    try {
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
            filterStates: filterStates,
            sortColumn: sortColumn,
            sortDirection: sortDirection
        }));
    } catch (e) {
        console.warn('Could not save filter state:', e);
    }
}

function loadFilterState() {
    try {
        const saved = localStorage.getItem(FILTER_STORAGE_KEY);
        if (saved) {
            const state = JSON.parse(saved);
            if (state.filterStates) filterStates = state.filterStates;
            if (state.sortColumn) sortColumn = state.sortColumn;
            if (state.sortDirection) sortDirection = state.sortDirection;
            return true;
        }
    } catch (e) {
        console.warn('Could not load filter state:', e);
    }
    return false;
}

// Browser Research command - uses Claude's browser MCP to search AND capture jobs
const BROWSER_RESEARCH_COMMAND = `# Browser Research: Search & Capture Jobs

You have browser automation tools. Use them to search job boards AND automatically capture promising jobs to my Inbox.

## Prerequisites
- My local server must be running: \`cd ~/Claude/Job\\ Search\\ Command\\ Center && node server.js\` at localhost:3000
- You have access to JSCC MCP tools

## Research Workflow

### Phase 0: Check Existing Jobs (DO THIS FIRST)
Call \`get_existing_jobs\` to see what companies and URLs are already tracked.
**Skip any jobs from these companies or URLs** unless it's a clearly different role.

### Phase 1: Search Job Boards
Visit each job board and search for matching roles:

1. **LinkedIn Jobs** (linkedin.com/jobs)
   - Search: "Creative Director" OR "Head of Design" OR "VP Creative"
   - Location: Boston, MA or Remote
   - Filter: Past week

2. **Lever** (jobs.lever.co)
   - Google: site:jobs.lever.co "creative director" boston OR remote
   - Visit top 5-10 results

3. **Greenhouse** (boards.greenhouse.io)
   - Google: site:boards.greenhouse.io "creative director" OR "design director"
   - Visit top 5-10 results

4. **Ashby** (jobs.ashbyhq.com)
   - Google: site:jobs.ashbyhq.com creative director
   - Visit results

5. **Workday** (myworkdayjobs.com)
   - Google: site:myworkdayjobs.com "creative director" boston OR remote

### Phase 2: Evaluate & Capture Each Job
For each job posting you find:

1. **Quick Fit Check** - Does it match?
   ✅ Mission-driven org (nonprofit, healthcare, education, social impact)
   ✅ Leadership role (director level+)
   ✅ Boston/Remote/Hybrid
   ✅ Likely $120K+ salary
   ❌ Skip: Pure agencies, crypto, gaming, junior roles
   ❌ Skip: Already in my tracked jobs (from Phase 0)

2. **If Good Fit → Add via MCP Tool**
   Extract from the page you're viewing:
   - Title, Company, URL, Location, Salary (if shown), Industry
   Then call \`add_job_manual\` with that data to add to my Inbox.

3. **If add_job_manual returns "duplicate"** → Skip, already tracked

### Phase 3: Report Results

After searching all boards, provide:

**📊 Research Summary**
- Date/time: [now]
- Boards searched: [list]
- Jobs reviewed: [count]
- Jobs captured to Inbox: [count]
- Jobs noted for manual review: [count]

**✅ Captured to Inbox:**
| Company | Title | Source |
|---------|-------|--------|
| ... | ... | ... |

**📝 Manual Review Needed:**
(URLs where extension didn't trigger)
- [url] - [company] - [title]

**🎯 Top Priorities:**
1. [Best fit job with reasoning]
2. [Second best]
3. [Third best]

**💡 Insights:**
- [Any patterns noticed]
- [Companies to watch]
- [Salary ranges observed]

## Important Notes
- Jobs go to my **Inbox** for review (not directly to pipeline)
- I'll review the Inbox and accept/reject each job
- If \`add_job_manual\` returns "duplicate", the job is already tracked - skip it
- Always call \`get_existing_jobs\` first to avoid wasting time on duplicates

## My Target Profile (for fit evaluation)
- **Role:** Creative Director, VP Creative, Head of Design
- **Industries:** Healthcare/nonprofit, Education, Arts/Culture, Mission-driven
- **Location:** Boston area, Remote US, Hybrid
- **Salary:** $120K+ minimum
- **Org size:** Prefer <500 employees (less competition)

Let's start with LinkedIn Jobs first!`;

// Search command template - uses MCP tools to search AND add to inbox
const SEARCH_COMMAND = `# Job Search & Auto-Add to Inbox

Search for jobs matching my profile, VALIDATE they are active, find DIRECT company URLs, and add them to my Inbox.

## Prerequisites
- You have access to JSCC MCP tools and WebFetch
- My server is running at localhost:3000

## FIRST: Check Existing Jobs
Call \`get_existing_jobs\` BEFORE searching to see what's already tracked.
Skip any companies or URLs that appear in the results.

## My Target Profile
- **Role:** Creative Director, VP Creative, Head of Design, Design Director, Creative Ops Director
- **Industries:** Healthcare/nonprofit, Education, Arts/Culture, Social Impact, Mission-driven tech
- **Location:** Boston area, Remote US, Hybrid (NYC/Bay Area acceptable)
- **Salary:** $120K+ minimum (prefer $140K+)
- **Posted:** Last 7 days preferred

## Job Board Rotation System

Search across ALL tiers to continuously test effectiveness. Include boards from each tier:

### Tier 1 (High Priority)
- \`site:jobs.lever.co "creative director" OR "design director" boston OR remote\`
- \`site:boards.greenhouse.io "creative director" OR "head of design" boston OR remote\`
- \`site:job-boards.greenhouse.io "creative director" boston OR remote\`
- \`site:foundationlist.org creative director\`

### Tier 2 (Test Regularly)
- \`site:builtinboston.com "creative director" OR "design director"\`
- \`site:linkedin.com/jobs "creative director" boston nonprofit OR healthcare OR education\`
- \`site:myworkdayjobs.com "creative director" boston\`

### Tier 3 (Include Occasionally for Testing)
- \`site:indeed.com "creative director" nonprofit boston posted:7d\`
- \`site:idealist.org creative director boston\`
- \`site:jobs.ashbyhq.com creative director boston OR remote\`

**Search at least 2 boards from each tier** to maintain data on board effectiveness.

## Fit Criteria
✅ **Good Fit (add to Inbox):**
- Mission-driven org (nonprofit, healthcare, education, social impact)
- Leadership role (director+, managing team)
- Boston/Remote/Hybrid location
- $120K+ salary (or likely based on role level)

❌ **Skip:**
- Agencies (unless mission-focused like Media Cause, Blue State)
- Pure tech startups without social mission
- Crypto, gaming, gambling
- Junior/mid-level roles

## Workflow - VALIDATE BEFORE ADDING

### Step 1: Search
Run searches across multiple boards. Collect URLs.

### Step 2: For Each URL - VALIDATE FIRST

**A. Check if URL is live:**
- Fetch the job board URL
- If 404, fetch error, or "job not found" message → SKIP (job closed)
- If redirects to generic careers page → job likely closed

**B. Extract company name from the page**

**C. Find the DIRECT company careers URL:**
This is CRITICAL - don't use job board URLs as final URLs.

1. Search: "[Company Name] careers" or "[Company Name] jobs"
2. Find their actual careers page (usually careers.company.com or company.com/careers)
3. Search their careers page for the same job title
4. If you find it → use THAT direct URL
5. If you can't find it on their site → job may be closed, SKIP

**D. Extract job details from the COMPANY'S page (not job board):**
- Exact job title (as listed on company site)
- Location (as listed on company site)
- Salary (if disclosed)
- Key requirements

### Step 3: Validate Fit & Check Duplicates
1. Quick fit check against my criteria
2. Skip if company/URL already in tracked jobs (from get_existing_jobs)

### Step 4: Add to Inbox (only if validated)
Call the MCP tool:
\`\`\`
add_job_manual({
  title: "Creative Director",
  company: "Company Name",
  location: "Boston, MA",
  salary: "$140k-$160k",
  url: "https://company.com/careers/job123",  // DIRECT company URL!
  industry: "Education",
  description: "Brief role description",
  notes: "Found on Lever, validated on company site"
})
\`\`\`

### Step 5: Report Results

**📊 Search Summary**
- Date: [today]
- Boards searched: [list all boards tested, by tier]
- Jobs found: [count by board]
- Jobs validated (URL live + company link found): [count]
- Jobs added to Inbox: [count]

**✅ Added to Inbox:**
| Company | Title | Direct URL | Source Board | Why It's a Fit |
|---------|-------|------------|--------------|----------------|

**❌ Validation Failures:**
| Company | Title | Board | Failure Reason |
|---------|-------|-------|----------------|
| ... | ... | Lever | 404 - job closed |
| ... | ... | Greenhouse | Couldn't find on company careers |
| ... | ... | Indeed | Stale posting (>30 days old) |

**📊 Board Effectiveness (This Search):**
| Board | Jobs Found | Validated | Success Rate |
|-------|------------|-----------|--------------|
| Lever | X | Y | Y/X% |
| Greenhouse | X | Y | Y/X% |
| Built In Boston | X | Y | Y/X% |
| Indeed | X | Y | Y/X% |

**💡 Recommendations:**
- [Which boards performed well]
- [Which boards had mostly stale postings]
- [Suggest tier adjustments based on this data]

## Key Rules
1. **NEVER add a job without validating the URL is live**
2. **ALWAYS find the direct company careers URL** - not just the job board link
3. **Test ALL tiers** - we need data to know which boards work
4. **Track source accurately** - note where found AND where validated`;

// Weekly status check command template
const STATUS_CHECK_COMMAND = `Check Job Posting Status

I need you to verify which job postings from my dashboard are still active. This helps me track which opportunities have closed and which I should prioritize.

**CRITICAL FIRST STEP:**
Before checking any URLs, FIRST review my dashboard and create a list of ONLY the jobs that meet ALL these criteria:
- Status is NOT "archived"
- I have NOT been rejected (no ❌ symbol, no "REJECTED" in status)
- Job is in one of these statuses: Apply Now, Maybe, Applied (without rejection), Probably Not

Then check ONLY those jobs. Do NOT waste time checking archived or rejected jobs.

**IMPORTANT INSTRUCTIONS:**
- **SKIP ARCHIVED AND REJECTED JOBS** - Only check jobs where I haven't been rejected and that aren't archived
- Check only jobs with these statuses: Apply Now, Maybe, Applied (without rejection), Probably Not
- For each job, first try the direct URL provided
- If direct URL is dead/404, search the company's careers page to see if job was reposted with new URL
- Assess timing: If job was posted recently (< 2 weeks ago) but link is dead, it may have been reposted - search harder
- If job was posted >30 days ago and link is dead, it's likely filled/closed

**JOBS TO CHECK:**
(⚠️ DO NOT copy this example list! First check the dashboard to identify which jobs are NOT archived and NOT rejected, then list only those jobs below)

**Example format for listing jobs:**

3. NDWA - Senior Creative Director (APPLY NOW)
   https://ndwa.hrmdirect.com/employment/job-opening.php?req=3333522&req_loc=628514
   Posted: 2026-01-10 | Found: 2026-01-22

3. NDWA - Senior Creative Director (APPLY NOW)
   https://ndwa.hrmdirect.com/employment/job-opening.php?req=3333522&req_loc=628514
   Posted: 2026-01-10 | Found: 2026-01-22

13. Sollis Health - VP, Brand & Creative Services (MAYBE)
    https://job-boards.greenhouse.io/sollishealth/jobs/6598247003
    Posted: 2026-01-12 | Found: 2026-01-22

14. Age of Learning - Creative Director (APPLY NOW)
    https://jobs.lever.co/aofl/f9a40670-91b7-41ae-819e-36b4944efdc9
    Posted: 2026-01-05 | Found: 2026-01-22

15. Lexia Learning - Creative Director (APPLIED 1/22/2026)
    https://cambiumlearning.wd1.myworkdayjobs.com/en-US/camb/job/Creative-Director_REQ-4250
    Posted: 2026-01-18 | Found: 2026-01-22

16. Chorus Innovations - Creative Director, Brand (APPLY NOW)
    https://boards.greenhouse.io/chorusinnovations/jobs/4231451007
    Posted: 2026-01-08 | Found: 2026-01-22

17. Jobgether - Creative Director (MAYBE)
    https://jobs.lever.co/jobgether/ea7c4939-c988-4a85-bfb4-d8dd54d2eaef
    Posted: 2026-01-15 | Found: 2026-01-22

18. East Boston Social Centers - Director of Marketing (INTERVIEW MONDAY 1/27)
    https://www.indeed.com/viewjob?jk=bd24d45ec90e04ae
    Posted: 2025-12-15 | Found: 2025-12-16

21. Boston Children's Hospital - Graphic Designer III (APPLIED)
    https://jobs.bostonchildrens.org/job/22597473/graphics-designer-iii-trust-boston-ma/
    Posted: 2025-11-20 | Found: 2026-01-22

22. Givebutter - Creative Director (APPLIED)
    https://jobs.ashbyhq.com/givebutter/ee5bb880-11fc-4ad0-a5c9-b72acbd5f544
    Posted: 2025-12-10 | Found: 2026-01-22

**FOR EACH JOB, REPORT:**
- ✅ **ACTIVE** - Job posting is live and accepting applications at the URL provided
- 🔄 **REPOSTED** - Original link dead, but found active posting at new URL on company careers page (provide new URL)
- ⏰ **CLOSING SOON** - Deadline visible and approaching (specify date if shown)
- ⚠️ **UNCERTAIN** - Posted recently but link dead, unclear if filled or just moved (searched careers page, no match found)
- ❌ **CLOSED** - Link dead, not on careers page, likely filled (especially if posted >30 days ago)

**OUTPUT FORMAT:**
Create a simple table:
| Job ID | Company | Status | Notes |
|--------|---------|--------|-------|
| 3 | NDWA | ❌ CLOSED | Link dead, posted 2+ weeks ago |
| 15 | Lexia Learning | 🔄 REPOSTED | New URL: [link] |

**ACTION REQUIRED:**
- Any jobs marked ❌ CLOSED should be archived in my dashboard
- Any jobs marked 🔄 REPOSTED → **IMMEDIATELY UPDATE THE URL IN THE DASHBOARD** - Don't just report it, actually change the job's URL field to the new link
- Any jobs marked ⚠️ UNCERTAIN need manual review

**CRITICAL:** When you find a reposted job with a new URL, you MUST update the dashboard's job URL immediately in the same response. Don't wait for me to ask - just do it.

**AFTER COMPLETING THE CHECK:**
Add a new entry to the Search History tab documenting:
- Date/time of check
- Number of jobs checked
- How many were CLOSED, ACTIVE, REPOSTED, UNCERTAIN
- Brief summary of findings

**TIMING CONTEXT:**
Today's date: ${new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })} (US Eastern Time)`;

// Deep Research command for Claude Chat with MCP tools
const DEEP_RESEARCH_COMMAND = `# Deep Research: Full Job Pipeline Review

Use the JSCC MCP tools to research and UPDATE my job pipeline. You have access to both READ and WRITE tools.

## Available MCP Tools

### Read Tools
- \`get_jobs\` - Load all jobs (filter by status)
- \`get_job_detail\` - Get full details for a job
- \`get_resume_data\` - My background for fit scoring
- \`get_application_stats\` - Response/interview rates

### Write Tools (use these to update the dashboard!)
- \`update_job(jobId, {field: value})\` - Update job fields
- \`archive_job(jobId, reason)\` - Archive closed jobs
- \`set_hiring_manager(jobId, {name, title, linkedin})\` - Record hiring manager
- \`add_job_note(jobId, type, notes)\` - Add to job history

## Instructions

### Step 1: Load Pipeline
Call \`get_jobs\` to retrieve all non-archived jobs.
Expected: ~{JOB_COUNT} jobs to review.

### Step 2: For Each Job, Research & Update

**A. Check Posting Status**
- Visit the job URL
- If closed/404 → call \`archive_job(jobId, "Posting closed as of {DATE}")\`
- If URL changed → call \`update_job(jobId, {url: "new_url"})\`
- Note days since posted

**B. Research Hiring Manager**
- Search LinkedIn: "{company} {title} hiring manager"
- If found → call \`set_hiring_manager(jobId, {name, title, linkedin})\`

**C. Clean Up Fields**
For any incorrect/incomplete data, call \`update_job(jobId, {...})\`:
- title: Exact job title
- company: Official company name
- location: "Remote" / "Hybrid - City" / "On-site - City"
- salary: Salary if found (or "Not listed")
- industry: Correct classification

**D. Re-evaluate Fit Score**
Based on your research, if fit score seems wrong:
- call \`update_job(jobId, {fitScore: newScore})\`
- call \`add_job_note(jobId, "Fit Adjusted", "Reason for change")\`

### Step 3: Summary Report

After all updates are applied, provide:

### 📊 Pipeline Overview
- Total jobs reviewed: X
- Active postings: X
- Archived (closed): X
- Hiring managers found: X

### 🔄 Changes Made
| Job ID | Company | Action | Details |
|--------|---------|--------|---------|

### 👤 Hiring Managers Found
| Company | Name | Title | LinkedIn |
|---------|------|-------|----------|

### 🎯 Top Priority Actions
1. [Highest priority - apply immediately]
2. [Second priority]
3. [Interview follow-ups]

**Note:** All changes are saved directly to the dashboard. User will refresh browser to see updates.

## Today's Date: ${new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })}`;

// Initialize storage
let filterStates = {
    'all': 'active',
    'apply-now': 'active',
    'maybe': 'active',
    'applied': 'active',
    'probably-not': 'active',
    'archived': 'active'
};

async function initStorage() {
    try {
        const stored = await window.storage.get('job-tracker-data');
        if (stored && stored.value) {
            const parsed = JSON.parse(stored.value);
            return parsed;
        }
    } catch (e) {
        // Storage error - fall through to sample jobs
    }

    const sampleJobs = getSampleJobs();
    return {
        jobs: sampleJobs,
        lastSearch: "2026-01-24T22:00:00Z",
        searchHistory: [
            {
                timestamp: "2026-01-24T22:00:00Z",
                jobsFound: 0,
                newJobs: 0,
                sources: ["Status Check"],
                notes: "Job Status Verification: Checked 11 non-archived jobs. Found 7 CLOSED (NDWA, Sollis Health, Lexia, Chorus, Boston Children's, Givebutter, Sincere - all archived). 2 UNCERTAIN (Age of Learning, Jobgether - 403 errors). 1 ACTIVE (East Boston - interview confirmed 1/27). Updated Status Check prompt to skip archived/rejected jobs."
            },
            {
                timestamp: "2026-01-24T18:30:00Z",
                jobsFound: 5,
                newJobs: 5,
                sources: ["Lever", "Greenhouse", "Foundation List", "Built In"],
                notes: "Round 1-3 Board Evaluation: Tested 15 boards, added 5 jobs (Alma 86, M+R 84, Abortion in America 83, Arcadia 82, Omada 81). Dropped JazzHR, BambooHR, iCIMS. Tier 1: Lever, Greenhouse, Foundation List."
            },
            {
                timestamp: "2026-01-22T03:30:00Z",
                jobsFound: 117,
                newJobs: 17,
                sources: ["Indeed", "LinkedIn", "Glassdoor", "Idealist", "Built In", "Media Bistro", "Foundation List", "Breezy HR", "Greenhouse", "Lever", "Workday", "MeetLifeSciences"]
            }
        ],
        filters: {},
        pdfArchive: []
    };
}

// Save data (to localStorage and optionally to server)
async function saveData(data) {
    try {
        await window.storage.set('job-tracker-data', JSON.stringify(data));

        // Auto-sync to server if running on localhost (fire and forget)
        if (typeof autoSyncToServer === 'function') {
            autoSyncToServer().catch(() => {}); // Silent fail for auto-sync
        }
    } catch (e) {
        throw new Error(`Failed to save data: ${e.message}`);
    }
}

// Jobs from comprehensive search - Jan 22, 2026
function getSampleJobs() {
    return [
        {
            id: 1,
            title: "VP, Creative",
            company: "Media Cause",
            industry: "Nonprofit Marketing Agency",
            location: "Remote (US) - DC/Atlanta/SF/Boston offices",
            salary: "$160k-$220k (estimated)",
            fitScore: 98,
            status: "applied",
            posted: "2025-11-14",
            found: "2025-11-14",
            applied: "2025-11-17",
            followup: null,
            url: "https://media-cause.breezy.hr/p/614f670c806a-vp-creative",
            symbols: ["❌"],
            connections: ["Sarah Dunlap (former PIH colleague)"],
            sources: ['Breezy HR'],
            notes: "REJECTED. Sarah Dunlap (former PIH colleague) referred. Went through multiple rounds of interviews. Great mission/role fit but didn't make final cut. Dropped after final rounds. Perfect fit: Mission-driven agency serving ONLY nonprofits, lead creative AND content departments, 50+ team, remote-first."
        },
        {
            id: 2,
            title: "Vice President of Creative",
            company: "EF Education First",
            industry: "Education (International)",
            location: "Boston, MA",
            salary: "$200k-$240k",
            fitScore: 95,
            status: "apply-now",
            posted: "2026-01-15",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "",
            symbols: ["💰"],
            connections: [],
            
            sources: ['Indeed', 'LinkedIn'],
            notes: "🔗 URL needed - check application email | Dream sector (education) + Boston + VP level. Data-rich environment. 'Approach creative as business partnership' aligns with your philosophy. Highest disclosed salary in search."
        },
        {
            id: 3,
            title: "Senior Creative Director",
            company: "National Domestic Workers Alliance",
            industry: "Labor Rights / Advocacy Nonprofit",
            location: "Remote (Roslindale, MA office)",
            salary: "$130k-$170k (estimated)",
            fitScore: 92,
            status: "apply-now",
            posted: "2026-01-10",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "https://ndwa.hrmdirect.com/employment/job-opening.php?req=3333522&req_loc=628514",
            symbols: [],
            connections: [],
            
            sources: ['Idealist'],
            notes: "⚠️ POSTING MAY BE OUTDATED - URL found but job may no longer be accepting applications (start date was Jan 5, 2026). Idealist showed outdated posting. | 501(c)(4) advocacy org. Lead Content Department (design director, graphic designer, video). Reports to VP Brand. Political advocacy + economic justice mission. $122K-$144K disclosed."
        },
        {
            id: 4,
            title: "Creative Director",
            company: "Human Rights Foundation",
            industry: "Human Rights Nonprofit",
            location: "New York, NY (Hybrid)",
            salary: "$120k-$160k (estimated)",
            fitScore: 90,
            status: "apply-now",
            posted: "2026-01-08",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "",
            symbols: [],
            connections: [],
            
            sources: ['Idealist'],
            notes: "⚠️ POSTING NOT FOUND - URL missing, likely outdated. Idealist shows stale postings. | Manage creative team + contractors. Oslo Freedom Forum conference series (global impact). 10+ years exp required. Comprehensive benefits, flex PTO, hybrid. Visual identity + brand consistency focus."
        },
        {
            id: 5,
            title: "Design Director for Social Impact",
            company: "Constructive",
            industry: "Social Impact Design Agency",
            location: "Remote (F/T)",
            salary: "$130k-$145k + variable comp",
            fitScore: 88,
            status: "apply-now",
            posted: "2026-01-12",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "",
            symbols: [],
            connections: [],
            
            sources: ['Idealist'],
            notes: "⚠️ POSTING NOT FOUND - URL missing, likely outdated. Idealist shows stale postings. | Lead visual design practice, manage design team. Reports to Founder & Creative Director. Clients: nonprofits, social impact orgs. Management team member with ongoing leadership investment."
        },
        {
            id: 6,
            title: "Group Creative Director",
            company: "Bully Pulpit International",
            industry: "Public Affairs Agency",
            location: "Not specified (likely NYC/DC/Remote)",
            salary: "$175k-$250k (estimated)",
            fitScore: 85,
            status: "maybe",
            posted: "2026-01-05",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "",
            symbols: ["💰", "❓"],
            connections: [],
            
            sources: ['Indeed'],
            notes: "🔗 URL needed - check application email | Serves 'movement-defining nonprofits'. Award-caliber work focus. Public affairs + social impact. Need to confirm remote options and get full job post details."
        },
        {
            id: 7,
            title: "Executive Creative Director",
            company: "Various (Boston)",
            industry: "Various",
            location: "Boston, MA",
            salary: "Not listed",
            fitScore: 82,
            status: "maybe",
            posted: "2026-01-18",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "",
            symbols: ["⚡", "❓"],
            connections: [],
            
            sources: ['LinkedIn'],
            notes: "❌ 'Various (Boston)' not a specific company - needs clarification | Boston location, ECD level, actively hiring per LinkedIn (4 days ago). Need more research on specific company. Placeholder for investigation."
        },
        {
            id: 8,
            title: "VP, Brand and Creative",
            company: "SimpliSafe",
            industry: "Tech (Home Security)",
            location: "Boston, MA",
            salary: "$180k-$240k (estimated)",
            fitScore: 75,
            status: "maybe",
            posted: "2026-01-10",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "",
            symbols: ["💰"],
            connections: [],
            
            sources: ['Indeed'],
            notes: "🔗 URL needed - check application email | Boston, VP level, strong salary likely. RED FLAG: Commercial tech (not mission-driven), but Boston location strong. Consider for backup."
        },
        {
            id: 9,
            title: "VP, Creative",
            company: "Bose",
            industry: "Consumer Electronics",
            location: "Manhattan, NY",
            salary: "$254k-$339k",
            fitScore: 72,
            status: "probably-not",
            posted: "2026-01-12",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "",
            symbols: ["💰"],
            connections: [],
            
            sources: ['Indeed', 'LinkedIn'],
            notes: "🔗 URL needed - check application email | Exceptional salary, VP level. RED FLAGS: Corporate, NYC, not mission-driven. High pay but low mission alignment. Keep as backup only."
        },
        {
            id: 10,
            title: "Digital Creative Director",
            company: "Interactive Strategies",
            industry: "Digital Agency",
            location: "Washington, DC",
            salary: "Not listed",
            fitScore: 70,
            status: "probably-not",
            posted: "2026-01-08",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "",
            symbols: ["❓"],
            connections: [],
            
            sources: ['Indeed'],
            notes: "🔗 URL needed - check application email | 10+ years creative roles, brand leadership required. Need to research mission alignment and client roster. DC location workable but not ideal."
        },
        {
            id: 11,
            title: "Creative Director (Art) - Healthcare",
            company: "Rare Disease Healthcare Agency",
            industry: "Healthcare Communications",
            location: "Remote",
            salary: "Not listed",
            fitScore: 78,
            status: "maybe",
            posted: "2026-01-15",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "",
            symbols: ["❓"],
            connections: [],
            
            sources: ['MeetLifeSciences'],
            notes: "❌ Generic company name - needs actual agency name | Full-service healthcare comms agency specializing in rare disease. Remote. Need more details on agency name and mission alignment. Commercial pharma likely."
        },
        {
            id: 12,
            title: "VP, Brand Creative",
            company: "The Cape Agency",
            industry: "Marketing Agency",
            location: "Remote (US)",
            salary: "Not listed",
            fitScore: 68,
            status: "probably-not",
            posted: "2026-01-10",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "",
            symbols: ["❓"],
            connections: [],
            sources: ["Indeed"],
            
            sources: ['Indeed'],
            notes: "🔗 URL needed - reported: link goes to search results | Mortgage/financial services company. Remote, VP level. RED FLAG: Financial services sector, not mission-driven. Low priority unless desperate."
        },
        {
            id: 13,
            title: "VP, Brand & Creative Services",
            company: "Sollis Health",
            industry: "Healthcare (Concierge Medical)",
            location: "New York, NY (135 E 57th St)",
            salary: "$200k-$280k (estimated)",
            fitScore: 82,
            status: "maybe",
            posted: "2026-01-18",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "https://job-boards.greenhouse.io/sollishealth/jobs/6598247003",
            symbols: ["💰"],
            connections: [],
            sources: ["Greenhouse"],
            
            sources: ['Greenhouse'],
            notes: "✅ Direct Greenhouse link | 24/7 on-demand medical membership. Category-defining healthcare brand. Own end-to-end brand strategy. 10-15+ years required. NYC location (not Boston). For-profit concierge medicine (less mission-driven than PIH)."
        },
        {
            id: 14,
            title: "Creative Director",
            company: "Age of Learning (ABCmouse)",
            industry: "Education Technology",
            location: "Remote",
            salary: "$180k-$240k",
            fitScore: 88,
            status: "apply-now",
            posted: "2026-01-15",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "https://jobs.lever.co/aofl/f9a40670-91b7-41ae-819e-36b4944efdc9",
            symbols: ["💰"],
            connections: [],
            sources: ["Lever"],
            
            sources: ['Lever'],
            notes: "✅ Direct Lever link | DREAM SECTOR: Education tech serving 50M+ children globally. Remote, high disclosed salary. Own experience system for ABCmouse. Lead visual design, game mechanics, educational outcomes. Mission: advance equity/access for all children. Product/UX focus (less traditional brand)."
        },
        {
            id: 15,
            title: "Creative Director",
            company: "Lexia Learning",
            industry: "Education Technology (Literacy)",
            location: "Concord, MA (Remote)",
            salary: "$135k-$155k (estimated)",
            fitScore: 92,
            status: "applied",
            posted: "2026-01-14",
            found: "2026-01-22",
            applied: "2026-01-22",
            followup: null,
            url: "https://cambiumlearning.wd1.myworkdayjobs.com/en-US/camb/job/Creative-Director_REQ-4250",
            symbols: [],
            connections: [],
            sources: ['Workday'],
            notes: "✅ Direct Workday link | Applied 1/22/2026. PERFECT FIT: Education + literacy mission, Boston area location (Concord). Lead brand visual direction, campaign concepts, design strategy. Manage graphic designers. Part of Cambium Learning Group. Science-backed reading instruction."
        },
        {
            id: 16,
            title: "Creative Director, Brand",
            company: "Chorus Innovations",
            industry: "Health Tech (Public Health)",
            location: "Not specified",
            salary: "Not listed (+ bonus + stock options)",
            fitScore: 85,
            status: "apply-now",
            posted: "2026-01-16",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "https://boards.greenhouse.io/chorusinnovations/jobs/4231451007",
            symbols: ["❓"],
            connections: [],
            sources: ["Greenhouse"],
            
            sources: ['Greenhouse'],
            notes: "✅ Direct Greenhouse link | MISSION-DRIVEN: Democratizing health tech for institutions/public health agencies. Powers transformative healthcare, biomedical research, community health. Reports to VP Design. Startup (stock options). Location unclear - need to confirm."
        },
        {
            id: 17,
            title: "Creative Director",
            company: "Jobgether (Digital Learning Partner)",
            industry: "Education Technology",
            location: "Remote (US)",
            salary: "$135k-$155k",
            fitScore: 78,
            status: "maybe",
            posted: "2026-01-17",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "https://jobs.lever.co/jobgether/ea7c4939-c988-4a85-bfb4-d8dd54d2eaef",
            symbols: [],
            connections: [],
            sources: ["Lever"],
            notes: "✅ Direct Lever link | Digital learning platform. Remote US. Lead creative team, define vision. AI tools focus. Portfolio required. Lower salary range. Via recruiting platform (actual company unclear)."
        },
        {
            id: 18,
            title: "Director of Marketing and Communications",
            company: "East Boston Social Centers",
            industry: "Nonprofit (Community Services)",
            location: "East Boston, MA",
            salary: "Not listed",
            fitScore: 76,
            status: "applied",
            posted: "2026-01-10",
            found: "2026-01-10",
            applied: "2026-01-12",
            followup: null,
            url: "https://www.indeed.com/viewjob?jk=bd24d45ec90e04ae",
            symbols: ["❤️"],
            connections: [],
            sources: ["Indeed"],
            notes: "✅ INTERVIEW SCHEDULED MONDAY 1/27 @ NOON with Nicki Ruiz de Luzuriaga (Interim CDO)\n\n📄 **FULL PREP DOC:** docs/EBSC_Master_Interview_Prep.md (67KB comprehensive guide)\n\nApplied 1/12 via Indeed. Score bumped 68→76: Working directly with MY community (East Boston) = unique personal value.\n\n**YOUR SECRET WEAPON:** You ARE the community (East Boston resident since 2019, immigrant from Korea, toddler attends EBSC programs)\n\n**THE FIVE PILLARS OF JOY (Learn Cold):**\n1. Relationships - 'long and strong' connections\n2. Purpose - meaningful contribution\n3. Fitness - physical wellbeing\n4. Mindfulness - presence\n5. Fun - enjoyment\n\n**CRITICAL QUESTIONS TO ASK:**\n1. Clarify reporting structure (Nicki or Justin?)\n2. Team structure beyond Carolina (who do you manage?)\n3. Budget for contractors/tools/campaigns?\n\n**60-SECOND INTRO:**\n'I've spent 9 years at Partners In Health scaling creative ops from solo to 10-person team across 11 countries. Driven 52% digital fundraising growth, built enterprise systems. What excites me about EBSC is bringing that nonprofit expertise home—I live in East Boston, my family is part of this community, I want to help tell your story.'\n\n**KEY METRICS:** 80% retention, 52% fundraising growth ($11M→$16.7M), 91% org revenue ($131M→$250M)\n\n**NICKI'S PRIORITY:** Integrated comms/development. Show you understand fundraising support.\n\n**BOARD INTEL:** Nicki likely to become permanent CDO. EBSC 'does too many things'—narrative cohesion is your value-add.\n\n**SALARY:** $85K-$95K (below market but community connection + mission = worth it)\n\n**POST-INTERVIEW:** Thank you email within 2 hours, reinforce community connection."
        },
        {
            id: 19,
            title: "Customer Success Manager",
            company: "Anthropic",
            industry: "AI/Technology",
            location: "Remote or San Francisco",
            salary: "Not listed",
            fitScore: 25,
            status: "applied",
            posted: "2026-01-14",
            found: "2026-01-14",
            applied: "2026-01-14",
            followup: null,
            url: "",
            symbols: [],
            connections: [],
            sources: [],
            notes: "🔗 URL needed - check application email | Applied directly. Pending response. HARD PASS FIT: Customer Success ≠ Creative Director. Outside creative track entirely. Why applied?"
        },
        {
            id: 20,
            title: "Director of Creative Services and Marketing Communications",
            company: "Evident Scientific",
            industry: "Life Sciences/Healthcare Technology",
            location: "Waltham, MA (Hybrid)",
            salary: "$175k-$199k + 20% bonus",
            fitScore: 82,
            status: "applied",
            posted: "2026-01-20",
            found: "2026-01-20",
            applied: "2026-01-20",
            followup: null,
            url: "",
            symbols: ["💰", "🏢"],
            connections: [],
            sources: [],
            notes: "⚠️ Posting closed - applied 1/20/2026 | Applied 1/20/2026. PE-backed life sciences company (Olympus spinoff). Best disclosed salary applied to. Healthcare adjacent mission. Strong follow-up candidate after 2 weeks (Feb 3)."
        },
        {
            id: 21,
            title: "Graphic Designer III",
            company: "Boston Children's Hospital",
            industry: "Healthcare (Pediatric Hospital)",
            location: "Boston, MA",
            salary: "$78k-$126k",
            fitScore: 45,
            status: "applied",
            posted: "2025-11-24",
            found: "2025-11-24",
            applied: "2025-11-24",
            followup: null,
            url: "https://jobs.bostonchildrens.org/job/22597473/graphics-designer-iii-trust-boston-ma/",
            symbols: ["❤️"],
            connections: [],
            sources: ["LinkedIn"],
            notes: "IC role (no reports). Spoke with Kim (HR) 11/24. Personal mission connection (toddler with rare condition). OVERQUALIFIED: HR flagged title/salary concerns. Heart says yes, head says no. 40-50% pay cut."
        },
        {
            id: 22,
            title: "Creative Director",
            company: "Givebutter",
            industry: "Nonprofit Technology",
            location: "Remote",
            salary: "$215k-$240k",
            fitScore: 92,
            status: "applied",
            posted: "2025-12-10",
            found: "2025-12-10",
            applied: "2025-12-12",
            followup: null,
            url: "https://jobs.ashbyhq.com/givebutter/ee5bb880-11fc-4ad0-a5c9-b72acbd5f544",
            symbols: ["💰", "🚀"],
            connections: ["Jeizzon Viana Mendes (VP Design)"],
            sources: ["Ashby"],
            notes: "TOP MATCH: Best overall fit in pipeline. Nonprofit tech ($7B+ processed). Highest disclosed salary. Remote. Build brand design team, templates, guidelines. Connected with VP Design. Strong follow-up if no response."
        },
        {
            id: 23,
            title: "Senior Director of Creative",
            company: "Berklee College of Music",
            industry: "Higher Education (Arts/Music)",
            location: "Boston, MA (Hybrid)",
            salary: "$132k-$160k",
            fitScore: 95,
            status: "applied",
            posted: "2025-11-25",
            found: "2025-11-25",
            applied: "2025-11-26",
            followup: null,
            url: "",
            symbols: ["🎵", "❤️"],
            connections: ["MJ Kim (CMO)", "Amy Carzo (referral)"],
            sources: [],
            notes: "⚠️ Posting closed/filled - applied 11/26/2025 to MJ Kim | DREAM FIT: Exact title match (Senior Director). Education + Arts + Music = dream sector. Boston. Hybrid. Amy Carzo referral to MJ Kim (CMO). Strong follow-up via Amy/MJ."
        },
        {
            id: 24,
            title: "Creative Operations",
            company: "Drata",
            industry: "Security/Compliance SaaS",
            location: "Remote",
            salary: "Not listed",
            fitScore: 55,
            status: "applied",
            posted: "2025-12-10",
            found: "2025-12-10",
            applied: "2025-12-10",
            followup: null,
            url: "",
            symbols: [],
            connections: [],
            sources: [],
            notes: "🔗 URL needed - check application email | Creative ops role (less strategic). No mission alignment. Title/level unclear. Why applied?"
        },
        {
            id: 25,
            title: "Senior Manager, Design",
            company: "Sincere",
            industry: "Technology (Sympathy/Condolences)",
            location: "Framingham, MA (Hybrid)",
            salary: "$100k-$130k",
            fitScore: 62,
            status: "applied",
            posted: "2025-11-11",
            found: "2025-11-11",
            applied: "2025-11-11",
            followup: null,
            url: "https://apply.workable.com/sincere/j/CCB8676A7A/",
            symbols: ["❌"],
            connections: ["Emma (works at Sincere)"],
            sources: ["Workable"],
            notes: "REJECTED. Emma (friend at company) referred. Went through multiple interviews + homework. Title downgrade + 30-40% pay cut = not worth it. Referrals work but salary/title still matters."
        },
        {
            id: 26,
            title: "Creative Director",
            company: "Tufts University",
            industry: "Higher Education",
            location: "Medford/Somerville, MA",
            salary: "Not listed (likely $140k-$180k)",
            fitScore: 93,
            status: "applied",
            posted: "2025-10-10",
            found: "2025-10-10",
            applied: "2025-10-10",
            followup: null,
            url: "",
            symbols: ["🎓"],
            connections: ["MJ Kim (CMO)", "Amy Carzo (referral)"],
            sources: [],
            notes: "⚠️ Posting taken down - applied 10/10/2025 to MJ Kim | TOP 3 FIT: Higher ed dream sector. Direct CMO partnership (MJ Kim). Amy Carzo referral. Boston area. Posting taken down due to volume, submitted directly via email. Strong follow-up via Amy/MJ."
        },
        {
            id: 27,
            title: "Director, Catalog Visual Creative",
            company: "Universal Music Group",
            industry: "Music Industry (Record Label)",
            location: "Santa Monica, CA",
            salary: "$140k-$190k (estimated)",
            fitScore: 85,
            status: "research",
            posted: "2026-01-22",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "https://umusic.wd5.myworkdayjobs.com/en-US/UMGUS/job/Santa-Monica-California/Director--Catalog-Visual-Creative_UMG-24371",
            symbols: ["🎵"],
            connections: [],
            sources: ["Workday"],
            notes: "✅ Direct Workday link | DREAM SECTOR: Music industry! Education + arts + MUSIC intersection. Lead visual creative for UMG music catalog. Santa Monica location (not Boston, but MUSIC!). Major record label with established artists."
        },
        {
            id: 28,
            title: "Executive Creative Director",
            company: "Cramer",
            industry: "Experiential Marketing Agency (Events, Brand Experiences)",
            location: "Norwood, MA",
            salary: "$150k-$190k (estimated)",
            fitScore: 83,
            status: "research",
            posted: "2026-01-22",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "https://www.theladders.com/job/executive-creative-director-cramerkrasselt-norwood-ma_85276865",
            symbols: [],
            connections: [],
            sources: ["The Ladders"],
            notes: "⚠️ Need direct careers URL | PERFECT LOCATION: Norwood, MA (Boston suburb). Executive Creative Director = perfect title. Founded by US Olympian, 40+ years, Boston Globe Top Places to Work. Lead experiential/live event marketing. B2B focus with tech, healthcare, financial clients. Need to find direct Cramer careers link."
        },
        {
            id: 29,
            title: "Senior Designer / Design Director",
            company: "Sandberg Goldberg Bernthal Family Foundation",
            industry: "Family Foundation (Philanthropy)",
            location: "United States (likely remote)",
            salary: "$120k-$160k (estimated)",
            fitScore: 82,
            status: "research",
            posted: "2026-01-22",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "",
            symbols: ["❤️"],
            connections: [],
            sources: ["LinkedIn"],
            notes: "⚠️ NO URL - need to find foundation careers page or LinkedIn posting | PERFECT MISSION: Family foundation (Paul Rudd + others), social impact philanthropy. Design Director level. US-based, likely remote or LA. Need URL to verify posting still active."
        },
        {
            id: 30,
            title: "Associate Creative Director, Art",
            company: "WHOOP",
            industry: "Health/Fitness Wearables",
            location: "Boston, MA (or NYC)",
            salary: "$150k-$190k + equity",
            fitScore: 81,
            status: "research",
            posted: "2026-01-22",
            found: "2026-01-22",
            applied: null,
            followup: null,
            url: "https://jobs.lever.co/whoop/175eca0e-8fa1-4c93-a482-dd8040704a1d",
            symbols: ["💰"],
            connections: [],
            sources: ["Lever"],
            notes: "✅ Direct Lever link | PERFECT LOCATION: Boston HQ (or NYC option). Health/wellness mission. Associate Creative Director = slight step down but senior. $150K-$190K disclosed salary + equity. Lead brand visual expression, mentor designers. Fast-growing health tech."
        },
        {
            id: 31,
            title: "Creative Director, Product",
            company: "Ethos Life",
            industry: "InsurTech (Life Insurance)",
            location: "Remote US",
            salary: "$126k-$224k",
            fitScore: 80,
            status: "research",
            posted: "2026-01-14",
            found: "2026-01-14",
            applied: null,
            followup: null,
            url: "https://job-boards.greenhouse.io/ethoslife/jobs/8328097002",
            symbols: ["💰"],
            connections: [],
            sources: ["Greenhouse"],
            notes: "✅ Direct Greenhouse link | BORDERLINE: Right at 80/100 threshold. Remote US = perfect location. $126K-$224K disclosed (excellent range). Life insurance tech with accessibility mission (not nonprofit). Lead small creative team, B2C storytelling, product + lifecycle marketing. 10+ years required. Commercial but some social good angle."
        },
        {
            id: 32,
            title: "Creative Director",
            company: "Alma",
            industry: "Mental Health Tech",
            location: "Remote (Contiguous US)",
            salary: "Not disclosed",
            fitScore: 86,
            status: "apply-now",
            posted: "2026-01-15",
            found: "2026-01-24",
            applied: null,
            followup: null,
            url: "https://job-boards.greenhouse.io/alma/jobs/8035297002",
            symbols: ["❤️"],
            connections: [],
            sources: ["Greenhouse"],
            notes: "✅ Direct Greenhouse link | PERFECT MISSION: Simplifying access to high-quality, affordable mental health care. Reports to SVP Brand & Marketing. Lead + grow creative team. Mental health benefits mission. Inc's Best Workplaces 2022-2024. $220.5M funded. 20K+ therapist network. 6+ years creative leadership required. Visual innovator + storytelling focus. Remote US."
        },
        {
            id: 33,
            title: "Advertising Associate Creative Director",
            company: "M+R",
            industry: "Nonprofit Advertising Agency",
            location: "Remote US",
            salary: "Not disclosed",
            fitScore: 84,
            status: "apply-now",
            posted: "2026-01-18",
            found: "2026-01-24",
            applied: null,
            followup: null,
            url: "https://jobs.lever.co/mrss/07f17be9-fb5f-4765-90c5-6623e17c4de6",
            symbols: ["❤️"],
            connections: [],
            sources: ["Lever"],
            notes: "✅ Direct Lever link | DREAM MISSION: ONLY works with nonprofit clients. Planned Parenthood, League of Conservation Voters, PETA clients. Remote-first org with DC/NYC/Oakland offices. Run advertising campaigns that create change. Progressive nonprofits focus. Big + tiny campaigns. Fast-paced deadline-driven. Perfect mission alignment."
        },
        {
            id: 34,
            title: "Creative Director",
            company: "Abortion in America",
            industry: "Reproductive Justice Nonprofit",
            location: "Remote US",
            salary: "$160k-$185k",
            fitScore: 83,
            status: "apply-now",
            posted: "2026-01-20",
            found: "2026-01-24",
            applied: null,
            followup: null,
            url: "https://abortioninamerica.org/current-openings/",
            symbols: ["❤️", "💰"],
            connections: [],
            sources: ["Foundation List"],
            notes: "✅ Foundation List org careers page | BOLD MISSION + DISCLOSED SALARY! National initiative reclaiming power through personal stories. Executive-level Creative Director. Reports to Executive Director. Shape brand identity, creative vision, storytelling across platforms (video, audio, written). Build something new from ground up. Reproductive freedom fight. Remote with travel for events/filming. $160K-$185K + 100% health/dental/vision. HIDDEN GEM - only found on Foundation List!"
        },
        {
            id: 35,
            title: "Creative Director",
            company: "Arcadia",
            industry: "Healthcare Data Analytics",
            location: "Remote-friendly",
            salary: "Not disclosed",
            fitScore: 82,
            status: "apply-now",
            posted: "2026-01-12",
            found: "2026-01-24",
            applied: null,
            followup: null,
            url: "https://jobs.lever.co/arcadia/6c27c1e2-642a-485c-bed0-2da5519d6f0b",
            symbols: ["❤️"],
            connections: [],
            sources: ["Lever"],
            notes: "✅ Direct Lever link | Healthcare mission: Transforming healthcare to reduce cost while improving patient health. Population health management software leader. Reports to VP Marketing. Build + lead content/creative team. Define B2B content strategy. Digital-first approach. Executive producer for HIMSS + annual customer event. Multi-faceted role. Remote position when safe. Hybrid future."
        },
        {
            id: 36,
            title: "Creative Director",
            company: "Omada Health",
            industry: "Digital Health (Chronic Disease)",
            location: "Remote",
            salary: "Not disclosed",
            fitScore: 81,
            status: "apply-now",
            posted: "2026-01-16",
            found: "2026-01-24",
            applied: null,
            followup: null,
            url: "https://builtin.com/job/creative-director/2516470",
            symbols: ["❤️"],
            connections: [],
            sources: ["Built In"],
            notes: "✅ Built In link | Healthcare mission: Chronic disease management (diabetes, hypertension, behavioral health). 1,800+ customers including Fortune 500. Virtual care programs that are clinically supported + evidence-based. Lead in-house creative team + external partners. B2B + B2C creative. Healthcare & Life Sciences agency/in-house experience required. 7+ years. Customer-obsessed entrepreneur. Great Place to Work certified."
        },
        {
            id: 37,
            title: "Product Design Manager",
            company: "College Board",
            industry: "Education (Nonprofit - Testing/College Access)",
            location: "Remote or New York, NY",
            salary: "$140k-$180k (estimated)",
            fitScore: 96,
            status: "apply-now",
            posted: "2026-01-20",
            found: "2026-01-25",
            applied: null,
            followup: null,
            url: "",
            symbols: ["❤️", "💰", "🏠"],
            connections: [],
            sources: ["Job Board Evaluation"],
            notes: "🔗 URL NEEDED | HIGH PRIORITY - 96/100 fit score! Education nonprofit (SAT, AP, CLEP). Mission: connect students to college success. Design leadership role. Strong mission alignment + salary potential. Remote option available. Need to find application link."
        }
    ];
}

// Copy browser research command (for Claude with browser MCP)
function copyBrowserResearchPrompt() {
    const btn = event ? event.target : null;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(BROWSER_RESEARCH_COMMAND).then(() => {
            if (btn) {
                const originalText = btn.innerHTML;
                const originalBg = btn.style.background || '#2563eb';
                const originalColor = btn.style.color || 'white';
                btn.innerHTML = '✅ Copied! Paste in Claude';
                btn.style.background = '#2e7d32';
                btn.style.color = 'white';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.background = originalBg;
                    btn.style.color = originalColor;
                }, 3000);
            }
        }).catch(() => {
            showBrowserResearchModal();
        });
    } else {
        showBrowserResearchModal();
    }
}

function showBrowserResearchModal() {
    const modal = document.getElementById('commandModal');
    const textarea = document.getElementById('commandText');
    const title = document.querySelector('#commandModal h3');
    if (title) title.textContent = '🌐 Browser Research Prompt';
    textarea.value = BROWSER_RESEARCH_COMMAND;
    modal.classList.add('active');
}

// Copy search command
function copySearchCommand() {
    const btn = event ? event.target : document.querySelector('.copy-btn');
    
    // Try modern clipboard API first (but log failures for debugging)
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(SEARCH_COMMAND).then(() => {
            const originalText = btn.innerHTML;
            const originalBg = btn.style.background || '#7c3aed';
            const originalColor = btn.style.color || 'white';
            btn.innerHTML = '✅ Copied! Paste in Claude';
            btn.style.background = '#2e7d32';
            btn.style.color = 'white';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = originalBg;
                btn.style.color = originalColor;
            }, 3000);
        }).catch(() => {
            tryExecCommandCopy(btn);
        });
    } else {
        tryExecCommandCopy(btn);
    }
}

function tryExecCommandCopy(btn) {
    const textArea = document.createElement('textarea');
    textArea.value = SEARCH_COMMAND;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            const originalText = btn.innerHTML;
            const originalBg = btn.style.background || '#7c3aed';
            const originalColor = btn.style.color || 'white';
            btn.innerHTML = '✅ Copied! Paste in Claude';
            btn.style.background = '#2e7d32';
            btn.style.color = 'white';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = originalBg;
                btn.style.color = originalColor;
            }, 3000);
        } else {
            showCommandModal();
        }
    } catch (e) {
        if (textArea.parentNode) {
            document.body.removeChild(textArea);
        }
        showCommandModal();
    }
}

// Copy status check command
function copyStatusCheckCommand() {
    const btn = event ? event.target : null;
    
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(STATUS_CHECK_COMMAND).then(() => {
            if (btn) {
                const originalText = btn.innerHTML;
                btn.innerHTML = '✅ Copied! Paste in Claude';
                const originalBg = btn.style.background;
                btn.style.background = '#059669';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.background = originalBg;
                }, 3000);
            }
        }).catch(() => {
            tryStatusCheckExecCommand(btn);
        });
    } else {
        tryStatusCheckExecCommand(btn);
    }
}

function tryStatusCheckExecCommand(btn) {
    const textArea = document.createElement('textarea');
    textArea.value = STATUS_CHECK_COMMAND;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
            if (btn) {
                const originalText = btn.innerHTML;
                btn.innerHTML = '✅ Copied! Paste in Claude';
                const originalBg = btn.style.background;
                btn.style.background = '#059669';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.background = originalBg;
                }, 3000);
            }
        } else {
            alert('Please manually copy the status check command from the modal that will appear.');
        }
    } catch (e) {
        if (textArea.parentNode) {
            document.body.removeChild(textArea);
        }
        alert('Copy failed. Please try again or manually copy the command.');
    }
}

// Copy Deep Research command for Claude Chat with MCP
function copyDeepResearchPrompt() {
    try {
        const data = window.currentData;
        if (!data || !data.jobs) {
            showToast('Data not loaded yet. Please wait and try again.', 'error');
            return;
        }
        const jobCount = data.jobs.filter(j => j.status !== 'archived').length;
        const prompt = DEEP_RESEARCH_COMMAND.replace('{JOB_COUNT}', jobCount);

        // Always show the modal for reliability (clipboard API is unreliable on file://)
        showDeepResearchModal(prompt);

    } catch (err) {
        alert('Error in Deep Research: ' + err.message);
    }
}

function showDeepResearchModal(prompt) {
    const modal = document.getElementById('commandModal');
    const textarea = document.getElementById('commandText');
    const title = document.getElementById('commandModalTitle');

    if (!modal) {
        alert('Error: commandModal not found');
        return;
    }
    if (!textarea) {
        alert('Error: commandText not found');
        return;
    }

    // Set title to indicate this is Deep Research
    if (title) {
        title.textContent = '🔬 Deep Research Prompt';
    }

    textarea.value = prompt;
    modal.classList.add('active');

    // Select the text for easy copying
    setTimeout(() => {
        textarea.focus();
        textarea.select();
    }, 100);
}

// Switch tabs
function switchTab(tabName, clickedElement) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Use the passed element or find the tab button by tabName
    if (clickedElement) {
        // Find the actual button if we clicked on the badge span
        const tabButton = clickedElement.closest('.tab') || clickedElement;
        tabButton.classList.add('active');
    } else {
        // Fallback: find tab button by matching onclick content
        const tabButtons = document.querySelectorAll('.tab');
        tabButtons.forEach(btn => {
            if (btn.id === tabName + 'Tab' || btn.textContent.toLowerCase().includes(tabName)) {
                btn.classList.add('active');
            }
        });
    }

    document.getElementById(tabName).classList.add('active');

    // Render board stats when filters tab is shown
    if (tabName === 'filters') {
        initStorage().then(data => {
            renderBoardStats(data.jobs);
        });
    }

    // Render documents when archive/documents tab is shown
    if (tabName === 'archive') {
        // Try server first if available, fall back to local
        if (isLocalServer()) {
            renderDocumentsFromServer();
        } else {
            renderDocuments();
        }
        updateStorageUsage();
    }

    // Refresh inbox when shown
    if (tabName === 'inbox') {
        loadInbox();
    }

    // Load analytics when shown
    if (tabName === 'analytics') {
        loadAnalytics();
    }

    // Load insights when shown
    if (tabName === 'insights') {
        loadInsights();
    }
}

// Playbook section toggle
function togglePlaybookSection(section) {
    const prompts = document.getElementById(section + '-prompts');
    const btn = prompts.parentElement.querySelector('button:last-of-type');
    if (prompts.style.display === 'none') {
        prompts.style.display = 'block';
        btn.textContent = 'Hide Prompts ▲';
    } else {
        prompts.style.display = 'none';
        btn.textContent = 'Show Prompts ▼';
    }
}

// Copy prompt to clipboard
function copyPrompt(button) {
    const pre = button.previousElementSibling;
    const text = pre.textContent;
    navigator.clipboard.writeText(text).then(() => {
        const originalText = button.textContent;
        button.textContent = '✓ Copied!';
        button.style.background = '#10b981';
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 2000);
    });
}

// Copy job info to clipboard (title, company, URL, notes)
function copyJobInfo(jobId) {
    if (!window.currentData || !window.currentData.jobs) return;

    const job = window.currentData.jobs.find(j => j.id === jobId);
    if (!job) return;

    // Build copy text with useful info
    const lines = [
        `${job.title} at ${job.company}`,
        job.url ? `URL: ${job.url}` : null,
        job.location ? `Location: ${job.location}` : null,
        job.salary ? `Salary: ${job.salary}` : null,
        job.notes ? `\nNotes:\n${job.notes}` : null
    ].filter(Boolean);

    const text = lines.join('\n');

    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById(`copyJobBtn-${jobId}`);
        if (btn) {
            btn.innerHTML = '✓ Copied!';
            btn.style.background = '#10b981';
            btn.style.color = 'white';
            setTimeout(() => {
                btn.innerHTML = '📋 Copy Info';
                btn.style.background = '#f3f4f6';
                btn.style.color = '';
            }, 2000);
        }
        showToast('Job info copied to clipboard');
    }).catch(err => {
        console.error('Copy failed:', err);
        showToast('Failed to copy', 'error');
    });
}

// Copy just the notes for a job
function copyJobNotes(jobId) {
    if (!window.currentData || !window.currentData.jobs) return;

    const job = window.currentData.jobs.find(j => j.id === jobId);
    if (!job || !job.notes) return;

    navigator.clipboard.writeText(job.notes).then(() => {
        const btn = document.getElementById(`copyNotesBtn-${jobId}`);
        if (btn) {
            btn.innerHTML = '✓ Copied!';
            btn.style.background = '#10b981';
            btn.style.color = 'white';
            setTimeout(() => {
                btn.innerHTML = '📋 Copy';
                btn.style.background = '#f3f4f6';
                btn.style.color = '';
            }, 2000);
        }
        showToast('Notes copied to clipboard');
    }).catch(err => {
        console.error('Copy failed:', err);
        showToast('Failed to copy', 'error');
    });
}

// ============================================
// DOCUMENT MANAGEMENT FUNCTIONS
// ============================================
let currentDocFilter = 'all';

// Handle global file upload (from Documents tab)
async function handleGlobalUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Ask which job to link to (or none)
    const jobId = await promptJobSelection(file.name);

    try {
        const docId = await DocStore.saveDocument(jobId, file, detectDocType(file.name));
        await renderDocuments();
        updateStorageUsage();
        showNotification(`✓ Uploaded: ${file.name}`);
    } catch (err) {
        console.error('Upload failed:', err);
        alert('Failed to upload file: ' + err.message);
    }

    event.target.value = ''; // Reset input
}

// Handle file upload for specific job
async function handleJobUpload(event, jobId, docType) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        await DocStore.saveDocument(jobId, file, docType);
        await renderDocuments();
        updateStorageUsage();
        showNotification(`✓ Uploaded: ${file.name}`);
        // Refresh job modal if open
        if (document.getElementById('jobModal').style.display === 'block') {
            const data = await initStorage();
            const job = data.jobs.find(j => j.id === jobId);
            if (job) openJobModal(job);
        }
    } catch (err) {
        console.error('Upload failed:', err);
        alert('Failed to upload file: ' + err.message);
    }

    event.target.value = '';
}

// Detect document type from filename
function detectDocType(filename) {
    const lower = filename.toLowerCase();
    if (lower.includes('resume') || lower.includes('cv')) return 'resume';
    if (lower.includes('cover') || lower.includes('letter')) return 'cover_letter';
    if (lower.includes('jd') || lower.includes('job') || lower.includes('description')) return 'job_description';
    if (lower.includes('research') || lower.includes('notes') || lower.includes('prep')) return 'research';
    return 'general';
}

// Prompt user to select a job to link document to
async function promptJobSelection(filename) {
    const data = await initStorage();
    const jobs = data.jobs.filter(j => j.status !== 'archived');

    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <h2>Link Document to Job</h2>
                <p style="color: #6c757d; margin: 10px 0;">Uploading: <strong>${escapeHtml(filename)}</strong></p>
                <p style="margin-bottom: 15px;">Select a job to link this document to, or choose "No Link" to upload without linking:</p>
                <select id="jobSelectForDoc" style="width: 100%; padding: 10px; border: 2px solid #e0e4e8; border-radius: 6px; margin-bottom: 15px;">
                    <option value="">-- No Link (General Document) --</option>
                    ${jobs.map(j => `<option value="${j.id}">${escapeHtml(j.company)} - ${escapeHtml(j.title)}</option>`).join('')}
                </select>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="this.closest('.modal').remove(); window._docResolve(null);" style="padding: 10px 20px; border: 2px solid #e0e4e8; background: white; border-radius: 6px; cursor: pointer;">Cancel</button>
                    <button onclick="const v = document.getElementById('jobSelectForDoc').value; this.closest('.modal').remove(); window._docResolve(v ? parseInt(v) : null);" class="btn-primary">Upload</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        window._docResolve = resolve;
    });
}

// Render documents in the Documents tab
async function renderDocuments() {
    const container = document.getElementById('documentsContainer');
    const noDocsMsg = document.getElementById('noDocuments');
    if (!container || !noDocsMsg) return;
    const data = await initStorage();

    try {
        const { documents, fileRefs } = await DocStore.getAllDocuments();
        const allDocs = [
            ...documents.map(d => ({ ...d, source: 'uploaded' })),
            ...fileRefs.map(r => ({ ...r, source: 'reference' }))
        ];

        // Filter by type
        const filtered = currentDocFilter === 'all'
            ? allDocs
            : allDocs.filter(d => d.type === currentDocFilter);

        if (filtered.length === 0) {
            container.innerHTML = '';
            noDocsMsg.style.display = 'block';
            return;
        }

        noDocsMsg.style.display = 'none';

        container.innerHTML = filtered.map(doc => {
            const job = doc.jobId ? data.jobs.find(j => j.id === doc.jobId) : null;
            const typeColors = {
                resume: '#10b981',
                cover_letter: '#3b82f6',
                job_description: '#f59e0b',
                research: '#8b5cf6',
                general: '#6c757d'
            };
            const typeLabels = {
                resume: '📄 Resume',
                cover_letter: '✉️ Cover Letter',
                job_description: '📋 Job Description',
                research: '🔍 Research',
                general: '📎 Document'
            };

            return `
                <div class="doc-card" style="background: white; border: 1px solid #e0e4e8; border-radius: 8px; padding: 15px; border-left: 4px solid ${typeColors[doc.type] || '#6c757d'};">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <span style="background: ${typeColors[doc.type] || '#6c757d'}; color: white; font-size: 11px; padding: 3px 8px; border-radius: 4px;">
                            ${typeLabels[doc.type] || 'Document'}
                        </span>
                        <button onclick="deleteDocument(${doc.id}, '${doc.source}')" style="background: none; border: none; color: #dc2626; cursor: pointer; font-size: 16px;" title="Delete">🗑️</button>
                    </div>
                    <h4 style="margin: 0 0 8px 0; font-size: 14px; word-break: break-word;">${escapeHtml(doc.name)}</h4>
                    ${job ? `<p style="color: #667eea; font-size: 12px; margin: 0 0 8px 0;">🔗 ${escapeHtml(job.company)}</p>` : ''}
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #6c757d;">
                        <span>${doc.source === 'uploaded' ? formatFileSize(doc.size || 0) : 'File Reference'}</span>
                        <span>${new Date(doc.uploadedAt || doc.addedAt).toLocaleDateString()}</span>
                    </div>
                    ${doc.source === 'uploaded' ? `
                        <button onclick="viewDocument(${doc.id})" style="margin-top: 10px; width: 100%; padding: 8px; background: #f7f9fc; border: 1px solid #e0e4e8; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            👁️ View
                        </button>
                    ` : `
                        <div style="margin-top: 10px; padding: 8px; background: #f7f9fc; border-radius: 4px; font-size: 11px; color: #6c757d; word-break: break-all;">
                            ${escapeHtml(doc.path)}
                        </div>
                    `}
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Failed to render documents:', err);
        container.innerHTML = '<p style="color: #dc2626;">Error loading documents</p>';
    }
}

// Filter documents by type
function filterDocuments(type) {
    currentDocFilter = type;
    document.querySelectorAll('#archive .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase().includes(type) || (type === 'all' && btn.textContent.includes('All')));
    });
    renderDocuments();
}

// View uploaded document
async function viewDocument(docId) {
    try {
        const { documents } = await DocStore.getAllDocuments();
        const doc = documents.find(d => d.id === docId);
        if (!doc) {
            alert('Document not found');
            return;
        }

        // Open in new tab
        const newWindow = window.open();
        if (doc.mimeType === 'application/pdf') {
            newWindow.document.write(`
                <html>
                <head><title>${escapeHtml(doc.name)}</title></head>
                <body style="margin:0;">
                    <embed src="${doc.data}" type="application/pdf" width="100%" height="100%" style="position:absolute;top:0;left:0;right:0;bottom:0;">
                </body>
                </html>
            `);
        } else {
            newWindow.document.write(`
                <html>
                <head><title>${escapeHtml(doc.name)}</title></head>
                <body>
                    <h1>${escapeHtml(doc.name)}</h1>
                    <p>File type: ${doc.mimeType}</p>
                    <a href="${doc.data}" download="${escapeHtml(doc.name)}">Download File</a>
                </body>
                </html>
            `);
        }
    } catch (err) {
        console.error('Failed to view document:', err);
        alert('Failed to open document');
    }
}

// Delete document
async function deleteDocument(id, source) {
    if (!confirm('Delete this document?')) return;

    try {
        if (source === 'uploaded') {
            await DocStore.deleteDocument(id);
        } else {
            await DocStore.deleteFileRef(id);
        }
        await renderDocuments();
        updateStorageUsage();
        showNotification('Document deleted');
    } catch (err) {
        console.error('Failed to delete:', err);
        alert('Failed to delete document');
    }
}

// Update storage usage display
async function updateStorageUsage() {
    try {
        const usage = await DocStore.getStorageUsage();
        document.getElementById('storageUsage').textContent = `${usage.count} files (${usage.formattedSize})`;
    } catch (err) {
        console.error('Failed to get storage usage:', err);
    }
}

// Show notification toast
function showNotification(message) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 10000; animation: slideIn 0.3s ease;';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Scan existing files and auto-link to jobs via server API
async function scanExistingFiles() {
    if (!isLocalServer()) {
        alert('Auto-linking requires the local server.\\n\\nRun: npm start\\nThen open: http://localhost:3000');
        return;
    }

    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '⏳ Scanning...';

    try {
        const response = await fetch('/api/documents/auto-link', { method: 'POST' });
        const result = await response.json();

        if (result.success) {
            showToast(`Linked ${result.linkedCount} documents to jobs`, 'success');
            // Refresh documents display
            await renderDocumentsFromServer();
            // Also sync to localStorage if needed
            await importFromMCP();
        } else {
            throw new Error(result.error || 'Auto-link failed');
        }
    } catch (err) {
        console.error('Scan error:', err);
        showToast('Failed to scan files: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🔄 Scan & Link Existing PDFs';
    }
}

// Render documents from server API
async function renderDocumentsFromServer() {
    if (!isLocalServer()) {
        return; // Fall back to localStorage-based rendering
    }

    const container = document.getElementById('documentsContainer');
    const noDocsMsg = document.getElementById('noDocuments');
    if (!container || !noDocsMsg) return;

    try {
        const response = await fetch('/api/documents');
        const { documents } = await response.json();

        if (documents.length === 0) {
            container.innerHTML = '';
            noDocsMsg.style.display = 'block';
            return;
        }

        noDocsMsg.style.display = 'none';

        // Group by company
        const byCompany = {};
        documents.forEach(doc => {
            const company = doc.company || 'Other';
            if (!byCompany[company]) byCompany[company] = [];
            byCompany[company].push(doc);
        });

        container.innerHTML = Object.entries(byCompany)
            .sort((a, b) => {
                // Sort by most recent document
                const aLatest = new Date(a[1][0].created);
                const bLatest = new Date(b[1][0].created);
                return bLatest - aLatest;
            })
            .map(([company, docs]) => `
                <div style="background: white; border: 1px solid #e0e4e8; border-radius: 8px; padding: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #667eea;">${escapeHtml(company)}</h4>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${docs.map(doc => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #f8f9fa; border-radius: 4px;">
                                <div>
                                    <span style="font-size: 12px;">${doc.type === 'resume' ? '📄' : doc.type === 'cover_letter' ? '✉️' : '📎'}</span>
                                    <span style="font-size: 13px; margin-left: 5px;">${escapeHtml(doc.filename)}</span>
                                </div>
                                <a href="/documents/${encodeURIComponent(doc.filename)}" target="_blank"
                                   style="font-size: 12px; color: #667eea; text-decoration: none;">
                                   View →
                                </a>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');

        // Update count in tab header
        document.getElementById('existingFilesPreview').innerHTML = `
            <div style="background: white; padding: 10px; border-radius: 6px; font-size: 12px;">
                <strong>${documents.length} PDFs found</strong><br>
                <code style="color: #6c757d;">/Users/genre/Claude/resume/</code>
            </div>
        `;

    } catch (err) {
        console.error('Error loading documents:', err);
        container.innerHTML = `<p style="color: #ef4444;">Failed to load documents: ${err.message}</p>`;
    }
}

// Render jobs table
// Render job board performance stats
function renderBoardStats(jobs) {
    // Board tier rankings with scores and distinctiveness (after 3 rounds of evaluation)
    const boardTiers = {
        // TIER 1 - ESSENTIAL (80-100) - Focus 80% of search effort
        'Lever': { tier: 1, score: 92, note: 'Best nonprofit/mission signal. Found M+R (nonprofit-only agency), Arcadia. Low duplicates.' },
        'Greenhouse': { tier: 1, score: 90, note: 'Consistent quality mission-driven companies. Found Alma, Ethos Life. Excellent URL access.' },
        'Foundation List': { tier: 1, score: 88, note: '🎁 Hidden gems! Nonprofit-specific. Found Abortion in America ($160K-$185K disclosed). Unique jobs not cross-posted.' },
        
        // TIER 2 - VALUABLE (60-79) - Monitor, 15% effort
        'Breezy HR': { tier: 2, score: 75, note: 'Used by mission-driven orgs. Found Media Cause. Clean URLs.' },
        'Built In': { tier: 2, score: 75, note: 'Healthcare tech focus. Found Omada Health. Some salary data.' },
        'Workday': { tier: 2, score: 70, note: 'Corporate healthcare/education. Found UMG, Lexia. Excellent URLs but not nonprofit-focused.' },
        'SmartRecruiters': { tier: 2, score: 65, note: 'Healthcare advertising agencies. Pharma focus, not nonprofit mission.' },
        'Jobvite': { tier: 2, score: 60, note: 'Healthcare agencies (VMLY&R, APCO). Commercial pharma focus.' },
        
        // TIER 3 - LOW PRIORITY (45-59) - 5% effort
        'Indeed': { tier: 3, score: 60, note: '⚠️ Aggregator. Poor URL quality (only search results pages). High duplicates.' },
        'Media Bistro': { tier: 3, score: 65, note: '⚠️ Creative-focused but weak mission alignment. Mostly agency/corporate.' },
        'Idealist': { tier: 3, score: 55, note: '⚠️ STALE POSTINGS CONFIRMED. Constructive, NDWA, HRF all closed but still listed.' },
        
        // TIER 4 - SKIP (0-44)
        'Glassdoor': { tier: 4, score: 45, note: '❌ Cannot access direct URLs. Only aggregator pages.' },
        
        // Other boards not yet fully evaluated
        'LinkedIn': { tier: 2, score: 70, note: 'General job board. Not yet fully evaluated for nonprofit/mission roles.' },
        'Ashby': { tier: 2, score: 65, note: 'Tech-heavy ATS. Need more evaluation rounds.' },
        'MeetLifeSciences': { tier: 2, score: 60, note: 'Life sciences focus. Not yet fully evaluated.' },
        'Workable': { tier: 2, score: 60, note: 'General ATS. Not yet fully evaluated.' }
    };
    
    const boardStats = {};
    Object.keys(boardTiers).forEach(board => {
        boardStats[board] = { total: 0, applyNow: 0, ...boardTiers[board] };
    });
    
    // Count jobs per board
    jobs.forEach(job => {
        if (job.sources && Array.isArray(job.sources)) {
            job.sources.forEach(source => {
                if (boardStats[source]) {
                    boardStats[source].total++;
                    if (job.status === 'apply-now') {
                        boardStats[source].applyNow++;
                    }
                }
            });
        }
    });
    
    // Sort by tier, then score, then apply-now count
    const sortedBoards = Object.entries(boardStats).sort((a, b) => {
        if (a[1].tier !== b[1].tier) return a[1].tier - b[1].tier;
        if (b[1].score !== a[1].score) return b[1].score - a[1].score;
        if (b[1].applyNow !== a[1].applyNow) return b[1].applyNow - a[1].applyNow;
        return b[1].total - a[1].total;
    });
    
    // Render table with tier groupings
    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
                <tr style="border-bottom: 2px solid #dee2e6;">
                    <th style="text-align: left; padding: 8px; width: 25%;">Job Board</th>
                    <th style="text-align: center; padding: 8px; width: 8%;">Score</th>
                    <th style="text-align: center; padding: 8px; width: 8%;">Jobs</th>
                    <th style="text-align: center; padding: 8px; width: 8%;">Apply</th>
                    <th style="text-align: left; padding: 8px; width: 51%;">Distinctiveness</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    let currentTier = 0;
    const tierLabels = {
        1: '⭐ TIER 1 - ESSENTIAL (Focus 80% effort)',
        2: '🔄 TIER 2 - VALUABLE (Monitor, 15% effort)',
        3: '⚠️ TIER 3 - LOW PRIORITY (5% effort)',
        4: '❌ TIER 4 - SKIP'
    };
    
    sortedBoards.forEach(([board, stats]) => {
        // Add tier header when tier changes
        if (stats.tier !== currentTier) {
            currentTier = stats.tier;
            html += `
                <tr style="background: #f8f9fa;">
                    <td colspan="5" style="padding: 10px 8px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #495057;">
                        ${tierLabels[currentTier]}
                    </td>
                </tr>
            `;
        }
        
        const qualityPct = stats.total > 0 ? Math.round((stats.applyNow / stats.total) * 100) : 0;
        const scoreColor = stats.score >= 80 ? '#2e7d32' : stats.score >= 60 ? '#1976d2' : stats.score >= 45 ? '#f57c00' : '#d32f2f';
        const rowOpacity = stats.total === 0 ? 'opacity: 0.5;' : '';
        const tierBg = stats.tier === 1 ? 'background: #f1f8f4;' : stats.tier === 4 ? 'background: #fef2f2;' : '';
        
        html += `
            <tr style="border-bottom: 1px solid #f0f0f0; ${rowOpacity} ${tierBg}">
                <td style="padding: 8px; font-weight: 600;">${board}</td>
                <td style="text-align: center; padding: 8px; color: ${scoreColor}; font-weight: bold;">${stats.score}</td>
                <td style="text-align: center; padding: 8px;">${stats.total}</td>
                <td style="text-align: center; padding: 8px; color: #c62828; font-weight: bold;">${stats.applyNow}</td>
                <td style="padding: 8px; font-size: 11px; color: #495057; line-height: 1.4;">${stats.note}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
        <div style="font-size: 11px; color: #6c757d; margin-top: 12px; line-height: 1.6;">
            <p style="margin: 4px 0;"><strong>🎯 Search Strategy:</strong> Focus 80% effort on Tier 1 (Lever, Greenhouse, Foundation List), 15% on Tier 2, 5% on Tier 3, skip Tier 4.</p>
            <p style="margin: 4px 0;"><strong>📊 Scoring:</strong> Based on 3 rounds of evaluation. Score = URL quality + mission alignment + duplicate rate + hidden gems.</p>
            <p style="margin: 4px 0;"><strong>🔄 Evaluation Status:</strong> 15 boards tested. Next scan: Monday to monitor tier performance consistency.</p>
            <p style="margin: 4px 0;"><strong>❌ Dropped Boards:</strong> JazzHR (no searchable database), BambooHR (not a job board), iCIMS (poor URL access).</p>
        </div>
    `;

    const boardStatsEl = document.getElementById('boardStats');
    if (boardStatsEl) {
        boardStatsEl.innerHTML = html;
    }
}

// Sorting state
let sortColumn = 'fitScore';
let sortDirection = 'desc';
let appliedFirst = true; // Default: show applied jobs at top

function sortJobs(column) {
    // Safety check
    if (!window.currentData || !window.currentData.jobs) {
        console.error('Data not loaded yet');
        return;
    }

    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = column === 'fitScore' || column === 'salary' ? 'desc' : 'asc';
    }

    const data = window.currentData;

    // Apply filter first
    let jobs = [...data.jobs];
    const onlyStatus = Object.keys(filterStates).find(key => filterStates[key] === 'only');

    if (onlyStatus) {
        jobs = jobs.filter(job => job.status === onlyStatus);
    } else {
        const hiddenStatuses = Object.keys(filterStates).filter(key => filterStates[key] === 'hidden');
        jobs = jobs.filter(job => !hiddenStatuses.includes(job.status));
    }

    // Then sort - applied jobs first by default, then by selected column
    const sorted = jobs.sort((a, b) => {
        // If appliedFirst is enabled, always sort applied jobs to top
        if (appliedFirst && column !== 'status') {
            const aIsApplied = a.status === 'applied' ? 1 : 0;
            const bIsApplied = b.status === 'applied' ? 1 : 0;
            if (aIsApplied !== bIsApplied) {
                return bIsApplied - aIsApplied; // Applied jobs first
            }
        }

        let aVal, bVal;

        switch(column) {
            case 'fitScore':
                return sortDirection === 'desc' ? b.fitScore - a.fitScore : a.fitScore - b.fitScore;

            case 'title':
                return sortDirection === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);

            case 'company':
                return sortDirection === 'asc' ? a.company.localeCompare(b.company) : b.company.localeCompare(a.company);

            case 'salary':
                // Extract first number from salary string
                aVal = parseInt((a.salary.match(/\d+/) || [0])[0]);
                bVal = parseInt((b.salary.match(/\d+/) || [0])[0]);
                return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;

            case 'status':
                // When explicitly sorting by status, use this order (applied at top)
                const statusOrder = {'applied': 0, 'apply-now': 1, 'maybe': 2, 'probably-not': 3, 'archived': 4};
                aVal = statusOrder[a.status] || 99;
                bVal = statusOrder[b.status] || 99;
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;

            case 'connections':
                aVal = a.connections ? a.connections.length : 0;
                bVal = b.connections ? b.connections.length : 0;
                return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;

            case 'daysSince':
                // Use found date for days since
                aVal = a.found ? new Date(a.found).getTime() : 0;
                bVal = b.found ? new Date(b.found).getTime() : 0;
                return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;

            default:
                return 0;
        }
    });

    renderJobs(sorted);
    saveFilterState(); // Persist sort state
}

function toggleAppliedFirst() {
    appliedFirst = !appliedFirst;
    // Re-sort with current column
    sortJobs(sortColumn);
    // Update button state
    const btn = document.getElementById('appliedFirstBtn');
    if (btn) {
        btn.style.background = appliedFirst ? '#22c55e' : '#e5e7eb';
        btn.style.color = appliedFirst ? 'white' : '#374151';
        btn.title = appliedFirst ? 'Applied jobs shown first (click to disable)' : 'Click to show applied jobs first';
    }
}

function getSortArrow(column) {
    if (sortColumn !== column) return '';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
}

function renderJobs(jobs) {
    const container = document.getElementById('jobsContainer');
    
    if (jobs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💼</div>
                <h3>No Jobs Found</h3>
                <p>Copy the search command above and paste it into Claude to start finding jobs</p>
            </div>
        `;
        return;
    }

    const tableHTML = `
        <table class="jobs-table">
            <thead>
                <tr>
                    <th onclick="sortJobs('fitScore')" style="cursor: pointer;">Fit${getSortArrow('fitScore')}</th>
                    <th onclick="sortJobs('title')" style="cursor: pointer;">Title${getSortArrow('title')}</th>
                    <th onclick="sortJobs('company')" style="cursor: pointer;">Company${getSortArrow('company')}</th>
                    <th>Industry</th>
                    <th>Location</th>
                    <th onclick="sortJobs('salary')" style="cursor: pointer;">Salary${getSortArrow('salary')}</th>
                    <th onclick="sortJobs('status')" style="cursor: pointer;">Status${getSortArrow('status')}</th>
                    <th onclick="sortJobs('connections')" style="cursor: pointer;">Connections${getSortArrow('connections')}</th>
                    <th onclick="sortJobs('daysSince')" style="cursor: pointer;">Days Since${getSortArrow('daysSince')}</th>
                    <th>Info</th>
                </tr>
            </thead>
            <tbody>
                ${jobs.map(job => `
                    <tr class="${getRowClass(job)}" onclick="showJobDetail(${job.id})">
                        <td>
                            <span class="fit-score ${getFitClass(job.fitScore)}">
                                ${job.fitScore}
                            </span>
                        </td>
                        <td>
                            <a href="#" class="job-title-link" onclick="event.stopPropagation(); viewPDF(${job.id})">
                                ${job.title}
                            </a>
                            ${isNewJob(job) ? '<span class="new-job-badge">NEW</span>' : ''}
                        </td>
                        <td>
                            <a href="${job.url}" target="_blank" class="company-link" onclick="event.stopPropagation()">
                                ${job.company}
                            </a>
                            ${job.url ? '<span style="color: #10b981; margin-left: 5px;" title="Direct job posting link verified">🔗</span>' : '<span style="color: #dc2626; margin-left: 5px;" title="No direct link - may be closed or needs URL from application email">⚠️</span>'}
                        </td>
                        <td>${job.industry}</td>
                        <td>${job.location}</td>
                        <td>${getSalaryHTML(job.salary)}</td>
                        <td><span class="status-badge status-${job.status}">${getStatusLabel(job.status)}</span></td>
                        <td onclick="event.stopPropagation()">${getConnectionsHTML(job)}</td>
                        <td>${getDaysSinceHTML(job)}</td>
                        <td><div class="symbols">${getSymbolsHTML(job.symbols)}</div></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = tableHTML;
}

function getFitClass(score) {
    if (score >= 85) return 'fit-high';
    if (score >= 70) return 'fit-medium';
    return 'fit-low';
}

// Check if job was added within last 48 hours
function isNewJob(job) {
    if (!job.found) return false;
    const foundDate = new Date(job.found);
    const now = new Date();
    const hoursDiff = (now - foundDate) / (1000 * 60 * 60);
    return hoursDiff <= 48;
}

// Get the appropriate row class based on job status
function getRowClass(job) {
    const classes = ['job-row'];

    if (job.status === 'archived') {
        // Check if this archived job was applied or rejected
        const wasApplied = job.appliedDate || job.applied;
        const wasRejected = job.symbols?.includes('❌') ||
                           job.updates?.some(u => u.type === 'Rejected');

        if (wasApplied || wasRejected) {
            classes.push('row-archived-applied');
        } else {
            classes.push('row-archived');
        }
    } else if (job.status === 'applied') {
        classes.push('row-applied');
    }

    return classes.join(' ');
}

function getStatusLabel(status) {
    const labels = {
        'apply-now': '🔴 Apply Now',
        'maybe': '🟠 Maybe',
        'probably-not': '🟡 Probably Not',
        'applied': '🟢 Applied',
        'archived': '⚪ Archived'
    };
    return labels[status] || status;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) return '⚡ Today';
    if (diff === 1) return '1 day ago';
    if (diff < 7) return `${diff} days ago`;
    return dateStr;
}

function getSalaryHTML(salary) {
    // Extract number from salary string if possible
    const match = salary.match(/\$(\d+)k/i);
    if (!match) return salary;
    
    const amount = parseInt(match[1]);
    let className = 'salary-low';
    
    if (amount >= 160) {
        className = 'salary-high';
    } else if (amount >= 120) {
        className = 'salary-mid';
    }
    
    return `<span class="${className}">${salary}</span>`;
}

function getDatesHTML(job) {
    const dates = [];
    
    if (job.posted) {
        dates.push(`<span class="tooltip date-posted">P<span class="tooltiptext">Posted: ${job.posted}</span></span>`);
    }
    if (job.found) {
        dates.push(`<span class="tooltip date-found">F<span class="tooltiptext">Found: ${job.found}</span></span>`);
    }
    if (job.applied) {
        dates.push(`<span class="tooltip date-applied">A<span class="tooltiptext">Applied: ${job.applied}</span></span>`);
    }
    
    return dates.join(' / ');
}

function getFitBreakdownHTML(job) {
    // Try to get breakdown from job data or estimate from fit score
    const breakdown = job.fitBreakdown || estimateFitBreakdown(job);

    const categories = [
        { key: 'role', label: 'Role Match', max: 25, icon: '💼', desc: 'Title and responsibilities alignment' },
        { key: 'industry', label: 'Industry', max: 20, icon: '🏢', desc: 'Sector and mission fit' },
        { key: 'location', label: 'Location', max: 15, icon: '📍', desc: 'Boston/MA area, remote, or hybrid' },
        { key: 'salary', label: 'Salary', max: 15, icon: '💰', desc: 'Meets $120K+ minimum' }
    ];

    const baseScore = 50; // Starting score before category bonuses
    let html = `<div style="display: grid; gap: 8px;">`;

    categories.forEach(cat => {
        const score = breakdown[cat.key] || 0;
        const percent = Math.round((score / cat.max) * 100);
        const barColor = percent >= 80 ? '#22c55e' : percent >= 50 ? '#f59e0b' : '#ef4444';

        html += `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="width: 24px; text-align: center;">${cat.icon}</span>
                <span style="width: 100px; font-size: 13px; color: #374151;">${cat.label}</span>
                <div style="flex: 1; background: #e5e7eb; border-radius: 4px; height: 16px; overflow: hidden;">
                    <div style="width: ${percent}%; background: ${barColor}; height: 100%; border-radius: 4px; transition: width 0.3s;"></div>
                </div>
                <span style="width: 50px; text-align: right; font-weight: 600; color: ${barColor};">+${score}/${cat.max}</span>
            </div>
        `;
    });

    // Show base score
    html += `
        <div style="display: flex; align-items: center; gap: 10px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
            <span style="width: 24px; text-align: center;">🎯</span>
            <span style="width: 100px; font-size: 13px; color: #374151;">Base Score</span>
            <div style="flex: 1;"></div>
            <span style="width: 50px; text-align: right; font-weight: 600; color: #6b7280;">+${baseScore}</span>
        </div>
    `;

    html += `</div>`;
    return html;
}

function estimateFitBreakdown(job) {
    // Estimate breakdown when not available from validator
    const fitScore = job.fitScore || 50;
    const excess = fitScore - 50; // Points above base

    // Distribute proportionally (25+20+15+15 = 75 max)
    if (excess <= 0) {
        return { role: 0, industry: 0, location: 0, salary: 0 };
    }

    // Estimate based on job attributes
    let role = 0, industry = 0, location = 0, salary = 0;

    // Role estimation based on title
    const title = (job.title || '').toLowerCase();
    if (title.includes('director') || title.includes('head') || title.includes('vp')) {
        role = Math.min(25, Math.round(excess * 0.35));
    } else if (title.includes('senior') || title.includes('lead') || title.includes('manager')) {
        role = Math.min(20, Math.round(excess * 0.28));
    } else {
        role = Math.min(15, Math.round(excess * 0.20));
    }

    // Industry estimation
    const ind = (job.industry || '').toLowerCase();
    if (ind.includes('health') || ind.includes('nonprofit') || ind.includes('education') || ind.includes('social')) {
        industry = Math.min(20, Math.round(excess * 0.28));
    } else {
        industry = Math.min(10, Math.round(excess * 0.15));
    }

    // Location estimation
    const loc = (job.location || '').toLowerCase();
    if (loc.includes('boston') || loc.includes('massachusetts') || loc.includes('ma') || loc.includes('remote')) {
        location = Math.min(15, Math.round(excess * 0.20));
    } else {
        location = Math.min(8, Math.round(excess * 0.10));
    }

    // Salary estimation
    const salaryStr = (job.salary || '').replace(/[^0-9]/g, '');
    const salaryNum = parseInt(salaryStr.substring(0, 6)) || 0;
    if (salaryNum >= 160000) {
        salary = 15;
    } else if (salaryNum >= 140000) {
        salary = 12;
    } else if (salaryNum >= 120000) {
        salary = 10;
    } else {
        salary = Math.min(8, Math.round(excess * 0.12));
    }

    return { role, industry, location, salary };
}

async function submitScoreFeedback(jobId, feedback) {
    if (!window.currentData || !window.currentData.jobs) {
        console.error('Data not loaded yet');
        return;
    }

    const data = window.currentData;
    const job = data.jobs.find(j => j.id === jobId);
    if (!job) return;

    // Toggle feedback if clicking same button
    if (job.scoreFeedback === feedback) {
        delete job.scoreFeedback;
        delete job.scoreFeedbackNote;
    } else {
        job.scoreFeedback = feedback;

        // Prompt for optional note based on feedback type
        if (feedback === 'down') {
            const note = prompt('Why does this score feel too high? (optional)\n\nExample: "Not a creative role despite title" or "Company too small"');
            if (note) {
                job.scoreFeedbackNote = note;
            } else {
                delete job.scoreFeedbackNote;
            }
        } else if (feedback === 'up') {
            const note = prompt('Why does this score feel too low? (optional)\n\nExample: "Perfect mission alignment" or "Strong team culture fit"');
            if (note) {
                job.scoreFeedbackNote = note;
            } else {
                delete job.scoreFeedbackNote;
            }
        }
    }

    await saveData(data);

    // Refresh the modal
    showJobDetail(jobId);
}

function getSymbolsHTML(symbols) {
    const symbolMap = {
        '⚡': 'Posted Today - Apply immediately for best chances',
        '💰': 'High Pay - $160k+ disclosed salary range',
        '❓': 'Needs Review - Questionable fit, review before applying',
        '🎓': 'MSU Alumni at Company - Leverage alumni network',
        '🔗': 'LinkedIn Connection - You have 1st or 2nd degree connections',
        '🏢': 'Enterprise/PE-Backed - Established company with resources',
        '🚀': 'High Growth - Fast-growing startup or scaleup',
        '❤️': 'Mission Alignment - Strong personal connection to cause',
        '🎵': 'Arts/Music - Education + arts/culture sector',
        '❌': 'Rejected - Application was not successful'
    };
    
    return symbols.map(symbol => 
        `<span class="tooltip">${symbol}<span class="tooltiptext">${symbolMap[symbol] || symbol}</span></span>`
    ).join(' ');
}

function getConnectionsHTML(job) {
    if (!job.connections || job.connections.length === 0) {
        return '<span class="connection-badge connection-none">None</span>';
    }

    // Sort so primary referral appears first
    const sortedConnections = [...job.connections].sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return 0;
    });

    return sortedConnections.map(conn => {
        const badgeClass = conn.reachedOut ? 'connection-reached-out' : 'connection-not-reached';
        const status = conn.reachedOut ? '✓' : '○';
        const primaryStar = conn.isPrimary ? '⭐ ' : '';
        const primaryStyle = conn.isPrimary ? 'border: 2px solid #f59e0b; font-weight: 600;' : '';
        return `<span class="connection-badge ${badgeClass}" onclick="toggleReachOut(${job.id}, '${escapeHtml(conn.name)}')" style="cursor: pointer; ${primaryStyle}" title="${conn.isPrimary ? 'Primary Referral - ' : ''}${conn.role || 'No role'}${conn.notes ? ' | ' + conn.notes : ''}">
            ${primaryStar}${status} ${escapeHtml(conn.name)}
        </span>`;
    }).join('');
}

function getDaysSinceHTML(job) {
    // Find the most recent action date
    const dates = [
        job.applied ? { date: job.applied, label: 'applied' } : null,
        job.followup ? { date: job.followup, label: 'follow-up' } : null,
        job.found ? { date: job.found, label: 'found' } : null
    ].filter(Boolean);
    
    if (dates.length === 0) return '-';
    
    // Sort by most recent
    dates.sort((a, b) => new Date(b.date) - new Date(a.date));
    const mostRecent = dates[0];
    
    const daysSince = Math.floor((new Date() - new Date(mostRecent.date)) / (1000 * 60 * 60 * 24));
    
    let colorClass = 'days-old';
    if (daysSince <= 2) {
        colorClass = 'days-urgent';
    } else if (daysSince <= 5) {
        colorClass = 'days-recent';
    }
    
    // Build tooltip with all dates
    const tooltipParts = [];
    if (job.posted) {
        tooltipParts.push(`<span class="date-posted">Posted: ${job.posted}</span>`);
    }
    if (job.found) {
        tooltipParts.push(`<span class="date-found">Found: ${job.found}</span>`);
    }
    if (job.applied) {
        tooltipParts.push(`<span class="date-applied">Applied: ${job.applied}</span>`);
    }
    if (job.followup) {
        tooltipParts.push(`<span style="color: #9c27b0;">Follow-up: ${job.followup}</span>`);
    }
    
    return `<span class="tooltip days-since ${colorClass}">
        ${daysSince}d
        <span class="tooltiptext" style="white-space: normal; text-align: left; min-width: 150px;">
            ${tooltipParts.join('<br>')}
            <br><strong>${daysSince} days since ${mostRecent.label}</strong>
        </span>
    </span>`;
}

async function toggleReachOut(jobId, connectionName) {
    // Safety check
    if (!window.currentData || !window.currentData.jobs) {
        console.error('Data not loaded yet');
        return;
    }
    
    const data = window.currentData;
    const job = data.jobs.find(j => j.id === jobId);
    if (!job || !job.connections) return;
    
    const connection = job.connections.find(c => c.name === connectionName);
    if (connection) {
        connection.reachedOut = !connection.reachedOut;
        await saveData(data);
        await loadData();
    }
}

// =====================================================
// CONNECTION MANAGEMENT FUNCTIONS
// =====================================================

function showAddConnectionForm(jobId) {
    const form = document.getElementById(`addConnectionForm-${jobId}`);
    if (form) {
        form.style.display = 'block';
        // Clear any previous values
        document.getElementById(`connName-${jobId}`).value = '';
        document.getElementById(`connRole-${jobId}`).value = '';
        document.getElementById(`connLinkedIn-${jobId}`).value = '';
        document.getElementById(`connNotes-${jobId}`).value = '';
        document.getElementById(`connPrimary-${jobId}`).checked = false;
        document.getElementById(`connReachedOut-${jobId}`).checked = false;
        // Focus on name field
        document.getElementById(`connName-${jobId}`).focus();
    }
}

function hideAddConnectionForm(jobId) {
    const form = document.getElementById(`addConnectionForm-${jobId}`);
    if (form) {
        form.style.display = 'none';
    }
}

async function saveConnection(jobId, editIndex = null) {
    if (!window.currentData || !window.currentData.jobs) {
        console.error('Data not loaded');
        return;
    }

    const name = document.getElementById(`connName-${jobId}`).value.trim();
    if (!name) {
        alert('Please enter a connection name');
        return;
    }

    const connection = {
        name: name,
        role: document.getElementById(`connRole-${jobId}`).value.trim() || '',
        linkedIn: document.getElementById(`connLinkedIn-${jobId}`).value.trim() || '',
        notes: document.getElementById(`connNotes-${jobId}`).value.trim() || '',
        isPrimary: document.getElementById(`connPrimary-${jobId}`).checked,
        reachedOut: document.getElementById(`connReachedOut-${jobId}`).checked
    };

    const data = window.currentData;
    const job = data.jobs.find(j => j.id === jobId);
    if (!job) return;

    // Initialize connections array if needed
    if (!job.connections) {
        job.connections = [];
    }

    // If marking as primary, unmark any existing primary
    if (connection.isPrimary) {
        job.connections.forEach(c => c.isPrimary = false);
    }

    if (editIndex !== null && editIndex >= 0) {
        // Editing existing connection
        job.connections[editIndex] = connection;
    } else {
        // Adding new connection
        job.connections.push(connection);
    }

    // Add update to history
    if (!job.updates) job.updates = [];
    job.updates.push({
        timestamp: new Date().toISOString(),
        type: editIndex !== null ? 'Connection Updated' : 'Connection Added',
        notes: `${connection.name}${connection.role ? ' (' + connection.role + ')' : ''}${connection.isPrimary ? ' - Primary Referral' : ''}`
    });

    await saveData(data);
    await loadData();
    showJobDetail(jobId); // Refresh the modal
}

function editConnection(jobId, index) {
    if (!window.currentData || !window.currentData.jobs) return;

    const job = window.currentData.jobs.find(j => j.id === jobId);
    if (!job || !job.connections || !job.connections[index]) return;

    const conn = job.connections[index];

    // Show the form and populate with existing values
    const form = document.getElementById(`addConnectionForm-${jobId}`);
    if (form) {
        form.style.display = 'block';
        document.getElementById(`connName-${jobId}`).value = conn.name || '';
        document.getElementById(`connRole-${jobId}`).value = conn.role || '';
        document.getElementById(`connLinkedIn-${jobId}`).value = conn.linkedIn || '';
        document.getElementById(`connNotes-${jobId}`).value = conn.notes || '';
        document.getElementById(`connPrimary-${jobId}`).checked = conn.isPrimary || false;
        document.getElementById(`connReachedOut-${jobId}`).checked = conn.reachedOut || false;

        // Change save button to update
        const saveBtn = form.querySelector('button[onclick^="saveConnection"]');
        if (saveBtn) {
            saveBtn.textContent = 'Update Connection';
            saveBtn.onclick = () => saveConnection(jobId, index);
        }
    }
}

async function deleteConnection(jobId, index) {
    if (!window.currentData || !window.currentData.jobs) return;

    const job = window.currentData.jobs.find(j => j.id === jobId);
    if (!job || !job.connections || !job.connections[index]) return;

    const conn = job.connections[index];
    if (!confirm(`Remove ${conn.name} from connections?`)) return;

    // Add update to history
    if (!job.updates) job.updates = [];
    job.updates.push({
        timestamp: new Date().toISOString(),
        type: 'Connection Removed',
        notes: `${conn.name}${conn.role ? ' (' + conn.role + ')' : ''}`
    });

    job.connections.splice(index, 1);

    await saveData(window.currentData);
    await loadData();
    showJobDetail(jobId); // Refresh the modal
}

async function setPrimaryReferral(jobId, index) {
    if (!window.currentData || !window.currentData.jobs) return;

    const job = window.currentData.jobs.find(j => j.id === jobId);
    if (!job || !job.connections) return;

    // Unmark all, then mark the selected one
    job.connections.forEach((c, i) => {
        c.isPrimary = (i === index);
    });

    await saveData(window.currentData);
    await loadData();
    showJobDetail(jobId);
}

function viewPDF(jobId) {
    alert('PDF viewer coming soon! This will open the saved job description PDF.');
}

function showJobDetail(jobId) {
    // Safety check
    if (!window.currentData || !window.currentData.jobs) {
        console.error('Data not loaded yet');
        return;
    }
    
    const data = window.currentData;
    const job = data.jobs.find(j => j.id === jobId);
    
    if (!job) return;
    
    const modal = document.getElementById('jobModal');
    const content = document.getElementById('modalContent');
    
    content.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
            <div>
                <h2 style="margin-bottom: 5px;">${job.title}</h2>
                <h3><a href="${job.url}" target="_blank" class="company-link">${job.company}</a></h3>
            </div>
            <button onclick="copyJobInfo(${job.id})"
                id="copyJobBtn-${job.id}"
                style="padding: 8px 14px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; font-size: 13px; white-space: nowrap; display: flex; align-items: center; gap: 5px;"
                title="Copy job title, company, and URL to clipboard">
                📋 Copy Info
            </button>
        </div>

        <div style="margin: 20px 0;">
            <span class="status-badge status-${job.status}">${getStatusLabel(job.status)}</span>
            <span class="fit-score ${getFitClass(job.fitScore)}" style="margin-left: 10px; font-size: 20px;">
                Fit Score: ${job.fitScore}/100
            </span>
        </div>

        <!-- FIT SCORE BREAKDOWN -->
        <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #bae6fd;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h4 style="margin: 0; color: #0369a1;">📊 Fit Score Breakdown</h4>
                <div style="display: flex; gap: 8px;">
                    <button onclick="submitScoreFeedback(${job.id}, 'up')"
                        class="feedback-btn ${job.scoreFeedback === 'up' ? 'feedback-active-up' : ''}"
                        style="padding: 6px 12px; border: 2px solid #22c55e; background: ${job.scoreFeedback === 'up' ? '#22c55e' : 'white'}; color: ${job.scoreFeedback === 'up' ? 'white' : '#22c55e'}; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s;"
                        title="Score should be higher - this job is a better fit than shown">
                        👆 Too Low
                    </button>
                    <button onclick="submitScoreFeedback(${job.id}, 'down')"
                        class="feedback-btn ${job.scoreFeedback === 'down' ? 'feedback-active-down' : ''}"
                        style="padding: 6px 12px; border: 2px solid #ef4444; background: ${job.scoreFeedback === 'down' ? '#ef4444' : 'white'}; color: ${job.scoreFeedback === 'down' ? 'white' : '#ef4444'}; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s;"
                        title="Score should be lower - this job is not as good a fit">
                        👇 Too High
                    </button>
                </div>
            </div>
            ${getFitBreakdownHTML(job)}
            ${job.scoreFeedbackNote ? `
                <div style="margin-top: 10px; padding: 8px 12px; background: ${job.scoreFeedback === 'up' ? '#dcfce7' : '#fef3c7'}; border-radius: 6px; font-size: 13px; border-left: 3px solid ${job.scoreFeedback === 'up' ? '#22c55e' : '#f59e0b'};">
                    <strong>${job.scoreFeedback === 'up' ? '👆 Score too low:' : '👇 Score too high:'}</strong> ${escapeHtml(job.scoreFeedbackNote)}
                </div>
            ` : ''}
        </div>
        
        <div class="job-detail">
            <p><strong>Industry:</strong> ${job.industry}</p>
            <p><strong>Location:</strong> ${job.location}</p>
            <p><strong>Salary:</strong> ${job.salary}</p>
            <p><strong>Posted:</strong> ${job.posted || 'Unknown'}</p>
            <p><strong>Found:</strong> ${job.found || 'Unknown'}</p>
            ${job.applied ? `<p><strong>Applied:</strong> ${job.applied}</p>` : ''}
            ${job.followup ? `<p><strong>Follow-up:</strong> ${job.followup}</p>` : ''}
            <p><strong>Days Since Last Action:</strong> ${getDaysSinceHTML(job)}</p>
            <p><strong>Symbols:</strong> ${job.symbols.join(' ') || 'None'}</p>
        </div>
        
        <!-- CONNECTIONS SECTION -->
        <div style="margin-top: 20px; background: #f0fdf4; padding: 15px; border-radius: 8px; border: 1px solid #bbf7d0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h4 style="margin: 0; color: #166534;">🔗 Connections at ${job.company}</h4>
                <button onclick="showAddConnectionForm(${job.id})"
                    style="padding: 6px 12px; background: #22c55e; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    + Add Connection
                </button>
            </div>

            <!-- Add Connection Form (hidden by default) -->
            <div id="addConnectionForm-${job.id}" style="display: none; background: white; padding: 12px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #d1d5db;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <div>
                        <label style="display: block; font-size: 11px; color: #6b7280; margin-bottom: 2px;">Name *</label>
                        <input type="text" id="connName-${job.id}" placeholder="Jane Smith"
                            style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 11px; color: #6b7280; margin-bottom: 2px;">Role/Title</label>
                        <input type="text" id="connRole-${job.id}" placeholder="VP of Design"
                            style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;">
                    </div>
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; font-size: 11px; color: #6b7280; margin-bottom: 2px;">LinkedIn URL</label>
                    <input type="text" id="connLinkedIn-${job.id}" placeholder="https://linkedin.com/in/janesmith"
                        style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; font-size: 11px; color: #6b7280; margin-bottom: 2px;">Notes (how you know them, context)</label>
                    <input type="text" id="connNotes-${job.id}" placeholder="Former colleague at PIH, strong reference"
                        style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;">
                </div>
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                    <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 13px;">
                        <input type="checkbox" id="connPrimary-${job.id}">
                        <span style="color: #f59e0b;">⭐ Primary Referral</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 13px;">
                        <input type="checkbox" id="connReachedOut-${job.id}">
                        <span>Already reached out</span>
                    </label>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="saveConnection(${job.id})"
                        style="padding: 8px 16px; background: #22c55e; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                        Save Connection
                    </button>
                    <button onclick="hideAddConnectionForm(${job.id})"
                        style="padding: 8px 16px; background: white; color: #6b7280; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; font-size: 13px;">
                        Cancel
                    </button>
                </div>
            </div>

            <!-- Connections List -->
            <div id="connectionsList-${job.id}">
                ${job.connections && job.connections.length > 0 ? job.connections.map((conn, idx) => `
                    <div style="padding: 12px; background: white; border-radius: 6px; margin-bottom: 8px; border: 1px solid ${conn.isPrimary ? '#fbbf24' : '#e5e7eb'}; ${conn.isPrimary ? 'border-width: 2px;' : ''}">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <strong style="font-size: 14px;">${escapeHtml(conn.name)}</strong>
                                    ${conn.isPrimary ? '<span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 600;">⭐ PRIMARY REFERRAL</span>' : ''}
                                    ${conn.reachedOut ? '<span style="background: #d1fae5; color: #065f46; padding: 2px 6px; border-radius: 3px; font-size: 10px;">✓ Contacted</span>' : '<span style="background: #fef9c3; color: #854d0e; padding: 2px 6px; border-radius: 3px; font-size: 10px;">⏳ Not contacted</span>'}
                                </div>
                                ${conn.role ? `<div style="color: #6b7280; font-size: 13px; margin-top: 3px;">${escapeHtml(conn.role)}</div>` : ''}
                                ${conn.linkedIn ? `<div style="margin-top: 3px;"><a href="${escapeHtml(conn.linkedIn)}" target="_blank" style="color: #0077b5; font-size: 12px; text-decoration: none;">🔗 LinkedIn Profile</a></div>` : ''}
                                ${conn.notes ? `<div style="color: #9ca3af; font-size: 12px; margin-top: 5px; font-style: italic;">"${escapeHtml(conn.notes)}"</div>` : ''}
                            </div>
                            <div style="display: flex; gap: 5px; flex-shrink: 0;">
                                <button onclick="toggleReachOut(${job.id}, '${escapeHtml(conn.name)}'); showJobDetail(${job.id});"
                                    title="${conn.reachedOut ? 'Mark as not contacted' : 'Mark as contacted'}"
                                    style="padding: 4px 8px; background: ${conn.reachedOut ? '#fee2e2' : '#d1fae5'}; color: ${conn.reachedOut ? '#991b1b' : '#065f46'}; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                                    ${conn.reachedOut ? '↩ Undo' : '✓ Reached Out'}
                                </button>
                                <button onclick="editConnection(${job.id}, ${idx})"
                                    title="Edit connection"
                                    style="padding: 4px 8px; background: #e0e7ff; color: #3730a3; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                                    ✏️
                                </button>
                                <button onclick="deleteConnection(${job.id}, ${idx})"
                                    title="Remove connection"
                                    style="padding: 4px 8px; background: #fee2e2; color: #991b1b; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('') : '<p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center; padding: 10px;">No connections yet. Add someone who can help!</p>'}
            </div>
        </div>
        
        <div style="margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h4 style="margin: 0;">Notes:</h4>
                ${job.notes ? `
                    <button onclick="copyJobNotes(${job.id})"
                        id="copyNotesBtn-${job.id}"
                        style="padding: 4px 10px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; font-size: 12px;"
                        title="Copy notes to clipboard">
                        📋 Copy
                    </button>
                ` : ''}
            </div>
            <p>${formatNotes(job.notes)}</p>
        </div>
        
        ${job.updates && job.updates.length > 0 ? `
        <div style="margin-top: 20px; background: #f7f9fc; padding: 15px; border-radius: 8px;">
            <h4 style="margin-top: 0;">📝 Update History:</h4>
            ${job.updates.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(update => `
                <div style="padding: 10px 0; border-bottom: 1px solid #e0e4e8;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <strong style="color: #667eea;">${update.type}</strong>
                            <span style="color: #6c757d; font-size: 12px; margin-left: 10px;">
                                ${new Date(update.timestamp).toLocaleString('en-US', {
                                    timeZone: 'America/New_York',
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                })} ET
                            </span>
                        </div>
                    </div>
                    ${update.notes ? `<p style="margin: 5px 0 0 0; color: #495057;">${formatNotes(update.notes)}</p>` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}

        <!-- DOCUMENTS SECTION -->
        <div style="margin-top: 20px; background: #f0f9ff; padding: 15px; border-radius: 8px; border: 1px solid #bfdbfe;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h4 style="margin: 0;">📁 Documents</h4>
                <div style="display: flex; gap: 8px;">
                    <label style="padding: 6px 12px; background: #3b82f6; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        📄 Add Resume
                        <input type="file" accept=".pdf,.doc,.docx" style="display: none;" onchange="handleJobUpload(event, ${job.id}, 'resume')">
                    </label>
                    <label style="padding: 6px 12px; background: #10b981; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        ✉️ Add Cover Letter
                        <input type="file" accept=".pdf,.doc,.docx" style="display: none;" onchange="handleJobUpload(event, ${job.id}, 'cover_letter')">
                    </label>
                    <label style="padding: 6px 12px; background: #f59e0b; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        📋 Add JD
                        <input type="file" accept=".pdf,.doc,.docx,.txt" style="display: none;" onchange="handleJobUpload(event, ${job.id}, 'job_description')">
                    </label>
                </div>
            </div>
            <div id="jobDocsContainer-${job.id}" style="min-height: 40px;">
                <p style="color: #6c757d; font-size: 13px; margin: 0;">Loading documents...</p>
            </div>
        </div>

        <div style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn-primary" onclick="window.open('${job.url}', '_blank')" style="background: #28a745;">View Job</button>
            <button class="btn-primary" onclick="updateJobStatus(${job.id}, 'applied')">Applied</button>
            <button class="btn-primary" onclick="showUpdateForm(${job.id})" style="background: #667eea;">Update</button>
            <button class="btn-primary" onclick="markAsRejected(${job.id})" style="background: #dc3545;">Rejected</button>
            <button class="btn-primary" onclick="updateJobStatus(${job.id}, 'archived')" style="background: #6c757d;">Archive</button>
        </div>
    `;

    modal.classList.add('active');

    // Load documents for this job
    loadJobDocuments(job.id);
}

// Load and render documents for a specific job in the modal
async function loadJobDocuments(jobId) {
    const container = document.getElementById(`jobDocsContainer-${jobId}`);
    if (!container) return;

    const typeLabels = {
        resume: '📄',
        cover_letter: '✉️',
        job_description: '📋',
        research: '🔍',
        general: '📎'
    };

    try {
        // Get job data to check for linked documents
        const job = window.currentData?.jobs?.find(j => j.id === jobId);
        let allDocs = [];

        // First, get uploaded documents from DocStore
        try {
            const { documents, fileRefs } = await DocStore.getDocumentsForJob(jobId);
            allDocs = [
                ...documents.map(d => ({ ...d, source: 'uploaded' })),
                ...fileRefs.map(r => ({ ...r, source: 'reference' }))
            ];
        } catch (e) {
            // DocStore might not be available
        }

        // Add server-linked documents if available
        if (job && job.documents && Array.isArray(job.documents)) {
            job.documents.forEach(doc => {
                // Avoid duplicates
                if (!allDocs.find(d => d.name === doc.filename || d.filename === doc.filename)) {
                    allDocs.push({
                        name: doc.filename,
                        filename: doc.filename,
                        type: doc.type,
                        source: 'server',
                        linkedAt: doc.linkedAt
                    });
                }
            });
        }

        if (allDocs.length === 0) {
            // Check if server has matching documents for this company
            if (isLocalServer() && job) {
                try {
                    const response = await fetch(`/api/documents/company/${encodeURIComponent(job.company)}`);
                    const { documents: serverDocs } = await response.json();
                    if (serverDocs && serverDocs.length > 0) {
                        container.innerHTML = `
                            <p style="color: #6c757d; font-size: 13px; margin: 0 0 10px 0;">No documents linked yet.</p>
                            <div style="background: #fef3c7; padding: 10px; border-radius: 6px; font-size: 12px;">
                                <strong>Found ${serverDocs.length} PDF(s) for ${escapeHtml(job.company)}:</strong>
                                <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px;">
                                    ${serverDocs.slice(0, 4).map(doc => `
                                        <button onclick="linkDocumentToJob(${jobId}, '${escapeHtml(doc.filename)}', '${doc.type}')"
                                            style="padding: 4px 8px; background: white; border: 1px solid #f59e0b; border-radius: 4px; cursor: pointer; font-size: 11px;">
                                            ${typeLabels[doc.type] || '📎'} Link: ${escapeHtml(doc.filename.substring(0, 30))}${doc.filename.length > 30 ? '...' : ''}
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                        return;
                    }
                } catch (e) {
                    // Server not available
                }
            }

            container.innerHTML = '<p style="color: #6c757d; font-size: 13px; margin: 0;">No documents attached yet. Use the buttons above to add files.</p>';
            return;
        }

        container.innerHTML = `
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${allDocs.map(doc => {
                    const docName = doc.name || doc.filename;
                    const isServer = doc.source === 'server';
                    return `
                    <div style="display: flex; align-items: center; gap: 6px; background: white; padding: 6px 10px; border-radius: 4px; border: 1px solid ${isServer ? '#3b82f6' : '#e0e4e8'}; font-size: 12px;">
                        <span>${typeLabels[doc.type] || '📎'}</span>
                        <span style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(docName)}">${escapeHtml(docName)}</span>
                        ${isServer ? `
                            <a href="/documents/${encodeURIComponent(docName)}" target="_blank" style="color: #3b82f6; text-decoration: none;" title="View PDF">👁️</a>
                        ` : doc.source === 'uploaded' ? `
                            <button onclick="viewDocument(${doc.id})" style="background: none; border: none; cursor: pointer; color: #3b82f6;" title="View">👁️</button>
                        ` : ''}
                    </div>
                `;
                }).join('')}
            </div>
        `;
    } catch (err) {
        console.error('Failed to load job documents:', err);
        container.innerHTML = '<p style="color: #dc2626; font-size: 13px; margin: 0;">Error loading documents</p>';
    }
}

// Link a document from server to a job
async function linkDocumentToJob(jobId, filename, type) {
    if (!isLocalServer()) {
        showToast('Linking requires local server', 'error');
        return;
    }

    try {
        const response = await fetch('/api/jobs/link-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId,
                document: { filename, type }
            })
        });

        const result = await response.json();
        if (result.success) {
            showToast('Document linked!', 'success');
            // Refresh job data and modal
            await importFromMCP();
            loadJobDocuments(jobId);
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        showToast('Failed to link document: ' + err.message, 'error');
    }
}

function closeModal() {
    document.getElementById('jobModal').classList.remove('active');
}

function closeCommandModal() {
    document.getElementById('commandModal').classList.remove('active');
}

function closeUpdateModal() {
    document.getElementById('updateModal').classList.remove('active');
    document.getElementById('updateForm').reset();
}

function showUpdateForm(jobId) {
    // Reset form first
    document.getElementById('updateForm').reset();

    // Get current time in Eastern Time
    const now = new Date();
    const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

    // Format for datetime-local input (YYYY-MM-DDTHH:MM)
    const year = etTime.getFullYear();
    const month = String(etTime.getMonth() + 1).padStart(2, '0');
    const day = String(etTime.getDate()).padStart(2, '0');
    const hours = String(etTime.getHours()).padStart(2, '0');
    const minutes = String(etTime.getMinutes()).padStart(2, '0');
    const formattedTime = `${year}-${month}-${day}T${hours}:${minutes}`;

    // Set form values
    document.getElementById('updateJobId').value = jobId;
    document.getElementById('updateTimestamp').value = formattedTime;
    document.getElementById('updateType').value = '';
    document.getElementById('updateNotes').value = '';
    
    // Open modal
    document.getElementById('updateModal').classList.add('active');
}

async function submitUpdate(event) {
    event.preventDefault();
    
    try {
        const jobId = parseInt(document.getElementById('updateJobId').value);
        const type = document.getElementById('updateType').value;
        const timestamp = document.getElementById('updateTimestamp').value;
        const notes = document.getElementById('updateNotes').value;

        // Validate inputs
        if (!jobId) {
            alert('Error: Job ID is missing');
            return;
        }
        
        if (!type) {
            alert('Error: Please select an update type');
            return;
        }
        
        if (!timestamp) {
            alert('Error: Please select a date and time');
            return;
        }
        
        // Convert local datetime to ISO string (preserve the ET time intent)
        const localDate = new Date(timestamp);
        if (isNaN(localDate.getTime())) {
            alert('Error: Invalid date/time format');
            return;
        }
        const isoTimestamp = new Date(localDate.getTime() - (localDate.getTimezoneOffset() * 60000)).toISOString();
        
        // Get current data
        if (!window.currentData || !window.currentData.jobs) {
            alert('Error: Data not loaded yet. Please refresh the page.');
            return;
        }

        const data = window.currentData;
        const job = data.jobs.find(j => j.id === jobId);

        if (!job) {
            alert(`Error: Could not find job with ID ${jobId}`);
            return;
        }

        // Initialize updates array if it doesn't exist
        if (!job.updates) {
            job.updates = [];
        }
        
        // Add new update
        const newUpdate = {
            type: type,
            timestamp: isoTimestamp,
            notes: notes
        };
        job.updates.push(newUpdate);

        // If rejected, add symbol and update status
        if (type === 'Rejected') {
            if (!job.symbols.includes('❌')) {
                job.symbols.push('❌');
            }
            job.status = 'archived';
        }
        
        // If interview scheduled, ensure applied status
        if (type === 'Interview Scheduled' || type === 'Interview Completed') {
            if (job.status === 'apply-now' || job.status === 'maybe') {
                job.status = 'applied';
            }
        }
        
        // Save and reload
        await saveData(data);
        await loadData();

        // Close modal and refresh job detail
        closeUpdateModal();
        showJobDetail(jobId);
    } catch (error) {
        alert(`Error saving update: ${error.message}`);
    }
}

async function markAsRejected(jobId) {
    if (!confirm('Mark this job as rejected? This will add a rejection update and archive the job.')) {
        return;
    }

    if (!window.currentData || !window.currentData.jobs) return;

    const data = window.currentData;
    const job = data.jobs.find(j => j.id === jobId);

    if (!job) return;
    
    // Initialize updates array if it doesn't exist
    if (!job.updates) {
        job.updates = [];
    }
    
    // Add rejection update with current ET time
    const now = new Date();
    job.updates.push({
        type: 'Rejected',
        timestamp: now.toISOString(),
        notes: 'Marked as rejected'
    });
    
    // Add rejected symbol if not present
    if (!job.symbols.includes('❌')) {
        job.symbols.push('❌');
    }
    
    // Archive the job
    job.status = 'archived';
    
    // Save and reload
    await saveData(data);
    await loadData();
    
    // Refresh job detail
    showJobDetail(jobId);
}

function showCommandModal() {
    const modal = document.getElementById('commandModal');
    const textarea = document.getElementById('commandText');
    const title = document.getElementById('commandModalTitle');

    // Set title to indicate this is Search
    if (title) {
        title.textContent = '🔍 Search Prompt';
    }

    textarea.value = SEARCH_COMMAND;
    modal.classList.add('active');
}

function copyFromModal() {
    const textarea = document.getElementById('commandText');
    textarea.select();

    // Copy whatever is in the textarea (could be search or deep research prompt)
    const textToCopy = textarea.value;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            alert('✅ Copied to clipboard! Paste into Claude.');
            closeCommandModal();
        }).catch(() => {
            // Try fallback
            tryModalExecCommand(textarea);
        });
    } else {
        tryModalExecCommand(textarea);
    }
}

function tryModalExecCommand(textarea) {
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            alert('✅ Copied to clipboard! Paste into Claude.');
            closeCommandModal();
        } else {
            alert('Please manually select the text and copy it (Ctrl+C or Cmd+C)');
        }
    } catch (e) {
        alert('Please manually select the text and copy it (Ctrl+C or Cmd+C)');
    }
}

function setDefaultView() {
    // Reset all filters to show (except archived)
    filterStates = {
        'all': 'active',
        'apply-now': 'active',
        'maybe': 'active',
        'applied': 'active',
        'probably-not': 'active',
        'archived': 'hidden'
    };
    
    // Force sort to fit score descending (reset sortColumn first to avoid toggle)
    sortColumn = null; // Reset so sortJobs doesn't toggle
    sortDirection = 'desc';
    
    // Update filter button UI
    updateFilterButtons();
    
    // Apply filters and sort (this will call renderJobs properly)
    sortJobs('fitScore');
}

async function updateJobStatus(jobId, newStatus) {
    // Safety check
    if (!window.currentData || !window.currentData.jobs) {
        console.error('Data not loaded yet');
        return;
    }
    
    const data = window.currentData;
    const job = data.jobs.find(j => j.id === jobId);
    if (job) {
        const oldStatus = job.status;
        job.status = newStatus;
        
        // Auto-log updates for certain status changes
        if (newStatus === 'applied' && oldStatus !== 'applied') {
            if (!job.updates) {
                job.updates = [];
            }
            job.updates.push({
                type: 'Application Submitted',
                timestamp: new Date().toISOString(),
                notes: 'Marked as applied in dashboard'
            });
            // Set applied date if not already set
            if (!job.applied) {
                job.applied = new Date().toISOString().split('T')[0];
            }
        }
        
        await saveData(data);
        await loadData();
        closeModal();
        
        // If job was archived, switch to default view
        if (newStatus === 'archived') {
            setDefaultView();
        }
    }
}

function filterJobs() {
    // Safety check
    if (!window.currentData || !window.currentData.jobs) {
        console.error('Data not loaded yet');
        return;
    }
    
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    let filtered = window.currentData.jobs;
    
    // Apply status filters first
    const onlyStatus = Object.keys(filterStates).find(key => filterStates[key] === 'only');
    if (onlyStatus) {
        filtered = filtered.filter(job => job.status === onlyStatus);
    } else {
        const hiddenStatuses = Object.keys(filterStates).filter(key => filterStates[key] === 'hidden');
        filtered = filtered.filter(job => !hiddenStatuses.includes(job.status));
    }
    
    // Then apply search filter
    if (searchTerm) {
        filtered = filtered.filter(job => {
            return job.title.toLowerCase().includes(searchTerm) ||
                   job.company.toLowerCase().includes(searchTerm) ||
                   job.industry.toLowerCase().includes(searchTerm);
        });
    }
    
    renderJobs(filtered);
}

function filterByStatus(status) {
    const btn = event.target;
    
    // Handle "All Jobs" button - reset everything
    if (status === 'all') {
        filterStates = {
            'all': 'active',
            'apply-now': 'active',
            'maybe': 'active',
            'applied': 'active',
            'probably-not': 'active',
            'archived': 'active'
        };
        updateFilterButtons();
        sortJobs(sortColumn); // Maintain current sort
        saveFilterState(); // Persist filter state
        return;
    }
    
    // 3-state cycle for other buttons: active → hidden → only → active
    const currentState = filterStates[status];
    
    if (currentState === 'active') {
        // First click: hide this status
        filterStates[status] = 'hidden';
    } else if (currentState === 'hidden') {
        // Second click: show ONLY this status
        filterStates[status] = 'only';
    } else {
        // Third click: back to active (show all)
        filterStates[status] = 'active';
    }
    
    // Reset "All Jobs" since we're filtering now
    filterStates['all'] = 'inactive';

    updateFilterButtons();
    applyFilters();
    saveFilterState(); // Persist filter state
}

function updateFilterButtons() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active', 'hidden', 'only');
        
        // Safely extract status from onclick attribute
        const onclick = btn.getAttribute('onclick');
        if (!onclick) return; // Skip buttons without onclick
        
        const match = onclick.match(/'([^']+)'/);
        if (!match) return; // Skip if regex doesn't match
        
        const status = match[1];
        const state = filterStates[status];
        
        if (state === 'active' || state === 'inactive') {
            btn.classList.add('active');
        } else if (state === 'hidden') {
            btn.classList.add('hidden');
        } else if (state === 'only') {
            btn.classList.add('only');
        }
    });
    
    // Update filter status message
    const statusEl = document.getElementById('filterStatus');
    if (statusEl) {
        const onlyStatus = Object.keys(filterStates).find(key => filterStates[key] === 'only');
        const hiddenStatuses = Object.keys(filterStates).filter(key => filterStates[key] === 'hidden' && key !== 'all');
        
        if (onlyStatus) {
            const labels = {
                'apply-now': '🔴 Apply Now',
                'maybe': '🟠 Maybe',
                'applied': '🟢 Applied',
                'archived': '⚪ Archived'
            };
            statusEl.innerHTML = `<strong>Showing only:</strong> ${labels[onlyStatus] || onlyStatus}`;
        } else if (hiddenStatuses.length > 0) {
            const labels = hiddenStatuses.map(s => {
                const labelMap = {
                    'apply-now': '🔴 Apply Now',
                    'maybe': '🟠 Maybe',
                    'applied': '🟢 Applied',
                    'archived': '⚪ Archived'
                };
                return labelMap[s] || s;
            });
            statusEl.innerHTML = `<strong>Hidden:</strong> ${labels.join(', ')}`;
        } else {
            statusEl.innerHTML = '';
        }
    }
}

function applyFilters() {
    // Safety check
    if (!window.currentData || !window.currentData.jobs) return;

    let filtered = window.currentData.jobs;

    // Check if any status is set to "only"
    const onlyStatus = Object.keys(filterStates).find(key => filterStates[key] === 'only');

    if (onlyStatus) {
        // Show only this status
        filtered = filtered.filter(job => job.status === onlyStatus);
    } else {
        // Hide statuses marked as "hidden" (but ignore 'all' since it's not a real status)
        const hiddenStatuses = Object.keys(filterStates).filter(key =>
            filterStates[key] === 'hidden' && key !== 'all'
        );
        filtered = filtered.filter(job => !hiddenStatuses.includes(job.status));
    }
    
    // Sort the filtered array
    const sorted = filtered.sort((a, b) => {
        let aVal, bVal;
        
        switch(sortColumn) {
            case 'fitScore':
                return sortDirection === 'desc' ? b.fitScore - a.fitScore : a.fitScore - b.fitScore;
            
            case 'title':
                return sortDirection === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);
            
            case 'company':
                return sortDirection === 'asc' ? a.company.localeCompare(b.company) : b.company.localeCompare(a.company);
            
            case 'salary':
                aVal = parseInt((a.salary.match(/\d+/) || [0])[0]);
                bVal = parseInt((b.salary.match(/\d+/) || [0])[0]);
                return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
            
            case 'status':
                const statusOrder = {'apply-now': 0, 'maybe': 1, 'applied': 2, 'probably-not': 3, 'archived': 4};
                aVal = statusOrder[a.status] || 99;
                bVal = statusOrder[b.status] || 99;
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            
            case 'connections':
                aVal = a.connections ? a.connections.length : 0;
                bVal = b.connections ? b.connections.length : 0;
                return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
            
            case 'daysSince':
                aVal = a.found ? new Date(a.found).getTime() : 0;
                bVal = b.found ? new Date(b.found).getTime() : 0;
                return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
            
            default:
                return 0;
        }
    });
    
    // Render the sorted, filtered jobs
    renderJobs(sorted);
}

function updateStats(data) {
    const lastSearch = data.lastSearch ? new Date(data.lastSearch) : null;
    const now = new Date();
    
    if (lastSearch) {
        const diffDays = Math.floor((now - lastSearch) / (1000 * 60 * 60 * 24));
        const timeStr = lastSearch.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
        
        document.getElementById('lastSearchDisplay').innerHTML = `
            ${timeStr}<br>
            <span style="font-size: 14px; opacity: 0.8;">(${diffDays} days ago)</span>
        `;
    } else {
        document.getElementById('lastSearchDisplay').textContent = 'Never';
    }
    
    document.getElementById('totalJobsDisplay').textContent = data.jobs.length;
    document.getElementById('applyNowCount').textContent = 
        data.jobs.filter(j => j.status === 'apply-now').length;
    document.getElementById('appliedCount').textContent = 
        data.jobs.filter(j => j.status === 'applied').length;
}

function renderSearchHistory(data) {
    const container = document.getElementById('searchHistoryContainer');
    if (!container) return;

    if (data.searchHistory.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <h3>No Search History Yet</h3>
                <p>Your search history will appear here once you run your first search</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = data.searchHistory.map(search => `
        <div class="job-detail" style="margin-bottom: 15px;">
            <strong>${new Date(search.timestamp).toLocaleString()}</strong>
            <p>Jobs Found: ${search.jobsFound} | New: ${search.newJobs} | Sources: ${search.sources.join(', ')}</p>
        </div>
    `).join('');
}

function renderArchive(data) {
    const container = document.getElementById('archiveContainer');
    if (!container) return;

    if (data.pdfArchive.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <h3>No Archived PDFs Yet</h3>
                <p>Job descriptions for "Apply Now" tier jobs will be automatically saved here</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = data.pdfArchive.map(pdf => `
        <div class="job-detail" style="margin-bottom: 15px;">
            <strong>${pdf.company} - ${pdf.title}</strong>
            <p>Saved: ${new Date(pdf.savedDate).toLocaleDateString()}</p>
            <button class="btn-primary" onclick="downloadPDF('${pdf.id}')">📥 Download PDF</button>
        </div>
    `).join('');
}

function saveFilters() {
    alert('✅ Filter settings saved!');
}

async function loadData() {
    const data = await initStorage();
    window.currentData = data;

    if (!data || !data.jobs || data.jobs.length === 0) {
        document.getElementById('jobsContainer').innerHTML = '<p style="color: red; padding: 20px;">ERROR: No jobs data loaded. Check console.</p>';
        return;
    }

    // Initialize updates array for all jobs if it doesn't exist
    data.jobs.forEach(job => {
        if (!job.updates) {
            job.updates = [];
        }
    });

    // ALWAYS set default filter state on load (hide archived, show everything else)
    // This ensures jobs are always visible on first load
    filterStates = {
        'all': 'active',
        'apply-now': 'active',
        'maybe': 'active',
        'applied': 'active',
        'probably-not': 'active',
        'archived': 'hidden'
    };
    sortColumn = 'fitScore';
    sortDirection = 'desc';

    // Sort jobs according to current sort settings
    if (sortColumn === 'fitScore') {
        data.jobs.sort((a, b) => sortDirection === 'desc' ? b.fitScore - a.fitScore : a.fitScore - b.fitScore);
    }

    updateStats(data);
    renderSearchHistory(data);
    renderArchive(data);
    renderBoardStats(data.jobs);
    updateFilterButtons();

    // Apply default filters and render
    applyFilters();

    // Safari fallback: if no jobs rendered after 500ms, force render
    setTimeout(() => {
        const container = document.getElementById('jobsContainer');
        if (container && (!container.innerHTML || container.innerHTML.includes('No Jobs Found'))) {
            forceRenderAllJobs();
        }
    }, 500);
}

// Force render jobs on load - fallback if filters fail
function forceRenderAllJobs() {
    if (window.currentData && window.currentData.jobs && window.currentData.jobs.length > 0) {
        const nonArchived = window.currentData.jobs.filter(j => j.status !== 'archived');
        renderJobs(nonArchived);
    } else {
        // Last resort: render sample jobs directly
        const sampleJobs = getSampleJobs();
        const nonArchived = sampleJobs.filter(j => j.status !== 'archived');
        renderJobs(nonArchived);
    }
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
document.addEventListener('keydown', (e) => {
    // ESC closes all modals
    if (e.key === 'Escape') {
        closeModal();
        closeCommandModal();
        closeUpdateModal();
    }

    // Ctrl/Cmd + S saves data (prevent default save dialog)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (window.currentData) {
            saveData(window.currentData).then(() => {
                showToast('Data saved');
            }).catch(err => {
                showToast('Save failed: ' + err.message, 'error');
            });
        }
    }

    // Ctrl/Cmd + F focuses search (if we add search later)
    // if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    //     e.preventDefault();
    //     document.getElementById('searchInput')?.focus();
    // }
});

// Click outside modal to close
document.addEventListener('click', (e) => {
    // Check if click is on a modal backdrop (the modal element itself, not its content)
    if (e.target.classList.contains('modal') && e.target.classList.contains('active')) {
        // Close the specific modal that was clicked
        e.target.classList.remove('active');

        // Reset any forms if needed
        if (e.target.id === 'updateModal') {
            document.getElementById('updateForm')?.reset();
        }
    }
});

// Toast notification utility
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'error' ? '#dc3545' : '#28a745'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 10000;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);

// ============================================
// CHROME EXTENSION INTEGRATION
// ============================================
const EXTENSION_STORAGE_KEY = 'jobSearchExtension_pendingJobs';

// Check for pending jobs from URL hash (from extension)
async function checkExtensionJobs() {
    // Check URL hash for import data
    const hash = window.location.hash;

    if (hash.startsWith('#import=')) {
        try {
            const encoded = hash.substring(8); // Remove '#import='
            const decoded = decodeURIComponent(atob(encoded));
            const pending = JSON.parse(decoded);

            if (pending && pending.length > 0) {
                // Clear the hash to prevent re-import on refresh
                history.replaceState(null, '', window.location.pathname);

                // Import the jobs
                await importJobsArray(pending);
                return;
            }
        } catch (e) {
            // Invalid import hash - ignore
        }
        // Clear invalid hash
        history.replaceState(null, '', window.location.pathname);
    }

    // Also check localStorage as fallback
    try {
        const stored = localStorage.getItem(EXTENSION_STORAGE_KEY);
        if (stored) {
            const pending = JSON.parse(stored);
            if (pending && pending.length > 0) {
                document.getElementById('extensionImportBtn').style.display = 'inline-flex';
                document.getElementById('pendingJobCount').textContent = pending.length;
                return;
            }
        }
    } catch (e) {
        // localStorage error - ignore
    }

    document.getElementById('extensionImportBtn').style.display = 'none';
}

// Import an array of jobs (used by both URL hash and localStorage import)
async function importJobsArray(pending) {
    if (!pending || pending.length === 0) {
        showToast('No jobs to import', 'error');
        return;
    }

    const data = window.currentData;
    if (!data) {
        showToast('Dashboard data not loaded. Please refresh.', 'error');
        return;
    }

    let added = 0;
    let skipped = 0;

    // Get max ID from current jobs
    const maxId = Math.max(0, ...data.jobs.map(j => j.id));
    let nextId = maxId + 1;

    pending.forEach((job) => {
        // Check for duplicates by URL
        const exists = data.jobs.some(j =>
            j.url && job.url && j.url.split('?')[0] === job.url.split('?')[0]
        );

        if (exists) {
            skipped++;
            return;
        }

        // Assign proper ID and add to jobs
        const newJob = {
            ...job,
            id: nextId++,
            updates: job.updates || [],
            found: job.found || new Date().toISOString().split('T')[0],
            posted: job.posted || new Date().toISOString().split('T')[0]
        };
        data.jobs.push(newJob);
        added++;
    });

    // Save updated data
    await saveData(data);

    if (added > 0) {
        showToast(`Imported ${added} job${added > 1 ? 's' : ''} from LinkedIn${skipped > 0 ? ` (${skipped} duplicates skipped)` : ''}`);
        await loadData();
    } else if (skipped > 0) {
        showToast(`All ${skipped} jobs already exist in dashboard`, 'error');
    }
}

// Import jobs from localStorage (manual button click)
async function importFromExtension() {
    try {
        const stored = localStorage.getItem(EXTENSION_STORAGE_KEY);
        if (!stored) {
            showToast('No pending jobs from extension', 'error');
            return;
        }

        const pending = JSON.parse(stored);
        await importJobsArray(pending);

        // Clear extension pending jobs
        localStorage.removeItem(EXTENSION_STORAGE_KEY);
        document.getElementById('extensionImportBtn').style.display = 'none';

    } catch (e) {
        console.error('Extension import error:', e);
        showToast('Import failed: ' + e.message, 'error');
    }
}

// ============================================
// QUICK ADD JOB (from friends/manual)
// ============================================
function showQuickAddModal() {
    document.getElementById('quickAddModal').classList.add('active');
    document.getElementById('quickAddForm').reset();
}

function closeQuickAddModal() {
    document.getElementById('quickAddModal').classList.remove('active');
}

async function submitQuickAdd(event) {
    event.preventDefault();

    const title = document.getElementById('quickAddTitle').value.trim();
    const company = document.getElementById('quickAddCompany').value.trim();

    if (!title || !company) {
        showToast('Please enter job title and company', 'error');
        return;
    }

    try {
        const data = window.currentData;
        const maxId = Math.max(0, ...data.jobs.map(j => j.id));

        const url = document.getElementById('quickAddUrl').value.trim();
        const source = document.getElementById('quickAddSource').value.trim();

        // Check for duplicate URL
        if (url && data.jobs.some(j => j.url && j.url.split('?')[0] === url.split('?')[0])) {
            showToast('A job with this URL already exists', 'error');
            return;
        }

        const newJob = {
            id: maxId + 1,
            title: title,
            company: company,
            industry: document.getElementById('quickAddIndustry').value,
            location: document.getElementById('quickAddLocation').value.trim() || 'Not specified',
            salary: document.getElementById('quickAddSalary').value.trim() || 'Not listed',
            fitScore: 75,
            status: document.getElementById('quickAddStatus').value,
            posted: new Date().toISOString().split('T')[0],
            found: new Date().toISOString().split('T')[0],
            applied: null,
            followup: null,
            url: url,
            symbols: [],
            connections: [],
            sources: source ? [`Referral: ${source}`] : ['Manual Entry'],
            notes: document.getElementById('quickAddNotes').value.trim() || (source ? `Shared by ${source}` : ''),
            updates: []
        };

        data.jobs.push(newJob);
        await saveData(data);

        closeQuickAddModal();
        await loadData();

        showToast(`Added "${title}" at ${company}`);

    } catch (e) {
        console.error('Quick add error:', e);
        showToast('Failed to add job: ' + e.message, 'error');
    }
}

// ============================================
// JOB VALIDATION (Cloudflare Worker Integration)
// ============================================

// Worker URL - update after deployment
const JOB_VALIDATOR_URL = 'https://job-validator.genreme.workers.dev';

let validationResults = [];
let statusCheckResults = [];

function showValidateModal() {
    document.getElementById('validateModal').classList.add('active');
    document.getElementById('validateUrls').value = '';
    document.getElementById('validateResults').style.display = 'none';
    document.getElementById('validateProgress').style.display = 'none';
}

function closeValidateModal() {
    document.getElementById('validateModal').classList.remove('active');
}

function clearValidation() {
    document.getElementById('validateUrls').value = '';
    document.getElementById('validateResults').style.display = 'none';
    document.getElementById('validateProgress').style.display = 'none';
    validationResults = [];
}

async function runValidation() {
    const urlText = document.getElementById('validateUrls').value.trim();
    if (!urlText) {
        showToast('Please enter at least one URL', 'error');
        return;
    }

    const urls = urlText.split('\n')
        .map(u => u.trim())
        .filter(u => u && (u.startsWith('http://') || u.startsWith('https://')));

    if (urls.length === 0) {
        showToast('No valid URLs found', 'error');
        return;
    }

    const btn = document.getElementById('runValidateBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Validating...';

    document.getElementById('validateProgress').style.display = 'block';
    document.getElementById('validateResults').style.display = 'none';

    const progressBar = document.getElementById('validateProgressBar');
    const progressText = document.getElementById('validateProgressText');

    try {
        // Get existing jobs for duplicate check
        const existingJobs = window.currentData?.jobs?.map(j => ({
            id: j.id,
            title: j.title,
            company: j.company,
            url: j.url
        })) || [];

        progressText.textContent = `Validating ${urls.length} URLs...`;
        progressBar.style.width = '10%';

        const response = await fetch(`${JOB_VALIDATOR_URL}/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls, existingJobs })
        });

        progressBar.style.width = '90%';

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        validationResults = data.results;

        progressBar.style.width = '100%';
        progressText.textContent = 'Complete!';

        setTimeout(() => {
            document.getElementById('validateProgress').style.display = 'none';
            displayValidationResults(data);
        }, 500);

    } catch (error) {
        console.error('Validation error:', error);
        showToast(`Validation failed: ${error.message}`, 'error');
        progressText.textContent = `Error: ${error.message}`;
    } finally {
        btn.disabled = false;
        btn.textContent = '🔍 Validate URLs';
    }
}

function displayValidationResults(data) {
    const { results, summary } = data;

    // Summary cards
    const summaryHtml = `
        <div style="background: #d1fae5; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #059669;">${summary.active}</div>
            <div style="font-size: 11px; color: #047857;">Active</div>
        </div>
        <div style="background: #fee2e2; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #dc2626;">${summary.closed}</div>
            <div style="font-size: 11px; color: #991b1b;">Closed</div>
        </div>
        <div style="background: #dbeafe; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #2563eb;">${summary.highFit}</div>
            <div style="font-size: 11px; color: #1d4ed8;">High Fit (75+)</div>
        </div>
        <div style="background: #fef3c7; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #d97706;">${summary.duplicates}</div>
            <div style="font-size: 11px; color: #92400e;">Duplicates</div>
        </div>
    `;
    document.getElementById('validateSummary').innerHTML = summaryHtml;

    // Results list with inline edit capability
    const listHtml = results.map((r, i) => {
        const statusColor = r.status === 'active' ? '#059669' : r.status === 'closed' ? '#dc2626' : '#6b7280';
        const statusIcon = r.status === 'active' ? '✅' : r.status === 'closed' ? '❌' : '⚠️';
        const fitColor = r.fitScore >= 75 ? '#059669' : r.fitScore >= 55 ? '#d97706' : '#dc2626';
        const canAdd = !r.isDuplicate && r.status === 'active';

        return `
            <div class="validation-result-card" data-index="${i}" style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 10px; ${r.isDuplicate ? 'opacity: 0.6;' : ''}">
                <!-- Display View -->
                <div class="result-display" id="result-display-${i}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 14px;" id="display-title-${i}">${escapeHtml(r.title || 'Unknown Title')}</div>
                            <div style="color: #667eea; font-size: 13px;" id="display-company-${i}">${escapeHtml(r.company || 'Unknown Company')}</div>
                            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                                <span id="display-location-${i}">${r.location ? `📍 ${escapeHtml(r.location)}` : ''}</span>
                                <span id="display-salary-${i}">${r.salary && r.salary !== 'Not listed' ? ` · 💰 ${escapeHtml(r.salary)}` : ''}</span>
                            </div>
                            <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">
                                ${escapeHtml(r.source)} · <a href="${escapeHtml(r.url)}" target="_blank" style="color: #3b82f6;">View posting</a>
                                ${r.originalPosting ? ` · <a href="${escapeHtml(r.originalPosting)}" target="_blank" style="color: #8b5cf6;">Company careers</a>` : ''}
                            </div>
                            ${r.warnings.length > 0 ? `<div style="font-size: 11px; color: #d97706; margin-top: 4px;">⚠️ ${r.warnings.join(', ')}</div>` : ''}
                            ${r.isDuplicate ? `<div style="font-size: 11px; color: #dc2626; margin-top: 4px;">🔄 Duplicate of existing job</div>` : ''}
                            ${canAdd ? `<button onclick="toggleEditResult(${i})" style="margin-top: 8px; background: none; border: 1px solid #d1d5db; border-radius: 4px; padding: 4px 8px; font-size: 11px; color: #6b7280; cursor: pointer;">✏️ Edit details</button>` : ''}
                        </div>
                        <div style="text-align: center; margin-left: 15px;">
                            <div style="font-size: 11px; color: ${statusColor}; font-weight: 600;">${statusIcon} ${r.status.toUpperCase()}</div>
                            <div style="font-size: 28px; font-weight: 700; color: ${fitColor}; margin: 5px 0;">${r.fitScore}</div>
                            <div style="font-size: 10px; color: #6b7280;">fit score</div>
                            ${canAdd ? `
                                <label style="display: flex; align-items: center; gap: 4px; margin-top: 8px; font-size: 11px; cursor: pointer;">
                                    <input type="checkbox" class="validate-add-checkbox" data-index="${i}" ${r.fitScore >= 75 ? 'checked' : ''}>
                                    Add
                                </label>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- Edit View (hidden by default) -->
                <div class="result-edit" id="result-edit-${i}" style="display: none;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="font-size: 11px; color: #6b7280; display: block; margin-bottom: 2px;">Job Title</label>
                            <input type="text" id="edit-title-${i}" value="${escapeHtml(r.title || '')}"
                                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;">
                        </div>
                        <div>
                            <label style="font-size: 11px; color: #6b7280; display: block; margin-bottom: 2px;">Company</label>
                            <input type="text" id="edit-company-${i}" value="${escapeHtml(r.company || '')}"
                                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;">
                        </div>
                        <div>
                            <label style="font-size: 11px; color: #6b7280; display: block; margin-bottom: 2px;">Location</label>
                            <input type="text" id="edit-location-${i}" value="${escapeHtml(r.location || '')}"
                                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;">
                        </div>
                        <div>
                            <label style="font-size: 11px; color: #6b7280; display: block; margin-bottom: 2px;">Salary</label>
                            <input type="text" id="edit-salary-${i}" value="${escapeHtml(r.salary || '')}"
                                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;">
                        </div>
                    </div>
                    <div style="margin-top: 10px; display: flex; gap: 8px;">
                        <button onclick="saveEditResult(${i})" style="background: #059669; color: white; border: none; border-radius: 4px; padding: 6px 12px; font-size: 12px; cursor: pointer;">Save</button>
                        <button onclick="toggleEditResult(${i})" style="background: #f3f4f6; color: #374151; border: none; border-radius: 4px; padding: 6px 12px; font-size: 12px; cursor: pointer;">Cancel</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('validateResultsList').innerHTML = listHtml;

    // Show/hide add button based on results
    const addableCount = results.filter(r => r.status === 'active' && !r.isDuplicate).length;
    document.getElementById('addValidatedBtn').style.display = addableCount > 0 ? 'block' : 'none';

    document.getElementById('validateResults').style.display = 'block';
}

function toggleEditResult(index) {
    const displayEl = document.getElementById(`result-display-${index}`);
    const editEl = document.getElementById(`result-edit-${index}`);

    if (editEl.style.display === 'none') {
        displayEl.style.display = 'none';
        editEl.style.display = 'block';
    } else {
        displayEl.style.display = 'block';
        editEl.style.display = 'none';
    }
}

function saveEditResult(index) {
    const title = document.getElementById(`edit-title-${index}`).value.trim();
    const company = document.getElementById(`edit-company-${index}`).value.trim();
    const location = document.getElementById(`edit-location-${index}`).value.trim();
    const salary = document.getElementById(`edit-salary-${index}`).value.trim();

    // Update the validationResults array
    if (validationResults && validationResults[index]) {
        validationResults[index].title = title || 'Unknown Title';
        validationResults[index].company = company || 'Unknown Company';
        validationResults[index].location = location;
        validationResults[index].salary = salary;

        // Update display
        document.getElementById(`display-title-${index}`).textContent = title || 'Unknown Title';
        document.getElementById(`display-company-${index}`).textContent = company || 'Unknown Company';
        document.getElementById(`display-location-${index}`).innerHTML = location ? `📍 ${escapeHtml(location)}` : '';
        document.getElementById(`display-salary-${index}`).innerHTML = salary ? ` · 💰 ${escapeHtml(salary)}` : '';
    }

    // Toggle back to display view
    toggleEditResult(index);
    showToast('Job details updated');
}

async function addValidatedJobs() {
    const checkboxes = document.querySelectorAll('.validate-add-checkbox:checked');
    if (checkboxes.length === 0) {
        showToast('No jobs selected', 'error');
        return;
    }

    const data = window.currentData;
    const maxId = Math.max(0, ...data.jobs.map(j => j.id));
    let addedCount = 0;

    checkboxes.forEach((cb, i) => {
        const idx = parseInt(cb.dataset.index);
        const r = validationResults[idx];

        if (r && r.status === 'active' && !r.isDuplicate) {
            const newJob = {
                id: maxId + addedCount + 1,
                title: r.title || 'Unknown Title',
                company: r.company || 'Unknown Company',
                industry: detectIndustry(r.description || ''),
                location: r.location || 'Not specified',
                salary: r.salary || 'Not listed',
                fitScore: r.fitScore,
                status: r.fitScore >= 75 ? 'apply-now' : 'maybe',
                posted: new Date().toISOString().split('T')[0],
                found: new Date().toISOString().split('T')[0],
                applied: null,
                followup: null,
                url: r.url,
                symbols: [],
                connections: [],
                sources: [r.source],
                notes: `Auto-validated. Fit breakdown: Role ${r.fitBreakdown?.role || 0}, Industry ${r.fitBreakdown?.industry || 0}, Location ${r.fitBreakdown?.location || 0}, Salary ${r.fitBreakdown?.salary || 0}`,
                updates: [{
                    date: new Date().toISOString(),
                    text: 'Added via batch validation'
                }]
            };

            data.jobs.push(newJob);
            addedCount++;
        }
    });

    if (addedCount > 0) {
        await saveData(data);
        await loadData();
        closeValidateModal();
        showToast(`Added ${addedCount} job${addedCount > 1 ? 's' : ''} to tracker`);
    }
}

function detectIndustry(text) {
    const lower = text.toLowerCase();
    if (lower.includes('nonprofit') || lower.includes('non-profit') || lower.includes('501(c)')) return 'Nonprofit';
    if (lower.includes('healthcare') || lower.includes('health') || lower.includes('hospital') || lower.includes('medical')) return 'Healthcare';
    if (lower.includes('education') || lower.includes('university') || lower.includes('school')) return 'Education';
    if (lower.includes('agency') || lower.includes('marketing agency') || lower.includes('creative agency')) return 'Agency';
    return 'Unknown';
}

// ============================================
// STATUS CHECK (All Tracked Jobs)
// ============================================

function closeStatusCheckModal() {
    document.getElementById('statusCheckModal').classList.remove('active');
}

async function checkAllJobStatus() {
    const data = window.currentData;
    if (!data || !data.jobs || data.jobs.length === 0) {
        showToast('No jobs to check', 'error');
        return;
    }

    // Get jobs with URLs that aren't archived
    const jobsToCheck = data.jobs.filter(j => j.url && j.status !== 'archived');

    if (jobsToCheck.length === 0) {
        showToast('No jobs with URLs to check', 'error');
        return;
    }

    document.getElementById('statusCheckModal').classList.add('active');
    document.getElementById('statusCheckResults').style.display = 'none';
    document.getElementById('statusCheckProgress').style.display = 'block';

    const progressBar = document.getElementById('statusCheckProgressBar');
    const progressText = document.getElementById('statusCheckProgressText');

    progressBar.style.width = '10%';
    progressText.textContent = `Analyzing ${jobsToCheck.length} jobs (full scan)...`;

    try {
        const urls = jobsToCheck.map(j => j.url);

        // Use /batch for full analysis instead of /status for quick check
        const response = await fetch(`${JOB_VALIDATOR_URL}/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls, existingJobs: [] })
        });

        progressBar.style.width = '90%';

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();

        // Map results back to jobs with comparison data
        statusCheckResults = jobsToCheck.map(job => {
            const urlResult = result.results.find(r => r.url === job.url);

            // Calculate what changed
            const changes = [];
            if (urlResult) {
                if (urlResult.title && urlResult.title !== job.title &&
                    urlResult.title !== 'Unknown Title' && job.title !== urlResult.title) {
                    changes.push({ field: 'title', old: job.title, new: urlResult.title });
                }
                if (urlResult.company && urlResult.company !== job.company &&
                    urlResult.company !== 'Unknown Company' && job.company !== urlResult.company) {
                    changes.push({ field: 'company', old: job.company, new: urlResult.company });
                }
                if (urlResult.location && urlResult.location !== job.location &&
                    job.location !== urlResult.location) {
                    changes.push({ field: 'location', old: job.location, new: urlResult.location });
                }
                if (urlResult.salary && urlResult.salary !== job.salary &&
                    urlResult.salary !== 'Not listed' && job.salary !== urlResult.salary) {
                    changes.push({ field: 'salary', old: job.salary, new: urlResult.salary });
                }
                // Check if fit score changed significantly (more than 5 points)
                if (urlResult.fitScore && Math.abs(urlResult.fitScore - job.fitScore) > 5) {
                    changes.push({ field: 'fitScore', old: job.fitScore, new: urlResult.fitScore });
                }
            }

            return {
                job,
                status: urlResult?.status || 'error',
                httpStatus: urlResult?.httpStatus,
                newData: urlResult,
                changes,
                hasChanges: changes.length > 0
            };
        });

        progressBar.style.width = '100%';
        progressText.textContent = 'Complete!';

        // Build summary with change counts
        const summary = {
            ...result.summary,
            needsUpdate: statusCheckResults.filter(r => r.hasChanges).length
        };

        setTimeout(() => {
            document.getElementById('statusCheckProgress').style.display = 'none';
            displayStatusCheckResults(summary);
        }, 500);

    } catch (error) {
        console.error('Status check error:', error);
        progressText.textContent = `Error: ${error.message}`;
        showToast(`Status check failed: ${error.message}`, 'error');
    }
}

function displayStatusCheckResults(summary) {
    // Summary cards - now includes "needs update" count
    const summaryHtml = `
        <div style="background: #d1fae5; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #059669;">${summary.active}</div>
            <div style="font-size: 11px; color: #047857;">Still Active</div>
        </div>
        <div style="background: #fee2e2; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #dc2626;">${summary.closed}</div>
            <div style="font-size: 11px; color: #991b1b;">Closed/Removed</div>
        </div>
        <div style="background: #dbeafe; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #2563eb;">${summary.needsUpdate || 0}</div>
            <div style="font-size: 11px; color: #1d4ed8;">Data Updates</div>
        </div>
        <div style="background: #fef3c7; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #d97706;">${summary.errors}</div>
            <div style="font-size: 11px; color: #92400e;">Errors</div>
        </div>
    `;
    document.getElementById('statusCheckSummary').innerHTML = summaryHtml;

    // Group by status and changes
    const closed = statusCheckResults.filter(r => r.status === 'closed');
    const errors = statusCheckResults.filter(r => r.status === 'error');
    const active = statusCheckResults.filter(r => r.status === 'active');
    const needsUpdate = statusCheckResults.filter(r => r.hasChanges && r.status === 'active');

    // Separate closed jobs: applied (in progress) vs not applied
    const closedApplied = closed.filter(r => r.job.status === 'applied' || r.job.appliedDate);
    const closedNotApplied = closed.filter(r => r.job.status !== 'applied' && !r.job.appliedDate);

    let listHtml = '';

    // Show jobs that need data updates FIRST
    if (needsUpdate.length > 0) {
        listHtml += `<h4 style="color: #2563eb; margin: 15px 0 10px;">📝 Data Updates Available (${needsUpdate.length})</h4>`;
        listHtml += needsUpdate.map(r => {
            const changesHtml = r.changes.map(c => {
                const fieldLabel = { title: 'Title', company: 'Company', location: 'Location', salary: 'Salary', fitScore: 'Fit Score' }[c.field] || c.field;
                return `
                    <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0; font-size: 12px;">
                        <input type="checkbox" class="update-field-checkbox" data-job-id="${r.job.id}" data-field="${c.field}" data-new-value="${escapeHtml(String(c.new))}" checked>
                        <span style="color: #6b7280; min-width: 70px;">${fieldLabel}:</span>
                        <span style="color: #dc2626; text-decoration: line-through;">${escapeHtml(String(c.old || '(empty)'))}</span>
                        <span style="color: #6b7280;">→</span>
                        <span style="color: #059669; font-weight: 500;">${escapeHtml(String(c.new))}</span>
                    </div>
                `;
            }).join('');

            return `
                <div style="border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 6px; padding: 10px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600;">${escapeHtml(r.job.title)}</div>
                            <div style="color: #667eea; font-size: 13px;">${escapeHtml(r.job.company)}</div>
                            <div style="margin-top: 8px; padding: 8px; background: white; border-radius: 4px;">
                                ${changesHtml}
                            </div>
                        </div>
                        <div style="text-align: center; margin-left: 10px;">
                            <div style="font-size: 11px; color: #2563eb; font-weight: 600;">NEW SCORE</div>
                            <div style="font-size: 24px; font-weight: 700; color: ${(r.newData?.fitScore || 0) >= 75 ? '#059669' : (r.newData?.fitScore || 0) >= 55 ? '#d97706' : '#dc2626'};">
                                ${r.newData?.fitScore || '?'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    if (closedApplied.length > 0) {
        listHtml += `<h4 style="color: #d97706; margin: 15px 0 10px;">⏳ Closed But Applied (${closedApplied.length}) - Application may still be in progress</h4>`;
        listHtml += closedApplied.map((r, i) => `
            <div style="border: 1px solid #fde68a; background: #fffbeb; border-radius: 6px; padding: 10px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600;">${escapeHtml(r.job.title)}</div>
                        <div style="color: #667eea; font-size: 13px;">${escapeHtml(r.job.company)}</div>
                        <div style="font-size: 11px; color: #d97706;">Applied ${r.job.appliedDate || ''} - Posting closed but app may be in review</div>
                    </div>
                    <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                        <input type="checkbox" class="archive-checkbox" data-job-id="${r.job.id}">
                        Archive anyway
                    </label>
                </div>
            </div>
        `).join('');
    }

    if (closedNotApplied.length > 0) {
        listHtml += `<h4 style="color: #dc2626; margin: 15px 0 10px;">❌ Closed Jobs (${closedNotApplied.length}) - Safe to archive</h4>`;
        listHtml += closedNotApplied.map(r => `
            <div style="border: 1px solid #fecaca; background: #fef2f2; border-radius: 6px; padding: 10px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600;">${escapeHtml(r.job.title)}</div>
                        <div style="color: #667eea; font-size: 13px;">${escapeHtml(r.job.company)}</div>
                        <div style="font-size: 11px; color: #dc2626;">HTTP ${r.httpStatus || 'N/A'}</div>
                    </div>
                    <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                        <input type="checkbox" class="archive-checkbox" data-job-id="${r.job.id}" checked>
                        Archive
                    </label>
                </div>
            </div>
        `).join('');
    }

    if (errors.length > 0) {
        listHtml += `<h4 style="color: #d97706; margin: 15px 0 10px;">⚠️ Could Not Check (${errors.length})</h4>`;
        listHtml += errors.map(r => `
            <div style="border: 1px solid #fde68a; background: #fffbeb; border-radius: 6px; padding: 10px; margin-bottom: 8px;">
                <div style="font-weight: 600;">${escapeHtml(r.job.title)}</div>
                <div style="color: #667eea; font-size: 13px;">${escapeHtml(r.job.company)}</div>
            </div>
        `).join('');
    }

    // Show active jobs without changes
    const activeNoChanges = active.filter(r => !r.hasChanges);
    if (activeNoChanges.length > 0 && (closed.length > 0 || errors.length > 0 || needsUpdate.length > 0)) {
        listHtml += `<h4 style="color: #059669; margin: 15px 0 10px;">✅ Active & Up-to-Date (${activeNoChanges.length})</h4>`;
        listHtml += `<p style="font-size: 12px; color: #6b7280;">${activeNoChanges.map(r => r.job.company).slice(0, 5).join(', ')}${activeNoChanges.length > 5 ? ` and ${activeNoChanges.length - 5} more...` : ''}</p>`;
    }

    if (closed.length === 0 && errors.length === 0 && needsUpdate.length === 0) {
        listHtml = `
            <div style="text-align: center; padding: 30px;">
                <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
                <div style="font-size: 18px; font-weight: 600; color: #059669;">All jobs are up to date!</div>
                <div style="font-size: 13px; color: #6b7280; margin-top: 5px;">No closed postings or data changes found.</div>
            </div>
        `;
    }

    document.getElementById('statusCheckList').innerHTML = listHtml;

    // Show action button if there are things to do
    const hasActions = closed.length > 0 || needsUpdate.length > 0;
    document.getElementById('archiveClosedBtn').style.display = hasActions ? 'block' : 'none';
    if (hasActions) {
        document.getElementById('archiveClosedBtn').textContent =
            needsUpdate.length > 0 && closed.length > 0 ? '💾 Apply Updates & Archive Closed' :
            needsUpdate.length > 0 ? '💾 Apply Selected Updates' :
            '🗄️ Archive Selected Jobs';
    }

    document.getElementById('statusCheckResults').style.display = 'block';
}

async function archiveClosedJobs() {
    const data = window.currentData;
    let archivedCount = 0;
    let updatedCount = 0;

    // Handle field updates first
    const updateCheckboxes = document.querySelectorAll('.update-field-checkbox:checked');
    updateCheckboxes.forEach(cb => {
        const jobId = parseInt(cb.dataset.jobId);
        const field = cb.dataset.field;
        const newValue = cb.dataset.newValue;
        const job = data.jobs.find(j => j.id === jobId);

        if (job && field && newValue !== undefined) {
            const oldValue = job[field];
            job[field] = field === 'fitScore' ? parseInt(newValue) : newValue;
            job.updates = job.updates || [];
            job.updates.push({
                date: new Date().toISOString(),
                text: `Updated ${field}: "${oldValue}" → "${newValue}"`
            });
            updatedCount++;
        }
    });

    // Handle archives
    const archiveCheckboxes = document.querySelectorAll('.archive-checkbox:checked');
    archiveCheckboxes.forEach(cb => {
        const jobId = parseInt(cb.dataset.jobId);
        const job = data.jobs.find(j => j.id === jobId);
        if (job && job.status !== 'archived') {
            job.status = 'archived';
            job.updates = job.updates || [];
            job.updates.push({
                date: new Date().toISOString(),
                text: 'Archived: job posting no longer available'
            });
            archivedCount++;
        }
    });

    if (archivedCount > 0 || updatedCount > 0) {
        await saveData(data);
        await loadData();
        closeStatusCheckModal();

        const messages = [];
        if (updatedCount > 0) messages.push(`Updated ${updatedCount} field${updatedCount > 1 ? 's' : ''}`);
        if (archivedCount > 0) messages.push(`Archived ${archivedCount} job${archivedCount > 1 ? 's' : ''}`);
        showToast(messages.join(', '));
    } else {
        showToast('No changes selected', 'error');
    }
}

// ============================================
// SHARE DASHBOARD SNAPSHOT
// ============================================
function exportShareableSnapshot() {
    const data = window.currentData;
    if (!data || !data.jobs) {
        showToast('No data to share', 'error');
        return;
    }

    // Filter to only active jobs (not archived)
    const activeJobs = data.jobs.filter(j => j.status !== 'archived');

    // Sort by fit score
    activeJobs.sort((a, b) => b.fitScore - a.fitScore);

    // Generate stats
    const stats = {
        total: activeJobs.length,
        applyNow: activeJobs.filter(j => j.status === 'apply-now').length,
        applied: activeJobs.filter(j => j.status === 'applied').length,
        maybe: activeJobs.filter(j => j.status === 'maybe').length,
        interviews: activeJobs.filter(j => j.symbols && j.symbols.includes('✅')).length
    };

    const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // Generate HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>John's Job Search Status - ${new Date().toISOString().split('T')[0]}</title>
    <style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    padding: 20px;
}
.container {
    max-width: 900px;
    margin: 0 auto;
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    overflow: hidden;
}
.header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 30px;
    text-align: center;
}
.header h1 { font-size: 24px; margin-bottom: 8px; }
.header p { opacity: 0.9; font-size: 14px; }
.stats {
    display: flex;
    justify-content: center;
    gap: 20px;
    padding: 20px;
    background: #f7f9fc;
    flex-wrap: wrap;
}
.stat {
    text-align: center;
    padding: 15px 25px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.stat-value { font-size: 28px; font-weight: bold; color: #667eea; }
.stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
.content { padding: 30px; }
.section { margin-bottom: 30px; }
.section h2 {
    font-size: 18px;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 2px solid #e5e7eb;
}
.job-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 12px;
}
.job-card h3 { font-size: 16px; color: #1a202c; margin-bottom: 4px; }
.job-card .company { color: #667eea; font-weight: 600; margin-bottom: 8px; }
.job-card .meta { font-size: 13px; color: #6b7280; }
.job-card .meta span { margin-right: 15px; }
.job-card .notes {
    font-size: 13px;
    color: #4b5563;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #e5e7eb;
}
.status-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    margin-left: 10px;
}
.status-apply-now { background: #dcfce7; color: #166534; }
.status-applied { background: #dbeafe; color: #1e40af; }
.status-maybe { background: #fef3c7; color: #92400e; }
.status-probably-not { background: #f3f4f6; color: #4b5563; }
.footer {
    text-align: center;
    padding: 20px;
    background: #f9fafb;
    color: #9ca3af;
    font-size: 12px;
}
.help-box {
    background: #fef3c7;
    border: 1px solid #fcd34d;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 30px;
}
.help-box h3 { color: #92400e; margin-bottom: 10px; }
.help-box p { color: #78350f; font-size: 14px; line-height: 1.6; }
.help-box a { color: #667eea; }
    </style>
</head>
<body>
    <div class="container">
<div class="header">
    <h1>John's Job Search Status</h1>
    <p>Snapshot as of ${today}</p>
</div>

<div class="stats">
    <div class="stat">
        <div class="stat-value">${stats.total}</div>
        <div class="stat-label">Active Jobs</div>
    </div>
    <div class="stat">
        <div class="stat-value">${stats.applyNow}</div>
        <div class="stat-label">To Apply</div>
    </div>
    <div class="stat">
        <div class="stat-value">${stats.applied}</div>
        <div class="stat-label">Applied</div>
    </div>
    <div class="stat">
        <div class="stat-value">${stats.interviews}</div>
        <div class="stat-label">Interviews</div>
    </div>
</div>

<div class="content">
    <div class="help-box">
        <h3>Know of a job that might be a good fit?</h3>
        <p>I'm looking for <strong>Creative Director / VP Creative / Head of Design</strong> roles at mission-driven organizations (nonprofits, healthcare, education, arts). Boston area or remote preferred, $120K+ salary.</p>
        <p style="margin-top: 10px;">Just text or email me the job link - I'd really appreciate it!</p>
    </div>

    ${stats.applyNow > 0 ? `
    <div class="section">
        <h2>🎯 Planning to Apply (${stats.applyNow})</h2>
        ${activeJobs.filter(j => j.status === 'apply-now').map(j => `
            <div class="job-card">
                <h3>${escapeHtml(j.title)} <span class="status-badge status-apply-now">TO APPLY</span></h3>
                <div class="company">${escapeHtml(j.company)}</div>
                <div class="meta">
                    <span>📍 ${escapeHtml(j.location || 'Not specified')}</span>
                    <span>💰 ${escapeHtml(j.salary || 'Not listed')}</span>
                    <span>⭐ ${j.fitScore}/100 fit</span>
                </div>
            </div>
        `).join('')}
    </div>
    ` : ''}

    ${stats.applied > 0 ? `
    <div class="section">
        <h2>📨 Applied (${stats.applied})</h2>
        ${activeJobs.filter(j => j.status === 'applied').map(j => `
            <div class="job-card">
                <h3>${escapeHtml(j.title)}
                    <span class="status-badge status-applied">APPLIED${j.symbols && j.symbols.includes('✅') ? ' - INTERVIEW' : ''}</span>
                </h3>
                <div class="company">${escapeHtml(j.company)}</div>
                <div class="meta">
                    <span>📍 ${escapeHtml(j.location || 'Not specified')}</span>
                    <span>📅 Applied: ${j.applied || 'Recently'}</span>
                    <span>⭐ ${j.fitScore}/100 fit</span>
                </div>
            </div>
        `).join('')}
    </div>
    ` : ''}

    ${stats.maybe > 0 ? `
    <div class="section">
        <h2>🤔 Considering (${stats.maybe})</h2>
        ${activeJobs.filter(j => j.status === 'maybe').slice(0, 10).map(j => `
            <div class="job-card">
                <h3>${escapeHtml(j.title)} <span class="status-badge status-maybe">MAYBE</span></h3>
                <div class="company">${escapeHtml(j.company)}</div>
                <div class="meta">
                    <span>📍 ${escapeHtml(j.location || 'Not specified')}</span>
                    <span>⭐ ${j.fitScore}/100 fit</span>
                </div>
            </div>
        `).join('')}
        ${stats.maybe > 10 ? `<p style="color: #6b7280; font-size: 13px; margin-top: 10px;">+ ${stats.maybe - 10} more jobs being considered</p>` : ''}
    </div>
    ` : ''}
</div>

<div class="footer">
    <p>Generated from Job Search Command Center</p>
    <p style="margin-top: 5px;">This is a read-only snapshot. For the latest status, ask John for a new export.</p>
</div>
    </div>
</body>
</html>`;

    // Download the file
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `john-job-search-status-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Shareable snapshot downloaded! Send the HTML file to anyone.');
}

// ============================================
// SUPABASE INBOX - FRIEND SUBMISSIONS
// ============================================
const SUPABASE_URL = 'https://ivssytvekpfnaqcbhxkz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2c3N5dHZla3BmbmFxY2JoeGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDExNTYsImV4cCI6MjA4NDk3NzE1Nn0.1N89JKYm3CpBpMmKkJfM2AVXmmEFZvCCWacI2i_PTGU';

let supabaseClient = null;

// Initialize Supabase when script loads
let supabaseInitAttempts = 0;
function initSupabase() {
    supabaseInitAttempts++;

    if (typeof window.supabase !== 'undefined') {
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            loadInbox();
            setupRealtimeSubscription();
        } catch (err) {
            // Failed to create Supabase client
        }
    } else if (supabaseInitAttempts < 10) {
        setTimeout(initSupabase, 500);
    } else {
        const pendingList = document.getElementById('pendingList');
        if (pendingList) {
            pendingList.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 20px;">❌ Database library failed to load. Try refreshing the page.</p>';
        }
    }
}

// Set up real-time subscription for new submissions
function setupRealtimeSubscription() {
    if (!supabaseClient) return;

    supabaseClient
        .channel('job_submissions')
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'job_submissions' },
            () => {
                loadInbox();
                showToast('New job submission received!', 'info');
            }
        )
        .subscribe();
}

// Load inbox submissions (from local server AND Supabase)
async function loadInbox(retryCount = 0) {
    const pendingList = document.getElementById('pendingList');
    let allPending = [];
    let localInboxJobs = [];

    // FIRST: Try to load local inbox jobs from server API
    if (isLocalServer()) {
        try {
            const response = await fetch('/api/jobs');
            if (response.ok) {
                const serverData = await response.json();
                // Filter for jobs with status "inbox"
                localInboxJobs = (serverData.jobs || [])
                    .filter(job => job.status === 'inbox')
                    .map(job => ({
                        // Convert to submission format for rendering
                        id: `local-${job.id}`,
                        title: job.title,
                        company: job.company,
                        location: job.location,
                        salary: job.salary,
                        url: job.url,
                        fit_score: job.fitScore,
                        notes: job.notes,
                        submitted_by: 'Browser Extension',
                        created_at: job.found || new Date().toISOString(),
                        status: 'pending',
                        _isLocal: true,  // Flag to identify local jobs
                        _localId: job.id  // Original job ID for updates
                    }));
            }
        } catch (err) {
            // Could not fetch local inbox
        }
    }

    // SECOND: Try Supabase if available
    if (supabaseClient) {
        try {
            const { data: pending, error } = await supabaseClient
                .from('job_submissions')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (!error && pending) {
                allPending = pending;
            }
        } catch (err) {
            // Supabase error
        }
    }

    // Combine local + Supabase submissions
    const combinedPending = [...localInboxJobs, ...allPending];

    // Render combined results
    if (combinedPending.length > 0 || localInboxJobs.length > 0 || allPending.length > 0) {
        renderPendingSubmissions(combinedPending);
        updateInboxBadge(combinedPending.length);
    } else if (!supabaseClient && localInboxJobs.length === 0) {
        // No data sources available
        if (pendingList) {
            if (isLocalServer()) {
                pendingList.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 20px;">📭 No jobs in inbox. Use the browser extension to capture jobs!</p>';
            } else {
                pendingList.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 20px;">⚠️ Run on localhost:3000 to see extension-captured jobs, or connect Supabase for friend submissions.</p>';
            }
        }
        updateInboxBadge(0);
    } else {
        renderPendingSubmissions([]);
        updateInboxBadge(0);
    }

    // Get recent activity from Supabase (if available)
    if (supabaseClient) {
        try {
            const { data: recent } = await supabaseClient
                .from('job_submissions')
                .select('*')
                .neq('status', 'pending')
                .order('reviewed_at', { ascending: false })
                .limit(10);

            renderRecentActivity(recent || []);
        } catch (err) {
            // Could not fetch recent activity
        }
    }

    // Update the share link
    updateShareLink();
}

function refreshInbox() {
    loadInbox();
    showToast('Inbox refreshed');
}

function renderPendingSubmissions(submissions) {
    const container = document.getElementById('pendingList');
    const noSubmissions = document.getElementById('noPending');
    if (!container || !noSubmissions) return;

    if (!submissions || submissions.length === 0) {
        container.innerHTML = '';
        noSubmissions.style.display = 'block';
        return;
    }

    noSubmissions.style.display = 'none';

    // Store submissions for editing
    window.pendingSubmissions = submissions;

    container.innerHTML = submissions.map((sub, idx) => {
        const fitClass = sub.fit_score >= 75 ? 'fit-great' :
                         sub.fit_score >= 55 ? 'fit-maybe' : 'fit-probably-not';
        const fitLabel = sub.fit_score >= 75 ? '🎯 Great Fit' :
                         sub.fit_score >= 55 ? '🤔 Maybe' : '🤷 Probably Not';

        const date = new Date(sub.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        });

        return `
            <div class="submission-card ${fitClass}" data-sub-id="${sub.id}">
                <!-- Display View -->
                <div id="sub-display-${sub.id}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 5px;">
                                From: <strong>${escapeHtml(sub.submitted_by || 'A friend')}</strong> · ${date}
                            </div>
                            <h3 style="margin: 0 0 5px 0; font-size: 16px;" id="sub-title-${sub.id}">
                                ${escapeHtml(sub.title || 'Job Position')}
                            </h3>
                            <div style="color: #667eea; font-weight: 600; margin-bottom: 10px;" id="sub-company-${sub.id}">
                                ${escapeHtml(sub.company || 'Company')}
                            </div>
                            <div style="font-size: 13px; color: #6b7280;">
                                <span id="sub-location-${sub.id}">${sub.location ? `📍 ${escapeHtml(sub.location)}` : ''}</span>
                                <span id="sub-salary-${sub.id}">${sub.salary ? ` 💰 ${escapeHtml(sub.salary)}` : ''}</span>
                            </div>
                            <a href="${escapeHtml(sub.url)}" target="_blank"
                               style="font-size: 12px; color: #3b82f6; word-break: break-all; display: block; margin-top: 10px;">
                                🔗 ${escapeHtml(sub.url?.substring(0, 50))}...
                            </a>
                            ${sub.notes ? `
                                <div style="margin-top: 10px; padding: 10px; background: #fef3c7; border-radius: 6px; border-left: 3px solid #f59e0b;">
                                    <div style="font-size: 11px; color: #92400e; font-weight: 600; margin-bottom: 4px;">💬 Note from ${escapeHtml(sub.submitted_by || 'friend')}:</div>
                                    <div style="font-size: 13px; color: #78350f;">${escapeHtml(sub.notes)}</div>
                                </div>
                            ` : ''}
                        </div>
                        <div style="text-align: center; margin-left: 20px;">
                            <div class="submission-score">${sub.fit_score || '?'}</div>
                            <div style="font-size: 11px; color: #6b7280;">fit score</div>
                            <div style="font-size: 12px; margin-top: 5px; font-weight: 600; color: ${
                                sub.fit_score >= 75 ? '#16a34a' : sub.fit_score >= 55 ? '#d97706' : '#dc2626'
                            }">${fitLabel}</div>
                        </div>
                    </div>
                    <div class="submission-actions">
                        <button onclick="toggleSubEdit('${sub.id}')" style="background: #f3f4f6; color: #374151; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 13px;">
                            ✏️ Edit
                        </button>
                        <button class="btn-analyze" onclick="analyzeSubmission('${sub.id}', '${escapeHtml(sub.url)}')" id="analyze-${sub.id}" style="background: #059669; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 13px;">
                            🔍 Analyze
                        </button>
                        <button class="btn-accept" onclick="acceptSubmission('${sub.id}')">
                            ✓ Add to Tracker
                        </button>
                        <button class="btn-reject" onclick="rejectSubmission('${sub.id}')">
                            ✗ Skip
                        </button>
                    </div>
                </div>

                <!-- Edit View (hidden by default) -->
                <div id="sub-edit-${sub.id}" style="display: none;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                        <div>
                            <label style="font-size: 11px; color: #6b7280; display: block; margin-bottom: 2px;">Job Title</label>
                            <input type="text" id="sub-edit-title-${sub.id}" value="${escapeHtml(sub.title || '')}"
                                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;">
                        </div>
                        <div>
                            <label style="font-size: 11px; color: #6b7280; display: block; margin-bottom: 2px;">Company</label>
                            <input type="text" id="sub-edit-company-${sub.id}" value="${escapeHtml(sub.company || '')}"
                                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;">
                        </div>
                        <div>
                            <label style="font-size: 11px; color: #6b7280; display: block; margin-bottom: 2px;">Location</label>
                            <input type="text" id="sub-edit-location-${sub.id}" value="${escapeHtml(sub.location || '')}"
                                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;">
                        </div>
                        <div>
                            <label style="font-size: 11px; color: #6b7280; display: block; margin-bottom: 2px;">Salary</label>
                            <input type="text" id="sub-edit-salary-${sub.id}" value="${escapeHtml(sub.salary || '')}"
                                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;">
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="saveSubEdit('${sub.id}')" style="background: #059669; color: white; border: none; border-radius: 4px; padding: 6px 12px; font-size: 12px; cursor: pointer;">Save</button>
                        <button onclick="toggleSubEdit('${sub.id}')" style="background: #f3f4f6; color: #374151; border: none; border-radius: 4px; padding: 6px 12px; font-size: 12px; cursor: pointer;">Cancel</button>
                    </div>
                </div>

                <div id="analysis-${sub.id}" style="display: none; margin-top: 10px; padding: 10px; background: #f0fdf4; border-radius: 6px; font-size: 12px;"></div>
            </div>
        `;
    }).join('');
}

function renderRecentActivity(submissions) {
    const container = document.getElementById('recentActivity');
    if (!container) return;

    if (!submissions || submissions.length === 0) {
        container.innerHTML = '<p style="color: #9ca3af;">No recent activity</p>';
        return;
    }

    container.innerHTML = submissions.map(sub => {
        const date = new Date(sub.reviewed_at || sub.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric'
        });
        const icon = sub.status === 'accepted' ? '✅' : '❌';
        const status = sub.status === 'accepted' ? 'Added to tracker' : 'Skipped';

        return `
            <div style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
                ${icon} <strong>${escapeHtml(sub.title || 'Job')}</strong> at ${escapeHtml(sub.company || 'Company')}
                - ${status} (${date})
                <span style="color: #9ca3af; margin-left: 10px;">from ${escapeHtml(sub.submitted_by || 'friend')}</span>
            </div>
        `;
    }).join('');
}

function updateInboxBadge(count) {
    const badge = document.getElementById('inboxBadge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }
}

// Analyze a submission using the validator worker
async function analyzeSubmission(id, url) {
    const btn = document.getElementById(`analyze-${id}`);
    const resultDiv = document.getElementById(`analysis-${id}`);

    if (!url) {
        showToast('No URL to analyze', 'error');
        return;
    }

    btn.textContent = '⏳ Analyzing...';
    btn.disabled = true;

    try {
        const response = await fetch(`${JOB_VALIDATOR_URL}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: url,
                existingJobs: window.currentData?.jobs?.map(j => ({
                    id: j.id, title: j.title, company: j.company, url: j.url
                })) || []
            })
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const result = await response.json();

        // Display analysis
        const statusIcon = result.status === 'active' ? '✅' : result.status === 'closed' ? '❌' : '⚠️';
        const fitColor = result.fitScore >= 75 ? '#059669' : result.fitScore >= 55 ? '#d97706' : '#dc2626';

        let analysisHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span><strong>Full Analysis:</strong></span>
                <span style="font-size: 18px; font-weight: 700; color: ${fitColor};">${result.fitScore}/100</span>
            </div>
            <div style="margin-bottom: 5px;">${statusIcon} <strong>Status:</strong> ${result.status.toUpperCase()}</div>
        `;

        if (result.fitBreakdown) {
            analysisHtml += `<div style="margin-bottom: 5px;">📊 <strong>Breakdown:</strong> Role +${result.fitBreakdown.role || 0}, Industry +${result.fitBreakdown.industry || 0}, Location +${result.fitBreakdown.location || 0}, Salary +${result.fitBreakdown.salary || 0}</div>`;
        }

        if (result.isDuplicate) {
            analysisHtml += `<div style="color: #dc2626;">🔄 <strong>Duplicate:</strong> Already in your tracker</div>`;
        }

        if (result.originalPosting) {
            analysisHtml += `<div>🏢 <a href="${escapeHtml(result.originalPosting)}" target="_blank" style="color: #667eea;">Company careers page</a></div>`;
        }

        if (result.warnings && result.warnings.length > 0) {
            analysisHtml += `<div style="color: #d97706; margin-top: 5px;">⚠️ ${result.warnings.join(', ')}</div>`;
        }

        resultDiv.innerHTML = analysisHtml;
        resultDiv.style.display = 'block';

        // Update Supabase with new score if significantly different
        if (supabaseClient && Math.abs((result.fitScore || 0) - 50) > 5) {
            await supabaseClient
                .from('job_submissions')
                .update({
                    fit_score: result.fitScore,
                    title: result.title || undefined,
                    company: result.company || undefined,
                    location: result.location || undefined,
                    salary: result.salary || undefined
                })
                .eq('id', id);
        }

        btn.textContent = '✓ Analyzed';
        btn.style.background = '#6b7280';

    } catch (error) {
        console.error('Analysis error:', error);
        resultDiv.innerHTML = `<div style="color: #dc2626;">❌ Analysis failed: ${error.message}</div>`;
        resultDiv.style.display = 'block';
        btn.textContent = '🔍 Retry';
        btn.disabled = false;
    }
}

function toggleSubEdit(id) {
    const displayEl = document.getElementById(`sub-display-${id}`);
    const editEl = document.getElementById(`sub-edit-${id}`);

    if (editEl.style.display === 'none') {
        displayEl.style.display = 'none';
        editEl.style.display = 'block';
    } else {
        displayEl.style.display = 'block';
        editEl.style.display = 'none';
    }
}

async function saveSubEdit(id) {
    const title = document.getElementById(`sub-edit-title-${id}`).value.trim();
    const company = document.getElementById(`sub-edit-company-${id}`).value.trim();
    const location = document.getElementById(`sub-edit-location-${id}`).value.trim();
    const salary = document.getElementById(`sub-edit-salary-${id}`).value.trim();

    // Update the pendingSubmissions array
    if (window.pendingSubmissions) {
        const sub = window.pendingSubmissions.find(s => s.id === id);
        if (sub) {
            sub.title = title || 'Job Position';
            sub.company = company || 'Company';
            sub.location = location;
            sub.salary = salary;

            // Update display
            document.getElementById(`sub-title-${id}`).textContent = title || 'Job Position';
            document.getElementById(`sub-company-${id}`).textContent = company || 'Company';
            document.getElementById(`sub-location-${id}`).innerHTML = location ? `📍 ${escapeHtml(location)}` : '';
            document.getElementById(`sub-salary-${id}`).innerHTML = salary ? ` 💰 ${escapeHtml(salary)}` : '';
        }
    }

    // Also update in Supabase so edits persist
    if (supabaseClient) {
        try {
            await supabaseClient
                .from('job_submissions')
                .update({ title, company, location, salary })
                .eq('id', id);
        } catch (e) {
            console.error('Error saving edit to Supabase:', e);
        }
    }

    // Toggle back to display view
    toggleSubEdit(id);
    showToast('Job details updated');
}

async function acceptSubmission(id) {
    try {
        // Get the submission - check local cache first for edits
        let sub = window.pendingSubmissions?.find(s => s.id === id);

        // Handle LOCAL inbox jobs (from browser extension)
        if (sub && sub._isLocal) {
            // Update the job status from 'inbox' to appropriate status via server API
            const newStatus = sub.fit_score >= 75 ? 'apply-now' : 'maybe';
            const response = await fetch('/api/jobs');
            if (response.ok) {
                const serverData = await response.json();
                const job = serverData.jobs.find(j => j.id === sub._localId);
                if (job) {
                    job.status = newStatus;
                    job.notes = job.notes || '';
                    if (!job.notes.includes('Accepted from inbox')) {
                        job.notes = `✅ Accepted from inbox on ${new Date().toLocaleDateString()}\n\n${job.notes}`;
                    }
                    job.updates = job.updates || [];
                    job.updates.unshift({
                        date: new Date().toISOString(),
                        text: `Accepted from inbox → ${newStatus}`
                    });

                    // Save back to server
                    await fetch('/api/jobs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(serverData)
                    });

                    // Reload data
                    await loadData();
                    loadInbox();
                    showToast(`Added "${job.title}" to your tracker as "${newStatus}"!`);
                    return;
                }
            }
            showToast('Failed to update job status', 'error');
            return;
        }

        // Handle SUPABASE submissions (from friends)
        if (!supabaseClient) {
            showToast('Supabase not connected', 'error');
            return;
        }

        if (!sub) {
            const { data, error: fetchError } = await supabaseClient
                .from('job_submissions')
                .select('*')
                .eq('id', id)
                .single();
            if (fetchError) throw fetchError;
            sub = data;
        }

        // Add to dashboard jobs
        const data = window.currentData;
        const maxId = Math.max(0, ...data.jobs.map(j => j.id));

        // Check for duplicate URL
        if (sub.url && data.jobs.some(j => j.url && j.url.split('?')[0] === sub.url.split('?')[0])) {
            showToast('This job URL is already in your tracker', 'error');
            // Still mark as accepted
            await supabaseClient
                .from('job_submissions')
                .update({ status: 'accepted', reviewed_at: new Date().toISOString() })
                .eq('id', id);
            loadInbox();
            return;
        }

        const newJob = {
            id: maxId + 1,
            title: sub.title || 'Job Position',
            company: sub.company || 'Company',
            industry: sub.industry || 'Unknown',
            location: sub.location || 'Not specified',
            salary: sub.salary || 'Not listed',
            fitScore: sub.fit_score || 50,
            status: sub.fit_score >= 75 ? 'apply-now' : 'maybe',
            posted: new Date().toISOString().split('T')[0],
            found: new Date().toISOString().split('T')[0],
            applied: null,
            followup: null,
            url: sub.url,
            symbols: [],
            connections: [],
            sources: [`Referral: ${sub.submitted_by || 'Friend'}`],
            notes: sub.notes
                ? `Submitted by ${sub.submitted_by || 'a friend'}. Note: "${sub.notes}"`
                : `Submitted by ${sub.submitted_by || 'a friend'} via Job Submission Form`,
            updates: []
        };

        data.jobs.push(newJob);
        await saveData(data);

        // Update Supabase status
        await supabaseClient
            .from('job_submissions')
            .update({ status: 'accepted', reviewed_at: new Date().toISOString() })
            .eq('id', id);

        await loadData();
        loadInbox();

        showToast(`Added "${newJob.title}" to your tracker!`);

    } catch (err) {
        console.error('Error accepting submission:', err);
        showToast('Failed to add job', 'error');
    }
}

async function rejectSubmission(id) {
    try {
        // Get the submission from cache
        let sub = window.pendingSubmissions?.find(s => s.id === id);

        // Handle LOCAL inbox jobs (from browser extension) - archive them
        if (sub && sub._isLocal) {
            const response = await fetch('/api/jobs');
            if (response.ok) {
                const serverData = await response.json();
                const job = serverData.jobs.find(j => j.id === sub._localId);
                if (job) {
                    job.status = 'archived';
                    job.notes = job.notes || '';
                    if (!job.notes.includes('Skipped from inbox')) {
                        job.notes = `⏭️ Skipped from inbox on ${new Date().toLocaleDateString()}\n\n${job.notes}`;
                    }
                    job.updates = job.updates || [];
                    job.updates.unshift({
                        date: new Date().toISOString(),
                        text: 'Skipped from inbox → archived'
                    });

                    // Save back to server
                    await fetch('/api/jobs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(serverData)
                    });

                    loadInbox();
                    showToast('Job skipped and archived');
                    return;
                }
            }
            showToast('Failed to skip job', 'error');
            return;
        }

        // Handle SUPABASE submissions
        if (!supabaseClient) return;

        await supabaseClient
            .from('job_submissions')
            .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
            .eq('id', id);

        loadInbox();
        showToast('Submission skipped');

    } catch (err) {
        console.error('Error rejecting submission:', err);
        showToast('Failed to skip', 'error');
    }
}

function updateShareLink() {
    // Hosted URL for friends to submit jobs
    const link = 'https://genreme.github.io/job-share/submit-job.html';
    document.getElementById('submitLinkDisplay').textContent = link;
}

function copySubmitLink() {
    const link = 'https://genreme.github.io/job-share/submit-job.html';
    navigator.clipboard.writeText(link).then(() => {
        showToast('Share link copied!');
    }).catch(() => {
        showToast('Could not copy link', 'error');
    });
}

// ============================================================================
// COMMAND PALETTE
// ============================================================================

const MCP_COMMANDS = [
    // DISCOVERY
    {
        category: 'discovery',
        name: 'Search for Jobs',
        icon: '🔍',
        description: 'Search job boards for new opportunities matching your criteria',
        prompt: `Search for jobs matching my profile. Use these tools in order:
1. get_existing_jobs - Check what I already have to avoid duplicates
2. get_target_roles - Understand my search criteria
3. Browse job boards and for each interesting job:
   - add_job_manual if you can extract the details
   - Or research_job_url if you need to fetch more data

Focus on roles matching my target titles and preferred industries.`
    },
    {
        category: 'discovery',
        name: 'Review Inbox',
        icon: '📥',
        description: 'Review and triage jobs waiting in the inbox',
        prompt: `Review my job inbox and help me triage:
1. get_inbox - Get all inbox jobs sorted by fit score
2. For each job, present: title, company, fit score, and reasoning
3. Ask me to categorize each as: apply-now, maybe, or probably-not
4. confirm_job to move jobs to my chosen status

Present jobs one at a time and wait for my decision.`
    },
    {
        category: 'discovery',
        name: 'Add Job Manually',
        icon: '➕',
        description: 'Add a job you found manually (for auth-required pages)',
        prompt: `I want to add a job I found. Use add_job_manual with:
- title: [JOB TITLE]
- company: [COMPANY NAME]
- url: [JOB URL]
- location: [LOCATION]
- salary: [SALARY if known]

The tool will auto-detect the source board and calculate a fit score.`
    },
    {
        category: 'discovery',
        name: 'Check for Duplicates',
        icon: '🔄',
        description: 'See all tracked jobs to avoid adding duplicates',
        prompt: `Show me what jobs I'm already tracking:
1. get_existing_jobs - List all companies and URLs
2. Summarize by status (inbox, apply-now, maybe, applied, etc.)
3. Highlight any companies where I have multiple roles`
    },

    // BOARDS
    {
        category: 'boards',
        name: 'Analyze Board Quality',
        icon: '📊',
        description: 'Analyze and rank job boards by quality metrics (auto-saves)',
        prompt: `Analyze my job board quality and save the results:
1. analyze_boards - This will:
   - Calculate extraction rates, freshness, and completeness per board
   - Generate recommendations (which boards to prioritize/avoid)
   - Auto-sync scores to the board registry

Show me the ranked boards and any recommendations.`
    },
    {
        category: 'boards',
        name: 'Preview Board Analysis',
        icon: '👁️',
        description: 'Preview board quality without saving',
        prompt: `Preview board quality analysis (don't save yet):
analyze_boards with preview: true

Show me the results so I can review before committing.`
    },
    {
        category: 'boards',
        name: 'View Board Rankings',
        icon: '🏆',
        description: 'See current board quality rankings',
        prompt: `Show my job board rankings:
get_job_boards - List boards sorted by quality rating

Display each board's quality score, success rate, and job count.`
    },
    {
        category: 'boards',
        name: 'Get Board Report',
        icon: '📋',
        description: 'Detailed quality report for a specific board',
        prompt: `Give me a detailed report on [BOARD_NAME]:
get_board_report with boardId: "[BOARD_ID]"

Show all metrics, recommendations, and comparison to other boards.`
    },
    {
        category: 'boards',
        name: 'Add New Board',
        icon: '🆕',
        description: 'Add a new job board for testing',
        prompt: `Add a new job board to test:
add_test_board with:
- name: "[BOARD NAME]"
- domain: "[domain.com]"
- notes: "[why I'm adding this board]"

It will start in testing status until promoted.`
    },
    {
        category: 'boards',
        name: 'Blacklist Board',
        icon: '🚫',
        description: 'Blacklist a low-quality board (requires confirmation)',
        prompt: `I want to blacklist a board that's providing poor results:
blacklist_board with:
- boardId: "[BOARD_ID]"
- reason: "[Why this board should be blacklisted]"
- userConfirmed: true

This removes it from my active board rotation.`
    },

    // APPLICATION
    {
        category: 'application',
        name: 'Generate Resume',
        icon: '📄',
        description: 'Generate a tailored resume for a specific job',
        prompt: `Generate a tailored resume for job ID [JOB_ID]:
1. get_job_detail - Get job requirements
2. get_profile - Get my experience and skills
3. generate_optimized_resume - Create keyword-optimized resume

Include relevant experience and skills that match the job description.`
    },
    {
        category: 'application',
        name: 'Generate Cover Letter',
        icon: '✉️',
        description: 'Generate a cover letter with company research',
        prompt: `Generate a cover letter for job ID [JOB_ID]:
1. get_job_detail - Get job info
2. get_research with type: "full" - Get company research
3. generate_researched_cover_letter - Create personalized letter

Reference specific company initiatives and how my experience aligns.`
    },
    {
        category: 'application',
        name: 'Research Company',
        icon: '🔬',
        description: 'Deep research on a company before applying',
        prompt: `Research the company for job ID [JOB_ID]:
1. start_company_research - Initialize research
2. [Search web for company news, culture, challenges]
3. save_company_research - Store findings

Focus on: recent news, culture, funding, and challenges I can help with.`
    },
    {
        category: 'application',
        name: 'Update Job Status',
        icon: '📝',
        description: 'Update a job with new information or status change',
        prompt: `Update job ID [JOB_ID]:
update_job with:
- jobId: [JOB_ID]
- updates: { status: "[new_status]", notes: "[what changed]" }

Valid statuses: inbox, apply-now, maybe, probably-not, applied, archived`
    },
    {
        category: 'application',
        name: 'Archive Job',
        icon: '📦',
        description: 'Archive a closed or rejected job',
        prompt: `Archive job ID [JOB_ID]:
archive_job with:
- jobId: [JOB_ID]
- reason: "[Why - closed, rejected, withdrew, etc.]"

This moves it out of active tracking.`
    },
    {
        category: 'application',
        name: 'Check Follow-ups',
        icon: '📬',
        description: 'See which jobs need follow-up',
        prompt: `Show jobs that need follow-up:
1. get_followups - Get prioritized follow-up queue
2. For each high-priority item, show:
   - Job title and company
   - Days since last activity
   - Suggested follow-up action`
    },

    // INTERVIEW
    {
        category: 'interview',
        name: 'Generate Interview Questions',
        icon: '❓',
        description: 'Generate likely interview questions for a role',
        prompt: `Generate interview questions for job ID [JOB_ID]:
1. get_job_detail - Get role requirements
2. get_stories_by_category - Get my STAR stories
3. generate_interview_questions - Create personalized questions

Link each question to relevant stories I can use.`
    },
    {
        category: 'interview',
        name: 'Practice Session',
        icon: '🎯',
        description: 'Start an interview practice session',
        prompt: `Start interview practice for job ID [JOB_ID]:
1. start_practice_session with:
   - jobId: [JOB_ID]
   - sessionType: "mixed" (behavioral + technical)
   - feedbackTiming: "after_each"
2. For each question, let me answer
3. score_session_answer - Give feedback on my response`
    },
    {
        category: 'interview',
        name: 'Pre-Interview Checklist',
        icon: '✅',
        description: 'Get ready checklist before an interview',
        prompt: `Get my pre-interview checklist for job ID [JOB_ID]:
get_pre_interview_checklist with jobId: [JOB_ID]

This includes:
- Company talking points
- Top stories to use
- Questions to ask them
- Focus areas based on practice`
    },
    {
        category: 'interview',
        name: 'Research Interviewer',
        icon: '🔎',
        description: 'Research your interviewer before meeting',
        prompt: `Research interviewer for job ID [JOB_ID]:
start_interviewer_research with:
- jobId: [JOB_ID]
- interviewerName: "[NAME]"
- interviewerTitle: "[TITLE]"

Find: background, interview style, shared interests, talking points.`
    },
    {
        category: 'interview',
        name: 'Capture Interview Notes',
        icon: '📝',
        description: 'Record notes after an interview',
        prompt: `Capture interview notes for job ID [JOB_ID]:
capture_interview_transcript with:
- jobId: [JOB_ID]
- sessionType: "real"
- interviewerName: "[NAME]"
- rawTranscript: "[My notes and recollections]"
- overallVibe: "positive|neutral|negative"
- highlights: ["key moment 1", "key moment 2"]`
    },

    // ANALYTICS
    {
        category: 'analytics',
        name: 'Pipeline Overview',
        icon: '📊',
        description: 'See your job search funnel metrics',
        prompt: `Show my pipeline metrics:
1. get_funnel_metrics - Sankey flow through stages
2. get_response_rates - Response rates by dimension
3. get_application_stats - Overall statistics

Visualize where jobs are getting stuck.`
    },
    {
        category: 'analytics',
        name: 'Response Rate Analysis',
        icon: '📈',
        description: 'Analyze response rates by different factors',
        prompt: `Analyze my response rates:
get_response_rates by each dimension:
- by_industry
- by_company_size
- by_source

Show which segments have the highest response rates.`
    },
    {
        category: 'analytics',
        name: 'Identify Bottlenecks',
        icon: '⏱️',
        description: 'Find where jobs are getting stuck',
        prompt: `Identify pipeline bottlenecks:
1. get_time_in_stage - How long jobs stay in each status
2. get_bottlenecks - Stages exceeding threshold
3. Recommend actions to improve flow`
    },
    {
        category: 'analytics',
        name: 'Skill Gap Analysis',
        icon: '🎯',
        description: 'Find skills employers want that you might be missing',
        prompt: `Analyze skill gaps:
1. get_skill_gaps - Skills requested but not in my profile
2. get_skill_gap_recommendations - Actionable next steps

Prioritize by frequency in job descriptions.`
    },

    // PROFILE
    {
        category: 'profile',
        name: 'View Profile',
        icon: '👤',
        description: 'See your full professional profile',
        prompt: `Show my professional profile:
get_profile - Full profile including:
- Experience with projects
- Skills by category
- STAR stories
- Target roles
- Communication preferences`
    },
    {
        category: 'profile',
        name: 'Find Stories by Theme',
        icon: '📖',
        description: 'Find STAR stories matching a theme',
        prompt: `Find my stories about [THEME]:
get_stories_by_category with category: "[THEME]"

Themes: leadership, conflict, failure, achievement, teamwork, innovation`
    },
    {
        category: 'profile',
        name: 'Profile Cleanup',
        icon: '🧹',
        description: 'Find duplicates, stale items, and gaps in profile',
        prompt: `Run profile cleanup analysis:
run_weekly_cleanup - Find:
- Duplicate skills/stories
- Stale items not used recently
- Gaps in evidence

Review findings before making changes.`
    },
    {
        category: 'profile',
        name: 'Get Resume Match',
        icon: '🎯',
        description: 'See how well your profile matches a job',
        prompt: `Check resume match for job ID [JOB_ID]:
get_resume_match with jobId: [JOB_ID]

Shows:
- Match percentage
- Matching skills/experience
- Gaps to address in cover letter`
    },

    // MAINTENANCE
    {
        category: 'maintenance',
        name: 'Verify Active Jobs',
        icon: '✅',
        description: 'Check if your active jobs are still open',
        prompt: `Verify my active job postings are still open:
1. get_jobs with status filter for apply-now, maybe, applied
2. For each job with a URL, check if still active
3. Archive any that are closed with reason
4. Report: X active, Y closed, Z errors`
    },
    {
        category: 'maintenance',
        name: 'Browser Job Search',
        icon: '🌐',
        description: 'Use browser to search boards and capture jobs directly',
        prompt: `Search job boards using browser and add jobs directly:

1. First call get_existing_jobs to know what to skip
2. Navigate to job boards (Lever, Greenhouse, LinkedIn, etc.)
3. For each interesting job:
   - Extract: title, company, location, salary
   - Verify the URL is the direct company posting
   - Use add_job_manual to add to inbox

Track which board each job came from for quality analysis.`
    },
    {
        category: 'maintenance',
        name: 'Deep Pipeline Review',
        icon: '🔬',
        description: 'Full review of job pipeline with updates',
        prompt: `Do a deep review of my job pipeline:

1. get_jobs - Load all jobs
2. For each non-archived job:
   - Check if posting is still active
   - Research any updates (new info, company news)
   - Update notes with findings
3. Archive closed jobs with reason
4. Identify follow-up opportunities
5. Summarize: active jobs, need action, recently closed`
    }
];

let currentPaletteCategory = 'all';

function showCommandPalette() {
    const modal = document.getElementById('commandPaletteModal');
    modal.classList.add('active');
    renderCommands();
    document.getElementById('commandSearch').focus();
}

function closeCommandPalette() {
    document.getElementById('commandPaletteModal').classList.remove('active');
    document.getElementById('commandSearch').value = '';
    currentPaletteCategory = 'all';
    // Reset tab styling
    document.querySelectorAll('.palette-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.palette-tab').classList.add('active');
}

function filterPaletteCategory(category) {
    currentPaletteCategory = category;
    document.querySelectorAll('.palette-tab').forEach(t => {
        t.classList.toggle('active',
            (category === 'all' && t.textContent === 'All') ||
            t.textContent.toLowerCase().includes(category)
        );
    });
    renderCommands();
}

function filterCommands(searchText) {
    renderCommands(searchText.toLowerCase());
}

function renderCommands(searchFilter = '') {
    const container = document.getElementById('commandsList');

    const filtered = MCP_COMMANDS.filter(cmd => {
        const matchesCategory = currentPaletteCategory === 'all' || cmd.category === currentPaletteCategory;
        const matchesSearch = !searchFilter ||
            cmd.name.toLowerCase().includes(searchFilter) ||
            cmd.description.toLowerCase().includes(searchFilter) ||
            cmd.prompt.toLowerCase().includes(searchFilter);
        return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 40px;">No commands match your search.</p>';
        return;
    }

    // Group by category
    const grouped = {};
    filtered.forEach(cmd => {
        if (!grouped[cmd.category]) grouped[cmd.category] = [];
        grouped[cmd.category].push(cmd);
    });

    const categoryLabels = {
        discovery: '🔍 Discovery',
        boards: '📊 Job Boards',
        application: '📝 Application',
        interview: '🎤 Interview Prep',
        analytics: '📈 Analytics',
        profile: '👤 Profile',
        maintenance: '🔧 Maintenance'
    };

    let html = '';
    Object.entries(grouped).forEach(([cat, cmds]) => {
        if (currentPaletteCategory === 'all') {
            html += `<h3 style="margin: 20px 0 10px 0; color: #667eea; font-size: 14px;">${categoryLabels[cat] || cat}</h3>`;
        }
        cmds.forEach((cmd, idx) => {
            const cmdId = `cmd-${cat}-${idx}`;
            html += `
                <div class="command-card" id="${cmdId}" onclick="toggleCommandExpand('${cmdId}')">
                    <div class="command-name">
                        <span>${cmd.icon}</span>
                        <span>${cmd.name}</span>
                        <span class="command-category ${cmd.category}">${cmd.category}</span>
                    </div>
                    <div class="command-desc">${cmd.description}</div>
                    <div class="command-prompt">${escapeHtml(cmd.prompt)}</div>
                    <div class="command-actions">
                        <button class="btn-copy-prompt" onclick="copyCommandPrompt(event, '${cmdId}', \`${escapeForJs(cmd.prompt)}\`)">📋 Copy Prompt</button>
                        <button class="btn-show-prompt" onclick="toggleCommandExpand('${cmdId}', event)">👁️ Show/Hide</button>
                    </div>
                </div>
            `;
        });
    });

    container.innerHTML = html;
}

function escapeForJs(str) {
    return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function toggleCommandExpand(cmdId, event) {
    if (event) event.stopPropagation();
    const card = document.getElementById(cmdId);
    card.classList.toggle('expanded');
}

function copyCommandPrompt(event, cmdId, prompt) {
    event.stopPropagation();
    const card = document.getElementById(cmdId);

    navigator.clipboard.writeText(prompt).then(() => {
        card.classList.add('copied');
        showToast('Prompt copied! Paste in Claude.');
        setTimeout(() => card.classList.remove('copied'), 2000);
    }).catch(() => {
        // Fallback: show in command modal
        const modal = document.getElementById('commandModal');
        const textarea = document.getElementById('commandText');
        const title = document.getElementById('commandModalTitle');
        if (title) title.textContent = '📋 Copy This Prompt';
        textarea.value = prompt;
        modal.classList.add('active');
        setTimeout(() => {
            textarea.focus();
            textarea.select();
        }, 100);
    });
}

// Close palette on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const palette = document.getElementById('commandPaletteModal');
        if (palette.classList.contains('active')) {
            closeCommandPalette();
        }
    }
});

// Initialize on load
window.addEventListener('load', async () => {
    try {
        await loadData();
    } catch (err) {
        // loadData error - silent fail
    }

    try {
        await checkExtensionJobs();
    } catch (err) {
        // checkExtensionJobs error - silent fail
    }

    // Update inbox badge on initial load (before Supabase loads)
    try {
        await loadInbox();
    } catch (err) {
        // Initial loadInbox error - silent fail
    }

    // Load Supabase dynamically (after main page works)
    setTimeout(() => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@supabase/supabase-js@2';
        script.onload = () => initSupabase();
        document.body.appendChild(script);
    }, 100);
});
