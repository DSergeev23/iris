import { Prisma, PublicationStatus, ScenarioActionKind } from "@prisma/client";

export type ScenarioReader = Pick<Prisma.TransactionClient, "scenario">;

export async function scenarioPublicationReadiness(scenarioId: string, client: ScenarioReader) {
  const scenario = await client.scenario.findUniqueOrThrow({
    where: { id: scenarioId },
    select: { steps: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, actions: { select: { kind: true, targetStepId: true, targetMedia: { select: { status: true } } } } } } },
  });
  if (!scenario.steps.length) return "добавьте хотя бы один шаг";
  if (scenario.steps.some((step) => !step.actions.length)) return "добавьте хотя бы одну кнопку в каждый шаг";
  if (scenario.steps.some((step) => step.actions.some((action) => action.kind === ScenarioActionKind.MEDIA && action.targetMedia?.status !== PublicationStatus.PUBLISHED))) {
    return "опубликуйте все материалы, выбранные для кнопок сценария";
  }

  const stepsById = new Map(scenario.steps.map((step) => [step.id, step]));
  const reachableStepIds = new Set([scenario.steps[0].id]);
  const pendingStepIds = [scenario.steps[0].id];
  while (pendingStepIds.length) {
    const step = stepsById.get(pendingStepIds.pop()!);
    if (!step) continue;
    for (const action of step.actions) {
      if (action.kind !== ScenarioActionKind.STEP) continue;
      if (!action.targetStepId || !stepsById.has(action.targetStepId)) return "проверьте переходы между шагами";
      if (!reachableStepIds.has(action.targetStepId)) {
        reachableStepIds.add(action.targetStepId);
        pendingStepIds.push(action.targetStepId);
      }
    }
  }

  const unreachableSteps = scenario.steps.filter((step) => !reachableStepIds.has(step.id)).map((step) => step.title);
  return unreachableSteps.length ? `свяжите со стартовым шагом: ${unreachableSteps.join(", ")}` : null;
}
