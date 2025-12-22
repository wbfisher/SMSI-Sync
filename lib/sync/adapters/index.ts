// Adapter Registry
// Central point for accessing all platform adapters

import type { SystemId } from '@/types/supabase'
import type { AdapterConfig, Credentials } from '../types'
import type { BaseAdapter } from './base'

import { ZohoCreatorAdapter } from './zoho-creator'
import { SageIntacctAdapter } from './sage-intacct'
import { ADPAdapter } from './adp'

// Registry of adapter classes
const adapterRegistry: Record<SystemId, new () => BaseAdapter> = {
  creator: ZohoCreatorAdapter,
  intacct: SageIntacctAdapter,
  adp: ADPAdapter,
  // TODO: Implement these adapters
  crm: ZohoCreatorAdapter, // Placeholder - needs ZohoCRMAdapter
  absorb: ADPAdapter, // Placeholder - needs AbsorbAdapter
  ramp: ADPAdapter, // Placeholder - needs RampAdapter
  anyware: ADPAdapter, // Placeholder - needs AnywareAdapter
}

// Create and initialize an adapter
export async function createAdapter(
  systemId: SystemId,
  config: AdapterConfig,
  credentials: Credentials
): Promise<BaseAdapter> {
  const AdapterClass = adapterRegistry[systemId]
  if (!AdapterClass) {
    throw new Error(`No adapter registered for system: ${systemId}`)
  }

  const adapter = new AdapterClass()
  await adapter.initialize(config, credentials)
  return adapter
}

// Get adapter class without initializing
export function getAdapterClass(systemId: SystemId): (new () => BaseAdapter) | undefined {
  return adapterRegistry[systemId]
}

// Check if adapter exists
export function hasAdapter(systemId: SystemId): boolean {
  return systemId in adapterRegistry
}

// List all registered adapters
export function listAdapters(): SystemId[] {
  return Object.keys(adapterRegistry) as SystemId[]
}

// Re-export adapter classes
export { ZohoCreatorAdapter } from './zoho-creator'
export { SageIntacctAdapter } from './sage-intacct'
export { ADPAdapter } from './adp'
export { AbstractAdapter, type BaseAdapter, type FetchOptions } from './base'
