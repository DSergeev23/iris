import Link from "next/link";
import { PublicationStatus } from "@prisma/client";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  DatabaseZap,
  FileText,
  LogOut,
  Plus,
  Save,
  UserRound,
  Workflow,
} from "lucide-react";
import { AdminFormGuard } from "@/features/admin/components/admin-form-guard";
import { AdminToast } from "@/features/admin/components/admin-toast";
import { CancelButton, ConfirmArchiveButton, ConfirmDeleteButton, ConfirmPublicationButton, SubmitButton } from "@/features/admin/components/form-buttons";
import { FileUpload } from "@/features/admin/components/file-upload";
import { ScenarioActionFields } from "@/features/admin/components/scenario-action-fields";
import {
  addScenarioActionAction,
  addScenarioStepAction,
  archiveDepartmentAction,
  archiveMediaItemAction,
  archiveScenarioAction,
  bootstrapInitialContentAction,
  createDepartmentAction,
  createScenarioAction,
  deleteDepartmentFactAction,
  deleteDepartmentHeadAction,
  deleteDepartmentReferenceAction,
  deleteDepartmentAction,
  deleteMediaItemAction,
  deleteScenarioAction,
  deleteScenarioButtonAction,
  deleteScenarioStepAction,
  moveDepartmentAction,
  moveScenarioButtonAction,
  moveScenarioStepAction,
  saveDepartmentFactAction,
  toggleDepartmentPublicationAction,
  toggleMediaPublicationAction,
  toggleScenarioPublicationAction,
  updateDepartmentContentAction,
  updateDepartmentHeadAction,
  updateDepartmentIdentityAction,
  updateMediaItemAction,
  updateScenarioAction,
  updateScenarioButtonAction,
  updateScenarioStepAction,
} from "@/features/admin/server/actions";
import { logoutAction } from "@/features/auth/server/actions";
import { requireAdmin } from "@/features/auth/server/session";
import { scenarioPublicationReadiness } from "@/features/admin/server/scenario-readiness";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type SearchParams = { department?: string; notice?: string; error?: string; saved?: string; saveEvent?: string; toastEvent?: string; openStep?: string };

export default async function AdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdmin();
  const departments = await db.department.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      head: true,
      reference: true,
      facts: { orderBy: { sortOrder: "asc" } },
      scenario: { include: { steps: { orderBy: { sortOrder: "asc" }, include: { actions: { orderBy: { sortOrder: "asc" } } } } } },
      media: { orderBy: { sortOrder: "asc" } },
    },
  });
  const params = await searchParams;
  const savedEvent = (key: string) => params.saved === key ? params.saveEvent : undefined;
  const selected = departments.find((item) => item.id === params.department) ?? departments[0];
  const openStepId = selected?.scenario?.steps.find((step) => step.id === params.openStep)?.id ?? selected?.scenario?.steps[0]?.id;
  const missingStarterDepartments = ["trauma", "neuro", "therapy"].filter((slug) => !departments.some((item) => item.slug === slug));
  const scenarioActions = selected?.scenario?.steps.flatMap((step) => step.actions) ?? [];
  const stepOptions = selected?.scenario?.steps.map((step) => ({ id: step.id, title: step.title })) ?? [];
  const mediaOptions = selected?.media.filter((item) => item.status === PublicationStatus.PUBLISHED).map((item) => ({ id: item.id, title: item.title })) ?? [];
  const scenarioIssue = selected?.scenario?.status === PublicationStatus.DRAFT
    ? selected.status !== PublicationStatus.PUBLISHED
      ? "сначала опубликуйте отделение"
      : await scenarioPublicationReadiness(selected.scenario.id, db)
    : null;

  return <main className="admin-body"><AdminFormGuard /><div className="admin-shell">
    <aside className="admin-nav">
      <a className="brand" href="/admin"><span className="brand-mark">+</span><span>ИРИС</span></a>
      <a href="#departments"><Building2 size={18} />Отделения</a>
      <a href="#content"><FileText size={18} />Контент отделения</a>
      <a href="#scenario"><Workflow size={18} />Сценарий</a>
      <a href="#media"><FileText size={18} />Медиа</a>
      <a href="#head"><UserRound size={18} />Заведующий</a>
      <form action={logoutAction}><button type="submit"><LogOut size={18} />Выйти</button></form>
    </aside>

    <section className="admin-main">
      <header className="admin-top">
        <div><p className="eyebrow">Администратор: {admin.displayName}</p><h1>Управление порталом</h1><p>Сначала выберите отделение, затем заполните нужный раздел. Все изменения сохраняются отдельно.</p></div>
        <span className="capacity"><strong>{departments.length}</strong><span>из 20 отделений</span></span>
      </header>

      {params.notice && <AdminToast key={params.toastEvent ?? params.notice} message={params.notice} tone="success" />}
      {params.error && <AdminToast key={params.toastEvent ?? params.error} message={params.error} tone="error" />}

      <div className="admin-grid"><div className="admin-content">
        <section id="departments" className="admin-section">
          <div className="section-heading"><div><p className="section-kicker">Этап 1 · Структура портала</p><h2>Отделения</h2></div><span className="section-note">На портале видны только опубликованные</span></div>
          <p className="section-description">Создавайте отделения, меняйте их порядок и выбирайте то, с которым будете работать дальше.</p>
          {!!missingStarterDepartments.length && <div className="bootstrap-panel">
            <div className="bootstrap-icon"><DatabaseZap size={25} /></div>
            <div><h3>Добавить стартовые отделения</h3><p>Добавит недостающие отделения вместе со справками и сценариями: {missingStarterDepartments.length}. Тестовые данные останутся без изменений.</p></div>
            <form action={bootstrapInitialContentAction}><SubmitButton pendingLabel="Создаём данные..." className="button-icon-text"><DatabaseZap size={18} />Добавить недостающие</SubmitButton></form>
          </div>}
          <div className="department-manager">
            <div className="department-list">
              {departments.map((item, index) => <div className={`department-row ${selected?.id === item.id ? "selected" : ""}`} key={item.id}>
                <Link href={`/admin?department=${item.id}#departments`}><span>{item.name}</span><small>{item.slug}</small></Link>
                <span className={`status ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
                <div className="row-actions" aria-label={`Порядок: ${item.name}`}>
                  <form action={moveDepartmentAction}><input type="hidden" name="departmentId" value={item.id} /><input type="hidden" name="direction" value="up" /><button className="icon-button" title="Поднять выше" disabled={index === 0}><ArrowUp size={17} /></button></form>
                  <form action={moveDepartmentAction}><input type="hidden" name="departmentId" value={item.id} /><input type="hidden" name="direction" value="down" /><button className="icon-button" title="Опустить ниже" disabled={index === departments.length - 1}><ArrowDown size={17} /></button></form>
                </div>
              </div>)}
              {!departments.length && <div className="empty-state"><Building2 size={28} /><strong>Отделений пока нет</strong><span>Создайте первое отделение справа.</span></div>}
            </div>
            <form action={createDepartmentAction} className="create-department">
              <h3><Plus size={19} />Новое отделение</h3><p>Название увидят пациенты. Адрес страницы создастся автоматически.</p>
              <label>Название<input name="name" placeholder="Например, Кардиология" required /></label>
              <div className="form-actions"><SubmitButton pendingLabel="Добавляем..." className="button-icon-text"><Plus size={18} />Создать отделение</SubmitButton><CancelButton label="Очистить" /></div>
            </form>
          </div>
        </section>

        {selected ? <div key={selected.id} className="selected-department-editor">
          <section className="admin-section department-overview">
            <div className="section-heading"><div><p className="section-kicker">Выбрано отделение</p><h2>{selected.name}</h2></div><span className={`status large ${statusClass(selected.status)}`}>{statusLabel(selected.status)}</span></div>
            <p className="section-description">Основные данные отделения. Поля со звёздочкой обязательны для сохранения.</p>
            {selected.status === PublicationStatus.PUBLISHED && <p className="section-description">Чтобы удалить отделение, сначала переместите его в архив.</p>}
            <div className="split-form">
              <form action={updateDepartmentIdentityAction}>
                <input type="hidden" name="departmentId" value={selected.id} />
                <div className="field-row"><label>Название<input name="name" defaultValue={selected.name} required /></label><label>URL-код<input value={selected.slug} readOnly aria-describedby="slug-hint" /><span id="slug-hint" className="field-hint">Постоянный адрес для QR-кодов</span></label></div>
                <div className="form-actions"><SubmitButton className="button-icon-text" trackChanges savedEvent={savedEvent("identity")}><Save size={18} />Сохранить данные</SubmitButton><CancelButton /></div>
              </form>
              {selected.status !== PublicationStatus.ARCHIVED && <form action={toggleDepartmentPublicationAction} className="publication-control">
                <input type="hidden" name="departmentId" value={selected.id} />
                <input type="hidden" name="status" value={selected.status === PublicationStatus.PUBLISHED ? PublicationStatus.DRAFT : PublicationStatus.PUBLISHED} />
                <h3>Публикация</h3><p>{selected.status === PublicationStatus.PUBLISHED ? "Отделение доступно пациентам. При скрытии его сценарий и материалы станут черновиками." : "Опубликуйте отделение первым, затем материалы и сценарий."}</p>
                <ConfirmPublicationButton label={`Отделение ${selected.name}`} publish={selected.status !== PublicationStatus.PUBLISHED} warning={selected.status === PublicationStatus.PUBLISHED ? "Сценарий и материалы этого отделения станут черновиками." : "Сценарий и материалы останутся черновиками — опубликуйте их после отделения."} />
              </form>}
              <form action={archiveDepartmentAction} className="publication-control archive-control"><input type="hidden" name="departmentId" value={selected.id} /><h3>{selected.status === PublicationStatus.ARCHIVED ? "Восстановление" : "Архив"}</h3><p>{selected.status === PublicationStatus.ARCHIVED ? "Восстановит отделение как черновик." : "Скроет отделение, сценарий и материалы, сохранив все записи."}</p><ConfirmArchiveButton label={selected.name} restore={selected.status === PublicationStatus.ARCHIVED} /></form>
              {selected.status !== PublicationStatus.PUBLISHED && <details className="danger-menu"><summary>Удаление отделения</summary><p>Удалит отделение со всем содержимым и файлами, независимо от статуса материалов и сценария.</p><form action={deleteDepartmentAction}><input type="hidden" name="departmentId" value={selected.id} /><ConfirmDeleteButton label={`отделение ${selected.name}`} description="Все связанные данные и файлы будут удалены." /></form></details>}
            </div>
          </section>

          <section id="content" className="admin-section">
            <div className="section-heading"><div><p className="section-kicker">Этап 2 · Справка отделения</p><h2>Контент отделения</h2></div><span className={`status ${statusClass(selected.status)}`}>{statusLabel(selected.status)}</span></div>
            <p className="section-description">Тексты этого раздела увидят пациенты выбранного отделения. Сохранённые изменения сразу попадут на портал, если отделение опубликовано.</p>
            <form action={updateDepartmentContentAction}>
              <input type="hidden" name="departmentId" value={selected.id} />
              <label>Заголовок справки<input name="referenceTitle" defaultValue={selected.reference?.title ?? "Об отделении"} required /></label>
              <label>Текст об отделении<textarea className="textarea-large" name="referenceDescription" defaultValue={selected.reference?.description ?? ""} maxLength={8000} required /></label>
              <div className="form-actions"><SubmitButton className="button-icon-text" trackChanges savedEvent={savedEvent("content")}><Save size={18} />Сохранить справку</SubmitButton><CancelButton /></div>
            </form>
            {selected.status !== PublicationStatus.PUBLISHED && selected.reference && <details className="danger-menu"><summary>Удаление справки</summary><p>Удалит заголовок и текст справки.</p><form action={deleteDepartmentReferenceAction}><input type="hidden" name="departmentId" value={selected.id} /><ConfirmDeleteButton label={`справку ${selected.reference.title}`} description="Справку можно заполнить заново." /></form></details>}

            <div className="subsection-heading"><div><h3>Короткая справочная информация</h3><p>Например, время обхода, расположение поста или телефон.</p></div></div>
            <div className="editor-list">
              {selected.facts.map((fact) => <details className="editor-item" key={fact.id} open={params.saved === `fact:${fact.id}`}>
                <summary><span><strong>{fact.title}</strong><small>{fact.body}</small></span><span className="edit-label">Редактировать</span></summary>
                <div className="editor-body">
                  <form action={saveDepartmentFactAction}>
                    <input type="hidden" name="departmentId" value={selected.id} /><input type="hidden" name="factId" value={fact.id} />
                    <div className="field-row"><label>Иконка<select name="iconKey" defaultValue={fact.iconKey}><FactIconOptions /></select></label><label>Заголовок<input name="title" defaultValue={fact.title} required /></label></div>
                    <label>Текст<input name="body" defaultValue={fact.body} required /></label>
                    <div className="form-actions"><SubmitButton className="button-icon-text" trackChanges savedEvent={savedEvent(`fact:${fact.id}`)}><Save size={17} />Сохранить блок</SubmitButton><CancelButton /></div>
                  </form>
                  {selected.status !== PublicationStatus.PUBLISHED && <details className="danger-menu"><summary>Удаление блока</summary><form action={deleteDepartmentFactAction}><input type="hidden" name="departmentId" value={selected.id} /><input type="hidden" name="factId" value={fact.id} /><ConfirmDeleteButton label={fact.title} /></form></details>}
                </div>
              </details>)}
            </div>
            <details className="add-editor"><summary><Plus size={18} />Добавить справочный блок</summary><form action={saveDepartmentFactAction}>
              <input type="hidden" name="departmentId" value={selected.id} />
              <div className="field-row"><label>Иконка<select name="iconKey" defaultValue="info"><FactIconOptions /></select></label><label>Заголовок<input name="title" placeholder="Время обхода" required /></label></div>
              <label>Текст<input name="body" placeholder="Ежедневно с 09:00 до 11:00" required /></label>
              <div className="form-actions"><SubmitButton pendingLabel="Добавляем..."><Plus size={17} />Добавить блок</SubmitButton><CancelButton label="Очистить" /></div>
            </form></details>
          </section>

          <section id="scenario" className="admin-section">
            <div className="section-heading"><div><p className="section-kicker">Этап 3 · Маршрут пациента</p><h2>Сценарий «Провести по этапам»</h2></div>{selected.scenario && <span className={`status large ${statusClass(selected.scenario.status)}`}>{statusLabel(selected.scenario.status)}</span>}</div>
            <p className="section-description">Настройте путь пациента: сначала этап, затем варианты выбора и результат каждого варианта.</p>
            {scenarioIssue && <p className="inline-empty" role="status">Перед публикацией: {scenarioIssue}.</p>}
            {selected.scenario ? <>
              <div className="split-form">
                <form action={updateScenarioAction}>
                  <input type="hidden" name="scenarioId" value={selected.scenario.id} />
                  <label>Заголовок сценария<input name="title" defaultValue={selected.scenario.title} required /></label>
                  <label>Подсказка<textarea name="description" defaultValue={selected.scenario.description} /></label>
                  <label>Заголовок срочного блока<input name="emergencyTitle" defaultValue={selected.scenario.emergencyTitle} required /></label>
                  <label>Текст срочного блока<textarea name="emergencyBody" defaultValue={selected.scenario.emergencyBody} /></label>
                  <label>Надпись на кнопке срочного блока<input name="emergencyButtonLabel" defaultValue={selected.scenario.emergencyButtonLabel} maxLength={80} required /></label>
                  <label>Заголовок после нажатия<input name="emergencyDetailTitle" defaultValue={selected.scenario.emergencyDetailTitle} maxLength={180} required /></label>
                  <label>Текст после нажатия<textarea className="textarea-large" name="emergencyDetailBody" defaultValue={selected.scenario.emergencyDetailBody} maxLength={3000} required /></label>
                  <div className="form-actions"><SubmitButton className="button-icon-text" trackChanges savedEvent={savedEvent("scenario")}><Save size={18} />Сохранить сценарий</SubmitButton><CancelButton /></div>
                </form>
                {selected.scenario.status !== PublicationStatus.ARCHIVED && <form action={toggleScenarioPublicationAction} className="publication-control">
                  <input type="hidden" name="scenarioId" value={selected.scenario.id} />
                  <input type="hidden" name="status" value={selected.scenario.status === PublicationStatus.PUBLISHED ? PublicationStatus.DRAFT : PublicationStatus.PUBLISHED} />
                  <h3>Публикация</h3><p>{selected.scenario.status === PublicationStatus.PUBLISHED ? "Сценарий доступен пациентам." : selected.status !== PublicationStatus.PUBLISHED ? "Сначала опубликуйте отделение." : "Сценарий пока скрыт от пациентов."}</p>
                  <ConfirmPublicationButton label={`Сценарий ${selected.scenario.title}`} publish={selected.scenario.status !== PublicationStatus.PUBLISHED} blockedReason={selected.status !== PublicationStatus.PUBLISHED ? "Сначала опубликуйте отделение. После этого можно опубликовать сценарий." : undefined} />
                </form>}
                <form action={archiveScenarioAction} className="publication-control archive-control"><input type="hidden" name="scenarioId" value={selected.scenario.id} /><h3>{selected.scenario.status === PublicationStatus.ARCHIVED ? "Восстановление" : "Архив"}</h3><p>{selected.scenario.status === PublicationStatus.ARCHIVED ? "Восстановит сценарий как черновик." : "Сохранит сценарий, но скроет его от пациентов."}</p><ConfirmArchiveButton label={selected.scenario.title} restore={selected.scenario.status === PublicationStatus.ARCHIVED} /></form>
                {(selected.scenario.status === PublicationStatus.ARCHIVED || (selected.scenario.status === PublicationStatus.DRAFT && selected.status !== PublicationStatus.PUBLISHED)) && <details className="danger-menu"><summary>Удаление сценария</summary><p>Удалит сценарий со всеми этапами и кнопками. При необходимости его можно будет создать заново.</p><form action={deleteScenarioAction}><input type="hidden" name="scenarioId" value={selected.scenario.id} /><ConfirmDeleteButton label={`сценарий ${selected.scenario.title}`} description="Все этапы и кнопки будут удалены." /></form></details>}
              </div>

              <div className="subsection-heading"><div><h3>Этапы и кнопки</h3><p>Первый этап — стартовый; перед публикацией все остальные должны быть достижимы из него.</p></div></div>
              <div className="scenario-steps">
                {selected.scenario.steps.map((step, stepIndex) => <details id={`scenario-step-${step.id}`} className="scenario-step" name="scenario-step" key={step.id} open={step.id === openStepId}>
                  <summary><span className="step-number">{stepIndex + 1}</span><span><strong>{step.title}</strong><small>{stepIndex === 0 ? "Стартовый этап · " : ""}{step.actions.length} кнопок</small></span><span className="edit-label"><span className="details-closed-label">Открыть</span><span className="details-open-label">Закрыть</span></span></summary>
                  <div className="step-body">
                    <div className="item-toolbar">
                      <div className="row-actions">
                        <form action={moveScenarioStepAction}><input type="hidden" name="stepId" value={step.id} /><input type="hidden" name="direction" value="up" /><button className="icon-button" title="Поднять этап" disabled={stepIndex === 0}><ArrowUp size={17} /></button></form>
                        <form action={moveScenarioStepAction}><input type="hidden" name="stepId" value={step.id} /><input type="hidden" name="direction" value="down" /><button className="icon-button" title="Опустить этап" disabled={stepIndex === selected.scenario!.steps.length - 1}><ArrowDown size={17} /></button></form>
                      </div>
                      {(selected.scenario!.status === PublicationStatus.ARCHIVED || (selected.scenario!.status === PublicationStatus.DRAFT && selected.status !== PublicationStatus.PUBLISHED)) && <details className="danger-menu compact"><summary>Удаление этапа</summary><form action={deleteScenarioStepAction}><input type="hidden" name="stepId" value={step.id} /><ConfirmDeleteButton label={step.title} description={`Будут удалены кнопки этапа: ${step.actions.length}; кнопки перехода к нему: ${scenarioActions.filter((action) => action.targetStepId === step.id).length}. Проверьте маршрут перед публикацией.`} /></form></details>}
                    </div>
                    <form action={updateScenarioStepAction}>
                      <input type="hidden" name="scenarioId" value={selected.scenario!.id} /><input type="hidden" name="stepId" value={step.id} />
                      <label>Название этапа<input name="title" defaultValue={step.title} required /></label>
                      <label>Пояснение<textarea name="description" defaultValue={step.description} /></label>
                      <div className="form-actions"><SubmitButton className="button-icon-text" trackChanges savedEvent={savedEvent(`step:${step.id}`)}><Save size={17} />Сохранить этап</SubmitButton><CancelButton /></div>
                    </form>

                    <div className="scenario-actions">
                      <h4>Кнопки этого этапа</h4>
                      {step.actions.map((action, actionIndex) => <details className="scenario-action" key={action.id} open={params.saved === `action:${action.id}`}>
                        <summary><span><strong>{action.title}</strong><small>{actionKindLabel(action.kind)}</small></span><span className="edit-label">Настроить</span></summary>
                        <div className="action-editor">
                          <div className="item-toolbar">
                            <div className="row-actions">
                              <form action={moveScenarioButtonAction}><input type="hidden" name="actionId" value={action.id} /><input type="hidden" name="direction" value="up" /><button className="icon-button" title="Поднять кнопку" disabled={actionIndex === 0}><ArrowUp size={16} /></button></form>
                              <form action={moveScenarioButtonAction}><input type="hidden" name="actionId" value={action.id} /><input type="hidden" name="direction" value="down" /><button className="icon-button" title="Опустить кнопку" disabled={actionIndex === step.actions.length - 1}><ArrowDown size={16} /></button></form>
                            </div>
                            {(selected.scenario!.status === PublicationStatus.ARCHIVED || (selected.scenario!.status === PublicationStatus.DRAFT && selected.status !== PublicationStatus.PUBLISHED)) && <details className="danger-menu compact"><summary>Удаление кнопки</summary><form action={deleteScenarioButtonAction}><input type="hidden" name="actionId" value={action.id} /><ConfirmDeleteButton label={action.title} description="Проверьте маршрут перед публикацией." /></form></details>}
                          </div>
                          <form action={updateScenarioButtonAction}>
                            <input type="hidden" name="actionId" value={action.id} /><input type="hidden" name="stepId" value={step.id} />
                            <ScenarioActionFields steps={stepOptions} media={mediaOptions} currentStepId={step.id} defaults={action} />
                            <div className="form-actions"><SubmitButton className="button-icon-text" trackChanges savedEvent={savedEvent(`action:${action.id}`)}><Save size={17} />Сохранить вариант</SubmitButton><CancelButton /></div>
                          </form>
                        </div>
                      </details>)}
                      {!step.actions.length && <p className="inline-empty">Добавьте первую кнопку для этого этапа.</p>}
                      <details className="add-editor compact"><summary><Plus size={17} />Добавить кнопку</summary><form action={addScenarioActionAction}>
                        <input type="hidden" name="stepId" value={step.id} />
                        <ScenarioActionFields steps={stepOptions} media={mediaOptions} currentStepId={step.id} />
                        <div className="form-actions"><SubmitButton pendingLabel="Добавляем..."><Plus size={17} />Добавить вариант</SubmitButton><CancelButton label="Очистить" /></div>
                      </form></details>
                    </div>
                  </div>
                </details>)}
                {!selected.scenario.steps.length && <div className="empty-state"><Workflow size={28} /><strong>Этапов пока нет</strong><span>Добавьте первый вопрос для пациента.</span></div>}
              </div>
              <details className="add-editor"><summary><Plus size={18} />Добавить этап</summary><form action={addScenarioStepAction}>
                <input type="hidden" name="scenarioId" value={selected.scenario.id} />
                <label>Название этапа<input name="title" placeholder="Например, Что вас беспокоит?" required /></label>
                <label>Пояснение<textarea name="description" placeholder="Помогите пациенту сделать понятный выбор" /></label>
                <div className="form-actions"><SubmitButton pendingLabel="Добавляем..."><Plus size={17} />Добавить этап</SubmitButton><CancelButton label="Очистить" /></div>
              </form></details>
            </> : <div className="empty-state"><Workflow size={28} /><strong>Сценарий не создан</strong><span>{selected.status === PublicationStatus.ARCHIVED ? "Сначала восстановите отделение из архива." : "Создайте новый черновик сценария для отделения."}</span>{selected.status !== PublicationStatus.ARCHIVED && <form action={createScenarioAction}><input type="hidden" name="departmentId" value={selected.id} /><SubmitButton pendingLabel="Создаём...">Создать сценарий</SubmitButton></form>}</div>}
          </section>

          <section id="media" className="admin-section">
            <div className="section-heading"><div><p className="section-kicker">Этап 4 · Материалы отделения</p><h2>Медиа</h2></div><span className="section-note">{selected.media.length} материалов</span></div>
            <p className="section-description">Загрузите MP4, PDF, JPG, PNG или WebP. Затем откройте материал в списке ниже, проверьте настройки и опубликуйте его, чтобы он появился на портале.</p>
            <FileUpload departmentId={selected.id} purpose="MEDIA" />
            <div id="media-editors" className="editor-list media-editors">{selected.media.map((item) => <details className="editor-item" key={item.id} open={params.saved === `media:${item.id}`}>
              <summary><span><strong>{item.title}</strong><small>{item.kind === "VIDEO" ? "Видео" : item.kind === "DOCUMENT" ? "Памятка PDF" : "Изображение"}</small></span><span className={`status ${statusClass(item.status)}`}>{statusLabel(item.status)}</span><span className="edit-label">Настроить</span></summary>
              <div className="editor-body">
                <form action={updateMediaItemAction}><input type="hidden" name="mediaId" value={item.id} /><label>Название<input name="title" defaultValue={item.title} required /></label><label>Описание<textarea name="description" defaultValue={item.description} /></label><div className="form-actions"><SubmitButton className="button-icon-text" trackChanges savedEvent={savedEvent(`media:${item.id}`)}><Save size={17} />Сохранить материал</SubmitButton><CancelButton /></div></form>
                {item.status !== PublicationStatus.ARCHIVED && <form action={toggleMediaPublicationAction} className="publication-inline"><input type="hidden" name="mediaId" value={item.id} /><input type="hidden" name="status" value={item.status === PublicationStatus.PUBLISHED ? PublicationStatus.DRAFT : PublicationStatus.PUBLISHED} /><ConfirmPublicationButton label={`Материал ${item.title}`} publish={item.status !== PublicationStatus.PUBLISHED} blockedReason={selected.status !== PublicationStatus.PUBLISHED ? "Сначала опубликуйте отделение. После этого можно опубликовать материал." : undefined} /></form>}
                <form action={archiveMediaItemAction} className="publication-inline"><input type="hidden" name="mediaId" value={item.id} /><ConfirmArchiveButton label={item.title} restore={item.status === PublicationStatus.ARCHIVED} /></form>
                {(item.status === PublicationStatus.ARCHIVED || (item.status === PublicationStatus.DRAFT && selected.status !== PublicationStatus.PUBLISHED)) && <details className="danger-menu"><summary>Удаление материала</summary><p>Удалит материал, его файл и связанные кнопки сценария.</p><form action={deleteMediaItemAction}><input type="hidden" name="mediaId" value={item.id} /><ConfirmDeleteButton label={`материал ${item.title}`} description={`Файл и связанные кнопки (${scenarioActions.filter((action) => action.targetMediaId === item.id).length}) будут удалены. Если сценарий был опубликован, он станет черновиком; проверьте маршрут.`} /></form></details>}
              </div>
            </details>)}</div>
            {!selected.media.length && <div className="inline-empty">Загруженных материалов пока нет.</div>}
          </section>

          <section id="head" className="admin-section">
            <div className="section-heading"><div><p className="section-kicker">Этап 5 · Команда отделения</p><h2>Заведующий отделением</h2></div><span className={`status ${statusClass(selected.status)}`}>{selected.status === PublicationStatus.PUBLISHED ? "Видно пациентам" : statusLabel(selected.status)}</span></div>
            <p className="section-description">Укажите данные руководителя и загрузите фотографию. После сохранения изменения появятся на портале опубликованного отделения.</p>
            <form action={updateDepartmentHeadAction}>
              <input type="hidden" name="departmentId" value={selected.id} />
              <div className="field-row three"><label>Имя<input name="firstName" defaultValue={selected.head?.firstName ?? ""} required /></label><label>Фамилия<input name="lastName" defaultValue={selected.head?.lastName ?? ""} required /></label><label>Отчество<input name="middleName" defaultValue={selected.head?.middleName ?? ""} /></label></div>
              <label>Должность<input name="roleTitle" defaultValue={selected.head?.roleTitle ?? ""} placeholder="Заведующий отделением, врач-травматолог" required /></label>
              <label>Описание<textarea className="textarea-large" name="biography" defaultValue={selected.head?.biography ?? ""} /></label>
              <div className="form-actions"><SubmitButton className="button-icon-text" trackChanges savedEvent={savedEvent("head")}><Save size={18} />Сохранить профиль</SubmitButton><CancelButton /></div>
            </form>
            <div className="subsection-heading"><div><h3>Фотография</h3><p>{selected.head?.photoObjectKey ? "Фотография загружена и используется на портале." : "Добавьте портрет заведующего в JPG, PNG или WebP."}</p></div></div>
            <FileUpload departmentId={selected.id} purpose="HEAD_PHOTO" />
            {selected.status !== PublicationStatus.PUBLISHED && selected.head && <details className="danger-menu"><summary>Удаление профиля заведующего</summary><p>Удалит имя, должность, описание и фотографию.</p><form action={deleteDepartmentHeadAction}><input type="hidden" name="departmentId" value={selected.id} /><ConfirmDeleteButton label="профиль заведующего" description="Фотография также будет удалена из хранилища." /></form></details>}
          </section>
        </div> : <section className="admin-section"><div className="empty-state"><Building2 size={30} /><strong>Создайте первое отделение</strong><span>После этого появятся редакторы текстов, сценария и заведующего.</span></div></section>}
      </div>

      <aside className="admin-aside">
        <section className="current-department-panel" aria-labelledby="current-department-title">
          <div className="current-department-label"><Building2 size={20} aria-hidden="true" /><span>Сейчас настраивается</span></div>
          <h2 id="current-department-title">{selected?.name ?? "Отделение не выбрано"}</h2>
          {selected ? <>
            <span className={`status ${statusClass(selected.status)}`}>{statusLabel(selected.status)}</span>
            <p>Все формы на странице относятся к этому отделению.</p>
            <a href="#departments">Сменить отделение</a>
          </> : <p>Создайте первое отделение, чтобы начать настройку.</p>}
        </section>
        <section className="aside-panel"><h2>Порядок публикации</h2><p>Система проверит зависимости и подскажет, чего не хватает.</p><ul><li>Сначала опубликуйте отделение</li><li>Затем опубликуйте нужные материалы</li><li>После материалов опубликуйте сценарий</li></ul></section>
      </aside>
      </div>
    </section>
  </div></main>;
}

function FactIconOptions() {
  return <><option value="info">Информация</option><option value="clock">Время</option><option value="map-pin">Место</option><option value="phone">Телефон</option><option value="calendar">Расписание</option><option value="heart-pulse">Медицина</option></>;
}

function actionKindLabel(kind: string) {
  return { STEP: "Переход к этапу", MEDIA: "Видео или памятка", EMERGENCY: "Срочная помощь", INFORMATION: "Пояснение" }[kind] ?? kind;
}

function statusClass(status: PublicationStatus) {
  return status === PublicationStatus.PUBLISHED ? "published" : status === PublicationStatus.ARCHIVED ? "archived" : "draft";
}

function statusLabel(status: PublicationStatus) {
  return status === PublicationStatus.PUBLISHED ? "Опубликовано" : status === PublicationStatus.ARCHIVED ? "В архиве" : "Черновик";
}
