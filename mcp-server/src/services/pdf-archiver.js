/**
 * PDF Archiver Service
 *
 * Archives job descriptions as PDFs for pattern analysis (DISC-08).
 * Uses Puppeteer to generate PDFs from job URLs or stored job data.
 */

import puppeteer from 'puppeteer'
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ARCHIVE_DIR = join(__dirname, '..', '..', 'data', 'archives')

/**
 * Sanitize a string for use in filenames
 * - Replace non-alphanumeric chars with dashes
 * - Limit to 50 chars
 * - Handle null/undefined
 *
 * @param {string|null|undefined} str - String to sanitize
 * @returns {string} Sanitized filename-safe string
 */
export function sanitizeFilename(str) {
  if (!str || typeof str !== 'string') {
    return 'unknown'
  }

  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'unknown'
}

/**
 * Generate styled HTML document from job data
 * Used as fallback when URL fetch fails or for archived data
 *
 * @param {object} job - Job data object
 * @returns {string} HTML document string
 */
export function generateArchiveHtml(job) {
  const title = job.title || 'Untitled Position'
  const company = job.company || 'Unknown Company'
  const location = job.location || 'Location not specified'
  const salary = job.salary || 'Salary not listed'
  const fitScore = job.fitScore ?? 'N/A'
  const description = job.description || job.notes || 'No description available'
  const friendContext = job.friendContext || job.friend || null
  const url = job.url || null
  const archivedAt = new Date().toISOString()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} at ${company}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 30px;
      background: #fff;
    }
    header {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .company {
      font-size: 18px;
      color: #475569;
      margin-bottom: 12px;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      font-size: 14px;
      color: #64748b;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .meta-item strong {
      color: #334155;
    }
    .fit-score {
      background: #dbeafe;
      color: #1e40af;
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: 600;
    }
    .section {
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
    }
    .description {
      white-space: pre-wrap;
      font-size: 14px;
      line-height: 1.8;
    }
    .friend-context {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      font-size: 14px;
      margin-bottom: 24px;
    }
    .friend-context strong {
      color: #92400e;
    }
    footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #94a3b8;
    }
    footer a {
      color: #2563eb;
      text-decoration: none;
    }
    footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <header>
    <h1>${title}</h1>
    <div class="company">${company}</div>
    <div class="meta">
      <div class="meta-item">
        <strong>Location:</strong> ${location}
      </div>
      <div class="meta-item">
        <strong>Salary:</strong> ${salary}
      </div>
      <div class="meta-item">
        <span class="fit-score">Fit Score: ${fitScore}</span>
      </div>
    </div>
  </header>

  ${friendContext ? `
  <div class="friend-context">
    <strong>Friend Connection:</strong> ${friendContext}
  </div>
  ` : ''}

  <section class="section">
    <h2 class="section-title">Job Description</h2>
    <div class="description">${description}</div>
  </section>

  <footer>
    <p>Archived: ${archivedAt}</p>
    ${url ? `<p>Original URL: <a href="${url}">${url}</a></p>` : ''}
  </footer>
</body>
</html>`
}

/**
 * Archive a job as a PDF
 * Attempts to fetch live URL first, falls back to generated HTML
 *
 * @param {object} jobData - Job data with url, title, company, etc.
 * @returns {Promise<{success: boolean, filename?: string, path?: string, archivedAt?: string, error?: string}>}
 */
export async function archiveJobAsPdf(jobData) {
  // Ensure archive directory exists
  if (!existsSync(ARCHIVE_DIR)) {
    mkdirSync(ARCHIVE_DIR, { recursive: true })
  }

  // Generate filename: {company}-{jobId}-{timestamp}.pdf
  const companyPart = sanitizeFilename(jobData.company)
  const jobIdPart = jobData.id || 'noid'
  const timestamp = Date.now()
  const filename = `${companyPart}-${jobIdPart}-${timestamp}.pdf`
  const filePath = join(ARCHIVE_DIR, filename)

  let browser = null

  try {
    browser = await puppeteer.launch({ headless: 'new' })
    const page = await browser.newPage()

    let usedFallback = false

    // Try to fetch live URL if available
    if (jobData.url) {
      try {
        await page.goto(jobData.url, {
          waitUntil: 'networkidle0',
          timeout: 30000
        })
      } catch (urlError) {
        console.warn(`Failed to fetch URL ${jobData.url}: ${urlError.message}. Using generated HTML.`)
        usedFallback = true
        const html = generateArchiveHtml(jobData)
        await page.setContent(html, { waitUntil: 'networkidle0' })
      }
    } else {
      // No URL - use generated HTML
      usedFallback = true
      const html = generateArchiveHtml(jobData)
      await page.setContent(html, { waitUntil: 'networkidle0' })
    }

    // Generate PDF
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    })

    const archivedAt = new Date().toISOString()

    return {
      success: true,
      filename,
      path: filePath,
      archivedAt,
      usedFallback
    }
  } catch (error) {
    console.error('PDF archiving failed:', error.message)
    return {
      success: false,
      error: error.message
    }
  } finally {
    // CRITICAL: Always close browser to prevent resource leaks
    if (browser) {
      await browser.close()
    }
  }
}

/**
 * List all archived job PDFs
 *
 * @returns {Array<{filename: string, path: string, createdAt: string}>}
 */
export function listArchivedJobs() {
  // Handle missing directory gracefully
  if (!existsSync(ARCHIVE_DIR)) {
    return []
  }

  try {
    const files = readdirSync(ARCHIVE_DIR)
    const archives = []

    for (const file of files) {
      if (file.endsWith('.pdf')) {
        const filePath = join(ARCHIVE_DIR, file)
        const stats = statSync(filePath)

        archives.push({
          filename: file,
          path: filePath,
          createdAt: stats.mtime.toISOString()
        })
      }
    }

    // Sort by creation time, newest first
    return archives.sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    )
  } catch (error) {
    console.error('Error listing archives:', error.message)
    return []
  }
}
