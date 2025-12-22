// Employee Transformers
// Handle mapping between Supabase employee records and external systems

import type { FieldMapping } from '../types'
import { AbstractTransformer } from './base'

// Zoho Creator Employee Transformer
export class CreatorEmployeeTransformer extends AbstractTransformer {
  entityType = 'employee' as const
  systemId = 'creator'

  protected getExternalIdField(): string {
    return 'creator_id'
  }

  protected getImportMappings(): FieldMapping[] {
    return [
      { source: 'Employee_Number', target: 'employee_number' },
      { source: 'First_Name', target: 'first_name', required: true },
      { source: 'Last_Name', target: 'last_name', required: true },
      { source: 'Email', target: 'email', transform: (v) => this.normalizeEmail(v) },
      { source: 'Phone', target: 'phone', transform: (v) => this.normalizePhone(v) },
      { source: 'Title', target: 'title' },
      { source: 'Department_ID', target: 'department_id' },
      { source: 'Hire_Date', target: 'hire_date', transform: (v) => this.parseDate(v) },
      { source: 'Termination_Date', target: 'termination_date', transform: (v) => this.parseDate(v) },
      {
        source: 'Status',
        target: 'employment_status',
        transform: (v) => this.mapStatus(v as string),
      },
      { source: 'Is_Active', target: 'is_active', transform: (v) => v === 'true' || v === true },
    ]
  }

  protected getExportMappings(): FieldMapping[] {
    return [
      { source: 'employee_number', target: 'Employee_Number' },
      { source: 'first_name', target: 'First_Name', required: true },
      { source: 'last_name', target: 'Last_Name', required: true },
      { source: 'email', target: 'Email' },
      { source: 'phone', target: 'Phone' },
      { source: 'title', target: 'Title' },
      { source: 'department_id', target: 'Department_ID' },
      { source: 'hire_date', target: 'Hire_Date' },
      { source: 'termination_date', target: 'Termination_Date' },
      {
        source: 'employment_status',
        target: 'Status',
        transform: (v) => this.mapStatusToCreator(v as string),
      },
      { source: 'is_active', target: 'Is_Active', transform: (v) => v ? 'true' : 'false' },
    ]
  }

  private mapStatus(creatorStatus: string): string {
    const mapping: Record<string, string> = {
      Active: 'active',
      Terminated: 'terminated',
      'On Leave': 'leave',
      Inactive: 'terminated',
    }
    return mapping[creatorStatus] || 'active'
  }

  private mapStatusToCreator(status: string): string {
    const mapping: Record<string, string> = {
      active: 'Active',
      terminated: 'Terminated',
      leave: 'On Leave',
    }
    return mapping[status] || 'Active'
  }
}

// Sage Intacct Employee Transformer
export class IntacctEmployeeTransformer extends AbstractTransformer {
  entityType = 'employee' as const
  systemId = 'intacct'

  protected getExternalIdField(): string {
    return 'intacct_id'
  }

  protected getImportMappings(): FieldMapping[] {
    return [
      { source: 'EMPLOYEEID', target: 'employee_number' },
      { source: 'FIRSTNAME', target: 'first_name', required: true },
      { source: 'LASTNAME', target: 'last_name', required: true },
      { source: 'EMAIL1', target: 'email', transform: (v) => this.normalizeEmail(v) },
      { source: 'PHONE1', target: 'phone', transform: (v) => this.normalizePhone(v) },
      { source: 'TITLE', target: 'title' },
      { source: 'DEPARTMENTID', target: 'department_id' },
      { source: 'STARTDATE', target: 'hire_date', transform: (v) => this.parseDate(v) },
      { source: 'ENDDATE', target: 'termination_date', transform: (v) => this.parseDate(v) },
      {
        source: 'STATUS',
        target: 'employment_status',
        transform: (v) => this.mapIntacctStatus(v as string),
      },
      {
        source: 'STATUS',
        target: 'is_active',
        transform: (v) => v === 'active',
      },
    ]
  }

  protected getExportMappings(): FieldMapping[] {
    return [
      { source: 'employee_number', target: 'EMPLOYEEID' },
      { source: 'first_name', target: 'FIRSTNAME', required: true },
      { source: 'last_name', target: 'LASTNAME', required: true },
      { source: 'email', target: 'EMAIL1' },
      { source: 'phone', target: 'PHONE1' },
      { source: 'title', target: 'TITLE' },
      { source: 'hire_date', target: 'STARTDATE' },
      { source: 'termination_date', target: 'ENDDATE' },
      {
        source: 'employment_status',
        target: 'STATUS',
        transform: (v) => this.mapStatusToIntacct(v as string),
      },
    ]
  }

  private mapIntacctStatus(intacctStatus: string): string {
    const mapping: Record<string, string> = {
      active: 'active',
      inactive: 'terminated',
    }
    return mapping[intacctStatus?.toLowerCase()] || 'active'
  }

  private mapStatusToIntacct(status: string): string {
    return status === 'active' ? 'active' : 'inactive'
  }
}

// ADP Employee Transformer
export class ADPEmployeeTransformer extends AbstractTransformer {
  entityType = 'employee' as const
  systemId = 'adp'

  protected getExternalIdField(): string {
    return 'adp_id'
  }

  protected getImportMappings(): FieldMapping[] {
    return [
      { source: 'employeeId', target: 'employee_number' },
      { source: 'firstName', target: 'first_name', required: true },
      { source: 'lastName', target: 'last_name', required: true },
      { source: 'email', target: 'email', transform: (v) => this.normalizeEmail(v) },
      { source: 'phone', target: 'phone', transform: (v) => this.normalizePhone(v) },
      { source: 'hireDate', target: 'hire_date', transform: (v) => this.parseDate(v) },
      { source: 'terminationDate', target: 'termination_date', transform: (v) => this.parseDate(v) },
      {
        source: 'status',
        target: 'employment_status',
        transform: (v) => this.mapADPStatus(v as string),
      },
      {
        source: 'status',
        target: 'is_active',
        transform: (v) => v === 'Active',
      },
    ]
  }

  // ADP is import-only, but we define empty export mappings
  protected getExportMappings(): FieldMapping[] {
    return []
  }

  private mapADPStatus(adpStatus: string): string {
    const mapping: Record<string, string> = {
      Active: 'active',
      Terminated: 'terminated',
      'Leave of Absence': 'leave',
      Inactive: 'terminated',
    }
    return mapping[adpStatus] || 'active'
  }
}
