"use client";

import { useActionState } from "react";
import { login } from "../actions";
import { Icon } from "@/components/Icon";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="form">
      <div className="field">
        <label htmlFor="username">Username</label>
        <input id="username" name="username" className="input" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      {state.error ? <div className="err" role="alert">{state.error}</div> : null}
      <button className="btn primary block" disabled={pending}>
        <Icon name="lock" className="ic sm" />{pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
