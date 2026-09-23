"use client";

import { useEffect, useState } from "react";
import { AdminActionDialog } from "./admin-action-dialog";

export function AdminFormGuard() {
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    const hasChanges = () => Array.from(document.forms).some((form) => form.dataset.dirty === "true");
    const markDirty = (event: Event) => { (event.target as HTMLInputElement).form?.setAttribute("data-dirty", "true"); };
    const clearDirty = (event: Event) => { window.setTimeout(() => (event.target as HTMLFormElement).removeAttribute("data-dirty")); };
    const clearOnSubmit = (event: Event) => { (event.target as HTMLFormElement).removeAttribute("data-dirty"); };
    const confirmNavigation = (event: MouseEvent) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (!link || !hasChanges()) return;
      event.preventDefault();
      setPendingHref(link.href);
    };
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    };

    document.addEventListener("input", markDirty, true);
    document.addEventListener("change", markDirty, true);
    document.addEventListener("reset", clearDirty, true);
    document.addEventListener("submit", clearOnSubmit, true);
    document.addEventListener("click", confirmNavigation, true);
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => {
      document.removeEventListener("input", markDirty, true);
      document.removeEventListener("change", markDirty, true);
      document.removeEventListener("reset", clearDirty, true);
      document.removeEventListener("submit", clearOnSubmit, true);
      document.removeEventListener("click", confirmNavigation, true);
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, []);

  const continueNavigation = () => {
    const href = pendingHref;
    setPendingHref(null);
    document.querySelectorAll("form[data-dirty='true']").forEach((form) => form.removeAttribute("data-dirty"));
    if (href) window.location.assign(href);
  };

  return <AdminActionDialog
    open={pendingHref !== null}
    title="Перейти без сохранения?"
    description="В форме есть несохранённые изменения. Если продолжить, они будут потеряны."
    confirmLabel="Перейти без сохранения"
    cancelLabel="Остаться"
    tone="warning"
    onConfirm={continueNavigation}
    onClose={() => setPendingHref(null)}
  />;
}
