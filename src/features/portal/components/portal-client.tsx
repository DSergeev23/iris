"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Accessibility,
  ArrowLeft,
  Bed,
  Bone,
  Brain,
  Building2,
  CalendarDays,
  CircleAlert,
  ClipboardList,
  Clock3,
  FileText,
  HeartPulse,
  Hospital,
  Info,
  MapPin,
  Phone,
  Play,
  Sparkles,
  Stethoscope,
  Video,
} from "lucide-react";
import type { PortalDepartment } from "../types";
import styles from "./portal-client.module.css";

type Props = { departments: PortalDepartment[]; initialSlug?: string };
type Scenario = NonNullable<PortalDepartment["scenario"]>;
type ScenarioStep = Scenario["steps"][number];
type ScenarioAction = ScenarioStep["actions"][number];
type View =
  | { type: "steps" }
  | { type: "step"; stepId: string }
  | { type: "information"; action: ScenarioAction }
  | { type: "media" }
  | { type: "media-detail"; mediaId: string }
  | { type: "emergency" };

function cx(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(" ");
}

export function PortalClient({ departments, initialSlug }: Props) {
  const initialIndex = Math.max(0, departments.findIndex((item) => item.slug === initialSlug));
  const [departmentIndex, setDepartmentIndex] = useState(initialIndex);
  const [history, setHistory] = useState<View[]>([]);
  const department = departments[departmentIndex] ?? departments[0];
  const view = history.at(-1) ?? null;

  useEffect(() => {
    document.body.style.overflow = view ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [view]);

  const media = department?.media ?? [];
  const initials = useMemo(() => {
    if (!department?.head?.name) return "И";
    return department.head.name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("");
  }, [department]);

  if (!department) {
    return <main className={styles.empty}>
      <Stethoscope size={48} />
      <h1>Отделения пока не опубликованы</h1>
      <p>Материалы появятся здесь после заполнения администратором.</p>
    </main>;
  }

  function selectDepartment(index: number) {
    setDepartmentIndex(index);
    setHistory([]);
    const selected = departments[index];
    if (selected) {
      const url = new URL(window.location.href);
      url.searchParams.set("department", selected.slug);
      window.history.replaceState({}, "", url);
    }
  }

  function open(next: View) {
    setHistory((current) => [...current, next]);
  }

  function close() {
    setHistory([]);
  }

  function goBack() {
    setHistory((current) => current.slice(0, -1));
  }

  function handleAction(action: ScenarioAction) {
    if (action.kind === "STEP" && action.targetStepId) return open({ type: "step", stepId: action.targetStepId });
    if (action.kind === "MEDIA" && action.targetMediaId) return open({ type: "media-detail", mediaId: action.targetMediaId });
    if (action.kind === "MEDIA") return open({ type: "media" });
    if (action.kind === "EMERGENCY") return open({ type: "emergency" });
    open({ type: "information", action });
  }

  return <main className={styles.portal}>
    <div className={styles.app}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.intro}>
            <div className={styles.brandline}><Sparkles />ГКБ №1 им. Н.И. Пирогов<Sparkles /></div>
            <h1>ИРИС помогает пациенту не потеряться в больнице</h1>
            <p>Сканируйте QR-код, выбирайте свой этап и смотрите понятные памятки или видео восстановления. Крупно, спокойно, без регистрации.</p>
            <nav className={styles.clinicalChips} aria-label="Выбор отделения">
              {departments.map((item, index) => <button
                key={item.id}
                type="button"
                className={cx(styles.chip, index === departmentIndex && styles.activeChip)}
                aria-pressed={index === departmentIndex}
                onClick={() => selectDepartment(index)}
              ><DepartmentIcon department={item} />{item.name}</button>)}
            </nav>
          </div>
          <div className={styles.topActions}>
            <button className={cx(styles.pill, styles.primaryPill)} onClick={() => open({ type: "steps" })}>Провести по шагам</button>
            <a className={cx(styles.pill, styles.secondaryPill)} href="#department-info"><Hospital />Об отделении</a>
          </div>
        </header>

        <section className={styles.grid}>
          <article className={cx(styles.card, styles.primaryCard, styles.glass, styles.noise)}>
            <div>
              <div className={styles.cardTitle}><Sparkles />Помощник пациента<Sparkles /></div>
              <div className={styles.irisMark}>И</div>
              <p className={styles.bigText}>Что Вам нужно сейчас?</p>
              <p className={styles.mutedLight}>Выберите один из двух понятных путей. Если плохо или боль усиливается, зовите медсестру.</p>
            </div>
            <div className={styles.actions}>
              <ActionButton icon={<ClipboardList />} title={department.scenario?.title ?? "Провести по шагам"} body={department.scenario?.description || "Подскажу, что делать на Вашем этапе"} onClick={() => open({ type: "steps" })} />
              <ActionButton icon={<Video />} title="Видео и памятки" body="Открыть сразу, без вопросов" onClick={() => open({ type: "media" })} />
            </div>
          </article>

          <div className={styles.stack}>
            <article className={cx(styles.card, styles.noticeCard, styles.glass, styles.noise)}>
              <div className={styles.leftCardTitle}>Больничный сценарий</div>
              <p>ИРИС не пытается быть врачом. Он показывает памятки отделения, видео и помогает быстро найти следующий шаг.</p>
            </article>
            <article className={cx(styles.card, styles.emergencyCard, styles.glass, styles.noise)}>
              <div className={styles.leftCardTitle}>Если стало плохо</div>
              <p className={styles.emergencyTitle}>{department.scenario?.emergencyTitle || "Сразу позовите медсестру"}</p>
              <p className={styles.mutedLight}>{department.scenario?.emergencyBody || "Боль, одышка, головокружение, кровотечение, онемение или падение."}</p>
              <button className={styles.emergencyButton} onClick={() => open({ type: "emergency" })}>Что считать срочным</button>
            </article>
          </div>

          <article className={cx(styles.card, styles.mediaCard, styles.glass, styles.noise)}>
            <div>
              <div className={styles.cardTitle}><Sparkles />Медиатека<Sparkles /></div>
              <p className={styles.bigText}>Короткие видео восстановления</p>
              <div className={styles.marquee} aria-hidden="true"><div className={styles.marqueeTrack}>
                {[Bed, Accessibility, Bone, Stethoscope, HeartPulse, Building2, Video, Bed].map((Icon, index) => <span className={styles.tile} key={index}><Icon /></span>)}
              </div></div>
            </div>
            <div className={styles.mediaList}>
              {media.slice(0, 3).map((item) => <MediaRow key={item.id} item={item} onClick={() => open({ type: "media-detail", mediaId: item.id })} />)}
              {!media.length && <p className={styles.emptyMedia}>Материалы пока не опубликованы</p>}
            </div>
          </article>
        </section>

        <section className={styles.departmentInfo} id="department-info">
          <article className={cx(styles.card, styles.doctorCard, styles.glass, styles.noise)}>
            <div className={styles.doctorLayout}>
              <div className={styles.doctorPhoto}>{department.head?.photoUrl ? <img src={department.head.photoUrl} alt={department.head.name ? `Заведующий отделением ${department.head.name}` : "Заведующий отделением"} /> : initials}</div>
              <div>
                <div className={styles.doctorRole}>{department.head?.role || "Заведующий отделением"}</div>
                <h2>{department.head?.name || "Команда отделения"}</h2>
                <p>{department.head?.biography || "Информация о заведующем появится после заполнения в админке."}</p>
              </div>
            </div>
          </article>
          <article className={cx(styles.card, styles.referenceCard, styles.glass, styles.noise)}>
            <div className={styles.doctorRole}>Справка по отделению</div>
            <h2>{department.reference?.title || department.name}</h2>
            <p>{department.reference?.description || department.intro}</p>
            <div className={styles.referenceList}>{department.facts.map((fact) => <div className={styles.referenceItem} key={fact.id}>
              <span className={styles.referenceIcon}><FactIcon iconKey={fact.iconKey} /></span>
              <span className={styles.referenceCopy}><strong>{fact.title}</strong><span>{fact.body}</span></span>
            </div>)}</div>
          </article>
        </section>
      </div>
    </div>

    {view && <section className={styles.panel} role="dialog" aria-modal="true" aria-label="Экран ИРИС">
      <div className={styles.panelInner}>
        <nav className={styles.panelNav}>
          <button className={styles.navButton} onClick={goBack}><ArrowLeft />Назад</button>
          <button className={styles.navButton} onClick={close}>В начало</button>
          <span className={styles.navTitle}>ИРИС · {department.name}</span>
        </nav>
        <div className={cx(styles.screen, styles.glass, styles.noise)}><PanelContent department={department} view={view} open={open} onAction={handleAction} /></div>
      </div>
    </section>}
  </main>;
}

function PanelContent({ department, view, open, onAction }: { department: PortalDepartment; view: View; open: (view: View) => void; onAction: (action: ScenarioAction) => void }) {
  const scenario = department.scenario;
  const firstStep = scenario?.steps[0];

  if (view.type === "steps") {
    return <><h2>{firstStep?.title || `${department.name}: что сейчас важно?`}</h2><p>{firstStep?.description || "Сценарий пока не опубликован."}</p><div className={styles.stepGrid}>{firstStep?.actions.map((action) => <PanelAction key={action.id} action={action} onClick={() => onAction(action)} />)}</div></>;
  }

  if (view.type === "step") {
    const step = scenario?.steps.find((item) => item.id === view.stepId);
    return <><h2>{step?.title || "Шаг не найден"}</h2><p>{step?.description}</p><div className={styles.stepGrid}>{step?.actions.map((action) => <PanelAction key={action.id} action={action} onClick={() => onAction(action)} />)}</div>{step && !step.actions.length && <p>Для этого шага пока нет кнопок.</p>}</>;
  }

  if (view.type === "information") {
    return <><h2>{view.action.title}</h2><p>{view.action.body}</p><div className={styles.patientChecklist}><div><b><Info /></b><span>{view.action.actionLabel}</span></div></div></>;
  }

  if (view.type === "media") {
    return <><h2>Видео и памятки</h2><p>Материалы для отделения: {department.name}. Выберите ролик или памятку.</p><div className={styles.panelMediaList}>{department.media.map((item) => <MediaRow key={item.id} item={item} light onClick={() => open({ type: "media-detail", mediaId: item.id })} />)}{!department.media.length && <p>Материалы пока не опубликованы.</p>}</div></>;
  }

  if (view.type === "media-detail") {
    const item = department.media.find((media) => media.id === view.mediaId);
    return <><h2>{item?.title || "Материал не найден"}</h2><p>{item?.description}</p>{item?.url && item.kind === "VIDEO" ? <video className={styles.videoPlayer} controls preload="metadata" src={item.url}>Ваш браузер не поддерживает видео.</video> : item?.url ? <a className={styles.documentLink} href={item.url} target="_blank" rel="noreferrer"><FileText />Открыть памятку</a> : <div className={styles.videoBox}>{item?.kind === "VIDEO" ? <Play /> : <FileText />}</div>}<div className={styles.warn}><div><strong>Важно:</strong> если состояние ухудшилось, остановитесь и позовите медсестру.</div></div></>;
  }

  return <><h2>{scenario?.emergencyTitle || "Когда срочно звать помощь"}</h2><p>Список адаптирован под отделение: {department.name}.</p><div className={styles.warn}><div><CircleAlert /><span>{scenario?.emergencyBody || "Позовите медицинскую сестру кнопкой вызова у кровати или обратитесь на пост."}</span></div></div></>;
}

function ActionButton({ icon, title, body, onClick }: { icon: ReactNode; title: string; body: string; onClick: () => void }) {
  return <button className={styles.action} onClick={onClick}><span className={styles.actionIcon}>{icon}</span><span><strong>{title}</strong><span>{body}</span></span><span className={styles.arrow}>›</span></button>;
}

function PanelAction({ action, onClick }: { action: ScenarioAction; onClick: () => void }) {
  return <button className={styles.panelAction} onClick={onClick}><span className={styles.panelActionIcon}>{action.kind === "MEDIA" ? <Video /> : action.kind === "EMERGENCY" ? <CircleAlert /> : <ClipboardList />}</span><span><strong>{action.title}</strong><span>{action.body}</span></span><span className={styles.arrow}>›</span></button>;
}

function MediaRow({ item, onClick, light = false }: { item: PortalDepartment["media"][number]; onClick: () => void; light?: boolean }) {
  return <button className={cx(styles.mediaRow, light && styles.lightMediaRow)} onClick={onClick}><span className={styles.mediaIcon}>{item.kind === "VIDEO" ? <Play /> : <FileText />}</span><span><strong>{item.title}</strong><small>{item.kind === "VIDEO" ? "Видео" : "Памятка"}</small></span></button>;
}

function DepartmentIcon({ department }: { department: PortalDepartment }) {
  const value = `${department.slug} ${department.name}`.toLowerCase();
  if (value.includes("neuro") || value.includes("невр")) return <Brain />;
  if (value.includes("trauma") || value.includes("травм")) return <Bone />;
  return <Stethoscope />;
}

function FactIcon({ iconKey }: { iconKey: string }) {
  if (iconKey === "clock") return <Clock3 />;
  if (iconKey === "map-pin") return <MapPin />;
  if (iconKey === "phone") return <Phone />;
  if (iconKey === "calendar") return <CalendarDays />;
  if (iconKey === "heart-pulse") return <HeartPulse />;
  return <Info />;
}
