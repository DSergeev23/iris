"use client";

import { useMemo, useState } from "react";
import type { PortalDepartment } from "../types";

type Props = { departments: PortalDepartment[]; initialSlug?: string };

export function PortalClient({ departments, initialSlug }: Props) {
  const initialIndex = Math.max(0, departments.findIndex((item) => item.slug === initialSlug));
  const [departmentIndex, setDepartmentIndex] = useState(initialIndex);
  const [activePanel, setActivePanel] = useState<"scenario" | "media" | "emergency" | null>(null);
  const department = departments[departmentIndex] ?? departments[0];
  const firstStep = department.scenario?.steps[0];

  const stepContent = useMemo(() => firstStep?.actions ?? [], [firstStep]);
  if (!department) return <main className="portal shell"><p>Пока нет опубликованных отделений.</p></main>;

  return <main className="portal">
    <div className="shell">
      <header className="portal-header">
        <a className="brand" href="/portal"><span className="brand-mark">+</span><span>ИРИС</span></a>
        <a className="quiet-link" href="#department-info">Об отделении</a>
      </header>

      <nav className="department-tabs" aria-label="Отделения">
        {departments.map((item, index) => <button key={item.id} className="department-tab" aria-selected={index === departmentIndex} onClick={() => { setDepartmentIndex(index); setActivePanel(null); }}>{item.name}</button>)}
      </nav>

      <section className="portal-hero">
        <p className="eyebrow">Вы в отделении</p>
        <h1>{department.name}</h1>
        <p className="lead">{department.intro}</p>
      </section>

      <section className="action-grid" aria-label="Действия">
        <button className="action-card primary" onClick={() => setActivePanel("scenario")}>
          <span className="action-icon">↗</span><span><h2>{department.scenario?.title ?? "Провести по шагам"}</h2><p>{department.scenario?.description ?? "Выберите, что нужно сейчас."}</p></span><span className="go">→</span>
        </button>
        <button className="action-card" onClick={() => setActivePanel("media")}>
          <span className="action-icon">▶</span><span><h2>Видео и памятки</h2><p>Короткие материалы от команды отделения.</p></span><span className="go">→</span>
        </button>
        <button className="action-card danger" onClick={() => setActivePanel("emergency")}>
          <span className="action-icon">!</span><span><h2>Срочный вопрос</h2><p>Если самочувствие изменилось или нужна помощь персонала.</p></span><span className="go">→</span>
        </button>
      </section>

      {activePanel === "scenario" && <section className="panel" aria-live="polite"><h2>{firstStep?.title ?? "Сценарий пока не опубликован"}</h2><p>{firstStep?.description}</p><div className="choice-list">{stepContent.map((action) => <button className="choice" key={action.id}><span><strong>{action.title}</strong><span>{action.body}</span></span><b>→</b></button>)}</div></section>}
      {activePanel === "media" && <section className="panel" aria-live="polite"><h2>Видео и памятки</h2><p>Открывайте только те материалы, которые относятся к вашему отделению.</p><div className="media-list">{department.media.length ? department.media.map((media) => <article className="media-item" key={media.id}><span className="mini-icon">▶</span><div><h3>{media.title}</h3><p>{media.description}</p></div></article>) : <p>Пока нет опубликованных материалов.</p>}</div></section>}
      {activePanel === "emergency" && <section className="panel emergency" aria-live="polite"><h2>{department.scenario?.emergencyTitle ?? "Нужна срочная помощь?"}</h2><p>{department.scenario?.emergencyBody ?? "Позовите медицинскую сестру кнопкой вызова у кровати или обратитесь на пост."}</p></section>}

      <section id="department-info" className="about-grid">
        <article className="doctor">
          <div className="avatar">{department.head?.name.split(" ").map((part) => part[0]).slice(0, 2).join("") ?? "+"}</div>
          <h2>{department.head?.name ?? "Команда отделения"}</h2>
          <p className="role">{department.head?.role}</p>
          <p>{department.head?.biography}</p>
        </article>
        <article className="panel"><h2>{department.reference?.title ?? "Об отделении"}</h2><p>{department.reference?.description}</p><div className="fact-list">{department.facts.map((fact) => <div className="fact-item" key={fact.id}><span className="mini-icon">i</span><div><h3>{fact.title}</h3><p>{fact.body}</p></div></div>)}</div></article>
      </section>
    </div>
  </main>;
}
