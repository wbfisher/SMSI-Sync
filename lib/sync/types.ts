// Sync Engine Types
import type { EntityType, SystemId, Json } from '@/types/supabase'

// Result of a sync operation
export interface SyncResult {
  processed: number
  created: number
  updated: number
  failed: number
  errors: SyncError[]
}

export interface SyncError {
  entityType: EntityType
  externalId?: string
  internalId?: string
  error: string
  details?: unknown
}

// Record from external system (before transformation)
export interface ExternalRecord {
  id: string
  data: Record<string, unknown>
  metadata?: {
    lastModified?: string
    checksum?: string
  }
}

// Record after transformation (ready for Supabase)
export interface TransformedRecord {
  internalId?: string // Existing UUID if updating
  externalId: string
  entityType: EntityType
  data: Record<string, unknown>
  rawData: Json
}

// Sync operation context
export interface SyncContext {
  systemId: SystemId
  direction: 'import' | 'export'
  entityTypes: EntityType[]
  runId: string
  triggeredBy: string
  startTime: Date
}

// Adapter configuration (from sync_apps.config)
export interface AdapterConfig {
  baseUrl?: string
  [key: string]: unknown
}

// Entity field mapping definition
export interface FieldMapping {
  source: string
  target: string
  transform?: (value: unknown, record: Record<string, unknown>) => unknown
  required?: boolean
}

// Entity mapping configuration
export interface EntityMapping {
  entityType: EntityType
  externalIdField: string
  matchFields?: string[] // Fields to match existing records (e.g., email)
  fieldMappings: FieldMapping[]
}

// Pagination support for API calls
export interface PaginatedResponse<T> {
  records: T[]
  hasMore: boolean
  nextCursor?: string
  total?: number
}

// OAuth token structure
export interface OAuthToken {
  accessToken: string
  refreshToken?: string
  expiresAt: Date
  tokenType: string
  scope?: string
}

// Credential types
export type Credentials =
  | { type: 'oauth'; token: OAuthToken }
  | { type: 'api_key'; apiKey: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'custom'; data: Record<string, string> }
