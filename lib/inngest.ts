import { Inngest } from 'inngest'
import { supabaseAdmin } from './supabase'

// Create Inngest client
export const inngest = new Inngest({ 
  id: 'smsi-sync',
  name: 'SMSI Sync'
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

    // Step 2: Create sync run record
    const syncRun = await step.run('create-sync-run', async () => {
      const { data, error } = await supabaseAdmin
        .from('sync_runs')
        .insert({
          entity_type: entity_types?.[0] || 'all',
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

    // Step 3: Execute the actual sync based on app_id
    const result = await step.run('execute-sync', async () => {
      // Route to appropriate sync handler
      switch (app_id) {
        case 'creator':
          return await syncCreator(direction, entity_types)
        case 'crm':
          return await syncCRM(direction, entity_types)
        case 'intacct':
          return await syncIntacct(direction, entity_types)
        case 'adp':
          return await syncADP()
        case 'absorb':
          return await syncAbsorb()
        case 'ramp':
          return await syncRamp()
        default:
          throw new Error(`Unknown app: ${app_id}`)
      }
    })

    const duration = Date.now() - startTime

    // Step 4: Update sync run with results
    await step.run('update-sync-run', async () => {
      await supabaseAdmin
        .from('sync_runs')
        .update({
          status: result.failed > 0 ? 'partial' : 'completed',
          completed_at: new Date().toISOString(),
          records_processed: result.processed,
          records_created: result.created,
          records_updated: result.updated,
          records_failed: result.failed,
          error_message: result.error,
        })
        .eq('id', syncRun.id)
    })

    // Step 5: Update app status
    await step.run('update-app-status', async () => {
      await supabaseAdmin
        .from('sync_apps')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: result.failed > 0 ? 'partial' : 'success',
          last_sync_message: result.error || null,
          last_sync_duration_ms: duration,
          last_records_processed: result.processed,
          last_records_created: result.created,
          last_records_updated: result.updated,
          last_records_failed: result.failed,
        })
        .eq('id', app_id)
    })

    // Step 6: Complete the request
    await step.run('complete-request', async () => {
      await supabaseAdmin
        .from('sync_requests')
        .update({
          status: result.failed > 0 ? 'failed' : 'completed',
          completed_at: new Date().toISOString(),
          sync_run_id: syncRun.id,
          error_message: result.error,
        })
        .eq('id', request_id)
    })

    return {
      success: result.failed === 0,
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

// Sync result type
type SyncResult = {
  processed: number
  created: number
  updated: number
  failed: number
  error?: string
}

// Placeholder sync handlers - implement actual API calls
async function syncCreator(direction: string, entityTypes?: string[]): Promise<SyncResult> {
  // TODO: Implement Zoho Creator sync
  console.log('Syncing Creator:', { direction, entityTypes })
  return { processed: 0, created: 0, updated: 0, failed: 0 }
}

async function syncCRM(direction: string, entityTypes?: string[]): Promise<SyncResult> {
  // TODO: Implement Zoho CRM sync
  console.log('Syncing CRM:', { direction, entityTypes })
  return { processed: 0, created: 0, updated: 0, failed: 0 }
}

async function syncIntacct(direction: string, entityTypes?: string[]): Promise<SyncResult> {
  // TODO: Implement Sage Intacct sync
  console.log('Syncing Intacct:', { direction, entityTypes })
  return { processed: 0, created: 0, updated: 0, failed: 0 }
}

async function syncADP(): Promise<SyncResult> {
  // TODO: Implement ADP sync (import only)
  console.log('Syncing ADP')
  return { processed: 0, created: 0, updated: 0, failed: 0 }
}

async function syncAbsorb(): Promise<SyncResult> {
  // TODO: Implement Absorb LMS sync (import only)
  console.log('Syncing Absorb')
  return { processed: 0, created: 0, updated: 0, failed: 0 }
}

async function syncRamp(): Promise<SyncResult> {
  // TODO: Implement Ramp sync (import only)
  console.log('Syncing Ramp')
  return { processed: 0, created: 0, updated: 0, failed: 0 }
}

// Export all functions for the Inngest handler
export const functions = [syncApp, scheduledSync]
