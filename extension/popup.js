// Job Search Command Center - LinkedIn Extension Popup

const DASHBOARD_PATH = '/Users/genre/Claude/Job Search Command Center/index.html';
const STORAGE_KEY = 'jobSearchExtensionData';
const SERVER_URL = 'http://localhost:3000';

let extractedJob = null;
let connections = [];
let serverRunning = false;
let duplicateJob = null; // Track if this job is a duplicate

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  updateJobCount();

  // Check if local server is running
  chrome.runtime.sendMessage({ action: 'checkServer' }, (response) => {
    if (response && response.serverRunning) {
      serverRunning = true;
      updateServerStatus(true);
    }
  });

  // Check if we're on a LinkedIn job page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url || !tab.url.includes('linkedin.com/jobs')) {
    showNotLinkedIn();
    return;
  }

  // Try to extract job data from the page (with retry for slow-loading pages)
  try {
    let extractedData = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (!extractedData && attempts < maxAttempts) {
      attempts++;
      console.log(`JSCC: Extraction attempt ${attempts}/${maxAttempts}`);

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractJobData
      });

      if (results && results[0] && results[0].result) {
        const data = results[0].result;
        // Check if we got meaningful data (at least title or company)
        if (data.title || data.company) {
          extractedData = data;
          break;
        }
      }

      // Wait before retry if data wasn't found
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (extractedData && (extractedData.title || extractedData.company)) {
      extractedJob = extractedData;

      // Check extraction quality
      const missingFields = [];
      if (!extractedData.title) missingFields.push('title');
      if (!extractedData.company) missingFields.push('company');
      if (!extractedData.location) missingFields.push('location');

      // Check for duplicates before showing preview
      chrome.runtime.sendMessage({ action: 'checkDuplicate', job: extractedData }, (response) => {
        if (response && response.success && response.duplicate) {
          duplicateJob = response.duplicate;
        }

        // If we have partial data, show preview with warning
        if (missingFields.length > 0 && missingFields.length < 3) {
          // Has some data but not complete - show preview with note
          showJobPreview(extractedJob);
        } else if (missingFields.length >= 3) {
          // Very incomplete - show manual entry with partial data
          showManualEntry(tab.url, {
            reason: 'Could not fully detect job details',
            hint: `Missing: ${missingFields.join(', ')}. Please fill in the missing fields.`,
            partialData: extractedData
          });
        } else {
          showJobPreview(extractedJob);
        }
      });
    } else {
      // No data at all - show manual entry
      showManualEntry(tab.url, {
        reason: 'Could not detect job details',
        hint: 'This job board may have an unusual layout. Please enter details manually.'
      });
    }
  } catch (err) {
    console.error('Extraction error:', err);
    showError(`Unable to read page: ${err.message}. Try refreshing and reopening the extension.`);
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
    // Helper to try multiple selectors
    const trySelectors = (selectors) => {
      for (const sel of selectors) {
        try {
          const el = document.querySelector(sel);
          if (el && el.textContent.trim()) return el;
        } catch (e) {}
      }
      return null;
    };

    // Helper to find elements containing specific text
    const findByText = (tag, textPattern) => {
      const elements = document.querySelectorAll(tag);
      for (const el of elements) {
        if (textPattern.test(el.textContent)) return el;
      }
      return null;
    };

    // Job title - try multiple approaches
    let title = '';

    // Approach 1: Look for h1 elements
    const h1s = document.querySelectorAll('h1');
    for (const h1 of h1s) {
      const text = h1.textContent.trim();
      // Skip if it looks like a section header or navigation
      if (text && text.length > 5 && text.length < 200 && !text.includes('LinkedIn')) {
        title = text;
        break;
      }
    }

    // Approach 2: Look for job title in specific containers
    if (!title) {
      const titleEl = trySelectors([
        '[class*="job-title"] h1',
        '[class*="job-title"] a',
        '[class*="job-title"]',
        '[class*="topcard"] h1',
        '[class*="topcard"] h2',
        '.jobs-unified-top-card h1',
        '.job-details h1'
      ]);
      if (titleEl) title = titleEl.textContent.trim();
    }

    // Company name - look for links near the title or in specific containers
    let company = '';

    // Approach 1: Find company link (usually after title)
    const companyLinks = document.querySelectorAll('a[href*="/company/"]');
    for (const link of companyLinks) {
      const text = link.textContent.trim();
      // Company name is usually short and doesn't contain common words
      if (text && text.length > 1 && text.length < 100 && !text.includes('See all') && !text.includes('Follow')) {
        company = text;
        break;
      }
    }

    // Approach 2: Look in specific containers
    if (!company) {
      const companyEl = trySelectors([
        '[class*="company-name"] a',
        '[class*="company-name"]',
        '[class*="topcard"] a[href*="/company/"]',
        '.jobs-unified-top-card a[href*="/company/"]'
      ]);
      if (companyEl) company = companyEl.textContent.trim();
    }

    // Location - look for location patterns in the page
    let location = '';

    // Look for elements with location-like content
    const allSpans = document.querySelectorAll('span, div');
    for (const el of allSpans) {
      const text = el.textContent.trim();
      // Location patterns: "City, State", "Remote", "Hybrid"
      if (text && text.length < 80) {
        // Check for US city, state pattern or common location keywords
        if (/^[A-Z][a-z]+,\s*[A-Z]{2}/.test(text) ||
            /^[A-Z][a-z]+,\s*[A-Z][a-z]+/.test(text) ||
            text.toLowerCase() === 'remote' ||
            text.toLowerCase().includes('hybrid') ||
            text.toLowerCase().includes('on-site') ||
            /United States|Boston|New York|San Francisco|Los Angeles|Chicago|Seattle|Austin/i.test(text)) {
          // Make sure it's not part of a larger text block
          if (el.children.length === 0 || el.textContent === text) {
            location = text;
            break;
          }
        }
      }
    }

    // Salary - search entire page for $ amounts
    let salary = 'Not listed';
    const pageText = document.body.innerText;
    const salaryMatch = pageText.match(/\$[\d,]+(?:K)?(?:\s*[-–]\s*\$[\d,]+(?:K)?)?(?:\s*(?:\/|per)\s*(?:yr|year|hour|hr|annually))?/i);
    if (salaryMatch) {
      salary = salaryMatch[0];
    }

    // Posted date - look for time ago patterns
    let posted = '';
    const postedMatch = pageText.match(/(?:Posted|Reposted)\s*(\d+)\s*(day|week|month|hour|minute)s?\s*ago/i);
    if (postedMatch) {
      posted = `${postedMatch[1]} ${postedMatch[2]}${parseInt(postedMatch[1]) > 1 ? 's' : ''} ago`;
    }

    // Job description - look for main content area
    let description = '';
    const descEl = trySelectors([
      '.jobs-description__content',
      '.jobs-description-content__text',
      '#job-details',
      '.jobs-box__html-content',
      '[class*="description"]'
    ]);
    if (descEl) {
      description = descEl.textContent.trim().substring(0, 500) + '...';
    }

    // Current URL (clean)
    const url = window.location.href.split('?')[0];

    // Industry detection from page content
    let industry = 'Unknown';
    const fullText = pageText.toLowerCase();
    if (fullText.includes('nonprofit') || fullText.includes('non-profit') || fullText.includes('501(c)')) {
      industry = 'Nonprofit';
    } else if (fullText.includes('healthcare') || fullText.includes('health care') || fullText.includes('hospital') || fullText.includes('medical')) {
      industry = 'Healthcare';
    } else if (fullText.includes('education') || fullText.includes('university') || fullText.includes('edtech') || fullText.includes('school')) {
      industry = 'Education';
    } else if (fullText.includes('technology') || fullText.includes('software') || fullText.includes('saas')) {
      industry = 'Technology';
    }

    console.log('JSCC Extracted:', { title, company, location, salary, posted, industry, url });

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
    console.error('JSCC Extraction error:', err);
    return null;
  }
}

// Show job preview form
function showJobPreview(job) {
  const content = document.getElementById('content');

  // Build duplicate warning if needed
  let duplicateWarning = '';
  if (duplicateJob) {
    const foundDate = duplicateJob.found || duplicateJob.posted || 'unknown date';
    duplicateWarning = `
      <div class="status warning" style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;">
        ⚠️ Possible duplicate: <strong>${escapeHtml(duplicateJob.title)}</strong> at ${escapeHtml(duplicateJob.company)}<br>
        <small>Added ${escapeHtml(foundDate)} • Status: ${escapeHtml(duplicateJob.status || 'unknown')}</small>
      </div>
    `;
  }

  content.innerHTML = `
    ${duplicateJob ? duplicateWarning : '<div class="status success">✓ Job detected on this page</div>'}

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

    <button class="btn ${duplicateJob ? 'btn-warning' : 'btn-primary'}" id="addToTracker" onclick="saveJob()" ${duplicateJob ? 'style="background: #f59e0b; color: white;"' : ''}>
      ${duplicateJob ? '⚠️ Add Anyway' : '➕ Add to Job Tracker'}
    </button>

    ${duplicateJob ? `
    <button class="btn btn-secondary" onclick="openDashboard()">
      👀 View Existing Job
    </button>
    ` : ''}

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

// Save job to inbox via server API (preferred) or to pending queue (fallback)
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
      title: extractedJob.title,
      company: extractedJob.company,
      industry: industry,
      location: extractedJob.location,
      salary: extractedJob.salary,
      fitScore: fitScore,
      description: notes,
      url: extractedJob.url,
      connections: connections,
      source: extractedJob.source || 'LinkedIn'
    };

    // Send to inbox via new background action
    chrome.runtime.sendMessage({ action: 'addJobToInbox', job }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('JSCC Error:', chrome.runtime.lastError);
        btn.disabled = false;
        btn.textContent = '➕ Add to Job Tracker';
        showError(`Extension error: ${chrome.runtime.lastError.message}`);
        return;
      }

      const content = document.getElementById('content');

      if (response && response.success) {
        if (response.inbox) {
          // Job was added to inbox for review
          content.innerHTML = `
            <div class="status success">
              ✓ Job sent to Inbox for review!
            </div>
            <div style="text-align: center; padding: 20px;">
              <p style="margin-bottom: 15px; color: #475569;">
                <strong>${escapeHtml(extractedJob.title)}</strong><br>
                at ${escapeHtml(extractedJob.company)}
              </p>
              <p style="color: #10b981; font-weight: 500;">
                🟢 ${escapeHtml(response.message || 'Added to inbox')}
              </p>
              <button class="btn btn-primary" onclick="openDashboard()" style="margin-top: 15px;">
                📬 Open Inbox
              </button>
              <button class="btn btn-secondary" onclick="window.close()" style="margin-top: 8px;">
                Continue Browsing
              </button>
            </div>
          `;
        } else if (response.direct === false) {
          // Server offline - saved to pending queue
          updateJobCount();
          content.innerHTML = `
            <div class="status warning" style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;">
              ⏸ Job queued (server offline)
            </div>
            <div style="text-align: center; padding: 20px;">
              <p style="margin-bottom: 15px; color: #475569;">
                <strong>${escapeHtml(extractedJob.title)}</strong><br>
                at ${escapeHtml(extractedJob.company)}
              </p>
              <p style="color: #f59e0b; font-size: 12px;">
                ${escapeHtml(response.message || 'Start server with: node server.js')}
              </p>
              <button class="btn btn-primary" onclick="sendToDashboard()">
                🚀 Send to Dashboard Now
              </button>
              <button class="btn btn-secondary" onclick="window.close()" style="margin-top: 8px;">
                Save More Jobs First
              </button>
            </div>
          `;
        } else {
          // Added directly (legacy flow)
          content.innerHTML = `
            <div class="status success">
              ✓ Job added to dashboard!
            </div>
            <div style="text-align: center; padding: 20px;">
              <p style="margin-bottom: 15px; color: #475569;">
                <strong>${escapeHtml(extractedJob.title)}</strong><br>
                at ${escapeHtml(extractedJob.company)}
              </p>
              <button class="btn btn-secondary" onclick="openDashboard()" style="margin-top: 15px;">
                📊 Open Dashboard
              </button>
              <button class="btn btn-secondary" onclick="window.close()" style="margin-top: 8px;">
                Continue Browsing
              </button>
            </div>
          `;
        }
      } else if (response && response.duplicate) {
        // Duplicate found
        content.innerHTML = `
          <div class="status warning" style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;">
            ⚠️ This job already exists
          </div>
          <div style="text-align: center; padding: 20px;">
            <p style="margin-bottom: 15px; color: #475569;">
              <strong>${escapeHtml(response.existingJob?.title || extractedJob.title)}</strong><br>
              at ${escapeHtml(response.existingJob?.company || extractedJob.company)}
            </p>
            <p style="font-size: 12px; color: #64748b;">
              Status: ${escapeHtml(response.existingJob?.status || 'unknown')}
            </p>
            <button class="btn btn-primary" onclick="openDashboard()" style="margin-top: 15px;">
              👀 View in Dashboard
            </button>
            <button class="btn btn-secondary" onclick="window.close()" style="margin-top: 8px;">
              Continue Browsing
            </button>
          </div>
        `;
      } else {
        throw new Error(response?.error || 'Failed to save job');
      }
    });

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

    console.log('JSCC: Sending jobs to dashboard:', existing.pendingJobs);

    // Encode jobs data as base64 to safely pass in URL
    const jobsJson = JSON.stringify(existing.pendingJobs);
    console.log('JSCC: Jobs JSON:', jobsJson);

    const encoded = btoa(encodeURIComponent(jobsJson));
    console.log('JSCC: Encoded data length:', encoded.length);

    const dashboardUrl = `file://${DASHBOARD_PATH}#import=${encoded}`;
    console.log('JSCC: Opening URL:', dashboardUrl.substring(0, 100) + '...');

    // Open dashboard with jobs data in hash
    chrome.tabs.create({
      url: dashboardUrl
    });

    // Clear pending jobs after sending
    await chrome.storage.local.set({ [STORAGE_KEY]: { pendingJobs: [] } });
    updateJobCount();

    // Show confirmation
    const content = document.getElementById('content');
    if (content) {
      content.innerHTML = `
        <div class="status success">
          ✓ Jobs sent to dashboard!
        </div>
        <div style="text-align: center; padding: 20px;">
          <p style="color: #475569; margin-bottom: 15px;">
            ${existing.pendingJobs.length} job(s) sent. Check the dashboard tab that just opened.
          </p>
          <p style="font-size: 12px; color: #94a3b8;">
            If jobs don't appear, check the browser console for errors.
          </p>
        </div>
      `;
    }

  } catch (err) {
    console.error('JSCC Send error:', err);
    alert('Failed to send jobs: ' + err.message + '\n\nPlease try copying the data manually.');
  }
}

// Show error message
function showError(message) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="status error" style="margin-bottom: 12px;">
      <strong>❌ Error</strong><br>
      ${escapeHtml(message)}
    </div>
    <button class="btn btn-primary" onclick="window.location.reload()" style="margin-bottom: 8px;">
      🔄 Try Again
    </button>
    <button class="btn btn-secondary" onclick="showManualEntry(getCurrentUrl())">
      ✏️ Enter Manually
    </button>
    <p style="margin-top: 12px; font-size: 11px; color: #94a3b8; text-align: center;">
      If this keeps happening, the page structure may have changed.<br>
      <a href="#" onclick="copyErrorReport(); return false;" style="color: #667eea;">Copy error report</a>
    </p>
  `;
}

// Get current tab URL
async function getCurrentUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.url || '';
  } catch (e) {
    return '';
  }
}

// Copy error details for debugging
async function copyErrorReport() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const report = {
      url: tab?.url,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      extensionVersion: chrome.runtime.getManifest().version
    };
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    alert('Error report copied to clipboard!');
  } catch (e) {
    alert('Could not copy report: ' + e.message);
  }
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

// Show manual entry form when auto-extraction fails
function showManualEntry(pageUrl, options = {}) {
  const reason = options.reason || 'Auto-detection failed';
  const hint = options.hint || 'Please enter job details manually.';
  const partialData = options.partialData || {};

  extractedJob = {
    title: partialData.title || '',
    company: partialData.company || '',
    location: partialData.location || '',
    salary: partialData.salary || 'Not listed',
    posted: '',
    description: partialData.description || '',
    url: pageUrl ? pageUrl.split('?')[0] : '',
    industry: partialData.industry || 'Unknown',
    source: detectSourceFromUrl(pageUrl)
  };

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="status info" style="margin-bottom: 12px;">
      <strong>⚠️ ${escapeHtml(reason)}</strong><br>
      <small>${escapeHtml(hint)}</small>
    </div>

    <div class="form-group">
      <label>Job Title *</label>
      <input type="text" id="manualTitle" placeholder="e.g., Senior Creative Director" />
    </div>

    <div class="form-group">
      <label>Company *</label>
      <input type="text" id="manualCompany" placeholder="e.g., Acme Corp" />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Location</label>
        <input type="text" id="manualLocation" placeholder="e.g., Boston, MA" />
      </div>
      <div class="form-group">
        <label>Salary</label>
        <input type="text" id="manualSalary" placeholder="e.g., $120K-$150K" value="Not listed" />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Fit Score</label>
        <input type="number" id="fitScore" min="0" max="100" value="75" />
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="status">
          <option value="apply-now">🎯 Apply Now</option>
          <option value="maybe" selected>🤔 Maybe</option>
          <option value="probably-not">🤷 Probably Not</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label>Industry</label>
      <select id="industry">
        <option value="Unknown">Unknown</option>
        <option value="Nonprofit">Nonprofit</option>
        <option value="Healthcare">Healthcare</option>
        <option value="Education">Education</option>
        <option value="Technology">Technology</option>
        <option value="Arts & Culture">Arts & Culture</option>
        <option value="Agency">Agency</option>
        <option value="For-Profit">For-Profit</option>
      </select>
    </div>

    <div class="form-group">
      <label>Notes</label>
      <textarea id="notes" placeholder="Why this job interests you, key requirements, etc."></textarea>
    </div>

    <button class="btn btn-primary" onclick="saveManualJob()">
      ➕ Add to Job Tracker
    </button>

    <p style="margin-top: 15px; font-size: 11px; color: #94a3b8; text-align: center;">
      URL: ${escapeHtml(pageUrl ? pageUrl.split('?')[0] : 'Not detected')}
    </p>
  `;
}

// Save manually entered job
async function saveManualJob() {
  const title = document.getElementById('manualTitle').value.trim();
  const company = document.getElementById('manualCompany').value.trim();

  if (!title || !company) {
    alert('Please enter at least a job title and company name.');
    return;
  }

  // Update extractedJob with manual values
  extractedJob.title = title;
  extractedJob.company = company;
  extractedJob.location = document.getElementById('manualLocation').value.trim() || '';
  extractedJob.salary = document.getElementById('manualSalary').value.trim() || 'Not listed';

  // Now save using the existing saveJob function
  await saveJob();
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

// Detect job board source from URL
function detectSourceFromUrl(url) {
  if (!url) return 'Unknown';
  if (url.includes('linkedin.com')) return 'LinkedIn';
  if (url.includes('lever.co')) return 'Lever';
  if (url.includes('greenhouse.io')) return 'Greenhouse';
  if (url.includes('workday')) return 'Workday';
  if (url.includes('ashbyhq.com')) return 'Ashby';
  if (url.includes('indeed.com')) return 'Indeed';
  if (url.includes('glassdoor.com')) return 'Glassdoor';
  return 'Other';
}

// Update server status indicator in footer
function updateServerStatus(isRunning) {
  const indicator = document.getElementById('serverStatus');
  if (indicator) {
    indicator.innerHTML = isRunning
      ? '<span style="color: #10b981;">🟢 Server connected</span>'
      : '<span style="color: #94a3b8;">⚪ Server offline</span>';
  }
}
