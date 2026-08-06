import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";

export type AdminActor = { id: string };

export async function requireDepartmentWrite(_admin: AdminActor, departmentId: string) {
  const department = await db.department.findUnique({ where: { id: departmentId }, select: { id: true } });
  if (!department) throw new ValidationError("Отделение не найдено.");
  return department;
}

export async function requireScenarioWrite(_admin: AdminActor, scenarioId: string) {
  const scenario = await db.scenario.findUnique({
    where: { id: scenarioId },
    select: { id: true, departmentId: true },
  });
  if (!scenario) throw new ValidationError("Сценарий не найден.");
  return scenario;
}

export async function requireScenarioStepWrite(_admin: AdminActor, stepId: string) {
  const step = await db.scenarioStep.findUnique({
    where: { id: stepId },
    select: { id: true, scenarioId: true, scenario: { select: { departmentId: true } } },
  });
  if (!step) throw new ValidationError("Шаг сценария не найден.");
  return step;
}
