"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";

export function AdminToast({ message, tone, onDismiss }: { message: string; tone: "success" | "error"; onDismiss?: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timeoutId = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 7000);
    return () => window.clearTimeout(timeoutId);
  }, [message, onDismiss]);

  if (!visible) return null;
  const Icon = tone === "success" ? CheckCircle2 : TriangleAlert;
  return <div className={`feedback ${tone}`} role={tone === "error" ? "alert" : "status"} aria-live={tone === "error" ? "assertive" : "polite"}>
    <Icon size={21} aria-hidden="true" />
    <span className="feedback-message">{message}</span>
    <button type="button" className="feedback-close" aria-label="Закрыть уведомление" onClick={() => { setVisible(false); onDismiss?.(); }}><X size={17} aria-hidden="true" /></button>
  </div>;
}
