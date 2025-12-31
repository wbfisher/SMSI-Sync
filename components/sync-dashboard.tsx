'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock
} from 'lucide-react'
import { cn, formatDuration, formatRelativeTime, parseCron } from '@/lib/utils'
import type { SyncDashboardRow, SyncRun } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'

type Props = {
  apps: SyncDashboardRow[]
  runs: SyncRun[]
}

export function SyncDashboard({ apps, runs }: Props) {
  const router = useRouter()

  const handleRefresh = useCallback(() => {
    router.refresh()
  }, [router])

  return (
    <div className="space-y-6">
      {/* Recurring Jobs Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-medium text-gray-700">Recurring Jobs</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Application
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Schedule
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Execution
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Next Execution
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Results
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {apps.map((app) => (
                <SyncAppRow key={app.id} app={app} onRefresh={handleRefresh} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">Recent Activity</h2>
          <span className="text-xs text-gray-500">{runs.length} runs</span>
        </div>
        
        <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
          {runs.slice(0, 10).map((run) => (
            <div key={run.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusIcon status={run.status} size="sm" />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {run.source_system} → {run.target_system}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    {run.entity_type}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{run.records_processed} records</span>
                <span>{formatDuration(run.completed_at ? new Date(run.completed_at).getTime() - new Date(run.started_at).getTime() : null)}</span>
                <span>{formatRelativeTime(run.started_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SyncAppRow({ app, onRefresh }: { app: SyncDashboardRow; onRefresh: () => void }) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const isProcessing = !!app.current_request_id

  const handleSync = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: app.id,
          direction: 'both',
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        toast({
          variant: 'destructive',
          title: 'Sync Failed',
          description: error.error || 'Failed to trigger sync',
        })
      } else {
        toast({
          title: 'Sync Started',
          description: `Sync triggered for ${app.display_name}`,
        })
        // Refresh data after a short delay
        setTimeout(onRefresh, 500)
      }
    } catch (err) {
      console.error('Sync error:', err)
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: 'Failed to trigger sync',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!app.pending_request_id && !app.current_request_id) return

    const requestId = app.pending_request_id || app.current_request_id
    try {
      const res = await fetch(`/api/sync?request_id=${requestId}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (res.ok) {
        toast({
          title: 'Sync Cancelled',
          description: data.was_processing
            ? 'Request cancelled (running job may still complete)'
            : 'Sync request cancelled',
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Cancel Failed',
          description: data.error || 'Failed to cancel sync',
        })
      }
      onRefresh()
    } catch (err) {
      console.error('Cancel error:', err)
      toast({
        variant: 'destructive',
        title: 'Cancel Failed',
        description: 'Failed to cancel sync',
      })
    }
  }

  return (
    <tr className={cn(!app.is_enabled && 'opacity-50 bg-gray-50')}>
      {/* Application */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-2 h-2 rounded-full',
            app.is_enabled ? 'bg-green-500' : 'bg-gray-300'
          )} />
          <div>
            <div className="text-sm font-medium text-gray-900">{app.display_name}</div>
            <div className="text-xs text-gray-500">
              {app.can_import && app.can_export ? 'Bidirectional' : app.can_import ? 'Import only' : 'Export only'}
            </div>
          </div>
        </div>
      </td>

      {/* Schedule */}
      <td className="px-4 py-4">
        <span className="text-sm text-gray-900">{parseCron(app.sync_schedule_cron)}</span>
      </td>

      {/* Last Execution */}
      <td className="px-4 py-4">
        <div className="text-sm text-gray-900">{formatRelativeTime(app.last_sync_at)}</div>
        {app.last_sync_duration_ms && (
          <div className="text-xs text-gray-500">{formatDuration(app.last_sync_duration_ms)}</div>
        )}
      </td>

      {/* Next Execution */}
      <td className="px-4 py-4">
        <span className="text-sm text-gray-500">
          {app.next_scheduled_sync 
            ? formatRelativeTime(app.next_scheduled_sync)
            : '-'
          }
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-4">
        {isProcessing ? (
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
            <span className="text-sm text-blue-600">Running</span>
          </div>
        ) : app.pending_request_id ? (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-yellow-600">Pending</span>
          </div>
        ) : (
          <StatusBadge status={app.last_sync_status} />
        )}
      </td>

      {/* Last Results */}
      <td className="px-4 py-4">
        {(app.last_records_processed ?? 0) > 0 ? (
          <div className="text-xs space-y-1">
            <div className="text-gray-900">{app.last_records_processed} processed</div>
            <div className="flex gap-2">
              {(app.last_records_created ?? 0) > 0 && (
                <span className="text-green-600">+{app.last_records_created}</span>
              )}
              {(app.last_records_updated ?? 0) > 0 && (
                <span className="text-blue-600">~{app.last_records_updated}</span>
              )}
              {(app.last_records_failed ?? 0) > 0 && (
                <span className="text-red-600">✕{app.last_records_failed}</span>
              )}
            </div>
          </div>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {isProcessing || app.pending_request_id ? (
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100"
            >
              <Pause className="h-3 w-3" />
              Cancel
            </button>
          ) : (
            <button
              onClick={handleSync}
              disabled={isLoading || !app.is_enabled}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              Sync Now
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return <span className="text-xs text-gray-400">Never run</span>
  }

  const configs = {
    success: {
      icon: CheckCircle2,
      text: 'Success',
      className: 'text-green-700 bg-green-50',
    },
    partial: {
      icon: AlertTriangle,
      text: 'Partial',
      className: 'text-yellow-700 bg-yellow-50',
    },
    failed: {
      icon: XCircle,
      text: 'Failed',
      className: 'text-red-700 bg-red-50',
    },
  }

  const config = configs[status as keyof typeof configs] || configs.failed
  const Icon = config.icon

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md',
      config.className
    )}>
      <Icon className="h-3 w-3" />
      {config.text}
    </span>
  )
}

function StatusIcon({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  
  switch (status) {
    case 'completed':
      return <CheckCircle2 className={cn(sizeClass, 'text-green-500')} />
    case 'failed':
      return <XCircle className={cn(sizeClass, 'text-red-500')} />
    case 'partial':
      return <AlertTriangle className={cn(sizeClass, 'text-yellow-500')} />
    case 'running':
      return <RefreshCw className={cn(sizeClass, 'text-blue-500 animate-spin')} />
    default:
      return <Clock className={cn(sizeClass, 'text-gray-400')} />
  }
}
