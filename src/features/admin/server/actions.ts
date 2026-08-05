"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { requireAdmin } from "@/features/auth/server/session";

const departmentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).max(60),
});

const departmentContentSchema = z.object({
  departmentId: z.string().uuid(),
  intro: z.string().trim().max(2000),
  referenceTitle: z.string().trim().min(2).max(180),
  referenceDescription: z.string().trim().max(8000),
});

const headSchema = z.object({
  departmentId: z.string().uuid(),
  firstName: z.string().trim().max(100),
  lastName: z.string().trim().max(100),
  middleName: z.string().trim().max(100),
  roleTitle: z.string().trim().max(250),
  biography: z.string().trim().max(5000),
});

const scenarioSchema = z.object({
  scenarioId: z.string().uuid(),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000),
  emergencyTitle: z.string().trim().min(2).max(180),
  emergencyBody: z.string().trim().max(3000),
});

const stepSchema = z.object({ scenarioId: z.string().uuid(), title: z.string().trim().min(2).max(180), description: z.string().trim().max(2000) });
const actionSchema = z.object({ stepId: z.string().uuid(), title: z.string().trim().min(2).max(180), body: z.string().trim().max(2000), actionLabel: z.string().trim().max(80), kind: z.enum(["STEP", "MEDIA", "EMERGENCY", "INFORMATION"]) });

export async function createDepartmentAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = departmentSchema.safeParse({ name: formData.get("name"), slug: formData.get("slug") });
  if (!parsed.success) throw new ValidationError("Укажите название и URL-код отделения латиницей.");

  const count = await db.department.count();
  if (count >= 20) throw new ValidationError("Можно создать не более 20 отделений.");

  const department = await db.$transaction(async (tx) => {
    const created = await tx.department.create({ data: { ...parsed.data, sortOrder: count } });
    await tx.departmentReferenceSection.create({ data: { departmentId: created.id, title: `О ${created.name}`, description: "Добавьте справочную информацию для пациентов." } });
    await tx.departmentHead.create({ data: { departmentId: created.id, firstName: "", lastName: "", roleTitle: "", biography: "" } });
    await tx.scenario.create({ data: { departmentId: created.id, title: "Провести по шагам" } });
    return created;
  });

  await db.auditLog.create({ data: { adminUserId: admin.id, entityType: "department", entityId: department.id, action: "create", payload: { slug: department.slug } } });
  revalidatePath("/portal");
  revalidatePath("/admin");
}

export async function updateDepartmentContentAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = departmentContentSchema.safeParse({
    departmentId: formData.get("departmentId"), intro: formData.get("intro"), referenceTitle: formData.get("referenceTitle"), referenceDescription: formData.get("referenceDescription"),
  });
  if (!parsed.success) throw new ValidationError("Проверьте заполнение текстовых полей.");

  const data = parsed.data;
  await db.$transaction(async (tx) => {
    await tx.department.update({ where: { id: data.departmentId }, data: { intro: data.intro } });
    await tx.departmentReferenceSection.upsert({
      where: { departmentId: data.departmentId },
      create: { departmentId: data.departmentId, title: data.referenceTitle, description: data.referenceDescription },
      update: { title: data.referenceTitle, description: data.referenceDescription },
    });
  });
  await db.auditLog.create({ data: { adminUserId: admin.id, entityType: "department", entityId: data.departmentId, action: "update_content" } });
  revalidatePath("/portal");
  revalidatePath("/admin");
}

export async function updateDepartmentHeadAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = headSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new ValidationError("Проверьте данные заведующего.");
  const { departmentId, middleName, ...data } = parsed.data;
  await db.departmentHead.upsert({
    where: { departmentId },
    create: { departmentId, ...data, middleName: middleName || null },
    update: { ...data, middleName: middleName || null },
  });
  await db.auditLog.create({ data: { adminUserId: admin.id, entityType: "department_head", entityId: departmentId, action: "update" } });
  revalidatePath("/portal"); revalidatePath("/admin");
}

export async function updateScenarioAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = scenarioSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new ValidationError("Проверьте настройки сценария.");
  await db.scenario.update({ where: { id: parsed.data.scenarioId }, data: parsed.data });
  await db.auditLog.create({ data: { adminUserId: admin.id, entityType: "scenario", entityId: parsed.data.scenarioId, action: "update" } });
  revalidatePath("/portal"); revalidatePath("/admin");
}

export async function addScenarioStepAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = stepSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new ValidationError("Укажите название шага.");
  const sortOrder = await db.scenarioStep.count({ where: { scenarioId: parsed.data.scenarioId } });
  const step = await db.scenarioStep.create({ data: { ...parsed.data, sortOrder } });
  await db.auditLog.create({ data: { adminUserId: admin.id, entityType: "scenario_step", entityId: step.id, action: "create" } });
  revalidatePath("/portal"); revalidatePath("/admin");
}

export async function addScenarioActionAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = actionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new ValidationError("Проверьте данные действия.");
  const sortOrder = await db.scenarioAction.count({ where: { stepId: parsed.data.stepId } });
  const action = await db.scenarioAction.create({ data: { ...parsed.data, sortOrder } });
  await db.auditLog.create({ data: { adminUserId: admin.id, entityType: "scenario_action", entityId: action.id, action: "create", payload: { kind: action.kind } } });
  revalidatePath("/portal"); revalidatePath("/admin");
}
