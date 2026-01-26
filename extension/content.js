// Job Search Command Center - Multi-Board Content Script
// Supports LinkedIn, Lever, Greenhouse, and other job boards
// Features: Add to Tracker, PDF Export, Find Company Page, Connection Check

(function() {
  'use strict';

  // Prevent double-injection
  if (window.jsccInjected) return;
  window.jsccInjected = true;

  // =====================================================
  // BOARD DETECTION & CONFIGURATION
  // =====================================================

  const BOARDS = {
    linkedin: {
      match: /linkedin\.com\/jobs/,
      selectors: {
        title: [
          '.job-details-jobs-unified-top-card__job-title h1',
          '.jobs-unified-top-card__job-title',
          '.t-24.t-bold.jobs-unified-top-card__job-title',
          'h1.t-24'
        ],
        company: [
          '.job-details-jobs-unified-top-card__company-name a',
          '.jobs-unified-top-card__company-name a',
          '.jobs-unified-top-card__company-name'
        ],
        location: [
          '.job-details-jobs-unified-top-card__primary-description-container .t-black--light',
          '.jobs-unified-top-card__bullet'
        ],
        description: ['.jobs-description__content', '.jobs-box__html-content'],
        salary: ['.job-details-jobs-unified-top-card__job-insight'],
        actionsContainer: [
          '.jobs-unified-top-card__actions',
          '.job-details-jobs-unified-top-card__top-buttons'
        ]
      },
      extractSalary: (el) => el.textContent.includes('$') ? el.textContent.trim() : null,
      getCompanyUrl: (company) => `https://www.linkedin.com/company/${company.toLowerCase().replace(/\s+/g, '-')}/jobs/`,
      checkConnections: true
    },
    lever: {
      match: /lever\.co/,
      selectors: {
        title: ['h2.posting-headline', '.posting-title h2', 'h2'],
        company: ['.company-header', '.posting-company'],
        location: ['.location', '.posting-categories .sort-by-time'],
        description: ['.posting-content', '.content'],
        actionsContainer: ['.posting-headline', '.posting-apply']
      },
      getCompanyFromUrl: () => {
        const match = window.location.hostname.match(/^([^.]+)\.lever\.co/);
        return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1) : '';
      }
    },
    greenhouse: {
      match: /greenhouse\.io|boards\.greenhouse/,
      selectors: {
        title: ['h1.app-title', '.job-title', 'h1'],
        company: ['.company-name', '.logo-container img[alt]'],
        location: ['.location', '.job-location'],
        description: ['#content', '.job-description', '.content'],
        actionsContainer: ['.job-application', '.application']
      },
      getCompanyFromUrl: () => {
        const match = window.location.pathname.match(/\/([^\/]+)\//);
        return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1).replace(/-/g, ' ') : '';
      }
    },
    workday: {
      match: /myworkday(jobs)?\.com|wd\d+\.myworkday/,
      selectors: {
        title: ['[data-automation-id="jobPostingHeader"]', 'h2.css-1dbjc4n'],
        company: ['[data-automation-id="companyName"]'],
        location: ['[data-automation-id="locations"]', '.css-129m7dg'],
        description: ['[data-automation-id="jobPostingDescription"]'],
        actionsContainer: ['[data-automation-id="jobPostingHeader"]']
      }
    },
    ashby: {
      match: /ashbyhq\.com|jobs\.ashbyhq/,
      selectors: {
        title: ['h1', '.ashby-job-posting-title'],
        company: ['.ashby-company-name'],
        location: ['.ashby-job-posting-location'],
        description: ['.ashby-job-posting-description'],
        actionsContainer: ['h1']
      }
    }
  };

  // =====================================================
  // UTILITY FUNCTIONS
  // =====================================================

  function detectBoard() {
    const url = window.location.href;
    for (const [name, config] of Object.entries(BOARDS)) {
      if (config.match.test(url)) {
        return { name, config };
      }
    }
    return null;
  }

  function querySelector(selectors) {
    if (!selectors) return null;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // =====================================================
  // JOB DATA EXTRACTION
  // =====================================================

  function extractJobData(board) {
    const { config } = board;
    const sel = config.selectors;

    // Title
    const titleEl = querySelector(sel.title);
    const title = titleEl ? titleEl.textContent.trim() : '';

    // Company
    let company = '';
    const companyEl = querySelector(sel.company);
    if (companyEl) {
      company = companyEl.alt || companyEl.textContent.trim();
    }
    if (!company && config.getCompanyFromUrl) {
      company = config.getCompanyFromUrl();
    }

    // Location
    const locationEl = querySelector(sel.location);
    let location = locationEl ? locationEl.textContent.trim() : '';
    if (location.includes('·')) {
      location = location.split('·')[0].trim();
    }

    // Salary
    let salary = 'Not listed';
    if (sel.salary) {
      const salaryEls = document.querySelectorAll(sel.salary.join(', '));
      salaryEls.forEach(el => {
        const text = el.textContent;
        if (text.includes('$') || text.toLowerCase().includes('salary')) {
          salary = text.trim();
        }
      });
    }

    // Description (full)
    const descEl = querySelector(sel.description);
    const fullDescription = descEl ? descEl.innerText.trim() : '';
    const descriptionSnippet = fullDescription.substring(0, 500) + (fullDescription.length > 500 ? '...' : '');

    // URL (clean)
    let url = window.location.href.split('?')[0];

    return {
      title,
      company,
      location,
      salary,
      description: descriptionSnippet,
      fullDescription,
      url,
      source: board.name.charAt(0).toUpperCase() + board.name.slice(1),
      extractedAt: new Date().toISOString()
    };
  }

  // =====================================================
  // PDF GENERATION
  // =====================================================

  function generateJobPDF(jobData) {
    // Create printable HTML
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHtml(jobData.title)} - ${escapeHtml(jobData.company)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
          h1 { color: #1a1a1a; margin-bottom: 5px; font-size: 24px; }
          .company { color: #667eea; font-size: 18px; font-weight: 600; margin-bottom: 15px; }
          .meta { color: #666; font-size: 14px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #eee; }
          .meta span { margin-right: 20px; }
          .description { white-space: pre-wrap; color: #333; }
          .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(jobData.title)}</h1>
        <div class="company">${escapeHtml(jobData.company)}</div>
        <div class="meta">
          <span>📍 ${escapeHtml(jobData.location || 'Location not specified')}</span>
          <span>💰 ${escapeHtml(jobData.salary)}</span>
        </div>
        <div class="description">${escapeHtml(jobData.fullDescription || jobData.description)}</div>
        <div class="footer">
          Source: ${escapeHtml(jobData.url)}<br>
          Captured: ${new Date().toLocaleString()}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  // =====================================================
  // COMPANY CAREERS PAGE FINDER
  // =====================================================

  async function findCompanyCareersPage(company) {
    // Common patterns for career pages
    const searchTerms = encodeURIComponent(`${company} careers jobs site`);
    const googleUrl = `https://www.google.com/search?q=${searchTerms}`;

    // Open Google search for company careers
    window.open(googleUrl, '_blank');

    return googleUrl;
  }

  // =====================================================
  // LINKEDIN CONNECTION CHECK
  // =====================================================

  function checkLinkedInConnections() {
    if (window.location.hostname !== 'www.linkedin.com') return null;

    // Look for connection indicators on job page
    const connectionBadges = document.querySelectorAll('.job-details-jobs-unified-top-card__connections-container');
    const referralInfo = document.querySelectorAll('[data-test-referral]');

    const connections = [];

    connectionBadges.forEach(badge => {
      const text = badge.textContent.trim();
      if (text) connections.push(text);
    });

    // Look for alumni info
    const alumniSection = document.querySelector('.jobs-unified-top-card__company-connection');
    if (alumniSection) {
      connections.push(alumniSection.textContent.trim());
    }

    return connections.length > 0 ? connections : null;
  }

  // =====================================================
  // JOB STATUS CHECK
  // =====================================================

  function checkJobStatus() {
    // Check for common "closed" indicators
    const closedIndicators = [
      'no longer accepting',
      'position has been filled',
      'job is closed',
      'no longer available',
      'application closed',
      'posting expired'
    ];

    const pageText = document.body.innerText.toLowerCase();

    for (const indicator of closedIndicators) {
      if (pageText.includes(indicator)) {
        return { status: 'closed', reason: indicator };
      }
    }

    // Check for 404 patterns
    if (document.title.toLowerCase().includes('not found') ||
        document.title.toLowerCase().includes('404')) {
      return { status: 'closed', reason: '404 - Page not found' };
    }

    return { status: 'active', reason: null };
  }

  // =====================================================
  // UI INJECTION
  // =====================================================

  function createToolbar(board, jobData) {
    // Remove existing toolbar
    const existing = document.getElementById('jscc-toolbar');
    if (existing) existing.remove();

    const toolbar = document.createElement('div');
    toolbar.id = 'jscc-toolbar';
    toolbar.innerHTML = `
      <style>
        #jscc-toolbar {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          padding: 12px;
          z-index: 99999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          min-width: 200px;
        }
        #jscc-toolbar .jscc-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid #eee;
        }
        #jscc-toolbar .jscc-header img {
          width: 20px;
          height: 20px;
        }
        #jscc-toolbar .jscc-header span {
          font-weight: 600;
          font-size: 13px;
          color: #333;
        }
        #jscc-toolbar .jscc-status {
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 4px;
          margin-bottom: 10px;
        }
        #jscc-toolbar .jscc-status.active {
          background: #d1fae5;
          color: #065f46;
        }
        #jscc-toolbar .jscc-status.closed {
          background: #fee2e2;
          color: #991b1b;
        }
        #jscc-toolbar button {
          display: block;
          width: 100%;
          padding: 10px 12px;
          margin-bottom: 6px;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        #jscc-toolbar button:last-child {
          margin-bottom: 0;
        }
        #jscc-toolbar .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        #jscc-toolbar .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
        }
        #jscc-toolbar .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }
        #jscc-toolbar .btn-secondary:hover {
          background: #e5e7eb;
        }
        #jscc-toolbar .btn-success {
          background: #10b981;
          color: white;
        }
        #jscc-toolbar .jscc-connections {
          font-size: 11px;
          color: #667eea;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #eee;
        }
        #jscc-toolbar .jscc-minimize {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          color: #999;
          padding: 0;
          width: auto;
          margin: 0;
        }
        #jscc-toolbar.minimized {
          padding: 8px 12px;
          min-width: auto;
        }
        #jscc-toolbar.minimized > *:not(.jscc-minimize):not(.jscc-header) {
          display: none;
        }
        #jscc-toolbar.minimized .jscc-header {
          margin: 0;
          padding: 0;
          border: none;
        }
      </style>
      <button class="jscc-minimize" title="Minimize">−</button>
      <div class="jscc-header">
        <span>🎯 Job Tracker</span>
      </div>
      <div class="jscc-status ${checkJobStatus().status}">
        ${checkJobStatus().status === 'active' ? '✅ Job appears active' : '⚠️ ' + checkJobStatus().reason}
      </div>
      <button class="btn-primary" id="jscc-add-btn">
        📥 Add to Tracker
      </button>
      <button class="btn-secondary" id="jscc-pdf-btn">
        📄 Save as PDF
      </button>
      <button class="btn-secondary" id="jscc-careers-btn">
        🔗 Find Company Careers
      </button>
      <div class="jscc-connections" id="jscc-connections" style="display: none;"></div>
    `;

    document.body.appendChild(toolbar);

    // Minimize toggle
    toolbar.querySelector('.jscc-minimize').addEventListener('click', (e) => {
      e.stopPropagation();
      toolbar.classList.toggle('minimized');
      e.target.textContent = toolbar.classList.contains('minimized') ? '+' : '−';
    });

    // Add to Tracker button
    const addBtn = toolbar.querySelector('#jscc-add-btn');
    addBtn.addEventListener('click', async () => {
      addBtn.textContent = '⏳ Adding...';
      addBtn.disabled = true;

      try {
        chrome.runtime.sendMessage({
          action: 'addJob',
          job: jobData
        }, (response) => {
          if (response && response.success) {
            addBtn.textContent = '✓ Added!';
            addBtn.classList.remove('btn-primary');
            addBtn.classList.add('btn-success');
          } else {
            addBtn.textContent = '❌ Failed - Try again';
            addBtn.disabled = false;
          }
        });
      } catch (err) {
        console.error('JSCC Error:', err);
        addBtn.textContent = '❌ Error';
        addBtn.disabled = false;
      }
    });

    // PDF button
    toolbar.querySelector('#jscc-pdf-btn').addEventListener('click', () => {
      generateJobPDF(jobData);
    });

    // Careers page button
    toolbar.querySelector('#jscc-careers-btn').addEventListener('click', () => {
      findCompanyCareersPage(jobData.company);
    });

    // LinkedIn connections
    if (board.name === 'linkedin') {
      const connections = checkLinkedInConnections();
      if (connections && connections.length > 0) {
        const connDiv = toolbar.querySelector('#jscc-connections');
        connDiv.style.display = 'block';
        connDiv.innerHTML = '👥 ' + connections.join(' · ');
      }
    }
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  function init() {
    const board = detectBoard();
    if (!board) {
      console.log('JSCC: Not a recognized job board');
      return;
    }

    console.log('JSCC: Detected', board.name, 'job board');

    // Wait for page to load
    function tryInject() {
      const titleEl = querySelector(board.config.selectors.title);
      if (titleEl) {
        const jobData = extractJobData(board);
        if (jobData.title) {
          createToolbar(board, jobData);
          console.log('JSCC: Toolbar injected', jobData);
        } else {
          console.log('JSCC: Could not extract job title');
        }
      } else {
        setTimeout(tryInject, 500);
      }
    }

    tryInject();
  }

  // Handle SPA navigation
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      window.jsccInjected = false;
      setTimeout(init, 500);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
