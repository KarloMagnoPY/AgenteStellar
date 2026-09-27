import type { ReactNode } from "react";
import type { PublicTransaction, WalletView } from "@/lib/types";

export type CanvasKey =
  | "problema"
  | "solucion"
  | "propuesta"
  | "ventaja"
  | "segmentos"
  | "metricas"
  | "canales"
  | "costos"
  | "ingresos";

function money(value: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return number.toLocaleString("es-MX", { maximumFractionDigits: 2 });
}

function Cell({
  id,
  kicker,
  title,
  active,
  className,
  children,
}: {
  id: CanvasKey;
  kicker: string;
  title: string;
  active: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      data-canvas={id}
      className={`min-h-0 overflow-auto rounded-2xl border px-3 py-3 ${
        active
          ? "border-amber bg-paper shadow-[0_0_32px_rgba(228,161,92,0.16)]"
          : "border-line bg-paper/80"
      } ${className ?? ""}`}
    >
      <p className="text-[10px] tracking-[0.16em] text-amber uppercase">{kicker}</p>
      <h2 className="mt-1 font-display text-lg leading-none">{title}</h2>
      <div className="mt-2 text-xs leading-5 text-muted">{children}</div>
    </section>
  );
}

export function LeanCanvas({
  active,
  wallet,
  transaction,
  voice,
}: {
  active: CanvasKey;
  wallet: WalletView;
  transaction: PublicTransaction | null;
  voice: ReactNode;
}) {
  return (
    <div className="grid h-full gap-2 lg:grid-cols-[1.05fr_0.95fr_1.2fr_0.95fr_1.05fr] lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <Cell
        id="problema"
        kicker="01"
        title="Problema"
        active={active === "problema"}
        className="order-2 lg:order-none lg:col-start-1 lg:row-span-2"
      >
        <ul className="space-y-1.5">
          <li>Elegir anchor es opaco: el fee, el país y el KYC no se comparan.</li>
          <li>Un agente no puede rampear si un humano tiene que usar la web del banco.</li>
          <li>El usuario no ve en qué paso del protocolo está el dinero.</li>
        </ul>
      </Cell>

      <Cell
        id="solucion"
        kicker="02"
        title="Solución"
        active={active === "solucion"}
        className="order-3 lg:order-none lg:col-start-2"
      >
        <ul className="space-y-1.5">
          <li>SEP-1 descubre el anchor.</li>
          <li>SEP-10 autentica al agente.</li>
          <li>SEP-38 cotiza y SEP-6 mueve el activo.</li>
        </ul>
        {transaction?.explorerUrl ? (
          <a
            className="mt-2 inline-block text-amber underline underline-offset-2"
            href={transaction.explorerUrl}
            target="_blank"
            rel="noreferrer"
          >
            {transaction.kind === "deposit-exchange" ? "Depósito" : "Retiro"} en Stellar Expert
          </a>
        ) : null}
      </Cell>

      <section
        data-canvas="propuesta"
        className={`order-1 flex min-h-[28rem] flex-col overflow-hidden rounded-3xl border lg:order-none lg:col-start-3 lg:row-span-2 lg:min-h-0 ${
          active === "propuesta"
            ? "border-amber shadow-[0_0_40px_rgba(228,161,92,0.18)]"
            : "border-line"
        } bg-[radial-gradient(circle_at_50%_28%,rgba(228,161,92,0.16),transparent_42%),#1a1713]`}
      >
        <div className="px-4 pt-4">
          <p className="text-[10px] tracking-[0.16em] text-amber uppercase">03 · Propuesta única</p>
          <h2 className="mt-1 font-display text-2xl leading-tight">Di una frase. Entra o sal de Stellar.</h2>
        </div>
        <div className="min-h-0 flex-1">{voice}</div>
      </section>

      <Cell
        id="ventaja"
        kicker="04"
        title="Ventaja injusta"
        active={active === "ventaja"}
        className="order-4 lg:order-none lg:col-start-4"
      >
        <ul className="space-y-1.5">
          <li>El agente firma SEP-10 solo.</li>
          <li>Cada paso del protocolo queda escrito.</li>
          <li>El hash de testnet se puede abrir al momento.</li>
        </ul>
      </Cell>

      <Cell
        id="segmentos"
        kicker="05"
        title="Segmentos"
        active={active === "segmentos"}
        className="order-5 lg:order-none lg:col-start-5 lg:row-span-2"
      >
        <ul className="space-y-1.5">
          <li>Agentes de IA que necesitan USDC.</li>
          <li>Wallets y fintechs en Latinoamérica.</li>
          <li>Equipos que integran un anchor en un hackathon.</li>
        </ul>
        <p className="mt-3">
          Anchor{" "}
          <a
            className="font-mono text-foreground underline decoration-line underline-offset-2"
            href={`https://stellar.expert/explorer/testnet/account/${wallet.anchorPublicKey}`}
            target="_blank"
            rel="noreferrer"
          >
            {wallet.anchorPublicKey.slice(0, 5)}…{wallet.anchorPublicKey.slice(-4)}
          </a>
        </p>
        <a className="mt-1 inline-block text-amber underline underline-offset-2" href="/.well-known/stellar.toml">
          stellar.toml
        </a>
      </Cell>

      <Cell
        id="metricas"
        kicker="06"
        title="Métricas clave"
        active={active === "metricas"}
        className="order-6 lg:order-none lg:col-start-2"
      >
        <dl className="grid grid-cols-2 gap-2">
          <div>
            <dt>USDC demo</dt>
            <dd className="font-display text-xl text-foreground">{money(wallet.usdc)}</dd>
          </div>
          <div>
            <dt>XLM</dt>
            <dd className="font-display text-xl text-foreground">{money(wallet.xlm)}</dd>
          </div>
        </dl>
        <p className="mt-2">
          <a
            className="font-mono text-foreground underline decoration-line underline-offset-2"
            href={`https://stellar.expert/explorer/testnet/account/${wallet.userPublicKey}`}
            target="_blank"
            rel="noreferrer"
          >
            {wallet.userPublicKey.slice(0, 5)}…{wallet.userPublicKey.slice(-4)}
          </a>
          {wallet.funded ? " · en testnet" : " · se crea con el primer pedido"}
        </p>
      </Cell>

      <Cell
        id="canales"
        kicker="07"
        title="Canales"
        active={active === "canales"}
        className="order-7 lg:order-none lg:col-start-4"
      >
        <ul className="space-y-1.5">
          <li>Voz en el navegador.</li>
          <li>Texto, si el micrófono no está.</li>
          <li>El anchor se descubre por stellar.toml.</li>
        </ul>
      </Cell>

      <Cell
        id="costos"
        kicker="08"
        title="Estructura de costos"
        active={active === "costos"}
        className="order-8 lg:order-none lg:col-span-2"
      >
        Liquidez del anchor, fee de red casi nulo en testnet, y KYC más banca el día que salga del demo.
      </Cell>

      <Cell
        id="ingresos"
        kicker="09"
        title="Fuentes de ingreso"
        active={active === "ingresos"}
        className="order-9 lg:order-none lg:col-span-3"
      >
        1% en cada cotización SEP-38. El spread del on-ramp y del off-ramp es el negocio del anchor.
      </Cell>
    </div>
  );
}
