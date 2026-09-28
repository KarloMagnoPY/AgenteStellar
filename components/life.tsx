"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Tutorial } from "@/components/intro";
import { CountUp } from "@/components/motion";
import { StepPicker } from "@/components/routine-screen";
import type { Mood } from "@/components/creature";
import { stepById, stepMessage, type RoutineItem } from "@/lib/routine";
import type { AgentResponse, FactCard, WalletView } from "@/lib/types";

const Creature = dynamic(() => import("@/components/creature").then((mod) => mod.Creature), {
  ssr: false,
});

type LogLine = { title: string; reply: string; card?: FactCard };

function money(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function LifeScreen({
  wallet,
  items,
  onChange,
  onWallet,
  onTalk,
  onSignOut,
}: {
  wallet: WalletView;
  items: RoutineItem[];
  onChange: (items: RoutineItem[]) => void;
  onWallet: (wallet: WalletView) => void;
  onTalk: () => void;
  onSignOut: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [tour, setTour] = useState(false);
  const [mood, setMood] = useState<Mood>("idle");
  const [line, setLine] = useState("Quieto. Añade un paso y lo corro cuando tú digas.");
  const [running, setRunning] = useState(false);
  const [listening, setListening] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, LogLine>>({});

  useEffect(() => {
    if (localStorage.getItem("agentestellar-tutorial")) return;
    setTour(true);
  }, []);

  function closeTour() {
    localStorage.setItem("agentestellar-tutorial", "1");
    setTour(false);
  }

  async function ask(message: string) {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = (await response.json()) as AgentResponse & { error?: string };
    if (!response.ok) throw new Error(data.error || "No pude actuar.");
    if (data.wallet) onWallet(data.wallet);
    return data;
  }

  async function runAll() {
    if (running || items.length === 0) return;
    setRunning(true);
    setMood("work");
    setResults({});
    try {
      for (const [index, item] of items.entries()) {
        const step = stepById(item.stepId);
        if (!step) continue;
        setActive(item.uid);
        setLine(`${index + 1} de ${items.length} · ${step.title}`);
        try {
          const data = await ask(stepMessage(step, item.input));
          setResults((current) => ({
            ...current,
            [item.uid]: { title: step.title, reply: data.reply, card: data.card },
          }));
        } catch (error) {
          setResults((current) => ({
            ...current,
            [item.uid]: {
              title: step.title,
              reply: error instanceof Error ? error.message : "No pude hacer ese paso.",
            },
          }));
        }
      }
      setLine("Listo. Se queda quieto hasta la próxima vez.");
    } finally {
      setActive(null);
      setMood("idle");
      setRunning(false);
    }
  }

  function listen() {
    const vendor = window as Window & {
      SpeechRecognition?: new () => {
        lang: string;
        onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
    };
    const Ctor = vendor.SpeechRecognition ?? vendor.webkitSpeechRecognition;
    if (!Ctor) {
      setLine("Este navegador no escucha. Escríbele en el chat.");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "es-MX";
    recognition.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? "";
      if (!heard) return;
      setListening(false);
      setMood("talk");
      void ask(heard)
        .then((data) => {
          setLine(data.reply);
          setResults((current) => ({
            ...current,
            voz: { title: heard, reply: data.reply, card: data.card },
          }));
        })
        .catch(() => setLine("No pude cumplir esa orden."))
        .finally(() => setMood("idle"));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    setListening(true);
    setMood("talk");
    recognition.start();
  }

  const status = running ? "Corriendo" : listening ? "En línea" : "Quieto";

  return (
    <div className="rise-screen relative mx-auto flex h-dvh w-full max-w-md flex-col bg-background sm:border-x sm:border-line">
      {tour ? <Tutorial key="tour" onClose={closeTour} /> : null}
      <header className="flex items-start justify-between gap-3 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <div>
          <p className="font-display text-2xl leading-none text-accent">agenteStellar</p>
          <p className="mt-1 text-xs text-muted">Quieto hasta que corras</p>
          <div className="mt-2 flex gap-3">
            <button type="button" onClick={() => setTour(true)} className="text-xs text-cool">
              Tutorial
            </button>
            <button type="button" onClick={onSignOut} className="text-xs text-muted">
              Cerrar sesión
            </button>
          </div>
        </div>
        <a
          className="rounded-2xl bg-paper px-3 py-2 text-right"
          href={`https://stellar.expert/explorer/testnet/account/${wallet.userPublicKey}`}
          target="_blank"
          rel="noreferrer"
        >
          <span className="block font-display text-xl leading-none">
            <CountUp value={money(wallet.usdc)} />
          </span>
          <span className="mt-1 block text-[10px] tracking-wide text-muted uppercase">USDC en la red</span>
        </a>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-3">
        <div className="relative h-56 overflow-hidden rounded-[2rem] border border-line bg-[radial-gradient(circle_at_50%_42%,#243140,transparent_72%)]">
          <Creature mood={mood} />
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.18em] text-cool uppercase">
            {status}
          </p>
        </div>
        <p className="mt-3 text-sm leading-6 text-foreground">{line}</p>
        <ol className="mt-3 space-y-2">
          {items.map((item, index) => {
            const step = stepById(item.stepId);
            const result = results[item.uid];
            const now = active === item.uid;
            return (
              <li
                key={item.uid}
                className={`rounded-2xl border px-3 py-3 ${now ? "border-signal bg-[#2a2418]" : "border-line bg-paper"}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm">
                    <span className="text-signal">{index + 1}. </span>
                    {step?.title ?? "Paso"}
                  </p>
                  {running ? (
                    <p className="shrink-0 text-[10px] tracking-wide text-muted uppercase">
                      {now ? "Ahora" : result ? "Listo" : "En espera"}
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="shrink-0 text-xs text-muted"
                      onClick={() => onChange(items.filter((entry) => entry.uid !== item.uid))}
                    >
                      Quitar
                    </button>
                  )}
                </div>
                {item.input ? <p className="mt-1 truncate font-mono text-[11px] text-muted">{item.input}</p> : null}
                {result ? <p className="mt-2 text-sm leading-6 text-foreground">{result.reply}</p> : null}
                {result?.card ? (
                  <dl className="mt-2 space-y-1">
                    {result.card.rows.map((row) => (
                      <div key={`${row.label}-${row.value}`} className="flex justify-between gap-3 text-xs">
                        <dt className="text-muted">{row.label}</dt>
                        <dd className="max-w-[68%] text-right [overflow-wrap:anywhere]">
                          {row.href ? (
                            <a className="text-cool" href={row.href} target="_blank" rel="noreferrer">
                              {row.value}
                            </a>
                          ) : (
                            row.value
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </li>
            );
          })}
        </ol>
        {adding ? <StepPicker items={items} onChange={onChange} /> : null}
        {results.voz ? (
          <div className="mt-2 rounded-2xl border border-line bg-paper px-3 py-3">
            <p className="text-[10px] tracking-wide text-cool uppercase">Le dijiste</p>
            <p className="mt-1 text-sm">{results.voz.title}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{results.voz.reply}</p>
          </div>
        ) : null}
      </main>

      <footer className="px-5 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {adding ? (
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="mb-2 w-full rounded-full bg-signal py-3 text-sm font-medium text-[#1c1408]"
          >
            {items.length === 0 ? "Ahora no" : "Listo"}
          </button>
        ) : items.length === 0 ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mb-2 w-full rounded-full bg-signal py-3 text-sm font-medium text-[#1c1408]"
          >
            Añadir un paso
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={running}
              onClick={() => void runAll()}
              className="mb-2 w-full rounded-full bg-foreground py-3 text-sm font-medium text-background disabled:opacity-40"
            >
              {running ? "Corriendo…" : "Correr rutina"}
            </button>
            {!running ? (
              <button type="button" onClick={() => setAdding(true)} className="mb-2 w-full py-1 text-sm text-cool">
                Añadir otro paso
              </button>
            ) : null}
          </>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={listen} className="flex-1 rounded-full bg-signal py-3 text-sm font-medium text-[#1c1408]">
            {listening ? "Te escucho" : "Hablarle"}
          </button>
          <button type="button" onClick={onTalk} className="glass flex-1 rounded-full py-3 text-sm">
            Abrir el chat
          </button>
        </div>
      </footer>
    </div>
  );
}
