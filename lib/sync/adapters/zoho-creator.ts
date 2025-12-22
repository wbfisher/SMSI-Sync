// Zoho Creator Adapter
// Origin system - primary source of truth for most entities

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

interface ZohoCreatorConfig extends AdapterConfig {
  baseUrl: string
  accountOwnerName: string
  appName: string
  entityForms: Record<string, string> // Maps EntityType to form name
}

interface ZohoRecord {
  ID: string
  [key: string]: unknown
}

interface ZohoResponse {
  code: number
  data: ZohoRecord[]
  more_records?: boolean
}

export class ZohoCreatorAdapter extends AbstractAdapter {
  readonly systemId = 'creator'
  readonly displayName = 'Zoho Creator'
  readonly supportedEntityTypes: EntityType[] = [
    'employee',
    'customer',
    'vendor',
    'project',
    'quote',
    'purchase_order',
  ]
  readonly canImport = true
  readonly canExport = true

  private accessToken: string | null = null
  private tokenExpiresAt: Date | null = null
  private httpClient: typeof fetch = fetch

  protected async onInitialize(): Promise<void> {
    if (this.credentials?.type === 'oauth') {
      this.accessToken = this.credentials.token.accessToken
      this.tokenExpiresAt = this.credentials.token.expiresAt
    } else {
      throw new Error('ZohoCreatorAdapter requires OAuth credentials')
    }
  }

  protected async onDisconnect(): Promise<void> {
    this.accessToken = null
    this.tokenExpiresAt = null
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      this.ensureInitialized()
      const config = this.config as ZohoCreatorConfig

      const response = await this.makeRequest(
        `${config.baseUrl}/${config.accountOwnerName}/${config.appName}/report/Employees?limit=1`
      )

      return {
        success: response.code === 3000,
        message: response.code === 3000 ? 'Connection successful' : `Error code: ${response.code}`,
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
    const config = this.config as ZohoCreatorConfig

    const formName = config.entityForms[entityType]
    if (!formName) {
      throw new Error(`No form mapping for entity type: ${entityType}`)
    }

    // Build query parameters
    const params = new URLSearchParams()
    params.set('limit', String(options?.pageSize || 200))

    if (options?.cursor) {
      params.set('from', options.cursor)
    }

    if (options?.modifiedSince) {
      params.set('criteria', `Modified_Time >= '${options.modifiedSince.toISOString()}'`)
    }

    const url = `${config.baseUrl}/${config.accountOwnerName}/${config.appName}/report/${formName}?${params}`
    const response = await this.makeRequest(url)

    if (response.code !== 3000) {
      throw new Error(`Zoho API error: ${response.code}`)
    }

    const records: ExternalRecord[] = response.data.map((record: ZohoRecord) => ({
      id: String(record.ID),
      data: record,
      metadata: {
        lastModified: record.Modified_Time as string | undefined,
      },
    }))

    // Calculate next cursor for pagination
    const nextCursor = response.more_records
      ? String(Number(options?.cursor || 0) + records.length)
      : undefined

    return {
      records,
      hasMore: response.more_records || false,
      nextCursor,
    }
  }

  async fetchRecord(
    entityType: EntityType,
    externalId: string
  ): Promise<ExternalRecord | null> {
    this.ensureInitialized()
    const config = this.config as ZohoCreatorConfig

    const formName = config.entityForms[entityType]
    if (!formName) {
      throw new Error(`No form mapping for entity type: ${entityType}`)
    }

    const url = `${config.baseUrl}/${config.accountOwnerName}/${config.appName}/report/${formName}/${externalId}`

    try {
      const response = await this.makeRequest(url)

      if (response.code !== 3000 || !response.data?.[0]) {
        return null
      }

      const record = response.data[0]
      return {
        id: String(record.ID),
        data: record,
        metadata: {
          lastModified: record.Modified_Time as string | undefined,
        },
      }
    } catch {
      return null
    }
  }

  async pushRecords(
    entityType: EntityType,
    records: TransformedRecord[]
  ): Promise<SyncResult> {
    const result: SyncResult = {
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    }

    for (const record of records) {
      const pushResult = await this.pushRecord(entityType, record)
      result.processed++

      if (pushResult.success) {
        if (record.internalId) {
          result.updated++
        } else {
          result.created++
        }
      } else {
        result.failed++
        result.errors.push({
          entityType,
          externalId: record.externalId,
          internalId: record.internalId,
          error: pushResult.error || 'Unknown error',
        })
      }
    }

    return result
  }

  async pushRecord(
    entityType: EntityType,
    record: TransformedRecord
  ): Promise<{ success: boolean; externalId?: string; error?: string }> {
    this.ensureInitialized()
    const config = this.config as ZohoCreatorConfig

    const formName = config.entityForms[entityType]
    if (!formName) {
      return { success: false, error: `No form mapping for entity type: ${entityType}` }
    }

    try {
      const isUpdate = !!record.externalId
      const url = isUpdate
        ? `${config.baseUrl}/${config.accountOwnerName}/${config.appName}/form/${formName}/${record.externalId}`
        : `${config.baseUrl}/${config.accountOwnerName}/${config.appName}/form/${formName}`

      const response = await this.httpClient(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: record.data }),
      })

      const result = await response.json()

      if (result.code === 3000) {
        return {
          success: true,
          externalId: result.data?.ID ? String(result.data.ID) : record.externalId,
        }
      }

      return { success: false, error: `Zoho API error: ${result.code} - ${result.message}` }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // Zoho supports incremental sync via Modified_Time
  async fetchChanges(
    entityType: EntityType,
    since: Date
  ): Promise<PaginatedResponse<ExternalRecord>> {
    return this.fetchRecords(entityType, { modifiedSince: since })
  }

  private async makeRequest(url: string): Promise<ZohoResponse> {
    const response = await this.httpClient(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${this.accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }

    return response.json()
  }
}
