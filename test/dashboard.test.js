/**
 * Dashboard Rendering Tests
 *
 * Tests the rendering logic for the job dashboard.
 * Uses happy-dom for DOM testing.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach } from 'vitest'

// Sample job data for tests
const createMockJobs = () => [
  {
    id: 1,
    title: 'Creative Director',
    company: 'Acme Corp',
    industry: 'Technology',
    location: 'Boston, MA',
    salary: '$160k - $180k',
    fitScore: 85,
    status: 'apply-now',
    url: 'https://acme.com/jobs/1',
    found: new Date().toISOString().split('T')[0], // Today
    applied: null,
    symbols: ['💰', '🏠'],
    connections: ['John Smith (VP Marketing)'],
    updates: []
  },
  {
    id: 2,
    title: 'Senior Designer',
    company: 'Tech Solutions',
    industry: 'Technology',
    location: 'Remote',
    salary: '$120k - $150k',
    fitScore: 72,
    status: 'applied',
    url: 'https://techsolutions.com/jobs/2',
    found: '2026-01-15',
    applied: '2026-01-25',
    symbols: ['🏠'],
    connections: [],
    updates: [
      { date: '2026-01-25', type: 'Applied', notes: 'Submitted application' }
    ]
  },
  {
    id: 3,
    title: 'Design Lead',
    company: 'Healthcare Inc',
    industry: 'Healthcare',
    location: 'New York, NY',
    salary: '$150k - $190k',
    fitScore: 90,
    status: 'maybe',
    url: 'https://healthcare.com/jobs/3',
    found: '2026-01-22',
    applied: null,
    symbols: ['💰'],
    connections: [],
    updates: []
  },
  {
    id: 4,
    title: 'UX Director',
    company: 'ACME Corporation',
    industry: 'Technology',
    location: 'Boston, MA',
    salary: '$100k - $130k',
    fitScore: 45,
    status: 'archived',
    url: '',
    found: '2026-01-18',
    applied: null,
    symbols: [],
    connections: [],
    updates: []
  }
]

/**
 * Rendering helper functions extracted from dashboard logic
 * These mirror the functions in index.html
 */

// Get fit score CSS class based on score value
function getFitClass(score) {
  if (score >= 85) return 'fit-high'
  if (score >= 70) return 'fit-medium'
  return 'fit-low'
}

// Get status label with emoji
function getStatusLabel(status) {
  const labels = {
    'apply-now': '🔴 Apply Now',
    'maybe': '🟠 Maybe',
    'probably-not': '🟡 Probably Not',
    'applied': '🟢 Applied',
    'archived': '⚪ Archived'
  }
  return labels[status] || status
}

// Get row class based on job status
function getRowClass(job) {
  const classes = ['job-row']

  if (job.status === 'archived') {
    const wasApplied = job.appliedDate || job.applied
    const wasRejected = job.symbols?.includes('❌') ||
                       job.updates?.some(u => u.type === 'Rejected')

    if (wasApplied || wasRejected) {
      classes.push('row-archived-applied')
    } else {
      classes.push('row-archived')
    }
  } else if (job.status === 'applied') {
    classes.push('row-applied')
  }

  return classes.join(' ')
}

// Check if job was found within last 48 hours
function isNewJob(job) {
  if (!job.found) return false
  const foundDate = new Date(job.found)
  const now = new Date()
  const hoursDiff = (now - foundDate) / (1000 * 60 * 60)
  return hoursDiff <= 48
}

// Get salary HTML with CSS class
function getSalaryHTML(salary) {
  if (!salary) return ''
  const match = salary.match(/\$(\d+)k/i)
  if (!match) return salary

  const amount = parseInt(match[1])
  let className = 'salary-low'

  if (amount >= 160) {
    className = 'salary-high'
  } else if (amount >= 120) {
    className = 'salary-mid'
  }

  return `<span class="${className}">${salary}</span>`
}

// Get symbols HTML
function getSymbolsHTML(symbols) {
  if (!symbols || symbols.length === 0) return ''
  return symbols.join(' ')
}

// Escape HTML special characters
function escapeHtml(text) {
  if (!text) return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Filter jobs by status
function filterByStatus(jobs, status) {
  if (!status || status === 'all') return jobs
  return jobs.filter(job => job.status === status)
}

// Filter jobs by search term (matches title or company)
function filterBySearch(jobs, searchTerm) {
  if (!searchTerm) return jobs
  const term = searchTerm.toLowerCase()
  return jobs.filter(job =>
    job.title?.toLowerCase().includes(term) ||
    job.company?.toLowerCase().includes(term)
  )
}

// Sort jobs by column
function sortJobs(jobs, column, direction = 'desc') {
  const sorted = [...jobs]
  const dir = direction === 'asc' ? 1 : -1

  sorted.sort((a, b) => {
    let valA, valB

    switch (column) {
      case 'fitScore':
        valA = a.fitScore || 0
        valB = b.fitScore || 0
        break
      case 'title':
        valA = a.title?.toLowerCase() || ''
        valB = b.title?.toLowerCase() || ''
        return dir * valA.localeCompare(valB)
      case 'company':
        valA = a.company?.toLowerCase() || ''
        valB = b.company?.toLowerCase() || ''
        return dir * valA.localeCompare(valB)
      case 'status':
        const statusOrder = { 'apply-now': 1, 'maybe': 2, 'probably-not': 3, 'applied': 4, 'archived': 5 }
        valA = statusOrder[a.status] || 99
        valB = statusOrder[b.status] || 99
        break
      default:
        valA = a[column] || 0
        valB = b[column] || 0
    }

    return dir * (valA - valB)
  })

  return sorted
}

// Render a job row as HTML
function renderJobRow(job) {
  return `
    <tr class="${getRowClass(job)}" data-job-id="${job.id}">
      <td>
        <span class="fit-score ${getFitClass(job.fitScore)}">
          ${job.fitScore}
        </span>
      </td>
      <td>
        <span class="job-title">${escapeHtml(job.title)}</span>
        ${isNewJob(job) ? '<span class="new-job-badge">NEW</span>' : ''}
      </td>
      <td>
        <span class="company-name">${escapeHtml(job.company)}</span>
        ${job.url ? '<span class="url-indicator">🔗</span>' : '<span class="no-url-indicator">⚠️</span>'}
      </td>
      <td>${escapeHtml(job.industry)}</td>
      <td>${escapeHtml(job.location)}</td>
      <td>${getSalaryHTML(job.salary)}</td>
      <td><span class="status-badge status-${job.status}">${getStatusLabel(job.status)}</span></td>
      <td>${job.connections?.length || 0}</td>
      <td><div class="symbols">${getSymbolsHTML(job.symbols)}</div></td>
    </tr>
  `
}

// Render stats
function renderStats(jobs) {
  const total = jobs.length
  const byStatus = {}
  const byFitScore = { high: 0, medium: 0, low: 0 }

  for (const job of jobs) {
    // By status
    byStatus[job.status] = (byStatus[job.status] || 0) + 1

    // By fit score
    if (job.fitScore >= 75) byFitScore.high++
    else if (job.fitScore >= 55) byFitScore.medium++
    else byFitScore.low++
  }

  return { total, byStatus, byFitScore }
}

describe('Job Row Rendering', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('creates row with correct status class (status-apply-now)', () => {
    const jobs = createMockJobs()
    const applyNowJob = jobs.find(j => j.status === 'apply-now')

    const html = renderJobRow(applyNowJob)
    document.body.innerHTML = `<table><tbody>${html}</tbody></table>`

    const row = document.querySelector('tr')
    expect(row.classList.contains('job-row')).toBe(true)

    const statusBadge = document.querySelector('.status-badge')
    expect(statusBadge.classList.contains('status-apply-now')).toBe(true)
  })

  it('creates row with correct status class (status-applied)', () => {
    const jobs = createMockJobs()
    const appliedJob = jobs.find(j => j.status === 'applied')

    const html = renderJobRow(appliedJob)
    document.body.innerHTML = `<table><tbody>${html}</tbody></table>`

    const row = document.querySelector('tr')
    expect(row.classList.contains('row-applied')).toBe(true)

    const statusBadge = document.querySelector('.status-badge')
    expect(statusBadge.classList.contains('status-applied')).toBe(true)
  })

  it('creates row with correct status class (status-archived)', () => {
    const jobs = createMockJobs()
    const archivedJob = jobs.find(j => j.status === 'archived')

    const html = renderJobRow(archivedJob)
    document.body.innerHTML = `<table><tbody>${html}</tbody></table>`

    const row = document.querySelector('tr')
    expect(row.classList.contains('row-archived')).toBe(true)

    const statusBadge = document.querySelector('.status-badge')
    expect(statusBadge.classList.contains('status-archived')).toBe(true)
  })

  it('displays job title and company', () => {
    const jobs = createMockJobs()
    const job = jobs[0]

    const html = renderJobRow(job)
    document.body.innerHTML = `<table><tbody>${html}</tbody></table>`

    const title = document.querySelector('.job-title')
    const company = document.querySelector('.company-name')

    expect(title.textContent).toBe('Creative Director')
    expect(company.textContent).toBe('Acme Corp')
  })

  it('shows fit score with correct color coding (high)', () => {
    const jobs = createMockJobs()
    const highFitJob = jobs.find(j => j.fitScore >= 85)

    const html = renderJobRow(highFitJob)
    document.body.innerHTML = `<table><tbody>${html}</tbody></table>`

    const fitScore = document.querySelector('.fit-score')
    expect(fitScore.classList.contains('fit-high')).toBe(true)
    expect(fitScore.textContent.trim()).toBe('85')
  })

  it('shows fit score with correct color coding (medium)', () => {
    const jobs = createMockJobs()
    const mediumFitJob = jobs.find(j => j.fitScore >= 70 && j.fitScore < 85)

    const html = renderJobRow(mediumFitJob)
    document.body.innerHTML = `<table><tbody>${html}</tbody></table>`

    const fitScore = document.querySelector('.fit-score')
    expect(fitScore.classList.contains('fit-medium')).toBe(true)
  })

  it('shows fit score with correct color coding (low)', () => {
    const jobs = createMockJobs()
    const lowFitJob = jobs.find(j => j.fitScore < 70)

    const html = renderJobRow(lowFitJob)
    document.body.innerHTML = `<table><tbody>${html}</tbody></table>`

    const fitScore = document.querySelector('.fit-score')
    expect(fitScore.classList.contains('fit-low')).toBe(true)
  })

  it('shows symbols (emoji) if present', () => {
    const jobs = createMockJobs()
    const jobWithSymbols = jobs.find(j => j.symbols && j.symbols.length > 0)

    const html = renderJobRow(jobWithSymbols)
    document.body.innerHTML = `<table><tbody>${html}</tbody></table>`

    const symbols = document.querySelector('.symbols')
    expect(symbols.textContent).toContain('💰')
    expect(symbols.textContent).toContain('🏠')
  })

  it('shows connection indicator if hasConnections', () => {
    const jobs = createMockJobs()
    const jobWithConnections = jobs.find(j => j.connections && j.connections.length > 0)

    const html = renderJobRow(jobWithConnections)
    document.body.innerHTML = `<table><tbody>${html}</tbody></table>`

    // Connection count column
    const row = document.querySelector('tr')
    const cells = row.querySelectorAll('td')
    const connectionsCell = cells[7] // 8th column
    expect(connectionsCell.textContent.trim()).toBe('1')
  })

  it('shows NEW badge for recently found jobs', () => {
    const jobs = createMockJobs()
    // Job 0 has found date set to today
    const newJob = jobs[0]

    const html = renderJobRow(newJob)
    document.body.innerHTML = `<table><tbody>${html}</tbody></table>`

    const newBadge = document.querySelector('.new-job-badge')
    expect(newBadge).not.toBeNull()
    expect(newBadge.textContent).toBe('NEW')
  })

  it('shows URL indicator when URL exists', () => {
    const jobs = createMockJobs()
    const jobWithUrl = jobs.find(j => j.url && j.url.length > 0)

    const html = renderJobRow(jobWithUrl)
    document.body.innerHTML = `<table><tbody>${html}</tbody></table>`

    const urlIndicator = document.querySelector('.url-indicator')
    expect(urlIndicator).not.toBeNull()
    expect(urlIndicator.textContent).toBe('🔗')
  })

  it('shows warning indicator when URL missing', () => {
    const jobs = createMockJobs()
    const jobWithoutUrl = jobs.find(j => !j.url || j.url === '')

    const html = renderJobRow(jobWithoutUrl)
    document.body.innerHTML = `<table><tbody>${html}</tbody></table>`

    const noUrlIndicator = document.querySelector('.no-url-indicator')
    expect(noUrlIndicator).not.toBeNull()
    expect(noUrlIndicator.textContent).toBe('⚠️')
  })
})

describe('Stats Display', () => {
  it('calculates total jobs count', () => {
    const jobs = createMockJobs()
    const stats = renderStats(jobs)

    expect(stats.total).toBe(4)
  })

  it('calculates status breakdown', () => {
    const jobs = createMockJobs()
    const stats = renderStats(jobs)

    expect(stats.byStatus['apply-now']).toBe(1)
    expect(stats.byStatus['applied']).toBe(1)
    expect(stats.byStatus['maybe']).toBe(1)
    expect(stats.byStatus['archived']).toBe(1)
  })

  it('calculates fit score distribution', () => {
    const jobs = createMockJobs()
    const stats = renderStats(jobs)

    // High: 85, 90 (75+)
    // Medium: 72 (55-74)
    // Low: 45 (<55)
    expect(stats.byFitScore.high).toBe(2)
    expect(stats.byFitScore.medium).toBe(1)
    expect(stats.byFitScore.low).toBe(1)
  })
})

describe('Filter Behavior', () => {
  it('status filter function returns correct subset', () => {
    const jobs = createMockJobs()

    const applyNow = filterByStatus(jobs, 'apply-now')
    const applied = filterByStatus(jobs, 'applied')
    const all = filterByStatus(jobs, 'all')

    expect(applyNow).toHaveLength(1)
    expect(applyNow[0].status).toBe('apply-now')

    expect(applied).toHaveLength(1)
    expect(applied[0].status).toBe('applied')

    expect(all).toHaveLength(4)
  })

  it('search filter function matches title', () => {
    const jobs = createMockJobs()

    const result = filterBySearch(jobs, 'creative')

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Creative Director')
  })

  it('search filter function matches company', () => {
    const jobs = createMockJobs()

    const result = filterBySearch(jobs, 'healthcare')

    expect(result).toHaveLength(1)
    expect(result[0].company).toBe('Healthcare Inc')
  })

  it('search filter function is case insensitive', () => {
    const jobs = createMockJobs()

    const upper = filterBySearch(jobs, 'ACME')
    const lower = filterBySearch(jobs, 'acme')
    const mixed = filterBySearch(jobs, 'AcMe')

    expect(upper.length).toBeGreaterThan(0)
    expect(upper.length).toBe(lower.length)
    expect(lower.length).toBe(mixed.length)
  })

  it('sort function orders by fitScore correctly', () => {
    const jobs = createMockJobs()

    const descending = sortJobs(jobs, 'fitScore', 'desc')
    const ascending = sortJobs(jobs, 'fitScore', 'asc')

    expect(descending[0].fitScore).toBe(90)
    expect(descending[descending.length - 1].fitScore).toBe(45)

    expect(ascending[0].fitScore).toBe(45)
    expect(ascending[ascending.length - 1].fitScore).toBe(90)
  })

  it('sort function orders by title alphabetically', () => {
    const jobs = createMockJobs()

    const ascending = sortJobs(jobs, 'title', 'asc')

    expect(ascending[0].title).toBe('Creative Director')
    expect(ascending[1].title).toBe('Design Lead')
  })

  it('sort function orders by company alphabetically', () => {
    const jobs = createMockJobs()

    const ascending = sortJobs(jobs, 'company', 'asc')

    // localeCompare with lowercase: acme corp, acme corporation, healthcare inc, tech solutions
    // Both "Acme Corp" and "ACME Corporation" start with 'a', but 'c' (corp) < 'c' (corporation) in 5th pos
    expect(ascending[0].company).toBe('Acme Corp')
    expect(ascending[1].company).toBe('ACME Corporation')
  })

  it('sort function orders by status priority', () => {
    const jobs = createMockJobs()

    const ascending = sortJobs(jobs, 'status', 'asc')

    // apply-now should be first, archived should be last
    expect(ascending[0].status).toBe('apply-now')
    expect(ascending[ascending.length - 1].status).toBe('archived')
  })
})

describe('Edge Cases', () => {
  it('empty jobs array renders correctly', () => {
    const stats = renderStats([])

    expect(stats.total).toBe(0)
    expect(stats.byFitScore.high).toBe(0)
    expect(stats.byFitScore.medium).toBe(0)
    expect(stats.byFitScore.low).toBe(0)
  })

  it('very long title is handled', () => {
    const longTitleJob = {
      id: 99,
      title: 'Senior Principal Creative Director of Brand Strategy and Visual Design Innovation Lead',
      company: 'Test Corp',
      industry: 'Tech',
      location: 'NYC',
      salary: '$100k',
      fitScore: 50,
      status: 'apply-now',
      url: '',
      found: '2026-01-01',
      applied: null,
      symbols: [],
      connections: []
    }

    const html = renderJobRow(longTitleJob)
    document.body.innerHTML = `<table><tbody>${html}</tbody></table>`

    const title = document.querySelector('.job-title')
    expect(title.textContent).toBe(longTitleJob.title)
  })

  it('special characters in job data are escaped properly', () => {
    const xssJob = {
      id: 99,
      title: '<script>alert("xss")</script>',
      company: 'Test & Sons <b>Inc</b>',
      industry: 'Tech',
      location: 'NYC',
      salary: '$100k',
      fitScore: 50,
      status: 'apply-now',
      url: '',
      found: '2026-01-01',
      applied: null,
      symbols: [],
      connections: []
    }

    const html = renderJobRow(xssJob)
    document.body.innerHTML = `<table><tbody>${html}</tbody></table>`

    const title = document.querySelector('.job-title')
    const company = document.querySelector('.company-name')

    // Should be escaped, not executed
    expect(title.textContent).toContain('<script>')
    expect(title.innerHTML).not.toContain('<script>')
    expect(company.textContent).toContain('Test & Sons')
    expect(company.innerHTML).not.toContain('<b>')
  })

  it('null values in job data handled gracefully', () => {
    const nullJob = {
      id: 99,
      title: null,
      company: null,
      industry: null,
      location: null,
      salary: null,
      fitScore: 0,
      status: 'apply-now',
      url: null,
      found: null,
      applied: null,
      symbols: null,
      connections: null
    }

    // Should not throw
    const html = renderJobRow(nullJob)
    document.body.innerHTML = `<table><tbody>${html}</tbody></table>`

    const row = document.querySelector('tr')
    expect(row).not.toBeNull()
  })
})
