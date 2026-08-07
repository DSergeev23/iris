import Link from "next/link";
import { PublicationStatus } from "@prisma/client";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  DatabaseZap,
  Eye,
  ExternalLink,
  FileText,
  LogOut,
  Plus,
  Save,
  TriangleAlert,
  UserRound,
  Workflow,
} from "lucide-react";
import { ConfirmDeleteButton, SubmitButton } from "@/features/admin/components/form-buttons";
import { FileUpload } from "@/features/admin/components/file-upload";
import { ScenarioActionFields } from "@/features/admin/components/scenario-action-fields";
import {
  addScenarioActionAction,
  addScenarioStepAction,
  bootstrapInitialContentAction,
  createDepartmentAction,
  deleteDepartmentFactAction,
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
import { requireAdminViewer } from "@/features/auth/server/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type SearchParams = { department?: string; notice?: string; error?: string };

export default async function AdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { admin, isDemo } = await requireAdminViewer();
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
  const selected = departments.find((item) => item.id === params.department) ?? departments[0];
  const missingStarterDepartments = ["trauma", "neuro", "therapy"].filter((slug) => !departments.some((item) => item.slug === slug));
  const stepOptions = selected?.scenario?.steps.map((step) => ({ id: step.id, title: step.title })) ?? [];
  const mediaOptions = selected?.media.map((item) => ({ id: item.id, title: item.title })) ?? [];

  return <main className="admin-body"><div className="admin-shell">
    <aside className="admin-nav">
      <a className="brand" href="/admin"><span className="brand-mark">+</span><span>ИРИС</span></a>
      <a href="#departments" aria-current="page"><Building2 size={18} />Отделения</a>
      <a href="#content"><FileText size={18} />Тексты и справка</a>
      <a href="#scenario"><Workflow size={18} />Сценарий</a>
      <a href="#head"><UserRound size={18} />Заведующий</a>
      <a href="/portal" target="_blank"><ExternalLink size={18} />Открыть портал</a>
      {isDemo ? <span className="demo-nav-label"><Eye size={18} />Только просмотр</span> : <form action={logoutAction}><button type="submit"><LogOut size={18} />Выйти</button></form>}
    </aside>

    <section className="admin-main">
      <header className="admin-top">
        <div><p className="eyebrow">Администратор: {admin.displayName}</p><h1>Контент портала</h1><p>Выберите отделение и управляйте тем, что увидит пациент.</p></div>
        <span className="capacity"><strong>{departments.length}</strong><span>из 20 отделений</span></span>
      </header>

      {params.notice && <div className="feedback success" role="status"><CheckCircle2 size={21} />{params.notice}</div>}
      {params.error && <div className="feedback error" role="alert"><TriangleAlert size={21} />{params.error}</div>}

      {isDemo && <div className="demo-banner" role="status"><Eye size={22} /><div><strong>Демонстрационный режим</strong><span>Можно открыть разделы и посмотреть настройки. Изменение данных и загрузка файлов отключены.</span></div></div>}

      <fieldset className="admin-demo-lock" disabled={isDemo}><div className="admin-grid"><div className="admin-content">
        <section id="departments" className="admin-section">
          <div className="section-heading"><div><p className="section-kicker">Структура портала</p><h2>Отделения</h2></div><span className="section-note">На портале видны только опубликованные</span></div>
          {!!missingStarterDepartments.length && <div className="bootstrap-panel">
            <div className="bootstrap-icon"><DatabaseZap size={25} /></div>
            <div><h3>Добавить стартовые отделения</h3><p>Добавит недостающие отделения вместе со справками и сценариями: {missingStarterDepartments.length}. Тестовые данные останутся без изменений.</p></div>
            <form action={bootstrapInitialContentAction}><SubmitButton pendingLabel="Создаём данные..." className="button-icon-text"><DatabaseZap size={18} />Добавить недостающие</SubmitButton></form>
          </div>}
          <div className="department-manager">
            <div className="department-list">
              {departments.map((item, index) => <div className={`department-row ${selected?.id === item.id ? "selected" : ""}`} key={item.id}>
                <Link href={`/admin?department=${item.id}#departments`}><span>{item.name}</span><small>{item.slug}</small></Link>
                <span className={`status ${item.status === PublicationStatus.PUBLISHED ? "published" : "draft"}`}>{item.status === PublicationStatus.PUBLISHED ? "Опубликовано" : "Черновик"}</span>
                <div className="row-actions" aria-label={`Порядок: ${item.name}`}>
                  <form action={moveDepartmentAction}><input type="hidden" name="departmentId" value={item.id} /><input type="hidden" name="direction" value="up" /><button className="icon-button" title="Поднять выше" disabled={index === 0}><ArrowUp size={17} /></button></form>
                  <form action={moveDepartmentAction}><input type="hidden" name="departmentId" value={item.id} /><input type="hidden" name="direction" value="down" /><button className="icon-button" title="Опустить ниже" disabled={index === departments.length - 1}><ArrowDown size={17} /></button></form>
                </div>
              </div>)}
              {!departments.length && <div className="empty-state"><Building2 size={28} /><strong>Отделений пока нет</strong><span>Создайте первое отделение справа.</span></div>}
            </div>
            <form action={createDepartmentAction} className="create-department">
              <h3><Plus size={19} />Новое отделение</h3>
              <label>Название<input name="name" placeholder="Например, Кардиология" required /></label>
              <label>URL-код<input name="slug" placeholder="cardiology" required pattern="[a-z0-9-]+" /><span className="field-hint">Латинские буквы, цифры и дефис</span></label>
              <SubmitButton pendingLabel="Добавляем..." className="button-icon-text"><Plus size={18} />Добавить</SubmitButton>
            </form>
          </div>
        </section>

        {selected ? <>
          <section className="admin-section department-overview">
            <div className="section-heading"><div><p className="section-kicker">Выбрано отделение</p><h2>{selected.name}</h2></div><span className={`status large ${selected.status === PublicationStatus.PUBLISHED ? "published" : "draft"}`}>{selected.status === PublicationStatus.PUBLISHED ? "Опубликовано" : "Черновик"}</span></div>
            <div className="split-form">
              <form action={updateDepartmentIdentityAction}>
                <input type="hidden" name="departmentId" value={selected.id} />
                <div className="field-row"><label>Название<input name="name" defaultValue={selected.name} required /></label><label>URL-код<input name="slug" defaultValue={selected.slug} required pattern="[a-z0-9-]+" /></label></div>
                <SubmitButton className="button-icon-text"><Save size={18} />Сохранить название</SubmitButton>
              </form>
              <form action={toggleDepartmentPublicationAction} className="publication-control">
                <input type="hidden" name="departmentId" value={selected.id} />
                <input type="hidden" name="status" value={selected.status === PublicationStatus.PUBLISHED ? PublicationStatus.DRAFT : PublicationStatus.PUBLISHED} />
                <p>{selected.status === PublicationStatus.PUBLISHED ? "Отделение доступно пациентам." : "Отделение пока скрыто от пациентов."}</p>
                <SubmitButton className={selected.status === PublicationStatus.PUBLISHED ? "button-secondary" : undefined}>{selected.status === PublicationStatus.PUBLISHED ? "Скрыть с портала" : "Опубликовать отделение"}</SubmitButton>
              </form>
            </div>
          </section>

          <section id="content" className="admin-section">
            <div className="section-heading"><div><p className="section-kicker">Первый экран и справка</p><h2>Тексты отделения</h2></div></div>
            <form action={updateDepartmentContentAction}>
              <input type="hidden" name="departmentId" value={selected.id} />
              <label>Короткое описание для первого экрана<textarea name="intro" defaultValue={selected.intro} maxLength={2000} /></label>
              <label>Заголовок справки<input name="referenceTitle" defaultValue={selected.reference?.title ?? "Об отделении"} required /></label>
              <label>Текст об отделении<textarea className="textarea-large" name="referenceDescription" defaultValue={selected.reference?.description ?? ""} maxLength={8000} /></label>
              <SubmitButton className="button-icon-text"><Save size={18} />Сохранить тексты</SubmitButton>
            </form>

            <div className="subsection-heading"><div><h3>Короткая справочная информация</h3><p>Например, время обхода, расположение поста или телефон.</p></div></div>
            <div className="editor-list">
              {selected.facts.map((fact) => <details className="editor-item" key={fact.id}>
                <summary><span><strong>{fact.title}</strong><small>{fact.body}</small></span><span className="edit-label">Редактировать</span></summary>
                <div className="editor-body">
                  <form action={saveDepartmentFactAction}>
                    <input type="hidden" name="departmentId" value={selected.id} /><input type="hidden" name="factId" value={fact.id} />
                    <div className="field-row"><label>Иконка<select name="iconKey" defaultValue={fact.iconKey}><FactIconOptions /></select></label><label>Заголовок<input name="title" defaultValue={fact.title} required /></label></div>
                    <label>Текст<input name="body" defaultValue={fact.body} required /></label>
                    <SubmitButton className="button-icon-text"><Save size={17} />Сохранить блок</SubmitButton>
                  </form>
                  <form action={deleteDepartmentFactAction} className="delete-form"><input type="hidden" name="departmentId" value={selected.id} /><input type="hidden" name="factId" value={fact.id} /><ConfirmDeleteButton label={fact.title} /></form>
                </div>
              </details>)}
            </div>
            <details className="add-editor"><summary><Plus size={18} />Добавить справочный блок</summary><form action={saveDepartmentFactAction}>
              <input type="hidden" name="departmentId" value={selected.id} />
              <div className="field-row"><label>Иконка<select name="iconKey" defaultValue="info"><FactIconOptions /></select></label><label>Заголовок<input name="title" placeholder="Время обхода" required /></label></div>
              <label>Текст<input name="body" placeholder="Ежедневно с 09:00 до 11:00" required /></label>
              <SubmitButton pendingLabel="Добавляем..."><Plus size={17} />Добавить блок</SubmitButton>
            </form></details>
          </section>

          <section id="scenario" className="admin-section">
            <div className="section-heading"><div><p className="section-kicker">Маршрут пациента</p><h2>Сценарий «Провести по шагам»</h2></div>{selected.scenario && <span className={`status large ${selected.scenario.status === PublicationStatus.PUBLISHED ? "published" : "draft"}`}>{selected.scenario.status === PublicationStatus.PUBLISHED ? "Опубликован" : "Черновик"}</span>}</div>
            {selected.scenario ? <>
              <div className="split-form">
                <form action={updateScenarioAction}>
                  <input type="hidden" name="scenarioId" value={selected.scenario.id} />
                  <label>Заголовок сценария<input name="title" defaultValue={selected.scenario.title} required /></label>
                  <label>Подсказка<textarea name="description" defaultValue={selected.scenario.description} /></label>
                  <label>Заголовок срочного экрана<input name="emergencyTitle" defaultValue={selected.scenario.emergencyTitle} required /></label>
                  <label>Текст срочного экрана<textarea name="emergencyBody" defaultValue={selected.scenario.emergencyBody} /></label>
                  <SubmitButton className="button-icon-text"><Save size={18} />Сохранить сценарий</SubmitButton>
                </form>
                <form action={toggleScenarioPublicationAction} className="publication-control">
                  <input type="hidden" name="scenarioId" value={selected.scenario.id} />
                  <input type="hidden" name="status" value={selected.scenario.status === PublicationStatus.PUBLISHED ? PublicationStatus.DRAFT : PublicationStatus.PUBLISHED} />
                  <p>{selected.scenario.status === PublicationStatus.PUBLISHED ? "Сценарий доступен пациентам." : "Сценарий пока скрыт от пациентов."}</p>
                  <SubmitButton className={selected.scenario.status === PublicationStatus.PUBLISHED ? "button-secondary" : undefined}>{selected.scenario.status === PublicationStatus.PUBLISHED ? "Скрыть сценарий" : "Опубликовать сценарий"}</SubmitButton>
                </form>
              </div>

              <div className="subsection-heading"><div><h3>Шаги и кнопки</h3><p>Порядок сверху вниз соответствует пути пациента.</p></div></div>
              <div className="scenario-steps">
                {selected.scenario.steps.map((step, stepIndex) => <details className="scenario-step" key={step.id} open={stepIndex === 0}>
                  <summary><span className="step-number">{stepIndex + 1}</span><span><strong>{step.title}</strong><small>{step.actions.length} кнопок</small></span><span className="edit-label">Открыть</span></summary>
                  <div className="step-body">
                    <div className="item-toolbar">
                      <div className="row-actions">
                        <form action={moveScenarioStepAction}><input type="hidden" name="stepId" value={step.id} /><input type="hidden" name="direction" value="up" /><button className="icon-button" title="Поднять шаг" disabled={stepIndex === 0}><ArrowUp size={17} /></button></form>
                        <form action={moveScenarioStepAction}><input type="hidden" name="stepId" value={step.id} /><input type="hidden" name="direction" value="down" /><button className="icon-button" title="Опустить шаг" disabled={stepIndex === selected.scenario!.steps.length - 1}><ArrowDown size={17} /></button></form>
                      </div>
                      <form action={deleteScenarioStepAction}><input type="hidden" name="stepId" value={step.id} /><ConfirmDeleteButton label={step.title} /></form>
                    </div>
                    <form action={updateScenarioStepAction}>
                      <input type="hidden" name="scenarioId" value={selected.scenario!.id} /><input type="hidden" name="stepId" value={step.id} />
                      <label>Название шага<input name="title" defaultValue={step.title} required /></label>
                      <label>Пояснение<textarea name="description" defaultValue={step.description} /></label>
                      <SubmitButton className="button-icon-text"><Save size={17} />Сохранить шаг</SubmitButton>
                    </form>

                    <div className="scenario-actions">
                      <h4>Кнопки этого шага</h4>
                      {step.actions.map((action, actionIndex) => <details className="scenario-action" key={action.id}>
                        <summary><span><strong>{action.title}</strong><small>{actionKindLabel(action.kind)}</small></span><span className="edit-label">Настроить</span></summary>
                        <div className="action-editor">
                          <div className="item-toolbar">
                            <div className="row-actions">
                              <form action={moveScenarioButtonAction}><input type="hidden" name="actionId" value={action.id} /><input type="hidden" name="direction" value="up" /><button className="icon-button" title="Поднять кнопку" disabled={actionIndex === 0}><ArrowUp size={16} /></button></form>
                              <form action={moveScenarioButtonAction}><input type="hidden" name="actionId" value={action.id} /><input type="hidden" name="direction" value="down" /><button className="icon-button" title="Опустить кнопку" disabled={actionIndex === step.actions.length - 1}><ArrowDown size={16} /></button></form>
                            </div>
                            <form action={deleteScenarioButtonAction}><input type="hidden" name="actionId" value={action.id} /><ConfirmDeleteButton label={action.title} /></form>
                          </div>
                          <form action={updateScenarioButtonAction}>
                            <input type="hidden" name="actionId" value={action.id} /><input type="hidden" name="stepId" value={step.id} />
                            <ScenarioActionFields steps={stepOptions} media={mediaOptions} currentStepId={step.id} defaults={action} />
                            <SubmitButton className="button-icon-text"><Save size={17} />Сохранить кнопку</SubmitButton>
                          </form>
                        </div>
                      </details>)}
                      {!step.actions.length && <p className="inline-empty">Добавьте первую кнопку для этого шага.</p>}
                      <details className="add-editor compact"><summary><Plus size={17} />Добавить кнопку</summary><form action={addScenarioActionAction}>
                        <input type="hidden" name="stepId" value={step.id} />
                        <ScenarioActionFields steps={stepOptions} media={mediaOptions} currentStepId={step.id} />
                        <SubmitButton pendingLabel="Добавляем..."><Plus size={17} />Добавить кнопку</SubmitButton>
                      </form></details>
                    </div>
                  </div>
                </details>)}
                {!selected.scenario.steps.length && <div className="empty-state"><Workflow size={28} /><strong>Шагов пока нет</strong><span>Добавьте первый вопрос для пациента.</span></div>}
              </div>
              <details className="add-editor"><summary><Plus size={18} />Добавить шаг</summary><form action={addScenarioStepAction}>
                <input type="hidden" name="scenarioId" value={selected.scenario.id} />
                <label>Название шага<input name="title" placeholder="Например, Что вас беспокоит?" required /></label>
                <label>Пояснение<textarea name="description" placeholder="Помогите пациенту сделать понятный выбор" /></label>
                <SubmitButton pendingLabel="Добавляем..."><Plus size={17} />Добавить шаг</SubmitButton>
              </form></details>
            </> : <div className="empty-state"><Workflow size={28} /><strong>Сценарий не создан</strong><span>Создайте отделение заново или восстановите сценарий.</span></div>}
          </section>

          <section id="media" className="admin-section">
            <div className="section-heading"><div><p className="section-kicker">Материалы отделения</p><h2>Видео и памятки</h2></div><span className="section-note">{selected.media.length} материалов</span></div>
            <p className="section-description">Загрузите MP4, PDF, JPG, PNG или WebP. Новый материал создаётся как черновик и появится у пациентов только после публикации.</p>
            <FileUpload departmentId={selected.id} purpose="MEDIA" />
            <div className="editor-list media-editors">{selected.media.map((item) => <details className="editor-item" key={item.id}>
              <summary><span><strong>{item.title}</strong><small>{item.kind === "VIDEO" ? "Видео" : item.kind === "DOCUMENT" ? "Памятка PDF" : "Изображение"}</small></span><span className={`status ${item.status === PublicationStatus.PUBLISHED ? "published" : "draft"}`}>{item.status === PublicationStatus.PUBLISHED ? "Опубликовано" : "Черновик"}</span><span className="edit-label">Настроить</span></summary>
              <div className="editor-body">
                <form action={updateMediaItemAction}><input type="hidden" name="mediaId" value={item.id} /><label>Название<input name="title" defaultValue={item.title} required /></label><label>Описание<textarea name="description" defaultValue={item.description} /></label><SubmitButton className="button-icon-text"><Save size={17} />Сохранить материал</SubmitButton></form>
                <form action={toggleMediaPublicationAction} className="publication-inline"><input type="hidden" name="mediaId" value={item.id} /><input type="hidden" name="status" value={item.status === PublicationStatus.PUBLISHED ? PublicationStatus.DRAFT : PublicationStatus.PUBLISHED} /><SubmitButton className={item.status === PublicationStatus.PUBLISHED ? "button-secondary" : undefined}>{item.status === PublicationStatus.PUBLISHED ? "Скрыть с портала" : "Опубликовать материал"}</SubmitButton></form>
              </div>
            </details>)}</div>
            {!selected.media.length && <div className="inline-empty">Загруженных материалов пока нет.</div>}
          </section>

          <section id="head" className="admin-section">
            <div className="section-heading"><div><p className="section-kicker">Команда отделения</p><h2>Заведующий отделением</h2></div></div>
            <form action={updateDepartmentHeadAction}>
              <input type="hidden" name="departmentId" value={selected.id} />
              <div className="field-row three"><label>Имя<input name="firstName" defaultValue={selected.head?.firstName ?? ""} /></label><label>Фамилия<input name="lastName" defaultValue={selected.head?.lastName ?? ""} /></label><label>Отчество<input name="middleName" defaultValue={selected.head?.middleName ?? ""} /></label></div>
              <label>Должность<input name="roleTitle" defaultValue={selected.head?.roleTitle ?? ""} placeholder="Заведующий отделением, врач-травматолог" /></label>
              <label>Описание<textarea className="textarea-large" name="biography" defaultValue={selected.head?.biography ?? ""} /></label>
              <SubmitButton className="button-icon-text"><Save size={18} />Сохранить профиль</SubmitButton>
            </form>
            <div className="subsection-heading"><div><h3>Фотография</h3><p>{selected.head?.photoObjectKey ? "Фотография загружена и используется на портале." : "Добавьте портрет заведующего в JPG, PNG или WebP."}</p></div></div>
            <FileUpload departmentId={selected.id} purpose="HEAD_PHOTO" />
          </section>
        </> : <section className="admin-section"><div className="empty-state"><Building2 size={30} /><strong>Создайте первое отделение</strong><span>После этого появятся редакторы текстов, сценария и заведующего.</span></div></section>}
      </div>

      <aside className="admin-aside"><section className="aside-panel"><h2>Перед публикацией</h2><ul><li>Проверьте название и описание</li><li>Заполните профиль заведующего</li><li>Настройте первый шаг сценария</li><li>Опубликуйте сценарий и отделение</li></ul></section></aside>
      </div></fieldset>
    </section>
  </div></main>;
}

function FactIconOptions() {
  return <><option value="info">Информация</option><option value="clock">Время</option><option value="map-pin">Место</option><option value="phone">Телефон</option><option value="calendar">Расписание</option><option value="heart-pulse">Медицина</option></>;
}

function actionKindLabel(kind: string) {
  return { STEP: "Переход к шагу", MEDIA: "Видео или памятка", EMERGENCY: "Срочная помощь", INFORMATION: "Пояснение" }[kind] ?? kind;
}
