// Environment Configuration
// Centralized configuration management with validation

import type { SystemId } from '@/types/supabase'

// Required environment variables
const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'INNGEST_EVENT_KEY',
  'INNGEST_SIGNING_KEY',
] as const

// Optional platform-specific environment variables
const PLATFORM_ENV_VARS: Record<SystemId, string[]> = {
  creator: [
    'CREATOR_ACCESS_TOKEN',
    'CREATOR_REFRESH_TOKEN',
    'CREATOR_CLIENT_ID',
    'CREATOR_CLIENT_SECRET',
    'CREATOR_ACCOUNT_OWNER',
    'CREATOR_APP_NAME',
  ],
  crm: [
    'CRM_ACCESS_TOKEN',
    'CRM_REFRESH_TOKEN',
    'CRM_CLIENT_ID',
    'CRM_CLIENT_SECRET',
  ],
  intacct: [
    'INTACCT_SENDER_ID',
    'INTACCT_SENDER_PASSWORD',
    'INTACCT_COMPANY_ID',
    'INTACCT_USER_ID',
    'INTACCT_PASSWORD',
  ],
  adp: [
    'ADP_CLIENT_ID',
    'ADP_CLIENT_SECRET',
    'ADP_CERT_PATH',
  ],
  absorb: [
    'ABSORB_API_KEY',
    'ABSORB_PRIVATE_KEY',
  ],
  ramp: [
    'RAMP_CLIENT_ID',
    'RAMP_CLIENT_SECRET',
  ],
  anyware: [
    'ANYWARE_API_KEY',
  ],
}

// Configuration interface
export interface AppConfig {
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey: string
  }
  inngest: {
    eventKey: string
    signingKey: string
  }
  platforms: Partial<Record<SystemId, PlatformConfig>>
  isDev: boolean
  isProduction: boolean
}

export interface PlatformConfig {
  enabled: boolean
  credentials: Record<string, string>
}

// Validation result
export interface ConfigValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// Get environment variable with optional default
function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key]
  if (value !== undefined) return value
  if (defaultValue !== undefined) return defaultValue
  throw new Error(`Missing required environment variable: ${key}`)
}

// Get optional environment variable
function getEnvOptional(key: string): string | undefined {
  return process.env[key]
}

// Check if platform is configured
function getPlatformConfig(systemId: SystemId): PlatformConfig | undefined {
  const envVars = PLATFORM_ENV_VARS[systemId]
  if (!envVars || envVars.length === 0) return undefined

  const credentials: Record<string, string> = {}
  let hasAnyCredential = false

  for (const envVar of envVars) {
    const value = getEnvOptional(envVar)
    if (value) {
      credentials[envVar] = value
      hasAnyCredential = true
    }
  }

  if (!hasAnyCredential) return undefined

  return {
    enabled: true,
    credentials,
  }
}

// Validate configuration
export function validateConfig(): ConfigValidation {
  const errors: string[] = []
  const warnings: string[] = []

  // Check required environment variables
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`)
    }
  }

  // Check platform configurations
  for (const [systemId, envVars] of Object.entries(PLATFORM_ENV_VARS)) {
    const hasCredentials = envVars.some((v) => process.env[v])
    const hasAllCredentials = envVars.every((v) => process.env[v])

    if (hasCredentials && !hasAllCredentials) {
      const missing = envVars.filter((v) => !process.env[v])
      warnings.push(
        `Partial configuration for ${systemId}: missing ${missing.join(', ')}`
      )
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// Get application configuration
export function getConfig(): AppConfig {
  const validation = validateConfig()

  if (!validation.valid) {
    console.error('Configuration errors:', validation.errors)
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid configuration in production')
    }
  }

  if (validation.warnings.length > 0) {
    console.warn('Configuration warnings:', validation.warnings)
  }

  const platforms: Partial<Record<SystemId, PlatformConfig>> = {}

  for (const systemId of Object.keys(PLATFORM_ENV_VARS) as SystemId[]) {
    const config = getPlatformConfig(systemId)
    if (config) {
      platforms[systemId] = config
    }
  }

  return {
    supabase: {
      url: getEnv('NEXT_PUBLIC_SUPABASE_URL', ''),
      anonKey: getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ''),
      serviceRoleKey: getEnv('SUPABASE_SERVICE_ROLE_KEY', ''),
    },
    inngest: {
      eventKey: getEnv('INNGEST_EVENT_KEY', ''),
      signingKey: getEnv('INNGEST_SIGNING_KEY', ''),
    },
    platforms,
    isDev: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
  }
}

// Get platform-specific base URL
export function getPlatformBaseUrl(systemId: SystemId): string {
  const baseUrls: Record<SystemId, string> = {
    creator: 'https://creator.zoho.com/api/v2',
    crm: 'https://www.zohoapis.com/crm/v3',
    intacct: 'https://api.intacct.com/ia/xml/xmlgw.phtml',
    adp: 'https://api.adp.com',
    absorb: 'https://api.myabsorb.com',
    ramp: 'https://api.ramp.com/developer/v1',
    anyware: 'https://api.anyware.com/v1',
  }

  return process.env[`${systemId.toUpperCase()}_BASE_URL`] || baseUrls[systemId]
}

// Singleton config instance
let configInstance: AppConfig | null = null

export function config(): AppConfig {
  if (!configInstance) {
    configInstance = getConfig()
  }
  return configInstance
}
