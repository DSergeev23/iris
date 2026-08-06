"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";

export function SubmitButton({ children, pendingLabel = "Сохраняем...", className }: { children: ReactNode; pendingLabel?: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending} aria-disabled={pending}>{pending ? pendingLabel : children}</button>;
}

export function ConfirmDeleteButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button
    type="submit"
    className="button-danger button-icon-text"
    disabled={pending}
    onClick={(event) => { if (!window.confirm(`Удалить «${label}»? Это действие нельзя отменить.`)) event.preventDefault(); }}
  >
    <Trash2 size={17} aria-hidden="true" />{pending ? "Удаляем..." : "Удалить"}
  </button>;
}
