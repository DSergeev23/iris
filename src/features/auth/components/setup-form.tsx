"use client";

import { useActionState } from "react";
import { setupAdminAction, type SetupState } from "../server/setup-actions";

const initialState: SetupState = {};

export function SetupForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(setupAdminAction, initialState);

  return <form action={action}>
    <label>Одноразовый код настройки<input name="setupToken" type="password" autoComplete="off" required disabled={!enabled} /></label>
    <label>Имя администратора<input name="displayName" autoComplete="name" defaultValue="Администратор ИРИС" required disabled={!enabled} /></label>
    <label>Email<input name="email" type="email" autoComplete="username" required disabled={!enabled} /></label>
    <label>Пароль<input name="password" type="password" autoComplete="new-password" minLength={16} required disabled={!enabled} /></label>
    <label>Повторите пароль<input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={16} required disabled={!enabled} /></label>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <button type="submit" disabled={!enabled || pending}>{pending ? "Создаём..." : "Создать администратора"}</button>
  </form>;
}
