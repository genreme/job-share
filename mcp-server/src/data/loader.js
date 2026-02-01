/**
 * Data Loader - Reads from dashboard HTML and resume JSON files
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, renameSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { validateJobsData } from '../../../schemas/job.schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const RESUME_ROOT = '/Users/genre/Claude/resume';
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
 * Load jobs data from the extracted JSON file
 * Run `node extract-jobs.js` to refresh data from index.html
 */
export function loadJobsFromDashboard() {
  const jsonPath = join(PROJECT_ROOT, 'mcp-server', 'data', 'jobs.json');

  if (!existsSync(jsonPath)) {
    console.error('Jobs JSON not found. Run: cd mcp-server && node extract-jobs.js');
    return { jobs: [], searchHistory: [], settings: {} };
  }

  try {
    const content = readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(content);
    // Validate loaded data
    const validation = validateJobsData(data);
    if (!validation.valid) {
      console.error('Jobs data validation warnings:', validation.errors);
    }
    // Use validated data (with defaults applied)
    const validatedData = validation.data;
    console.error(`Loaded ${validatedData.jobs?.length || 0} jobs from jobs.json`);
    return validatedData;
  } catch (e) {
    console.error('Error loading jobs.json:', e.message);
    return { jobs: [], searchHistory: [], settings: {} };
  }
}

/**
 * Write jobs data back to JSON file (atomic)
 * @param {object} data - Jobs data object to save
 */
export function writeJobsData(data) {
  data.lastUpdated = new Date().toISOString();
  data.version = (data.version || 0) + 1;
  atomicWriteSync(JOBS_JSON_PATH, JSON.stringify(data, null, 2));
}

/**
 * Load resume data from JSON file
 */
export function loadResumeData() {
  const resumePath = join(RESUME_ROOT, 'resume generator - claude', 'resume_data_v9_1.json');

  if (!existsSync(resumePath)) {
    console.error('Resume data not found at:', resumePath);
    return null;
  }

  try {
    const content = readFileSync(resumePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error('Error loading resume data:', e.message);
    return null;
  }
}

/**
 * Load cover letter template data
 */
export function loadCoverLetterData() {
  const clPath = join(RESUME_ROOT, 'cover letter generator - claude', 'cover_letter_data.json');

  if (!existsSync(clPath)) {
    console.error('Cover letter data not found at:', clPath);
    return null;
  }

  try {
    const content = readFileSync(clPath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error('Error loading cover letter data:', e.message);
    return null;
  }
}

/**
 * Load learning data (fit feedback, patterns, etc.)
 */
export function loadLearningData() {
  const learningPath = join(PROJECT_ROOT, 'mcp-server', 'data', 'learning.json');

  if (!existsSync(learningPath)) {
    // Return empty structure if file doesn't exist yet
    return {
      fit_feedback: [],
      presentation_insights: [],
      interview_patterns: [],
      evolution_log: [],
      chat_insights: []
    };
  }

  try {
    const content = readFileSync(learningPath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error('Error loading learning data:', e.message);
    return {
      fit_feedback: [],
      presentation_insights: [],
      interview_patterns: [],
      evolution_log: [],
      chat_insights: []
    };
  }
}

/**
 * Save learning data
 */
export function saveLearningData(data) {
  const learningPath = join(PROJECT_ROOT, 'mcp-server', 'data', 'learning.json');

  try {
    writeFileSync(learningPath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('Error saving learning data:', e.message);
    return false;
  }
}

/**
 * Get list of generated resume/cover letter PDFs
 */
export function getGeneratedDocuments() {
  const documents = [];

  try {
    const files = readdirSync(RESUME_ROOT);

    for (const file of files) {
      if (file.endsWith('.pdf')) {
        const filePath = join(RESUME_ROOT, file);
        const stats = statSync(filePath);

        // Parse filename to extract company/type
        // Format: "John Ra Resume - Company Name.pdf" or "John Ra Cover Letter - Company.pdf"
        const isResume = file.toLowerCase().includes('resume');
        const isCoverLetter = file.toLowerCase().includes('cover');

        const companyMatch = file.match(/[-–]\s*(.+?)\.pdf$/i);
        const company = companyMatch ? companyMatch[1].trim() : 'Unknown';

        documents.push({
          filename: file,
          path: filePath,
          type: isResume ? 'resume' : (isCoverLetter ? 'cover_letter' : 'other'),
          company: company,
          created: stats.mtime.toISOString(),
          size: stats.size
        });
      }
    }
  } catch (e) {
    console.error('Error listing documents:', e.message);
  }

  return documents.sort((a, b) => new Date(b.created) - new Date(a.created));
}
