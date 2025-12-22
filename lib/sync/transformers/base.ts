// Base Transformer - Interface for entity transformations
import type { EntityType, Json } from '@/types/supabase'
import type { ExternalRecord, TransformedRecord, FieldMapping } from '../types'

export interface EntityTransformer {
  entityType: EntityType
  systemId: string

  // Transform external record to Supabase format
  toSupabase(record: ExternalRecord): Promise<TransformedRecord>

  // Transform Supabase record to external format
  toExternal(record: Record<string, unknown>): Promise<TransformedRecord>
}

// Abstract base with common transformation logic
export abstract class AbstractTransformer implements EntityTransformer {
  abstract entityType: EntityType
  abstract systemId: string

  // Define field mappings (external → internal)
  protected abstract getImportMappings(): FieldMapping[]

  // Define field mappings (internal → external)
  protected abstract getExportMappings(): FieldMapping[]

  // Get the external ID field name
  protected abstract getExternalIdField(): string

  async toSupabase(record: ExternalRecord): Promise<TransformedRecord> {
    const mappings = this.getImportMappings()
    const data: Record<string, unknown> = {}

    for (const mapping of mappings) {
      const value = this.getNestedValue(record.data, mapping.source)
      const transformed = mapping.transform
        ? mapping.transform(value, record.data)
        : value

      if (transformed !== undefined || mapping.required) {
        data[mapping.target] = transformed ?? null
      }
    }

    return {
      externalId: record.id,
      entityType: this.entityType,
      data,
      rawData: record.data as Json,
    }
  }

  async toExternal(record: Record<string, unknown>): Promise<TransformedRecord> {
    const mappings = this.getExportMappings()
    const data: Record<string, unknown> = {}

    for (const mapping of mappings) {
      const value = this.getNestedValue(record, mapping.source)
      const transformed = mapping.transform
        ? mapping.transform(value, record)
        : value

      if (transformed !== undefined || mapping.required) {
        this.setNestedValue(data, mapping.target, transformed ?? null)
      }
    }

    return {
      internalId: record.id as string,
      externalId: record[this.getExternalIdField()] as string || '',
      entityType: this.entityType,
      data,
      rawData: record as Json,
    }
  }

  // Helper: Get value from nested path (e.g., "person.name.first")
  protected getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key]
      }
      return undefined
    }, obj)
  }

  // Helper: Set value at nested path
  protected setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!

    let current = obj
    for (const key of keys) {
      if (!(key in current)) {
        current[key] = {}
      }
      current = current[key] as Record<string, unknown>
    }

    current[lastKey] = value
  }

  // Common transformers
  protected parseDate(value: unknown): string | null {
    if (!value) return null
    if (typeof value === 'string') {
      const date = new Date(value)
      return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0]
    }
    return null
  }

  protected parseDecimal(value: unknown): number | null {
    if (value === null || value === undefined) return null
    const num = typeof value === 'string' ? parseFloat(value) : Number(value)
    return isNaN(num) ? null : num
  }

  protected normalizeEmail(value: unknown): string | null {
    if (!value || typeof value !== 'string') return null
    return value.toLowerCase().trim()
  }

  protected normalizePhone(value: unknown): string | null {
    if (!value || typeof value !== 'string') return null
    // Remove all non-numeric characters except + for country code
    return value.replace(/[^\d+]/g, '')
  }
}
