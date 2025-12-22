import { Inngest } from 'inngest'
import { supabaseAdmin } from './supabase'
import { getSyncEngine, getSupportedEntityTypes } from './sync'
import type { SystemId, EntityType } from '@/types/supabase'

// Create Inngest client
export const inngest = new Inngest({
  id: 'smsi-sync',
  name: 'SMSI Sync',
})

// Event types
type SyncTriggerEvent = {
  name: 'sync/trigger'
  data: {
    app_id: string
    direction: 'import' | 'export' | 'both'
    entity_types?: string[]
    request_id: string
    triggered_by?: string
  }
}

type SyncScheduledEvent = {
  name: 'sync/scheduled'
  data: {
    app_id: string
  }
}

// Main sync function - handles both manual triggers and scheduled runs
export const syncApp = inngest.createFunction(
  {
    id: 'sync-app',
    name: 'Sync Application',
    retries: 3,
    onFailure: async ({ error, event }) => {
      // Update request status on failure
      const requestId = event.data.request_id
      if (requestId) {
        await supabaseAdmin
          .from('sync_requests')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error.message,
          })
          .eq('id', requestId)
      }

      // Update app status
      await supabaseAdmin
        .from('sync_apps')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'failed',
          last_sync_message: error.message,
        })
        .eq('id', event.data.app_id)
    },
  },
  { event: 'sync/trigger' },
  async ({ event, step }) => {
    const { app_id, direction, entity_types, request_id, triggered_by } = event.data
    const startTime = Date.now()
    const systemId = app_id as SystemId

    // Step 1: Mark request as processing
    await step.run('mark-processing', async () => {
      await supabaseAdmin
        .from('sync_requests')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
        })
        .eq('id', request_id)
    })

    // Step 2: Determine entity types to sync
    const entitiesToSync = await step.run('determine-entities', async () => {
      if (entity_types && entity_types.length > 0) {
        return entity_types as EntityType[]
      }
      // Get all supported entity types for this system
      return getSupportedEntityTypes(systemId)
    })

    // Step 3: Create sync run record
    const syncRun = await step.run('create-sync-run', async () => {
      const { data, error } = await supabaseAdmin
        .from('sync_runs')
        .insert({
          entity_type: entitiesToSync.join(','),
          source_system: direction === 'export' ? 'supabase' : app_id,
          target_system: direction === 'export' ? app_id : 'supabase',
          direction: direction === 'both' ? 'bidirectional' : direction,
          status: 'running',
        })
        .select()
        .single()

      if (error) throw error
      return data
    })

    // Step 4: Execute the sync using the sync engine
    const result = await step.run('execute-sync', async () => {
      const engine = getSyncEngine()

      // Handle 'both' direction
      if (direction === 'both') {
        // First import, then export
        const importResult = await engine.runSync({
          systemId,
          direction: 'import',
          entityTypes: entitiesToSync,
          runId: syncRun.id,
          triggeredBy: triggered_by || 'manual',
          startTime: new Date(),
        })

        const exportResult = await engine.runSync({
          systemId,
          direction: 'export',
          entityTypes: entitiesToSync,
          runId: syncRun.id,
          triggeredBy: triggered_by || 'manual',
          startTime: new Date(),
        })

        return {
          processed: importResult.processed + exportResult.processed,
          created: importResult.created + exportResult.created,
          updated: importResult.updated + exportResult.updated,
          failed: importResult.failed + exportResult.failed,
          errors: [...importResult.errors, ...exportResult.errors],
        }
      }

      // Single direction
      return engine.runSync({
        systemId,
        direction,
        entityTypes: entitiesToSync,
        runId: syncRun.id,
        triggeredBy: triggered_by || 'manual',
        startTime: new Date(),
      })
    })

    const duration = Date.now() - startTime
    const hasErrors = result.failed > 0

    // Step 5: Update sync run with results
    await step.run('update-sync-run', async () => {
      await supabaseAdmin
        .from('sync_runs')
        .update({
          status: hasErrors ? 'partial' : 'completed',
          completed_at: new Date().toISOString(),
          records_processed: result.processed,
          records_created: result.created,
          records_updated: result.updated,
          records_failed: result.failed,
          error_message: result.errors.length > 0
            ? result.errors.map(e => e.error).join('; ').slice(0, 500)
            : null,
        })
        .eq('id', syncRun.id)
    })

    // Step 6: Update app status
    await step.run('update-app-status', async () => {
      await supabaseAdmin
        .from('sync_apps')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: hasErrors ? 'partial' : 'success',
          last_sync_message: hasErrors
            ? `${result.failed} records failed`
            : null,
          last_sync_duration_ms: duration,
          last_records_processed: result.processed,
          last_records_created: result.created,
          last_records_updated: result.updated,
          last_records_failed: result.failed,
        })
        .eq('id', app_id)
    })

    // Step 7: Complete the request
    await step.run('complete-request', async () => {
      await supabaseAdmin
        .from('sync_requests')
        .update({
          status: hasErrors ? 'failed' : 'completed',
          completed_at: new Date().toISOString(),
          sync_run_id: syncRun.id,
          error_message: hasErrors
            ? result.errors.map(e => e.error).join('; ').slice(0, 500)
            : null,
        })
        .eq('id', request_id)
    })

    return {
      success: !hasErrors,
      duration,
      ...result,
    }
  }
)

// Scheduled sync function (triggered by Inngest cron)
export const scheduledSync = inngest.createFunction(
  {
    id: 'scheduled-sync',
    name: 'Scheduled Sync',
  },
  { cron: '*/15 * * * *' }, // Every 15 minutes - adjust as needed
  async ({ step }) => {
    // Get all enabled apps with schedules
    const apps = await step.run('get-scheduled-apps', async () => {
      const { data, error } = await supabaseAdmin
        .from('sync_apps')
        .select('id, sync_schedule_cron')
        .eq('is_enabled', true)
        .not('sync_schedule_cron', 'is', null)

      if (error) throw error
      return data
    })

    // Trigger sync for each app (Inngest handles fan-out)
    for (const app of apps) {
      await step.run(`trigger-${app.id}`, async () => {
        // Create a sync request
        const { data: request, error } = await supabaseAdmin
          .from('sync_requests')
          .insert({
            app_id: app.id,
            direction: 'both',
            requested_by: 'scheduled',
          })
          .select()
          .single()

        if (error) throw error

        // Send the sync event
        await inngest.send({
          name: 'sync/trigger',
          data: {
            app_id: app.id,
            direction: 'both',
            request_id: request.id,
            triggered_by: 'scheduled',
          },
        })
      })
    }

    return { triggered: apps.length }
  }
)

// Export all functions for the Inngest handler
export const functions = [syncApp, scheduledSync]
