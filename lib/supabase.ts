import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'
import { env } from './env'

// Client-side Supabase client (uses anon key)
export const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY
)

// Server-side Supabase client (uses service role key for admin operations)
export const supabaseAdmin = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

// Types for sync-related tables
export type SyncApp = {
  id: string
  system_id: string
  display_name: string
  display_order: number
  can_import: boolean
  can_export: boolean
  is_enabled: boolean
  last_sync_at: string | null
  last_sync_status: string | null
  last_sync_message: string | null
  last_sync_duration_ms: number | null
  last_records_processed: number
  last_records_created: number
  last_records_updated: number
  last_records_failed: number
  sync_schedule_cron: string | null
  next_scheduled_sync: string | null
}

export type SyncRequest = {
  id: string
  app_id: string
  direction: string
  entity_types: string[] | null
  requested_by: string | null
  requested_at: string
  status: string
  started_at: string | null
  completed_at: string | null
  sync_run_id: string | null
  error_message: string | null
}

export type SyncRun = {
  id: string
  entity_type: string
  source_system: string
  target_system: string
  direction: string
  status: string
  started_at: string
  completed_at: string | null
  records_processed: number
  records_created: number
  records_updated: number
  records_failed: number
  error_message: string | null
}

// Dashboard view type (matches v_sync_dashboard)
// Note: Views return nullable fields
export type SyncDashboardRow = {
  id: string | null
  system_id: string | null
  display_name: string | null
  display_order: number | null
  can_import: boolean | null
  can_export: boolean | null
  is_enabled: boolean | null
  last_sync_at: string | null
  last_sync_status: string | null
  last_sync_message: string | null
  last_sync_duration_ms: number | null
  last_records_processed: number | null
  last_records_created: number | null
  last_records_updated: number | null
  last_records_failed: number | null
  sync_schedule_cron: string | null
  next_scheduled_sync: string | null
  created_at: string | null
  updated_at: string | null
  pending_request_id: string | null
  pending_direction: string | null
  pending_since: string | null
  current_request_id: string | null
  current_direction: string | null
  current_started_at: string | null
}
