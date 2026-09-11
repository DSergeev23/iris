import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const adminPage = read("src/app/admin/page.tsx");
const actions = read("src/features/admin/server/actions.ts");
const bootstrap = read("src/features/admin/server/bootstrap-content.ts");
const seed = read("scripts/seed-content.mjs");
const portalRepository = read("src/features/portal/server/repository.ts");
const portalClient = read("src/features/portal/components/portal-client.tsx");
const portalMediaRoute = read("src/app/api/portal/media/[mediaId]/route.ts");
const scenarioReadiness = read("src/features/admin/server/scenario-readiness.ts");

test("смена отделения перемонтирует редактор и не оставляет defaultValue предыдущего", () => {
  assert.match(adminPage, /<div key=\{selected\.id\} className="selected-department-editor">/);
});

test("нельзя удалить шаг, пока на него ведёт переход", () => {
  assert.match(actions, /scenarioAction\.count\(\{ where: \{ targetStepId: step\.id \} \}\)/);
  assert.match(actions, /Сначала удалите или перенастройте эти переходы/);
});

test("админка поддерживает обратимое архивирование отделений, сценариев и медиа", () => {
  for (const name of ["archiveDepartmentAction", "archiveScenarioAction", "archiveMediaItemAction"]) {
    assert.match(actions, new RegExp(`export async function ${name}`));
  }
  assert.match(actions, /PublicationStatus\.ARCHIVED/);
  assert.match(actions, /PublicationStatus\.DRAFT/);
});

test("стартовое заполнение создаёт черновики и не обходит требования публикации", () => {
  assert.doesNotMatch(bootstrap, /status: PublicationStatus\.PUBLISHED/);
  assert.doesNotMatch(seed, /status: PublicationStatus\.PUBLISHED/);
  assert.match(bootstrap, /status: PublicationStatus\.DRAFT/);
  assert.match(seed, /status: PublicationStatus\.DRAFT/);
});

test("оба способа стартового заполнения создают публикуемый сценарий без фиктивных медиа", () => {
  assert.match(bootstrap, /for \(const \[stepIndex, step\] of steps\.entries\(\)\)/);
  assert.match(bootstrap, /stepId: step\.id/);
  assert.match(bootstrap, /targetStepId: nextStep\?\.id \?\? null/);
  assert.match(seed, /const steps = await Promise\.all/);
  assert.match(seed, /targetStepId: steps\[1\]\.id/);
  assert.match(seed, /stepId: steps\[2\]\.id/);
  assert.doesNotMatch(seed, /placeholder\.mp4|MediaKind\.VIDEO|storageObjectKey/);
});

test("портал читает только опубликованные записи", () => {
  assert.match(portalRepository, /where: \{ status: PublicationStatus\.PUBLISHED \}/);
});

test("публикация отделения не требует контент или профиль заведующего", () => {
  const readiness = actions.slice(actions.indexOf("async function publicationReadiness"), actions.indexOf("async function ensurePublishedScenarioReadiness"));
  assert.doesNotMatch(readiness, /intro|reference|head|краткое описание|справку об отделении|профиль и фотографию заведующего/);
});

test("публикация сценария проверяет достижимость всех шагов от стартового", () => {
  assert.match(scenarioReadiness, /orderBy: \{ sortOrder: "asc" \}/);
  assert.match(scenarioReadiness, /const reachableStepIds = new Set\(\[scenario\.steps\[0\]\.id\]\)/);
  assert.match(scenarioReadiness, /action\.kind !== ScenarioActionKind\.STEP/);
  assert.match(scenarioReadiness, /свяжите со стартовым шагом/);
  assert.match(adminPage, /Стартовый шаг/);
});

test("опубликованный сценарий не ссылается на скрытый материал", () => {
  assert.match(scenarioReadiness, /targetMedia: \{ select: \{ status: true \} \}/);
  assert.match(scenarioReadiness, /опубликуйте все материалы, выбранные для кнопок сценария/);
  assert.match(actions, /source\.scenario\.status === PublicationStatus\.PUBLISHED/);
  assert.match(actions, /incomingPublishedActions/);
  assert.match(adminPage, /item\.status === PublicationStatus\.PUBLISHED/);
});

test("структурные изменения не ломают опубликованный сценарий", () => {
  assert.match(actions, /async function ensurePublishedScenarioReadiness/);
  assert.match(actions, /Изменение нарушит опубликованный сценарий/);
  assert.match(actions, /await ensurePublishedScenarioReadiness\(step\.scenario, tx\)/);
  assert.match(actions, /await ensurePublishedScenarioReadiness\(sourceStep\.scenario, tx\)/);
});

test("сценарий начинается с согласия на обработку персональных данных", () => {
  assert.match(portalClient, /Согласен на обработку персональных данных/);
  assert.match(portalClient, /hasPersonalDataConsent/);
  assert.match(portalClient, /disabled=\{!patientName\.trim\(\) \|\| !hasPersonalDataConsent\}/);
});

test("кнопки пациента используют понятную формулировку сценария", () => {
  assert.match(portalClient, /Помочь мне сориентироваться/);
  assert.doesNotMatch(portalClient, /Провести по шагам/);
});

test("короткое описание отделения выводится на первом экране", () => {
  assert.match(adminPage, /Короткое описание для первого экрана/);
  assert.match(portalClient, /<p>\{department\.intro\}<\/p>/);
  assert.doesNotMatch(portalClient, /Сканируйте QR-код, выбирайте свой этап/);
});

test("медиа получают свежую ссылку только для опубликованного материала", () => {
  assert.match(portalMediaRoute, /status: PublicationStatus\.PUBLISHED, department: \{ status: PublicationStatus\.PUBLISHED \}/);
  assert.match(portalMediaRoute, /getS3ReadUrl\(media\.storageObjectKey\)/);
  assert.match(portalMediaRoute, /Cache-Control.*no-store/);
  assert.match(portalRepository, /url: `\/api\/portal\/media\/\$\{media\.id\}`/);
  assert.match(portalClient, /onError=\{\(\) => setLoadFailed\(true\)\}/);
  assert.match(portalClient, /Загрузить ещё раз/);
});

test("неизвестный адрес отделения не подменяется первым доступным", () => {
  assert.match(portalClient, /isUnavailableAddress/);
  assert.match(portalClient, /Страница отделения недоступна/);
  assert.match(portalClient, /Выберите доступное отделение/);
});

test("URL-код отделения сохраняется для QR-кодов", () => {
  assert.match(adminPage, /Постоянный адрес для QR-кодов/);
  const updateAction = actions.slice(actions.indexOf("export async function updateDepartmentIdentityAction"), actions.indexOf("export async function toggleDepartmentPublicationAction"));
  assert.doesNotMatch(updateAction, /slug: parsed\.data\.slug/);
  assert.match(updateAction, /data: \{ name: parsed\.data\.name \}/);
});
