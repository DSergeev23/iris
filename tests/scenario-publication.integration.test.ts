import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient, PublicationStatus, ScenarioActionKind } from "@prisma/client";
import { scenarioPublicationReadiness } from "../src/features/admin/server/scenario-readiness.ts";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error("Укажите отдельный TEST_DATABASE_URL для интеграционных тестов.");

const db = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });

test("публикация сохраняет только достижимый маршрут с опубликованным медиа", async (t) => {
  const suffix = randomUUID().replaceAll("-", "");
  const department = await db.department.create({
    data: {
      slug: `integration-${suffix}`,
      name: "Интеграционный тест",
      scenario: { create: { title: "Маршрут", status: PublicationStatus.DRAFT } },
    },
    include: { scenario: true },
  });
  t.after(async () => { await db.department.delete({ where: { id: department.id } }); });

  assert.equal(await scenarioPublicationReadiness(department.scenario!.id, db), "добавьте хотя бы один шаг");

  const firstStep = await db.scenarioStep.create({ data: { scenarioId: department.scenario!.id, title: "Старт", sortOrder: 0 } });
  const secondStep = await db.scenarioStep.create({ data: { scenarioId: department.scenario!.id, title: "Продолжение", sortOrder: 1 } });
  await db.scenarioAction.create({ data: { stepId: secondStep.id, title: "Завершить", actionLabel: "Готово", kind: ScenarioActionKind.INFORMATION, sortOrder: 0 } });
  assert.equal(await scenarioPublicationReadiness(department.scenario!.id, db), "добавьте хотя бы одну кнопку в каждый шаг");

  const startAction = await db.scenarioAction.create({ data: { stepId: firstStep.id, title: "Понятно", actionLabel: "Готово", kind: ScenarioActionKind.INFORMATION, sortOrder: 0 } });
  assert.equal(await scenarioPublicationReadiness(department.scenario!.id, db), "свяжите со стартовым шагом: Продолжение");

  await db.scenarioAction.update({ where: { id: startAction.id }, data: { title: "Дальше", actionLabel: "Продолжить", kind: ScenarioActionKind.STEP, targetStepId: secondStep.id } });
  assert.equal(await scenarioPublicationReadiness(department.scenario!.id, db), null);

  const media = await db.mediaItem.create({
    data: {
      departmentId: department.id,
      kind: "VIDEO",
      title: "Проверочный материал",
      storageObjectKey: `integration/${suffix}.mp4`,
      originalFilename: "check.mp4",
      mimeType: "video/mp4",
      fileSizeBytes: BigInt(1),
      sortOrder: 0,
    },
  });
  await db.scenarioAction.create({ data: { stepId: firstStep.id, title: "Материал", actionLabel: "Открыть", kind: ScenarioActionKind.MEDIA, targetMediaId: media.id, sortOrder: 1 } });
  assert.equal(await scenarioPublicationReadiness(department.scenario!.id, db), "опубликуйте все материалы, выбранные для кнопок сценария");

  await db.mediaItem.update({ where: { id: media.id }, data: { status: PublicationStatus.PUBLISHED } });
  assert.equal(await scenarioPublicationReadiness(department.scenario!.id, db), null);

  await db.scenario.update({ where: { id: department.scenario!.id }, data: { status: PublicationStatus.PUBLISHED } });
  await db.department.update({ where: { id: department.id }, data: { status: PublicationStatus.PUBLISHED } });
  const published = await db.department.findUniqueOrThrow({ where: { id: department.id }, select: { status: true, scenario: { select: { status: true } } } });
  assert.equal(published.status, PublicationStatus.PUBLISHED);
  assert.equal(published.scenario?.status, PublicationStatus.PUBLISHED);
});

test.after(async () => { await db.$disconnect(); });
