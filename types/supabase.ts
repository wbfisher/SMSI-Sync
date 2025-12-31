// Types for Supabase database

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
        Insert: {
          id: string
          system_id: string
          display_name: string
          display_order: number
          can_import: boolean
          can_export: boolean
          is_enabled: boolean
          last_sync_at?: string | null
          last_sync_status?: string | null
          last_sync_message?: string | null
          last_sync_duration_ms?: number | null
          last_records_processed?: number
          last_records_created?: number
          last_records_updated?: number
          last_records_failed?: number
          sync_schedule_cron?: string | null
          next_scheduled_sync?: string | null
        }
        Update: {
          id?: string
          system_id?: string
          display_name?: string
          display_order?: number
          can_import?: boolean
          can_export?: boolean
          is_enabled?: boolean
          last_sync_at?: string | null
          last_sync_status?: string | null
          last_sync_message?: string | null
          last_sync_duration_ms?: number | null
          last_records_processed?: number
          last_records_created?: number
          last_records_updated?: number
          last_records_failed?: number
          sync_schedule_cron?: string | null
          next_scheduled_sync?: string | null
        }
        Relationships: []
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
        Insert: {
          id?: string
          app_id: string
          direction: string
          entity_types?: string[] | null
          requested_by?: string | null
          status?: string
          started_at?: string | null
          completed_at?: string | null
          sync_run_id?: string | null
          error_message?: string | null
        }
        Update: {
          id?: string
          app_id?: string
          direction?: string
          entity_types?: string[] | null
          requested_by?: string | null
          status?: string
          started_at?: string | null
          completed_at?: string | null
          sync_run_id?: string | null
          error_message?: string | null
        }
        Relationships: []
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
        Insert: {
          id?: string
          entity_type: string
          source_system: string
          target_system: string
          direction: string
          status: string
          completed_at?: string | null
          records_processed?: number
          records_created?: number
          records_updated?: number
          records_failed?: number
          error_message?: string | null
        }
        Update: {
          id?: string
          entity_type?: string
          source_system?: string
          target_system?: string
          direction?: string
          status?: string
          completed_at?: string | null
          records_processed?: number
          records_created?: number
          records_updated?: number
          records_failed?: number
          error_message?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_sync_dashboard: {
        Row: {
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
        Relationships: []
      }
      v_sync_overview: {
        Row: {
          entity_type: string | null
          system_id: string | null
          sync_state: string | null
          count: number | null
          latest_sync: string | null
        }
        Relationships: []
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
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
