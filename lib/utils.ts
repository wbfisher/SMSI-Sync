import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(ms: number | null): string {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

export function formatRelativeTime(date: string | null): string {
  if (!date) return 'Never'
  
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return then.toLocaleDateString()
}

export function parseCron(cron: string | null): string {
  if (!cron) return 'Manual only'
  
  // Simple cron parsing for common patterns
  const parts = cron.split(' ')
  if (parts.length !== 5) return cron
  
  const [minute, hour, dayMonth, month, dayWeek] = parts
  
  if (minute === '0' && hour === '*') return 'Every hour'
  if (minute.startsWith('*/')) return `Every ${minute.slice(2)} minutes`
  if (hour.startsWith('*/')) return `Every ${hour.slice(2)} hours`
  if (minute === '0' && hour !== '*' && dayWeek === '*') {
    return `Daily at ${hour}:00`
  }
  
  return cron
}
