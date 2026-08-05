-- Iris Care: initial production schema.
-- Media binaries stay in private Timeweb S3; PostgreSQL stores their metadata and object keys.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "MediaKind" AS ENUM ('VIDEO', 'DOCUMENT', 'IMAGE');
CREATE TYPE "ScenarioActionKind" AS ENUM ('STEP', 'MEDIA', 'EMERGENCY', 'INFORMATION');

CREATE TABLE "admin_users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "departments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "intro" TEXT NOT NULL DEFAULT '',
  "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "department_heads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "department_id" UUID NOT NULL,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "middle_name" TEXT,
  "role_title" TEXT NOT NULL DEFAULT '',
  "biography" TEXT NOT NULL DEFAULT '',
  "photo_object_key" TEXT,
  "photo_alt" TEXT NOT NULL DEFAULT '',
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "department_heads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "department_reference_sections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "department_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "department_reference_sections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "department_facts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "department_id" UUID NOT NULL,
  "icon_key" TEXT NOT NULL DEFAULT 'info',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "department_facts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scenarios" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "department_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "emergency_title" TEXT NOT NULL DEFAULT 'Нужна срочная помощь?',
  "emergency_body" TEXT NOT NULL DEFAULT '',
  "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scenario_steps" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "scenario_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scenario_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "media_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "department_id" UUID NOT NULL,
  "kind" "MediaKind" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "storage_object_key" TEXT NOT NULL,
  "original_filename" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_size_bytes" BIGINT NOT NULL,
  "duration_seconds" INTEGER,
  "poster_object_key" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scenario_actions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "step_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL DEFAULT '',
  "action_label" TEXT NOT NULL DEFAULT '',
  "kind" "ScenarioActionKind" NOT NULL,
  "target_step_id" UUID,
  "target_media_id" UUID,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scenario_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "admin_user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_log" (
  "id" BIGSERIAL NOT NULL,
  "admin_user_id" UUID,
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID,
  "action" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");
CREATE UNIQUE INDEX "departments_slug_key" ON "departments"("slug");
CREATE INDEX "departments_status_sort_order_idx" ON "departments"("status", "sort_order");
CREATE UNIQUE INDEX "department_heads_department_id_key" ON "department_heads"("department_id");
CREATE UNIQUE INDEX "department_reference_sections_department_id_key" ON "department_reference_sections"("department_id");
CREATE UNIQUE INDEX "department_facts_department_id_sort_order_key" ON "department_facts"("department_id", "sort_order");
CREATE UNIQUE INDEX "scenarios_department_id_key" ON "scenarios"("department_id");
CREATE UNIQUE INDEX "scenario_steps_scenario_id_sort_order_key" ON "scenario_steps"("scenario_id", "sort_order");
CREATE UNIQUE INDEX "media_items_storage_object_key_key" ON "media_items"("storage_object_key");
CREATE INDEX "media_items_department_id_status_sort_order_idx" ON "media_items"("department_id", "status", "sort_order");
CREATE UNIQUE INDEX "scenario_actions_step_id_sort_order_key" ON "scenario_actions"("step_id", "sort_order");
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");
CREATE INDEX "admin_sessions_admin_user_id_expires_at_idx" ON "admin_sessions"("admin_user_id", "expires_at");
CREATE INDEX "audit_log_entity_type_entity_id_created_at_idx" ON "audit_log"("entity_type", "entity_id", "created_at" DESC);

ALTER TABLE "department_heads" ADD CONSTRAINT "department_heads_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "department_reference_sections" ADD CONSTRAINT "department_reference_sections_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "department_facts" ADD CONSTRAINT "department_facts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scenario_steps" ADD CONSTRAINT "scenario_steps_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scenario_actions" ADD CONSTRAINT "scenario_actions_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "scenario_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scenario_actions" ADD CONSTRAINT "scenario_actions_target_step_id_fkey" FOREIGN KEY ("target_step_id") REFERENCES "scenario_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scenario_actions" ADD CONSTRAINT "scenario_actions_target_media_id_fkey" FOREIGN KEY ("target_media_id") REFERENCES "media_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
