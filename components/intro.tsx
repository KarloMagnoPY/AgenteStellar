"use client";

import { animate } from "animejs";
import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    title: "Está quieto",
    body: "Al entrar no opera. Espera a que tú le pongas una rutina.",
  },
  {
    title: "Añade un paso",
    body: "Revisar lee saldo, wallets y contratos. Mercado solo mira cifras. Operar sí usa el anchor de la demo.",
  },
  {
    title: "Corre cuando tú digas",
    body: "Correr rutina hace esos pasos en orden y se detiene. No sigue solo.",
  },
  {
    title: "Voz y chat",
    body: "Hablarle enciende el micrófono. El chat usa los mismos nombres. Nada se lee en voz alta.",
  },
];

export function Startup({ onDone }: { onDone: () => void }) {
  const done = useRef(onDone);
  const [leaving, setLeaving] = useState(false);
  done.current = onDone;

  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), 1600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => done.current(), 280);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  return (
    <button
      type="button"
      onClick={() => setLeaving(true)}
      className={`absolute inset-0 z-30 flex flex-col items-center justify-center bg-background px-8 text-center transition-opacity duration-300 ${leaving ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <span className="boot-ring mb-6 h-16 w-16 rounded-full border border-signal" />
      <p className="boot-mark font-display text-4xl leading-none text-accent">agenteStellar</p>
      <p className="boot-mark boot-d1 mt-3 text-xs tracking-[0.22em] text-muted uppercase">Testnet</p>
      <p className="boot-mark boot-d2 mt-8 text-sm text-foreground">Un agente quieto hasta que tú lo corras.</p>
      <p className="boot-mark boot-d3 absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] text-xs text-cool">
        Toca para seguir
      </p>
    </button>
  );
}

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  useEffect(() => {
    const node = card.current;
    if (!node) return;
    const animation = animate(node, {
      opacity: [0, 1],
      y: [18, 0],
      duration: 380,
      ease: "outCubic",
    });
    return () => {
      animation.revert();
    };
  }, [step]);

  return (
    <div className="absolute inset-0 z-20 flex items-end bg-black/45 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div ref={card} className="glass w-full rounded-3xl px-4 py-4">
        <p className="text-[10px] tracking-[0.18em] text-signal uppercase">
          Tutorial {step + 1} de {STEPS.length}
        </p>
        <h2 className="mt-2 font-display text-2xl leading-none">{current.title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{current.body}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {STEPS.map((item, index) => (
              <span key={item.title} className={`h-1.5 w-4 rounded-full ${index === step ? "bg-signal" : "bg-line"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-full px-3 py-2 text-sm text-muted">
              Saltar
            </button>
            <button
              type="button"
              onClick={() => (last ? onClose() : setStep((value) => value + 1))}
              className="rounded-full bg-signal px-4 py-2 text-sm font-medium text-[#1c1408]"
            >
              {last ? "Entendido" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
