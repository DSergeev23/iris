"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Archive, Trash2 } from "lucide-react";
import { AdminActionDialog } from "./admin-action-dialog";
import { AdminToast } from "./admin-toast";

export function SubmitButton({ children, pendingLabel = "Сохраняем...", className, savedEvent, trackChanges = false }: { children: ReactNode; pendingLabel?: string; className?: string; savedEvent?: string; trackChanges?: boolean }) {
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dirty, setDirty] = useState(false);
  const [showSaved, setShowSaved] = useState(Boolean(savedEvent));

  useEffect(() => {
    if (!trackChanges) return;
    const form = buttonRef.current?.form;
    if (!form) return;
    const snapshot = () => JSON.stringify(Array.from(new FormData(form).entries()).filter(([name]) => !name.startsWith("$ACTION_")));
    const initial = snapshot();
    const update = () => {
      const changed = snapshot() !== initial;
      setDirty(changed);
      form.toggleAttribute("data-dirty", changed);
      if (changed) setShowSaved(false);
    };
    const reset = () => window.setTimeout(update, 0);
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener("reset", reset);
    return () => {
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
      form.removeEventListener("reset", reset);
    };
  }, [trackChanges, savedEvent]);

  useEffect(() => {
    setShowSaved(Boolean(savedEvent));
    setDirty(false);
    if (savedEvent) buttonRef.current?.scrollIntoView({ block: "center" });
  }, [savedEvent]);
  return <><button ref={buttonRef} type="submit" className={className} disabled={pending || (trackChanges && !dirty)} aria-disabled={pending || (trackChanges && !dirty)}>{pending ? pendingLabel : children}</button>{trackChanges && showSaved && !dirty && <span className="form-saved" role="status">Изменения сохранены</span>}</>;
}

export function CancelButton({ label = "Отменить изменения" }: { label?: string }) {
  return <button type="reset" className="button-secondary">{label}</button>;
}

function ConfirmActionButton({ children, pendingLabel, className, title, message, confirmLabel, tone = "default", blockedReason }: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "default" | "warning" | "danger";
  blockedReason?: string;
}) {
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dialog, setDialog] = useState<"confirm" | "blocked" | null>(null);
  const [blockedToast, setBlockedToast] = useState<string | null>(null);
  const submit = () => {
    setDialog(null);
    buttonRef.current?.form?.requestSubmit(buttonRef.current);
  };

  return <><button ref={buttonRef} type="submit" className={className} disabled={pending} onClick={(event) => {
    event.preventDefault();
    if (blockedReason) {
      setBlockedToast(blockedReason);
      setDialog("blocked");
      return;
    }
    setDialog("confirm");
  }}>{pending ? pendingLabel : children}</button>
    <AdminActionDialog
      open={dialog !== null}
      title={dialog === "blocked" ? "Действие пока недоступно" : title}
      description={dialog === "blocked" ? blockedReason ?? "" : message}
      confirmLabel={dialog === "blocked" ? "Понятно" : confirmLabel}
      cancelLabel={dialog === "confirm" ? "Отменить" : undefined}
      tone={dialog === "blocked" ? "info" : tone}
      onConfirm={dialog === "blocked" ? () => setDialog(null) : submit}
      onClose={() => setDialog(null)}
    />
    {blockedToast && <AdminToast message={blockedToast} tone="error" onDismiss={() => setBlockedToast(null)} />}
  </>;
}

export function ConfirmPublicationButton({ label, publish, blockedReason, warning }: { label: string; publish: boolean; blockedReason?: string; warning?: string }) {
  const action = publish ? "Опубликовать" : "Скрыть с портала";
  const message = (publish
    ? `Опубликовать «${label}»? После этого изменения увидят пациенты.`
    : `Скрыть «${label}» с портала? Пациенты больше не смогут его открыть.`) + (warning ? ` ${warning}` : "");
  return <ConfirmActionButton
    className={publish ? undefined : "button-secondary"}
    pendingLabel="Сохраняем..."
    title={publish ? "Опубликовать раздел?" : "Скрыть раздел с портала?"}
    message={message}
    confirmLabel={action}
    tone={publish ? "default" : "warning"}
    blockedReason={publish ? blockedReason : undefined}
  >{action}</ConfirmActionButton>;
}

export function ConfirmDeleteButton({ label, description }: { label: string; description?: string }) {
  return <ConfirmActionButton
    className="button-danger button-icon-text"
    pendingLabel="Удаляем..."
    title="Удалить без возможности восстановления?"
    message={`Будет удалено «${label}».${description ? ` ${description}` : ""} Это действие нельзя отменить.`}
    confirmLabel="Удалить"
    tone="danger"
  ><Trash2 size={17} aria-hidden="true" />Удалить</ConfirmActionButton>;
}

export function ConfirmArchiveButton({ label, restore = false }: { label: string; restore?: boolean }) {
  const action = restore ? "Восстановить" : "В архив";
  const message = restore
    ? `Восстановить «${label}» как черновик? Он останется скрытым от пациентов.`
    : `Переместить «${label}» в архив? Данные сохранятся, но пациенты больше не смогут их открыть.`;
  return <ConfirmActionButton
    className="button-secondary button-icon-text"
    pendingLabel="Сохраняем..."
    title={restore ? "Восстановить из архива?" : "Переместить в архив?"}
    message={message}
    confirmLabel={action}
    tone="warning"
  ><Archive size={17} aria-hidden="true" />{action}</ConfirmActionButton>;
}
