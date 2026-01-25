// Job Search Command Center - Background Script
// Handles communication between content script and popup

const STORAGE_KEY = 'jobSearchExtensionData';

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
