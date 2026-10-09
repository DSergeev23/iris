ALTER TYPE "ScenarioActionKind" ADD VALUE 'RESTART';

ALTER TABLE "scenarios" ADD COLUMN "welcome_text" TEXT NOT NULL DEFAULT '';
ALTER TABLE "scenario_steps" ADD COLUMN "media_item_id" UUID;
ALTER TABLE "scenario_steps" ADD COLUMN "display_title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "scenario_steps" ADD COLUMN "feedback_input" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "scenario_steps" ADD COLUMN "resume_on_reentry" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "scenario_steps_media_item_id_idx" ON "scenario_steps"("media_item_id");

ALTER TABLE "scenario_steps" ADD CONSTRAINT "scenario_steps_media_item_id_fkey"
  FOREIGN KEY ("media_item_id") REFERENCES "media_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
