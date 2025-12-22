// SMSI Sync Database Types
// Generated from the database schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Entity types used for external_ids and sync_status
export type EntityType =
  | 'employee'
  | 'customer'
  | 'vendor'
  | 'project'
  | 'department'
  | 'purchase_order'
  | 'time_sheet'
  | 'quote'

// System IDs for external platforms
export type SystemId =
  | 'creator'
  | 'crm'
  | 'intacct'
  | 'adp'
  | 'absorb'
  | 'ramp'
  | 'anyware'

// Sync direction
export type SyncDirection = 'import' | 'export' | 'both' | 'bidirectional'

// Status enums
export type SyncState = 'pending' | 'synced' | 'failed' | 'conflict'
export type SyncRunStatus = 'running' | 'completed' | 'failed' | 'partial'
export type SyncRequestStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
export type SyncAppStatus = 'success' | 'partial' | 'failed' | null

export interface Database {
  public: {
    Tables: {
      // ========================================
      // CORE ENTITY TABLES
      // ========================================
      departments: {
        Row: {
          id: string
          name: string
          code: string | null
          parent_id: string | null
          manager_id: string | null
          is_active: boolean
          is_deleted: boolean
          deleted_at: string | null
          raw_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['departments']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['departments']['Insert']>
      }
      employees: {
        Row: {
          id: string
          employee_number: string | null
          first_name: string
          last_name: string
          email: string | null
          phone: string | null
          title: string | null
          department_id: string | null
          hire_date: string | null
          termination_date: string | null
          employment_status: string
          is_active: boolean
          is_deleted: boolean
          deleted_at: string | null
          raw_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['employees']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['employees']['Insert']>
      }
      customers: {
        Row: {
          id: string
          name: string
          customer_number: string | null
          email: string | null
          phone: string | null
          address_line1: string | null
          address_line2: string | null
          city: string | null
          state: string | null
          postal_code: string | null
          country: string
          is_active: boolean
          is_deleted: boolean
          deleted_at: string | null
          raw_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }
      vendors: {
        Row: {
          id: string
          name: string
          vendor_number: string | null
          email: string | null
          phone: string | null
          address_line1: string | null
          address_line2: string | null
          city: string | null
          state: string | null
          postal_code: string | null
          country: string
          payment_terms: string | null
          is_active: boolean
          is_deleted: boolean
          deleted_at: string | null
          raw_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['vendors']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['vendors']['Insert']>
      }
      projects: {
        Row: {
          id: string
          project_number: string | null
          name: string
          description: string | null
          customer_id: string | null
          department_id: string | null
          project_manager_id: string | null
          status: string
          start_date: string | null
          end_date: string | null
          budget_amount: number | null
          is_active: boolean
          is_deleted: boolean
          deleted_at: string | null
          raw_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
      purchase_orders: {
        Row: {
          id: string
          po_number: string
          vendor_id: string | null
          project_id: string | null
          department_id: string | null
          requested_by: string | null
          approved_by: string | null
          status: string
          order_date: string | null
          expected_date: string | null
          total_amount: number | null
          notes: string | null
          is_deleted: boolean
          deleted_at: string | null
          raw_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['purchase_orders']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['purchase_orders']['Insert']>
      }
      time_sheets: {
        Row: {
          id: string
          employee_id: string
          project_id: string | null
          work_date: string
          hours_regular: number
          hours_overtime: number
          hours_total: number
          description: string | null
          status: string
          approved_by: string | null
          approved_at: string | null
          is_deleted: boolean
          deleted_at: string | null
          raw_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['time_sheets']['Row'], 'id' | 'hours_total' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['time_sheets']['Insert']>
      }
      quotes: {
        Row: {
          id: string
          quote_number: string
          customer_id: string | null
          project_id: string | null
          prepared_by: string | null
          status: string
          quote_date: string | null
          expiry_date: string | null
          total_amount: number | null
          notes: string | null
          is_deleted: boolean
          deleted_at: string | null
          raw_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['quotes']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['quotes']['Insert']>
      }

      // ========================================
      // INFRASTRUCTURE TABLES
      // ========================================
      external_ids: {
        Row: {
          id: string
          entity_type: EntityType
          internal_id: string
          system_id: SystemId
          external_id: string
          external_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['external_ids']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['external_ids']['Insert']>
      }
      sync_status: {
        Row: {
          id: string
          entity_type: EntityType
          entity_id: string
          system_id: SystemId
          sync_state: SyncState
          last_synced_at: string | null
          last_sync_hash: string | null
          last_error: string | null
          retry_count: number
          next_retry_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['sync_status']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['sync_status']['Insert']>
      }
      sync_runs: {
        Row: {
          id: string
          entity_type: string
          source_system: string
          target_system: string
          direction: string
          status: SyncRunStatus
          started_at: string
          completed_at: string | null
          records_processed: number
          records_created: number
          records_updated: number
          records_failed: number
          error_message: string | null
          metadata: Json | null
        }
        Insert: Omit<Database['public']['Tables']['sync_runs']['Row'], 'id' | 'started_at'> & { id?: string; started_at?: string }
        Update: Partial<Database['public']['Tables']['sync_runs']['Insert']>
      }
      change_log: {
        Row: {
          id: string
          entity_type: EntityType
          entity_id: string
          action: 'create' | 'update' | 'delete' | 'restore' | 'hard_delete'
          changed_by: string | null
          source_system: string | null
          old_data: Json | null
          new_data: Json | null
          changed_fields: string[] | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['change_log']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: never // Change log is append-only
      }

      // ========================================
      // SYNC MANAGEMENT TABLES
      // ========================================
      sync_apps: {
        Row: {
          id: string
          system_id: SystemId
          display_name: string
          display_order: number
          can_import: boolean
          can_export: boolean
          is_enabled: boolean
          last_sync_at: string | null
          last_sync_status: SyncAppStatus
          last_sync_message: string | null
          last_sync_duration_ms: number | null
          last_records_processed: number
          last_records_created: number
          last_records_updated: number
          last_records_failed: number
          sync_schedule_cron: string | null
          next_scheduled_sync: string | null
          config: Json | null
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
          direction: SyncDirection
          entity_types: string[] | null
          requested_by: string | null
          requested_at: string
          status: SyncRequestStatus
          started_at: string | null
          completed_at: string | null
          sync_run_id: string | null
          error_message: string | null
          metadata: Json | null
        }
        Insert: Omit<Database['public']['Tables']['sync_requests']['Row'], 'id' | 'requested_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['sync_requests']['Insert']>
      }
    }

    Views: {
      v_employees_with_ids: {
        Row: Database['public']['Tables']['employees']['Row'] & {
          creator_id: string | null
          crm_id: string | null
          intacct_id: string | null
          adp_id: string | null
          absorb_id: string | null
        }
      }
      v_projects_with_ids: {
        Row: Database['public']['Tables']['projects']['Row'] & {
          creator_id: string | null
          crm_id: string | null
          intacct_id: string | null
        }
      }
      v_sync_overview: {
        Row: {
          entity_type: EntityType
          system_id: SystemId
          sync_state: SyncState
          count: number
          latest_sync: string | null
        }
      }
      v_deleted_records: {
        Row: {
          entity_type: EntityType
          id: string
          name: string
          deleted_at: string | null
        }
      }
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
    }

    Functions: {
      request_sync: {
        Args: {
          p_app_id: string
          p_direction?: SyncDirection
          p_entity_types?: string[]
          p_requested_by?: string
        }
        Returns: string
      }
      soft_delete: {
        Args: {
          p_entity_type: EntityType
          p_entity_id: string
          p_deleted_by?: string
        }
        Returns: boolean
      }
      restore_deleted: {
        Args: {
          p_entity_type: EntityType
          p_entity_id: string
          p_restored_by?: string
        }
        Returns: boolean
      }
      hard_delete: {
        Args: {
          p_entity_type: EntityType
          p_entity_id: string
          p_deleted_by?: string
        }
        Returns: boolean
      }
      get_or_create_internal_id: {
        Args: {
          p_entity_type: EntityType
          p_system_id: SystemId
          p_external_id: string
          p_match_email?: string
        }
        Returns: string
      }
      calculate_record_hash: {
        Args: {
          p_data: Json
        }
        Returns: string
      }
    }
  }
}

// Convenience type aliases
export type Department = Database['public']['Tables']['departments']['Row']
export type Employee = Database['public']['Tables']['employees']['Row']
export type Customer = Database['public']['Tables']['customers']['Row']
export type Vendor = Database['public']['Tables']['vendors']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row']
export type TimeSheet = Database['public']['Tables']['time_sheets']['Row']
export type Quote = Database['public']['Tables']['quotes']['Row']

export type ExternalId = Database['public']['Tables']['external_ids']['Row']
export type SyncStatus = Database['public']['Tables']['sync_status']['Row']
export type SyncRun = Database['public']['Tables']['sync_runs']['Row']
export type ChangeLog = Database['public']['Tables']['change_log']['Row']
export type SyncApp = Database['public']['Tables']['sync_apps']['Row']
export type SyncRequest = Database['public']['Tables']['sync_requests']['Row']

export type EmployeeWithIds = Database['public']['Views']['v_employees_with_ids']['Row']
export type ProjectWithIds = Database['public']['Views']['v_projects_with_ids']['Row']
export type SyncOverview = Database['public']['Views']['v_sync_overview']['Row']
export type DeletedRecord = Database['public']['Views']['v_deleted_records']['Row']
export type SyncDashboardRow = Database['public']['Views']['v_sync_dashboard']['Row']
