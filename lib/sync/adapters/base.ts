// Base Adapter - Interface for all platform adapters
import type { EntityType } from '@/types/supabase'
import type {
  AdapterConfig,
  Credentials,
  ExternalRecord,
  PaginatedResponse,
  SyncResult,
  TransformedRecord,
} from '../types'

export interface BaseAdapter {
  // Adapter identification
  readonly systemId: string
  readonly displayName: string
  readonly supportedEntityTypes: EntityType[]
  readonly canImport: boolean
  readonly canExport: boolean

  // Lifecycle
  initialize(config: AdapterConfig, credentials: Credentials): Promise<void>
  disconnect(): Promise<void>

  // Health check
  testConnection(): Promise<{ success: boolean; message?: string }>

  // Import operations (External → Supabase)
  fetchRecords(
    entityType: EntityType,
    options?: FetchOptions
  ): Promise<PaginatedResponse<ExternalRecord>>

  fetchRecord(
    entityType: EntityType,
    externalId: string
  ): Promise<ExternalRecord | null>

  // Export operations (Supabase → External)
  pushRecords(
    entityType: EntityType,
    records: TransformedRecord[]
  ): Promise<SyncResult>

  pushRecord(
    entityType: EntityType,
    record: TransformedRecord
  ): Promise<{ success: boolean; externalId?: string; error?: string }>

  // Optional: Get changes since last sync
  fetchChanges?(
    entityType: EntityType,
    since: Date
  ): Promise<PaginatedResponse<ExternalRecord>>
}

export interface FetchOptions {
  cursor?: string
  pageSize?: number
  modifiedSince?: Date
  filters?: Record<string, unknown>
}

// Abstract base class with common functionality
export abstract class AbstractAdapter implements BaseAdapter {
  abstract readonly systemId: string
  abstract readonly displayName: string
  abstract readonly supportedEntityTypes: EntityType[]
  abstract readonly canImport: boolean
  abstract readonly canExport: boolean

  protected config: AdapterConfig | null = null
  protected credentials: Credentials | null = null
  protected initialized = false

  async initialize(config: AdapterConfig, credentials: Credentials): Promise<void> {
    this.config = config
    this.credentials = credentials
    await this.onInitialize()
    this.initialized = true
  }

  async disconnect(): Promise<void> {
    await this.onDisconnect()
    this.initialized = false
    this.config = null
    this.credentials = null
  }

  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`Adapter ${this.systemId} not initialized`)
    }
  }

  // Subclasses implement these
  protected abstract onInitialize(): Promise<void>
  protected abstract onDisconnect(): Promise<void>

  abstract testConnection(): Promise<{ success: boolean; message?: string }>
  abstract fetchRecords(
    entityType: EntityType,
    options?: FetchOptions
  ): Promise<PaginatedResponse<ExternalRecord>>
  abstract fetchRecord(
    entityType: EntityType,
    externalId: string
  ): Promise<ExternalRecord | null>
  abstract pushRecords(
    entityType: EntityType,
    records: TransformedRecord[]
  ): Promise<SyncResult>
  abstract pushRecord(
    entityType: EntityType,
    record: TransformedRecord
  ): Promise<{ success: boolean; externalId?: string; error?: string }>
}

// Helper for creating adapters
export type AdapterFactory = (config: AdapterConfig, credentials: Credentials) => Promise<BaseAdapter>
