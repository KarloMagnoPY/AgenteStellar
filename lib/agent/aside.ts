import { AnchorError } from "../errors";
import { daySentence, lifeReply, lifeView, runCycle } from "../life";
import { fromCents, parseAmount } from "../money";
import { getState } from "../store";
import type { AgentResponse, FactCard } from "../types";
import { walletView } from "../wallet";
import type { Intent } from "./intent";

function assetName(asset: string) {
  if (asset.startsWith("iso4217:")) return asset.slice("iso4217:".length);
  return asset.split(":")[1] ?? asset;
}

function shortKey(key: string) {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function money(amount: string, places = 2) {
  const negative = amount.startsWith("-");
  const [whole, frac = ""] = amount.replace("-", "").split(".");
  return `${negative ? "-" : ""}${whole}.${(frac + "0".repeat(places)).slice(0, places)}`;
}

const STATUS: Record<string, string> = {
  pending_user_transfer_start: "esperando fondos",
  pending_anchor: "el anchor procesa",
  completed: "completado",
  error: "con error",
};

export type AsideIntent = Extract<
  Intent,
  | { type: "life" }
  | { type: "cycle" }
  | { type: "history" }
  | { type: "accounts" }
  | { type: "fee" }
  | { type: "balance" }
>;

function pack(
  wallet: AgentResponse["wallet"],
  reply: string,
  extra: Partial<AgentResponse> = {},
): AgentResponse {
  return { mode: "protocol", reply, steps: [], transaction: null, wallet, ...extra };
}

export async function answerAside(origin: string, intent: AsideIntent): Promise<AgentResponse> {
  const wallet = await walletView();

  if (intent.type === "balance") {
    const card: FactCard = {
      title: "Saldo en testnet",
      rows: [
        { label: "USDC de prueba", value: money(wallet.usdc) },
        { label: "XLM", value: money(wallet.xlm, 4) },
        {
          label: "Cuenta",
          value: shortKey(wallet.userPublicKey),
          href: `https://stellar.expert/explorer/testnet/account/${wallet.userPublicKey}`,
        },
      ],
    };
    return pack(
      wallet,
      `Hay ${money(wallet.usdc)} USDC de prueba y ${money(wallet.xlm, 4)} XLM. El USDC lo emite el anchor de esta demo.`,
      { card },
    );
  }

  if (intent.type === "accounts") {
    const card: FactCard = {
      title: "Cuentas",
      rows: [
        {
          label: "Agente",
          value: shortKey(wallet.userPublicKey),
          href: `https://stellar.expert/explorer/testnet/account/${wallet.userPublicKey}`,
        },
        {
          label: "Anchor",
          value: shortKey(wallet.anchorPublicKey),
          href: `https://stellar.expert/explorer/testnet/account/${wallet.anchorPublicKey}`,
        },
        { label: "USDC", value: "Lo emite el anchor, no Circle" },
      ],
    };
    return pack(wallet, "La cuenta del agente firma los pagos. El anchor emite el USDC de prueba.", { card });
  }

  if (intent.type === "fee") {
    try {
      const sell = parseAmount(intent.amount);
      const fee = Math.max(1, Math.round((sell * 100) / 10_000));
      const buy = sell - fee;
      const card: FactCard = {
        title: "Comisión del 1 %",
        rows: [
          { label: "Entras", value: `${fromCents(sell)} USD` },
          { label: "Comisión", value: `${fromCents(fee)} USD` },
          { label: "Recibes", value: `${fromCents(buy)} USDC` },
        ],
      };
      return pack(
        wallet,
        `Por ${fromCents(sell)} USD el anchor cobra ${fromCents(fee)} y entrega ${fromCents(buy)} USDC. Esta cuenta no mueve la red.`,
        { card },
      );
    } catch (error) {
      const reply = error instanceof AnchorError ? error.message : "No pude calcular la comisión.";
      return pack(wallet, reply);
    }
  }

  if (intent.type === "history") {
    const state = await getState();
    const rows = Object.values(state.transactions)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 4);
    if (!rows.length) {
      return pack(wallet, "Todavía no hay depósitos ni retiros. Prueba «Fondea 25 USD».");
    }
    const card: FactCard = {
      title: "Movimientos",
      rows: rows.map((tx) => {
        const name = tx.kind === "deposit-exchange" ? "Depósito" : "Retiro";
        const stateLabel = STATUS[tx.status] ?? tx.status;
        return {
          label: name,
          value: `${tx.amountIn} ${assetName(tx.amountInAsset)} → ${tx.amountOut} ${assetName(tx.amountOutAsset)} · ${stateLabel}`,
          href: tx.stellarTransactionId
            ? `https://stellar.expert/explorer/testnet/tx/${tx.stellarTransactionId}`
            : undefined,
        };
      }),
    };
    return pack(wallet, `Van ${rows.length} movimientos en el anchor. Cada renglón abre el comprobante.`, { card });
  }

  const life = intent.type === "cycle" ? await runCycle(origin) : await lifeView();
  const last = life.log[0];
  const reply = intent.type === "cycle" && last ? `${daySentence(last)} ${lifeReply(life)}` : lifeReply(life);
  const card: FactCard = {
    title: intent.type === "cycle" ? "Día vivido" : "La vida",
    rows: [
      { label: "Saldo", value: life.balance },
      { label: "Día", value: String(life.cycles) },
      { label: "Meta", value: life.target },
      { label: "Estado", value: life.status === "alive" ? "Vivo" : life.status === "dead" ? "Murió" : "Llegó" },
    ],
  };
  return pack(wallet, reply, { life, card });
}
