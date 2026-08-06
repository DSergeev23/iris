import { Prisma, PublicationStatus, ScenarioActionKind } from "@prisma/client";
import { ValidationError } from "@/lib/errors";

type BootstrapStep = { title: string; description: string };
type BootstrapAction = {
  title: string;
  body: string;
  actionLabel: string;
  kind: ScenarioActionKind;
  targetStepIndex?: number;
};

const departments = [
  {
    slug: "trauma",
    name: "Травматология",
    intro: "Понятные шаги восстановления после травмы или операции. Выберите, что нужно сделать сейчас.",
    head: {
      firstName: "Андрей",
      lastName: "Константинов",
      roleTitle: "Заведующий отделением, травматолог-ортопед",
      biography: "Курирует восстановление после операций и помогает команде составить понятный маршрут пациента до выписки.",
      photoAlt: "Фотография заведующего травматологическим отделением",
    },
    reference: {
      title: "О травматологическом отделении",
      description: "Здесь помогают пациентам после травм, операций на суставах и сложных переломов. Команда отделения сопровождает пациента от первых обследований до подготовки к выписке, объясняет правила безопасного движения и порядок дальнейшего наблюдения. Все упражнения выполняйте только с учётом назначений лечащего врача.",
    },
    facts: [
      { iconKey: "clock", title: "Врачебный обход", body: "Уточните время на посту медицинской сестры." },
      { iconKey: "heart-pulse", title: "Пост медсестры", body: "Обратитесь к персоналу вашего этажа." },
    ],
    scenario: {
      description: "Подскажем безопасный следующий шаг после травмы или операции.",
      emergencyBody: "Позовите персонал при резком усилении боли, кровотечении, падении, онемении или внезапной слабости.",
      steps: [
        { title: "Что нужно сейчас?", description: "Выберите вариант, который лучше всего описывает вашу ситуацию." },
        { title: "Безопасное движение", description: "Вставайте и ходите только в пределах разрешённой нагрузки." },
        { title: "Подготовка к выписке", description: "Проверьте назначения, ограничения и дату следующего осмотра." },
      ] satisfies BootstrapStep[],
      actions: [
        { title: "Нужна помощь с движением", body: "Хочу безопасно сесть, встать или пройтись.", actionLabel: "Продолжить", kind: ScenarioActionKind.STEP, targetStepIndex: 1 },
        { title: "Готовлюсь к выписке", body: "Хочу проверить, что важно не забыть.", actionLabel: "Продолжить", kind: ScenarioActionKind.STEP, targetStepIndex: 2 },
        { title: "Мне стало хуже", body: "Боль усилилась или появился новый тревожный симптом.", actionLabel: "Срочная помощь", kind: ScenarioActionKind.EMERGENCY },
      ] satisfies BootstrapAction[],
    },
  },
  {
    slug: "neuro",
    name: "Неврология",
    intro: "Материалы для восстановления движений, речи и равновесия. Открывайте их в удобном темпе.",
    head: {
      firstName: "Елена",
      lastName: "Морозова",
      roleTitle: "Заведующая отделением, врач-невролог",
      biography: "Курирует восстановление пациентов и помогает команде отделения выстроить последовательный план наблюдения.",
      photoAlt: "Фотография заведующей неврологическим отделением",
    },
    reference: {
      title: "О неврологическом отделении",
      description: "В отделении помогают пациентам с нарушениями движения, речи, чувствительности и равновесия. План восстановления подбирается индивидуально, с учётом самочувствия, результатов обследований и рекомендаций специалистов. При внезапном ухудшении сразу сообщите медицинскому персоналу.",
    },
    facts: [
      { iconKey: "clock", title: "Занятия по восстановлению", body: "Время занятий зависит от индивидуального плана." },
      { iconKey: "heart-pulse", title: "Пост медсестры", body: "Сообщите персоналу о любом ухудшении самочувствия." },
    ],
    scenario: {
      description: "Подскажем, что делать на текущем этапе восстановления.",
      emergencyBody: "Позовите персонал при новой слабости, нарушении речи, сильном головокружении, потере сознания или внезапной головной боли.",
      steps: [
        { title: "Что нужно сейчас?", description: "Выберите вариант, который лучше всего описывает вашу ситуацию." },
        { title: "Движение и равновесие", description: "Не выполняйте упражнения без согласования со специалистом." },
        { title: "Режим восстановления", description: "Чередуйте занятия и отдых согласно вашему плану." },
      ] satisfies BootstrapStep[],
      actions: [
        { title: "Нужна помощь с движением", body: "Хочу безопасно выполнить назначенное действие.", actionLabel: "Продолжить", kind: ScenarioActionKind.STEP, targetStepIndex: 1 },
        { title: "Нужен режим восстановления", body: "Хочу понять, как чередовать занятия и отдых.", actionLabel: "Продолжить", kind: ScenarioActionKind.STEP, targetStepIndex: 2 },
        { title: "Мне стало хуже", body: "Появился новый или резко усилившийся симптом.", actionLabel: "Срочная помощь", kind: ScenarioActionKind.EMERGENCY },
      ] satisfies BootstrapAction[],
    },
  },
  {
    slug: "therapy",
    name: "Терапия",
    intro: "Информация о режиме, показателях и подготовке к выписке для пациентов терапевтического отделения.",
    head: {
      firstName: "Сергей",
      lastName: "Павлов",
      roleTitle: "Заведующий отделением, врач-терапевт",
      biography: "Ведёт пациентов с заболеваниями сердца, лёгких и внутренних органов, где особенно важны режим и контроль показателей.",
      photoAlt: "Фотография заведующего терапевтическим отделением",
    },
    reference: {
      title: "О терапевтическом отделении",
      description: "Отделение занимается диагностикой и лечением заболеваний внутренних органов. Здесь проводят обследования, назначают терапию, контролируют основные показатели и объясняют рекомендации по дальнейшему наблюдению. Перед выполнением новых упражнений или изменением режима уточните назначения у врача.",
    },
    facts: [
      { iconKey: "heart-pulse", title: "Контроль показателей", body: "Измерения выполняются по назначенному графику." },
      { iconKey: "clock", title: "Пост медсестры", body: "Уточните подготовку к обследованиям на посту." },
    ],
    scenario: {
      description: "Поможем разобраться с режимом, показателями и подготовкой к выписке.",
      emergencyBody: "Позовите персонал при боли в груди, выраженной одышке, потере сознания, резкой слабости или заметном ухудшении состояния.",
      steps: [
        { title: "Что нужно сейчас?", description: "Выберите вариант, который лучше всего описывает вашу ситуацию." },
        { title: "Контроль самочувствия", description: "Следуйте назначенному графику измерений и приёма лекарств." },
        { title: "Подготовка к выписке", description: "Уточните назначения, рецепты и дату следующего приёма." },
      ] satisfies BootstrapStep[],
      actions: [
        { title: "Нужно проверить самочувствие", body: "Хочу понять, какие показатели контролировать.", actionLabel: "Продолжить", kind: ScenarioActionKind.STEP, targetStepIndex: 1 },
        { title: "Готовлюсь к выписке", body: "Хочу проверить назначения и документы.", actionLabel: "Продолжить", kind: ScenarioActionKind.STEP, targetStepIndex: 2 },
        { title: "Мне стало хуже", body: "Появилась боль, одышка или резкая слабость.", actionLabel: "Срочная помощь", kind: ScenarioActionKind.EMERGENCY },
      ] satisfies BootstrapAction[],
    },
  },
] as const;

export async function createInitialContent(tx: Prisma.TransactionClient, adminUserId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('iris_initial_content'))`;
  const existing = await tx.department.findMany({ select: { slug: true } });
  const existingSlugs = new Set(existing.map((item) => item.slug));
  const missing = departments.filter((item) => !existingSlugs.has(item.slug));
  if (!missing.length) return null;
  if (existing.length + missing.length > 20) throw new ValidationError("Недостаточно свободных мест для стартовых отделений.");
  const maxOrder = await tx.department.aggregate({ _max: { sortOrder: true } });

  const departmentIds: string[] = [];
  for (const [departmentIndex, item] of missing.entries()) {
    const department = await tx.department.create({
      data: {
        slug: item.slug,
        name: item.name,
        intro: item.intro,
        status: PublicationStatus.PUBLISHED,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + departmentIndex + 1,
        head: { create: item.head },
        reference: { create: item.reference },
        facts: { create: item.facts.map((fact, sortOrder) => ({ ...fact, sortOrder })) },
        scenario: {
          create: {
            title: "Провести по шагам",
            description: item.scenario.description,
            emergencyTitle: "Сразу позовите медсестру",
            emergencyBody: item.scenario.emergencyBody,
            status: PublicationStatus.PUBLISHED,
          },
        },
      },
      include: { scenario: true },
    });
    departmentIds.push(department.id);

    const steps = [];
    for (const [sortOrder, step] of item.scenario.steps.entries()) {
      steps.push(await tx.scenarioStep.create({ data: { scenarioId: department.scenario!.id, ...step, sortOrder } }));
    }

    for (const [sortOrder, action] of item.scenario.actions.entries()) {
      await tx.scenarioAction.create({
        data: {
          stepId: steps[0].id,
          title: action.title,
          body: action.body,
          actionLabel: action.actionLabel,
          kind: action.kind,
          targetStepId: action.targetStepIndex === undefined ? null : steps[action.targetStepIndex].id,
          sortOrder,
        },
      });
    }
  }

  await tx.auditLog.create({
    data: {
      adminUserId,
      entityType: "system",
      action: "initial_content_bootstrap",
      payload: { departments: departmentIds.length },
    },
  });

  return { firstDepartmentId: departmentIds[0], createdCount: departmentIds.length };
}
