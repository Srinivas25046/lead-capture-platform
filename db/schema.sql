CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE widgets (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  type TEXT NOT NULL CHECK (type IN ('signup_form', 'cta', 'popover')),
  title TEXT NOT NULL,
  description TEXT,
  fields JSONB NOT NULL,       -- e.g. [{"name":"email","type":"email","required":true}]
  button_text TEXT DEFAULT 'Submit',
  config_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_widgets_tenant ON widgets(tenant_id);

CREATE TABLE submissions (
  id SERIAL PRIMARY KEY,
  widget_id INTEGER NOT NULL REFERENCES widgets(id),
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),  -- denormalized on purpose: makes tenant isolation a one-column check on every query
  data JSONB NOT NULL,
  ip_address TEXT,
  country TEXT,
  city TEXT,
  geo_provider_used TEXT,       -- "provider_a", "provider_b", or null if both failed
  spam_flag BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_submissions_widget ON submissions(widget_id);
CREATE INDEX idx_submissions_tenant ON submissions(tenant_id);
CREATE INDEX idx_submissions_created_at ON submissions(created_at);

CREATE TABLE rate_limit_events (
  id SERIAL PRIMARY KEY,
  ip_address TEXT NOT NULL,
  widget_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_rate_limit_ip_time ON rate_limit_events(ip_address, created_at);

ALTER TABLE widgets ADD COLUMN IF NOT EXISTS allowed_origins JSONB NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_run_at ON jobs(status, run_at);