import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

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

// Re-export commonly used types from the central types file
export type {
  // Core entities
  Department,
  Employee,
  Customer,
  Vendor,
  Project,
  PurchaseOrder,
  TimeSheet,
  Quote,
  // Infrastructure
  ExternalId,
  SyncStatus,
  SyncRun,
  ChangeLog,
  // Sync management
  SyncApp,
  SyncRequest,
  // Views
  EmployeeWithIds,
  ProjectWithIds,
  SyncOverview,
  DeletedRecord,
  SyncDashboardRow,
  // Enums
  EntityType,
  SystemId,
  SyncDirection,
  SyncState,
  SyncRunStatus,
  SyncRequestStatus,
  SyncAppStatus,
} from '@/types/supabase'
