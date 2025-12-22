// Project Transformers
// Handle mapping between Supabase project records and external systems

import type { FieldMapping } from '../types'
import { AbstractTransformer } from './base'

// Zoho Creator Project Transformer
export class CreatorProjectTransformer extends AbstractTransformer {
  entityType = 'project' as const
  systemId = 'creator'

  protected getExternalIdField(): string {
    return 'creator_id'
  }

  protected getImportMappings(): FieldMapping[] {
    return [
      { source: 'Project_Number', target: 'project_number' },
      { source: 'Name', target: 'name', required: true },
      { source: 'Description', target: 'description' },
      { source: 'Customer_ID', target: 'customer_id' },
      { source: 'Department_ID', target: 'department_id' },
      { source: 'Project_Manager_ID', target: 'project_manager_id' },
      { source: 'Status', target: 'status', transform: (v) => this.mapStatus(v as string) },
      { source: 'Start_Date', target: 'start_date', transform: (v) => this.parseDate(v) },
      { source: 'End_Date', target: 'end_date', transform: (v) => this.parseDate(v) },
      { source: 'Budget', target: 'budget_amount', transform: (v) => this.parseDecimal(v) },
      { source: 'Is_Active', target: 'is_active', transform: (v) => v === 'true' || v === true },
    ]
  }

  protected getExportMappings(): FieldMapping[] {
    return [
      { source: 'project_number', target: 'Project_Number' },
      { source: 'name', target: 'Name', required: true },
      { source: 'description', target: 'Description' },
      { source: 'customer_id', target: 'Customer_ID' },
      { source: 'department_id', target: 'Department_ID' },
      { source: 'project_manager_id', target: 'Project_Manager_ID' },
      { source: 'status', target: 'Status', transform: (v) => this.mapStatusToCreator(v as string) },
      { source: 'start_date', target: 'Start_Date' },
      { source: 'end_date', target: 'End_Date' },
      { source: 'budget_amount', target: 'Budget' },
      { source: 'is_active', target: 'Is_Active', transform: (v) => v ? 'true' : 'false' },
    ]
  }

  private mapStatus(creatorStatus: string): string {
    const mapping: Record<string, string> = {
      Active: 'active',
      Completed: 'completed',
      'On Hold': 'on_hold',
      Cancelled: 'cancelled',
    }
    return mapping[creatorStatus] || 'active'
  }

  private mapStatusToCreator(status: string): string {
    const mapping: Record<string, string> = {
      active: 'Active',
      completed: 'Completed',
      on_hold: 'On Hold',
      cancelled: 'Cancelled',
    }
    return mapping[status] || 'Active'
  }
}

// Sage Intacct Project Transformer
export class IntacctProjectTransformer extends AbstractTransformer {
  entityType = 'project' as const
  systemId = 'intacct'

  protected getExternalIdField(): string {
    return 'intacct_id'
  }

  protected getImportMappings(): FieldMapping[] {
    return [
      { source: 'PROJECTID', target: 'project_number' },
      { source: 'NAME', target: 'name', required: true },
      { source: 'DESCRIPTION', target: 'description' },
      { source: 'CUSTOMERID', target: 'customer_id' },
      { source: 'DEPARTMENTID', target: 'department_id' },
      { source: 'PROJECTMANAGERID', target: 'project_manager_id' },
      { source: 'STATUS', target: 'status', transform: (v) => this.mapIntacctStatus(v as string) },
      { source: 'BEGINDATE', target: 'start_date', transform: (v) => this.parseDate(v) },
      { source: 'ENDDATE', target: 'end_date', transform: (v) => this.parseDate(v) },
      { source: 'BUDGETAMOUNT', target: 'budget_amount', transform: (v) => this.parseDecimal(v) },
      { source: 'STATUS', target: 'is_active', transform: (v) => v === 'active' },
    ]
  }

  protected getExportMappings(): FieldMapping[] {
    return [
      { source: 'project_number', target: 'PROJECTID' },
      { source: 'name', target: 'NAME', required: true },
      { source: 'description', target: 'DESCRIPTION' },
      { source: 'start_date', target: 'BEGINDATE' },
      { source: 'end_date', target: 'ENDDATE' },
      { source: 'budget_amount', target: 'BUDGETAMOUNT' },
      { source: 'status', target: 'STATUS', transform: (v) => this.mapStatusToIntacct(v as string) },
    ]
  }

  private mapIntacctStatus(intacctStatus: string): string {
    const mapping: Record<string, string> = {
      active: 'active',
      completed: 'completed',
      inactive: 'on_hold',
    }
    return mapping[intacctStatus?.toLowerCase()] || 'active'
  }

  private mapStatusToIntacct(status: string): string {
    const mapping: Record<string, string> = {
      active: 'active',
      completed: 'completed',
      on_hold: 'inactive',
      cancelled: 'inactive',
    }
    return mapping[status] || 'active'
  }
}

// Zoho CRM Deal (Project) Transformer
export class CRMProjectTransformer extends AbstractTransformer {
  entityType = 'project' as const
  systemId = 'crm'

  protected getExternalIdField(): string {
    return 'crm_id'
  }

  protected getImportMappings(): FieldMapping[] {
    return [
      { source: 'Deal_Name', target: 'name', required: true },
      { source: 'Description', target: 'description' },
      { source: 'Account_Name.id', target: 'customer_id' },
      { source: 'Stage', target: 'status', transform: (v) => this.mapCRMStage(v as string) },
      { source: 'Closing_Date', target: 'end_date', transform: (v) => this.parseDate(v) },
      { source: 'Amount', target: 'budget_amount', transform: (v) => this.parseDecimal(v) },
      {
        source: 'Stage',
        target: 'is_active',
        transform: (v) => !['Closed Won', 'Closed Lost'].includes(v as string),
      },
    ]
  }

  protected getExportMappings(): FieldMapping[] {
    return [
      { source: 'name', target: 'Deal_Name', required: true },
      { source: 'description', target: 'Description' },
      { source: 'end_date', target: 'Closing_Date' },
      { source: 'budget_amount', target: 'Amount' },
      { source: 'status', target: 'Stage', transform: (v) => this.mapStatusToCRM(v as string) },
    ]
  }

  private mapCRMStage(stage: string): string {
    const mapping: Record<string, string> = {
      'Qualification': 'active',
      'Needs Analysis': 'active',
      'Value Proposition': 'active',
      'Proposal/Price Quote': 'active',
      'Negotiation/Review': 'active',
      'Closed Won': 'completed',
      'Closed Lost': 'cancelled',
    }
    return mapping[stage] || 'active'
  }

  private mapStatusToCRM(status: string): string {
    const mapping: Record<string, string> = {
      active: 'Qualification',
      completed: 'Closed Won',
      on_hold: 'Negotiation/Review',
      cancelled: 'Closed Lost',
    }
    return mapping[status] || 'Qualification'
  }
}
