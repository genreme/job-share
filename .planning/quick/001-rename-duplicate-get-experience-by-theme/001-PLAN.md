---
plan: 001
title: Rename duplicate get_experience_by_theme tool
type: quick
created: 2026-02-03
---

# Quick Task 001: Rename Duplicate Tool

## Problem

`get_experience_by_theme` is defined twice in index.js:
- **Line 317** (resume context): For document generation - searches experience bullets
- **Line 711** (profile context): For profile access - filters experience by theme/tag

The second case handler (line 1936) overwrites the first (line 1835), making the resume version inaccessible via MCP.

## Solution

Rename the resume version to `get_resume_experience_by_theme` to distinguish it from the profile version.

## Tasks

### Task 1: Rename tool definition (line 317)

**File:** `mcp-server/src/index.js`
**Line:** 317
**Change:** `get_experience_by_theme` → `get_resume_experience_by_theme`

### Task 2: Rename case handler (line 1835)

**File:** `mcp-server/src/index.js`
**Line:** 1835
**Change:** `case 'get_experience_by_theme':` → `case 'get_resume_experience_by_theme':`

### Task 3: Verify no other references

Search for any other references to the old name that need updating.

## Verification

After changes:
- Tool definitions: 99 unique names
- Case handlers: 99 unique handlers
- Both experience tools accessible via distinct names
