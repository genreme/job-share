/**
 * Supabase Server Client
 *
 * Provides server-side access to Supabase for friend job submissions.
 * Uses service key (not anon key) to bypass RLS for admin-level access.
 *
 * Environment variables:
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_KEY: service_role key (NOT anon key)
 */

import { createClient } from '@supabase/supabase-js'

// Lazy-initialized client singleton
let supabaseClient = null
let configWarningLogged = false

/**
 * Check if Supabase environment variables are configured
 * @returns {boolean} True if both URL and service key are set
 */
export function isSupabaseConfigured() {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  return !!(url && serviceKey)
}

/**
 * Get or create Supabase client instance
 * Uses lazy initialization and caches the client for reuse
 *
 * @returns {object|null} Supabase client or null if not configured
 */
export function getSupabaseClient() {
  // Return cached client if already initialized
  if (supabaseClient) {
    return supabaseClient
  }

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  // Handle missing configuration gracefully
  if (!url || !serviceKey) {
    // Only log warning once to avoid spam
    if (!configWarningLogged) {
      console.warn(
        '[supabase-client] Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.'
      )
      configWarningLogged = true
    }
    return null
  }

  // Create and cache client
  supabaseClient = createClient(url, serviceKey, {
    auth: {
      // Disable auto-refresh for server-side usage
      autoRefreshToken: false,
      persistSession: false
    }
  })

  return supabaseClient
}

/**
 * Reset client (useful for testing)
 * @internal
 */
export function _resetClient() {
  supabaseClient = null
  configWarningLogged = false
}
