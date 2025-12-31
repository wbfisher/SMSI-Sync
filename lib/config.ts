// Application configuration
import { env } from './env'

export const config = {
  // App metadata
  appName: 'SMSI Sync',
  version: '0.1.0',

  // Timezone for display
  timezone: env.APP_TIMEZONE,

  // Sync settings
  sync: {
    // How often the scheduled sync checker runs (in cron format)
    schedulerCron: '*/15 * * * *',

    // Maximum retries for failed syncs
    maxRetries: 3,

    // Revalidation interval for dashboard (seconds)
    revalidateInterval: 30,
  },

  // Pagination
  pagination: {
    recentActivityLimit: 10,
    historyPageSize: 50,
  },
} as const

export type Config = typeof config
