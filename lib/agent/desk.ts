import { describeAccount, describeContract } from "../look";
import { marketCard, marketIndexCard, marketIndexReply, marketReply, PROTOCOLS } from "../market";
import type { AgentResponse } from "../types";
import { walletView } from "../wallet";
import type { Intent } from "./intent";

export type DeskIntent = Extract<Intent, { type: "wallet" } | { type: "contract" } | { type: "market" }>;

function pack(wallet: AgentResponse["wallet"], reply: string, card: AgentResponse["card"]): AgentResponse {
  return { mode: "protocol", reply, steps: [], transaction: null, wallet, card };
}

export async function answerDesk(intent: DeskIntent): Promise<AgentResponse> {
  const wallet = await walletView();
  if (intent.type === "wallet") {
    const looked = await describeAccount(intent.id);
    return pack(wallet, looked.reply, looked.card);
  }
  if (intent.type === "contract") {
    const looked = await describeContract(intent.id);
    return pack(wallet, looked.reply, looked.card);
  }
  const protocol = PROTOCOLS.find((item) => item.id === intent.id);
  if (!protocol) return pack(wallet, marketIndexReply(), marketIndexCard());
  return pack(wallet, marketReply(protocol), marketCard(protocol));
}
