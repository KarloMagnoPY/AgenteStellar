import { daySentence, lifeReply, lifeView, runCycle } from "../life";
import { getState } from "../store";
import type { AgentResponse } from "../types";
import { walletView } from "../wallet";

function assetName(asset: string) {
  if (asset.startsWith("iso4217:")) return asset.slice("iso4217:".length);
  return asset.split(":")[1] ?? asset;
}

const STATUS: Record<string, string> = {
  pending_user_transfer_start: "esperando fondos",
  pending_anchor: "el anchor procesa",
  completed: "completado",
  error: "con error",
};

export async function answerAside(
  origin: string,
  kind: "life" | "cycle" | "history",
): Promise<AgentResponse> {
  const wallet = await walletView();
  if (kind === "history") {
    const state = await getState();
    const rows = Object.values(state.transactions)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 4);
    const reply = rows.length
      ? rows
          .map((tx) => {
            const name = tx.kind === "deposit-exchange" ? "Depósito" : "Retiro";
            const stateLabel = STATUS[tx.status] ?? tx.status;
            return `${name} ${stateLabel}: entran ${tx.amountIn} ${assetName(tx.amountInAsset)} y salen ${tx.amountOut} ${assetName(tx.amountOutAsset)}. Comisión ${tx.amountFee}.`;
          })
          .join(" ")
      : "Todavía no hay depósitos ni retiros. Prueba «Fondea 25 USD».";
    return { mode: "protocol", reply, steps: [], transaction: null, wallet };
  }

  const life = kind === "cycle" ? await runCycle(origin) : await lifeView();
  const last = life.log[0];
  const reply =
    kind === "cycle" && last
      ? `${daySentence(last)} ${lifeReply(life)}`
      : lifeReply(life);
  return { mode: "protocol", reply, steps: [], transaction: null, wallet, life };
}
