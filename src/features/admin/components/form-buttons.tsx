"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Archive, Trash2 } from "lucide-react";

export function SubmitButton({ children, pendingLabel = "Сохраняем...", className }: { children: ReactNode; pendingLabel?: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending} aria-disabled={pending}>{pending ? pendingLabel : children}</button>;
}

export function CancelButton({ label = "Отменить изменения" }: { label?: string }) {
  return <button type="reset" className="button-secondary">{label}</button>;
}

export function ConfirmPublicationButton({ label, publish }: { label: string; publish: boolean }) {
  const { pending } = useFormStatus();
  const action = publish ? "Опубликовать" : "Скрыть с портала";
  const message = publish
    ? `Опубликовать «${label}»? После этого изменения увидят пациенты.`
    : `Скрыть «${label}» с портала? Пациенты больше не смогут его открыть.`;
  return <button type="submit" className={publish ? undefined : "button-secondary"} disabled={pending} onClick={(event) => { if (!window.confirm(message)) event.preventDefault(); }}>
    {pending ? "Сохраняем..." : action}
  </button>;
}

export function ConfirmDeleteButton({ label, description }: { label: string; description?: string }) {
  const { pending } = useFormStatus();
  return <button
    type="submit"
    className="button-danger button-icon-text"
    disabled={pending}
    onClick={(event) => { if (!window.confirm(`Удалить «${label}»?${description ? ` ${description}` : ""} Это действие нельзя отменить.`)) event.preventDefault(); }}
  >
    <Trash2 size={17} aria-hidden="true" />{pending ? "Удаляем..." : "Удалить"}
  </button>;
}

export function ConfirmArchiveButton({ label, restore = false }: { label: string; restore?: boolean }) {
  const { pending } = useFormStatus();
  const action = restore ? "Восстановить" : "В архив";
  const message = restore
    ? `Восстановить «${label}» как черновик? Он останется скрытым от пациентов.`
    : `Переместить «${label}» в архив? Данные сохранятся, но пациенты больше не смогут их открыть.`;
  return <button type="submit" className="button-secondary button-icon-text" disabled={pending} onClick={(event) => { if (!window.confirm(message)) event.preventDefault(); }}>
    <Archive size={17} aria-hidden="true" />{pending ? "Сохраняем..." : action}
  </button>;
}
