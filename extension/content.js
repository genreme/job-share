// Job Search Command Center - LinkedIn Content Script
// Injects "Add to Tracker" button on LinkedIn job pages

(function() {
  'use strict';

  // Check if we've already injected
  if (document.getElementById('jscc-linkedin-button')) return;

  // Wait for job details to load
  function waitForJobDetails() {
    const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title h1') ||
                    document.querySelector('.jobs-unified-top-card__job-title') ||
                    document.querySelector('.t-24.t-bold.jobs-unified-top-card__job-title');

    if (titleEl) {
      injectButton();
    } else {
      setTimeout(waitForJobDetails, 500);
    }
  }

  // Inject the "Add to Tracker" button
  function injectButton() {
    // Find the actions container
    const actionsContainer = document.querySelector('.jobs-unified-top-card__actions') ||
                             document.querySelector('.job-details-jobs-unified-top-card__top-buttons') ||
                             document.querySelector('.jobs-save-button').parentElement;

    if (!actionsContainer) {
      console.log('JSCC: Could not find actions container');
      return;
    }

    // Check if already added
    if (document.getElementById('jscc-linkedin-button')) return;

    // Create button
    const button = document.createElement('button');
    button.id = 'jscc-linkedin-button';
    button.className = 'jscc-add-button';
    button.innerHTML = '🎯 Add to Tracker';
    button.title = 'Add to Job Search Command Center';

    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      button.innerHTML = '⏳ Adding...';
      button.disabled = true;

      try {
        // Extract job data
        const jobData = extractJobData();

        // Send to extension
        chrome.runtime.sendMessage({
          action: 'addJob',
          job: jobData
        }, (response) => {
          if (response && response.success) {
            button.innerHTML = '✓ Added!';
            button.classList.add('jscc-added');
            setTimeout(() => {
              button.innerHTML = '🎯 Add to Tracker';
              button.disabled = false;
              button.classList.remove('jscc-added');
            }, 3000);
          } else {
            button.innerHTML = '❌ Failed';
            button.disabled = false;
            setTimeout(() => {
              button.innerHTML = '🎯 Add to Tracker';
            }, 2000);
          }
        });
      } catch (err) {
        console.error('JSCC Error:', err);
        button.innerHTML = '❌ Error';
        button.disabled = false;
        setTimeout(() => {
          button.innerHTML = '🎯 Add to Tracker';
        }, 2000);
      }
    });

    // Insert button
    actionsContainer.insertBefore(button, actionsContainer.firstChild);
    console.log('JSCC: Button injected');
  }

  // Extract job data from page
  function extractJobData() {
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
                       document.querySelector('.jobs-unified-top-card__bullet');
    const location = locationEl ? locationEl.textContent.trim().split('·')[0].trim() : '';

    // Salary
    let salary = 'Not listed';
    const insightEls = document.querySelectorAll('.job-details-jobs-unified-top-card__job-insight');
    insightEls.forEach(el => {
      if (el.textContent.includes('$')) {
        salary = el.textContent.trim();
      }
    });

    // Job description snippet
    const descEl = document.querySelector('.jobs-description__content');
    const description = descEl ? descEl.textContent.trim().substring(0, 300) + '...' : '';

    return {
      title,
      company,
      location,
      salary,
      description,
      url: window.location.href.split('?')[0],
      source: 'LinkedIn'
    };
  }

  // Start watching for job pages
  waitForJobDetails();

  // Also watch for navigation changes (LinkedIn is a SPA)
  const observer = new MutationObserver((mutations) => {
    if (window.location.href.includes('/jobs/view/')) {
      waitForJobDetails();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

})();
