/**
 * Update Tools - Write job data back to the dashboard
 *
 * These tools allow Claude Chat to modify job data in the dashboard,
 * enabling two-way sync between research sessions and the command center.
 *
 * Data is stored in mcp-server/data/jobs.json
 * After updates, user should refresh the dashboard to see changes.
 */

import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { validateStatusTransition } from '../../../schemas/workflow.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const JOBS_JSON_PATH = join(PROJECT_ROOT, 'mcp-server', 'data', 'jobs.json');

/**
 * Atomic file write using temp file + rename pattern
 * Prevents data corruption if process crashes mid-write
 */
function atomicWriteSync(filePath, data) {
  const tempPath = join(tmpdir(), `jscc-mcp-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  try {
    writeFileSync(tempPath, data, 'utf-8');
    renameSync(tempPath, filePath);
  } catch (err) {
    // Clean up temp file if rename failed
    try { unlinkSync(tempPath); } catch (e) { /* ignore */ }
    throw err;
  }
}

/**
 * Read job data from JSON file
 */
function readJobsData() {
  if (!existsSync(JOBS_JSON_PATH)) {
    throw new Error('Jobs data not found. Run: cd mcp-server && node extract-jobs.js');
  }

  try {
    const content = readFileSync(JOBS_JSON_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`Failed to read jobs data: ${e.message}`);
  }
}

/**
 * Write updated data back to JSON file (atomic)
 */
function writeJobsData(data) {
  data.lastUpdated = new Date().toISOString();
  data.version = (data.version || 0) + 1;
  atomicWriteSync(JOBS_JSON_PATH, JSON.stringify(data, null, 2));
}

/**
 * Update a job's fields
 * @param {number} jobId - The job ID to update
 * @param {object} updates - Object with field:value pairs to update
 * @returns {object} Result with updated job
 */
export function updateJob(jobId, updates) {
  const data = readJobsData();

  const jobIndex = data.jobs.findIndex(j => j.id === jobId);
  if (jobIndex === -1) {
    return { error: `Job with ID ${jobId} not found` };
  }

  const job = data.jobs[jobIndex];

  // Validate status transition if status is being changed
  if (updates.status && job.status !== updates.status) {
    const transitionValidation = validateStatusTransition(job.status, updates.status);
    if (!transitionValidation.valid) {
      return { error: transitionValidation.error };
    }
  }

  const changedFields = [];

  // Track what changed for the update log
  for (const [field, value] of Object.entries(updates)) {
    if (job[field] !== value) {
      changedFields.push({
        field,
        oldValue: job[field],
        newValue: value
      });
      job[field] = value;
    }
  }

  if (changedFields.length === 0) {
    return {
      success: true,
      message: 'No changes needed',
      job
    };
  }

  // Add update entry to job's history
  if (!job.updates) {
    job.updates = [];
  }

  job.updates.push({
    date: new Date().toISOString().split('T')[0],
    type: 'MCP Update',
    notes: `Updated: ${changedFields.map(c => c.field).join(', ')}`
  });

  // Write back
  writeJobsData(data);

  return {
    success: true,
    jobId,
    changedFields,
    job: data.jobs[jobIndex]
  };
}

/**
 * Archive a job (set status to 'archived')
 * @param {number} jobId - The job ID to archive
 * @param {string} reason - Reason for archiving (e.g., "Posting closed")
 * @returns {object} Result
 */
export function archiveJob(jobId, reason) {
  const data = readJobsData();

  const jobIndex = data.jobs.findIndex(j => j.id === jobId);
  if (jobIndex === -1) {
    return { error: `Job with ID ${jobId} not found` };
  }

  const job = data.jobs[jobIndex];

  if (job.status === 'archived') {
    return {
      success: true,
      message: 'Job already archived',
      job
    };
  }

  // Validate status transition to archived
  const transitionValidation = validateStatusTransition(job.status, 'archived');
  if (!transitionValidation.valid) {
    return { error: transitionValidation.error };
  }

  const previousStatus = job.status;
  job.status = 'archived';

  // Add update entry
  if (!job.updates) {
    job.updates = [];
  }

  job.updates.push({
    date: new Date().toISOString().split('T')[0],
    type: 'Archived',
    notes: reason || 'Archived via MCP'
  });

  // Write back
  writeJobsData(data);

  return {
    success: true,
    jobId,
    previousStatus,
    reason,
    job: data.jobs[jobIndex]
  };
}

/**
 * Archive multiple jobs at once
 * @param {number[]} jobIds - Array of job IDs to archive
 * @param {string} reason - Reason for archiving
 * @returns {object} Result with count
 */
export function archiveJobs(jobIds, reason) {
  const data = readJobsData();

  const results = [];
  let archivedCount = 0;

  for (const jobId of jobIds) {
    const jobIndex = data.jobs.findIndex(j => j.id === jobId);
    if (jobIndex === -1) {
      results.push({ jobId, error: 'Not found' });
      continue;
    }

    const job = data.jobs[jobIndex];

    if (job.status === 'archived') {
      results.push({ jobId, status: 'already archived' });
      continue;
    }

    // Validate status transition to archived
    const transitionValidation = validateStatusTransition(job.status, 'archived');
    if (!transitionValidation.valid) {
      results.push({ jobId, error: transitionValidation.error });
      continue;
    }

    job.status = 'archived';

    if (!job.updates) {
      job.updates = [];
    }

    job.updates.push({
      date: new Date().toISOString().split('T')[0],
      type: 'Archived',
      notes: reason || 'Bulk archived via MCP'
    });

    archivedCount++;
    results.push({ jobId, status: 'archived', company: job.company });
  }

  // Write back
  writeJobsData(data);

  return {
    success: true,
    archivedCount,
    totalRequested: jobIds.length,
    results
  };
}

/**
 * Set hiring manager info for a job
 * @param {number} jobId - The job ID
 * @param {object} manager - Hiring manager info {name, title, linkedin, notes}
 * @returns {object} Result
 */
export function setHiringManager(jobId, manager) {
  const data = readJobsData();

  const jobIndex = data.jobs.findIndex(j => j.id === jobId);
  if (jobIndex === -1) {
    return { error: `Job with ID ${jobId} not found` };
  }

  const job = data.jobs[jobIndex];

  // Store hiring manager info
  job.hiringManager = {
    name: manager.name,
    title: manager.title || null,
    linkedin: manager.linkedin || null,
    notes: manager.notes || null,
    foundDate: new Date().toISOString().split('T')[0]
  };

  // Also add to connections if not already there
  if (!job.connections) {
    job.connections = [];
  }

  const existingConnection = job.connections.find(c =>
    c.toLowerCase().includes(manager.name.toLowerCase())
  );

  if (!existingConnection) {
    job.connections.push(`Hiring Manager: ${manager.name}${manager.title ? ` (${manager.title})` : ''}`);
  }

  // Add update entry
  if (!job.updates) {
    job.updates = [];
  }

  job.updates.push({
    date: new Date().toISOString().split('T')[0],
    type: 'Hiring Manager Found',
    notes: `${manager.name}${manager.title ? ` - ${manager.title}` : ''}`
  });

  // Write back
  writeJobsData(data);

  return {
    success: true,
    jobId,
    hiringManager: job.hiringManager,
    job: data.jobs[jobIndex]
  };
}

/**
 * Add a note/update entry to a job's history
 * @param {number} jobId - The job ID
 * @param {string} type - Update type (e.g., "Research", "Status Check", "Interview")
 * @param {string} notes - The note content
 * @returns {object} Result
 */
export function addJobNote(jobId, type, notes) {
  const data = readJobsData();

  const jobIndex = data.jobs.findIndex(j => j.id === jobId);
  if (jobIndex === -1) {
    return { error: `Job with ID ${jobId} not found` };
  }

  const job = data.jobs[jobIndex];

  if (!job.updates) {
    job.updates = [];
  }

  const entry = {
    date: new Date().toISOString().split('T')[0],
    type: type || 'Note',
    notes: notes
  };

  job.updates.push(entry);

  // Write back
  writeJobsData(data);

  return {
    success: true,
    jobId,
    entry,
    totalUpdates: job.updates.length
  };
}

/**
 * Bulk update multiple jobs at once
 * @param {Array} updates - Array of {jobId, updates} objects
 * @returns {object} Result with counts
 */
export function bulkUpdateJobs(updates) {
  const data = readJobsData();

  const results = [];
  let successCount = 0;

  for (const { jobId, updates: jobUpdates } of updates) {
    const jobIndex = data.jobs.findIndex(j => j.id === jobId);
    if (jobIndex === -1) {
      results.push({ jobId, error: 'Not found' });
      continue;
    }

    const job = data.jobs[jobIndex];

    // Validate status transition if status is being changed
    if (jobUpdates.status && job.status !== jobUpdates.status) {
      const transitionValidation = validateStatusTransition(job.status, jobUpdates.status);
      if (!transitionValidation.valid) {
        results.push({ jobId, error: transitionValidation.error });
        continue;
      }
    }

    const changedFields = [];

    for (const [field, value] of Object.entries(jobUpdates)) {
      if (job[field] !== value) {
        changedFields.push(field);
        job[field] = value;
      }
    }

    if (changedFields.length > 0) {
      if (!job.updates) {
        job.updates = [];
      }

      job.updates.push({
        date: new Date().toISOString().split('T')[0],
        type: 'Bulk Update',
        notes: `Updated: ${changedFields.join(', ')}`
      });

      successCount++;
      results.push({ jobId, company: job.company, changedFields });
    } else {
      results.push({ jobId, status: 'no changes' });
    }
  }

  // Write back
  writeJobsData(data);

  return {
    success: true,
    updatedCount: successCount,
    totalRequested: updates.length,
    results
  };
}
