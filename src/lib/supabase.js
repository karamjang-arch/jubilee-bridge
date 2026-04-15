/**
 * Supabase Client Configuration
 *
 * Two clients:
 * - supabase: Browser/client-side (uses anon key, respects RLS)
 * - supabaseAdmin: Server-side (uses service role key, bypasses RLS)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!supabaseUrl) {
  console.warn('Missing NEXT_PUBLIC_SUPABASE_URL - running in demo mode');
}

// Client-side Supabase client (browser)
// Only create if URL is available to prevent build errors
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

// Server-side Supabase client (API routes)
// Only create if both URL and service key are available
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

/**
 * Helper to check if we're in demo mode (no Supabase connection)
 */
export function isUsingDemo() {
  return !supabaseUrl || !supabaseAnonKey;
}

/**
 * Tables reference for consistency
 */
export const TABLES = {
  PROFILES: 'profiles',
  STUDENT_PROGRESS: 'student_progress',
  CONCEPT_PROGRESS: 'concept_progress',
  CONCEPT_HISTORY: 'concept_history',
  STUDENT_BADGES: 'student_badges',
  STUDY_SESSIONS: 'study_sessions',
  TEST_SCORES: 'test_scores',
};
