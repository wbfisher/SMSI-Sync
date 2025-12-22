// ADP Adapter
// HR/Payroll system - import only, source for employee demographics

import type { EntityType } from '@/types/supabase'
import type {
  AdapterConfig,
  Credentials,
  ExternalRecord,
  PaginatedResponse,
  SyncResult,
  TransformedRecord,
} from '../types'
import { AbstractAdapter, type FetchOptions } from './base'

interface ADPConfig extends AdapterConfig {
  baseUrl: string
  clientId: string
  clientSecret: string
  sslCertPath?: string // ADP requires SSL client certificates
}

interface ADPWorker {
  associateOID: string
  workerID: {
    idValue: string
  }
  person: {
    legalName: {
      givenName: string
      familyName1: string
    }
    communication?: {
      emails?: Array<{ emailUri: string }>
      mobiles?: Array<{ formattedNumber: string }>
    }
  }
  workerDates?: {
    originalHireDate?: string
    terminationDate?: string
  }
  workerStatus?: {
    statusCode?: {
      codeValue: string
    }
  }
  businessCommunication?: {
    emails?: Array<{ emailUri: string }>
  }
  [key: string]: unknown
}

interface ADPResponse {
  workers: ADPWorker[]
  meta?: {
    totalNumber?: number
  }
  _links?: {
    next?: { href: string }
  }
}

export class ADPAdapter extends AbstractAdapter {
  readonly systemId = 'adp'
  readonly displayName = 'ADP'
  readonly supportedEntityTypes: EntityType[] = ['employee']
  readonly canImport = true
  readonly canExport = false // ADP is read-only for us

  private accessToken: string | null = null
  private tokenExpiresAt: Date | null = null

  protected async onInitialize(): Promise<void> {
    // ADP uses OAuth 2.0 with client credentials
    await this.refreshToken()
  }

  protected async onDisconnect(): Promise<void> {
    this.accessToken = null
    this.tokenExpiresAt = null
  }

  private async refreshToken(): Promise<void> {
    const config = this.config as ADPConfig

    // ADP OAuth flow - requires SSL client certificate in production
    const response = await fetch(`${config.baseUrl}/auth/oauth/v2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    })

    if (!response.ok) {
      throw new Error(`ADP auth failed: ${response.status}`)
    }

    const data = await response.json()
    this.accessToken = data.access_token
    this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000)
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiresAt || this.tokenExpiresAt <= new Date()) {
      await this.refreshToken()
    }
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      this.ensureInitialized()
      await this.ensureValidToken()

      const config = this.config as ADPConfig
      const response = await fetch(`${config.baseUrl}/hr/v2/workers?$top=1`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })

      return {
        success: response.ok,
        message: response.ok ? 'Connection successful' : `Error: ${response.status}`,
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async fetchRecords(
    entityType: EntityType,
    options?: FetchOptions
  ): Promise<PaginatedResponse<ExternalRecord>> {
    this.ensureInitialized()
    await this.ensureValidToken()

    if (entityType !== 'employee') {
      throw new Error(`ADP only supports employee entity type`)
    }

    const config = this.config as ADPConfig
    const pageSize = options?.pageSize || 100

    // Build query parameters
    const params = new URLSearchParams()
    params.set('$top', String(pageSize))

    if (options?.cursor) {
      params.set('$skip', options.cursor)
    }

    // ADP supports filtering by modification date
    if (options?.modifiedSince) {
      const dateStr = options.modifiedSince.toISOString().split('T')[0]
      params.set('$filter', `workerStatus/lastModifiedDateTime ge ${dateStr}`)
    }

    const response = await fetch(`${config.baseUrl}/hr/v2/workers?${params}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`ADP API error: ${response.status}`)
    }

    const data: ADPResponse = await response.json()

    const records: ExternalRecord[] = data.workers.map((worker) => ({
      id: worker.associateOID,
      data: this.flattenWorker(worker),
      metadata: {
        lastModified: worker.workerStatus?.statusCode?.codeValue,
      },
    }))

    const hasMore = !!data._links?.next
    const currentOffset = parseInt(options?.cursor || '0')

    return {
      records,
      hasMore,
      nextCursor: hasMore ? String(currentOffset + records.length) : undefined,
      total: data.meta?.totalNumber,
    }
  }

  async fetchRecord(
    entityType: EntityType,
    externalId: string
  ): Promise<ExternalRecord | null> {
    this.ensureInitialized()
    await this.ensureValidToken()

    if (entityType !== 'employee') {
      throw new Error(`ADP only supports employee entity type`)
    }

    const config = this.config as ADPConfig

    try {
      const response = await fetch(`${config.baseUrl}/hr/v2/workers/${externalId}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      const worker = data.workers?.[0]

      if (!worker) return null

      return {
        id: worker.associateOID,
        data: this.flattenWorker(worker),
      }
    } catch {
      return null
    }
  }

  // ADP is read-only - export operations not supported
  async pushRecords(): Promise<SyncResult> {
    throw new Error('ADP adapter does not support export operations')
  }

  async pushRecord(): Promise<{ success: boolean; externalId?: string; error?: string }> {
    return {
      success: false,
      error: 'ADP adapter does not support export operations',
    }
  }

  // Flatten nested ADP worker structure for easier mapping
  private flattenWorker(worker: ADPWorker): Record<string, unknown> {
    return {
      associateOID: worker.associateOID,
      employeeId: worker.workerID?.idValue,
      firstName: worker.person?.legalName?.givenName,
      lastName: worker.person?.legalName?.familyName1,
      email:
        worker.businessCommunication?.emails?.[0]?.emailUri ||
        worker.person?.communication?.emails?.[0]?.emailUri,
      phone: worker.person?.communication?.mobiles?.[0]?.formattedNumber,
      hireDate: worker.workerDates?.originalHireDate,
      terminationDate: worker.workerDates?.terminationDate,
      status: worker.workerStatus?.statusCode?.codeValue,
      // Store full record for raw_data
      _raw: worker,
    }
  }
}
