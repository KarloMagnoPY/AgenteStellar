"use client";

import { useState } from "react";
import { CATALOG, GROUP_HINT, GROUPS, inputError, type CatalogStep, type RoutineItem } from "@/lib/routine";

export function StepPicker({
  items,
  onChange,
}: {
  items: RoutineItem[];
  onChange: (items: RoutineItem[]) => void;
}) {
  const [open, setOpen] = useState<(typeof GROUPS)[number]>("Revisar");
  const [pending, setPending] = useState<CatalogStep | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  function add(step: CatalogStep, value?: string) {
    onChange([...items, { uid: crypto.randomUUID(), stepId: step.id, input: value }]);
    setPending(null);
    setInput("");
    setError("");
  }

  function pick(step: CatalogStep) {
    if (!step.needs) {
      add(step);
      return;
    }
    setPending(step);
    setInput("");
    setError("");
  }

  function confirm() {
    if (!pending) return;
    const problem = inputError(pending, input);
    if (problem) {
      setError(problem);
      return;
    }
    add(pending, input.trim().toUpperCase());
  }

  return (
    <div className="mt-3">
      {pending ? (
        <form
          className="mb-3 rounded-2xl border border-signal/50 bg-paper px-3 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            confirm();
          }}
        >
          <p className="text-sm">{pending.title}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{pending.detail}</p>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={pending.needs === "account" ? "G…" : "C…"}
            className="mt-3 w-full rounded-xl border border-line bg-background px-3 py-3 font-mono text-base outline-none"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
          />
          {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
          <div className="mt-3 flex gap-2">
            <button type="submit" className="rounded-full bg-signal px-4 py-2 text-sm font-medium text-[#1c1408]">
              Añadir
            </button>
            <button type="button" className="rounded-full px-4 py-2 text-sm text-muted" onClick={() => setPending(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid grid-cols-3 gap-1 rounded-full bg-paper p-1">
        {GROUPS.map((group) => (
          <button
            key={group}
            type="button"
            onClick={() => setOpen(group)}
            className={`rounded-full px-2 py-2 text-xs ${open === group ? "bg-signal font-medium text-[#1c1408]" : "text-muted"}`}
          >
            {group === "Operar en la demo" ? "Operar" : group}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs leading-5 text-muted">{GROUP_HINT[open]}</p>
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
        {CATALOG.filter((step) => step.group === open).map((step) => (
          <li key={step.id}>
            <button type="button" onClick={() => pick(step)} className="flex w-full items-center gap-3 px-3 py-3 text-left">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-paper-2 text-sm text-signal">+</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-foreground">{step.title}</span>
                <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted">{step.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
