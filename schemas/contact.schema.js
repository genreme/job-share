/**
 * Contact Schema - Zod validation for enhanced contact tracking
 *
 * Supports structured contact entries with LinkedIn URLs, interaction history,
 * and backward compatibility with legacy string-format connections.
 */

import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'

// Interaction types for contact tracking
export const InteractionTypeSchema = z.enum([
  'email',
  'linkedin',
  'call',
  'meeting',
  'other'
])

// Contact roles enum
export const ContactRoleSchema = z.enum([
  'recruiter',
  'hiring_manager',
  'referral',
  'internal_contact',
  'other'
])

/**
 * ContactInteractionSchema - For tracking interactions with a contact
 * APPL-04: Track last interaction date and type
 */
export const ContactInteractionSchema = z.object({
  date: z.string().min(1, 'Date is required'), // ISO date string
  type: InteractionTypeSchema,
  notes: z.string().optional()
})

/**
 * EnhancedConnectionSchema - Full structured contact
 * APPL-03: Contact tracking per job (name, title, role)
 * APPL-04: LinkedIn URL and last interaction
 */
export const EnhancedConnectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  role: ContactRoleSchema,
  title: z.string().optional(),           // "Senior Technical Recruiter"
  company: z.string().optional(),          // For external recruiters
  linkedInUrl: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  notes: z.string().optional(),
  isPrimary: z.boolean().default(false),
  reachedOut: z.boolean().default(false),
  lastInteraction: ContactInteractionSchema.optional(),  // APPL-04
  interactions: z.array(ContactInteractionSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string()
})

/**
 * ConnectionSchema - Union for backward compatibility
 * Accepts either legacy string format or enhanced object
 */
export const ConnectionSchema = z.union([
  z.string(),  // Legacy: "Name (notes)"
  EnhancedConnectionSchema
])

/**
 * Parse legacy connection string into structured format
 * Handles: "Name", "Name (notes)", "Name (role)", "Name ()"
 *
 * @param {string} str - Legacy connection string
 * @returns {{ name: string, notes?: string, legacy: true }}
 */
export function parseLegacyConnection(str) {
  if (!str || typeof str !== 'string') {
    return { name: '', notes: '', legacy: true }
  }

  const trimmed = str.trim()

  // Match "Name (notes)" pattern - notes can be empty
  const match = trimmed.match(/^([^(]+?)(?:\s*\((.*)\))?$/)

  if (match) {
    return {
      name: match[1].trim(),
      notes: match[2]?.trim() || '',
      legacy: true
    }
  }

  // Fallback - entire string is the name
  return {
    name: trimmed,
    notes: '',
    legacy: true
  }
}

/**
 * Validate a contact object
 *
 * @param {object} contact - Contact data to validate
 * @returns {{ valid: boolean, errors: Array, data?: object }}
 */
export function validateContact(contact) {
  const result = EnhancedConnectionSchema.safeParse(contact)

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      })),
      data: null
    }
  }

  return {
    valid: true,
    errors: [],
    data: result.data
  }
}

/**
 * Validate a contact interaction
 *
 * @param {object} interaction - Interaction data to validate
 * @returns {{ valid: boolean, errors: Array, data?: object }}
 */
export function validateInteraction(interaction) {
  const result = ContactInteractionSchema.safeParse(interaction)

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      })),
      data: null
    }
  }

  return {
    valid: true,
    errors: [],
    data: result.data
  }
}

/**
 * Create a new contact with generated UUID and timestamps
 *
 * @param {object} contactData - Contact data (name, role required)
 * @returns {object} Full contact object with id, timestamps
 */
export function createContact(contactData) {
  const now = new Date().toISOString()

  return {
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
    lastInteraction: contactData.lastInteraction || undefined,
    interactions: contactData.interactions || [],
    createdAt: now,
    updatedAt: now
  }
}
