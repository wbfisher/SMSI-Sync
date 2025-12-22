'use client'

import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  RefreshCw,
  Database,
  Settings,
  BarChart3
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type SidebarProps = {
  stats: {
    succeeded: number
    failed: number
    processing: number
    pending: number
  }
}

export function SyncSidebar({ stats }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo/Brand */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6 text-blue-600" />
          <span className="font-semibold text-gray-900">SMSI Sync</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md bg-blue-50 text-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Recurring Jobs
          </Link>

          <Link
            href="/history"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50"
          >
            <BarChart3 className="h-4 w-4" />
            History
          </Link>

          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-8">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Status
          </h3>
          <div className="mt-3 space-y-1">
            <StatItem
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Succeeded"
              count={stats.succeeded}
              color="green"
            />
            <StatItem
              icon={<XCircle className="h-4 w-4" />}
              label="Failed"
              count={stats.failed}
              color="red"
            />
            <StatItem
              icon={<RefreshCw className="h-4 w-4 animate-spin" />}
              label="Processing"
              count={stats.processing}
              color="blue"
              active={stats.processing > 0}
            />
            <StatItem
              icon={<Clock className="h-4 w-4" />}
              label="Pending"
              count={stats.pending}
              color="yellow"
            />
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          <p>America/Chicago</p>
          <p className="mt-1">v0.1.0</p>
        </div>
      </div>
    </aside>
  )
}

function StatItem({
  icon,
  label,
  count,
  color,
  active = false,
}: {
  icon: React.ReactNode
  label: string
  count: number
  color: 'green' | 'red' | 'blue' | 'yellow'
  active?: boolean
}) {
  const colorClasses = {
    green: 'text-green-600 bg-green-50',
    red: 'text-red-600 bg-red-50',
    blue: 'text-blue-600 bg-blue-50',
    yellow: 'text-yellow-600 bg-yellow-50',
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-2 text-sm rounded-md',
        count > 0 ? colorClasses[color] : 'text-gray-500'
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-medium">{count}</span>
    </div>
  )
}
