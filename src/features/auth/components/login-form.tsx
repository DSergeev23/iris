"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "../server/actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);
  return <form action={action}>
    <label>Email<input name="email" type="email" autoComplete="username" required /></label>
    <label>Пароль<input name="password" type="password" autoComplete="current-password" required /></label>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <button type="submit" disabled={pending}>{pending ? "Проверяем..." : "Войти в админку"}</button>
  </form>;
}
