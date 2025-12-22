-- SMSI Sync Seed Data
-- Initial data for sync_apps table

-- Insert platform definitions
INSERT INTO sync_apps (id, system_id, display_name, display_order, can_import, can_export, is_enabled, sync_schedule_cron, config) VALUES
    ('creator', 'creator', 'Zoho Creator', 1, true, true, true, '*/15 * * * *', '{
        "base_url": "https://creator.zoho.com/api/v2",
        "entity_forms": {
            "employee": "Employees",
            "customer": "Customers",
            "project": "Projects",
            "vendor": "Vendors",
            "quote": "Quotes",
            "purchase_order": "Purchase_Orders"
        },
        "description": "Origin system - primary source of truth for most entities"
    }'::jsonb),

    ('crm', 'crm', 'Zoho CRM', 2, true, true, true, '*/15 * * * *', '{
        "base_url": "https://www.zohoapis.com/crm/v3",
        "modules": {
            "customer": "Accounts",
            "project": "Deals",
            "employee": "Users"
        },
        "description": "Customer relationship management - syncs accounts and deals"
    }'::jsonb),

    ('intacct', 'intacct', 'Sage Intacct', 3, true, true, true, '*/30 * * * *', '{
        "base_url": "https://api.intacct.com/ia/xml/xmlgw.phtml",
        "object_types": {
            "employee": "EMPLOYEE",
            "customer": "CUSTOMER",
            "vendor": "VENDOR",
            "project": "PROJECT",
            "time_sheet": "TIMESHEET"
        },
        "description": "Financial system - source of truth for accounting data"
    }'::jsonb),

    ('adp', 'adp', 'ADP', 4, true, false, true, '0 6 * * *', '{
        "base_url": "https://api.adp.com",
        "endpoints": {
            "workers": "/hr/v2/workers"
        },
        "description": "HR/Payroll system - import only, source for employee demographics"
    }'::jsonb),

    ('absorb', 'absorb', 'Absorb LMS', 5, true, false, true, '0 7 * * *', '{
        "base_url": "https://api.myabsorb.com",
        "description": "Learning Management System - import training completion data"
    }'::jsonb),

    ('ramp', 'ramp', 'Ramp', 6, true, false, true, '0 */4 * * *', '{
        "base_url": "https://api.ramp.com/developer/v1",
        "description": "Corporate card and expense management"
    }'::jsonb),

    ('anyware', 'anyware', 'Anyware Approvals', 7, true, false, false, NULL, '{
        "description": "Approval workflow system - integration pending"
    }'::jsonb);

-- Insert sample department structure
INSERT INTO departments (id, name, code, is_active) VALUES
    ('d1000000-0000-0000-0000-000000000001', 'Executive', 'EXEC', true),
    ('d1000000-0000-0000-0000-000000000002', 'Operations', 'OPS', true),
    ('d1000000-0000-0000-0000-000000000003', 'Finance', 'FIN', true),
    ('d1000000-0000-0000-0000-000000000004', 'Human Resources', 'HR', true),
    ('d1000000-0000-0000-0000-000000000005', 'Information Technology', 'IT', true),
    ('d1000000-0000-0000-0000-000000000006', 'Sales', 'SALES', true),
    ('d1000000-0000-0000-0000-000000000007', 'Project Management', 'PM', true);

-- Note: Real employee/customer/project data will be imported from source systems
