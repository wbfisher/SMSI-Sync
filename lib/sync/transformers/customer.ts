// Customer Transformers
// Handle mapping between Supabase customer records and external systems

import type { FieldMapping } from '../types'
import { AbstractTransformer } from './base'

// Zoho Creator Customer Transformer
export class CreatorCustomerTransformer extends AbstractTransformer {
  entityType = 'customer' as const
  systemId = 'creator'

  protected getExternalIdField(): string {
    return 'creator_id'
  }

  protected getImportMappings(): FieldMapping[] {
    return [
      { source: 'Name', target: 'name', required: true },
      { source: 'Customer_Number', target: 'customer_number' },
      { source: 'Email', target: 'email', transform: (v) => this.normalizeEmail(v) },
      { source: 'Phone', target: 'phone', transform: (v) => this.normalizePhone(v) },
      { source: 'Address_Line1', target: 'address_line1' },
      { source: 'Address_Line2', target: 'address_line2' },
      { source: 'City', target: 'city' },
      { source: 'State', target: 'state' },
      { source: 'Postal_Code', target: 'postal_code' },
      { source: 'Country', target: 'country' },
      { source: 'Is_Active', target: 'is_active', transform: (v) => v === 'true' || v === true },
    ]
  }

  protected getExportMappings(): FieldMapping[] {
    return [
      { source: 'name', target: 'Name', required: true },
      { source: 'customer_number', target: 'Customer_Number' },
      { source: 'email', target: 'Email' },
      { source: 'phone', target: 'Phone' },
      { source: 'address_line1', target: 'Address_Line1' },
      { source: 'address_line2', target: 'Address_Line2' },
      { source: 'city', target: 'City' },
      { source: 'state', target: 'State' },
      { source: 'postal_code', target: 'Postal_Code' },
      { source: 'country', target: 'Country' },
      { source: 'is_active', target: 'Is_Active', transform: (v) => v ? 'true' : 'false' },
    ]
  }
}

// Sage Intacct Customer Transformer
export class IntacctCustomerTransformer extends AbstractTransformer {
  entityType = 'customer' as const
  systemId = 'intacct'

  protected getExternalIdField(): string {
    return 'intacct_id'
  }

  protected getImportMappings(): FieldMapping[] {
    return [
      { source: 'NAME', target: 'name', required: true },
      { source: 'CUSTOMERID', target: 'customer_number' },
      { source: 'EMAIL1', target: 'email', transform: (v) => this.normalizeEmail(v) },
      { source: 'PHONE1', target: 'phone', transform: (v) => this.normalizePhone(v) },
      { source: 'MAILADDRESS.ADDRESS1', target: 'address_line1' },
      { source: 'MAILADDRESS.ADDRESS2', target: 'address_line2' },
      { source: 'MAILADDRESS.CITY', target: 'city' },
      { source: 'MAILADDRESS.STATE', target: 'state' },
      { source: 'MAILADDRESS.ZIP', target: 'postal_code' },
      { source: 'MAILADDRESS.COUNTRY', target: 'country' },
      { source: 'STATUS', target: 'is_active', transform: (v) => v === 'active' },
    ]
  }

  protected getExportMappings(): FieldMapping[] {
    return [
      { source: 'name', target: 'NAME', required: true },
      { source: 'customer_number', target: 'CUSTOMERID' },
      { source: 'email', target: 'EMAIL1' },
      { source: 'phone', target: 'PHONE1' },
      { source: 'address_line1', target: 'MAILADDRESS.ADDRESS1' },
      { source: 'address_line2', target: 'MAILADDRESS.ADDRESS2' },
      { source: 'city', target: 'MAILADDRESS.CITY' },
      { source: 'state', target: 'MAILADDRESS.STATE' },
      { source: 'postal_code', target: 'MAILADDRESS.ZIP' },
      { source: 'country', target: 'MAILADDRESS.COUNTRY' },
      { source: 'is_active', target: 'STATUS', transform: (v) => v ? 'active' : 'inactive' },
    ]
  }
}

// Zoho CRM Account (Customer) Transformer
export class CRMCustomerTransformer extends AbstractTransformer {
  entityType = 'customer' as const
  systemId = 'crm'

  protected getExternalIdField(): string {
    return 'crm_id'
  }

  protected getImportMappings(): FieldMapping[] {
    return [
      { source: 'Account_Name', target: 'name', required: true },
      { source: 'Account_Number', target: 'customer_number' },
      { source: 'Email', target: 'email', transform: (v) => this.normalizeEmail(v) },
      { source: 'Phone', target: 'phone', transform: (v) => this.normalizePhone(v) },
      { source: 'Billing_Street', target: 'address_line1' },
      { source: 'Billing_City', target: 'city' },
      { source: 'Billing_State', target: 'state' },
      { source: 'Billing_Code', target: 'postal_code' },
      { source: 'Billing_Country', target: 'country' },
      {
        source: 'Account_Status',
        target: 'is_active',
        transform: (v) => v === 'Active' || v === 'active',
      },
    ]
  }

  protected getExportMappings(): FieldMapping[] {
    return [
      { source: 'name', target: 'Account_Name', required: true },
      { source: 'customer_number', target: 'Account_Number' },
      { source: 'email', target: 'Email' },
      { source: 'phone', target: 'Phone' },
      { source: 'address_line1', target: 'Billing_Street' },
      { source: 'city', target: 'Billing_City' },
      { source: 'state', target: 'Billing_State' },
      { source: 'postal_code', target: 'Billing_Code' },
      { source: 'country', target: 'Billing_Country' },
      { source: 'is_active', target: 'Account_Status', transform: (v) => v ? 'Active' : 'Inactive' },
    ]
  }
}
