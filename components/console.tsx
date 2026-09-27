"use client";

import { useEffect, useRef, useState } from "react";
import { ChatBubble, CountUp, DotsLoader, VoiceOrb } from "@/components/motion";
import { openSmartWallet, restoreSmartWallet, wantsSmartWallet, type SmartWalletReceipt } from "@/lib/smart-wallet";
import type { AgentResponse, PublicTransaction, Step, WalletView } from "@/lib/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps?: Step[];
  transaction?: AgentResponse["transaction"];
  smartWallet?: SmartWalletReceipt;
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

const PROMPTS = [
  "Crea mi smart wallet",
  "Fondea 25 USD",
  "Cotiza 100 USD",
  "Retira 10 USDC",
  "¿Cuál es mi saldo?",
];

function assetName(asset: string) {
  if (asset.startsWith("iso4217:")) return asset.slice("iso4217:".length);
  return asset.split(":")[1] ?? asset;
}

function Receipt({ transaction }: { transaction: PublicTransaction }) {
  const hash = transaction.stellarTransactionId;
  const short = hash ? `${hash.slice(0, 8)}…${hash.slice(-8)}` : "sin hash todavía";
  const body = (
    <>
      <p className="text-[10px] tracking-[0.18em] text-mint uppercase">Comprobante</p>
      <p className="mt-1 text-sm text-foreground">
        {transaction.kind === "deposit-exchange" ? "Depósito" : "Retiro"} ·{" "}
        {STATUS[transaction.status] ?? transaction.status}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted">Entra</dt>
          <dd>
            {transaction.amountIn} {assetName(transaction.amountInAsset)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Sale</dt>
          <dd>
            {transaction.amountOut} {assetName(transaction.amountOutAsset)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Comisión</dt>
          <dd>{transaction.fee}</dd>
        </div>
        <div>
          <dt className="text-muted">Hash</dt>
          <dd className="font-mono text-[11px]">{short}</dd>
        </div>
      </dl>
      {transaction.explorerUrl ? (
        <p className="mt-3 text-xs text-accent">Abrir en Stellar Expert</p>
      ) : null}
    </>
  );

  const className = "mt-3 block rounded-2xl border border-white/20 bg-black/25 px-3 py-3";
  if (!transaction.explorerUrl) return <div className={className}>{body}</div>;
  return (
    <a className={className} href={transaction.explorerUrl} target="_blank" rel="noreferrer">
      {body}
    </a>
  );
}

function SmartWalletCard({ wallet }: { wallet: SmartWalletReceipt }) {
  const short = `${wallet.contractId.slice(0, 4)}…${wallet.contractId.slice(-4)}`;
  return (
    <a
      className="mt-3 block rounded-2xl border border-white/20 bg-black/25 px-3 py-3"
      href={wallet.explorerUrl}
      target="_blank"
      rel="noreferrer"
    >
      <p className="text-[10px] tracking-[0.18em] text-mint uppercase">Comprobante</p>
      <p className="mt-1 text-sm text-foreground">
        Smart wallet · {wallet.created ? "desplegada" : "ya existía"}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted">Contrato</dt>
          <dd className="font-mono text-[11px]">{short}</dd>
        </div>
        <div>
          <dt className="text-muted">Firma</dt>
          <dd>Passkey</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-accent">Abrir en Stellar Expert</p>
      {wallet.created && !wallet.funded ? (
        <p className="mt-2 text-xs text-muted">El contrato quedó en testnet. Friendbot no acreditó XLM.</p>
      ) : null}
    </a>
  );
}

const STATUS: Record<string, string> = {
  pending_user_transfer_start: "esperando fondos",
  pending_anchor: "el anchor procesa",
  completed: "completada",
  error: "error",
};

function recognitionCtor() {
  if (typeof window === "undefined") return null;
  const vendor = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return vendor.SpeechRecognition ?? vendor.webkitSpeechRecognition ?? null;
}

function money(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function Console({ initialWallet }: { initialWallet: WalletView }) {
  const [wallet, setWallet] = useState(initialWallet);
  const [smartWallet, setSmartWallet] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingLabel, setPendingLabel] = useState("En testnet. La primera vez Friendbot tarda un poco.");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [caption, setCaption] = useState("Pide un depósito, una cotización o un retiro.");
  const scroller = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    let cancelled = false;
    void restoreSmartWallet().then((contractId) => {
      if (!cancelled && contractId) setSmartWallet(contractId);
    });
    return () => {
      cancelled = true;
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
    setPendingLabel(
      wantsSmartWallet(message)
        ? "Confirma el passkey. Con eso se despliega tu smart wallet en testnet."
        : "En testnet. La primera vez Friendbot tarda un poco.",
    );
    setPhase("thinking");
    setCaption(message);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: message }]);
    if (wantsSmartWallet(message)) {
      try {
        const receipt = await openSmartWallet();
        setSmartWallet(receipt.contractId);
        const reply = receipt.created
          ? `Listo. Tu smart wallet quedó desplegada en testnet con un passkey. Contrato ${receipt.contractId}.`
          : `Tu smart wallet ya estaba en este navegador. Contrato ${receipt.contractId}.`;
        setMessages((current) => [
          ...current,
          { id: crypto.randomUUID(), role: "assistant", text: reply, smartWallet: receipt },
        ]);
        setCaption(reply);
        speak(reply);
      } catch (reason) {
        const messageText = reason instanceof Error ? reason.message : "No pude crear la smart wallet.";
        setError(messageText);
        setCaption(messageText);
        setPhase("idle");
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
      return;
    }
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

  const phaseLabel =
    phase === "listening" ? "Escuchando" : phase === "thinking" ? "En testnet" : phase === "speaking" ? "Hablando" : "Listo";
  const quiet = messages.length === 0;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-background sm:border-x sm:border-line">
      <header className="flex items-center justify-between gap-3 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div>
          <p className="font-display text-2xl leading-none text-accent">agenteStellar</p>
          <p className="mt-1 text-xs text-muted">Agente de voz · testnet</p>
          {smartWallet ? (
            <a
              className="mt-1 block font-mono text-[10px] text-accent"
              href={`https://stellar.expert/explorer/testnet/contract/${smartWallet}`}
              target="_blank"
              rel="noreferrer"
            >
              Smart wallet {smartWallet.slice(0, 4)}…{smartWallet.slice(-4)}
            </a>
          ) : null}
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
          <span className="mt-1 block text-[10px] tracking-wide text-muted uppercase">USDC demo</span>
        </a>
      </header>

      <main ref={scroller} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5">
        {quiet ? (
          <div className="flex flex-1 flex-col items-center justify-center pb-6 text-center">
            <VoiceOrb phase={phase} large />
            <p className="mt-2 text-[11px] tracking-[0.2em] text-mint uppercase">{phaseLabel}</p>
            <p className="mt-3 max-w-[16rem] text-base leading-6">{caption}</p>
            <p className="mt-2 text-xs text-muted">
              <CountUp value={money(wallet.xlm)} /> XLM en la cuenta del agente
            </p>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {messages.map((message) => (
              <ChatBubble key={message.id} mine={message.role === "user"}>
                <p className="mb-1 text-[10px] tracking-wide text-muted uppercase">
                  {message.role === "user" ? "Tú" : "agenteStellar"}
                </p>
                <div className={message.role === "user" ? "glass-user rounded-3xl rounded-br-md px-4 py-3" : "glass rounded-3xl rounded-bl-md px-4 py-3"}>
                  <p className="text-sm leading-6 [overflow-wrap:anywhere]">{message.text}</p>
                  {message.steps && message.steps.length > 0 ? (
                    <ol className="mt-3 space-y-1 border-t border-white/10 pt-3">
                      {message.steps.map((step, index) => (
                        <li key={`${message.id}-${index}`} className="text-xs text-muted">
                          <span className="text-accent">{step.sep}</span> {step.title}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {message.transaction ? <Receipt transaction={message.transaction} /> : null}
                  {message.smartWallet ? <SmartWalletCard wallet={message.smartWallet} /> : null}
                </div>
              </ChatBubble>
            ))}
            {pending ? (
              <ChatBubble mine={false}>
                <p className="mb-1 text-[10px] tracking-wide text-muted uppercase">agenteStellar</p>
                <div className="glass flex items-center gap-3 rounded-3xl rounded-bl-md px-4 py-3">
                  <DotsLoader />
                  <p className="text-xs text-muted">{pendingLabel}</p>
                </div>
              </ChatBubble>
            ) : null}
          </div>
        )}
      </main>

      <footer className="px-5 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {quiet ? null : (
          <div className="mb-3 flex items-center gap-3">
            <VoiceOrb phase={phase} />
            <p className="line-clamp-2 min-w-0 flex-1 text-sm text-muted">{caption}</p>
          </div>
        )}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={listen}
            disabled={pending}
            aria-label={phase === "listening" ? "Escuchando" : "Hablar"}
            className="grid h-20 w-20 place-items-center rounded-full bg-accent text-sm font-medium text-background disabled:opacity-50"
          >
            {phase === "listening" ? "···" : "Hablar"}
          </button>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={pending}
              onClick={() => void send(prompt)}
              className="shrink-0 rounded-full border border-line px-3 py-2 text-xs text-muted disabled:opacity-50"
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
            enterKeyHint="send"
            className="glass min-w-0 flex-1 rounded-full px-4 py-3 text-base outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="rounded-full bg-paper-2 px-4 py-3 text-sm disabled:opacity-40"
          >
            Enviar
          </button>
        </form>
        {error ? <p className="mt-2 text-center text-xs text-danger">{error}</p> : null}
      </footer>
    </div>
  );
}
