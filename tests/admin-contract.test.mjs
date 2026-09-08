import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const adminPage = read("src/app/admin/page.tsx");
const actions = read("src/features/admin/server/actions.ts");
const bootstrap = read("src/features/admin/server/bootstrap-content.ts");
const seed = read("scripts/seed-content.mjs");
const portalRepository = read("src/features/portal/server/repository.ts");

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

test("портал читает только опубликованные записи", () => {
  assert.match(portalRepository, /where: \{ status: PublicationStatus\.PUBLISHED \}/);
});

test("публикация отделения не требует контент или профиль заведующего", () => {
  const readiness = actions.slice(actions.indexOf("async function publicationReadiness"), actions.indexOf("async function scenarioPublicationReadiness"));
  assert.doesNotMatch(readiness, /intro|reference|head|краткое описание|справку об отделении|профиль и фотографию заведующего/);
});
