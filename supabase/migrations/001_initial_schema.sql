-- SMSI Sync Database Schema
-- Initial migration: Core tables, infrastructure, views, and functions

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE ENTITY TABLES
-- ============================================================================

-- Departments
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    parent_id UUID REFERENCES departments(id),
    manager_id UUID, -- Will reference employees after that table is created
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employees
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_number VARCHAR(50),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    title VARCHAR(255),
    department_id UUID REFERENCES departments(id),
    hire_date DATE,
    termination_date DATE,
    employment_status VARCHAR(50) DEFAULT 'active', -- active, terminated, leave
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add manager reference to departments
ALTER TABLE departments
ADD CONSTRAINT fk_departments_manager
FOREIGN KEY (manager_id) REFERENCES employees(id);

-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    customer_number VARCHAR(50),
    email VARCHAR(255),
    phone VARCHAR(50),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendors
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    vendor_number VARCHAR(50),
    email VARCHAR(255),
    phone VARCHAR(50),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    payment_terms VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_number VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    customer_id UUID REFERENCES customers(id),
    department_id UUID REFERENCES departments(id),
    project_manager_id UUID REFERENCES employees(id),
    status VARCHAR(50) DEFAULT 'active', -- active, completed, on_hold, cancelled
    start_date DATE,
    end_date DATE,
    budget_amount DECIMAL(15, 2),
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Orders
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number VARCHAR(50) NOT NULL,
    vendor_id UUID REFERENCES vendors(id),
    project_id UUID REFERENCES projects(id),
    department_id UUID REFERENCES departments(id),
    requested_by UUID REFERENCES employees(id),
    approved_by UUID REFERENCES employees(id),
    status VARCHAR(50) DEFAULT 'draft', -- draft, pending_approval, approved, rejected, closed
    order_date DATE,
    expected_date DATE,
    total_amount DECIMAL(15, 2),
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Time Sheets
CREATE TABLE time_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    project_id UUID REFERENCES projects(id),
    work_date DATE NOT NULL,
    hours_regular DECIMAL(5, 2) DEFAULT 0,
    hours_overtime DECIMAL(5, 2) DEFAULT 0,
    hours_total DECIMAL(5, 2) GENERATED ALWAYS AS (hours_regular + hours_overtime) STORED,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft', -- draft, submitted, approved, rejected
    approved_by UUID REFERENCES employees(id),
    approved_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quotes
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_number VARCHAR(50) NOT NULL,
    customer_id UUID REFERENCES customers(id),
    project_id UUID REFERENCES projects(id),
    prepared_by UUID REFERENCES employees(id),
    status VARCHAR(50) DEFAULT 'draft', -- draft, sent, accepted, rejected, expired
    quote_date DATE,
    expiry_date DATE,
    total_amount DECIMAL(15, 2),
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INFRASTRUCTURE TABLES
-- ============================================================================

-- External ID Mapping (maps internal UUIDs to external system IDs)
CREATE TABLE external_ids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL, -- employee, customer, project, etc.
    internal_id UUID NOT NULL,
    system_id VARCHAR(50) NOT NULL, -- creator, crm, intacct, adp, etc.
    external_id VARCHAR(255) NOT NULL,
    external_data JSONB, -- Additional metadata from external system
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_type, internal_id, system_id),
    UNIQUE(entity_type, system_id, external_id)
);

-- Create index for common lookups
CREATE INDEX idx_external_ids_lookup ON external_ids(entity_type, system_id, external_id);
CREATE INDEX idx_external_ids_internal ON external_ids(entity_type, internal_id);

-- Sync Status (per-record sync state with each system)
CREATE TABLE sync_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    system_id VARCHAR(50) NOT NULL,
    sync_state VARCHAR(50) DEFAULT 'pending', -- pending, synced, failed, conflict
    last_synced_at TIMESTAMPTZ,
    last_sync_hash VARCHAR(64), -- SHA-256 hash for change detection
    last_error TEXT,
    retry_count INT DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_type, entity_id, system_id)
);

CREATE INDEX idx_sync_status_pending ON sync_status(system_id, sync_state) WHERE sync_state = 'pending';
CREATE INDEX idx_sync_status_failed ON sync_status(system_id, sync_state) WHERE sync_state = 'failed';

-- Sync Runs (batch operation tracking)
CREATE TABLE sync_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    source_system VARCHAR(50) NOT NULL,
    target_system VARCHAR(50) NOT NULL,
    direction VARCHAR(20) NOT NULL, -- import, export, bidirectional
    status VARCHAR(50) DEFAULT 'running', -- running, completed, failed, partial
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    records_processed INT DEFAULT 0,
    records_created INT DEFAULT 0,
    records_updated INT DEFAULT 0,
    records_failed INT DEFAULT 0,
    error_message TEXT,
    metadata JSONB
);

CREATE INDEX idx_sync_runs_status ON sync_runs(status, started_at DESC);

-- Change Log (audit trail)
CREATE TABLE change_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- create, update, delete, restore
    changed_by VARCHAR(255), -- User or system that made the change
    source_system VARCHAR(50), -- System that triggered the change
    old_data JSONB,
    new_data JSONB,
    changed_fields TEXT[], -- Array of field names that changed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_change_log_entity ON change_log(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_change_log_time ON change_log(created_at DESC);

-- ============================================================================
-- SYNC MANAGEMENT TABLES
-- ============================================================================

-- Sync Apps (platform definitions)
CREATE TABLE sync_apps (
    id VARCHAR(50) PRIMARY KEY, -- creator, crm, intacct, adp, etc.
    system_id VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    display_order INT DEFAULT 0,
    can_import BOOLEAN DEFAULT false,
    can_export BOOLEAN DEFAULT false,
    is_enabled BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(50), -- success, partial, failed
    last_sync_message TEXT,
    last_sync_duration_ms INT,
    last_records_processed INT DEFAULT 0,
    last_records_created INT DEFAULT 0,
    last_records_updated INT DEFAULT 0,
    last_records_failed INT DEFAULT 0,
    sync_schedule_cron VARCHAR(100),
    next_scheduled_sync TIMESTAMPTZ,
    config JSONB, -- App-specific configuration
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync Requests (queue of sync operations)
CREATE TABLE sync_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id VARCHAR(50) NOT NULL REFERENCES sync_apps(id),
    direction VARCHAR(20) NOT NULL DEFAULT 'both', -- import, export, both
    entity_types TEXT[], -- NULL means all entities
    requested_by VARCHAR(255),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    sync_run_id UUID REFERENCES sync_runs(id),
    error_message TEXT,
    metadata JSONB
);

CREATE INDEX idx_sync_requests_pending ON sync_requests(status, requested_at) WHERE status = 'pending';
CREATE INDEX idx_sync_requests_app ON sync_requests(app_id, requested_at DESC);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Employees with external IDs pivoted
CREATE OR REPLACE VIEW v_employees_with_ids AS
SELECT
    e.*,
    creator.external_id AS creator_id,
    crm.external_id AS crm_id,
    intacct.external_id AS intacct_id,
    adp.external_id AS adp_id,
    absorb.external_id AS absorb_id
FROM employees e
LEFT JOIN external_ids creator ON creator.entity_type = 'employee'
    AND creator.internal_id = e.id AND creator.system_id = 'creator'
LEFT JOIN external_ids crm ON crm.entity_type = 'employee'
    AND crm.internal_id = e.id AND crm.system_id = 'crm'
LEFT JOIN external_ids intacct ON intacct.entity_type = 'employee'
    AND intacct.internal_id = e.id AND intacct.system_id = 'intacct'
LEFT JOIN external_ids adp ON adp.entity_type = 'employee'
    AND adp.internal_id = e.id AND adp.system_id = 'adp'
LEFT JOIN external_ids absorb ON absorb.entity_type = 'employee'
    AND absorb.internal_id = e.id AND absorb.system_id = 'absorb'
WHERE e.is_deleted = false;

-- View: Projects with external IDs pivoted
CREATE OR REPLACE VIEW v_projects_with_ids AS
SELECT
    p.*,
    creator.external_id AS creator_id,
    crm.external_id AS crm_id,
    intacct.external_id AS intacct_id
FROM projects p
LEFT JOIN external_ids creator ON creator.entity_type = 'project'
    AND creator.internal_id = p.id AND creator.system_id = 'creator'
LEFT JOIN external_ids crm ON crm.entity_type = 'project'
    AND crm.internal_id = p.id AND crm.system_id = 'crm'
LEFT JOIN external_ids intacct ON intacct.entity_type = 'project'
    AND intacct.internal_id = p.id AND intacct.system_id = 'intacct'
WHERE p.is_deleted = false;

-- View: Sync overview (aggregate sync status by entity and system)
CREATE OR REPLACE VIEW v_sync_overview AS
SELECT
    entity_type,
    system_id,
    sync_state,
    COUNT(*) as count,
    MAX(last_synced_at) as latest_sync
FROM sync_status
GROUP BY entity_type, system_id, sync_state;

-- View: Deleted records (for admin review)
CREATE OR REPLACE VIEW v_deleted_records AS
SELECT
    'employee' as entity_type,
    id,
    first_name || ' ' || last_name as name,
    deleted_at
FROM employees WHERE is_deleted = true
UNION ALL
SELECT
    'customer' as entity_type,
    id,
    name,
    deleted_at
FROM customers WHERE is_deleted = true
UNION ALL
SELECT
    'vendor' as entity_type,
    id,
    name,
    deleted_at
FROM vendors WHERE is_deleted = true
UNION ALL
SELECT
    'project' as entity_type,
    id,
    name,
    deleted_at
FROM projects WHERE is_deleted = true
ORDER BY deleted_at DESC;

-- View: Sync Dashboard (one row per app with status)
CREATE OR REPLACE VIEW v_sync_dashboard AS
SELECT
    a.*,
    pending.id as pending_request_id,
    pending.direction as pending_direction,
    pending.requested_at as pending_since,
    processing.id as current_request_id,
    processing.direction as current_direction,
    processing.started_at as current_started_at
FROM sync_apps a
LEFT JOIN LATERAL (
    SELECT id, direction, requested_at
    FROM sync_requests
    WHERE app_id = a.id AND status = 'pending'
    ORDER BY requested_at
    LIMIT 1
) pending ON true
LEFT JOIN LATERAL (
    SELECT id, direction, started_at
    FROM sync_requests
    WHERE app_id = a.id AND status = 'processing'
    ORDER BY started_at DESC
    LIMIT 1
) processing ON true
ORDER BY a.display_order;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Request a sync operation
CREATE OR REPLACE FUNCTION request_sync(
    p_app_id VARCHAR(50),
    p_direction VARCHAR(20) DEFAULT 'both',
    p_entity_types TEXT[] DEFAULT NULL,
    p_requested_by VARCHAR(255) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_request_id UUID;
BEGIN
    INSERT INTO sync_requests (app_id, direction, entity_types, requested_by)
    VALUES (p_app_id, p_direction, p_entity_types, p_requested_by)
    RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Soft delete an entity
CREATE OR REPLACE FUNCTION soft_delete(
    p_entity_type VARCHAR(50),
    p_entity_id UUID,
    p_deleted_by VARCHAR(255) DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_data JSONB;
BEGIN
    -- Get current record for audit
    EXECUTE format(
        'SELECT to_jsonb(t.*) FROM %I t WHERE id = $1',
        p_entity_type || 's' -- Assumes table name is plural
    ) INTO v_old_data USING p_entity_id;

    IF v_old_data IS NULL THEN
        RETURN false;
    END IF;

    -- Perform soft delete
    EXECUTE format(
        'UPDATE %I SET is_deleted = true, deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
        p_entity_type || 's'
    ) USING p_entity_id;

    -- Log the change
    INSERT INTO change_log (entity_type, entity_id, action, changed_by, old_data, changed_fields)
    VALUES (p_entity_type, p_entity_id, 'delete', p_deleted_by, v_old_data, ARRAY['is_deleted', 'deleted_at']);

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function: Restore a soft-deleted entity
CREATE OR REPLACE FUNCTION restore_deleted(
    p_entity_type VARCHAR(50),
    p_entity_id UUID,
    p_restored_by VARCHAR(255) DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Restore the record
    EXECUTE format(
        'UPDATE %I SET is_deleted = false, deleted_at = NULL, updated_at = NOW() WHERE id = $1 AND is_deleted = true',
        p_entity_type || 's'
    ) USING p_entity_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Log the change
    INSERT INTO change_log (entity_type, entity_id, action, changed_by, changed_fields)
    VALUES (p_entity_type, p_entity_id, 'restore', p_restored_by, ARRAY['is_deleted', 'deleted_at']);

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function: Hard delete an entity (permanent)
CREATE OR REPLACE FUNCTION hard_delete(
    p_entity_type VARCHAR(50),
    p_entity_id UUID,
    p_deleted_by VARCHAR(255) DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_data JSONB;
BEGIN
    -- Get current record for audit
    EXECUTE format(
        'SELECT to_jsonb(t.*) FROM %I t WHERE id = $1',
        p_entity_type || 's'
    ) INTO v_old_data USING p_entity_id;

    IF v_old_data IS NULL THEN
        RETURN false;
    END IF;

    -- Log the deletion with full record snapshot
    INSERT INTO change_log (entity_type, entity_id, action, changed_by, old_data)
    VALUES (p_entity_type, p_entity_id, 'hard_delete', p_deleted_by, v_old_data);

    -- Remove external ID mappings
    DELETE FROM external_ids WHERE entity_type = p_entity_type AND internal_id = p_entity_id;

    -- Remove sync status entries
    DELETE FROM sync_status WHERE entity_type = p_entity_type AND entity_id = p_entity_id;

    -- Delete the record
    EXECUTE format(
        'DELETE FROM %I WHERE id = $1',
        p_entity_type || 's'
    ) USING p_entity_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate record hash for change detection
CREATE OR REPLACE FUNCTION calculate_record_hash(p_data JSONB) RETURNS VARCHAR(64) AS $$
BEGIN
    RETURN encode(sha256(p_data::text::bytea), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Get or create external ID mapping
CREATE OR REPLACE FUNCTION get_or_create_internal_id(
    p_entity_type VARCHAR(50),
    p_system_id VARCHAR(50),
    p_external_id VARCHAR(255),
    p_match_email VARCHAR(255) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_internal_id UUID;
BEGIN
    -- First, try to find existing mapping
    SELECT internal_id INTO v_internal_id
    FROM external_ids
    WHERE entity_type = p_entity_type
      AND system_id = p_system_id
      AND external_id = p_external_id;

    IF v_internal_id IS NOT NULL THEN
        RETURN v_internal_id;
    END IF;

    -- If email provided, try to match by email (for employees)
    IF p_entity_type = 'employee' AND p_match_email IS NOT NULL THEN
        SELECT id INTO v_internal_id
        FROM employees
        WHERE email = p_match_email AND is_deleted = false;

        IF v_internal_id IS NOT NULL THEN
            -- Create the mapping for this system
            INSERT INTO external_ids (entity_type, internal_id, system_id, external_id)
            VALUES (p_entity_type, v_internal_id, p_system_id, p_external_id);

            RETURN v_internal_id;
        END IF;
    END IF;

    -- No match found, generate new UUID
    v_internal_id := uuid_generate_v4();

    RETURN v_internal_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER tr_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_time_sheets_updated_at BEFORE UPDATE ON time_sheets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_external_ids_updated_at BEFORE UPDATE ON external_ids FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_sync_status_updated_at BEFORE UPDATE ON sync_status FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_sync_apps_updated_at BEFORE UPDATE ON sync_apps FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables (policies to be added based on auth requirements)
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_requests ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies (for server-side operations)
CREATE POLICY "Service role has full access" ON departments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role has full access" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role has full access" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role has full access" ON vendors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role has full access" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role has full access" ON purchase_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role has full access" ON time_sheets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role has full access" ON quotes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role has full access" ON external_ids FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role has full access" ON sync_status FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role has full access" ON sync_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role has full access" ON change_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role has full access" ON sync_apps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role has full access" ON sync_requests FOR ALL USING (true) WITH CHECK (true);
