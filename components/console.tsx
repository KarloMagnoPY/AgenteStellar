"use client";

import { useEffect, useRef, useState } from "react";
import { LeanCanvas, type CanvasKey } from "@/components/lean-canvas";
import type { AgentResponse, Step, WalletView } from "@/lib/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps?: Step[];
  transaction?: AgentResponse["transaction"];
  mode?: AgentResponse["mode"];
};

type Phase = "idle" | "listening" | "thinking" | "speaking";

type SpeechResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechResultList = {
  length: number;
  [index: number]: SpeechResult;
};

type SpeechEvent = { results: SpeechResultList };

type BrowserRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type RecognitionCtor = new () => BrowserRecognition;

const PROMPTS = ["Fondea 25 USD", "Cotiza 100 USD", "Retira 10 USDC", "¿Cuál es mi saldo?"];

function recognitionCtor() {
  if (typeof window === "undefined") return null;
  const vendor = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return vendor.SpeechRecognition ?? vendor.webkitSpeechRecognition ?? null;
}

function highlightFor(phase: Phase, message?: ChatMessage): CanvasKey {
  if (phase === "listening") return "canales";
  if (phase === "thinking") return "solucion";
  if (phase === "speaking") return "propuesta";
  const step = message?.steps?.at(-1);
  if (message?.transaction?.status === "completed") return "metricas";
  if (step?.sep === "SEP-38") return "ingresos";
  if (step?.sep === "SEP-10") return "ventaja";
  if (step?.sep === "SEP-1") return "canales";
  if (step?.sep === "SEP-6") return "solucion";
  return "propuesta";
}

function Orb({ phase }: { phase: Phase }) {
  const live = phase === "listening" || phase === "speaking";
  return (
    <div className="relative mx-auto grid h-36 w-36 place-items-center">
      {live ? (
        <>
          <span className="goya-ring absolute inset-0 rounded-full border border-amber/70" />
          <span className="goya-ring absolute inset-0 rounded-full border border-mint/50 [animation-delay:0.6s]" />
        </>
      ) : null}
      <span
        className={`relative h-24 w-24 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff4e4,#e4a15c_42%,#8a4b22_72%,#24180f)] shadow-[0_0_36px_rgba(228,161,92,0.45)] ${
          live ? "goya-orb-live" : "goya-orb"
        }`}
      />
      <span className="pointer-events-none absolute bottom-1 flex h-8 items-end gap-1">
        {Array.from({ length: 9 }, (_, index) => (
          <span
            key={index}
            className={`goya-bar w-0.5 rounded-full bg-foreground/80 ${live ? "h-5" : "h-2"}`}
            style={{ animationDelay: `${index * 0.08}s`, animationPlayState: live ? "running" : "paused" }}
          />
        ))}
      </span>
    </div>
  );
}

export function Console({ initialWallet }: { initialWallet: WalletView }) {
  const [wallet, setWallet] = useState(initialWallet);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [caption, setCaption] = useState("Toca el micrófono y pide un depósito, una cotización o un retiro.");
  const scroller = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  function speak(text: string) {
    if (!window.speechSynthesis) {
      setPhase("idle");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-MX";
    utterance.onend = () => setPhase("idle");
    utterance.onerror = () => setPhase("idle");
    setPhase("speaking");
    window.speechSynthesis.speak(utterance);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || pendingRef.current) return;
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    pendingRef.current = true;
    setDraft("");
    setError("");
    setPending(true);
    setPhase("thinking");
    setCaption(message);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: message }]);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await response.json()) as AgentResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "El agente falló.");
      if (data.wallet) setWallet(data.wallet);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: data.reply,
          steps: data.steps,
          transaction: data.transaction,
          mode: data.mode,
        },
      ]);
      setCaption(data.reply);
      speak(data.reply);
    } catch (reason) {
      const messageText = reason instanceof Error ? reason.message : "El agente falló.";
      setError(messageText);
      setCaption(messageText);
      setPhase("idle");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  function listen() {
    if (pendingRef.current) return;
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setError("Este navegador no expone reconocimiento de voz. Escribe la orden.");
      document.getElementById("order")?.focus();
      return;
    }
    window.speechSynthesis?.cancel();
    const recognition = new Ctor();
    recognition.lang = "es-MX";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let heard = "";
      for (let index = 0; index < event.results.length; index += 1) {
        heard += event.results[index][0].transcript;
      }
      setDraft(heard);
      setCaption(heard);
      const last = event.results[event.results.length - 1];
      if (last?.isFinal) void send(heard);
    };
    recognition.onerror = () => {
      setPhase("idle");
      setError("No pude escuchar. Revisa el permiso del micrófono o escribe la orden.");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setPhase((current) => (current === "listening" ? "idle" : current));
    };
    recognitionRef.current = recognition;
    setError("");
    setPhase("listening");
    setCaption("Te escucho.");
    recognition.start();
  }

  const latest = [...messages].reverse().find((message) => message.role === "assistant");
  const phaseLabel =
    phase === "listening" ? "Escuchando" : phase === "thinking" ? "En testnet" : phase === "speaking" ? "Hablando" : "En espera";

  const voice = (
    <div className="flex h-full min-h-0 flex-col px-4 pb-4">
      <Orb phase={phase} />
      <p className="mt-2 text-center text-[10px] tracking-[0.18em] text-mint uppercase">{phaseLabel}</p>
      <p className="mt-2 line-clamp-3 text-center text-sm text-foreground">{caption}</p>
      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={listen}
          disabled={pending}
          className="rounded-full bg-amber px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {phase === "listening" ? "Escuchando…" : "Hablar"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={pending}
            onClick={() => void send(prompt)}
            className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted hover:border-amber hover:text-foreground disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <label className="sr-only" htmlFor="order">
          Instrucción para el agente
        </label>
        <input
          id="order"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="O escríbela"
          disabled={pending}
          maxLength={500}
          className="min-w-0 flex-1 rounded-full border border-line bg-background/50 px-3 py-2 text-sm outline-none focus:border-amber"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="rounded-full border border-line px-3 py-2 text-sm disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
      {error ? <p className="mt-2 text-center text-xs text-danger">{error}</p> : null}
      <div ref={scroller} className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {messages.map((message) => (
          <article key={message.id}>
            <p className="text-[10px] tracking-wide text-muted uppercase">
              {message.role === "user" ? "Tú" : "Goya"}
            </p>
            <p className="text-xs leading-5">{message.text}</p>
            {message.steps && message.steps.length > 0 ? (
              <ol className="mt-1 space-y-1">
                {message.steps.map((step, index) => (
                  <li key={`${message.id}-${index}`} className="text-[11px] text-muted">
                    <span className="text-amber">{step.sep}</span> {step.title}
                  </li>
                ))}
              </ol>
            ) : null}
          </article>
        ))}
        {pending ? (
          <p className="text-[11px] text-muted">La primera vez Friendbot crea las cuentas y tarda un poco.</p>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col px-3 py-3 lg:px-4">
      <header className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-3xl leading-none text-amber">Goya</p>
          <p className="mt-1 text-sm text-muted">Lean Canvas de un agente de voz sobre anchors de Stellar</p>
        </div>
        <p className="rounded-full border border-line px-3 py-1 text-[10px] tracking-[0.16em] text-mint uppercase">
          Testnet
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <LeanCanvas
          active={highlightFor(phase, latest)}
          wallet={wallet}
          transaction={latest?.transaction ?? null}
          voice={voice}
        />
      </div>
    </div>
  );
}
