/**
 * Question Generator Service
 * INTV-02: Personalized interview question generation from multiple sources
 *
 * Generates questions from:
 * 1. JD Requirements (source: 'jd-requirement')
 * 2. Profile Gaps (source: 'profile-gap')
 * 3. Profile Strengths (source: 'profile-strength')
 * 4. Company Research (source: 'company-research')
 * 5. Interviewer Style (source: 'interviewer-style')
 *
 * Each question links to suggested STAR stories and talking points.
 */

import { v4 as uuidv4 } from 'uuid'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import { loadProfile } from '../data/profile-loader.js'
import { loadJobsFromDashboard } from '../data/loader.js'
import { getRelevantStories } from './interview-prep.js'
import { extractJobKeywords, matchResumeToJob } from './resume-matcher.js'
import { InterviewQuestionSchema } from '../../../schemas/interview.schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const RESEARCH_DIR = join(DATA_DIR, 'job-research')

// Ensure research directory exists
if (!existsSync(RESEARCH_DIR)) {
  mkdirSync(RESEARCH_DIR, { recursive: true })
}

/**
 * Atomic file write using temp file + rename pattern
 */
function atomicWriteSync(filePath, data) {
  const tempPath = join(tmpdir(), `questions-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`)
  try {
    writeFileSync(tempPath, data, 'utf-8')
    renameSync(tempPath, filePath)
  } catch (err) {
    try { unlinkSync(tempPath) } catch (e) { /* ignore */ }
    throw err
  }
}

// Question category templates
const QUESTION_TEMPLATES = {
  behavioral: [
    'Tell me about a time when you {context}.',
    'Describe a situation where you had to {context}.',
    'Can you share an example of when you {context}?',
    'Walk me through a time when you {context}.'
  ],
  technical: [
    'How would you approach {context}?',
    'Walk me through how you would implement {context}.',
    'What is your experience with {context}?',
    'Can you explain how {context} works and when you have used it?'
  ],
  'system-design': [
    'Design a system that {context}.',
    'How would you architect {context}?',
    'Walk me through how you would scale {context}.',
    'What considerations would you have when building {context}?'
  ],
  'culture-fit': [
    'What is your approach to {context}?',
    'How do you handle {context}?',
    'Tell me about your experience with {context}.',
    'What does {context} mean to you in a work environment?'
  ]
}

// Difficulty mapping based on source
const SOURCE_DIFFICULTY_MAP = {
  'jd-requirement': 'medium',
  'profile-gap': 'hard', // Gaps are weaker areas
  'profile-strength': 'easy', // Strengths are stronger areas
  'company-research': 'medium',
  'interviewer-style': 'medium' // Adjusted by depth expectation
}

/**
 * Load company research for a job if it exists
 *
 * @param {number} jobId - Job ID
 * @returns {object|null} Company research data or null
 */
function loadCompanyResearch(jobId) {
  const jsonPath = join(RESEARCH_DIR, `${jobId}-company.json`)
  if (!existsSync(jsonPath)) {
    return null
  }
  try {
    return JSON.parse(readFileSync(jsonPath, 'utf-8'))
  } catch (e) {
    console.error(`Error loading company research for job ${jobId}:`, e.message)
    return null
  }
}

/**
 * Load interviewer research for a job (all interviewers)
 *
 * @param {number} jobId - Job ID
 * @returns {Array} Array of interviewer research objects
 */
function loadInterviewerResearch(jobId) {
  if (!existsSync(RESEARCH_DIR)) {
    return []
  }

  try {
    const files = require('fs').readdirSync(RESEARCH_DIR)
    const interviewerFiles = files.filter(f =>
      f.startsWith(`${jobId}-interviewer-`) && f.endsWith('.json')
    )

    return interviewerFiles.map(file => {
      try {
        return JSON.parse(readFileSync(join(RESEARCH_DIR, file), 'utf-8'))
      } catch (e) {
        return null
      }
    }).filter(Boolean)
  } catch (e) {
    console.error(`Error loading interviewer research for job ${jobId}:`, e.message)
    return []
  }
}

/**
 * Get a random template for a category
 */
function getTemplate(category) {
  const templates = QUESTION_TEMPLATES[category] || QUESTION_TEMPLATES.behavioral
  return templates[Math.floor(Math.random() * templates.length)]
}

/**
 * Generate a question from a template with context
 */
function generateQuestionText(category, context) {
  const template = getTemplate(category)
  return template.replace('{context}', context)
}

/**
 * Link a question to relevant STAR stories from profile
 *
 * @param {string} questionText - The question text
 * @param {object} profile - Profile data
 * @param {object} [jobContext] - Optional job context for relevance scoring
 * @returns {Array<{ storyId: string, storyTitle: string, relevanceScore: number }>}
 */
export function linkQuestionToStories(questionText, profile, jobContext = {}) {
  if (!profile || !profile.stories || profile.stories.length === 0) {
    return []
  }

  // Extract keywords from question for matching
  const questionLower = questionText.toLowerCase()
  const keywords = questionLower
    .split(/\s+/)
    .filter(w => w.length > 3)
    .filter(w => !['tell', 'about', 'time', 'when', 'describe', 'walk', 'through', 'what', 'your', 'have', 'would', 'that', 'with'].includes(w))

  // Use getRelevantStories with keywords
  const jobContextWithKeywords = {
    ...jobContext,
    keywords: [...(jobContext.keywords || []), ...keywords]
  }

  const rankedStories = getRelevantStories(profile, jobContextWithKeywords)

  // Return top 3 with formatted structure
  return rankedStories.slice(0, 3).map(story => ({
    storyId: story.id,
    storyTitle: story.title,
    relevanceScore: Math.min(100, story.relevanceScore) // Cap at 100
  }))
}

/**
 * Generate interview questions from all sources
 *
 * @param {number} jobId - Job ID to generate questions for
 * @param {object} [options] - Generation options
 * @param {string[]} [options.categories] - Categories to include (default: all)
 * @param {number} [options.count] - Target number of questions (default: 10)
 * @param {string} [options.difficulty] - 'easy'|'medium'|'hard'|'mixed' (default: 'mixed')
 * @returns {{ questions: Array, savedTo: string }}
 */
export function generateInterviewQuestions(jobId, options = {}) {
  const {
    categories = ['behavioral', 'technical', 'system-design', 'culture-fit'],
    count = 10,
    difficulty = 'mixed'
  } = options

  // Load required data
  const profile = loadProfile()
  const jobsData = loadJobsFromDashboard()
  const job = jobsData.jobs?.find(j => j.id === jobId)

  if (!job) {
    return { questions: [], error: `Job ${jobId} not found` }
  }

  const companyResearch = loadCompanyResearch(jobId)
  const interviewerResearch = loadInterviewerResearch(jobId)

  const questions = []
  const generatedAt = new Date().toISOString()

  // 1. JD Requirements - extract keywords and generate technical/behavioral questions
  const jdText = [job.notes, job.company, job.title].filter(Boolean).join(' ')
  const jdKeywords = extractJobKeywords(jdText)

  for (const skill of jdKeywords.skills.slice(0, 3)) {
    if (!categories.includes('technical')) continue
    if (questions.length >= count) break

    const questionText = generateQuestionText('technical', skill)
    const question = {
      id: uuidv4(),
      jobId,
      questionText,
      category: 'technical',
      difficulty: difficulty === 'mixed' ? SOURCE_DIFFICULTY_MAP['jd-requirement'] : difficulty,
      source: 'jd-requirement',
      sourceDetail: `Required skill: ${skill}`,
      suggestedStories: linkQuestionToStories(questionText, profile, { keywords: [skill] }),
      talkingPoints: [],
      generatedAt
    }
    questions.push(question)
  }

  // 2. Profile Gaps - probe weaker areas
  if (categories.includes('technical') || categories.includes('behavioral')) {
    const matchResult = matchResumeToJob(profile, jdText)

    for (const missingSkill of (matchResult.missing || []).slice(0, 2)) {
      if (questions.length >= count) break

      const category = categories.includes('technical') ? 'technical' : 'behavioral'
      const questionText = generateQuestionText(category, `working with ${missingSkill}`)
      const question = {
        id: uuidv4(),
        jobId,
        questionText,
        category,
        difficulty: difficulty === 'mixed' ? 'hard' : difficulty,
        source: 'profile-gap',
        sourceDetail: `Gap: ${missingSkill}`,
        suggestedStories: linkQuestionToStories(questionText, profile),
        talkingPoints: [`Consider: how would you learn ${missingSkill}?`, `Be honest about experience level`],
        generatedAt
      }
      questions.push(question)
    }
  }

  // 3. Profile Strengths - let candidate shine
  if (categories.includes('behavioral')) {
    const relevantStories = getRelevantStories(profile, { company: job.company, title: job.title })

    for (const story of relevantStories.slice(0, 2)) {
      if (questions.length >= count) break

      // Generate question based on story categories
      const storyCategory = (story.questionCategories || [])[0] || 'achievement'
      const context = `demonstrated ${storyCategory.toLowerCase()}`
      const questionText = generateQuestionText('behavioral', context)

      const question = {
        id: uuidv4(),
        jobId,
        questionText,
        category: 'behavioral',
        difficulty: difficulty === 'mixed' ? 'easy' : difficulty,
        source: 'profile-strength',
        sourceDetail: `Strength area: ${storyCategory}`,
        suggestedStories: [{
          storyId: story.id,
          storyTitle: story.title,
          relevanceScore: Math.min(100, story.relevanceScore || 80)
        }],
        talkingPoints: story.themes || [],
        generatedAt
      }
      questions.push(question)
    }
  }

  // 4. Company Research - culture fit questions
  if (companyResearch && categories.includes('culture-fit')) {
    const values = companyResearch.culture?.values || []
    const challenges = companyResearch.challenges || []

    for (const value of values.slice(0, 2)) {
      if (questions.length >= count) break

      const questionText = generateQuestionText('culture-fit', value.toLowerCase())
      const question = {
        id: uuidv4(),
        jobId,
        questionText,
        category: 'culture-fit',
        difficulty: difficulty === 'mixed' ? 'medium' : difficulty,
        source: 'company-research',
        sourceDetail: `Company value: ${value}`,
        suggestedStories: linkQuestionToStories(questionText, profile),
        talkingPoints: companyResearch.highlights?.slice(0, 2) || [],
        generatedAt
      }
      questions.push(question)
    }

    // Add challenge-based question
    if (challenges.length > 0 && questions.length < count) {
      const challenge = challenges[0]
      const questionText = `How would you approach ${challenge.toLowerCase()}?`
      const question = {
        id: uuidv4(),
        jobId,
        questionText,
        category: 'technical',
        difficulty: difficulty === 'mixed' ? 'hard' : difficulty,
        source: 'company-research',
        sourceDetail: `Industry challenge: ${challenge}`,
        suggestedStories: linkQuestionToStories(questionText, profile),
        talkingPoints: [`Research: ${companyResearch.companyName}'s approach to this`],
        generatedAt
      }
      questions.push(question)
    }
  }

  // 5. Interviewer Style - match their expected question types
  for (const interviewer of interviewerResearch) {
    if (questions.length >= count) break

    const expectedTypes = interviewer.interviewStyle?.expectedQuestionTypes || []
    const depthExpectation = interviewer.interviewStyle?.depthExpectation || 'moderate'

    // Map depth to difficulty
    const depthToDifficulty = {
      'surface': 'easy',
      'moderate': 'medium',
      'deep': 'hard'
    }

    for (const qType of expectedTypes.slice(0, 1)) {
      if (questions.length >= count) break
      if (!categories.includes(qType)) continue

      // Generate question matching interviewer style
      const context = qType === 'behavioral' ? 'handled a challenging situation' :
                     qType === 'technical' ? 'solving a complex problem' :
                     qType === 'system-design' ? 'scaling a system' :
                     'working collaboratively'

      const questionText = generateQuestionText(qType, context)
      const question = {
        id: uuidv4(),
        jobId,
        questionText,
        category: qType,
        difficulty: difficulty === 'mixed' ? depthToDifficulty[depthExpectation] : difficulty,
        source: 'interviewer-style',
        sourceDetail: `Interviewer: ${interviewer.interviewerName}`,
        suggestedStories: linkQuestionToStories(questionText, profile),
        talkingPoints: interviewer.talkingPoints?.slice(0, 2) || [],
        generatedAt,
        interviewerId: interviewer.id
      }
      questions.push(question)
    }
  }

  // Fill remaining with general questions if needed
  const generalContexts = {
    behavioral: ['faced a difficult deadline', 'dealt with ambiguity', 'received critical feedback', 'mentored a colleague'],
    technical: ['optimizing performance', 'debugging a complex issue', 'choosing between technologies', 'refactoring legacy code'],
    'system-design': ['handling high traffic', 'ensuring data consistency', 'building for reliability', 'designing for scale'],
    'culture-fit': ['collaboration', 'continuous learning', 'giving and receiving feedback', 'work-life balance']
  }

  while (questions.length < count) {
    const category = categories[questions.length % categories.length]
    const contexts = generalContexts[category] || generalContexts.behavioral
    const context = contexts[questions.length % contexts.length]

    const questionText = generateQuestionText(category, context)
    const question = {
      id: uuidv4(),
      jobId,
      questionText,
      category,
      difficulty: difficulty === 'mixed' ? ['easy', 'medium', 'hard'][questions.length % 3] : difficulty,
      source: 'jd-requirement', // Default source for general questions
      sourceDetail: 'General interview question',
      suggestedStories: linkQuestionToStories(questionText, profile),
      talkingPoints: [],
      generatedAt
    }
    questions.push(question)
  }

  // Filter by difficulty if not mixed
  let finalQuestions = questions
  if (difficulty !== 'mixed') {
    finalQuestions = questions.filter(q => q.difficulty === difficulty)
    // If too few, include all
    if (finalQuestions.length < Math.ceil(count / 2)) {
      finalQuestions = questions
    }
  }

  // Limit to requested count
  finalQuestions = finalQuestions.slice(0, count)

  // Save to file
  const questionsFile = {
    jobId,
    generatedAt,
    options: { categories, count, difficulty },
    questions: finalQuestions
  }

  const savePath = join(RESEARCH_DIR, `${jobId}-questions.json`)
  atomicWriteSync(savePath, JSON.stringify(questionsFile, null, 2))

  return {
    questions: finalQuestions,
    savedTo: savePath
  }
}

/**
 * Get previously generated questions for a job
 *
 * @param {number} jobId - Job ID
 * @returns {object|null} Questions data or null if not generated
 */
export function getQuestionsForJob(jobId) {
  const questionsPath = join(RESEARCH_DIR, `${jobId}-questions.json`)

  if (!existsSync(questionsPath)) {
    return null
  }

  try {
    return JSON.parse(readFileSync(questionsPath, 'utf-8'))
  } catch (e) {
    console.error(`Error loading questions for job ${jobId}:`, e.message)
    return null
  }
}
