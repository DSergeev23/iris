import { PrismaClient, PublicationStatus, MediaKind } from "@prisma/client";

const db = new PrismaClient();
const records = [
  ["trauma", "Травматология", "Понятные шаги восстановления после травмы или операции. Выберите, что нужно сделать сейчас.", "Андрей", "Константинов", "Заведующий отделением, травматолог-ортопед", "Курирует восстановление после операций и помогает команде составить понятный маршрут до выписки.", "О травматологическом отделении", "Здесь помогают пациентам после травм, операций на суставах и сложных переломов. Все упражнения выполняйте только с учетом назначений лечащего врача.", "Как безопасно встать с кровати"],
  ["neuro", "Неврология", "Материалы для восстановления движений, речи и равновесия. Открывайте их в удобном темпе.", "Елена", "Морозова", "Заведующая отделением, врач-невролог", "Курирует восстановление пациентов и помогает команде отделения выстроить последовательный план наблюдения.", "О неврологическом отделении", "В отделении помогают пациентам с нарушениями движения, речи, чувствительности и равновесия. План восстановления подбирается индивидуально.", "Как безопасно сесть на кровати"],
  ["therapy", "Терапия", "Информация о режиме, показателях и подготовке к выписке для пациентов терапевтического отделения.", "Сергей", "Павлов", "Заведующий отделением, врач-терапевт", "Ведет пациентов с заболеваниями сердца, легких и внутренних органов, где особенно важен режим и контроль показателей.", "О терапевтическом отделении", "Отделение занимается диагностикой и лечением заболеваний внутренних органов. Здесь проводят обследования, назначают терапию и объясняют рекомендации по дальнейшему наблюдению.", "Как правильно измерить давление"],
];

try {
  if (await db.department.count()) { console.log("Content already exists; skipping seed."); process.exit(0); }
  for (const [sortOrder, record] of records.entries()) {
    const [slug, name, intro, firstName, lastName, roleTitle, biography, referenceTitle, referenceDescription, mediaTitle] = record;
    await db.department.create({ data: {
      slug, name, intro, sortOrder, status: PublicationStatus.PUBLISHED,
      head: { create: { firstName, lastName, roleTitle, biography } },
      reference: { create: { title: referenceTitle, description: referenceDescription } },
      facts: { create: [{ iconKey: "clock", title: "Врачебный обход", body: "Уточните время на посту медсестры", sortOrder: 0 }, { iconKey: "building", title: "Пост медсестры", body: "Обратитесь к персоналу вашего этажа", sortOrder: 1 }] },
      media: { create: { kind: MediaKind.VIDEO, title: mediaTitle, description: "Демонстрационная карточка: замените на загруженный файл.", status: PublicationStatus.DRAFT, storageObjectKey: `seed/${slug}/placeholder.mp4`, originalFilename: "placeholder.mp4", mimeType: "video/mp4", fileSizeBytes: BigInt(0), sortOrder: 0 } },
      scenario: { create: { title: "Провести по шагам", description: "Ответьте на несколько простых вопросов.", emergencyBody: "Позовите медсестру кнопкой вызова у кровати или обратитесь на пост.", status: PublicationStatus.PUBLISHED, steps: { create: { title: "Что нужно сейчас?", description: "Выберите самый подходящий вариант.", sortOrder: 0, actions: { create: [{ title: "Нужны рекомендации", body: "Хочу понять следующий шаг.", actionLabel: "Продолжить", kind: "INFORMATION", sortOrder: 0 }, { title: "Хочу посмотреть видео", body: "Нужно короткое объяснение.", actionLabel: "Открыть", kind: "MEDIA", sortOrder: 1 }] } } } } },
    } });
  }
  console.log("Initial portal content created.");
} finally { await db.$disconnect(); }
