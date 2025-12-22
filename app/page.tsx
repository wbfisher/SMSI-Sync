import { Suspense } from 'react'
import { SyncDashboard } from '@/components/sync-dashboard'
import { SyncSidebar } from '@/components/sync-sidebar'
import { supabaseAdmin } from '@/lib/supabase'

async function getSyncData() {
  // Get dashboard view data
  const { data: apps, error: appsError } = await supabaseAdmin
    .from('v_sync_dashboard')
    .select('*')
    .order('display_order')

  // Get recent runs for history
  const { data: runs, error: runsError } = await supabaseAdmin
    .from('sync_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(50)

  // Get sync status counts
  const { data: statusCounts, error: statusError } = await supabaseAdmin
    .from('v_sync_overview')
    .select('*')

  if (appsError || runsError || statusError) {
    console.error('Error fetching sync data:', { appsError, runsError, statusError })
  }

  return {
    apps: apps || [],
    runs: runs || [],
    statusCounts: statusCounts || [],
  }
}

export default async function SyncPage() {
  const { apps, runs, statusCounts } = await getSyncData()

  // Calculate sidebar stats
  const stats = {
    succeeded: runs.filter(r => r.status === 'completed').length,
    failed: runs.filter(r => r.status === 'failed').length,
    processing: runs.filter(r => r.status === 'running').length,
    pending: statusCounts
      .filter(s => s.sync_state === 'pending')
      .reduce((sum, s) => sum + (s.count || 0), 0),
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <SyncSidebar stats={stats} />

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">SMSI Sync</h1>
            <p className="text-sm text-gray-500 mt-1">
              Data synchronization between Creator, CRM, Intacct, and external systems
            </p>
          </div>

          <Suspense fallback={<div>Loading...</div>}>
            <SyncDashboard apps={apps} runs={runs} />
          </Suspense>
        </div>
      </main>
    </div>
  )
}

// Revalidate every 30 seconds
export const revalidate = 30
