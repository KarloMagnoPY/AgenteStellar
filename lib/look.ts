import { StrKey } from "@stellar/stellar-sdk";
import type { FactCard } from "./types";

const HORIZON = "https://horizon-testnet.stellar.org";

type HorizonBalance = {
  asset_type: string;
  balance: string;
  asset_code?: string;
  asset_issuer?: string;
};

function shortKey(key: string) {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function trim(amount: string) {
  const [whole, frac = ""] = amount.split(".");
  const cut = frac.slice(0, 4).replace(/0+$/, "");
  return cut ? `${whole}.${cut}` : whole;
}

function expertAccount(id: string) {
  return `https://stellar.expert/explorer/testnet/account/${id}`;
}

function expertContract(id: string) {
  return `https://stellar.expert/explorer/testnet/contract/${id}`;
}

export async function describeAccount(id: string): Promise<{ reply: string; card: FactCard }> {
  if (!StrKey.isValidEd25519PublicKey(id)) {
    throw new Error("Esa cuenta no tiene forma de clave pública G…");
  }
  const response = await fetch(`${HORIZON}/accounts/${id}`, { signal: AbortSignal.timeout(8000) });
  const href = expertAccount(id);
  if (response.status === 404) {
    return {
      reply: "Esa cuenta no está en testnet.",
      card: { title: "Wallet", rows: [{ label: "Cuenta", value: shortKey(id), href }] },
    };
  }
  if (!response.ok) throw new Error("Horizon no respondió el saldo de esa wallet.");
  const body = (await response.json()) as { balances?: HorizonBalance[] };
  const rows = (body.balances ?? []).slice(0, 6).map((balance) => {
    if (balance.asset_type === "native") return { label: "XLM", value: trim(balance.balance) };
    const code = balance.asset_code ?? "activo";
    return { label: code, value: trim(balance.balance) };
  });
  return {
    reply: `Saldo en testnet de ${shortKey(id)}. ${rows.map((row) => `${row.value} ${row.label}`).join(", ") || "Sin saldos."}`,
    card: {
      title: "Wallet en testnet",
      rows: [{ label: "Cuenta", value: shortKey(id), href }, ...rows],
    },
  };
}

export async function describeContract(id: string): Promise<{ reply: string; card: FactCard }> {
  if (!StrKey.isValidContract(id)) throw new Error("Ese contrato no tiene forma C…");
  const href = expertContract(id);
  const response = await fetch(`https://api.stellar.expert/explorer/testnet/contract/${id}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 404) {
    return {
      reply: "Ese contrato no aparece en testnet. No firmé ninguna llamada.",
      card: { title: "Contrato", rows: [{ label: "Expert", value: shortKey(id), href }] },
    };
  }
  if (!response.ok) {
    return {
      reply: "No pude leer el contrato. El enlace a Stellar Expert queda para abrirlo. No firmé ninguna llamada.",
      card: { title: "Contrato", rows: [{ label: "Expert", value: shortKey(id), href }] },
    };
  }
  const body = (await response.json()) as { wasm?: string; created?: number; payments?: number };
  const rows: FactCard["rows"] = [{ label: "Contrato", value: shortKey(id), href }];
  if (body.wasm) rows.push({ label: "Wasm", value: `${body.wasm.slice(0, 8)}…${body.wasm.slice(-6)}` });
  if (typeof body.payments === "number") rows.push({ label: "Pagos", value: String(body.payments) });
  return {
    reply: `Contrato ${shortKey(id)} en testnet. Solo lo leí. No firmé ninguna llamada.`,
    card: { title: "Contrato en testnet", rows },
  };
}
