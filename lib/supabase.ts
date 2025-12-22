import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

// Client-side Supabase client (uses anon key)
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Server-side Supabase client (uses service role key for admin operations)
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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
  last_sync_status: 'success' | 'partial' | 'failed' | null
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
  direction: 'import' | 'export' | 'both'
  entity_types: string[] | null
  requested_by: string | null
  requested_at: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
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
  direction: 'export' | 'import' | 'bidirectional'
  status: 'running' | 'completed' | 'failed' | 'partial'
  started_at: string
  completed_at: string | null
  records_processed: number
  records_created: number
  records_updated: number
  records_failed: number
  error_message: string | null
}

// Dashboard view type (matches v_sync_dashboard)
export type SyncDashboardRow = SyncApp & {
  pending_request_id: string | null
  pending_direction: string | null
  pending_since: string | null
  current_request_id: string | null
  current_direction: string | null
  current_started_at: string | null
}
