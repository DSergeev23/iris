"use client";

import { useState } from "react";

type Option = { id: string; title: string };

export function ScenarioActionFields({
  steps,
  media,
  currentStepId,
  defaults,
}: {
  steps: Option[];
  media: Option[];
  currentStepId: string;
  defaults?: { title?: string; body?: string; actionLabel?: string; kind?: string; targetStepId?: string | null; targetMediaId?: string | null };
}) {
  const [kind, setKind] = useState(defaults?.kind ?? "INFORMATION");
  return <>
    <label>Название кнопки<input name="title" defaultValue={defaults?.title ?? ""} placeholder="Например, После операции" required /></label>
    <label>Короткое пояснение<textarea name="body" defaultValue={defaults?.body ?? ""} placeholder="Что произойдёт после выбора" /></label>
    <div className="field-row">
      <label>Текст действия<input name="actionLabel" defaultValue={defaults?.actionLabel || "Открыть"} required /></label>
      <label>Что делает кнопка<select name="kind" value={kind} onChange={(event) => setKind(event.target.value)}>
        <option value="INFORMATION">Показывает пояснение</option>
        <option value="STEP">Переходит к следующему шагу</option>
        <option value="MEDIA">Открывает видео или памятку</option>
        <option value="EMERGENCY">Открывает срочную помощь</option>
      </select></label>
    </div>
    {kind === "STEP" && <label>Следующий шаг<select name="targetStepId" defaultValue={defaults?.targetStepId ?? ""} required>
      <option value="">Выберите шаг</option>
      {steps.filter((step) => step.id !== currentStepId).map((step) => <option key={step.id} value={step.id}>{step.title}</option>)}
    </select></label>}
    {kind === "MEDIA" && <label>Видео или памятка<select name="targetMediaId" defaultValue={defaults?.targetMediaId ?? ""} required>
      <option value="">Выберите материал</option>
      {media.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
    </select>{!media.length && <span className="field-hint">Сначала добавьте материал в разделе «Видео и памятки».</span>}</label>}
  </>;
}
