import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceDir = path.join(root, "data/mvp-rehabilitation");
const assetDir = path.join(root, "output/mvp-source");
const sourceUrl = "https://iriscare.ru/";

const assets = [
  ["Posle operatsii.mp4", 7845480, "5aefdaa88910c1c327fae3bf97ee3e348ad94d1b89c9673d4bbe23653b2600ce"],
  ["Uprajneniya.mp4", 17966528, "5de9743ec6efd453ccc029da28c59e80ba7dbfd69704f97be12caf26bbf57693"],
  ["Vstat s Krovati.mp4", 19569732, "aefe89543e0353f923808c68bc4ce74a0b93132a1757d889b2f53ad1948000aa"],
  ["Vstat so stula.mp4", 8922988, "868bd96057a6ea33fc1f6edbd5f57c4f75498a49ef7399b7a9d9c3a70b0b14f1"],
  ["Kostili.mp4", 7327006, "4c72e8e6b0d4078c65080b586681bafc0cbeda6ca403cfa1fd7830213ee3303e"],
  ["Hodunki.mp4", 8638257, "8457ae7b273bd2c7e1e711e23af03d7db037a420a4b82e4fa7e98358b1cf616e"],
  ["Po lestnitse.mp4", 21233664, "d4dad98dbe115641930ae6b1e0a48f1c0d425ddc5aa61ad95a3b5727495414b9"],
  ["Iz mashini.mp4", 18151025, "bb91c6e94ec1e1cc2aed11f4ba076a3dbbf5b48487a9466c8cdf580e05a0c064"],
  ["pavlova-ekaterina-aleksandrovna.png", 532902, "9c0292ec045a8bb939fe27ff9e8cdadd05af55e89c7df67ec27e3b8f4dff0f79"],
];

const titles = {
  operation_question: "Планируемая операция",
  stage_selection: "Выбор этапа",
  consultation_info: "Консультация травматолога",
  preoperative_examination: "Предоперационное обследование",
  anesthesiologist_consultation: "Консультация анестезиолога",
  call_center_hours: "Часы работы КДЦ",
  anesthesiologist_documents: "Документы для анестезиолога",
  documents_required: "Документы для травматолога",
  pre_operation_materials: "Подготовка к операции",
  what_to_bring: "Что взять в больницу",
  hospitalization_notice: "Перед госпитализацией",
  traumatology_information: "В отделении травматологии",
  hospitalization_day_info: "День госпитализации",
  operation_day_info: "День операции",
  post_operation_info: "После операции",
  discharge_info: "Выписка домой",
  rehabilitation_info: "Реабилитация в ГКБ №1",
  surgery_joint_selection: "После операции: выбор сустава",
  planned_surgery_joint: "Перед операцией: выбор сустава",
  feedback_survey: "Анкета пациента",
  feedback_iris_help: "Помог ли ИРИС",
  support_feedback: "Оценка информационной поддержки",
  overall_satisfaction: "Общая оценка помощи",
  feedback_text: "Пожелание или отзыв",
  educational_video_list: "Видео для коленного сустава",
  educational_video_menu: "Видео для тазобедренного сустава",
  goodbye_message: "Завершение сценария",
};

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function normalizeNext(next) {
  if (/^overall_satisfaction_[1-5]$/.test(next)) return "overall_satisfaction";
  if (/^feedback_text_[1-5]$/.test(next)) return "feedback_text";
  return next;
}

function visibleText(value) {
  return String(value || "").replace(/👇/gu, "").trim();
}

function screenText(value) {
  return String(value || "").replace(/\*(.+?)\*/g, "$1").trim();
}

function buttonTitle(value) {
  return screenText(value).replace(/^[⏹⏩⏪✅❗📌📞👉👇🧾📹⏰📃❓🔄◀️]+\s*/u, "");
}

export function importPlan(screens, department) {
  if (!screens.start_prompt || !screens.operation_question) throw new Error("MVP snapshot is missing the start screens.");
  if (department.head?.photoFilename !== "pavlova-ekaterina-aleksandrovna.png") throw new Error("The head photo differs from the downloaded asset.");
  const reachable = new Set();
  const pending = ["operation_question"];
  while (pending.length) {
    const key = pending.pop();
    if (reachable.has(key)) continue;
    const screen = screens[key];
    if (!screen) throw new Error(`Broken MVP transition: ${key}`);
    reachable.add(key);
    for (const button of screen.buttons || []) {
      if (button.next !== "restart") pending.push(normalizeNext(button.next));
    }
  }

  const keys = ["operation_question", ...Object.keys(screens).filter((key) => key !== "operation_question" && reachable.has(key))];
  const videoScreens = Object.values(screens).filter((screen) => screen.video);
  const mediaByFile = new Map();
  for (const screen of videoScreens) {
    if (!mediaByFile.has(screen.video)) mediaByFile.set(screen.video, screen);
  }
  const videos = [...mediaByFile].map(([filename, screen]) => ({
    filename,
    title: visibleText(screen.caption || filename.replace(/\.mp4$/i, "")),
    description: screenText(screen.text),
  }));
  const steps = keys.map((key) => ({
    key,
    title: visibleText(screens[key].caption) || titles[key],
    displayTitle: visibleText(screens[key].caption) || (screens[key].video ? screens[key].video.replace(/\.mp4$/i, "") : "ИРИС"),
    description: screenText(screens[key].text),
    feedbackInput: key === "feedback_text",
    resumeOnReentry: key === "stage_selection",
    video: screens[key].video || null,
    buttons: (screens[key].buttons || []).map((button) => ({
      title: buttonTitle(button.text),
      next: button.next === "restart" ? "restart" : normalizeNext(button.next),
    })),
  }));
  if (steps.some((step) => !step.title || !step.buttons.length)) throw new Error("An active screen lacks a title or buttons.");
  if (steps.some((step) => step.title.length > 180 || step.displayTitle.length > 180 || step.description.length > 2000)) throw new Error("An MVP screen exceeds admin field limits.");
  if (steps.some((step) => step.buttons.some((button) => !button.title || button.title.length > 180 || (button.next !== "restart" && !reachable.has(button.next))))) {
    throw new Error("An MVP button has an invalid title or target.");
  }
  const expectedVideos = new Set(assets.filter(([name]) => name.endsWith(".mp4")).map(([name]) => name));
  if (videos.length !== expectedVideos.size || videos.some((video) => !expectedVideos.has(video.filename))) throw new Error("The video inventory differs from the downloaded assets.");
  return {
    department,
    welcomeText: screenText(screens.start_prompt.text),
    steps,
    videos,
    unused: Object.keys(screens).filter((key) => !reachable.has(key) && key !== "start_prompt"),
    sourceScreens: Object.keys(screens).length,
  };
}

function assetPath(directory, name) {
  return path.join(directory, name.endsWith(".mp4") ? "videos" : "", name);
}

async function verifyAssets() {
  for (const [name, size, hash] of assets) {
    const buffer = await readFile(assetPath(assetDir, name));
    if (buffer.length !== size || sha256(buffer) !== hash) throw new Error(`MVP asset checksum mismatch: ${name}`);
  }
}

function normalizeTitle(value) {
  return value.toLocaleLowerCase("ru").replace(/[^\p{L}\p{N}]+/gu, "");
}

async function applyExistingScenario(plan, sourceHash) {
  if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL; production credentials must stay out of the repository.");
  const { PrismaClient, PublicationStatus, ScenarioActionKind } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    const priorImport = await db.auditLog.findFirst({
      where: { entityType: "scenario", action: "mvp_rehabilitation_scenario_import" },
      orderBy: { createdAt: "desc" },
      select: { payload: true },
    });
    if (priorImport) {
      if (priorImport.payload && typeof priorImport.payload === "object" && !Array.isArray(priorImport.payload) && priorImport.payload.sourceHash === sourceHash) {
        console.log("The same MVP scenario was already imported. Nothing to change.");
        return;
      }
      throw new Error("This scenario was imported from a different MVP snapshot; refusing to overwrite it.");
    }
    const department = await db.department.findUnique({
      where: { slug: "early-medical-rehabilitation" },
      include: {
        head: true,
        reference: true,
        facts: true,
        media: true,
        scenario: { include: { steps: { include: { actions: true } } } },
      },
    });
    if (!department || department.name !== plan.department.name || department.status !== PublicationStatus.PUBLISHED) {
      throw new Error("The existing published rehabilitation department was not found.");
    }
    if (!department.scenario) throw new Error("The existing rehabilitation scenario was not found.");
    if (!department.head?.photoObjectKey || !department.reference || department.facts.length !== plan.department.facts.length) {
      throw new Error("The existing department is missing the MVP profile, reference, or facts.");
    }

    const fileSizes = new Map(assets.map(([filename, size]) => [filename, size]));
    const videoMedia = new Map();
    for (const video of plan.videos) {
      const media = department.media.find((item) =>
        item.kind === "VIDEO" && item.status === PublicationStatus.PUBLISHED && Number(item.fileSizeBytes) === fileSizes.get(video.filename)
          && (item.originalFilename === video.filename || normalizeTitle(item.title) === normalizeTitle(video.title)));
      if (!media || [...videoMedia.values()].some((item) => item.id === media.id)) {
        throw new Error(`Missing or mismatched existing MVP video: ${video.filename}`);
      }
      videoMedia.set(video.filename, media);
    }
    if (department.media.length !== plan.videos.length) throw new Error("The existing department has a different media inventory; review it before import.");

    const scenarioId = department.scenario.id;
    const stepIds = new Map(plan.steps.map((step) => [step.key, randomUUID()]));
    await db.$transaction(async (tx) => {
      const existingImport = await tx.auditLog.findFirst({ where: { entityType: "scenario", entityId: scenarioId, action: "mvp_rehabilitation_scenario_import" } });
      if (existingImport) throw new Error("The MVP scenario was imported concurrently; refusing a second write.");
      await tx.scenarioStep.deleteMany({ where: { scenarioId } });
      await tx.scenario.update({ where: { id: scenarioId }, data: {
        title: plan.department.scenario.title,
        description: plan.department.scenario.description,
        welcomeText: plan.welcomeText,
        emergencyTitle: plan.department.scenario.emergencyTitle,
        emergencyBody: plan.department.scenario.emergencyBody,
        status: PublicationStatus.PUBLISHED,
      } });
      for (const video of plan.videos) {
        await tx.mediaItem.update({ where: { id: videoMedia.get(video.filename).id }, data: { title: video.title, description: video.description } });
      }
      await tx.scenarioStep.createMany({ data: plan.steps.map((step, sortOrder) => ({
        id: stepIds.get(step.key), scenarioId, title: step.title, displayTitle: step.displayTitle, description: step.description,
        feedbackInput: step.feedbackInput, resumeOnReentry: step.resumeOnReentry,
        mediaItemId: step.video ? videoMedia.get(step.video).id : null, sortOrder,
      })) });
      await tx.scenarioAction.createMany({ data: plan.steps.flatMap((step) => step.buttons.map((button, sortOrder) => ({
        stepId: stepIds.get(step.key), title: button.title, body: "", actionLabel: button.next === "restart" ? "Начать сначала" : "Открыть",
        kind: button.next === "restart" ? ScenarioActionKind.RESTART : ScenarioActionKind.STEP,
        targetStepId: button.next === "restart" ? null : stepIds.get(button.next), sortOrder,
      }))) });
      await tx.auditLog.create({ data: { entityType: "scenario", entityId: scenarioId, action: "mvp_rehabilitation_scenario_import", payload: {
        sourceUrl, sourceHash, sourceScreens: plan.sourceScreens, importedSteps: plan.steps.length,
        importedActions: plan.steps.reduce((count, step) => count + step.buttons.length, 0),
        reusedVideoIds: [...videoMedia.values()].map((item) => item.id),
        previousScenario: JSON.parse(JSON.stringify(department.scenario)),
        previousMedia: department.media.map((item) => ({ id: item.id, title: item.title, description: item.description })),
      } } });
    }, { timeout: 60_000 });

    const imported = await db.scenario.findUniqueOrThrow({ where: { id: scenarioId }, include: { steps: { include: { actions: true } } } });
    const actionCount = imported.steps.reduce((count, step) => count + step.actions.length, 0);
    const plannedActionCount = plan.steps.reduce((count, step) => count + step.buttons.length, 0);
    if (imported.steps.length !== plan.steps.length || actionCount !== plannedActionCount || imported.steps.filter((step) => step.mediaItemId).length !== plan.steps.filter((step) => step.video).length) {
      throw new Error("The updated scenario does not match the verified MVP snapshot.");
    }
    console.log(`Updated existing rehabilitation department: ${imported.steps.length} steps, ${actionCount} actions, ${videoMedia.size} reused videos.`);
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const mode = process.argv[2] || "--check";
  if (!["--check", "--apply-existing"].includes(mode) || process.argv.length > 3) throw new Error("Usage: node scripts/import-mvp-rehabilitation.mjs [--check|--apply-existing]");
  const screensBuffer = await readFile(path.join(sourceDir, "screens.json"));
  const screens = JSON.parse(screensBuffer);
  const departmentBuffer = await readFile(path.join(sourceDir, "department.json"));
  const department = JSON.parse(departmentBuffer);
  const plan = importPlan(screens, department);
  const sourceHash = sha256(Buffer.concat([screensBuffer, departmentBuffer]));
  if (mode === "--check") await verifyAssets();
  console.log(`MVP snapshot verified: ${plan.sourceScreens} source screens, ${plan.steps.length} reachable steps, ${plan.videos.length} unique videos, one photo.`);
  console.log(`Unused source screens retained in JSON: ${plan.unused.join(", ")}.`);
  if (mode === "--apply-existing") await applyExistingScenario(plan, sourceHash);
}
