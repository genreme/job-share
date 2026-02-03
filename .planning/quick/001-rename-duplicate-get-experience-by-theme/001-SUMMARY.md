---
plan: 001
title: Rename duplicate get_experience_by_theme tool
type: quick
completed: 2026-02-03
status: complete
---

# Quick Task 001: Summary

## Problem Solved

Fixed duplicate MCP tool name `get_experience_by_theme` that was causing a collision where the profile version (line 711) overwrote the resume version (line 317).

## Changes Made

### mcp-server/src/index.js

1. **Line 317**: Renamed tool definition
   - Before: `name: 'get_experience_by_theme'`
   - After: `name: 'get_resume_experience_by_theme'`

2. **Line 1835**: Renamed case handler
   - Before: `case 'get_experience_by_theme':`
   - After: `case 'get_resume_experience_by_theme':`

## Result

Now both tools are accessible via distinct names:

| Tool Name | Purpose | Handler |
|-----------|---------|---------|
| `get_resume_experience_by_theme` | Search resume experience bullets by theme | `getExperienceByTheme()` |
| `get_experience_by_theme` | Filter profile experience by theme/tag | `getProfileExperienceByTheme()` |

## Verification

- Tests: 2276 passing (same as before, 3 pre-existing failures unrelated)
- Tool count: 99 unique tool definitions, 99 unique case handlers
- No collisions remaining
