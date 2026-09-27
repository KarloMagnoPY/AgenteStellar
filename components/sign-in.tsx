"use client";

import { useState } from "react";
import { DotsLoader, VoiceOrb } from "@/components/motion";
import { connectSmartWallet, openSmartWallet, type SmartWalletReceipt } from "@/lib/smart-wallet";

export function SignIn({
  checking,
  onEnter,
}: {
  checking?: boolean;
  onEnter: (receipt: SmartWalletReceipt) => void;
}) {
  const [busy, setBusy] = useState<"create" | "connect" | null>(null);
  const [error, setError] = useState("");

  async function run(mode: "create" | "connect") {
    if (busy || checking) return;
    setBusy(mode);
    setError("");
    try {
      onEnter(mode === "create" ? await openSmartWallet() : await connectSmartWallet());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pude iniciar sesión.");
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-background px-6 sm:border-x sm:border-line">
      <header className="pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="font-display text-3xl leading-none text-accent">agenteStellar</p>
        <p className="mt-2 text-xs tracking-[0.18em] text-muted uppercase">Iniciar sesión · testnet</p>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center text-center">
        <VoiceOrb phase={checking || busy ? "thinking" : "idle"} large />
        <h1 className="mt-4 font-display text-3xl leading-tight">Tu cuenta es un passkey</h1>
        <p className="mt-3 max-w-[18rem] text-sm leading-6 text-muted">
          {checking
            ? "Buscando la smart wallet de este dispositivo."
            : "Si este dispositivo ya tiene un passkey, se usa ese. Solo se crea uno la primera vez, y no hay contraseña."}
        </p>
        {busy ? (
          <div className="glass mt-6 flex items-center gap-3 rounded-full px-4 py-3">
            <DotsLoader />
            <p className="text-left text-xs text-muted">
              {busy === "create"
                ? "Busco el passkey de este dispositivo. Si la cuenta no está en testnet, la despliego con ese mismo."
                : "Elige el passkey de agenteStellar. No voy a crear otro."}
            </p>
          </div>
        ) : null}
      </main>

      <footer className="pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={checking || busy !== null}
          onClick={() => void run("create")}
          className="w-full rounded-full bg-accent py-4 text-base font-medium text-background disabled:opacity-50"
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          disabled={checking || busy !== null}
          onClick={() => void run("connect")}
          className="glass mt-3 w-full rounded-full py-3 text-sm disabled:opacity-50"
        >
          Ya tengo un passkey
        </button>
        {error ? <p className="mt-3 text-center text-xs text-danger">{error}</p> : null}
      </footer>
    </div>
  );
}
