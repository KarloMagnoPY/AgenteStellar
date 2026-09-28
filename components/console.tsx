"use client";

import { useEffect, useRef, useState } from "react";
import { AGENT_ACTIONS, ActionButton, type AgentAction } from "@/components/actions";
import { LifeScreen } from "@/components/life";
import { stepById, type RoutineItem } from "@/lib/routine";
import { ChatBubble, CountUp, DotsLoader, VoiceOrb } from "@/components/motion";
import { SignIn } from "@/components/sign-in";
import { leaveSmartWallet, openSmartWallet, wantsSmartWallet, type SmartWalletReceipt } from "@/lib/smart-wallet";
import type { AgentResponse, FactCard, PublicTransaction, Step, WalletView } from "@/lib/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps?: Step[];
  transaction?: AgentResponse["transaction"];
  smartWallet?: SmartWalletReceipt;
  card?: FactCard;
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

function FactSheet({ card }: { card: FactCard }) {
  return (
    <div className="mt-3 rounded-2xl border border-white/20 bg-black/25 px-3 py-3">
      <p className="text-[10px] tracking-[0.18em] text-mint uppercase">{card.title}</p>
      <dl className="mt-2 space-y-2">
        {card.rows.map((row) => (
          <div key={`${row.label}-${row.value}`} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="shrink-0 text-muted">{row.label}</dt>
            <dd className="text-right [overflow-wrap:anywhere]">
              {row.href ? (
                <a className="text-accent" href={row.href} target="_blank" rel="noreferrer">
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
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
  const [surface, setSurface] = useState<"vida" | "voz">("vida");
  const [routine, setRoutine] = useState<RoutineItem[]>([]);
  const [routineReady, setRoutineReady] = useState(false);
  const [gate, setGate] = useState<"checking" | "out" | "in">("out");
  const [smartWallet, setSmartWallet] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingLabel, setPendingLabel] = useState("En testnet. La primera vez Friendbot tarda un poco.");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [caption, setCaption] = useState("No actúa solo. Revisa, lee el mercado o opera en la demo.");
  const scroller = useRef<HTMLDivElement>(null);
  const orderRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    const raw = localStorage.getItem("agentestellar-routine");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as RoutineItem[];
        if (Array.isArray(parsed)) {
          setRoutine(parsed.filter((item) => item && stepById(item.stepId)));
        }
      } catch {
        setRoutine([]);
      }
    }
    setRoutineReady(true);
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!routineReady) return;
    localStorage.setItem("agentestellar-routine", JSON.stringify(routine));
  }, [routine, routineReady]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pendingRef.current) return;
    recognitionRef.current?.stop();
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
        setPhase("idle");
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
          card: data.card,
          mode: data.mode,
        },
      ]);
      setCaption(data.reply);
      setPhase("idle");
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

  function enter(receipt: SmartWalletReceipt) {
    setSmartWallet(receipt.contractId);
    setError("");
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: receipt.created
          ? `Sesión abierta. Tu smart wallet quedó desplegada en testnet. Contrato ${receipt.contractId}.`
          : `Sesión abierta con la smart wallet de este dispositivo. Contrato ${receipt.contractId}.`,
        smartWallet: receipt,
      },
    ]);
    setCaption("No actúa solo. Revisa, lee el mercado o opera en la demo.");
    setSurface("vida");
    setGate("in");
  }

  function signOut() {
    recognitionRef.current?.stop();
    void leaveSmartWallet();
    setSmartWallet(null);
    setMessages([]);
    setDraft("");
    setError("");
    setPhase("idle");
    setGate("out");
  }

  if (gate !== "in") {
    return <SignIn checking={gate === "checking"} onEnter={enter} />;
  }

  function pick(action: AgentAction) {
    if (action.fill) {
      setDraft(action.label);
      setCaption(action.id === "wallet" ? "Pega la cuenta G… y envía." : "Pega el contrato C… y envía.");
      requestAnimationFrame(() => orderRef.current?.focus());
      return;
    }
    void send(action.label);
  }

  if (surface === "vida") {
    return (
      <LifeScreen
        wallet={wallet}
        items={routine}
        onChange={setRoutine}
        onWallet={setWallet}
        onTalk={() => setSurface("voz")}
        onSignOut={signOut}
      />
    );
  }

  const phaseLabel =
    phase === "listening" ? "Escuchando" : phase === "thinking" ? "En testnet" : phase === "speaking" ? "Hablando" : "Listo";
  const quiet = messages.length === 0;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-background sm:border-x sm:border-line">
      <header className="flex items-start justify-between gap-3 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div>
          <p className="font-display text-2xl leading-none text-accent">agenteStellar</p>
          <button
            type="button"
            onClick={() => setSurface("vida")}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2.5 text-sm font-medium text-[#1c1408]"
          >
            <span aria-hidden="true">←</span>
            Volver al agente
          </button>
          <button type="button" onClick={signOut} className="mt-2 block text-xs text-muted">
            Cerrar sesión
          </button>
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
          <span className="mt-1 block text-[10px] text-muted">{Number(wallet.xlm).toFixed(2)} XLM</span>
        </a>
      </header>

      <main ref={scroller} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5">
        {quiet ? (
          <div className="flex flex-1 flex-col pb-4">
            <div className="flex items-center gap-3 py-4">
              <VoiceOrb phase={phase} />
              <div className="min-w-0 text-left">
                <p className="text-[10px] tracking-[0.18em] text-signal uppercase">{phaseLabel}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{caption}</p>
              </div>
            </div>
            {(["Revisar", "Operar"] as const).map((group) => (
              <section key={group} className="mt-2">
                <h2 className="text-[10px] tracking-[0.18em] text-muted uppercase">{group}</h2>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {AGENT_ACTIONS.filter((action) => action.group === group).map((action) => (
                    <ActionButton
                      key={action.id}
                      action={action}
                      disabled={pending}
                      onClick={() => pick(action)}
                      variant="card"
                    />
                  ))}
                </div>
              </section>
            ))}
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
                  {message.card ? <FactSheet card={message.card} /> : null}
                  {message.steps && message.steps.length > 0 ? (
                    <details className="mt-3 border-t border-white/10 pt-2">
                      <summary className="cursor-pointer text-xs text-accent">Pasos del anchor</summary>
                      <ol className="mt-2 space-y-1">
                        {message.steps.map((step, index) => (
                          <li key={`${message.id}-${index}`} className="text-xs text-muted">
                            <span className="text-accent">{step.sep}</span> {step.title}
                          </li>
                        ))}
                      </ol>
                    </details>
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
          <div className="mb-2 flex items-center gap-3">
            <VoiceOrb phase={phase} />
            <p className="line-clamp-2 min-w-0 flex-1 text-sm text-muted">{caption}</p>
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
          {AGENT_ACTIONS.map((action) => (
            <ActionButton
              key={action.id}
              action={action}
              disabled={pending}
              onClick={() => pick(action)}
              variant="chip"
            />
          ))}
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <button
            type="button"
            onClick={listen}
            disabled={pending}
            aria-label={phase === "listening" ? "Escuchando" : "Hablar"}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-signal text-xs font-medium text-[#1c1408] disabled:opacity-50"
          >
            {phase === "listening" ? "···" : "Voz"}
          </button>
          <label className="sr-only" htmlFor="order">
            Instrucción para el agente
          </label>
          <input
            id="order"
            ref={orderRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escribe o habla"
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
        {smartWallet ? (
          <a
            className="mt-2 block text-center font-mono text-[10px] text-accent"
            href={`https://stellar.expert/explorer/testnet/contract/${smartWallet}`}
            target="_blank"
            rel="noreferrer"
          >
            Smart wallet {smartWallet.slice(0, 4)}…{smartWallet.slice(-4)}
          </a>
        ) : null}
        {error ? <p className="mt-2 text-center text-xs text-danger">{error}</p> : null}
      </footer>
    </div>
  );
}
