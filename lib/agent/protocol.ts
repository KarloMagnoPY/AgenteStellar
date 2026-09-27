import { Keypair } from "@stellar/stellar-sdk";
import { signChallenge } from "../anchor";
import { AnchorError } from "../errors";
import { readJwtExp } from "../jwt";
import { toCents } from "../money";
import { getState, updateState } from "../store";
import { ensureNetworkAccounts, payUsdc, readBalances } from "../stellar";
import type { AgentResponse, PublicTransaction, Step } from "../types";
import { walletView } from "../wallet";
import { callAnchor } from "./http";
import { helpReply, parseIntent, type Intent } from "./intent";

function assetLabel(asset: string) {
  if (asset.startsWith("iso4217:")) return asset.slice("iso4217:".length);
  const parts = asset.split(":");
  return parts[1] ?? asset;
}

function fromSep6(tx: Record<string, unknown>): PublicTransaction {
  const hash =
    typeof tx.stellar_transaction_id === "string"
      ? tx.stellar_transaction_id
      : undefined;
  return {
    id: String(tx.id),
    kind: tx.kind === "withdraw-exchange" ? "withdraw-exchange" : "deposit-exchange",
    status: String(tx.status),
    amountIn: String(tx.amount_in),
    amountInAsset: String(tx.amount_in_asset),
    amountOut: String(tx.amount_out),
    amountOutAsset: String(tx.amount_out_asset),
    fee: String(tx.amount_fee),
    stellarTransactionId: hash,
    explorerUrl: hash
      ? `https://stellar.expert/explorer/testnet/tx/${hash}`
      : undefined,
  };
}

async function authenticate(origin: string, steps: Step[]) {
  const state = await getState();
  const challenge = await callAnchor(origin, "/sep/auth", {
    search: {
      account: Keypair.fromSecret(state.userSecret).publicKey(),
    },
  });
  const signed = signChallenge(String(challenge.transaction), state.userSecret);
  const auth = await callAnchor(origin, "/sep/auth", {
    method: "POST",
    body: { transaction: signed },
  });
  const token = String(auth.token);
  await updateState((current) => {
    current.sessionToken = token;
    current.sessionExp = readJwtExp(token);
  });
  steps.push({
    sep: "SEP-10",
    title: "Autenticación web",
    detail: "El agente firmó el challenge y el anchor entregó un JWT.",
  });
  return token;
}

async function requestQuote(
  origin: string,
  token: string,
  direction: "deposit" | "withdraw",
  amount: string,
  issuer: string,
  steps: Step[],
) {
  const stellar = `stellar:USDC:${issuer}`;
  const body =
    direction === "deposit"
      ? {
          sell_asset: "iso4217:USD",
          buy_asset: stellar,
          sell_amount: amount,
          sell_delivery_method: "WIRE",
          context: "sep6",
        }
      : {
          sell_asset: stellar,
          buy_asset: "iso4217:USD",
          sell_amount: amount,
          buy_delivery_method: "WIRE",
          context: "sep6",
        };
  const quote = await callAnchor(origin, "/sep38/quote", {
    method: "POST",
    token,
    body,
  });
  const fee = quote.fee as { total?: string; asset?: string };
  steps.push({
    sep: "SEP-38",
    title: "Cotización en firme",
    detail: `${quote.sell_amount} ${assetLabel(String(quote.sell_asset))} → ${quote.buy_amount} ${assetLabel(String(quote.buy_asset))}. Comisión ${fee.total} ${assetLabel(String(fee.asset))}.`,
  });
  return quote;
}

export async function runProtocol(
  origin: string,
  message: string,
): Promise<AgentResponse> {
  const steps: Step[] = [];
  let transaction: PublicTransaction | null = null;
  const intent = parseIntent(message);

  try {
    if (intent.type === "help" || intent.type === "smart-wallet") {
      return {
        mode: "protocol",
        reply:
          intent.type === "smart-wallet"
            ? "La smart wallet se crea en la pantalla de inicio de sesión, con el passkey de este dispositivo. El servidor no puede registrar tu biometría."
            : helpReply,
        steps,
        transaction,
        wallet: await walletView(),
      };
    }

    const network = await ensureNetworkAccounts();
    steps.push({
      sep: "Red",
      title: "Cuentas en testnet",
      detail: network.fundedNow
        ? "Friendbot creó las cuentas del agente y del anchor, y quedó la trustline de USDC."
        : network.trustlineCreated
          ? "Las cuentas ya existían. Acabo de abrir la trustline de USDC."
          : "La cuenta del agente, la del anchor y la trustline de USDC ya estaban listas.",
    });

    const toml = await fetch(new URL("/.well-known/stellar.toml", origin), {
      cache: "no-store",
    });
    if (!toml.ok) throw new Error("No pude leer el stellar.toml del anchor.");
    steps.push({
      sep: "SEP-1",
      title: "Descubrimiento",
      detail: `stellar.toml en ${origin}. Firma ${network.anchorPublicKey.slice(0, 6)}… y servidores SEP-6 y SEP-38.`,
    });

    if (intent.type === "balance") {
      const balances = await readBalances(
        network.userPublicKey,
        network.anchorPublicKey,
      );
      return {
        mode: "protocol",
        reply: `Saldo del agente: ${trimAmount(balances.usdc)} USDC de demostración y ${trimAmount(balances.xlm)} XLM. Cuenta ${network.userPublicKey}.`,
        steps,
        transaction,
        wallet: await walletView(),
      };
    }

    if (intent.type === "life" || intent.type === "cycle" || intent.type === "history") {
      throw new Error("Esa orden se responde antes de hablar con el anchor.");
    }

    const token = await authenticate(origin, steps);
    transaction = await execute(origin, token, network, intent, steps);

    const wallet = await walletView();
    return {
      mode: "protocol",
      reply: replyFor(intent, transaction, wallet.usdc, steps),
      steps,
      transaction,
      wallet,
    };
  } catch (error) {
    const reply =
      error instanceof AnchorError || error instanceof Error
        ? error.message
        : "El agente no pudo completar el flujo.";
    return {
      mode: "protocol",
      reply,
      steps,
      transaction,
      wallet: await walletView(),
    };
  }
}

async function execute(
  origin: string,
  token: string,
  network: Awaited<ReturnType<typeof ensureNetworkAccounts>>,
  intent: Exclude<Intent, { type: "help" } | { type: "balance" } | { type: "smart-wallet" } | { type: "life" } | { type: "cycle" } | { type: "history" }>,
  steps: Step[],
) {
  if (intent.type === "quote") {
    await requestQuote(
      origin,
      token,
      intent.direction,
      intent.amount,
      network.anchorPublicKey,
      steps,
    );
    return null;
  }

  if (intent.type === "deposit") {
    const quote = await requestQuote(
      origin,
      token,
      "deposit",
      intent.amount,
      network.anchorPublicKey,
      steps,
    );
    const opened = await callAnchor(origin, "/sep/deposit-exchange", {
      token,
      search: {
        destination_asset: "USDC",
        source_asset: "iso4217:USD",
        amount: String(quote.sell_amount),
        account: network.userPublicKey,
        quote_id: String(quote.id),
        funding_method: "WIRE",
      },
    });
    const instructions = opened.instructions as { bank_name?: string };
    steps.push({
      sep: "SEP-6",
      title: "Depósito abierto",
      detail: `El anchor espera ${quote.sell_amount} USD por WIRE en ${instructions.bank_name ?? "su banco demo"}.`,
    });
    const confirmed = await callAnchor(origin, "/sep/demo/fiat", {
      method: "POST",
      token,
      body: { id: opened.id },
    });
    const tx = fromSep6(confirmed.transaction as Record<string, unknown>);
    steps.push({
      sep: "SEP-6",
      title: "USDC en testnet",
      detail: `Abono fiat simulado. El anchor emitió ${tx.amountOut} USDC. ${tx.stellarTransactionId}`,
    });
    return tx;
  }

  const balances = await readBalances(
    network.userPublicKey,
    network.anchorPublicKey,
  );
  if (toCents(trimAmount(balances.usdc)) < toCents(intent.amount)) {
    throw new Error(
      `No alcanza el saldo: hay ${trimAmount(balances.usdc)} USDC y el retiro pide ${intent.amount}.`,
    );
  }
  const quote = await requestQuote(
    origin,
    token,
    "withdraw",
    intent.amount,
    network.anchorPublicKey,
    steps,
  );
  const opened = await callAnchor(origin, "/sep/withdraw-exchange", {
    token,
    search: {
      source_asset: "USDC",
      destination_asset: "iso4217:USD",
      amount: String(quote.sell_amount),
      quote_id: String(quote.id),
      funding_method: "WIRE",
    },
  });
  steps.push({
    sep: "SEP-6",
    title: "Retiro abierto",
    detail: `Hay que enviar ${quote.sell_amount} USDC al anchor con memo ${opened.memo}.`,
  });
  const state = await getState();
  const hash = await payUsdc({
    secret: state.userSecret,
    destination: String(opened.account_id),
    issuer: network.anchorPublicKey,
    amount: String(quote.sell_amount),
    memoId: String(opened.memo),
  });
  steps.push({
    sep: "Red",
    title: "Pago del agente",
    detail: `USDC enviado al emisor (se quema). ${hash}`,
  });
  const observed = await callAnchor(origin, "/sep/demo/observe", {
    method: "POST",
    token,
    body: { id: opened.id, stellar_transaction_id: hash },
  });
  const tx = fromSep6(observed.transaction as Record<string, unknown>);
  steps.push({
    sep: "SEP-6",
    title: "USD de demostración",
    detail: `El anchor verificó el pago en Horizon y marcó ${tx.amountOut} USD como enviados.`,
  });
  return tx;
}

function replyFor(
  intent: Exclude<Intent, { type: "help" } | { type: "balance" } | { type: "smart-wallet" } | { type: "life" } | { type: "cycle" } | { type: "history" }>,
  transaction: PublicTransaction | null,
  usdc: string,
  steps: Step[],
) {
  if (intent.type === "quote") {
    const quoteStep = [...steps].reverse().find((step) => step.sep === "SEP-38");
    return quoteStep
      ? `Cotización en firme: ${quoteStep.detail}`
      : "Cotización lista.";
  }
  if (!transaction?.stellarTransactionId) {
    return "El flujo terminó sin un hash de Stellar.";
  }
  if (transaction.kind === "deposit-exchange") {
    return `Listo. ${transaction.amountIn} USD de demostración entraron por el anchor y ahora hay ${trimAmount(usdc)} USDC en la cuenta del agente. La transacción está en Stellar Expert.`;
  }
  return `Listo. El agente entregó ${transaction.amountIn} USDC al anchor y el retiro quedó en ${transaction.amountOut} USD de demostración. Saldo actual: ${trimAmount(usdc)} USDC.`;
}

function trimAmount(amount: string) {
  const negative = amount.startsWith("-");
  const [whole, frac = ""] = amount.replace("-", "").split(".");
  const cents = (frac + "00").slice(0, 2);
  return `${negative ? "-" : ""}${whole}.${cents}`;
}
