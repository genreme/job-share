/**
 * Job Validator - Cloudflare Worker
 *
 * Validates job postings by:
 * 1. Checking if URL is active (HTTP 200)
 * 2. Extracting job details from page
 * 3. Calculating fit score
 * 4. Finding original company careers page
 * 5. Checking for duplicates against existing jobs
 *
 * Deploy: wrangler deploy
 */

// =====================================================
// CONFIGURATION
// =====================================================

const FIT_CRITERIA = {
  // Target job titles (weighted by specificity)
  titles: {
    exact: ['Creative Director', 'VP of Creative', 'VP Creative Services', 'Director of Creative Services',
            'Head of Creative', 'Head of Design', 'Design Director', 'Executive Creative Director',
            'Senior Creative Director', 'Creative Operations Director'],
    partial: ['Creative', 'Design', 'Brand', 'Visual', 'Art Director', 'UX Director']
  },

  // Target industries/missions
  industries: {
    preferred: ['healthcare', 'health', 'nonprofit', 'non-profit', 'education', 'social impact',
                'mission-driven', 'public health', 'mental health', 'wellness'],
    acceptable: ['technology', 'saas', 'startup', 'b2b']
  },

  // Location preferences
  locations: {
    preferred: ['boston', 'massachusetts', 'ma', 'remote', 'hybrid'],
    acceptable: ['new york', 'ny', 'northeast', 'east coast']
  },

  // Salary threshold
  salaryMin: 120000
};

// Company careers page patterns
const CAREERS_PATTERNS = [
  '/careers', '/jobs', '/work-with-us', '/join-us', '/opportunities',
  '/about/careers', '/company/careers', '/en/careers'
];

// =====================================================
// CORS HEADERS
// =====================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// =====================================================
// MAIN HANDLER
// =====================================================

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Single job validation
      if (path === '/validate' && request.method === 'POST') {
        const body = await request.json();
        const result = await validateJob(body.url, body.existingJobs || []);
        return new Response(JSON.stringify(result), { headers: corsHeaders });
      }

      // Batch validation
      if (path === '/batch' && request.method === 'POST') {
        const body = await request.json();
        const results = await validateBatch(body.urls, body.existingJobs || []);
        return new Response(JSON.stringify(results), { headers: corsHeaders });
      }

      // Status check only (faster, for existing jobs)
      if (path === '/status' && request.method === 'POST') {
        const body = await request.json();
        const results = await checkStatusBatch(body.urls);
        return new Response(JSON.stringify(results), { headers: corsHeaders });
      }

      // Health check
      if (path === '/health') {
        return new Response(JSON.stringify({ status: 'ok', version: '1.0.0' }), { headers: corsHeaders });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: corsHeaders
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

// =====================================================
// VALIDATION FUNCTIONS
// =====================================================

async function validateJob(jobUrl, existingJobs = []) {
  const result = {
    url: jobUrl,
    status: 'unknown',
    title: null,
    company: null,
    location: null,
    salary: null,
    fitScore: 0,
    fitBreakdown: {},
    isDuplicate: false,
    duplicateOf: null,
    originalPosting: null,
    source: detectSource(jobUrl),
    warnings: [],
    checkedAt: new Date().toISOString()
  };

  try {
    // Fetch the job page
    const response = await fetch(jobUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      },
      redirect: 'follow'
    });

    result.httpStatus = response.status;

    // Check if job is active
    if (response.status === 404) {
      result.status = 'closed';
      result.warnings.push('Page returns 404 - job likely closed');
      return result;
    }

    if (response.status !== 200) {
      result.status = 'error';
      result.warnings.push(`Unexpected HTTP status: ${response.status}`);
      return result;
    }

    const html = await response.text();

    // Check for "closed" indicators in page content
    const closedIndicators = [
      'no longer accepting', 'position has been filled', 'job is closed',
      'no longer available', 'application closed', 'posting expired',
      'this position has been filled', 'job has been removed'
    ];

    const lowerHtml = html.toLowerCase();
    for (const indicator of closedIndicators) {
      if (lowerHtml.includes(indicator)) {
        result.status = 'closed';
        result.warnings.push(`Found "${indicator}" on page`);
        return result;
      }
    }

    result.status = 'active';

    // Extract job details
    const details = extractJobDetails(html, jobUrl);
    result.title = details.title;
    result.company = details.company;
    result.location = details.location;
    result.salary = details.salary;
    result.description = details.description;

    // Calculate fit score
    const fit = calculateFitScore(details);
    result.fitScore = fit.score;
    result.fitBreakdown = fit.breakdown;

    // Check for duplicates
    const duplicate = findDuplicate(details, existingJobs);
    if (duplicate) {
      result.isDuplicate = true;
      result.duplicateOf = duplicate;
      result.warnings.push(`Possible duplicate of existing job: ${duplicate.title} at ${duplicate.company}`);
    }

    // Try to find original company careers page
    if (details.company) {
      result.originalPosting = await findCompanyCareersPage(details.company, details.title);
    }

  } catch (error) {
    result.status = 'error';
    result.warnings.push(`Fetch error: ${error.message}`);
  }

  return result;
}

async function validateBatch(urls, existingJobs = []) {
  const results = [];

  // Process in parallel with concurrency limit
  const concurrency = 5;
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(url => validateJob(url, existingJobs))
    );
    results.push(...batchResults);
  }

  // Summary
  const summary = {
    total: results.length,
    active: results.filter(r => r.status === 'active').length,
    closed: results.filter(r => r.status === 'closed').length,
    errors: results.filter(r => r.status === 'error').length,
    duplicates: results.filter(r => r.isDuplicate).length,
    highFit: results.filter(r => r.fitScore >= 75).length,
    mediumFit: results.filter(r => r.fitScore >= 55 && r.fitScore < 75).length,
    lowFit: results.filter(r => r.fitScore < 55).length
  };

  return { results, summary };
}

async function checkStatusBatch(urls) {
  const results = [];

  const concurrency = 10; // Faster since we're just checking status
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        try {
          const response = await fetch(url, {
            method: 'HEAD', // Faster than GET
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            redirect: 'follow'
          });

          return {
            url,
            status: response.status === 200 ? 'active' : 'closed',
            httpStatus: response.status
          };
        } catch (error) {
          return {
            url,
            status: 'error',
            error: error.message
          };
        }
      })
    );
    results.push(...batchResults);
  }

  return {
    results,
    summary: {
      total: results.length,
      active: results.filter(r => r.status === 'active').length,
      closed: results.filter(r => r.status === 'closed').length,
      errors: results.filter(r => r.status === 'error').length
    }
  };
}

// =====================================================
// EXTRACTION FUNCTIONS
// =====================================================

function detectSource(url) {
  if (url.includes('linkedin.com')) return 'LinkedIn';
  if (url.includes('lever.co')) return 'Lever';
  if (url.includes('greenhouse.io')) return 'Greenhouse';
  if (url.includes('workday')) return 'Workday';
  if (url.includes('ashbyhq.com')) return 'Ashby';
  if (url.includes('indeed.com')) return 'Indeed';
  if (url.includes('glassdoor.com')) return 'Glassdoor';
  return 'Other';
}

function extractJobDetails(html, url) {
  const details = {
    title: null,
    company: null,
    location: null,
    salary: null,
    description: null
  };

  const source = detectSource(url);

  // Try JSON-LD first (most structured)
  const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const jsonLd = JSON.parse(match[1]);
      // Handle array of JSON-LD objects
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      for (const item of items) {
        if (item['@type'] === 'JobPosting' || item.title) {
          if (!details.title && item.title) details.title = item.title;
          if (!details.company && item.hiringOrganization?.name) details.company = item.hiringOrganization.name;
          if (!details.location) {
            details.location = item.jobLocation?.address?.addressLocality ||
                              item.jobLocation?.address?.addressRegion ||
                              item.jobLocation?.name ||
                              (item.jobLocationType === 'TELECOMMUTE' ? 'Remote' : null);
          }
          if (!details.salary && item.baseSalary) {
            const salary = item.baseSalary;
            if (salary.value) {
              if (typeof salary.value === 'object' && salary.value.minValue) {
                details.salary = `$${formatSalary(salary.value.minValue)} - $${formatSalary(salary.value.maxValue)}`;
              } else if (typeof salary.value === 'number') {
                details.salary = `$${formatSalary(salary.value)}`;
              }
            }
          }
          if (!details.description && item.description) {
            details.description = item.description.replace(/<[^>]+>/g, ' ').substring(0, 2000);
          }
        }
      }
    } catch (e) {
      // JSON-LD parsing failed, continue with other methods
    }
  }

  // Try Open Graph tags (multiple formats)
  if (!details.title) {
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) ||
                   html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:title"/i);
    if (ogTitle) {
      let title = decodeHtmlEntities(ogTitle[1]);
      // Clean up common suffixes
      title = title.replace(/\s*[-|–]\s*(LinkedIn|Lever|Greenhouse|Workday|Ashby).*$/i, '')
                   .replace(/\s*at\s+[^|]+\s*\|.*$/i, '')
                   .trim();
      // Handle "Company hiring Job Title in Location" format from LinkedIn
      const hiringMatch = title.match(/^(.+?)\s+hiring\s+(.+?)\s+in\s+(.+)$/i);
      if (hiringMatch) {
        details.company = hiringMatch[1].trim();
        details.title = hiringMatch[2].trim();
        details.location = hiringMatch[3].trim();
      } else {
        details.title = title;
      }
    }
  }

  // Try common HTML patterns based on source
  if (source === 'Lever') {
    if (!details.title) {
      const titleMatch = html.match(/<h2[^>]*class="[^"]*posting-headline[^"]*"[^>]*>([^<]+)/i) ||
                        html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
      if (titleMatch) details.title = titleMatch[1].trim();
    }
    if (!details.company) {
      const companyMatch = url.match(/https?:\/\/jobs\.lever\.co\/([^\/]+)/i) ||
                          url.match(/https?:\/\/([^.]+)\.lever\.co/i);
      if (companyMatch) details.company = formatCompanyName(companyMatch[1]);
    }
    if (!details.location) {
      const locMatch = html.match(/<div[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)/i) ||
                      html.match(/<span[^>]*class="[^"]*workplaceTypes[^"]*"[^>]*>([^<]+)/i);
      if (locMatch) details.location = locMatch[1].trim();
    }
  }

  if (source === 'Greenhouse') {
    if (!details.title) {
      const titleMatch = html.match(/<h1[^>]*class="[^"]*app-title[^"]*"[^>]*>([^<]+)/i) ||
                        html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (titleMatch) details.title = titleMatch[1].trim();
    }
    if (!details.company) {
      const companyMatch = url.match(/boards\.greenhouse\.io\/([^\/]+)/i) ||
                          url.match(/([^.]+)\.greenhouse\.io/i);
      if (companyMatch) details.company = formatCompanyName(companyMatch[1]);
    }
    if (!details.location) {
      const locMatch = html.match(/<div[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)/i);
      if (locMatch) details.location = locMatch[1].trim();
    }
  }

  if (source === 'Ashby') {
    if (!details.company) {
      const companyMatch = url.match(/jobs\.ashbyhq\.com\/([^\/]+)/i);
      if (companyMatch) details.company = formatCompanyName(companyMatch[1]);
    }
  }

  if (source === 'Workday') {
    if (!details.company) {
      const companyMatch = url.match(/([^.]+)\.wd\d*\.myworkdayjobs\.com/i);
      if (companyMatch) details.company = formatCompanyName(companyMatch[1]);
    }
  }

  if (source === 'LinkedIn') {
    // LinkedIn blocks direct fetches but OG tags work via proxy
    // Title was likely extracted from og:title above
    // Try to extract company from URL or page
    if (!details.company) {
      const companyMatch = html.match(/data-tracking-control-name="public_jobs_topcard-org-name"[^>]*>([^<]+)/i) ||
                          html.match(/<a[^>]*class="[^"]*topcard__org-name-link[^"]*"[^>]*>([^<]+)/i);
      if (companyMatch) details.company = companyMatch[1].trim();
    }
  }

  // Generic title extraction
  if (!details.title) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) details.title = h1Match[1].trim();
  }

  // Generic location extraction
  if (!details.location) {
    const locationPatterns = [
      /(?:location|where)[:\s]*([A-Z][a-zA-Z\s,]+(?:,\s*[A-Z]{2})?)/i,
      /(Remote|Hybrid|On-?site)/i,
      /(Boston|New York|NYC|San Francisco|Los Angeles|Chicago|Seattle|Austin|Denver|Atlanta|Miami)[,\s]*(?:MA|NY|CA|IL|WA|TX|CO|GA|FL)?/i
    ];
    for (const pattern of locationPatterns) {
      const match = html.match(pattern);
      if (match) {
        details.location = match[1].trim();
        break;
      }
    }
  }

  // Generic salary extraction
  if (!details.salary) {
    const salaryPatterns = [
      /\$\s*([\d,]+)\s*(?:k|K)?\s*[-–to]+\s*\$?\s*([\d,]+)\s*(?:k|K)?(?:\s*(?:\/year|annually|per year|a year))?/i,
      /(?:salary|compensation|pay)[:\s]*\$\s*([\d,]+)\s*[-–]?\s*\$?\s*([\d,]+)?/i,
      /\$(1[0-9]{2}),?000\s*[-–]\s*\$(1[0-9]{2}|2[0-9]{2}),?000/i
    ];
    for (const pattern of salaryPatterns) {
      const match = html.match(pattern);
      if (match) {
        if (match[2]) {
          let min = match[1].replace(/,/g, '');
          let max = match[2].replace(/,/g, '');
          // Handle "k" notation
          if (parseInt(min) < 1000) min = parseInt(min) * 1000;
          if (parseInt(max) < 1000) max = parseInt(max) * 1000;
          details.salary = `$${formatSalary(min)} - $${formatSalary(max)}`;
        } else {
          let val = match[1].replace(/,/g, '');
          if (parseInt(val) < 1000) val = parseInt(val) * 1000;
          details.salary = `$${formatSalary(val)}+`;
        }
        break;
      }
    }
  }

  // Extract description text
  if (!details.description) {
    // Remove scripts and styles
    let text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                   .replace(/<style[\s\S]*?<\/style>/gi, '')
                   .replace(/<[^>]+>/g, ' ')
                   .replace(/\s+/g, ' ')
                   .trim();
    details.description = text.substring(0, 2000);
  }

  // Clean up extracted values
  if (details.title) {
    details.title = decodeHtmlEntities(details.title.trim())
      .replace(/\s*[-|–]\s*(Apply|Job|Career).*$/i, '')
      .trim();
  }
  if (details.company) details.company = decodeHtmlEntities(details.company.trim());
  if (details.location) details.location = decodeHtmlEntities(details.location.trim());

  return details;
}

function formatSalary(value) {
  const num = parseInt(value);
  if (num >= 1000) {
    return num.toLocaleString();
  }
  return (num * 1000).toLocaleString();
}

function formatCompanyName(slug) {
  if (!slug) return '';
  return slug
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =====================================================
// FIT SCORE CALCULATION
// =====================================================

function calculateFitScore(details) {
  let score = 50; // Base score
  const breakdown = {
    role: 0,
    industry: 0,
    location: 0,
    salary: 0
  };

  const title = (details.title || '').toLowerCase();
  const description = (details.description || '').toLowerCase();
  const location = (details.location || '').toLowerCase();
  const fullText = `${title} ${description}`;

  // Role fit (max +25)
  for (const exactTitle of FIT_CRITERIA.titles.exact) {
    if (title.includes(exactTitle.toLowerCase())) {
      breakdown.role = 25;
      break;
    }
  }
  if (breakdown.role === 0) {
    for (const partialTitle of FIT_CRITERIA.titles.partial) {
      if (title.includes(partialTitle.toLowerCase())) {
        breakdown.role = 15;
        break;
      }
    }
  }

  // Industry/mission fit (max +20)
  for (const industry of FIT_CRITERIA.industries.preferred) {
    if (fullText.includes(industry)) {
      breakdown.industry = 20;
      break;
    }
  }
  if (breakdown.industry === 0) {
    for (const industry of FIT_CRITERIA.industries.acceptable) {
      if (fullText.includes(industry)) {
        breakdown.industry = 10;
        break;
      }
    }
  }

  // Location fit (max +15)
  for (const loc of FIT_CRITERIA.locations.preferred) {
    if (location.includes(loc)) {
      breakdown.location = 15;
      break;
    }
  }
  if (breakdown.location === 0) {
    for (const loc of FIT_CRITERIA.locations.acceptable) {
      if (location.includes(loc)) {
        breakdown.location = 8;
        break;
      }
    }
  }

  // Salary fit (max +15)
  const salaryMatch = fullText.match(/\$(\d{2,3}),?(\d{3})/);
  if (salaryMatch) {
    const salary = parseInt(salaryMatch[1] + salaryMatch[2]);
    if (salary >= FIT_CRITERIA.salaryMin) {
      breakdown.salary = 15;
    } else if (salary >= FIT_CRITERIA.salaryMin * 0.9) {
      breakdown.salary = 8;
    }
  } else if (details.salary) {
    // Try to parse from salary field
    const salaryNum = parseInt(details.salary.toString().replace(/[^0-9]/g, ''));
    if (salaryNum >= FIT_CRITERIA.salaryMin) {
      breakdown.salary = 15;
    }
  }

  score += breakdown.role + breakdown.industry + breakdown.location + breakdown.salary;

  return { score: Math.min(100, score), breakdown };
}

// =====================================================
// DUPLICATE DETECTION
// =====================================================

function findDuplicate(details, existingJobs) {
  if (!details.title || !details.company) return null;

  const normalizedTitle = details.title.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedCompany = details.company.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const job of existingJobs) {
    const existingTitle = (job.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const existingCompany = (job.company || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Check for exact match
    if (normalizedTitle === existingTitle && normalizedCompany === existingCompany) {
      return job;
    }

    // Check for high similarity (same company, similar title)
    if (normalizedCompany === existingCompany) {
      const similarity = calculateSimilarity(normalizedTitle, existingTitle);
      if (similarity > 0.8) {
        return job;
      }
    }
  }

  return null;
}

function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// =====================================================
// COMPANY CAREERS PAGE FINDER
// =====================================================

async function findCompanyCareersPage(company, jobTitle) {
  // Clean company name for domain search
  const cleanCompany = company.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/inc|llc|corp|ltd|limited|company/g, '');

  // Common domain patterns
  const domains = [
    `${cleanCompany}.com`,
    `www.${cleanCompany}.com`,
    `${cleanCompany}.io`,
    `${cleanCompany}.org`
  ];

  for (const domain of domains) {
    for (const path of CAREERS_PATTERNS) {
      const careersUrl = `https://${domain}${path}`;
      try {
        const response = await fetch(careersUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });

        if (response.status === 200) {
          return careersUrl;
        }
      } catch (e) {
        // Domain doesn't exist or blocked, continue
      }
    }
  }

  return null;
}
