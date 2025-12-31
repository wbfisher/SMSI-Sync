import { Suspense } from 'react'
import { SyncDashboard } from '@/components/sync-dashboard'
import { SyncSidebar } from '@/components/sync-sidebar'
import { supabaseAdmin } from '@/lib/supabase'
import { config } from '@/lib/config'

async function getSyncData() {
  // Run all queries in parallel for better performance
  const [
    appsResult,
    runsResult,
    completedCountResult,
    failedCountResult,
    runningCountResult,
    pendingCountResult,
  ] = await Promise.all([
    // Get dashboard view data
    supabaseAdmin
      .from('v_sync_dashboard')
      .select('*')
      .order('display_order'),

    // Get recent runs for activity feed (limited)
    supabaseAdmin
      .from('sync_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(config.pagination.historyPageSize),

    // Get accurate counts for stats
    supabaseAdmin
      .from('sync_runs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed'),

    supabaseAdmin
      .from('sync_runs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed'),

    supabaseAdmin
      .from('sync_runs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'running'),

    supabaseAdmin
      .from('sync_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  if (appsResult.error || runsResult.error) {
    console.error('Error fetching sync data:', {
      appsError: appsResult.error,
      runsError: runsResult.error,
    })
  }

  return {
    apps: appsResult.data || [],
    runs: runsResult.data || [],
    stats: {
      succeeded: completedCountResult.count || 0,
      failed: failedCountResult.count || 0,
      processing: runningCountResult.count || 0,
      pending: pendingCountResult.count || 0,
    },
  }
}

export default async function SyncPage() {
  const { apps, runs, stats } = await getSyncData()

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

// Revalidate based on config
export const revalidate = config.sync.revalidateInterval
