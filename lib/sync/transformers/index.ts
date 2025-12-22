// Transformer Registry
// Central point for accessing all entity transformers

import type { EntityType, SystemId } from '@/types/supabase'
import type { EntityTransformer } from './base'

// Employee transformers
import {
  CreatorEmployeeTransformer,
  IntacctEmployeeTransformer,
  ADPEmployeeTransformer,
} from './employee'

// Customer transformers
import {
  CreatorCustomerTransformer,
  IntacctCustomerTransformer,
  CRMCustomerTransformer,
} from './customer'

// Project transformers
import {
  CreatorProjectTransformer,
  IntacctProjectTransformer,
  CRMProjectTransformer,
} from './project'

// Type for transformer lookup key
type TransformerKey = `${SystemId}:${EntityType}`

// Registry of all transformers
const transformerRegistry: Partial<Record<TransformerKey, new () => EntityTransformer>> = {
  // Creator transformers
  'creator:employee': CreatorEmployeeTransformer,
  'creator:customer': CreatorCustomerTransformer,
  'creator:project': CreatorProjectTransformer,

  // Intacct transformers
  'intacct:employee': IntacctEmployeeTransformer,
  'intacct:customer': IntacctCustomerTransformer,
  'intacct:project': IntacctProjectTransformer,

  // CRM transformers
  'crm:customer': CRMCustomerTransformer,
  'crm:project': CRMProjectTransformer,

  // ADP transformers (import only)
  'adp:employee': ADPEmployeeTransformer,
}

// Cache for transformer instances
const transformerCache: Map<TransformerKey, EntityTransformer> = new Map()

// Get transformer for a system and entity type
export function getTransformer(systemId: SystemId, entityType: EntityType): EntityTransformer {
  const key: TransformerKey = `${systemId}:${entityType}`

  // Check cache
  if (transformerCache.has(key)) {
    return transformerCache.get(key)!
  }

  // Get transformer class
  const TransformerClass = transformerRegistry[key]
  if (!TransformerClass) {
    throw new Error(`No transformer found for ${systemId}:${entityType}`)
  }

  // Create and cache instance
  const transformer = new TransformerClass()
  transformerCache.set(key, transformer)

  return transformer
}

// Check if transformer exists
export function hasTransformer(systemId: SystemId, entityType: EntityType): boolean {
  const key: TransformerKey = `${systemId}:${entityType}`
  return key in transformerRegistry
}

// List all available transformers
export function listTransformers(): Array<{ systemId: SystemId; entityType: EntityType }> {
  return Object.keys(transformerRegistry).map((key) => {
    const [systemId, entityType] = key.split(':') as [SystemId, EntityType]
    return { systemId, entityType }
  })
}

// Get all entity types supported by a system
export function getSupportedEntityTypes(systemId: SystemId): EntityType[] {
  return Object.keys(transformerRegistry)
    .filter((key) => key.startsWith(`${systemId}:`))
    .map((key) => key.split(':')[1] as EntityType)
}

// Re-export base classes
export { AbstractTransformer, type EntityTransformer } from './base'
