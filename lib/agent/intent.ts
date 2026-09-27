export type Intent =
  | { type: "help" }
  | { type: "smart-wallet" }
  | { type: "balance" }
  | { type: "life" }
  | { type: "cycle" }
  | { type: "history" }
  | { type: "deposit"; amount: string }
  | { type: "withdraw"; amount: string }
  | { type: "quote"; direction: "deposit" | "withdraw"; amount: string };

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
  "Puedo mover USDC de prueba por el anchor y también vivir un día de la vida.",
  "Dinero: «Fondea 25 USD», «Cotiza 100 USD», «Retira 10 USDC», «¿Cuál es mi saldo?», «¿Qué he hecho?».",
  "Vida: «¿Cómo va la vida?» y «Vive un ciclo». Un ciclo cobra 0.05 y arriesga una sola mesa.",
  "El abono bancario es simulado. SEP-10, la cotización y el USDC en testnet son reales.",
].join(" ");
