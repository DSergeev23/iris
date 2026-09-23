"use client";

import { useEffect, useId, useRef } from "react";
import { CircleAlert, Info, X } from "lucide-react";

type DialogTone = "default" | "warning" | "danger" | "info";

export function AdminActionDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "default",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: DialogTone;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const Icon = tone === "info" ? Info : CircleAlert;
  return <dialog
    ref={dialogRef}
    className={`admin-action-dialog ${tone}`}
    aria-labelledby={titleId}
    aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    <div className="admin-dialog-card">
      <button type="button" className="admin-dialog-close" aria-label="Закрыть окно" onClick={onClose}><X size={20} aria-hidden="true" /></button>
      <div className="admin-dialog-heading">
        <span className="admin-dialog-icon"><Icon size={24} aria-hidden="true" /></span>
        <div><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div>
      </div>
      <div className="admin-dialog-actions">
        {cancelLabel && <button type="button" className="admin-dialog-button cancel" autoFocus onClick={onClose}>{cancelLabel}</button>}
        <button type="button" className={`admin-dialog-button confirm ${tone}`} autoFocus={!cancelLabel} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  </dialog>;
}
