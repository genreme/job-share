#!/usr/bin/env node
/**
 * Phase Gate Script
 * Runs tests and blocks phase completion if any fail.
 * Usage: node scripts/phase-gate.js
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

console.log('\n========================================')
console.log('PHASE GATE: Running test suite...')
console.log('========================================\n')

// Resolve npx path to avoid shell option (security best practice)
const npxPath = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const vitest = spawn(npxPath, ['vitest', 'run', '--coverage'], {
  cwd: projectRoot,
  stdio: 'inherit'
})

vitest.on('close', (code) => {
  console.log('\n========================================')
  if (code === 0) {
    console.log('PHASE GATE: PASSED')
    console.log('All tests passed. Phase can be marked complete.')
    console.log('========================================\n')
    process.exit(0)
  } else {
    console.log('PHASE GATE: FAILED')
    console.log('Tests did not pass. Fix issues before proceeding.')
    console.log('========================================\n')
    process.exit(1)
  }
})

vitest.on('error', (err) => {
  console.error('Failed to start test process:', err.message)
  process.exit(1)
})
