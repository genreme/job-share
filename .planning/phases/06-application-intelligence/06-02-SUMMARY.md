---
phase: 06-application-intelligence
plan: 02
subsystem: contacts
tags: [contacts, mcp-tools, zod, validation, interaction-tracking]

dependency-graph:
  requires: [06-01]
  provides: [contact-schema, contact-tools, job-updates]
  affects: [06-03]

tech-stack:
  added: []
  patterns: [union-schema-backward-compat, contact-deduplication, interaction-history]

key-files:
  created:
    - schemas/contact.schema.js
    - schemas/contact.schema.test.js
    - mcp-server/src/tools/contacts.js
    - mcp-server/src/tools/contacts.test.js
  modified: []

decisions:
  - id: contact-schema-union
    choice: "ConnectionSchema uses z.union([string, object]) for backward compatibility"
    reason: "Existing jobs have string-format connections that must continue working"
  - id: contact-deduplication
    choice: "Duplicate detection by name (case-insensitive) OR LinkedIn URL"
    reason: "Prevents duplicate entries while allowing updates to existing contacts"
  - id: interaction-tracking
    choice: "Contact.interactions array + lastInteraction field for most recent"
    reason: "Full history for audit trail, quick access to most recent for display"
  - id: addJobUpdate-comprehensive
    choice: "Single addJobUpdate function handles notes, connections, status changes"
    reason: "Matches APPL-07 requirement for comprehensive job updates in one call"

metrics:
  duration: 6 min
  completed: 2026-02-01
---

# Phase 6 Plan 2: Contact Tracking and Job Updates Summary

Enhanced contact tracking system with structured contact entries, interaction history, and comprehensive job update tools.

## One-liner

Zod-validated contact schema with LinkedIn URLs, interaction history tracking, and MCP tools for contact management and job updates.

## What Was Built

### 1. Contact Schema (`schemas/contact.schema.js`)

- **ContactInteractionSchema**: Validates interaction entries (date, type: email/linkedin/call/meeting/other, notes)
- **EnhancedConnectionSchema**: Full structured contact (id, name, role, title, company, linkedInUrl, email, phone, notes, isPrimary, reachedOut, lastInteraction, interactions[], timestamps)
- **ConnectionSchema**: Union type accepting legacy string format OR enhanced object for backward compatibility
- **Helper functions**:
  - `parseLegacyConnection(str)`: Parses "Name (notes)" into structured format
  - `validateContact(contact)`: Validates enhanced contact, returns { valid, errors, data }
  - `validateInteraction(interaction)`: Validates interaction entry
  - `createContact(data)`: Creates contact with generated UUID and timestamps

### 2. Contact Management MCP Tools (`mcp-server/src/tools/contacts.js`)

| Tool | Purpose | APPL Requirement |
|------|---------|------------------|
| `addJobContact` | Add/update structured contact with deduplication | APPL-03, APPL-04 |
| `logContactInteraction` | Log interaction, update lastInteraction, set reachedOut | APPL-04 |
| `getJobContacts` | Get all contacts (structured + parsed legacy) | APPL-03 |
| `addJobUpdate` | Comprehensive update (note, connection, status, appendToNotes) | APPL-07 |

## Key Features

### Contact Deduplication
```javascript
// Detects duplicates by:
// 1. Name (case-insensitive match)
// 2. LinkedIn URL (exact match)
// If duplicate found: updates existing contact
// If new: generates UUID and adds to connections
```

### Interaction Tracking
```javascript
// Each logContactInteraction:
// 1. Validates interaction type
// 2. Adds to contact.interactions array
// 3. Updates contact.lastInteraction
// 4. Sets contact.reachedOut = true
// 5. Updates contact.updatedAt
```

### Backward Compatibility
```javascript
// getJobContacts returns both:
{
  structuredContacts: [...],  // Full objects with all fields
  legacyContacts: [...],      // Parsed legacy strings with conversion suggestion
  hasUncontacted: boolean     // Quick check for follow-up queue
}
```

## Test Coverage

| File | Tests | Coverage |
|------|-------|----------|
| contact.schema.test.js | 43 | Schema validation, parsing, edge cases |
| contacts.test.js | 39 | MCP tools, deduplication, error handling |
| **Total** | **82** | All functionality covered |

## Requirements Addressed

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| APPL-03 | Contact tracking per job via addJobContact | Complete |
| APPL-04 | Contact includes name, title, LinkedIn URL, last interaction | Complete |
| APPL-07 | User can add notes and updates to any job entry | Complete |

## Integration Points

### Imports from Existing Code
```javascript
import { loadJobsFromDashboard, writeJobsData } from '../data/loader.js'
import { isValidTransition } from '../../../schemas/job.schema.js'
```

### Exports for Future Use
```javascript
export { addJobContact, logContactInteraction, getJobContacts, addJobUpdate }
export { EnhancedConnectionSchema, ContactInteractionSchema, ConnectionSchema }
export { parseLegacyConnection, validateContact, validateInteraction, createContact }
```

## Commits

1. `91fa953` - feat(06-02): add enhanced contact schema with interaction tracking
2. `8d4b616` - feat(06-02): add contact management MCP tools

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Phase 6 Plan 3 (Follow-up Engine) can proceed:
- Contact schema provides `lastInteraction` and `reachedOut` for follow-up calculations
- `getJobContacts` provides `hasUncontacted` flag for queue prioritization
- `addJobUpdate` ready to record follow-up actions
