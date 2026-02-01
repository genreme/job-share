/**
 * Contact Management MCP Tools
 *
 * Tools for managing contacts (recruiters, hiring managers, etc.) associated with jobs,
 * logging interactions, and adding comprehensive job updates.
 *
 * APPL-03: Contact tracking per job
 * APPL-04: Contact includes name, title, LinkedIn URL, last interaction
 * APPL-07: User can add notes and updates to any job entry
 */

import { v4 as uuidv4 } from 'uuid'
import { loadJobsFromDashboard, writeJobsData } from '../data/loader.js'
import {
  EnhancedConnectionSchema,
  ContactInteractionSchema,
  parseLegacyConnection,
  validateContact,
  validateInteraction
} from '../../../schemas/contact.schema.js'
import { isValidTransition } from '../../../schemas/job.schema.js'

/**
 * Add or update a contact for a job
 * APPL-03, APPL-04
 *
 * @param {number} jobId - The job ID
 * @param {object} contactData - Contact data (name required, role, title, linkedInUrl, etc.)
 * @returns {{ success: boolean, action: 'added'|'updated', contact: object } | { error: string }}
 */
export function addJobContact(jobId, contactData) {
  // Validate required fields
  if (!contactData || !contactData.name) {
    return { error: 'Contact name is required' }
  }

  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job with ID ${jobId} not found` }
  }

  // Initialize connections array if needed
  if (!job.connections) {
    job.connections = []
  }

  const now = new Date().toISOString()

  // Check for duplicate by name (case-insensitive) or linkedInUrl
  const existingIndex = job.connections.findIndex(c => {
    if (typeof c === 'string') return false
    const nameMatch = c.name?.toLowerCase() === contactData.name.toLowerCase()
    const linkedInMatch = contactData.linkedInUrl &&
      c.linkedInUrl &&
      c.linkedInUrl === contactData.linkedInUrl
    return nameMatch || linkedInMatch
  })

  if (existingIndex !== -1) {
    // Update existing contact
    const existing = job.connections[existingIndex]
    job.connections[existingIndex] = {
      ...existing,
      ...contactData,
      id: existing.id, // Preserve original ID
      createdAt: existing.createdAt, // Preserve original creation time
      updatedAt: now
    }

    writeJobsData(data)
    return {
      success: true,
      action: 'updated',
      contact: job.connections[existingIndex]
    }
  }

  // Create new contact
  const newContact = {
    id: uuidv4(),
    name: contactData.name,
    role: contactData.role || 'other',
    title: contactData.title || '',
    company: contactData.company || '',
    linkedInUrl: contactData.linkedInUrl || '',
    email: contactData.email || '',
    phone: contactData.phone || '',
    notes: contactData.notes || '',
    isPrimary: contactData.isPrimary || false,
    reachedOut: contactData.reachedOut || false,
    interactions: [],
    createdAt: now,
    updatedAt: now
  }

  // Validate the new contact
  const validation = validateContact(newContact)
  if (!validation.valid) {
    return {
      error: `Invalid contact data: ${validation.errors.map(e => e.message).join(', ')}`
    }
  }

  job.connections.push(newContact)

  // Add update entry to job history
  if (!job.updates) {
    job.updates = []
  }
  job.updates.push({
    date: now.split('T')[0],
    type: 'Contact Added',
    notes: `${newContact.name} (${newContact.role})`
  })

  writeJobsData(data)

  return {
    success: true,
    action: 'added',
    contact: newContact
  }
}

/**
 * Log an interaction with a contact
 * APPL-04: Track interactions and update lastInteraction
 *
 * @param {number} jobId - The job ID
 * @param {string} contactId - The contact's UUID
 * @param {object} interaction - { type: 'email'|'linkedin'|'call'|'meeting'|'other', notes?: string }
 * @returns {{ success: boolean, contact: object, interaction: object } | { error: string }}
 */
export function logContactInteraction(jobId, contactId, interaction) {
  if (!contactId) {
    return { error: 'Contact ID is required' }
  }

  if (!interaction || !interaction.type) {
    return { error: 'Interaction type is required' }
  }

  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job with ID ${jobId} not found` }
  }

  // Find the contact by UUID
  const contact = job.connections?.find(c =>
    typeof c === 'object' && c.id === contactId
  )

  if (!contact) {
    return { error: `Contact with ID ${contactId} not found` }
  }

  const now = new Date().toISOString()

  // Create the interaction entry
  const interactionEntry = {
    date: now,
    type: interaction.type,
    notes: interaction.notes || ''
  }

  // Validate interaction
  const validation = validateInteraction(interactionEntry)
  if (!validation.valid) {
    return {
      error: `Invalid interaction: ${validation.errors.map(e => e.message).join(', ')}`
    }
  }

  // Add to interactions array
  if (!contact.interactions) {
    contact.interactions = []
  }
  contact.interactions.push(interactionEntry)

  // Update lastInteraction
  contact.lastInteraction = interactionEntry
  contact.reachedOut = true
  contact.updatedAt = now

  writeJobsData(data)

  return {
    success: true,
    contact,
    interaction: interactionEntry
  }
}

/**
 * Get all contacts for a job
 * Returns structured contacts and parsed legacy contacts separately
 *
 * @param {number} jobId - The job ID
 * @returns {{ jobId, title, company, totalContacts, structuredContacts, legacyContacts, hasUncontacted } | { error: string }}
 */
export function getJobContacts(jobId) {
  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job with ID ${jobId} not found` }
  }

  const structuredContacts = []
  const legacyContacts = []

  for (const c of job.connections || []) {
    if (typeof c === 'string') {
      // Parse legacy format
      const parsed = parseLegacyConnection(c)
      legacyContacts.push({
        ...parsed,
        originalValue: c,
        suggestion: 'Convert to structured format for full tracking'
      })
    } else {
      structuredContacts.push(c)
    }
  }

  return {
    jobId,
    title: job.title,
    company: job.company,
    totalContacts: structuredContacts.length + legacyContacts.length,
    structuredContacts,
    legacyContacts,
    hasUncontacted: structuredContacts.some(c => !c.reachedOut)
  }
}

/**
 * Add a comprehensive update to a job
 * APPL-07: User can add notes, connections, and status changes
 *
 * @param {number} jobId - The job ID
 * @param {object} update - { note?, type?, connection?, status?, appendToNotes? }
 * @returns {{ success: boolean, jobId: number, changes: string[] } | { error: string }}
 */
export function addJobUpdate(jobId, update) {
  if (!update || typeof update !== 'object') {
    return { error: 'Update object is required' }
  }

  const data = loadJobsFromDashboard()
  const job = data.jobs.find(j => j.id === jobId)

  if (!job) {
    return { error: `Job with ID ${jobId} not found` }
  }

  const changes = []
  const now = new Date().toISOString()

  // Add note if provided
  if (update.note) {
    if (!job.updates) {
      job.updates = []
    }

    job.updates.push({
      date: now.split('T')[0],
      timestamp: now,
      type: update.type || 'Note',
      notes: update.note
    })
    changes.push('note added')
  }

  // Add connection if provided
  if (update.connection) {
    // Re-load data after potential write from addJobContact
    const contactResult = addJobContact(jobId, update.connection)
    if (contactResult.success) {
      changes.push(`contact ${contactResult.action}: ${update.connection.name}`)
    } else {
      return { error: contactResult.error }
    }
    // Reload data since addJobContact wrote it
    const refreshedData = loadJobsFromDashboard()
    const refreshedJob = refreshedData.jobs.find(j => j.id === jobId)
    Object.assign(job, refreshedJob)
    Object.assign(data, refreshedData)
  }

  // Update status if provided
  if (update.status && job.status !== update.status) {
    // Validate status transition
    if (!isValidTransition(job.status, update.status)) {
      return {
        error: `Cannot transition from '${job.status}' to '${update.status}'`
      }
    }

    const previousStatus = job.status
    job.status = update.status

    // Set applied date if transitioning to applied
    if (update.status === 'applied' && !job.applied) {
      job.applied = now.split('T')[0]
    }

    if (!job.updates) {
      job.updates = []
    }
    job.updates.push({
      date: now.split('T')[0],
      type: 'Status Change',
      notes: `${previousStatus} -> ${update.status}`
    })

    changes.push(`status: ${previousStatus} -> ${update.status}`)
  }

  // Append to notes field if provided
  if (update.appendToNotes) {
    const timestamp = now.split('T')[0]
    const separator = job.notes ? '\n\n' : ''
    job.notes = `${job.notes || ''}${separator}[${timestamp}] ${update.appendToNotes}`
    changes.push('notes appended')
  }

  // Only write if we made changes (and connection wasn't the only change - it already wrote)
  if (changes.length > 0 && !changes.every(c => c.startsWith('contact'))) {
    writeJobsData(data)
  }

  return {
    success: true,
    jobId,
    changes
  }
}
