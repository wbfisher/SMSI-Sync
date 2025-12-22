// Auto-generated types from Supabase
// Run `npx supabase gen types typescript` to regenerate

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      sync_apps: {
        Row: {
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
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['sync_apps']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['sync_apps']['Insert']>
      }
      sync_requests: {
        Row: {
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
        Insert: Omit<Database['public']['Tables']['sync_requests']['Row'], 'id' | 'requested_at'>
        Update: Partial<Database['public']['Tables']['sync_requests']['Insert']>
      }
      sync_runs: {
        Row: {
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
        Insert: Omit<Database['public']['Tables']['sync_runs']['Row'], 'id' | 'started_at'>
        Update: Partial<Database['public']['Tables']['sync_runs']['Insert']>
      }
    }
    Views: {
      v_sync_dashboard: {
        Row: Database['public']['Tables']['sync_apps']['Row'] & {
          pending_request_id: string | null
          pending_direction: string | null
          pending_since: string | null
          current_request_id: string | null
          current_direction: string | null
          current_started_at: string | null
        }
      }
      v_sync_overview: {
        Row: {
          entity_type: string
          system_id: string
          sync_state: string
          count: number
          latest_sync: string | null
        }
      }
    }
    Functions: {
      request_sync: {
        Args: {
          p_app_id: string
          p_direction?: string
          p_entity_types?: string[]
          p_requested_by?: string
        }
        Returns: string
      }
    }
  }
}
