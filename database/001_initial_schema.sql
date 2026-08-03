-- Iris content portal: initial PostgreSQL schema.
-- Binary files live in S3. PostgreSQL stores only file metadata and object keys.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE publication_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE media_kind AS ENUM ('video', 'document', 'image');
CREATE TYPE scenario_action_kind AS ENUM ('stage', 'media', 'emergency', 'info');

CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  name TEXT NOT NULL,
  intro TEXT NOT NULL DEFAULT '',
  status publication_status NOT NULL DEFAULT 'draft',
  sort_order SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX departments_published_order_idx
  ON departments (sort_order)
  WHERE status = 'published';

CREATE TABLE department_heads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL UNIQUE REFERENCES departments(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  role_title TEXT NOT NULL DEFAULT '',
  biography TEXT NOT NULL DEFAULT '',
  photo_object_key TEXT,
  photo_alt TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE department_reference_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL UNIQUE REFERENCES departments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE department_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  icon_key TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (department_id, sort_order)
);

CREATE TABLE scenario_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (department_id, sort_order)
);

CREATE TABLE media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  kind media_kind NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status publication_status NOT NULL DEFAULT 'draft',
  storage_object_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
  duration_seconds INTEGER CHECK (duration_seconds >= 0),
  poster_object_key TEXT,
  sort_order SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX media_items_department_status_order_idx
  ON media_items (department_id, status, sort_order);

CREATE TABLE scenario_situations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES scenario_stages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  action_kind scenario_action_kind NOT NULL,
  target_stage_id UUID REFERENCES scenario_stages(id) ON DELETE SET NULL,
  target_media_id UUID REFERENCES media_items(id) ON DELETE SET NULL,
  action_label TEXT NOT NULL DEFAULT '',
  sort_order SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (stage_id, sort_order),
  CHECK (
    (action_kind = 'stage' AND target_stage_id IS NOT NULL AND target_media_id IS NULL)
    OR (action_kind = 'media' AND target_media_id IS NOT NULL AND target_stage_id IS NULL)
    OR (action_kind IN ('emergency', 'info') AND target_stage_id IS NULL AND target_media_id IS NULL)
  )
);

CREATE TABLE media_stage_links (
  media_id UUID NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES scenario_stages(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, stage_id)
);

CREATE TABLE admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX admin_sessions_active_idx
  ON admin_sessions (admin_user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id, created_at DESC);

-- The app updates timestamps explicitly in its repository layer.
-- This keeps the schema portable and avoids hidden database-side behavior.
