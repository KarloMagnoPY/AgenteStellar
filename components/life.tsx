"use client";

import { useState } from "react";
import { CountUp, DotsLoader, VoiceOrb } from "@/components/motion";
import { daySentence } from "@/lib/life-copy";
import type { LifeView } from "@/lib/life";

function money(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

const STEPS = [
  "Cobra 0.05 por seguir vivo.",
  "Elige una sola mesa y arriesga cerca de un cuarto del saldo.",
  "Ese resultado se suma o se resta. En 0 muere. En 500 llega.",
];

const LEGEND = [
  { name: "Anchor", note: "En la red. Solo cotiza. El día cobra 0.05." },
  { name: "Trading", note: "Práctica. Puede perder la puesta o multiplicarla." },
  { name: "Préstamo", note: "Práctica. Casi siempre deja un interés chico." },
  { name: "Perpetuos", note: "Práctica. Gana o pierde el doble de la puesta." },
  { name: "Predicciones", note: "Práctica. Duplica la puesta o la pierde." },
];

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
  const balance = money(life.balance);
  const left = Math.max(0, money(life.target) - balance);
  const progress = Math.min(100, (balance / money(life.target)) * 100);
  const dead = life.status === "dead";
  const ascended = life.status === "ascended";
  const phase = pending ? "thinking" : dead ? "idle" : "speaking";
  const latest = life.log[0];
  const older = life.log.slice(1, 4);

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
          <p className="mt-1 text-xs text-muted">La vida del agente</p>
          <button type="button" onClick={onSignOut} className="mt-1 text-[10px] tracking-wide text-muted uppercase">
            Cerrar sesión
          </button>
        </div>
        <div className="rounded-2xl bg-paper px-3 py-2 text-right">
          <span className="block font-display text-xl leading-none">Día {life.cycles}</span>
          <span className="mt-1 block text-[10px] tracking-wide text-muted uppercase">
            {dead ? "murió" : ascended ? "llegó" : "vivo"}
          </span>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-4">
        <div className="flex flex-col items-center text-center">
          <VoiceOrb phase={phase} />
          <p className="mt-2 font-display text-5xl leading-none">
            <CountUp value={balance} />
          </p>
          <p className="mt-2 text-sm text-muted">
            Nació con {life.start}. La meta es {life.target}. Lleva {life.multiple}× de 100×.
          </p>
          <p className="mt-1 text-sm">Faltan {left.toFixed(2)} para llegar.</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-paper-2" aria-hidden>
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <section className="glass mt-4 rounded-3xl px-4 py-3">
          <p className="text-[10px] tracking-[0.16em] text-mint uppercase">Un día hace esto</p>
          <ol className="mt-2 space-y-2">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-5">
                <span className="font-display text-accent">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-4">
          <p className="text-[10px] tracking-[0.16em] text-muted uppercase">Hoy</p>
          {latest ? (
            <p className="glass mt-2 rounded-3xl px-4 py-3 text-sm leading-6">{daySentence(latest)}</p>
          ) : (
            <p className="glass mt-2 rounded-3xl px-4 py-3 text-sm leading-6 text-muted">
              Todavía no ha vivido un día. El botón de abajo lo despierta.
            </p>
          )}
          {older.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {older.map((entry) => (
                <li key={entry.at} className="text-xs leading-5 text-muted">
                  {daySentence(entry)}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="mt-4">
          <p className="text-[10px] tracking-[0.16em] text-muted uppercase">Mesas</p>
          <ul className="mt-2 space-y-2">
            {LEGEND.map((desk) => (
              <li key={desk.name} className="flex gap-3 text-sm leading-5">
                <span className="w-24 shrink-0 text-accent">{desk.name}</span>
                <span className="text-muted">{desk.note}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="px-5 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {dead || ascended ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void act("reset")}
            className="w-full rounded-full bg-accent py-4 text-base font-medium text-background disabled:opacity-50"
          >
            {ascended ? "Empezar otra vida" : "Nacer de nuevo"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => void act("cycle")}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-accent py-4 text-base font-medium text-background disabled:opacity-50"
          >
            {pending ? <DotsLoader /> : null}
            {pending ? "Viviendo el día" : "Vivir un día"}
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
