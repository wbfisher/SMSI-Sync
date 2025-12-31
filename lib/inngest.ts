import { Inngest } from 'inngest'
import { supabaseAdmin } from './supabase'
import { config } from './config'

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

// Sync result type
type SyncResult = {
  processed: number
  created: number
  updated: number
  failed: number
  error?: string
}

// Helper to determine final status based on results
function getResultStatus(result: SyncResult): 'completed' | 'partial' | 'failed' {
  if (result.error && result.processed === 0) return 'failed'
  if (result.failed > 0 && result.failed === result.processed) return 'failed'
  if (result.failed > 0) return 'partial'
  return 'completed'
}

// Helper to check if a cron expression matches the current time
function shouldRunNow(cronExpression: string): boolean {
  const now = new Date()
  const parts = cronExpression.split(' ')

  if (parts.length !== 5) return false

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  // Check minute
  if (minute !== '*' && !matchesCronPart(minute, now.getMinutes())) return false

  // Check hour
  if (hour !== '*' && !matchesCronPart(hour, now.getHours())) return false

  // Check day of month
  if (dayOfMonth !== '*' && !matchesCronPart(dayOfMonth, now.getDate())) return false

  // Check month (cron months are 1-12)
  if (month !== '*' && !matchesCronPart(month, now.getMonth() + 1)) return false

  // Check day of week (0-6, Sunday = 0)
  if (dayOfWeek !== '*' && !matchesCronPart(dayOfWeek, now.getDay())) return false

  return true
}

function matchesCronPart(cronPart: string, value: number): boolean {
  // Handle step values like */15
  if (cronPart.startsWith('*/')) {
    const step = parseInt(cronPart.slice(2), 10)
    return value % step === 0
  }

  // Handle ranges like 1-5
  if (cronPart.includes('-')) {
    const [start, end] = cronPart.split('-').map(n => parseInt(n, 10))
    return value >= start && value <= end
  }

  // Handle lists like 1,3,5
  if (cronPart.includes(',')) {
    const values = cronPart.split(',').map(n => parseInt(n, 10))
    return values.includes(value)
  }

  // Handle single value
  return parseInt(cronPart, 10) === value
}

// Calculate next run time from cron expression
function getNextRunTime(cronExpression: string): Date {
  const now = new Date()
  const parts = cronExpression.split(' ')

  if (parts.length !== 5) return new Date(now.getTime() + 15 * 60 * 1000) // Default: 15 min

  const [minute] = parts

  // Simple handling for common patterns
  if (minute.startsWith('*/')) {
    const step = parseInt(minute.slice(2), 10)
    const nextMinute = Math.ceil((now.getMinutes() + 1) / step) * step
    const next = new Date(now)
    next.setMinutes(nextMinute % 60)
    next.setSeconds(0)
    next.setMilliseconds(0)
    if (nextMinute >= 60) {
      next.setHours(next.getHours() + 1)
    }
    return next
  }

  // Default: add 1 hour
  return new Date(now.getTime() + 60 * 60 * 1000)
}

// Main sync function - handles both manual triggers and scheduled runs
export const syncApp = inngest.createFunction(
  {
    id: 'sync-app',
    name: 'Sync Application',
    retries: config.sync.maxRetries,
    onFailure: async ({ error, event }) => {
      // Access event data - the event structure includes data at event.data
      const eventData = event.data as { request_id?: string; app_id?: string }

      // Update request status on failure
      if (eventData.request_id) {
        const { error: updateError } = await supabaseAdmin
          .from('sync_requests')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error.message,
          })
          .eq('id', eventData.request_id)

        if (updateError) {
          console.error('Failed to update request status on failure:', updateError)
        }
      }

      // Update app status
      if (eventData.app_id) {
        const { error: appError } = await supabaseAdmin
          .from('sync_apps')
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: 'failed',
            last_sync_message: error.message,
          })
          .eq('id', eventData.app_id)

        if (appError) {
          console.error('Failed to update app status on failure:', appError)
        }
      }
    },
  },
  { event: 'sync/trigger' },
  async ({ event, step }) => {
    const { app_id, direction, entity_types, request_id } = event.data
    const startTime = Date.now()

    // Step 1: Check if request was cancelled before starting
    const shouldContinue = await step.run('check-not-cancelled', async () => {
      const { data } = await supabaseAdmin
        .from('sync_requests')
        .select('status')
        .eq('id', request_id)
        .single()

      return data?.status !== 'cancelled'
    })

    if (!shouldContinue) {
      return { cancelled: true, message: 'Request was cancelled before processing started' }
    }

    // Step 2: Mark request as processing
    await step.run('mark-processing', async () => {
      const { error } = await supabaseAdmin
        .from('sync_requests')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
        })
        .eq('id', request_id)

      if (error) {
        throw new Error(`Failed to mark request as processing: ${error.message}`)
      }
    })

    // Step 3: Create sync run record
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

      if (error) {
        throw new Error(`Failed to create sync run record: ${error.message}`)
      }
      return data
    })

    // Step 4: Check cancellation again before expensive operation
    const stillActive = await step.run('check-still-active', async () => {
      const { data } = await supabaseAdmin
        .from('sync_requests')
        .select('status')
        .eq('id', request_id)
        .single()

      return data?.status === 'processing'
    })

    if (!stillActive) {
      // Mark sync run as cancelled
      await step.run('mark-run-cancelled', async () => {
        await supabaseAdmin
          .from('sync_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: 'Request was cancelled',
          })
          .eq('id', syncRun.id)
      })
      return { cancelled: true, message: 'Request was cancelled during processing' }
    }

    // Step 5: Execute the actual sync based on app_id
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
    const status = getResultStatus(result)

    // Step 6: Update sync run with results
    await step.run('update-sync-run', async () => {
      const { error } = await supabaseAdmin
        .from('sync_runs')
        .update({
          status: status === 'completed' ? 'completed' : status === 'partial' ? 'partial' : 'failed',
          completed_at: new Date().toISOString(),
          records_processed: result.processed,
          records_created: result.created,
          records_updated: result.updated,
          records_failed: result.failed,
          error_message: result.error || null,
        })
        .eq('id', syncRun.id)

      if (error) {
        throw new Error(`Failed to update sync run: ${error.message}`)
      }
    })

    // Step 7: Update app status
    await step.run('update-app-status', async () => {
      const { error } = await supabaseAdmin
        .from('sync_apps')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: status === 'completed' ? 'success' : status,
          last_sync_message: result.error || null,
          last_sync_duration_ms: duration,
          last_records_processed: result.processed,
          last_records_created: result.created,
          last_records_updated: result.updated,
          last_records_failed: result.failed,
        })
        .eq('id', app_id)

      if (error) {
        throw new Error(`Failed to update app status: ${error.message}`)
      }
    })

    // Step 8: Complete the request
    await step.run('complete-request', async () => {
      const { error } = await supabaseAdmin
        .from('sync_requests')
        .update({
          status: status,
          completed_at: new Date().toISOString(),
          sync_run_id: syncRun.id,
          error_message: result.error || null,
        })
        .eq('id', request_id)

      if (error) {
        throw new Error(`Failed to complete request: ${error.message}`)
      }
    })

    return {
      success: status === 'completed',
      status,
      duration,
      ...result,
    }
  }
)

// Scheduled sync function (triggered by Inngest cron)
export const scheduledSync = inngest.createFunction(
  {
    id: 'scheduled-sync',
    name: 'Scheduled Sync Checker',
  },
  { cron: config.sync.schedulerCron },
  async ({ step }) => {
    // Get all enabled apps with schedules
    const apps = await step.run('get-scheduled-apps', async () => {
      const { data, error } = await supabaseAdmin
        .from('sync_apps')
        .select('id, sync_schedule_cron, display_name')
        .eq('is_enabled', true)
        .not('sync_schedule_cron', 'is', null)

      if (error) {
        throw new Error(`Failed to fetch scheduled apps: ${error.message}`)
      }
      return data || []
    })

    const triggered: string[] = []
    const skipped: string[] = []

    // Check each app's schedule and trigger if it should run now
    for (const app of apps) {
      if (!app.sync_schedule_cron) continue

      const shouldRun = shouldRunNow(app.sync_schedule_cron)

      if (shouldRun) {
        await step.run(`trigger-${app.id}`, async () => {
          // Check for existing pending/processing request
          const { data: existing } = await supabaseAdmin
            .from('sync_requests')
            .select('id')
            .eq('app_id', app.id)
            .in('status', ['pending', 'processing'])
            .limit(1)

          if (existing && existing.length > 0) {
            skipped.push(app.id)
            return { skipped: true, reason: 'Already has pending/processing request' }
          }

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

          if (error) {
            throw new Error(`Failed to create sync request for ${app.id}: ${error.message}`)
          }

          // Update next scheduled sync
          const nextRun = getNextRunTime(app.sync_schedule_cron!)
          await supabaseAdmin
            .from('sync_apps')
            .update({ next_scheduled_sync: nextRun.toISOString() })
            .eq('id', app.id)

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

          triggered.push(app.id)
          return { triggered: true }
        })
      } else {
        skipped.push(app.id)
      }
    }

    return {
      checked: apps.length,
      triggered: triggered.length,
      triggeredApps: triggered,
      skipped: skipped.length,
      skippedApps: skipped,
    }
  }
)

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
