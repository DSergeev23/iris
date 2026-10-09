import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PrismaClient, PublicationStatus, ScenarioActionKind } from "@prisma/client";
import { importPlan } from "../scripts/import-mvp-rehabilitation.mjs";
import { scenarioPublicationReadiness } from "../src/features/admin/server/scenario-readiness.ts";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error("Set a separate TEST_DATABASE_URL for integration tests.");
const db = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
const screens = JSON.parse(await readFile(new URL("../data/mvp-rehabilitation/screens.json", import.meta.url)));
const departmentContent = JSON.parse(await readFile(new URL("../data/mvp-rehabilitation/department.json", import.meta.url)));
const plan = importPlan(screens, departmentContent);
const sizes = new Map([
  ["Posle operatsii.mp4", 7845480], ["Uprajneniya.mp4", 17966528],
  ["Vstat s Krovati.mp4", 19569732], ["Vstat so stula.mp4", 8922988],
  ["Kostili.mp4", 7327006], ["Hodunki.mp4", 8638257],
  ["Po lestnitse.mp4", 21233664], ["Iz mashini.mp4", 18151025],
]);

test("existing published rehabilitation content receives the complete MVP scenario without replacing its media", async (t) => {
  const marker = randomUUID();
  const existing = await db.department.create({ data: {
    slug: "early-medical-rehabilitation", name: plan.department.name,
    status: PublicationStatus.PUBLISHED,
    head: { create: { firstName: "Екатерина", lastName: "Павлова", photoObjectKey: `integration/${marker}.png` } },
    reference: { create: { title: plan.department.reference.title, description: plan.department.reference.description } },
    facts: { create: plan.department.facts.map((fact, sortOrder) => ({ ...fact, sortOrder })) },
    scenario: { create: { title: "Old scenario", status: PublicationStatus.PUBLISHED, steps: { create: { title: "Old step", sortOrder: 0,
      actions: { create: { title: "Old action", kind: ScenarioActionKind.INFORMATION, sortOrder: 0 } },
    } } } },
    media: { create: plan.videos.map((video, sortOrder) => ({
      kind: "VIDEO", title: video.title, status: PublicationStatus.PUBLISHED,
      storageObjectKey: `integration/${marker}/${sortOrder}.mp4`, originalFilename: video.filename,
      mimeType: "video/mp4", fileSizeBytes: BigInt(sizes.get(video.filename)), sortOrder,
    })) },
  }, include: { media: true, scenario: true } });
  t.after(async () => {
    await db.auditLog.deleteMany({ where: { entityType: "scenario", entityId: existing.scenario.id, action: "mvp_rehabilitation_scenario_import" } });
    await db.department.delete({ where: { id: existing.id } });
  });

  const runImport = () => spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/import-mvp-rehabilitation.mjs", import.meta.url)), "--apply-existing"], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl }, encoding: "utf8",
  });
  const first = runImport();
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /42 steps, 94 actions, 8 reused videos/);
  const imported = await db.department.findUniqueOrThrow({ where: { id: existing.id }, include: {
    media: true, scenario: { include: { steps: { orderBy: { sortOrder: "asc" }, include: { actions: { orderBy: { sortOrder: "asc" } } } } } },
  } });
  assert.deepEqual(imported.media.map((media) => media.id).sort(), existing.media.map((media) => media.id).sort());
  assert.equal(imported.scenario.id, existing.scenario.id);
  assert.equal(imported.scenario.steps.length, 42);
  assert.equal(imported.scenario.steps.reduce((count, step) => count + step.actions.length, 0), 94);
  assert.equal(imported.scenario.steps.filter((step) => step.mediaItemId).length, 15);
  assert.equal(await scenarioPublicationReadiness(imported.scenario.id, db), null);
  assert.equal(imported.scenario.welcomeText, plan.welcomeText);
  const stepIdByKey = new Map(plan.steps.map((step, index) => [step.key, imported.scenario.steps[index].id]));
  const mediaIdByFilename = new Map(imported.media.map((media) => [media.originalFilename, media.id]));
  for (const [index, sourceStep] of plan.steps.entries()) {
    const savedStep = imported.scenario.steps[index];
    assert.equal(savedStep.title, sourceStep.title, sourceStep.key);
    assert.equal(savedStep.displayTitle, sourceStep.displayTitle, sourceStep.key);
    assert.equal(savedStep.description, sourceStep.description, sourceStep.key);
    assert.equal(savedStep.feedbackInput, sourceStep.feedbackInput, sourceStep.key);
    assert.equal(savedStep.resumeOnReentry, sourceStep.resumeOnReentry, sourceStep.key);
    assert.equal(savedStep.mediaItemId, sourceStep.video ? mediaIdByFilename.get(sourceStep.video) : null, sourceStep.key);
    assert.deepEqual(savedStep.actions.map((action) => ({
      title: action.title, kind: action.kind, targetStepId: action.targetStepId,
    })), sourceStep.buttons.map((button) => ({
      title: button.title,
      kind: button.next === "restart" ? ScenarioActionKind.RESTART : ScenarioActionKind.STEP,
      targetStepId: button.next === "restart" ? null : stepIdByKey.get(button.next),
    })), `${sourceStep.key}: every ordered button and transition`);
  }
  const event = await db.auditLog.findFirstOrThrow({ where: { entityType: "scenario", entityId: existing.scenario.id, action: "mvp_rehabilitation_scenario_import" } });
  assert.equal(event.payload.previousScenario.steps[0].title, "Old step");

  const second = runImport();
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /already imported/);
  assert.equal(await db.scenarioStep.count({ where: { scenarioId: existing.scenario.id } }), 42);
  await db.scenarioStep.update({ where: { id: imported.scenario.steps[0].id }, data: { title: "Edited in admin" } });
  const afterAdminEdit = runImport();
  assert.equal(afterAdminEdit.status, 0, afterAdminEdit.stderr);
  assert.equal((await db.scenarioStep.findUniqueOrThrow({ where: { id: imported.scenario.steps[0].id } })).title, "Edited in admin");
});

test.after(async () => { await db.$disconnect(); });
