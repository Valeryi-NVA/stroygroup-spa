CREATE TABLE IF NOT EXISTS crm_tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES crm_tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'foreman', 'accountant', 'designer', 'installer', 'worker')),
  qr_token_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_state (
  tenant_id TEXT PRIMARY KEY REFERENCES crm_tenants(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES crm_tenants(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES crm_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_users_tenant_role_idx ON crm_users(tenant_id, role);
CREATE INDEX IF NOT EXISTS crm_sessions_expiry_idx ON crm_sessions(expires_at);
CREATE INDEX IF NOT EXISTS crm_audit_tenant_created_idx ON crm_audit_logs(tenant_id, created_at DESC);
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS qr_token_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS crm_users_qr_token_idx ON crm_users(qr_token_hash) WHERE qr_token_hash IS NOT NULL;
