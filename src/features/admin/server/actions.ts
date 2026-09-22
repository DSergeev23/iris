"use server";

import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Prisma, PublicationStatus, ScenarioActionKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/features/auth/server/session";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { getServerConfig } from "@/lib/config";
import { logEvent } from "@/lib/logger";
import { getS3Client } from "@/lib/s3";
import { createInitialContent } from "./bootstrap-content";
import { requireDepartmentWrite, requireScenarioStepWrite, requireScenarioWrite } from "./permissions";
import { scenarioPublicationReadiness, type ScenarioReader } from "./scenario-readiness";

const idSchema = z.string().uuid();
const departmentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).max(60),
});
const departmentIdentitySchema = departmentSchema.pick({ name: true });
const departmentContentSchema = z.object({
  departmentId: idSchema,
  intro: z.string().trim().min(2).max(2000),
  referenceTitle: z.string().trim().min(2).max(180),
  referenceDescription: z.string().trim().min(2).max(8000),
});
const headSchema = z.object({
  departmentId: idSchema,
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  middleName: z.string().trim().max(100),
  roleTitle: z.string().trim().min(2).max(250),
  biography: z.string().trim().max(5000),
});
const factSchema = z.object({
  departmentId: idSchema,
  factId: idSchema.optional(),
  iconKey: z.enum(["info", "clock", "map-pin", "phone", "calendar", "heart-pulse"]),
  title: z.string().trim().min(2).max(180),
  body: z.string().trim().min(2).max(1000),
});
const scenarioSchema = z.object({
  scenarioId: idSchema,
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000),
  emergencyTitle: z.string().trim().min(2).max(180),
  emergencyBody: z.string().trim().max(3000),
});
const stepSchema = z.object({
  scenarioId: idSchema,
  stepId: idSchema.optional(),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000),
});
const actionSchema = z.object({
  stepId: idSchema,
  actionId: idSchema.optional(),
  title: z.string().trim().min(2).max(180),
  body: z.string().trim().max(2000),
  actionLabel: z.string().trim().min(1).max(80),
  kind: z.nativeEnum(ScenarioActionKind),
  targetStepId: idSchema.optional(),
  targetMediaId: idSchema.optional(),
});
const directionSchema = z.enum(["up", "down"]);

async function publicationReadiness(departmentId: string, client: Pick<Prisma.TransactionClient, "department" | "scenario">) {
  const department = await client.department.findUniqueOrThrow({
    where: { id: departmentId },
    select: {
      scenario: { select: { id: true, status: true } },
    },
  });
  const missing = [];
  if (department.scenario?.status !== PublicationStatus.PUBLISHED) {
    missing.push("опубликованный сценарий");
  } else {
    const readinessIssue = await scenarioPublicationReadiness(department.scenario.id, client);
    if (readinessIssue) missing.push(readinessIssue);
  }
  return missing;
}

async function ensurePublishedScenarioReadiness(scenario: { id: string; status: PublicationStatus }, client: ScenarioReader) {
  if (scenario.status !== PublicationStatus.PUBLISHED) return;
  const readinessIssue = await scenarioPublicationReadiness(scenario.id, client);
  if (readinessIssue) throw new ValidationError(`Изменение нарушит опубликованный сценарий: ${readinessIssue}.`);
}

function optionalId(value: FormDataEntryValue | null) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
}

function departmentIdFrom(formData: FormData) {
  const parsed = idSchema.safeParse(formData.get("departmentId"));
  return parsed.success ? parsed.data : undefined;
}

function errorMessage(error: unknown) {
  unstable_rethrow(error);
  if (error instanceof ValidationError) return error.message;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "Такое значение уже используется. Проверьте URL-код и порядок.";
    if (error.code === "P2025") return "Запись не найдена. Обновите страницу и повторите действие.";
    if (error.code === "P2034") return "Данные изменились одновременно. Обновите страницу и повторите действие.";
  }
  return "Не удалось сохранить изменения. Обновите страницу и повторите попытку.";
}

function adminRedirect(departmentId: string | undefined, type: "notice" | "error", message: string, anchor = "departments"): never {
  const params = new URLSearchParams();
  if (departmentId) params.set("department", departmentId);
  params.set(type, message);
  redirect(`/admin?${params.toString()}#${anchor}`);
}

function refreshContent() {
  revalidatePath("/portal");
  revalidatePath("/admin");
}

async function requireDraftDepartment(tx: Prisma.TransactionClient, departmentId: string) {
  const department = await tx.department.findUnique({ where: { id: departmentId }, select: { status: true } });
  if (department?.status !== PublicationStatus.DRAFT) throw new ValidationError("Сначала переведите отделение в черновик.");
}

async function removeStoredFiles(keys: string[]) {
  if (!keys.length) return 0;
  let client: ReturnType<typeof getS3Client>;
  let bucket: string;
  try {
    client = getS3Client();
    bucket = getServerConfig().S3_BUCKET;
  } catch {
    logEvent("draft_file_cleanup_failed", { count: keys.length });
    return keys.length;
  }
  let failed = 0;
  for (const key of new Set(keys)) {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch {
      failed += 1;
      logEvent("draft_file_cleanup_failed", { objectKey: key });
    }
  }
  return failed;
}

export async function bootstrapInitialContentAction() {
  const admin = await requireAdmin();
  try {
    const result = await db.$transaction((tx) => createInitialContent(tx, admin.id), { timeout: 20_000 });
    if (!result) throw new ValidationError("Все стартовые отделения уже созданы. Обновите страницу.");
    refreshContent();
    adminRedirect(result.firstDepartmentId, "notice", `Добавлено стартовых отделений: ${result.createdCount}.`);
  } catch (error) {
    adminRedirect(undefined, "error", errorMessage(error));
  }
}

export async function createDepartmentAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = departmentSchema.safeParse({ name: formData.get("name"), slug: formData.get("slug") });
  if (!parsed.success) adminRedirect(undefined, "error", "Укажите название и URL-код латиницей.");

  try {
    const count = await db.department.count();
    if (count >= 20) throw new ValidationError("Можно создать не более 20 отделений.");
    const maxOrder = await db.department.aggregate({ _max: { sortOrder: true } });
    const department = await db.$transaction(async (tx) => {
      const created = await tx.department.create({ data: { ...parsed.data, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 } });
      await tx.departmentReferenceSection.create({ data: { departmentId: created.id, title: `О ${created.name}`, description: "Добавьте справочную информацию для пациентов." } });
      await tx.departmentHead.create({ data: { departmentId: created.id, firstName: "", lastName: "", roleTitle: "", biography: "" } });
      await tx.scenario.create({ data: { departmentId: created.id, title: "Провести по шагам" } });
      return created;
    });
    await db.auditLog.create({ data: { adminUserId: admin.id, entityType: "department", entityId: department.id, action: "create", payload: { slug: department.slug } } });
    refreshContent();
    adminRedirect(department.id, "notice", "Отделение создано.");
  } catch (error) {
    adminRedirect(undefined, "error", errorMessage(error));
  }
}

export async function deleteDraftDepartmentAction(formData: FormData) {
  const admin = await requireAdmin();
  const departmentId = departmentIdFrom(formData);
  if (!departmentId) adminRedirect(undefined, "error", "Отделение не найдено.");
  try {
    await requireDepartmentWrite(admin, departmentId);
    const keys = await db.$transaction(async (tx) => {
      const department = await tx.department.findUnique({
        where: { id: departmentId },
        select: { status: true, head: { select: { photoObjectKey: true } }, media: { select: { storageObjectKey: true, posterObjectKey: true } } },
      });
      if (department?.status !== PublicationStatus.DRAFT) throw new ValidationError("Сначала переведите отделение в черновик.");
      const result = await tx.department.deleteMany({ where: { id: departmentId, status: PublicationStatus.DRAFT } });
      if (!result.count) throw new ValidationError("Отделение уже изменено. Обновите страницу.");
      const keys = [department.head?.photoObjectKey, ...department.media.flatMap((item) => [item.storageObjectKey, item.posterObjectKey])].filter((key): key is string => Boolean(key));
      await tx.auditLog.create({ data: { adminUserId: admin.id, entityType: "department", entityId: departmentId, action: "delete_draft", payload: { storageObjectKeys: keys } } });
      return keys;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const failed = await removeStoredFiles(keys);
    refreshContent();
    adminRedirect(undefined, "notice", failed ? "Черновик удалён, но часть файлов не удалось очистить из хранилища." : "Черновик отделения удалён.");
  } catch (error) {
    adminRedirect(departmentId, "error", errorMessage(error));
  }
}

export async function updateDepartmentIdentityAction(formData: FormData) {
  const admin = await requireAdmin();
  const departmentId = departmentIdFrom(formData);
  const parsed = departmentIdentitySchema.safeParse({ name: formData.get("name") });
  if (!departmentId || !parsed.success) adminRedirect(departmentId, "error", "Проверьте название отделения.");
  try {
    const department = await requireDepartmentWrite(admin, departmentId);
    if (department.status === PublicationStatus.ARCHIVED) throw new ValidationError("Сначала восстановите отделение из архива.");
    await db.department.update({ where: { id: departmentId }, data: { name: parsed.data.name } });
    refreshContent();
    adminRedirect(departmentId, "notice", "Название отделения сохранено.");
  } catch (error) {
    adminRedirect(departmentId, "error", errorMessage(error));
  }
}

export async function toggleDepartmentPublicationAction(formData: FormData) {
  const admin = await requireAdmin();
  const departmentId = departmentIdFrom(formData);
  const status = z.nativeEnum(PublicationStatus).safeParse(formData.get("status"));
  if (!departmentId || !status.success || status.data === PublicationStatus.ARCHIVED) adminRedirect(departmentId, "error", "Некорректный статус отделения.");
  try {
    await requireDepartmentWrite(admin, departmentId);
    await db.$transaction(async (tx) => {
      const department = await tx.department.findUnique({ where: { id: departmentId }, select: { status: true } });
      if (!department || department.status === PublicationStatus.ARCHIVED) throw new ValidationError("Сначала восстановите отделение из архива.");
      if (status.data === PublicationStatus.PUBLISHED) {
        const missing = await publicationReadiness(departmentId, tx);
        if (missing.length) throw new ValidationError(`Перед публикацией заполните: ${missing.join(", ")}.`);
      }
      await tx.department.update({ where: { id: departmentId }, data: { status: status.data } });
      await tx.auditLog.create({ data: { adminUserId: admin.id, entityType: "department", entityId: departmentId, action: "publication", payload: { status: status.data } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    refreshContent();
    adminRedirect(departmentId, "notice", status.data === PublicationStatus.PUBLISHED ? "Отделение опубликовано." : "Отделение скрыто с портала.");
  } catch (error) {
    adminRedirect(departmentId, "error", errorMessage(error));
  }
}

export async function archiveDepartmentAction(formData: FormData) {
  const admin = await requireAdmin();
  const departmentId = departmentIdFrom(formData);
  if (!departmentId) adminRedirect(undefined, "error", "Отделение не найдено.");
  try {
    const department = await db.department.findUnique({ where: { id: departmentId }, select: { id: true, status: true } });
    if (!department) throw new ValidationError("Отделение не найдено.");
    await requireDepartmentWrite(admin, department.id);
    const restoring = department.status === PublicationStatus.ARCHIVED;
    await db.$transaction(async (tx) => {
      if (restoring) {
        await tx.department.update({ where: { id: department.id }, data: { status: PublicationStatus.DRAFT } });
        return;
      }
      await tx.department.update({ where: { id: department.id }, data: { status: PublicationStatus.ARCHIVED } });
      await tx.scenario.updateMany({ where: { departmentId: department.id }, data: { status: PublicationStatus.ARCHIVED } });
      await tx.mediaItem.updateMany({ where: { departmentId: department.id }, data: { status: PublicationStatus.ARCHIVED } });
    });
    await db.auditLog.create({ data: { adminUserId: admin.id, entityType: "department", entityId: department.id, action: restoring ? "restore" : "archive" } });
    refreshContent();
    adminRedirect(department.id, "notice", restoring ? "Отделение восстановлено как черновик." : "Отделение и его материалы перемещены в архив.");
  } catch (error) {
    adminRedirect(departmentId, "error", errorMessage(error));
  }
}

export async function moveDepartmentAction(formData: FormData) {
  const admin = await requireAdmin();
  const departmentId = departmentIdFrom(formData);
  const direction = directionSchema.safeParse(formData.get("direction"));
  if (!departmentId || !direction.success) adminRedirect(departmentId, "error", "Не удалось изменить порядок отделений.");
  try {
    const current = await requireDepartmentWrite(admin, departmentId);
    const department = await db.department.findUniqueOrThrow({ where: { id: current.id }, select: { id: true, sortOrder: true } });
    const neighbor = await db.department.findFirst({
      where: direction.data === "up" ? { sortOrder: { lt: department.sortOrder } } : { sortOrder: { gt: department.sortOrder } },
      orderBy: { sortOrder: direction.data === "up" ? "desc" : "asc" },
      select: { id: true, sortOrder: true },
    });
    if (neighbor) {
      await db.$transaction([
        db.department.update({ where: { id: department.id }, data: { sortOrder: neighbor.sortOrder } }),
        db.department.update({ where: { id: neighbor.id }, data: { sortOrder: department.sortOrder } }),
      ]);
      refreshContent();
    }
    adminRedirect(departmentId, "notice", neighbor ? "Порядок отделений изменён." : "Отделение уже находится с краю списка.");
  } catch (error) {
    adminRedirect(departmentId, "error", errorMessage(error));
  }
}

export async function updateDepartmentContentAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = departmentContentSchema.safeParse({
    departmentId: formData.get("departmentId"), intro: formData.get("intro"), referenceTitle: formData.get("referenceTitle"), referenceDescription: formData.get("referenceDescription"),
  });
  const departmentId = departmentIdFrom(formData);
  if (!parsed.success) adminRedirect(departmentId, "error", "Проверьте заполнение текстовых полей.", "content");
  try {
    await requireDepartmentWrite(admin, parsed.data.departmentId);
    await db.$transaction(async (tx) => {
      await tx.department.update({ where: { id: parsed.data.departmentId }, data: { intro: parsed.data.intro } });
      await tx.departmentReferenceSection.upsert({
        where: { departmentId: parsed.data.departmentId },
        create: { departmentId: parsed.data.departmentId, title: parsed.data.referenceTitle, description: parsed.data.referenceDescription },
        update: { title: parsed.data.referenceTitle, description: parsed.data.referenceDescription },
      });
    });
    refreshContent();
    adminRedirect(parsed.data.departmentId, "notice", "Тексты и справка сохранены.", "content");
  } catch (error) {
    adminRedirect(parsed.data.departmentId, "error", errorMessage(error), "content");
  }
}

export async function deleteDepartmentReferenceAction(formData: FormData) {
  const admin = await requireAdmin();
  const departmentId = departmentIdFrom(formData);
  if (!departmentId) adminRedirect(undefined, "error", "Отделение не найдено.", "content");
  try {
    await requireDepartmentWrite(admin, departmentId);
    await db.$transaction(async (tx) => {
      await requireDraftDepartment(tx, departmentId);
      const result = await tx.departmentReferenceSection.deleteMany({ where: { departmentId } });
      if (!result.count) throw new ValidationError("Справка уже удалена. Обновите страницу.");
      await tx.auditLog.create({ data: { adminUserId: admin.id, entityType: "department_reference", entityId: departmentId, action: "delete" } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    refreshContent();
    adminRedirect(departmentId, "notice", "Справка удалена. Её можно заполнить заново.", "content");
  } catch (error) {
    adminRedirect(departmentId, "error", errorMessage(error), "content");
  }
}

export async function saveDepartmentFactAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = factSchema.safeParse({
    departmentId: formData.get("departmentId"), factId: optionalId(formData.get("factId")), iconKey: formData.get("iconKey"), title: formData.get("title"), body: formData.get("body"),
  });
  const departmentId = departmentIdFrom(formData);
  if (!parsed.success) adminRedirect(departmentId, "error", "Проверьте справочный блок.", "content");
  try {
    await requireDepartmentWrite(admin, parsed.data.departmentId);
    const { factId, departmentId: ownerId, ...data } = parsed.data;
    if (factId) {
      const fact = await db.departmentFact.findFirst({ where: { id: factId, departmentId: ownerId } });
      if (!fact) throw new ValidationError("Справочный блок не найден.");
      await db.departmentFact.update({ where: { id: factId }, data });
    } else {
      const maxOrder = await db.departmentFact.aggregate({ where: { departmentId: ownerId }, _max: { sortOrder: true } });
      await db.departmentFact.create({ data: { ...data, departmentId: ownerId, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 } });
    }
    refreshContent();
    adminRedirect(ownerId, "notice", factId ? "Справочный блок обновлён." : "Справочный блок добавлен.", "content");
  } catch (error) {
    adminRedirect(parsed.data.departmentId, "error", errorMessage(error), "content");
  }
}

export async function deleteDepartmentFactAction(formData: FormData) {
  const admin = await requireAdmin();
  const departmentId = departmentIdFrom(formData);
  const factId = idSchema.safeParse(formData.get("factId"));
  if (!departmentId || !factId.success) adminRedirect(departmentId, "error", "Справочный блок не найден.", "content");
  try {
    await requireDepartmentWrite(admin, departmentId);
    await db.$transaction(async (tx) => {
      await requireDraftDepartment(tx, departmentId);
      const result = await tx.departmentFact.deleteMany({ where: { id: factId.data, departmentId } });
      if (!result.count) throw new ValidationError("Справочный блок не найден.");
      await tx.auditLog.create({ data: { adminUserId: admin.id, entityType: "department_fact", entityId: factId.data, action: "delete" } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    refreshContent();
    adminRedirect(departmentId, "notice", "Справочный блок удалён.", "content");
  } catch (error) {
    adminRedirect(departmentId, "error", errorMessage(error), "content");
  }
}

export async function updateDepartmentHeadAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = headSchema.safeParse(Object.fromEntries(formData));
  const departmentId = departmentIdFrom(formData);
  if (!parsed.success) adminRedirect(departmentId, "error", "Проверьте данные заведующего.", "head");
  try {
    const { departmentId: ownerId, middleName, ...data } = parsed.data;
    await requireDepartmentWrite(admin, ownerId);
    await db.departmentHead.upsert({
      where: { departmentId: ownerId },
      create: { departmentId: ownerId, ...data, middleName: middleName || null },
      update: { ...data, middleName: middleName || null },
    });
    refreshContent();
    adminRedirect(ownerId, "notice", "Профиль заведующего сохранён.", "head");
  } catch (error) {
    adminRedirect(parsed.data.departmentId, "error", errorMessage(error), "head");
  }
}

export async function deleteDepartmentHeadAction(formData: FormData) {
  const admin = await requireAdmin();
  const departmentId = departmentIdFrom(formData);
  if (!departmentId) adminRedirect(undefined, "error", "Отделение не найдено.", "head");
  try {
    await requireDepartmentWrite(admin, departmentId);
    const photoKey = await db.$transaction(async (tx) => {
      await requireDraftDepartment(tx, departmentId);
      const head = await tx.departmentHead.findUnique({ where: { departmentId }, select: { id: true, photoObjectKey: true } });
      if (!head) throw new ValidationError("Профиль уже удалён. Обновите страницу.");
      await tx.departmentHead.delete({ where: { departmentId } });
      await tx.auditLog.create({ data: { adminUserId: admin.id, entityType: "department_head", entityId: head.id, action: "delete" } });
      return head.photoObjectKey;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const failed = await removeStoredFiles(photoKey ? [photoKey] : []);
    refreshContent();
    adminRedirect(departmentId, "notice", failed ? "Профиль удалён, но фотографию не удалось очистить из хранилища." : photoKey ? "Профиль и фотография удалены." : "Профиль заведующего удалён.", "head");
  } catch (error) {
    adminRedirect(departmentId, "error", errorMessage(error), "head");
  }
}

export async function updateScenarioAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = scenarioSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminRedirect(undefined, "error", "Проверьте настройки сценария.", "scenario");
  try {
    const scenario = await requireScenarioWrite(admin, parsed.data.scenarioId);
    const { scenarioId, ...data } = parsed.data;
    await db.scenario.update({ where: { id: scenarioId }, data });
    refreshContent();
    adminRedirect(scenario.departmentId, "notice", "Описание сценария сохранено.", "scenario");
  } catch (error) {
    adminRedirect(undefined, "error", errorMessage(error), "scenario");
  }
}

export async function toggleScenarioPublicationAction(formData: FormData) {
  const admin = await requireAdmin();
  const scenarioId = idSchema.safeParse(formData.get("scenarioId"));
  const status = z.nativeEnum(PublicationStatus).safeParse(formData.get("status"));
  if (!scenarioId.success || !status.success || status.data === PublicationStatus.ARCHIVED) adminRedirect(undefined, "error", "Некорректный статус сценария.", "scenario");
  try {
    const scenario = await requireScenarioWrite(admin, scenarioId.data);
    await db.$transaction(async (tx) => {
      const current = await tx.scenario.findUnique({ where: { id: scenario.id }, select: { status: true } });
      if (!current || current.status === PublicationStatus.ARCHIVED) throw new ValidationError("Сначала восстановите сценарий из архива.");
      const readinessIssue = status.data === PublicationStatus.PUBLISHED ? await scenarioPublicationReadiness(scenario.id, tx) : null;
      if (readinessIssue) throw new ValidationError(`Перед публикацией ${readinessIssue}.`);
      await tx.scenario.update({ where: { id: scenario.id }, data: { status: status.data } });
      await tx.auditLog.create({ data: { adminUserId: admin.id, entityType: "scenario", entityId: scenario.id, action: "publication", payload: { status: status.data } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    refreshContent();
    adminRedirect(scenario.departmentId, "notice", status.data === PublicationStatus.PUBLISHED ? "Сценарий опубликован." : "Сценарий скрыт с портала.", "scenario");
  } catch (error) {
    adminRedirect(undefined, "error", errorMessage(error), "scenario");
  }
}

export async function archiveScenarioAction(formData: FormData) {
  const admin = await requireAdmin();
  const scenarioId = idSchema.safeParse(formData.get("scenarioId"));
  if (!scenarioId.success) adminRedirect(undefined, "error", "Сценарий не найден.", "scenario");
  try {
    const scenario = await db.scenario.findUnique({ where: { id: scenarioId.data }, select: { id: true, departmentId: true, status: true } });
    if (!scenario) throw new ValidationError("Сценарий не найден.");
    await requireScenarioWrite(admin, scenario.id);
    const restoring = scenario.status === PublicationStatus.ARCHIVED;
    await db.scenario.update({ where: { id: scenario.id }, data: { status: restoring ? PublicationStatus.DRAFT : PublicationStatus.ARCHIVED } });
    await db.auditLog.create({ data: { adminUserId: admin.id, entityType: "scenario", entityId: scenario.id, action: restoring ? "restore" : "archive" } });
    refreshContent();
    adminRedirect(scenario.departmentId, "notice", restoring ? "Сценарий восстановлен как черновик." : "Сценарий перемещён в архив.", "scenario");
  } catch (error) {
    adminRedirect(undefined, "error", errorMessage(error), "scenario");
  }
}

export async function createScenarioAction(formData: FormData) {
  const admin = await requireAdmin();
  const departmentId = departmentIdFrom(formData);
  if (!departmentId) adminRedirect(undefined, "error", "Отделение не найдено.", "scenario");
  try {
    const department = await requireDepartmentWrite(admin, departmentId);
    if (department.status === PublicationStatus.ARCHIVED) throw new ValidationError("Сначала восстановите отделение из архива.");
    await db.$transaction(async (tx) => {
      const scenario = await tx.scenario.create({ data: { departmentId, title: "Провести по шагам" } });
      await tx.auditLog.create({ data: { adminUserId: admin.id, entityType: "scenario", entityId: scenario.id, action: "create" } });
    });
    refreshContent();
    adminRedirect(departmentId, "notice", "Сценарий создан как черновик.", "scenario");
  } catch (error) {
    adminRedirect(departmentId, "error", errorMessage(error), "scenario");
  }
}

export async function deleteDraftScenarioAction(formData: FormData) {
  const admin = await requireAdmin();
  const scenarioId = idSchema.safeParse(formData.get("scenarioId"));
  if (!scenarioId.success) adminRedirect(undefined, "error", "Сценарий не найден.", "scenario");
  try {
    const scenario = await requireScenarioWrite(admin, scenarioId.data);
    await db.$transaction(async (tx) => {
      await requireDraftDepartment(tx, scenario.departmentId);
      const result = await tx.scenario.deleteMany({ where: { id: scenario.id, departmentId: scenario.departmentId } });
      if (!result.count) throw new ValidationError("Сценарий уже изменён. Обновите страницу.");
      await tx.auditLog.create({ data: { adminUserId: admin.id, entityType: "scenario", entityId: scenario.id, action: "delete" } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    refreshContent();
    adminRedirect(scenario.departmentId, "notice", "Сценарий со всеми шагами и кнопками удалён.", "scenario");
  } catch (error) {
    adminRedirect(undefined, "error", errorMessage(error), "scenario");
  }
}

export async function addScenarioStepAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = stepSchema.omit({ stepId: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminRedirect(undefined, "error", "Укажите название шага.", "scenario");
  try {
    const scenario = await requireScenarioWrite(admin, parsed.data.scenarioId);
    await db.$transaction(async (tx) => {
      const maxOrder = await tx.scenarioStep.aggregate({ where: { scenarioId: scenario.id }, _max: { sortOrder: true } });
      await tx.scenarioStep.create({ data: { ...parsed.data, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 } });
      await ensurePublishedScenarioReadiness(scenario, tx);
    });
    refreshContent();
    adminRedirect(scenario.departmentId, "notice", "Шаг добавлен.", "scenario");
  } catch (error) {
    adminRedirect(undefined, "error", errorMessage(error), "scenario");
  }
}

export async function updateScenarioStepAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = stepSchema.required({ stepId: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminRedirect(undefined, "error", "Проверьте данные шага.", "scenario");
  try {
    const step = await requireScenarioStepWrite(admin, parsed.data.stepId);
    if (step.scenarioId !== parsed.data.scenarioId) throw new ValidationError("Шаг не относится к выбранному сценарию.");
    await db.scenarioStep.update({ where: { id: step.id }, data: { title: parsed.data.title, description: parsed.data.description } });
    refreshContent();
    adminRedirect(step.scenario.departmentId, "notice", "Шаг сохранён.", "scenario");
  } catch (error) {
    adminRedirect(undefined, "error", errorMessage(error), "scenario");
  }
}

export async function deleteScenarioStepAction(formData: FormData) {
  const admin = await requireAdmin();
  const stepId = idSchema.safeParse(formData.get("stepId"));
  if (!stepId.success) adminRedirect(undefined, "error", "Шаг не найден.", "scenario");
  try {
    const step = await requireScenarioStepWrite(admin, stepId.data);
    const result = await db.$transaction(async (tx) => {
      await requireDraftDepartment(tx, step.scenario.departmentId);
      const incomingActions = await tx.scenarioAction.count({ where: { targetStepId: step.id } });
      await tx.scenarioAction.deleteMany({ where: { targetStepId: step.id } });
      const deleted = await tx.scenarioStep.deleteMany({ where: { id: step.id, scenarioId: step.scenarioId } });
      if (!deleted.count) throw new ValidationError("Шаг уже удалён. Обновите страницу.");
      const demoted = await tx.scenario.updateMany({ where: { id: step.scenarioId, status: PublicationStatus.PUBLISHED }, data: { status: PublicationStatus.DRAFT } });
      await tx.auditLog.create({ data: { adminUserId: admin.id, entityType: "scenario_step", entityId: step.id, action: "delete", payload: { incomingActions } } });
      return { incomingActions, demoted: Boolean(demoted.count) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    refreshContent();
    adminRedirect(step.scenario.departmentId, "notice", `Шаг удалён.${result.incomingActions ? ` Связанные кнопки удалены: ${result.incomingActions}.` : ""}${result.demoted ? " Сценарий переведён в черновик." : ""} Проверьте маршрут перед публикацией.`, "scenario");
  } catch (error) {
    adminRedirect(undefined, "error", errorMessage(error), "scenario");
  }
}

export async function moveScenarioStepAction(formData: FormData) {
  const admin = await requireAdmin();
  const stepId = idSchema.safeParse(formData.get("stepId"));
  const direction = directionSchema.safeParse(formData.get("direction"));
  if (!stepId.success || !direction.success) adminRedirect(undefined, "error", "Не удалось изменить порядок шагов.", "scenario");
  try {
    const step = await requireScenarioStepWrite(admin, stepId.data);
    const current = await db.scenarioStep.findUniqueOrThrow({ where: { id: step.id }, select: { id: true, scenarioId: true, sortOrder: true } });
    const neighbor = await db.scenarioStep.findFirst({
      where: { scenarioId: current.scenarioId, ...(direction.data === "up" ? { sortOrder: { lt: current.sortOrder } } : { sortOrder: { gt: current.sortOrder } }) },
      orderBy: { sortOrder: direction.data === "up" ? "desc" : "asc" },
      select: { id: true, sortOrder: true },
    });
    if (neighbor) {
      const temporaryOrder = -1_000_000 - current.sortOrder;
      await db.$transaction(async (tx) => {
        await tx.scenarioStep.update({ where: { id: current.id }, data: { sortOrder: temporaryOrder } });
        await tx.scenarioStep.update({ where: { id: neighbor.id }, data: { sortOrder: current.sortOrder } });
        await tx.scenarioStep.update({ where: { id: current.id }, data: { sortOrder: neighbor.sortOrder } });
        await ensurePublishedScenarioReadiness(step.scenario, tx);
      });
      refreshContent();
    }
    adminRedirect(step.scenario.departmentId, "notice", neighbor ? "Порядок шагов изменён." : "Шаг уже находится с краю списка.", "scenario");
  } catch (error) {
    adminRedirect(undefined, "error", errorMessage(error), "scenario");
  }
}

async function normalizeActionTargets(sourceStepId: string, kind: ScenarioActionKind, targetStepId?: string, targetMediaId?: string) {
  const source = await db.scenarioStep.findUnique({ where: { id: sourceStepId }, select: { id: true, scenarioId: true, scenario: { select: { departmentId: true, status: true } } } });
  if (!source) throw new ValidationError("Исходный шаг не найден.");

  if (kind === ScenarioActionKind.STEP) {
    if (!targetStepId) throw new ValidationError("Выберите следующий шаг.");
    const target = await db.scenarioStep.findUnique({ where: { id: targetStepId }, select: { scenarioId: true } });
    if (!target || target.scenarioId !== source.scenarioId || targetStepId === source.id) throw new ValidationError("Выберите другой шаг этого сценария.");
    return { source, targetStepId, targetMediaId: null };
  }
  if (kind === ScenarioActionKind.MEDIA) {
    if (!targetMediaId) throw new ValidationError("Выберите видео или памятку.");
    const media = await db.mediaItem.findUnique({ where: { id: targetMediaId }, select: { departmentId: true, status: true } });
    if (!media || media.departmentId !== source.scenario.departmentId) throw new ValidationError("Материал не относится к выбранному отделению.");
    if (source.scenario.status === PublicationStatus.PUBLISHED && media.status !== PublicationStatus.PUBLISHED) throw new ValidationError("В опубликованном сценарии можно выбрать только опубликованный материал.");
    return { source, targetStepId: null, targetMediaId };
  }
  return { source, targetStepId: null, targetMediaId: null };
}

export async function addScenarioActionAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = actionSchema.omit({ actionId: true }).safeParse({
    stepId: formData.get("stepId"), title: formData.get("title"), body: formData.get("body"), actionLabel: formData.get("actionLabel"), kind: formData.get("kind"), targetStepId: optionalId(formData.get("targetStepId")), targetMediaId: optionalId(formData.get("targetMediaId")),
  });
  if (!parsed.success) adminRedirect(undefined, "error", "Проверьте данные действия.", "scenario");
  try {
    const sourceStep = await requireScenarioStepWrite(admin, parsed.data.stepId);
    const targets = await normalizeActionTargets(parsed.data.stepId, parsed.data.kind, parsed.data.targetStepId, parsed.data.targetMediaId);
    await db.$transaction(async (tx) => {
      const maxOrder = await tx.scenarioAction.aggregate({ where: { stepId: parsed.data.stepId }, _max: { sortOrder: true } });
      await tx.scenarioAction.create({ data: { stepId: parsed.data.stepId, title: parsed.data.title, body: parsed.data.body, actionLabel: parsed.data.actionLabel, kind: parsed.data.kind, targetStepId: targets.targetStepId, targetMediaId: targets.targetMediaId, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 } });
      await ensurePublishedScenarioReadiness(sourceStep.scenario, tx);
    });
    refreshContent();
    adminRedirect(sourceStep.scenario.departmentId, "notice", "Кнопка сценария добавлена.", "scenario");
  } catch (error) {
    adminRedirect(undefined, "error", errorMessage(error), "scenario");
  }
}

export async function updateScenarioButtonAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = actionSchema.required({ actionId: true }).safeParse({
    actionId: formData.get("actionId"), stepId: formData.get("stepId"), title: formData.get("title"), body: formData.get("body"), actionLabel: formData.get("actionLabel"), kind: formData.get("kind"), targetStepId: optionalId(formData.get("targetStepId")), targetMediaId: optionalId(formData.get("targetMediaId")),
  });
  if (!parsed.success) adminRedirect(undefined, "error", "Проверьте данные кнопки.", "scenario");
  try {
    const sourceStep = await requireScenarioStepWrite(admin, parsed.data.stepId);
    const action = await db.scenarioAction.findFirst({ where: { id: parsed.data.actionId, stepId: sourceStep.id } });
    if (!action) throw new ValidationError("Кнопка сценария не найдена.");
    const targets = await normalizeActionTargets(parsed.data.stepId, parsed.data.kind, parsed.data.targetStepId, parsed.data.targetMediaId);
    await db.$transaction(async (tx) => {
      await tx.scenarioAction.update({ where: { id: action.id }, data: { title: parsed.data.title, body: parsed.data.body, actionLabel: parsed.data.actionLabel, kind: parsed.data.kind, targetStepId: targets.targetStepId, targetMediaId: targets.targetMediaId } });
      await ensurePublishedScenarioReadiness(sourceStep.scenario, tx);
    });
    refreshContent();
    adminRedirect(sourceStep.scenario.departmentId, "notice", "Кнопка сценария сохранена.", "scenario");
  } catch (error) {
    adminRedirect(undefined, "error", errorMessage(error), "scenario");
  }
}

export async function deleteScenarioButtonAction(formData: FormData) {
  const admin = await requireAdmin();
  const actionId = idSchema.safeParse(formData.get("actionId"));
  if (!actionId.success) adminRedirect(undefined, "error", "Кнопка сценария не найдена.", "scenario");
  try {
    const action = await db.scenarioAction.findUnique({ where: { id: actionId.data }, select: { id: true, stepId: true } });
    if (!action) throw new ValidationError("Кнопка сценария не найдена.");
    const step = await requireScenarioStepWrite(admin, action.stepId);
    const demoted = await db.$transaction(async (tx) => {
      await requireDraftDepartment(tx, step.scenario.departmentId);
      const deleted = await tx.scenarioAction.deleteMany({ where: { id: action.id, stepId: step.id } });
      if (!deleted.count) throw new ValidationError("Кнопка уже удалена. Обновите страницу.");
      const result = await tx.scenario.updateMany({ where: { id: step.scenarioId, status: PublicationStatus.PUBLISHED }, data: { status: PublicationStatus.DRAFT } });
      await tx.auditLog.create({ data: { adminUserId: admin.id, entityType: "scenario_action", entityId: action.id, action: "delete" } });
      return Boolean(result.count);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    refreshContent();
    adminRedirect(step.scenario.departmentId, "notice", `Кнопка сценария удалена.${demoted ? " Сценарий переведён в черновик." : ""} Проверьте маршрут перед публикацией.`, "scenario");
  } catch (error) {
    adminRedirect(undefined, "error", errorMessage(error), "scenario");
  }
}

export async function moveScenarioButtonAction(formData: FormData) {
  const admin = await requireAdmin();
  const actionId = idSchema.safeParse(formData.get("actionId"));
  const direction = directionSchema.safeParse(formData.get("direction"));
  if (!actionId.success || !direction.success) adminRedirect(undefined, "error", "Не удалось изменить порядок кнопок.", "scenario");
  try {
    const current = await db.scenarioAction.findUnique({ where: { id: actionId.data }, select: { id: true, stepId: true, sortOrder: true } });
    if (!current) throw new ValidationError("Кнопка сценария не найдена.");
    const step = await requireScenarioStepWrite(admin, current.stepId);
    const neighbor = await db.scenarioAction.findFirst({
      where: { stepId: current.stepId, ...(direction.data === "up" ? { sortOrder: { lt: current.sortOrder } } : { sortOrder: { gt: current.sortOrder } }) },
      orderBy: { sortOrder: direction.data === "up" ? "desc" : "asc" },
      select: { id: true, sortOrder: true },
    });
    if (neighbor) {
      const temporaryOrder = -1_000_000 - current.sortOrder;
      await db.$transaction(async (tx) => {
        await tx.scenarioAction.update({ where: { id: current.id }, data: { sortOrder: temporaryOrder } });
        await tx.scenarioAction.update({ where: { id: neighbor.id }, data: { sortOrder: current.sortOrder } });
        await tx.scenarioAction.update({ where: { id: current.id }, data: { sortOrder: neighbor.sortOrder } });
      });
      refreshContent();
    }
    adminRedirect(step.scenario.departmentId, "notice", neighbor ? "Порядок кнопок изменён." : "Кнопка уже находится с краю списка.", "scenario");
  } catch (error) {
    adminRedirect(undefined, "error", errorMessage(error), "scenario");
  }
}

export async function updateMediaItemAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = z.object({ mediaId: idSchema, title: z.string().trim().min(2).max(180), description: z.string().trim().max(2000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminRedirect(undefined, "error", "Проверьте название и описание материала.", "media");
  try {
    const media = await db.mediaItem.findUnique({ where: { id: parsed.data.mediaId }, select: { id: true, departmentId: true } });
    if (!media) throw new ValidationError("Материал не найден.");
    await requireDepartmentWrite(admin, media.departmentId);
    await db.mediaItem.update({ where: { id: media.id }, data: { title: parsed.data.title, description: parsed.data.description } });
    refreshContent();
    adminRedirect(media.departmentId, "notice", "Материал сохранён.", "media");
  } catch (error) {
    adminRedirect(undefined, "error", errorMessage(error), "media");
  }
}

export async function toggleMediaPublicationAction(formData: FormData) {
  const admin = await requireAdmin();
  const mediaId = idSchema.safeParse(formData.get("mediaId"));
  const status = z.nativeEnum(PublicationStatus).safeParse(formData.get("status"));
  if (!mediaId.success || !status.success || status.data === PublicationStatus.ARCHIVED) adminRedirect(undefined, "error", "Некорректный статус материала.", "media");
  try {
    const media = await db.mediaItem.findUnique({ where: { id: mediaId.data }, select: { id: true, departmentId: true, status: true } });
    if (!media) throw new ValidationError("Материал не найден.");
    await requireDepartmentWrite(admin, media.departmentId);
    if (media.status === PublicationStatus.ARCHIVED) throw new ValidationError("Сначала восстановите материал из архива.");
    if (status.data !== PublicationStatus.PUBLISHED) {
      const incomingPublishedActions = await db.scenarioAction.count({ where: { targetMediaId: media.id, step: { scenario: { status: PublicationStatus.PUBLISHED } } } });
      if (incomingPublishedActions) throw new ValidationError("На этот материал ведёт опубликованный сценарий. Сначала скройте сценарий или перенастройте кнопку.");
    }
    await db.mediaItem.update({ where: { id: media.id }, data: { status: status.data } });
    await db.auditLog.create({ data: { adminUserId: admin.id, entityType: "media_item", entityId: media.id, action: "publication", payload: { status: status.data } } });
    refreshContent();
    adminRedirect(media.departmentId, "notice", status.data === PublicationStatus.PUBLISHED ? "Материал опубликован." : "Материал скрыт с портала.", "media");
  } catch (error) {
    adminRedirect(undefined, "error", errorMessage(error), "media");
  }
}

export async function archiveMediaItemAction(formData: FormData) {
  const admin = await requireAdmin();
  const mediaId = idSchema.safeParse(formData.get("mediaId"));
  if (!mediaId.success) adminRedirect(undefined, "error", "Материал не найден.", "media");
  try {
    const media = await db.mediaItem.findUnique({ where: { id: mediaId.data }, select: { id: true, departmentId: true, status: true } });
    if (!media) throw new ValidationError("Материал не найден.");
    await requireDepartmentWrite(admin, media.departmentId);
    const restoring = media.status === PublicationStatus.ARCHIVED;
    if (!restoring) {
      const incomingActions = await db.scenarioAction.count({ where: { targetMediaId: media.id } });
      if (incomingActions) throw new ValidationError("На этот материал ведёт кнопка сценария. Сначала удалите или перенастройте её.");
    }
    await db.mediaItem.update({ where: { id: media.id }, data: { status: restoring ? PublicationStatus.DRAFT : PublicationStatus.ARCHIVED } });
    await db.auditLog.create({ data: { adminUserId: admin.id, entityType: "media_item", entityId: media.id, action: restoring ? "restore" : "archive" } });
    refreshContent();
    adminRedirect(media.departmentId, "notice", restoring ? "Материал восстановлен как черновик." : "Материал перемещён в архив.", "media");
  } catch (error) {
    adminRedirect(undefined, "error", errorMessage(error), "media");
  }
}

export async function deleteDraftMediaItemAction(formData: FormData) {
  const admin = await requireAdmin();
  const mediaId = idSchema.safeParse(formData.get("mediaId"));
  if (!mediaId.success) adminRedirect(undefined, "error", "Материал не найден.", "media");
  let departmentId: string | undefined;
  try {
    const media = await db.mediaItem.findUnique({ where: { id: mediaId.data }, select: { departmentId: true } });
    if (!media) throw new ValidationError("Материал не найден.");
    departmentId = media.departmentId;
    await requireDepartmentWrite(admin, departmentId);
    const { keys, references, demoted } = await db.$transaction(async (tx) => {
      const current = await tx.mediaItem.findUnique({ where: { id: mediaId.data }, select: { departmentId: true, storageObjectKey: true, posterObjectKey: true } });
      if (!current) throw new ValidationError("Материал не найден.");
      await requireDraftDepartment(tx, current.departmentId);
      const references = await tx.scenarioAction.count({ where: { targetMediaId: mediaId.data } });
      await tx.scenarioAction.deleteMany({ where: { targetMediaId: mediaId.data } });
      const result = await tx.mediaItem.deleteMany({ where: { id: mediaId.data, departmentId: current.departmentId } });
      if (!result.count) throw new ValidationError("Материал уже изменён. Обновите страницу.");
      const scenario = references ? await tx.scenario.updateMany({ where: { departmentId: current.departmentId, status: PublicationStatus.PUBLISHED }, data: { status: PublicationStatus.DRAFT } }) : { count: 0 };
      const keys = [current.storageObjectKey, current.posterObjectKey].filter((key): key is string => Boolean(key));
      await tx.auditLog.create({ data: { adminUserId: admin.id, entityType: "media_item", entityId: mediaId.data, action: "delete", payload: { storageObjectKeys: keys, removedActions: references } } });
      return { keys, references, demoted: Boolean(scenario.count) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const failed = await removeStoredFiles(keys);
    refreshContent();
    adminRedirect(departmentId, "notice", `Материал удалён.${references ? ` Связанные кнопки удалены: ${references}.` : ""}${demoted ? " Сценарий переведён в черновик." : ""}${failed ? " Файл не удалось очистить из хранилища." : ""}${references ? " Проверьте маршрут перед публикацией." : ""}`, "media");
  } catch (error) {
    adminRedirect(departmentId, "error", errorMessage(error), "media");
  }
}
