/**
 * Contact Schema Tests
 *
 * Tests Zod schema validation for enhanced contact tracking.
 */

import { describe, it, expect } from 'vitest'
import {
  EnhancedConnectionSchema,
  ContactInteractionSchema,
  ConnectionSchema,
  ContactRoleSchema,
  InteractionTypeSchema,
  parseLegacyConnection,
  validateContact,
  validateInteraction,
  createContact
} from './contact.schema.js'

describe('InteractionTypeSchema', () => {
  it('accepts all valid interaction types', () => {
    const validTypes = ['email', 'linkedin', 'call', 'meeting', 'other']

    for (const type of validTypes) {
      const result = InteractionTypeSchema.safeParse(type)
      expect(result.success, `Type "${type}" should be valid`).toBe(true)
    }
  })

  it('rejects invalid interaction types', () => {
    const invalidTypes = ['text', 'sms', 'chat', 'zoom', '']

    for (const type of invalidTypes) {
      const result = InteractionTypeSchema.safeParse(type)
      expect(result.success, `Type "${type}" should be invalid`).toBe(false)
    }
  })
})

describe('ContactRoleSchema', () => {
  it('accepts all valid contact roles', () => {
    const validRoles = ['recruiter', 'hiring_manager', 'referral', 'internal_contact', 'other']

    for (const role of validRoles) {
      const result = ContactRoleSchema.safeParse(role)
      expect(result.success, `Role "${role}" should be valid`).toBe(true)
    }
  })

  it('rejects invalid contact roles', () => {
    const invalidRoles = ['manager', 'ceo', 'hr', 'employee', '']

    for (const role of invalidRoles) {
      const result = ContactRoleSchema.safeParse(role)
      expect(result.success, `Role "${role}" should be invalid`).toBe(false)
    }
  })
})

describe('ContactInteractionSchema', () => {
  it('validates a complete interaction', () => {
    const interaction = {
      date: '2026-02-01T10:00:00.000Z',
      type: 'email',
      notes: 'Sent follow-up email about application'
    }

    const result = ContactInteractionSchema.safeParse(interaction)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(interaction)
  })

  it('validates interaction without notes (optional)', () => {
    const interaction = {
      date: '2026-02-01',
      type: 'call'
    }

    const result = ContactInteractionSchema.safeParse(interaction)
    expect(result.success).toBe(true)
  })

  it('rejects interaction with invalid type', () => {
    const interaction = {
      date: '2026-02-01',
      type: 'text_message'
    }

    const result = ContactInteractionSchema.safeParse(interaction)
    expect(result.success).toBe(false)
    expect(result.error.issues[0].path).toContain('type')
  })

  it('rejects interaction with missing date', () => {
    const interaction = {
      type: 'email',
      notes: 'Test'
    }

    const result = ContactInteractionSchema.safeParse(interaction)
    expect(result.success).toBe(false)
  })

  it('rejects interaction with empty date', () => {
    const interaction = {
      date: '',
      type: 'email'
    }

    const result = ContactInteractionSchema.safeParse(interaction)
    expect(result.success).toBe(false)
  })
})

describe('EnhancedConnectionSchema', () => {
  const validFullContact = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Jane Smith',
    role: 'recruiter',
    title: 'Senior Technical Recruiter',
    company: 'TalentCorp',
    linkedInUrl: 'https://linkedin.com/in/janesmith',
    email: 'jane@talentcorp.com',
    phone: '+1-555-0123',
    notes: 'Very responsive',
    isPrimary: true,
    reachedOut: true,
    lastInteraction: {
      date: '2026-01-30T14:00:00.000Z',
      type: 'email',
      notes: 'Discussed role requirements'
    },
    interactions: [
      {
        date: '2026-01-28T10:00:00.000Z',
        type: 'linkedin',
        notes: 'Initial connection'
      },
      {
        date: '2026-01-30T14:00:00.000Z',
        type: 'email',
        notes: 'Discussed role requirements'
      }
    ],
    createdAt: '2026-01-28T09:00:00.000Z',
    updatedAt: '2026-01-30T14:00:00.000Z'
  }

  const validMinimalContact = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'John Doe',
    role: 'hiring_manager',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z'
  }

  describe('valid contacts', () => {
    it('validates a complete contact with all fields', () => {
      const result = EnhancedConnectionSchema.safeParse(validFullContact)
      expect(result.success).toBe(true)
      expect(result.data.name).toBe('Jane Smith')
      expect(result.data.role).toBe('recruiter')
      expect(result.data.linkedInUrl).toBe('https://linkedin.com/in/janesmith')
    })

    it('validates a minimal contact (name + role + timestamps)', () => {
      const result = EnhancedConnectionSchema.safeParse(validMinimalContact)
      expect(result.success).toBe(true)
      expect(result.data.name).toBe('John Doe')
      expect(result.data.role).toBe('hiring_manager')
    })

    it('applies defaults for isPrimary and reachedOut', () => {
      const result = EnhancedConnectionSchema.safeParse(validMinimalContact)
      expect(result.success).toBe(true)
      expect(result.data.isPrimary).toBe(false)
      expect(result.data.reachedOut).toBe(false)
      expect(result.data.interactions).toEqual([])
    })

    it('accepts all valid roles', () => {
      const roles = ['recruiter', 'hiring_manager', 'referral', 'internal_contact', 'other']

      for (const role of roles) {
        const contact = { ...validMinimalContact, role }
        const result = EnhancedConnectionSchema.safeParse(contact)
        expect(result.success, `Role "${role}" should be valid`).toBe(true)
      }
    })

    it('accepts empty string for optional URL fields', () => {
      const contact = {
        ...validMinimalContact,
        linkedInUrl: '',
        email: ''
      }

      const result = EnhancedConnectionSchema.safeParse(contact)
      expect(result.success).toBe(true)
    })
  })

  describe('invalid contacts', () => {
    it('rejects contact with missing name', () => {
      const contact = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        role: 'recruiter',
        createdAt: '2026-02-01T10:00:00.000Z',
        updatedAt: '2026-02-01T10:00:00.000Z'
      }

      const result = EnhancedConnectionSchema.safeParse(contact)
      expect(result.success).toBe(false)
      const errorPaths = result.error.issues.map(i => i.path[0])
      expect(errorPaths).toContain('name')
    })

    it('rejects contact with empty name', () => {
      const contact = {
        ...validMinimalContact,
        name: ''
      }

      const result = EnhancedConnectionSchema.safeParse(contact)
      expect(result.success).toBe(false)
    })

    it('rejects contact with invalid role', () => {
      const contact = {
        ...validMinimalContact,
        role: 'ceo'
      }

      const result = EnhancedConnectionSchema.safeParse(contact)
      expect(result.success).toBe(false)
      expect(result.error.issues[0].path).toContain('role')
    })

    it('rejects contact with invalid LinkedIn URL', () => {
      const contact = {
        ...validMinimalContact,
        linkedInUrl: 'not-a-url'
      }

      const result = EnhancedConnectionSchema.safeParse(contact)
      expect(result.success).toBe(false)
    })

    it('rejects contact with invalid email', () => {
      const contact = {
        ...validMinimalContact,
        email: 'invalid-email'
      }

      const result = EnhancedConnectionSchema.safeParse(contact)
      expect(result.success).toBe(false)
    })

    it('rejects contact with invalid UUID', () => {
      const contact = {
        ...validMinimalContact,
        id: 'not-a-uuid'
      }

      const result = EnhancedConnectionSchema.safeParse(contact)
      expect(result.success).toBe(false)
    })

    it('rejects contact with missing timestamps', () => {
      const contact = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        name: 'Test',
        role: 'other'
        // Missing createdAt and updatedAt
      }

      const result = EnhancedConnectionSchema.safeParse(contact)
      expect(result.success).toBe(false)
    })
  })
})

describe('ConnectionSchema (union)', () => {
  it('accepts legacy string format', () => {
    const result = ConnectionSchema.safeParse('John Doe (referral from Bob)')
    expect(result.success).toBe(true)
    expect(result.data).toBe('John Doe (referral from Bob)')
  })

  it('accepts simple string (name only)', () => {
    const result = ConnectionSchema.safeParse('Jane Smith')
    expect(result.success).toBe(true)
    expect(result.data).toBe('Jane Smith')
  })

  it('accepts enhanced object format', () => {
    const contact = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Jane Smith',
      role: 'recruiter',
      createdAt: '2026-02-01T10:00:00.000Z',
      updatedAt: '2026-02-01T10:00:00.000Z'
    }

    const result = ConnectionSchema.safeParse(contact)
    expect(result.success).toBe(true)
    expect(result.data.name).toBe('Jane Smith')
  })

  it('rejects invalid object (wrong structure)', () => {
    const invalid = {
      fullName: 'Jane Smith', // wrong field name
      position: 'recruiter'   // wrong field name
    }

    const result = ConnectionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects non-string, non-object values', () => {
    expect(ConnectionSchema.safeParse(123).success).toBe(false)
    expect(ConnectionSchema.safeParse(null).success).toBe(false)
    expect(ConnectionSchema.safeParse(undefined).success).toBe(false)
  })
})

describe('parseLegacyConnection', () => {
  it('parses "Name" format', () => {
    const result = parseLegacyConnection('Jane Smith')

    expect(result.name).toBe('Jane Smith')
    expect(result.notes).toBe('')
    expect(result.legacy).toBe(true)
  })

  it('parses "Name (notes)" format', () => {
    const result = parseLegacyConnection('John Doe (referral from Sarah)')

    expect(result.name).toBe('John Doe')
    expect(result.notes).toBe('referral from Sarah')
    expect(result.legacy).toBe(true)
  })

  it('handles name with title in parentheses', () => {
    const result = parseLegacyConnection('Mike Jones (VP of Engineering)')

    expect(result.name).toBe('Mike Jones')
    expect(result.notes).toBe('VP of Engineering')
    expect(result.legacy).toBe(true)
  })

  it('trims whitespace', () => {
    const result = parseLegacyConnection('  Jane Smith  (  some notes  )  ')

    expect(result.name).toBe('Jane Smith')
    expect(result.notes).toBe('some notes')
  })

  it('handles empty parentheses', () => {
    const result = parseLegacyConnection('Jane Smith ()')

    expect(result.name).toBe('Jane Smith')
    expect(result.notes).toBe('')
  })

  it('handles empty string', () => {
    const result = parseLegacyConnection('')

    expect(result.name).toBe('')
    expect(result.notes).toBe('')
    expect(result.legacy).toBe(true)
  })

  it('handles null/undefined gracefully', () => {
    expect(parseLegacyConnection(null).name).toBe('')
    expect(parseLegacyConnection(undefined).name).toBe('')
  })

  it('handles multiple parentheses - uses first group', () => {
    const result = parseLegacyConnection('Jane (note 1) (note 2)')

    // The entire "(note 1) (note 2)" after Jane is captured
    expect(result.name).toBe('Jane')
    expect(result.notes).toBe('note 1) (note 2')
  })
})

describe('validateContact', () => {
  it('returns valid: true for valid contact', () => {
    const contact = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Jane Smith',
      role: 'recruiter',
      createdAt: '2026-02-01T10:00:00.000Z',
      updatedAt: '2026-02-01T10:00:00.000Z'
    }

    const result = validateContact(contact)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.data).toBeDefined()
    expect(result.data.name).toBe('Jane Smith')
  })

  it('returns valid: false with errors for invalid contact', () => {
    const contact = {
      id: 'not-a-uuid',
      name: '',
      role: 'invalid-role'
    }

    const result = validateContact(contact)

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.data).toBeNull()
  })

  it('includes error paths and messages', () => {
    const contact = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: '',
      role: 'recruiter',
      createdAt: '2026-02-01',
      updatedAt: '2026-02-01'
    }

    const result = validateContact(contact)

    expect(result.valid).toBe(false)
    const nameError = result.errors.find(e => e.path === 'name')
    expect(nameError).toBeDefined()
    expect(nameError.message).toBeDefined()
  })
})

describe('validateInteraction', () => {
  it('returns valid: true for valid interaction', () => {
    const interaction = {
      date: '2026-02-01T10:00:00.000Z',
      type: 'email',
      notes: 'Sent introduction'
    }

    const result = validateInteraction(interaction)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.data).toBeDefined()
  })

  it('returns valid: false for invalid interaction', () => {
    const interaction = {
      date: '',
      type: 'invalid'
    }

    const result = validateInteraction(interaction)

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe('createContact', () => {
  it('creates contact with generated UUID and timestamps', () => {
    const contactData = {
      name: 'Jane Smith',
      role: 'recruiter',
      title: 'Senior Recruiter',
      linkedInUrl: 'https://linkedin.com/in/janesmith'
    }

    const contact = createContact(contactData)

    expect(contact.id).toBeDefined()
    expect(contact.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(contact.name).toBe('Jane Smith')
    expect(contact.role).toBe('recruiter')
    expect(contact.title).toBe('Senior Recruiter')
    expect(contact.linkedInUrl).toBe('https://linkedin.com/in/janesmith')
    expect(contact.createdAt).toBeDefined()
    expect(contact.updatedAt).toBeDefined()
    expect(contact.isPrimary).toBe(false)
    expect(contact.reachedOut).toBe(false)
    expect(contact.interactions).toEqual([])
  })

  it('defaults role to "other" if not provided', () => {
    const contact = createContact({ name: 'Test' })

    expect(contact.role).toBe('other')
  })

  it('preserves provided isPrimary and reachedOut', () => {
    const contact = createContact({
      name: 'Test',
      isPrimary: true,
      reachedOut: true
    })

    expect(contact.isPrimary).toBe(true)
    expect(contact.reachedOut).toBe(true)
  })

  it('sets empty strings for optional URL fields if not provided', () => {
    const contact = createContact({ name: 'Test' })

    expect(contact.linkedInUrl).toBe('')
    expect(contact.email).toBe('')
  })
})
