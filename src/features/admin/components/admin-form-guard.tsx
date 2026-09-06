"use client";

import { useEffect } from "react";

export function AdminFormGuard() {
  useEffect(() => {
    const hasChanges = () => Array.from(document.forms).some((form) => form.dataset.dirty === "true");
    const markDirty = (event: Event) => { (event.target as HTMLInputElement).form?.setAttribute("data-dirty", "true"); };
    const clearDirty = (event: Event) => { window.setTimeout(() => (event.target as HTMLFormElement).removeAttribute("data-dirty")); };
    const clearOnSubmit = (event: Event) => { (event.target as HTMLFormElement).removeAttribute("data-dirty"); };
    const confirmNavigation = (event: MouseEvent) => {
      const link = (event.target as Element).closest("a[href]");
      if (!link || !hasChanges() || window.confirm("Есть несохранённые изменения. Перейти без сохранения?")) return;
      event.preventDefault();
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

  return null;
}
