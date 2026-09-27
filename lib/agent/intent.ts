export type Intent =
  | { type: "help" }
  | { type: "balance" }
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
  "Puedo entrar y salir de Stellar por el anchor de demostración.",
  "Prueba con «Fondea 25 USD», «Cotiza 100 USD», «Retira 10 USDC» o «¿Cuál es mi saldo?».",
  "El abono bancario es simulado. La autenticación SEP-10, la cotización y el USDC en testnet son reales.",
].join(" ");
