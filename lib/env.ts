// Environment variable validation
// Validates required env vars at startup and provides typed access

// Check if we're in a build context (next build) vs runtime
const isBuildTime = process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_SUPABASE_URL

function getRequiredEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    // During build time, return placeholder to allow compilation
    if (isBuildTime) {
      // Return valid placeholder URLs for Supabase
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
        return 'https://placeholder.supabase.co'
      }
      return `placeholder_${key}`
    }
    throw new Error(
      `Missing required environment variable: ${key}. ` +
      `Please check your .env.local file or deployment environment.`
    )
  }
  return value
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue
}

// Validate and export environment variables
// These are validated at module load time
export const env = {
  // Supabase
  SUPABASE_URL: getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
  SUPABASE_ANON_KEY: getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),

  // Inngest (optional in dev, required in prod)
  INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY || '',
  INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY || '',

  // API Security
  SYNC_API_KEY: getOptionalEnv('SYNC_API_KEY', ''),

  // App Config
  APP_TIMEZONE: getOptionalEnv('APP_TIMEZONE', 'America/Chicago'),
  NODE_ENV: getOptionalEnv('NODE_ENV', 'development'),
} as const

// Check if we're in production and have required keys
export function validateProductionEnv(): void {
  if (env.NODE_ENV === 'production') {
    if (!env.INNGEST_EVENT_KEY) {
      console.warn('Warning: INNGEST_EVENT_KEY not set in production')
    }
    if (!env.INNGEST_SIGNING_KEY) {
      console.warn('Warning: INNGEST_SIGNING_KEY not set in production')
    }
    if (!env.SYNC_API_KEY) {
      console.warn('Warning: SYNC_API_KEY not set - API routes are unprotected')
    }
  }
}

// Run validation on import in production
if (typeof window === 'undefined') {
  validateProductionEnv()
}
