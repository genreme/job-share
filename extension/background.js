// Job Search Command Center - Background Script
// Handles communication between content script and popup

const STORAGE_KEY = 'jobSearchExtensionData';
const SERVER_URL = 'http://localhost:3000';
const API_URL = `${SERVER_URL}/api/jobs`;

// =====================================================
// DUPLICATE DETECTION
// =====================================================

/**
 * Check if a job already exists in pending queue or on server
 * @param {object} job - Job to check
 * @returns {object|null} - Existing job if duplicate found, null otherwise
 */
async function checkDuplicate(job) {
  if (!job.title || !job.company) return null;

  // Get pending jobs from local storage
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const pending = (data[STORAGE_KEY] || {}).pendingJobs || [];

  // Try to get jobs from server (if running)
  let serverJobs = [];
  try {
    const serverRunning = await checkServerStatus();
    if (serverRunning) {
      const serverData = await getJobsFromServer();
      serverJobs = serverData.jobs || [];
    }
  } catch (e) {
    // Server not running, continue with pending jobs only
  }

  const allJobs = [...pending, ...serverJobs];
  return findDuplicate(job, allJobs);
}

/**
 * Find a duplicate job in a list of existing jobs
 * @param {object} job - Job to check
 * @param {array} existingJobs - List of existing jobs
 * @returns {object|null} - Matching job if found
 */
function findDuplicate(job, existingJobs) {
  const normalizedTitle = normalizeText(job.title);
  const normalizedCompany = normalizeText(job.company);

  for (const existing of existingJobs) {
    const existingCompany = normalizeText(existing.company);

    // Same company check
    if (existingCompany === normalizedCompany) {
      const existingTitle = normalizeText(existing.title);

      // Exact title match
      if (existingTitle === normalizedTitle) {
        return existing;
      }

      // Similar title (>80% similarity)
      const similarity = calculateSimilarity(normalizedTitle, existingTitle);
      if (similarity > 0.8) {
        return existing;
      }
    }

    // Also check URL match (same job posting)
    if (job.url && existing.url) {
      const normalizedUrl = job.url.split('?')[0].toLowerCase();
      const existingUrl = existing.url.split('?')[0].toLowerCase();
      if (normalizedUrl === existingUrl) {
        return existing;
      }
    }
  }

  return null;
}

/**
 * Normalize text for comparison (lowercase, alphanumeric only)
 */
function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Calculate similarity between two strings (0-1)
 * Uses Levenshtein distance
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein edit distance between two strings
 */
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

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'addJob') {
    addJobToStorage(message.job)
      .then(() => sendResponse({ success: true }))
      .catch(err => {
        console.error('Failed to add job:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep message channel open for async response
  }

  if (message.action === 'getJobs') {
    getJobsFromStorage()
      .then(jobs => sendResponse({ success: true, jobs }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'clearJobs') {
    clearJobsFromStorage()
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Check for duplicate before adding
  if (message.action === 'checkDuplicate') {
    checkDuplicate(message.job)
      .then(duplicate => sendResponse({ success: true, duplicate }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// Add job to local storage
async function addJobToStorage(jobData) {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const existing = data[STORAGE_KEY] || { pendingJobs: [] };

  // Build full job object
  const job = {
    id: Date.now(),
    title: jobData.title || 'Unknown Title',
    company: jobData.company || 'Unknown Company',
    industry: detectIndustry(jobData),
    location: jobData.location || 'Unknown',
    salary: jobData.salary || 'Not listed',
    fitScore: 75, // Default, user can adjust
    status: 'maybe',
    posted: new Date().toISOString().split('T')[0],
    found: new Date().toISOString().split('T')[0],
    applied: null,
    followup: null,
    url: jobData.url,
    symbols: [],
    connections: [],
    sources: ['LinkedIn'],
    notes: `📍 Captured via LinkedIn Extension\n\n${jobData.description || ''}`,
    updates: []
  };

  existing.pendingJobs.push(job);
  await chrome.storage.local.set({ [STORAGE_KEY]: existing });

  // Update badge
  updateBadge(existing.pendingJobs.length);

  return job;
}

// Get all pending jobs
async function getJobsFromStorage() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return (data[STORAGE_KEY] || { pendingJobs: [] }).pendingJobs;
}

// Clear all pending jobs
async function clearJobsFromStorage() {
  await chrome.storage.local.set({ [STORAGE_KEY]: { pendingJobs: [] } });
  updateBadge(0);
}

// Detect industry from job data
function detectIndustry(jobData) {
  const text = `${jobData.title} ${jobData.company} ${jobData.description}`.toLowerCase();

  if (text.includes('nonprofit') || text.includes('non-profit') || text.includes('foundation')) {
    return 'Nonprofit';
  }
  if (text.includes('healthcare') || text.includes('health') || text.includes('hospital') || text.includes('medical')) {
    return 'Healthcare';
  }
  if (text.includes('education') || text.includes('university') || text.includes('college') || text.includes('school') || text.includes('edtech')) {
    return 'Education';
  }
  if (text.includes('museum') || text.includes('arts') || text.includes('culture') || text.includes('gallery')) {
    return 'Arts & Culture';
  }
  if (text.includes('agency') || text.includes('consulting') || text.includes('marketing agency')) {
    return 'Agency';
  }

  return 'Unknown';
}

// Update extension badge with pending job count
function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Initialize badge on startup
chrome.storage.local.get(STORAGE_KEY).then(data => {
  const existing = data[STORAGE_KEY] || { pendingJobs: [] };
  updateBadge(existing.pendingJobs.length);
});

// =====================================================
// SERVER API INTEGRATION
// =====================================================

// Check if local server is running
async function checkServerStatus() {
  try {
    const response = await fetch(`${SERVER_URL}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    return response.ok;
  } catch (err) {
    return false;
  }
}

// Get current jobs from server
async function getJobsFromServer() {
  const response = await fetch(API_URL);
  if (!response.ok) throw new Error('Server request failed');
  return await response.json();
}

// Add job directly to server (bypasses pending queue)
async function addJobToServer(job) {
  // Get current jobs from server
  const serverData = await getJobsFromServer();
  const jobs = serverData.jobs || [];

  // Assign new ID (max existing + 1)
  const maxId = jobs.reduce((max, j) => Math.max(max, j.id || 0), 0);
  job.id = maxId + 1;

  // Add to jobs array
  jobs.push(job);

  // Save back to server
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobs,
      searchHistory: serverData.searchHistory || [],
      settings: serverData.settings || {}
    })
  });

  if (!response.ok) throw new Error('Failed to save to server');

  return job;
}

// Sync all pending jobs to server
async function syncPendingToServer() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const existing = data[STORAGE_KEY] || { pendingJobs: [] };

  if (existing.pendingJobs.length === 0) {
    return { synced: 0, message: 'No pending jobs to sync' };
  }

  // Get current jobs from server
  const serverData = await getJobsFromServer();
  const jobs = serverData.jobs || [];

  // Assign new IDs and add pending jobs
  let maxId = jobs.reduce((max, j) => Math.max(max, j.id || 0), 0);

  for (const job of existing.pendingJobs) {
    maxId++;
    job.id = maxId;
    jobs.push(job);
  }

  // Save back to server
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobs,
      searchHistory: serverData.searchHistory || [],
      settings: serverData.settings || {}
    })
  });

  if (!response.ok) throw new Error('Failed to save to server');

  // Clear pending jobs
  const syncedCount = existing.pendingJobs.length;
  await chrome.storage.local.set({ [STORAGE_KEY]: { pendingJobs: [] } });
  updateBadge(0);

  return { synced: syncedCount, message: `Synced ${syncedCount} jobs to server` };
}

// Handle additional messages for server sync
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkServer') {
    checkServerStatus()
      .then(isRunning => sendResponse({ success: true, serverRunning: isRunning }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'syncToServer') {
    syncPendingToServer()
      .then(result => sendResponse({ success: true, ...result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'addJobDirect') {
    // Add job directly to server (if running) or to pending queue
    checkServerStatus()
      .then(async (isRunning) => {
        if (isRunning) {
          const job = await addJobToServer(message.job);
          sendResponse({ success: true, job, direct: true });
        } else {
          const job = await addJobToStorage(message.job);
          sendResponse({ success: true, job, direct: false });
        }
      })
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // NEW: Add job directly to inbox via server API
  if (message.action === 'addJobToInbox') {
    addJobToInbox(message.job)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// =====================================================
// INBOX API INTEGRATION
// =====================================================

/**
 * Add job directly to inbox via server /api/inbox endpoint
 * This is the preferred flow - jobs go to inbox for review
 */
async function addJobToInbox(jobData) {
  // First check if server is running
  const serverRunning = await checkServerStatus();

  if (!serverRunning) {
    // Server not running - fall back to pending queue
    const job = await addJobToStorage(jobData);
    return {
      success: true,
      job,
      direct: false,
      message: 'Server offline - job saved to pending queue. Start server and sync to add to dashboard.'
    };
  }

  // Server is running - send to inbox
  try {
    const response = await fetch(`${SERVER_URL}/api/inbox`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(jobData)
    });

    const result = await response.json();

    if (response.status === 409) {
      // Duplicate found
      return {
        success: false,
        duplicate: true,
        existingJob: result.existingJob,
        message: result.message
      };
    }

    if (!response.ok) {
      throw new Error(result.error || 'Server request failed');
    }

    return {
      success: true,
      job: result.job,
      direct: true,
      inbox: true,
      message: result.message || 'Job added to inbox for review'
    };
  } catch (err) {
    console.error('Failed to add to inbox:', err);
    // Fall back to pending queue
    const job = await addJobToStorage(jobData);
    return {
      success: true,
      job,
      direct: false,
      message: `Server error - job saved to pending queue. Error: ${err.message}`
    };
  }
}
