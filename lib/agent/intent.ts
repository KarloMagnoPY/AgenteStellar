import { findProtocol } from "../market";

export type Intent =
  | { type: "help" }
  | { type: "smart-wallet" }
  | { type: "balance" }
  | { type: "life" }
  | { type: "cycle" }
  | { type: "history" }
  | { type: "accounts" }
  | { type: "fee"; amount: string }
  | { type: "deposit"; amount: string }
  | { type: "withdraw"; amount: string }
  | { type: "quote"; direction: "deposit" | "withdraw"; amount: string }
  | { type: "wallet"; id: string }
  | { type: "contract"; id: string }
  | { type: "market"; id?: string };

function normalize(message: string) {
  return message
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function amountOf(text: string) {
  const match = text.match(/(\d+(?:[.,]\d{1,2})?)/);
  return match ? match[1].replace(",", ".") : null;
}

export function parseIntent(message: string): Intent {
  const text = normalize(message);
  const amount = amountOf(text);
  const contract = message.toUpperCase().match(/\b(C[A-Z2-7]{55})\b/);
  const account = message.toUpperCase().match(/\b(G[A-Z2-7]{55})\b/);
  if (contract) return { type: "contract", id: contract[1] };
  if (account && /wallet|cuenta|saldo|revisa/.test(text)) return { type: "wallet", id: account[1] };
  const protocol = findProtocol(text);
  if (protocol && /analiza|mercado|opera/.test(text)) return { type: "market", id: protocol.id };
  if (/analiza el mercado|que hay en el mercado|mercado de stellar/.test(text)) return { type: "market" };
  if (
    /smart\s*wallet|billetera inteligente|passkey/.test(text) ||
    /crea(r|me)? (mi |la )?(cuenta|wallet|billetera)/.test(text)
  ) {
    return { type: "smart-wallet" };
  }
  if (/vive un (ciclo|dia)|vivir un (ciclo|dia)|otro dia|avanza(r)? la vida/.test(text)) {
    return { type: "cycle" };
  }
  if (/como va (la |mi |tu )?vida|estado de (la )?vida|cuanto le queda/.test(text)) {
    return { type: "life" };
  }
  if (/historial|movimientos|que he hecho|ultimas transacciones/.test(text)) {
    return { type: "history" };
  }
  if (/comision|cuanto cobra|que cobra/.test(text)) {
    return { type: "fee", amount: amount ?? "25" };
  }
  if (/mis cuentas|direcciones|emisor|quien emite/.test(text)) {
    return { type: "accounts" };
  }
  if (/saldo|balance|cuanto tengo/.test(text)) return { type: "balance" };
  if (/retira|saca|off-?ramp|vende/.test(text)) {
    return { type: "withdraw", amount: amount ?? "10" };
  }
  if (/cotiza|precio|a cuanto/.test(text) || (/cuanto/.test(text) && amount)) {
    const direction = /retira|usdc a usd|a usd|vende/.test(text)
      ? "withdraw"
      : "deposit";
    if (!amount) return { type: "help" };
    return { type: "quote", direction, amount };
  }
  if (/fondea|deposita|compra|on-?ramp|mete|entrada/.test(text)) {
    return { type: "deposit", amount: amount ?? "25" };
  }
  return { type: "help" };
}

export const helpReply = [
  "No actúo solo. Puedo revisar tu saldo, otra wallet, un contrato, o leer el mercado de Stellar.",
  "En esta demo sí puedo cotizar, fondear y retirar USDC del anchor: «Cotiza 100 USD», «Fondea 25 USD», «Retira 10 USDC».",
  "Blend, Aquarius, Zenex y el resto los leo. No les mando este USDC, porque no es el de Circle.",
  "El abono bancario es simulado. SEP-10, la cotización y el USDC en testnet son reales.",
].join(" ");
