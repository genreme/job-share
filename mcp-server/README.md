# Job Search Command Center - MCP Server

MCP (Model Context Protocol) server that exposes your job search data to Claude Chat, enabling:

- **Deep research** with full context of your target roles and background
- **Resume/cover letter generation** with your actual experience data
- **Interview prep** using job details and your history
- **Application insights** from patterns in your data

## Available Tools

### Job Management
| Tool | Description |
|------|-------------|
| `get_jobs` | Get jobs filtered by status or fit score |
| `get_job_detail` | Get full details for a specific job |
| `get_jobs_by_company` | Find jobs at a company |
| `get_application_stats` | Response rates, interview rates, distributions |
| `find_similar_jobs` | Find jobs similar to a given one |
| `get_search_history` | History of job searches |

### Resume Context
| Tool | Description |
|------|-------------|
| `get_resume_data` | Full master resume data |
| `get_resume_sections` | Sections with character counts |
| `get_cover_letter_template` | Cover letter structure |
| `get_document_history` | Previously generated PDFs |
| `get_documents_for_company` | Docs for a specific company |
| `get_experience_by_theme` | Find bullets by theme/skill |
| `get_portfolio_highlights` | Relevant portfolio items |
| `get_key_metrics` | Quantifiable achievements |
| `get_customization_suggestions` | Tailoring recommendations |

### Document Generation
| Tool | Description |
|------|-------------|
| `generate_resume` | Generate tailored resume PDF for a company/role |
| `generate_cover_letter` | Generate tailored cover letter PDF |
| `validate_resume` | Check if resume content fits page limits |
| `validate_cover_letter` | Check if cover letter fits page limits |
| `assess_page_fit` | Analyze master resume for page fit issues |

### Job Updates (Write-Back)
| Tool | Description |
|------|-------------|
| `update_job` | Update any job fields (title, salary, fitScore, etc.) |
| `archive_job` | Archive a single job with reason |
| `archive_jobs` | Bulk archive multiple jobs |
| `set_hiring_manager` | Record hiring manager info (name, title, LinkedIn) |
| `add_job_note` | Add note/update to job history |
| `bulk_update_jobs` | Update multiple jobs at once |

## Setup

1. **Install dependencies:**
   ```bash
   cd mcp-server
   npm install
   ```

2. **Configure Claude Desktop:**
   The config is at `~/Library/Application Support/Claude/claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "jscc": {
         "command": "/opt/homebrew/bin/node",
         "args": ["/Users/genre/Claude/Job Search Command Center/mcp-server/src/index.js"]
       }
     }
   }
   ```

3. **Restart Claude Desktop** to load the MCP server.

## Usage in Claude Chat

Once configured, you can ask Claude things like:

- "Show me my high-fit jobs that I haven't applied to yet"
- "What's my interview rate for healthcare companies?"
- "Help me tailor my resume for the Alma Creative Director role"
- "Find experience bullets about team leadership"
- "Generate a cover letter for [job] emphasizing my PIH experience"

### Deep Research Mode
Click the **🔬 Deep Research** button on the dashboard to copy a comprehensive prompt.
Paste it into Claude Chat to:
1. Review all jobs in your pipeline
2. Check posting status (active/closed)
3. Research hiring managers
4. Clean up job data
5. **Automatically update your dashboard** (refresh to see changes)

## Data Sources

| Data | Location |
|------|----------|
| Jobs | `../index.html` (embedded data) |
| Resume | `/Users/genre/Claude/resume/resume generator - claude/resume_data_v9_1.json` |
| Cover Letter | `/Users/genre/Claude/resume/cover letter generator - claude/cover_letter_data.json` |
| Learning | `./data/learning.json` |

## Future Tools (Planned)

- `generate_interview_prep` - Create interview preparation materials
- `analyze_fit_accuracy` - Compare predicted vs actual outcomes
- `analyze_presentation_patterns` - What works in applications
- `suggest_system_improvements` - Data-driven optimization
- `get_chat_insights` - Aggregate insights from previous chats
