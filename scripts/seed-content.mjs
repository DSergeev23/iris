import { PrismaClient, PublicationStatus, ScenarioActionKind } from "@prisma/client";

const db = new PrismaClient();
const records = [
  ["trauma", "Травматология", "Понятные этапы восстановления после травмы или операции. Выберите, что нужно сделать сейчас.", "Андрей", "Константинов", "Заведующий отделением, травматолог-ортопед", "Курирует восстановление после операций и помогает команде составить понятный маршрут до выписки.", "О травматологическом отделении", "Здесь помогают пациентам после травм, операций на суставах и сложных переломов. Все упражнения выполняйте только с учетом назначений лечащего врача."],
  ["neuro", "Неврология", "Материалы для восстановления движений, речи и равновесия. Открывайте их в удобном темпе.", "Елена", "Морозова", "Заведующая отделением, врач-невролог", "Курирует восстановление пациентов и помогает команде отделения выстроить последовательный план наблюдения.", "О неврологическом отделении", "В отделении помогают пациентам с нарушениями движения, речи, чувствительности и равновесия. План восстановления подбирается индивидуально."],
  ["therapy", "Терапия", "Информация о режиме, показателях и подготовке к выписке для пациентов терапевтического отделения.", "Сергей", "Павлов", "Заведующий отделением, врач-терапевт", "Ведет пациентов с заболеваниями сердца, легких и внутренних органов, где особенно важен режим и контроль показателей.", "О терапевтическом отделении", "Отделение занимается диагностикой и лечением заболеваний внутренних органов. Здесь проводят обследования, назначают терапию и объясняют рекомендации по дальнейшему наблюдению."],
];

try {
  if (await db.department.count()) { console.log("Content already exists; skipping seed."); process.exit(0); }
  for (const [sortOrder, record] of records.entries()) {
    const [slug, name, intro, firstName, lastName, roleTitle, biography, referenceTitle, referenceDescription] = record;
    const department = await db.department.create({ data: {
      slug, name, intro, sortOrder, status: PublicationStatus.DRAFT,
      head: { create: { firstName, lastName, roleTitle, biography } },
      reference: { create: { title: referenceTitle, description: referenceDescription } },
      facts: { create: [{ iconKey: "clock", title: "Врачебный обход", body: "Уточните время на посту медсестры", sortOrder: 0 }, { iconKey: "heart-pulse", title: "Пост медсестры", body: "Обратитесь к персоналу вашего этажа", sortOrder: 1 }] },
      scenario: { create: { title: "Провести по этапам", description: "Ответьте на несколько простых вопросов.", emergencyBody: "Позовите медсестру кнопкой вызова у кровати или обратитесь на пост.", status: PublicationStatus.DRAFT } },
    }, include: { scenario: true } });
    const steps = await Promise.all([
      ["Что нужно сейчас?", "Выберите самый подходящий вариант."],
      ["Следующий этап", "Выполняйте рекомендации только с учётом назначений врача."],
      ["Подготовка к выписке", "Уточните дальнейшие рекомендации у персонала."],
    ].map(([title, description], sortOrder) => db.scenarioStep.create({ data: { scenarioId: department.scenario.id, title, description, sortOrder } })));
    await db.scenarioAction.createMany({ data: [
      { stepId: steps[0].id, title: "Нужны рекомендации", body: "Хочу понять следующий этап.", actionLabel: "Продолжить", kind: ScenarioActionKind.STEP, targetStepId: steps[1].id, sortOrder: 0 },
      { stepId: steps[0].id, title: "Готовлюсь к выписке", body: "Хочу проверить рекомендации.", actionLabel: "Продолжить", kind: ScenarioActionKind.STEP, targetStepId: steps[2].id, sortOrder: 1 },
      { stepId: steps[0].id, title: "Мне стало хуже", body: "Появился тревожный симптом.", actionLabel: "Срочная помощь", kind: ScenarioActionKind.EMERGENCY, sortOrder: 2 },
      { stepId: steps[1].id, title: "Продолжить", body: "Перейти к подготовке к выписке.", actionLabel: "Продолжить", kind: ScenarioActionKind.STEP, targetStepId: steps[2].id, sortOrder: 0 },
      { stepId: steps[2].id, title: "Понятно", body: "Вернуться к материалам отделения.", actionLabel: "Завершить", kind: ScenarioActionKind.INFORMATION, sortOrder: 0 },
    ] });
  }
  console.log("Initial portal content created.");
} finally { await db.$disconnect(); }
