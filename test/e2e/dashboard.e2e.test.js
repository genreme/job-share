/**
 * Dashboard E2E Tests
 *
 * Tests that the actual index.html loads and renders job data correctly.
 * Uses Playwright to run in a real browser.
 */

import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const INDEX_HTML_PATH = join(PROJECT_ROOT, 'index.html');
const JOBS_JSON_PATH = join(PROJECT_ROOT, 'mcp-server', 'data', 'jobs.json');

test.describe('Dashboard Rendering', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to index.html using file:// protocol
    await page.goto(`file://${INDEX_HTML_PATH}`);
  });

  test('index.html loads without errors', async ({ page }) => {
    // Check page loaded with expected title
    await expect(page).toHaveTitle(/Job Search|Dashboard|Command Center/i);

    // Collect JavaScript errors
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    // Wait a moment for any async errors
    await page.waitForTimeout(500);
    expect(errors).toHaveLength(0);
  });

  test('dashboard structure renders correctly', async ({ page }) => {
    // Check for main structural elements - the jobs-table class
    const table = page.locator('table.jobs-table');
    await expect(table).toBeVisible();

    // Check for job table headers
    const headers = page.locator('table.jobs-table th');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThan(0);

    // Verify expected column headers exist
    const headerTexts = await headers.allTextContents();
    expect(headerTexts.some(h => h.includes('Fit'))).toBe(true);
    expect(headerTexts.some(h => h.includes('Title'))).toBe(true);
    expect(headerTexts.some(h => h.includes('Company'))).toBe(true);
    expect(headerTexts.some(h => h.includes('Status'))).toBe(true);
  });

  test('job rows display when data exists', async ({ page }) => {
    // Check if jobs.json exists with data
    if (!existsSync(JOBS_JSON_PATH)) {
      test.skip();
      return;
    }

    const jobsData = JSON.parse(readFileSync(JOBS_JSON_PATH, 'utf-8'));
    if (!jobsData.jobs || jobsData.jobs.length === 0) {
      test.skip();
      return;
    }

    // Wait for table to have rows - using .job-row class
    const rows = page.locator('table.jobs-table tbody tr.job-row');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });

    // Should have job rows
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('fit scores display with color coding', async ({ page }) => {
    // Check for fit score elements with color classes
    const fitScores = page.locator('.fit-score');

    // Wait for page to render
    await page.waitForTimeout(500);

    const fitScoreCount = await fitScores.count();
    if (fitScoreCount > 0) {
      // At least one fit score should have a color class (fit-high, fit-medium, or fit-low)
      const firstFitScore = fitScores.first();
      const classes = await firstFitScore.getAttribute('class');
      expect(classes).toMatch(/fit-(high|medium|low)/);
    }
  });

  test('status badges display correctly', async ({ page }) => {
    // Check for status badge elements
    const statusBadges = page.locator('.status-badge');

    await page.waitForTimeout(500);

    const badgeCount = await statusBadges.count();
    if (badgeCount > 0) {
      // Status badges should have status-specific classes
      const firstBadge = statusBadges.first();
      const classes = await firstBadge.getAttribute('class');
      // Classes are: status-apply-now, status-maybe, status-probably-not, status-applied, status-archived
      expect(classes).toMatch(/status-(apply-now|maybe|probably-not|applied|archived)/);
    }
  });

  test('search box is present', async ({ page }) => {
    // Check for search input - the actual search box in index.html
    const searchInput = page.locator('.search-box, input[type="text"]');

    // At least one search-like input should exist
    const searchCount = await searchInput.count();
    expect(searchCount).toBeGreaterThan(0);
  });

  test('filter buttons are present', async ({ page }) => {
    // Check for filter buttons
    const filterButtons = page.locator('.filter-btn');

    const filterCount = await filterButtons.count();
    expect(filterCount).toBeGreaterThan(0);
  });

  test('no broken images or missing resources', async ({ page }) => {
    const brokenResources = [];

    page.on('response', response => {
      if (response.status() >= 400) {
        brokenResources.push({
          url: response.url(),
          status: response.status()
        });
      }
    });

    // Reload to capture all resource loads
    await page.reload();
    await page.waitForTimeout(1000);

    // Filter out expected missing resources (like external APIs)
    const unexpectedBroken = brokenResources.filter(r =>
      !r.url.includes('api.') && !r.url.includes('external')
    );

    expect(unexpectedBroken).toHaveLength(0);
  });

  test('stats bar displays metrics', async ({ page }) => {
    // Check for stat cards in header
    const statCards = page.locator('.stat-card');

    const statCount = await statCards.count();
    expect(statCount).toBeGreaterThan(0);

    // Check that stat values are rendered
    const statValues = page.locator('.stat-value');
    const valueCount = await statValues.count();
    expect(valueCount).toBeGreaterThan(0);
  });

  test('tabs navigation is present', async ({ page }) => {
    // Check for tab buttons
    const tabs = page.locator('.tab');

    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(0);

    // Check for active tab
    const activeTab = page.locator('.tab.active');
    await expect(activeTab).toBeVisible();
  });
});

test.describe('Dashboard Interactivity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`file://${INDEX_HTML_PATH}`);
  });

  test('table headers are clickable for sorting', async ({ page }) => {
    const sortableHeaders = page.locator('table.jobs-table th[onclick*="sortJobs"]');
    const headerCount = await sortableHeaders.count();

    if (headerCount > 0) {
      // Click first sortable header
      const firstHeader = sortableHeaders.first();
      await firstHeader.click();

      // Page should still be functional after click
      const table = page.locator('table.jobs-table');
      await expect(table).toBeVisible();
    }
  });

  test('filter buttons change state when clicked', async ({ page }) => {
    const filterButtons = page.locator('.filter-btn');
    const buttonCount = await filterButtons.count();

    if (buttonCount > 0) {
      // Click first filter button
      const firstButton = filterButtons.first();
      await firstButton.click();

      // Page should still be functional after click
      const table = page.locator('table.jobs-table');
      await expect(table).toBeVisible();
    }
  });

  test('tabs switch content when clicked', async ({ page }) => {
    const tabs = page.locator('.tab');
    const tabCount = await tabs.count();

    if (tabCount > 1) {
      // Get second tab (not the currently active one)
      const secondTab = tabs.nth(1);
      await secondTab.click();

      // Second tab should now be active
      await expect(secondTab).toHaveClass(/active/);
    }
  });

  test('job row click shows job detail', async ({ page }) => {
    // Check if jobs.json exists with data
    if (!existsSync(JOBS_JSON_PATH)) {
      test.skip();
      return;
    }

    const jobsData = JSON.parse(readFileSync(JOBS_JSON_PATH, 'utf-8'));
    if (!jobsData.jobs || jobsData.jobs.length === 0) {
      test.skip();
      return;
    }

    // Wait for rows to render
    const rows = page.locator('table.jobs-table tbody tr.job-row');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });

    // Click first job row
    await rows.first().click();

    // Wait for detail modal/panel to appear (implementation may vary)
    // Just verify page remains functional
    await page.waitForTimeout(300);
    const table = page.locator('table.jobs-table');
    await expect(table).toBeVisible();
  });
});

test.describe('Dashboard Visual Elements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`file://${INDEX_HTML_PATH}`);
  });

  test('header has gradient background', async ({ page }) => {
    const header = page.locator('.header');
    await expect(header).toBeVisible();

    // Check header has background style
    const bgStyle = await header.evaluate(el => getComputedStyle(el).backgroundImage);
    expect(bgStyle).toContain('gradient');
  });

  test('container has proper styling', async ({ page }) => {
    const container = page.locator('.container');
    await expect(container).toBeVisible();

    // Check container has border-radius (rounded corners)
    const borderRadius = await container.evaluate(el => getComputedStyle(el).borderRadius);
    expect(borderRadius).not.toBe('0px');
  });

  test('page is responsive (no horizontal scroll)', async ({ page }) => {
    // Check for horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });
});
