// Sync Engine
// Orchestrates the synchronization process between systems

import { supabaseAdmin } from '@/lib/supabase'
import type { EntityType, SystemId, SyncRun } from '@/types/supabase'
import type { BaseAdapter } from '../adapters/base'
import { createAdapter } from '../adapters'
import type {
  SyncContext,
  SyncResult,
  TransformedRecord,
  AdapterConfig,
  Credentials,
} from '../types'
import { getTransformer } from '../transformers'

export interface SyncEngineConfig {
  batchSize?: number
  maxRetries?: number
  retryDelayMs?: number
}

export class SyncEngine {
  private config: SyncEngineConfig
  private adapters: Map<SystemId, BaseAdapter> = new Map()

  constructor(config: SyncEngineConfig = {}) {
    this.config = {
      batchSize: config.batchSize || 100,
      maxRetries: config.maxRetries || 3,
      retryDelayMs: config.retryDelayMs || 1000,
    }
  }

  // Main sync entry point
  async runSync(context: SyncContext): Promise<SyncResult> {
    const result: SyncResult = {
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    }

    try {
      // Get adapter for the system
      const adapter = await this.getOrCreateAdapter(context.systemId)

      // Sync each entity type
      for (const entityType of context.entityTypes) {
        const entityResult =
          context.direction === 'import'
            ? await this.importEntity(adapter, entityType, context)
            : await this.exportEntity(adapter, entityType, context)

        // Aggregate results
        result.processed += entityResult.processed
        result.created += entityResult.created
        result.updated += entityResult.updated
        result.failed += entityResult.failed
        result.errors.push(...entityResult.errors)
      }
    } catch (error) {
      result.errors.push({
        entityType: context.entityTypes[0] || 'employee',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    return result
  }

  // Import: External System → Supabase
  private async importEntity(
    adapter: BaseAdapter,
    entityType: EntityType,
    context: SyncContext
  ): Promise<SyncResult> {
    const result: SyncResult = {
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    }

    const transformer = getTransformer(context.systemId, entityType)

    // Paginate through all records
    let cursor: string | undefined
    let hasMore = true

    while (hasMore) {
      const response = await adapter.fetchRecords(entityType, {
        cursor,
        pageSize: this.config.batchSize,
      })

      for (const externalRecord of response.records) {
        try {
          // Transform the record
          const transformed = await transformer.toSupabase(externalRecord)

          // Find or create internal ID
          const internalId = await this.resolveInternalId(
            entityType,
            context.systemId,
            externalRecord.id,
            transformed.data
          )

          transformed.internalId = internalId

          // Upsert to Supabase
          const upsertResult = await this.upsertEntity(entityType, transformed, context)

          result.processed++
          if (upsertResult.created) {
            result.created++
          } else if (upsertResult.updated) {
            result.updated++
          }

          // Update sync status
          await this.updateSyncStatus(entityType, internalId, context.systemId, 'synced')

          // Mark other systems as pending
          await this.markOtherSystemsPending(entityType, internalId, context.systemId)
        } catch (error) {
          result.processed++
          result.failed++
          result.errors.push({
            entityType,
            externalId: externalRecord.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          })

          // Update sync status with error
          await this.updateSyncStatus(
            entityType,
            undefined,
            context.systemId,
            'failed',
            error instanceof Error ? error.message : 'Unknown error'
          )
        }
      }

      hasMore = response.hasMore
      cursor = response.nextCursor
    }

    return result
  }

  // Export: Supabase → External System
  private async exportEntity(
    adapter: BaseAdapter,
    entityType: EntityType,
    context: SyncContext
  ): Promise<SyncResult> {
    const result: SyncResult = {
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    }

    const transformer = getTransformer(context.systemId, entityType)

    // Get pending records for this system
    const pendingRecords = await this.getPendingRecords(entityType, context.systemId)

    const batch: TransformedRecord[] = []

    for (const record of pendingRecords) {
      try {
        // Transform to external format
        const transformed = await transformer.toExternal(record)
        batch.push(transformed)

        // Push in batches
        if (batch.length >= this.config.batchSize!) {
          const batchResult = await adapter.pushRecords(entityType, batch)
          result.processed += batchResult.processed
          result.created += batchResult.created
          result.updated += batchResult.updated
          result.failed += batchResult.failed
          result.errors.push(...batchResult.errors)

          // Update sync status for successful records
          for (const rec of batch) {
            if (rec.internalId) {
              await this.updateSyncStatus(entityType, rec.internalId, context.systemId, 'synced')
            }
          }

          batch.length = 0
        }
      } catch (error) {
        result.errors.push({
          entityType,
          internalId: record.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Push remaining records
    if (batch.length > 0) {
      const batchResult = await adapter.pushRecords(entityType, batch)
      result.processed += batchResult.processed
      result.created += batchResult.created
      result.updated += batchResult.updated
      result.failed += batchResult.failed
      result.errors.push(...batchResult.errors)
    }

    return result
  }

  // Resolve internal UUID from external ID or matching fields
  private async resolveInternalId(
    entityType: EntityType,
    systemId: SystemId,
    externalId: string,
    data: Record<string, unknown>
  ): Promise<string> {
    // First, check external_ids table
    const { data: existing } = await supabaseAdmin
      .from('external_ids')
      .select('internal_id')
      .eq('entity_type', entityType)
      .eq('system_id', systemId)
      .eq('external_id', externalId)
      .single()

    if (existing) {
      return existing.internal_id
    }

    // Try to match by email for employees
    if (entityType === 'employee' && data.email) {
      const { data: employee } = await supabaseAdmin
        .from('employees')
        .select('id')
        .eq('email', data.email as string)
        .eq('is_deleted', false)
        .single()

      if (employee) {
        // Create mapping for this system
        await supabaseAdmin.from('external_ids').insert({
          entity_type: entityType,
          internal_id: employee.id,
          system_id: systemId,
          external_id: externalId,
        })
        return employee.id
      }
    }

    // Generate new UUID
    const newId = crypto.randomUUID()

    // Create mapping
    await supabaseAdmin.from('external_ids').insert({
      entity_type: entityType,
      internal_id: newId,
      system_id: systemId,
      external_id: externalId,
    })

    return newId
  }

  // Upsert entity to Supabase
  private async upsertEntity(
    entityType: EntityType,
    record: TransformedRecord,
    context: SyncContext
  ): Promise<{ created: boolean; updated: boolean }> {
    const tableName = this.getTableName(entityType)
    const now = new Date().toISOString()

    // Check if record exists
    const { data: existing } = await supabaseAdmin
      .from(tableName)
      .select('id, updated_at')
      .eq('id', record.internalId!)
      .single()

    const recordData = {
      ...record.data,
      id: record.internalId,
      raw_data: record.rawData,
      updated_at: now,
    }

    if (existing) {
      // Update
      await supabaseAdmin.from(tableName).update(recordData).eq('id', record.internalId!)

      // Log change
      await this.logChange(entityType, record.internalId!, 'update', context.triggeredBy, context.systemId)

      return { created: false, updated: true }
    } else {
      // Create
      await supabaseAdmin.from(tableName).insert({
        ...recordData,
        created_at: now,
      })

      // Log change
      await this.logChange(entityType, record.internalId!, 'create', context.triggeredBy, context.systemId)

      return { created: true, updated: false }
    }
  }

  // Get pending records for export
  private async getPendingRecords(entityType: EntityType, systemId: SystemId) {
    const tableName = this.getTableName(entityType)

    const { data } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .eq('is_deleted', false)
      .in(
        'id',
        supabaseAdmin
          .from('sync_status')
          .select('entity_id')
          .eq('entity_type', entityType)
          .eq('system_id', systemId)
          .eq('sync_state', 'pending')
      )

    return data || []
  }

  // Update sync status for a record
  private async updateSyncStatus(
    entityType: EntityType,
    entityId: string | undefined,
    systemId: SystemId,
    state: 'pending' | 'synced' | 'failed',
    error?: string
  ): Promise<void> {
    if (!entityId) return

    await supabaseAdmin.from('sync_status').upsert(
      {
        entity_type: entityType,
        entity_id: entityId,
        system_id: systemId,
        sync_state: state,
        last_synced_at: state === 'synced' ? new Date().toISOString() : undefined,
        last_error: error,
        retry_count: state === 'failed' ? 1 : 0,
      },
      {
        onConflict: 'entity_type,entity_id,system_id',
      }
    )
  }

  // Mark other systems as pending after a change
  private async markOtherSystemsPending(
    entityType: EntityType,
    entityId: string,
    sourceSystemId: SystemId
  ): Promise<void> {
    // Get all systems that support this entity type
    const { data: apps } = await supabaseAdmin
      .from('sync_apps')
      .select('system_id')
      .eq('is_enabled', true)
      .eq('can_export', true)
      .neq('system_id', sourceSystemId)

    if (!apps) return

    for (const app of apps) {
      await this.updateSyncStatus(entityType, entityId, app.system_id as SystemId, 'pending')
    }
  }

  // Log change to change_log
  private async logChange(
    entityType: EntityType,
    entityId: string,
    action: 'create' | 'update' | 'delete',
    changedBy: string,
    sourceSystem: string
  ): Promise<void> {
    await supabaseAdmin.from('change_log').insert({
      entity_type: entityType,
      entity_id: entityId,
      action,
      changed_by: changedBy,
      source_system: sourceSystem,
    })
  }

  // Get or create adapter instance
  private async getOrCreateAdapter(systemId: SystemId): Promise<BaseAdapter> {
    if (this.adapters.has(systemId)) {
      return this.adapters.get(systemId)!
    }

    // Get app config from database
    const { data: app } = await supabaseAdmin
      .from('sync_apps')
      .select('config')
      .eq('system_id', systemId)
      .single()

    if (!app) {
      throw new Error(`No sync app found for system: ${systemId}`)
    }

    // Get credentials from environment
    const credentials = this.getCredentials(systemId)

    const adapter = await createAdapter(
      systemId,
      (app.config || {}) as AdapterConfig,
      credentials
    )

    this.adapters.set(systemId, adapter)
    return adapter
  }

  // Get credentials for a system from environment
  private getCredentials(systemId: SystemId): Credentials {
    const envPrefix = systemId.toUpperCase()

    // Check for OAuth
    const accessToken = process.env[`${envPrefix}_ACCESS_TOKEN`]
    if (accessToken) {
      return {
        type: 'oauth',
        token: {
          accessToken,
          refreshToken: process.env[`${envPrefix}_REFRESH_TOKEN`],
          expiresAt: new Date(Date.now() + 3600000), // Default 1 hour
          tokenType: 'Bearer',
        },
      }
    }

    // Check for API key
    const apiKey = process.env[`${envPrefix}_API_KEY`]
    if (apiKey) {
      return { type: 'api_key', apiKey }
    }

    // Default to custom credentials
    return {
      type: 'custom',
      data: {
        clientId: process.env[`${envPrefix}_CLIENT_ID`] || '',
        clientSecret: process.env[`${envPrefix}_CLIENT_SECRET`] || '',
        userId: process.env[`${envPrefix}_USER_ID`] || '',
        userPassword: process.env[`${envPrefix}_PASSWORD`] || '',
      },
    }
  }

  // Get table name for entity type
  private getTableName(entityType: EntityType): string {
    const tableNames: Record<EntityType, string> = {
      employee: 'employees',
      customer: 'customers',
      vendor: 'vendors',
      project: 'projects',
      department: 'departments',
      purchase_order: 'purchase_orders',
      time_sheet: 'time_sheets',
      quote: 'quotes',
    }
    return tableNames[entityType]
  }

  // Cleanup
  async dispose(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.disconnect()
    }
    this.adapters.clear()
  }
}

// Singleton instance
let syncEngine: SyncEngine | null = null

export function getSyncEngine(): SyncEngine {
  if (!syncEngine) {
    syncEngine = new SyncEngine()
  }
  return syncEngine
}
