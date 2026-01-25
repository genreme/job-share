// Job Search Command Center - LinkedIn Extension Popup

const DASHBOARD_PATH = '/Users/genre/Claude/Job Search Command Center/index.html';
const STORAGE_KEY = 'jobSearchExtensionData';

let extractedJob = null;
let connections = [];

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  updateJobCount();

  // Check if we're on a LinkedIn job page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url || !tab.url.includes('linkedin.com/jobs')) {
    showNotLinkedIn();
    return;
  }

  // Try to extract job data from the page
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractJobData
    });

    if (results && results[0] && results[0].result) {
      extractedJob = results[0].result;
      showJobPreview(extractedJob);
    } else {
      showError('Could not extract job data. Make sure you\'re viewing a job posting.');
    }
  } catch (err) {
    console.error('Extraction error:', err);
    showError('Unable to read page. Try refreshing the LinkedIn page.');
  }

  // Open dashboard link
  document.getElementById('openDashboard').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: `file://${DASHBOARD_PATH}` });
  });
});

// Extract job data from LinkedIn page (runs in page context)
function extractJobData() {
  try {
    // Job title
    const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title h1') ||
                    document.querySelector('.jobs-unified-top-card__job-title') ||
                    document.querySelector('.t-24.t-bold');
    const title = titleEl ? titleEl.textContent.trim() : '';

    // Company name
    const companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name a') ||
                      document.querySelector('.jobs-unified-top-card__company-name a') ||
                      document.querySelector('.jobs-unified-top-card__company-name');
    const company = companyEl ? companyEl.textContent.trim() : '';

    // Location
    const locationEl = document.querySelector('.job-details-jobs-unified-top-card__primary-description-container .t-black--light') ||
                       document.querySelector('.jobs-unified-top-card__bullet') ||
                       document.querySelector('.job-details-jobs-unified-top-card__primary-description span');
    const location = locationEl ? locationEl.textContent.trim().split('·')[0].trim() : '';

    // Salary (if shown)
    const salaryEl = document.querySelector('.job-details-jobs-unified-top-card__job-insight span') ||
                     document.querySelector('.salary-main-rail__salary-range');
    let salary = 'Not listed';
    if (salaryEl && salaryEl.textContent.includes('$')) {
      salary = salaryEl.textContent.trim();
    }

    // Posted date
    const postedEl = document.querySelector('.jobs-unified-top-card__posted-date') ||
                     document.querySelector('.job-details-jobs-unified-top-card__primary-description-container');
    let posted = '';
    if (postedEl) {
      const text = postedEl.textContent;
      const match = text.match(/(\d+)\s+(day|week|month|hour)/i);
      if (match) {
        posted = `${match[1]} ${match[2]}${match[1] > 1 ? 's' : ''} ago`;
      }
    }

    // Job description (first 500 chars for notes)
    const descEl = document.querySelector('.jobs-description__content') ||
                   document.querySelector('.job-details-jobs-unified-top-card__job-description');
    const description = descEl ? descEl.textContent.trim().substring(0, 500) + '...' : '';

    // Current URL
    const url = window.location.href.split('?')[0];

    // Try to detect industry from company page or job details
    let industry = 'Unknown';
    const insightElements = document.querySelectorAll('.job-details-jobs-unified-top-card__job-insight');
    insightElements.forEach(el => {
      const text = el.textContent.toLowerCase();
      if (text.includes('nonprofit') || text.includes('non-profit')) industry = 'Nonprofit';
      else if (text.includes('healthcare') || text.includes('health care')) industry = 'Healthcare';
      else if (text.includes('education') || text.includes('edtech')) industry = 'Education';
      else if (text.includes('technology') || text.includes('software')) industry = 'Technology';
    });

    return {
      title,
      company,
      location,
      salary,
      posted,
      description,
      url,
      industry,
      source: 'LinkedIn'
    };
  } catch (err) {
    console.error('Extraction error:', err);
    return null;
  }
}

// Show job preview form
function showJobPreview(job) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="status success">✓ Job detected on this page</div>

    <div class="job-preview">
      <h2>${escapeHtml(job.title)}</h2>
      <div class="company">${escapeHtml(job.company)}</div>
      <div class="job-meta">
        <span>📍 ${escapeHtml(job.location || 'Location not found')}</span>
        <span>💰 ${escapeHtml(job.salary)}</span>
        <span>🏢 ${escapeHtml(job.industry)}</span>
        <span>📅 ${escapeHtml(job.posted || 'Recently')}</span>
      </div>
    </div>

    <div class="form-group">
      <label>Initial Fit Score (adjust in dashboard)</label>
      <input type="number" id="fitScore" min="0" max="100" value="75" />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Status</label>
        <select id="status">
          <option value="apply-now">🎯 Apply Now</option>
          <option value="maybe" selected>🤔 Maybe</option>
          <option value="probably-not">🤷 Probably Not</option>
        </select>
      </div>
      <div class="form-group">
        <label>Industry</label>
        <select id="industry">
          <option value="Unknown" ${job.industry === 'Unknown' ? 'selected' : ''}>Unknown</option>
          <option value="Nonprofit" ${job.industry === 'Nonprofit' ? 'selected' : ''}>Nonprofit</option>
          <option value="Healthcare" ${job.industry === 'Healthcare' ? 'selected' : ''}>Healthcare</option>
          <option value="Education" ${job.industry === 'Education' ? 'selected' : ''}>Education</option>
          <option value="Technology" ${job.industry === 'Technology' ? 'selected' : ''}>Technology</option>
          <option value="Arts & Culture">Arts & Culture</option>
          <option value="Agency">Agency</option>
          <option value="For-Profit">For-Profit</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label>Connections at ${escapeHtml(job.company)} (optional)</label>
      <div class="connection-input">
        <input type="text" id="connectionName" placeholder="Name - Role" />
        <button onclick="addConnection()">Add</button>
      </div>
      <div class="connections-list" id="connectionsList"></div>
    </div>

    <div class="form-group">
      <label>Notes</label>
      <textarea id="notes" placeholder="Why this job interests you, key requirements, etc.">${escapeHtml(job.description)}</textarea>
    </div>

    <button class="btn btn-primary" id="addToTracker" onclick="saveJob()">
      ➕ Add to Job Tracker
    </button>

    <button class="btn btn-secondary" onclick="copyJobData()">
      📋 Copy Job Data
    </button>
  `;
}

// Add connection to list
function addConnection() {
  const input = document.getElementById('connectionName');
  const name = input.value.trim();
  if (!name) return;

  connections.push({ name, reachedOut: false });
  input.value = '';
  renderConnections();
}

// Remove connection
function removeConnection(index) {
  connections.splice(index, 1);
  renderConnections();
}

// Render connections list
function renderConnections() {
  const list = document.getElementById('connectionsList');
  list.innerHTML = connections.map((conn, i) => `
    <span class="connection-tag">
      ${escapeHtml(conn.name)}
      <button onclick="removeConnection(${i})">×</button>
    </span>
  `).join('');
}

// Save job to extension storage (will sync to dashboard)
async function saveJob() {
  const btn = document.getElementById('addToTracker');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    // Get form values
    const fitScore = parseInt(document.getElementById('fitScore').value) || 75;
    const status = document.getElementById('status').value;
    const industry = document.getElementById('industry').value;
    const notes = document.getElementById('notes').value;

    // Build job object
    const job = {
      id: Date.now(), // Temporary ID, dashboard will assign real one
      title: extractedJob.title,
      company: extractedJob.company,
      industry: industry,
      location: extractedJob.location,
      salary: extractedJob.salary,
      fitScore: fitScore,
      status: status,
      posted: new Date().toISOString().split('T')[0], // Today's date
      found: new Date().toISOString().split('T')[0],
      applied: null,
      followup: null,
      url: extractedJob.url,
      symbols: [],
      connections: connections,
      sources: ['LinkedIn'],
      notes: `📍 Via LinkedIn Extension | ${notes}`,
      updates: []
    };

    // Save to extension storage
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const existing = data[STORAGE_KEY] || { pendingJobs: [] };
    existing.pendingJobs.push(job);
    await chrome.storage.local.set({ [STORAGE_KEY]: existing });

    // Update count
    updateJobCount();

    // Show success
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="status success">
        ✓ Job saved! Open the dashboard to see it.
      </div>
      <div style="text-align: center; padding: 20px;">
        <p style="margin-bottom: 15px; color: #475569;">
          <strong>${escapeHtml(extractedJob.title)}</strong><br>
          at ${escapeHtml(extractedJob.company)}
        </p>
        <button class="btn btn-primary" onclick="openDashboard()">
          Open Dashboard
        </button>
        <p style="margin-top: 15px; font-size: 12px; color: #94a3b8;">
          The job will appear when you refresh the dashboard.
        </p>
      </div>
    `;

  } catch (err) {
    console.error('Save error:', err);
    btn.disabled = false;
    btn.textContent = '➕ Add to Job Tracker';
    showError('Failed to save job. Please try again.');
  }
}

// Copy job data to clipboard (for manual paste into dashboard)
async function copyJobData() {
  const fitScore = parseInt(document.getElementById('fitScore').value) || 75;
  const status = document.getElementById('status').value;
  const industry = document.getElementById('industry').value;
  const notes = document.getElementById('notes').value;

  const jobData = {
    title: extractedJob.title,
    company: extractedJob.company,
    industry: industry,
    location: extractedJob.location,
    salary: extractedJob.salary,
    fitScore: fitScore,
    status: status,
    url: extractedJob.url,
    connections: connections,
    sources: ['LinkedIn'],
    notes: notes
  };

  await navigator.clipboard.writeText(JSON.stringify(jobData, null, 2));

  const btn = event.target;
  btn.textContent = '✓ Copied!';
  setTimeout(() => btn.textContent = '📋 Copy Job Data', 2000);
}

// Open dashboard
function openDashboard() {
  chrome.tabs.create({ url: `file://${DASHBOARD_PATH}` });
}

// Send all pending jobs to dashboard
async function sendToDashboard() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const existing = data[STORAGE_KEY] || { pendingJobs: [] };

    if (existing.pendingJobs.length === 0) {
      alert('No pending jobs to send.');
      return;
    }

    // Encode jobs data as base64 to safely pass in URL
    const jobsJson = JSON.stringify(existing.pendingJobs);
    const encoded = btoa(encodeURIComponent(jobsJson));

    // Open dashboard with jobs data in hash
    chrome.tabs.create({
      url: `file://${DASHBOARD_PATH}#import=${encoded}`
    });

    // Clear pending jobs after sending
    await chrome.storage.local.set({ [STORAGE_KEY]: { pendingJobs: [] } });
    updateJobCount();

  } catch (err) {
    console.error('Send error:', err);
    alert('Failed to send jobs. Please try copying the data manually.');
  }
}

// Show error message
function showError(message) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="status error">${escapeHtml(message)}</div>
    <button class="btn btn-secondary" onclick="window.location.reload()">
      Try Again
    </button>
  `;
}

// Show not on LinkedIn message
function showNotLinkedIn() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="not-linkedin">
      <div style="font-size: 48px;">🔗</div>
      <p>Navigate to a LinkedIn job posting to capture it.</p>
      <button class="btn btn-secondary" style="margin-top: 15px;" onclick="openDashboard()">
        Open Dashboard
      </button>
    </div>
  `;
}

// Update job count in footer
async function updateJobCount() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const existing = data[STORAGE_KEY] || { pendingJobs: [] };
    const count = existing.pendingJobs.length;
    document.getElementById('jobCount').textContent =
      count === 0 ? 'No pending jobs' :
      count === 1 ? '1 pending job' :
      `${count} pending jobs`;

    // Show/hide send to dashboard link
    const sendLink = document.getElementById('sendToDashboard');
    if (sendLink) {
      sendLink.style.display = count > 0 ? 'inline' : 'none';
    }
  } catch (err) {
    console.error('Count error:', err);
  }
}

// Escape HTML for safe display
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
