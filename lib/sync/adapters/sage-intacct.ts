// Sage Intacct Adapter
// Financial system - source of truth for accounting data

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

interface IntacctConfig extends AdapterConfig {
  baseUrl: string
  companyId: string
  senderId: string
  senderPassword: string
  objectTypes: Record<string, string> // Maps EntityType to Intacct object name
}

interface IntacctRecord {
  RECORDNO: string
  [key: string]: unknown
}

export class SageIntacctAdapter extends AbstractAdapter {
  readonly systemId = 'intacct'
  readonly displayName = 'Sage Intacct'
  readonly supportedEntityTypes: EntityType[] = [
    'employee',
    'customer',
    'vendor',
    'project',
    'time_sheet',
  ]
  readonly canImport = true
  readonly canExport = true

  private sessionId: string | null = null
  private sessionEndpoint: string | null = null

  protected async onInitialize(): Promise<void> {
    // Establish session with Intacct
    await this.createSession()
  }

  protected async onDisconnect(): Promise<void> {
    this.sessionId = null
    this.sessionEndpoint = null
  }

  private async createSession(): Promise<void> {
    const config = this.config as IntacctConfig

    if (this.credentials?.type !== 'custom') {
      throw new Error('SageIntacctAdapter requires custom credentials with userId and userPassword')
    }

    const { userId, userPassword } = this.credentials.data

    const requestXml = `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <control>
    <senderid>${config.senderId}</senderid>
    <password>${config.senderPassword}</password>
    <controlid>${Date.now()}</controlid>
    <uniqueid>false</uniqueid>
    <dtdversion>3.0</dtdversion>
    <includewhitespace>false</includewhitespace>
  </control>
  <operation>
    <authentication>
      <login>
        <userid>${userId}</userid>
        <companyid>${config.companyId}</companyid>
        <password>${userPassword}</password>
      </login>
    </authentication>
    <content>
      <function controlid="getSession">
        <getAPISession/>
      </function>
    </content>
  </operation>
</request>`

    const response = await fetch(config.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: requestXml,
    })

    const text = await response.text()

    // Parse XML response (simplified - use proper XML parser in production)
    const sessionIdMatch = text.match(/<sessionid>([^<]+)<\/sessionid>/)
    const endpointMatch = text.match(/<endpoint>([^<]+)<\/endpoint>/)

    if (!sessionIdMatch) {
      throw new Error('Failed to establish Intacct session')
    }

    this.sessionId = sessionIdMatch[1]
    this.sessionEndpoint = endpointMatch?.[1] || config.baseUrl
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      this.ensureInitialized()

      // Try to read a single employee record
      const response = await this.executeFunction(`
        <readByQuery>
          <object>EMPLOYEE</object>
          <query></query>
          <fields>RECORDNO,EMPLOYEEID</fields>
          <pagesize>1</pagesize>
        </readByQuery>
      `)

      return {
        success: !response.includes('<errormessage>'),
        message: 'Connection successful',
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
    const config = this.config as IntacctConfig

    const objectName = config.objectTypes[entityType]
    if (!objectName) {
      throw new Error(`No object mapping for entity type: ${entityType}`)
    }

    // Build query
    let query = ''
    if (options?.modifiedSince) {
      query = `WHENMODIFIED >= '${options.modifiedSince.toISOString().split('T')[0]}'`
    }

    const pageSize = options?.pageSize || 100
    const offset = options?.cursor ? parseInt(options.cursor) : 0

    const response = await this.executeFunction(`
      <readByQuery>
        <object>${objectName}</object>
        <query>${query}</query>
        <fields>*</fields>
        <pagesize>${pageSize}</pagesize>
        <returnformat>json</returnformat>
      </readByQuery>
    `)

    // Parse response (simplified)
    const records = this.parseRecords(response, objectName)
    const hasMore = records.length === pageSize

    return {
      records: records.map((record: IntacctRecord) => ({
        id: String(record.RECORDNO),
        data: record,
        metadata: {
          lastModified: record.WHENMODIFIED as string | undefined,
        },
      })),
      hasMore,
      nextCursor: hasMore ? String(offset + pageSize) : undefined,
    }
  }

  async fetchRecord(
    entityType: EntityType,
    externalId: string
  ): Promise<ExternalRecord | null> {
    this.ensureInitialized()
    const config = this.config as IntacctConfig

    const objectName = config.objectTypes[entityType]
    if (!objectName) {
      throw new Error(`No object mapping for entity type: ${entityType}`)
    }

    try {
      const response = await this.executeFunction(`
        <read>
          <object>${objectName}</object>
          <keys>${externalId}</keys>
          <fields>*</fields>
          <returnformat>json</returnformat>
        </read>
      `)

      const records = this.parseRecords(response, objectName)
      if (records.length === 0) return null

      const record = records[0]
      return {
        id: String(record.RECORDNO),
        data: record,
        metadata: {
          lastModified: record.WHENMODIFIED as string | undefined,
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
        if (record.externalId) {
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
    const config = this.config as IntacctConfig

    const objectName = config.objectTypes[entityType]
    if (!objectName) {
      return { success: false, error: `No object mapping for entity type: ${entityType}` }
    }

    try {
      const isUpdate = !!record.externalId
      const functionName = isUpdate ? 'update' : 'create'

      // Build XML for the record
      const fieldsXml = Object.entries(record.data)
        .map(([key, value]) => `<${key}>${this.escapeXml(String(value ?? ''))}</${key}>`)
        .join('\n')

      const recordXml = isUpdate
        ? `<${objectName}><RECORDNO>${record.externalId}</RECORDNO>${fieldsXml}</${objectName}>`
        : `<${objectName}>${fieldsXml}</${objectName}>`

      const response = await this.executeFunction(`
        <${functionName}>
          ${recordXml}
        </${functionName}>
      `)

      if (response.includes('<errormessage>')) {
        const errorMatch = response.match(/<description>([^<]+)<\/description>/)
        return {
          success: false,
          error: errorMatch?.[1] || 'Unknown Intacct error',
        }
      }

      // Extract new RECORDNO for creates
      const recordNoMatch = response.match(/<RECORDNO>([^<]+)<\/RECORDNO>/)
      return {
        success: true,
        externalId: recordNoMatch?.[1] || record.externalId,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  private async executeFunction(functionXml: string): Promise<string> {
    const config = this.config as IntacctConfig

    const requestXml = `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <control>
    <senderid>${config.senderId}</senderid>
    <password>${config.senderPassword}</password>
    <controlid>${Date.now()}</controlid>
    <uniqueid>false</uniqueid>
    <dtdversion>3.0</dtdversion>
    <includewhitespace>false</includewhitespace>
  </control>
  <operation>
    <authentication>
      <sessionid>${this.sessionId}</sessionid>
    </authentication>
    <content>
      <function controlid="func${Date.now()}">
        ${functionXml}
      </function>
    </content>
  </operation>
</request>`

    const response = await fetch(this.sessionEndpoint || config.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: requestXml,
    })

    return response.text()
  }

  private parseRecords(xmlResponse: string, objectName: string): IntacctRecord[] {
    // Simplified XML parsing - use proper XML parser in production
    // This looks for JSON response format if available
    try {
      const jsonMatch = xmlResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        if (Array.isArray(data)) return data
        if (data[objectName.toLowerCase()]) {
          const records = data[objectName.toLowerCase()]
          return Array.isArray(records) ? records : [records]
        }
      }
    } catch {
      // Fall back to empty array
    }
    return []
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }
}
