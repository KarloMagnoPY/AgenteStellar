"use client";

import { useState } from "react";
import { CountUp, DotsLoader, VoiceOrb } from "@/components/motion";
import type { LifeView } from "@/lib/life";

function money(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function LifeScreen({
  life,
  onLife,
  onTalk,
  onSignOut,
}: {
  life: LifeView;
  onLife: (life: LifeView) => void;
  onTalk: () => void;
  onSignOut: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const progress = Math.min(100, (money(life.balance) / money(life.target)) * 100);
  const dead = life.status === "dead";
  const ascended = life.status === "ascended";
  const phase = pending ? "thinking" : dead ? "idle" : "speaking";

  async function act(action: "cycle" | "reset") {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/life", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json()) as LifeView & { error?: string };
      if (!response.ok) throw new Error(data.error || "La vida no pudo avanzar.");
      onLife(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La vida no pudo avanzar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-background sm:border-x sm:border-line">
      <header className="flex items-start justify-between gap-3 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div>
          <p className="font-display text-2xl leading-none text-accent">agenteStellar</p>
          <p className="mt-1 text-xs tracking-[0.16em] text-muted uppercase">Vida · web4 · testnet</p>
          <button type="button" onClick={onSignOut} className="mt-1 text-[10px] tracking-wide text-muted uppercase">
            Cerrar sesión
          </button>
        </div>
        <div className="rounded-2xl bg-paper px-3 py-2 text-right">
          <span className="block font-display text-xl leading-none">×{life.multiple}</span>
          <span className="mt-1 block text-[10px] tracking-wide text-muted uppercase">
            {dead ? "muerto" : ascended ? "×100" : "vivo"}
          </span>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-4">
        <div className="flex flex-col items-center text-center">
          <VoiceOrb phase={phase} />
          <p className="mt-2 font-display text-5xl leading-none">
            <CountUp value={money(life.balance)} />
          </p>
          <p className="mt-2 text-xs text-muted">de {life.start} a {life.target}</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-paper-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
          <p className="glass mt-4 rounded-3xl px-4 py-3 text-sm leading-6">
            Multiplica los 5 por 100. Cada ciclo cobra 0.05. En 0, el agente muere.
          </p>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {life.desks.map((desk) => (
            <div key={desk.id} className="glass w-40 shrink-0 rounded-2xl px-3 py-2">
              <p className="text-xs text-accent">{desk.live ? "En vivo" : "Simulacro"}</p>
              <p className="mt-1 text-sm">{desk.label}</p>
              <p className="mt-1 text-[11px] leading-4 text-muted">{desk.rule}</p>
            </div>
          ))}
        </div>

        <ol className="mt-4 space-y-2">
          {life.log.length === 0 ? (
            <li className="text-sm text-muted">Todavía no actúa. El primer ciclo lo despierta.</li>
          ) : (
            life.log.map((entry) => (
              <li key={entry.at} className="glass rounded-2xl px-3 py-2">
                <p className="text-[10px] tracking-wide text-mint uppercase">{entry.desk}</p>
                <p className="mt-1 text-sm leading-5">{entry.detail}</p>
                <p className="mt-1 text-xs text-muted">
                  {entry.pnl} · vida {entry.balance}
                </p>
              </li>
            ))
          )}
        </ol>
      </main>

      <footer className="px-5 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="mb-2 text-center text-[10px] tracking-[0.16em] text-muted uppercase">
          Motor {life.motor === "lenguaje" ? "AI SDK · Claude" : "política local"}
        </p>
        {dead || ascended ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void act("reset")}
            className="w-full rounded-full bg-accent py-4 text-base font-medium text-background disabled:opacity-50"
          >
            {ascended ? "Otra vida" : "Reencarnar"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => void act("cycle")}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-accent py-4 text-base font-medium text-background disabled:opacity-50"
          >
            {pending ? <DotsLoader /> : null}
            {pending ? "Está operando" : "Ciclo de vida"}
          </button>
        )}
        <button type="button" onClick={onTalk} className="glass mt-3 w-full rounded-full py-3 text-sm">
          Hablar con el agente
        </button>
        {error ? <p className="mt-2 text-center text-xs text-danger">{error}</p> : null}
      </footer>
    </div>
  );
}
