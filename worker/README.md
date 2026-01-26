# Job Validator - Cloudflare Worker

Serverless job validation API for the Job Search Command Center.

## Features

- **URL Validation**: Check if job posting is still active
- **Data Extraction**: Pull title, company, location, salary from page
- **Fit Scoring**: Calculate fit score based on role, industry, location, salary
- **Duplicate Detection**: Compare against existing tracked jobs
- **Company Finder**: Locate original company careers page

## Endpoints

### POST /validate
Validate a single job URL.

```json
Request:
{
  "url": "https://company.lever.co/job/123",
  "existingJobs": [{ "title": "...", "company": "..." }]
}

Response:
{
  "url": "https://company.lever.co/job/123",
  "status": "active",
  "title": "Creative Director",
  "company": "Acme Corp",
  "location": "Boston, MA",
  "salary": "$150,000 - $180,000",
  "fitScore": 82,
  "fitBreakdown": { "role": 25, "industry": 20, "location": 15, "salary": 12 },
  "isDuplicate": false,
  "originalPosting": "https://acmecorp.com/careers/creative-director",
  "source": "Lever",
  "warnings": [],
  "checkedAt": "2024-01-26T12:00:00Z"
}
```

### POST /batch
Validate multiple URLs at once.

```json
Request:
{
  "urls": ["url1", "url2", "url3"],
  "existingJobs": [...]
}

Response:
{
  "results": [...],
  "summary": {
    "total": 3,
    "active": 2,
    "closed": 1,
    "duplicates": 0,
    "highFit": 1,
    "mediumFit": 1,
    "lowFit": 1
  }
}
```

### POST /status
Quick status check only (faster, for existing jobs).

```json
Request:
{
  "urls": ["url1", "url2", "url3"]
}

Response:
{
  "results": [
    { "url": "url1", "status": "active", "httpStatus": 200 },
    { "url": "url2", "status": "closed", "httpStatus": 404 }
  ],
  "summary": { "total": 3, "active": 2, "closed": 1 }
}
```

### GET /health
Health check endpoint.

## Deployment

1. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```

2. Login to Cloudflare:
   ```bash
   wrangler login
   ```

3. Deploy:
   ```bash
   cd worker
   wrangler deploy
   ```

4. Note the worker URL (e.g., `https://job-validator.YOUR-SUBDOMAIN.workers.dev`)

5. Update dashboard to use this URL

## Local Development

```bash
wrangler dev
```

This starts a local server at `http://localhost:8787`

## Rate Limits

Free tier: 100,000 requests/day
Each job validation = 1-3 requests (job page + optional careers page lookup)

Typical usage:
- 50 jobs/day batch check = ~100 requests
- 10 new job validations = ~30 requests
- Plenty of headroom for free tier
