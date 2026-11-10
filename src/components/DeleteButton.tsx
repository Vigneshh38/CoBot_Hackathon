"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "./Icon";

function Confirm() {
  const { pending } = useFormStatus();
  return <button className="btn danger" disabled={pending}><Icon name="trash" className="ic sm" />{pending ? "Deleting…" : "Delete"}</button>;
}

/** Delete with a confirmation dialog — for test or duplicate reports (or teams, via the optional texts). */
export function DeleteButton({ id, title, action, label = "Delete report", heading = "Delete this report?",
  message = "Use this only for test or duplicate reports.", block = true }: {
  id: number; title: string; action: (f: FormData) => Promise<void>;
  label?: string; heading?: string; message?: string; block?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`btn danger ${block ? "block" : "sm"}`} onClick={() => setOpen(true)} aria-label={label || heading} title={label ? undefined : heading}>
        <Icon name="trash" className="ic sm" />{label}
      </button>
      {open ? (
        <div className="dialog-backdrop" onClick={() => setOpen(false)} role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="del-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="del-title">{heading}</h3>
            <p>“{title}” will be permanently removed. {message}</p>
            <form action={action} className="acts">
              <input type="hidden" name="id" value={id} />
              <button type="button" className="btn text" onClick={() => setOpen(false)} autoFocus>Cancel</button>
              <Confirm />
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
