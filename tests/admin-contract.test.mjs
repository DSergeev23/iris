import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { departmentSlugBase, uniqueDepartmentSlug } from "../src/features/admin/server/department-slug.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const adminPage = read("src/app/admin/page.tsx");
const globalStyles = read("src/app/globals.css");
const actions = read("src/features/admin/server/actions.ts");
const bootstrap = read("src/features/admin/server/bootstrap-content.ts");
const seed = read("scripts/seed-content.mjs");
const portalRepository = read("src/features/portal/server/repository.ts");
const portalClient = read("src/features/portal/components/portal-client.tsx");
const scenarioSchema = read("prisma/schema.prisma");
const emergencyMigration = read("prisma/migrations/20260925090000_configure_emergency_details/migration.sql");
const portalPage = read("src/app/portal/page.tsx");
const portalMediaRoute = read("src/app/api/portal/media/[mediaId]/route.ts");
const portalHeadPhotoRoute = read("src/app/api/portal/head-photo/[departmentId]/route.ts");
const stageTerminologyMigration = read("prisma/migrations/20260923084500_rename_admin_steps_to_stages/migration.sql");
const scenarioActionFields = read("src/features/admin/components/scenario-action-fields.tsx");
const formButtons = read("src/features/admin/components/form-buttons.tsx");
const adminActionDialog = read("src/features/admin/components/admin-action-dialog.tsx");
const adminFormGuard = read("src/features/admin/components/admin-form-guard.tsx");
const adminToast = read("src/features/admin/components/admin-toast.tsx");
const scenarioReadiness = read("src/features/admin/server/scenario-readiness.ts");
const adminPermissions = read("src/features/admin/server/permissions.ts");

test("смена отделения перемонтирует редактор и не оставляет defaultValue предыдущего", () => {
  assert.match(adminPage, /<div key=\{selected\.id\} className="selected-department-editor">/);
});

test("каждый редактор включает сохранение только после изменений и подтверждает успешную запись", () => {
  assert.equal((adminPage.match(/<SubmitButton[^>]*trackChanges savedEvent=/g) ?? []).length, 8);
  assert.match(actions, /params\.set\("saved", savedKey\)/);
  assert.match(actions, /params\.set\("saveEvent", toastEvent\)/);
  assert.match(formButtons, /disabled=\{pending \|\| \(trackChanges && !dirty\)\}/);
  assert.match(formButtons, /showSaved && !dirty && <span className="form-saved" role="status">Изменения сохранены/);
});

test("кнопка срочного блока и её содержимое редактируются в сценарии и выводятся на портале", () => {
  for (const field of ["emergencyButtonLabel", "emergencyDetailTitle", "emergencyDetailBody"]) {
    assert.match(adminPage, new RegExp(`name="${field}"`));
    assert.match(actions, new RegExp(`${field}: z\\.string\\(\\)`));
    assert.match(scenarioSchema, new RegExp(field));
    assert.match(portalRepository, new RegExp(`item\\.scenario\\.${field}`));
    assert.match(portalClient, new RegExp(`scenario\\?\\.${field}`));
  }
  assert.match(emergencyMigration, /UPDATE "scenarios"/);
  assert.doesNotMatch(portalClient, /Список адаптирован под отделение/);
});

test("этап показывает действие, соответствующее состоянию раскрытия", () => {
  assert.match(adminPage, /className="details-closed-label">Открыть/);
  assert.match(adminPage, /className="details-open-label">Закрыть/);
  assert.match(globalStyles, /details\[open\] > summary \.details-closed-label \{ display:none; \}/);
  assert.match(globalStyles, /details\[open\] > summary \.details-open-label \{ display:inline; \}/);
});

test("после добавления или сохранения кнопки открыт только редактируемый этап", () => {
  assert.match(actions, /params\.set\("openStep", openStepId\)/);
  assert.match(actions, /Кнопка сценария добавлена\."[,\s]+"scenario", undefined, sourceStep\.id/);
  assert.match(actions, /Кнопка сценария сохранена\."[,\s]+"scenario", `action:\$\{parsed\.data\.actionId\}`, sourceStep\.id/);
  assert.match(adminPage, /const openStepId = selected\?\.scenario\?\.steps\.find/);
  assert.match(adminPage, /<details id=\{`scenario-step-\$\{step\.id\}`\} className="scenario-step" name="scenario-step" key=\{step\.id\} open=\{step\.id === openStepId\}/);
  assert.match(actions, /#\$\{openStepId \? `scenario-step-\$\{openStepId\}` : anchor\}/);
});

test("боковая колонка всегда показывает, какое отделение настраивается", () => {
  assert.match(adminPage, /Сейчас настраивается/);
  assert.match(adminPage, /selected\?\.name \?\? "Отделение не выбрано"/);
  assert.match(adminPage, /Все формы на странице относятся к этому отделению/);
  assert.match(adminPage, /href="#departments">Сменить отделение/);
  assert.match(globalStyles, /\.current-department-panel/);
});

test("обязательные поля показывают спокойную подсказку и ошибку только после взаимодействия", () => {
  assert.match(globalStyles, /label:has\(:required:invalid\)::after/);
  assert.match(globalStyles, /label:has\(:required:user-invalid\)::after/);
  assert.match(globalStyles, /:required:user-invalid/);
  assert.doesNotMatch(globalStyles, /label:has\(:required\)::after/);
});

test("удаление допускает черновики и архив, но защищает опубликованные записи", () => {
  for (const name of ["deleteDepartmentReferenceAction", "deleteDepartmentFactAction", "deleteDepartmentHeadAction"]) {
    const start = actions.indexOf(`export async function ${name}`);
    const end = actions.indexOf("\nexport async function", start + 1);
    const body = actions.slice(start, end < 0 ? undefined : end);
    assert.match(body, /requireDeletableDepartment\(tx,/);
  }
  for (const name of ["deleteScenarioStepAction", "deleteScenarioButtonAction"]) {
    const start = actions.indexOf(`export async function ${name}`);
    const end = actions.indexOf("\nexport async function", start + 1);
    assert.match(actions.slice(start, end < 0 ? undefined : end), /requireDeletableScenario\(tx,/);
  }
  assert.match(actions, /department\?\.status !== PublicationStatus\.DRAFT && department\?\.status !== PublicationStatus\.ARCHIVED/);
  assert.match(actions, /scenario\.status !== PublicationStatus\.DRAFT/);
  assert.match(actions, /current\.status !== PublicationStatus\.ARCHIVED/);
  assert.match(actions, /status: current\.status/);
  assert.match(actions, /scenarioAction\.deleteMany\(\{ where: \{ targetStepId: step\.id \} \}\)/);
  assert.match(actions, /scenarioAction\.deleteMany\(\{ where: \{ targetMediaId: mediaId\.data \} \}\)/);
  assert.match(actions, /status: PublicationStatus\.PUBLISHED \}, data: \{ status: PublicationStatus\.DRAFT \}/);
  assert.match(actions, /scenarioPublicationReadiness\(scenario\.id, tx\)/);
  assert.match(adminPage, /selected\.status !== PublicationStatus\.PUBLISHED && selected\.reference && <details className="danger-menu"/);
  assert.match(adminPage, /selected\.status !== PublicationStatus\.PUBLISHED && selected\.head && <details className="danger-menu"/);
  assert.match(adminPage, /selected\.scenario\.status === PublicationStatus\.ARCHIVED \|\| \(selected\.scenario\.status === PublicationStatus\.DRAFT/);
  assert.match(adminPage, /item\.status === PublicationStatus\.ARCHIVED \|\| \(item\.status === PublicationStatus\.DRAFT/);
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

test("публикация следует иерархии отделение — материалы — сценарий", () => {
  const departmentAction = actions.slice(actions.indexOf("export async function toggleDepartmentPublicationAction"), actions.indexOf("export async function archiveDepartmentAction"));
  const scenarioAction = actions.slice(actions.indexOf("export async function toggleScenarioPublicationAction"), actions.indexOf("export async function archiveScenarioAction"));
  const mediaAction = actions.slice(actions.indexOf("export async function toggleMediaPublicationAction"), actions.indexOf("export async function archiveMediaItemAction"));
  assert.doesNotMatch(departmentAction, /scenarioPublicationReadiness|опубликованный сценарий/);
  assert.match(departmentAction, /tx\.scenario\.updateMany\(\{ where: \{ departmentId, status: PublicationStatus\.PUBLISHED \}, data: \{ status: PublicationStatus\.DRAFT \} \}\)/);
  assert.match(departmentAction, /tx\.mediaItem\.updateMany\(\{ where: \{ departmentId, status: PublicationStatus\.PUBLISHED \}, data: \{ status: PublicationStatus\.DRAFT \} \}\)/);
  assert.match(departmentAction, /demotedScenarios: demotedScenarios\.count, demotedMedia: demotedMedia\.count/);
  assert.match(scenarioAction, /current\.department\.status !== PublicationStatus\.PUBLISHED/);
  assert.match(mediaAction, /current\.department\.status !== PublicationStatus\.PUBLISHED/);
  assert.match(mediaAction, /isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(scenarioAction, /Сначала опубликуйте отделение/);
  assert.match(mediaAction, /Сначала опубликуйте отделение/);
  assert.match(formButtons, /<AdminToast message=\{blockedToast\} tone="error"/);
  assert.match(adminToast, /window\.setTimeout/);
  assert.match(adminToast, /aria-live=\{tone === "error" \? "assertive" : "polite"\}/);
  assert.match(adminPage, /<AdminToast key=\{params\.toastEvent \?\? params\.notice\} message=\{params\.notice\} tone="success" \/>/);
  assert.match(adminToast, /30000/);
  assert.match(adminToast, /aria-label="Закрыть уведомление"/);
  assert.match(actions, /params\.set\("toastEvent", toastEvent\)/);
  assert.match(actions, /Отделение опубликовано\. Теперь опубликуйте нужные материалы, затем сценарий\./);
  assert.match(actions, /Материал опубликован\. Теперь его можно использовать в сценарии\./);
  assert.match(actions, /Сценарий опубликован и доступен пациентам выбранного отделения\./);
  assert.match(adminPage, /После этого можно опубликовать сценарий/);
  assert.match(adminPage, /После этого можно опубликовать материал/);
  assert.match(adminPage, /Сначала опубликуйте отделение/);
});

test("подтверждения действий открываются внутри админки", () => {
  const confirmationSources = [formButtons, adminFormGuard].join("\n");
  assert.doesNotMatch(confirmationSources, /window\.(confirm|alert)/);
  assert.match(formButtons, /form\?\.requestSubmit\(buttonRef\.current\)/);
  assert.match(formButtons, /Опубликовать раздел\?/);
  assert.match(formButtons, /Переместить в архив\?/);
  assert.match(formButtons, /Удалить без возможности восстановления\?/);
  assert.match(formButtons, /Действие пока недоступно/);
  assert.match(adminFormGuard, /Перейти без сохранения\?/);
  assert.match(adminActionDialog, /dialog\.showModal\(\)/);
  assert.match(adminActionDialog, /onCancel=/);
  assert.match(adminActionDialog, /event\.target === event\.currentTarget/);
});

test("публикация сценария проверяет достижимость всех этапов от стартового", () => {
  assert.match(scenarioReadiness, /orderBy: \{ sortOrder: "asc" \}/);
  assert.match(scenarioReadiness, /const reachableStepIds = new Set\(\[scenario\.steps\[0\]\.id\]\)/);
  assert.match(scenarioReadiness, /action\.kind !== ScenarioActionKind\.STEP/);
  assert.match(scenarioReadiness, /свяжите со стартовым этапом/);
  assert.match(adminPage, /Стартовый этап/);
});

test("админка везде называет части сценария этапами", () => {
  const adminCopy = [adminPage, actions, scenarioActionFields, scenarioReadiness, adminPermissions, bootstrap, seed].join("\n");
  assert.doesNotMatch(adminCopy, /[Шш]аг/);
  assert.match(adminPage, /Этапы и кнопки/);
  assert.match(scenarioActionFields, /Следующий этап/);
  assert.match(stageTerminologyMigration, /UPDATE "scenarios" SET "title" = 'Провести по этапам'/);
  assert.match(stageTerminologyMigration, /WHERE "title" = 'Провести по шагам'/);
});

test("пустой выбор назначения кнопки объясняет, что нужно создать", () => {
  assert.match(scenarioActionFields, /!nextSteps\.length && <span className="field-hint">Других этапов пока нет\. Сначала создайте ещё один этап сценария\.<\/span>/);
  assert.match(scenarioActionFields, /!media\.length && <span className="field-hint">Сначала добавьте и опубликуйте материал/);
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
  assert.doesNotMatch(portalClient, /Провести по этапам/);
});

test("редактор справки не изменяет описание первого экрана", () => {
  assert.doesNotMatch(adminPage, /Короткое описание для первого экрана|name="intro"/);
  const updateContent = actions.slice(actions.indexOf("export async function updateDepartmentContentAction"), actions.indexOf("export async function deleteDepartmentReferenceAction"));
  assert.doesNotMatch(updateContent, /intro/);
  assert.match(portalClient, /department\.intro && <p>\{department\.intro\}<\/p>/);
  assert.doesNotMatch(portalClient, /Сканируйте QR-код, выбирайте свой этап/);
});

test("медиа получают свежую ссылку только для опубликованного материала", () => {
  assert.match(portalMediaRoute, /status: PublicationStatus\.PUBLISHED, department: \{ status: PublicationStatus\.PUBLISHED \}/);
  assert.match(portalMediaRoute, /new GetObjectCommand/);
  assert.match(portalMediaRoute, /Range: range/);
  assert.match(portalMediaRoute, /Content-Range/);
  assert.match(portalMediaRoute, /object\.ContentRange \? 206 : 200/);
  assert.match(portalMediaRoute, /Cache-Control.*no-store/);
  assert.match(portalRepository, /url: `\/api\/portal\/media\/\$\{media\.id\}`/);
  assert.match(portalClient, /onError=\{\(\) => setLoadFailed\(true\)\}/);
  assert.match(portalClient, /Загрузить ещё раз/);
});

test("неизвестный адрес отделения не подменяется первым доступным", () => {
  assert.match(portalClient, /isUnavailableAddress/);
  assert.match(portalClient, /Раздел не найден/);
  assert.match(portalClient, /В начало портала/);
  assert.match(portalClient, /Выберите доступное отделение/);
});

test("неопубликованное отделение и ошибка загрузки не показывают технические детали", () => {
  assert.match(portalRepository, /getPortalAddressStatus/);
  assert.match(portalClient, /Раздел временно недоступен/);
  assert.match(portalPage, /logFailure\("portal_content_load_failed"/);
  assert.match(portalMediaRoute, /logFailure\("portal_media_load_failed"/);
  assert.match(portalMediaRoute, /text\/html/);
  assert.match(portalMediaRoute, /Материал временно недоступен/);
  assert.match(portalHeadPhotoRoute, /department: \{ status: PublicationStatus\.PUBLISHED \}/);
  assert.match(portalHeadPhotoRoute, /logFailure\("portal_head_photo_load_failed"/);
});

test("отсутствующие профиль, сценарий и PDF не дают пустых действий", () => {
  assert.match(portalClient, /hasHead && <article/);
  assert.match(portalClient, /department\.scenario && <ActionButton/);
  assert.match(portalClient, /item\?\.kind === "DOCUMENT"/);
});

test("URL-код отделения сохраняется для QR-кодов", () => {
  assert.match(adminPage, /Постоянный адрес для QR-кодов/);
  const updateAction = actions.slice(actions.indexOf("export async function updateDepartmentIdentityAction"), actions.indexOf("export async function toggleDepartmentPublicationAction"));
  assert.doesNotMatch(updateAction, /slug: parsed\.data\.slug/);
  assert.match(updateAction, /data: \{ name: parsed\.data\.name \}/);
});

test("URL-код нового отделения создаётся автоматически и остаётся уникальным", () => {
  assert.doesNotMatch(adminPage, /<input name="slug"/);
  assert.match(adminPage, /Адрес страницы создастся автоматически/);
  assert.equal(departmentSlugBase("Травматология и ортопедия"), "travmatologiya-i-ortopediya");
  assert.equal(departmentSlugBase("Отделение № 2"), "otdelenie-2");
  assert.equal(uniqueDepartmentSlug("Кардиология", ["kardiologiya", "kardiologiya-2"]), "kardiologiya-3");
  assert.equal(departmentSlugBase("***"), "department");
  const createAction = actions.slice(actions.indexOf("export async function createDepartmentAction"), actions.indexOf("export async function deleteDepartmentAction"));
  assert.match(createAction, /const admin = await requireAdmin\(\)/);
  assert.match(createAction, /uniqueDepartmentSlug\(parsed\.data\.name/);
  assert.match(createAction, /await tx\.auditLog\.create/);
  assert.match(createAction, /isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable/);
});
