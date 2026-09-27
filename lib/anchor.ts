import { randomBytes, randomUUID } from "crypto";
import {
  Keypair,
  Networks,
  Transaction,
  TransactionBuilder,
  WebAuth,
} from "@stellar/stellar-sdk";
import { AnchorError } from "./errors";
import { signJwt, verifyJwt } from "./jwt";
import { fromCents, parseAmount, sameAmount, totalPrice } from "./money";
import { getState, updateState, type QuoteRecord, type TxRecord } from "./store";
import {
  ASSET_CODE,
  assetId,
  explorerTx,
  keysFromSecrets,
  payUsdc,
  readPayment,
} from "./stellar";
import type { PublicTransaction } from "./types";

const FEE_BPS = 100;
const DELIVERY = "WIRE";

export function homeDomainOf(req: Request) {
  return new URL(req.url).hostname;
}

function quoteMath(direction: "deposit" | "withdraw", sellCents: number) {
  const feeCents = Math.max(1, Math.round((sellCents * FEE_BPS) / 10_000));
  const buyCents = sellCents - feeCents;
  if (buyCents <= 0) {
    throw new AnchorError(400, "El monto no cubre la comisión del 1%.");
  }
  return { feeCents, buyCents };
}

function buildQuote(
  issuer: string,
  direction: "deposit" | "withdraw",
  sellCents: number,
  deliveryMethod: string,
): QuoteRecord {
  const { feeCents, buyCents } = quoteMath(direction, sellCents);
  const stellar = assetId(issuer);
  const fiat = "iso4217:USD";
  const sellAsset = direction === "deposit" ? fiat : stellar;
  const buyAsset = direction === "deposit" ? stellar : fiat;
  const feeAsset = sellAsset;
  return {
    id: randomUUID(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    sellAsset,
    buyAsset,
    sellAmount: fromCents(sellCents),
    buyAmount: fromCents(buyCents),
    price: "1.0000000",
    totalPrice: totalPrice(sellCents, buyCents),
    feeTotal: fromCents(feeCents),
    feeAsset,
    direction,
    deliveryMethod,
  };
}

function quoteResponse(quote: QuoteRecord) {
  return {
    id: quote.id,
    expires_at: quote.expiresAt,
    price: quote.price,
    total_price: quote.totalPrice,
    sell_asset: quote.sellAsset,
    buy_asset: quote.buyAsset,
    sell_amount: quote.sellAmount,
    buy_amount: quote.buyAmount,
    ...(quote.direction === "deposit"
      ? { sell_delivery_method: quote.deliveryMethod }
      : { buy_delivery_method: quote.deliveryMethod }),
    fee: {
      total: quote.feeTotal,
      asset: quote.feeAsset,
      details: [
        {
          name: "Comisión del anchor",
          description: "1% sobre el activo que entrega el cliente.",
          amount: quote.feeTotal,
        },
      ],
    },
  };
}

export function toPublicTransaction(tx: TxRecord): PublicTransaction {
  return {
    id: tx.id,
    kind: tx.kind,
    status: tx.status,
    amountIn: tx.amountIn,
    amountInAsset: tx.amountInAsset,
    amountOut: tx.amountOut,
    amountOutAsset: tx.amountOutAsset,
    fee: tx.amountFee,
    stellarTransactionId: tx.stellarTransactionId,
    explorerUrl: tx.stellarTransactionId
      ? explorerTx(tx.stellarTransactionId)
      : undefined,
  };
}

function sep6Transaction(tx: TxRecord) {
  return {
    id: tx.id,
    kind: tx.kind,
    status: tx.status,
    status_eta: tx.status === "completed" ? 0 : 30,
    amount_in: tx.amountIn,
    amount_in_asset: tx.amountInAsset,
    amount_out: tx.amountOut,
    amount_out_asset: tx.amountOutAsset,
    amount_fee: tx.amountFee,
    amount_fee_asset: tx.feeAsset,
    started_at: tx.startedAt,
    completed_at: tx.completedAt,
    stellar_transaction_id: tx.stellarTransactionId,
    quote_id: tx.quoteId,
    destination_account: tx.kind === "deposit-exchange" ? tx.account : undefined,
    message: tx.message,
  };
}

async function bearerAccount(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token || token === header) {
    throw new AnchorError(401, "Falta el JWT de SEP-10 en Authorization.");
  }
  const state = await getState();
  const payload = verifyJwt(token, state.jwtSecret);
  const user = Keypair.fromSecret(state.userSecret).publicKey();
  if (payload.sub !== user) {
    throw new AnchorError(403, "El JWT no corresponde a la cuenta del agente.");
  }
  return { state, account: payload.sub };
}

function requireQuote(state: Awaited<ReturnType<typeof getState>>, id: string) {
  const quote = state.quotes[id];
  if (!quote) throw new AnchorError(404, "Esa cotización no existe.");
  if (new Date(quote.expiresAt).getTime() < Date.now()) {
    throw new AnchorError(400, "La cotización SEP-38 expiró.");
  }
  return quote;
}

export async function stellarToml(origin: string) {
  const state = await getState();
  const anchor = Keypair.fromSecret(state.anchorSecret).publicKey();
  const body = `VERSION="2.0.0"
NETWORK_PASSPHRASE="${Networks.TESTNET}"
SIGNING_KEY="${anchor}"
WEB_AUTH_ENDPOINT="${origin}/sep/auth"
TRANSFER_SERVER="${origin}/sep"
ANCHOR_QUOTE_SERVER="${origin}/sep38"
ACCOUNTS=["${anchor}"]

[[CURRENCIES]]
code="${ASSET_CODE}"
issuer="${anchor}"
display_decimals=2
name="USDC de demostración"
desc="Activo de prueba emitido por el anchor agenteStellar en testnet. No es USDC de Circle."
is_asset_anchored=true
anchor_asset_type="fiat"
anchor_asset="USD"
status="test"
`;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

export async function authChallenge(req: Request) {
  const account = new URL(req.url).searchParams.get("account");
  if (!account || !account.startsWith("G")) {
    throw new AnchorError(400, "Falta el parámetro account (G...).");
  }
  const domain = homeDomainOf(req);
  const state = await getState();
  const anchor = Keypair.fromSecret(state.anchorSecret);
  const transaction = WebAuth.buildChallengeTx(
    anchor,
    account,
    domain,
    300,
    Networks.TESTNET,
    domain,
  );
  return {
    transaction,
    network_passphrase: Networks.TESTNET,
  };
}

export async function authToken(req: Request) {
  const body = (await req.json()) as { transaction?: string };
  if (!body.transaction) {
    throw new AnchorError(400, "Falta la transacción firmada.");
  }
  const domain = homeDomainOf(req);
  const state = await getState();
  const anchor = Keypair.fromSecret(state.anchorSecret);
  const read = WebAuth.readChallengeTx(
    body.transaction,
    anchor.publicKey(),
    Networks.TESTNET,
    domain,
    domain,
  );
  WebAuth.verifyChallengeTxSigners(
    body.transaction,
    anchor.publicKey(),
    Networks.TESTNET,
    [read.clientAccountID],
    domain,
    domain,
  );
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt(
    {
      iss: `${new URL(req.url).origin}/sep/auth`,
      sub: read.clientAccountID,
      iat: now,
      exp: now + 15 * 60,
      jti: randomUUID(),
    },
    state.jwtSecret,
  );
  return { token };
}

export function transferInfo() {
  const asset = {
    enabled: true,
    authentication_required: true,
    min_amount: 1,
    max_amount: 1000,
    funding_methods: [DELIVERY],
  };
  return {
    deposit: { [ASSET_CODE]: asset },
    "deposit-exchange": { [ASSET_CODE]: asset },
    withdraw: { [ASSET_CODE]: asset },
    "withdraw-exchange": { [ASSET_CODE]: asset },
    fee: {
      enabled: true,
      description: "1% aplicado en la cotización SEP-38.",
    },
    transactions: { enabled: true, authentication_required: true },
    transaction: { enabled: true, authentication_required: true },
    features: { account_creation: false, claimable_balances: false },
  };
}

export async function quoteInfo() {
  const state = await getState();
  const issuer = Keypair.fromSecret(state.anchorSecret).publicKey();
  return {
    assets: [
      { asset: assetId(issuer) },
      {
        asset: "iso4217:USD",
        country_codes: ["US"],
        sell_delivery_methods: [
          {
            name: DELIVERY,
            description: "Transferencia bancaria de demostración.",
          },
        ],
        buy_delivery_methods: [
          {
            name: DELIVERY,
            description: "Abono bancario de demostración.",
          },
        ],
      },
    ],
  };
}

export async function indicativePrice(req: Request) {
  const url = new URL(req.url);
  const sellAsset = url.searchParams.get("sell_asset");
  const buyAsset = url.searchParams.get("buy_asset");
  const sellAmount = url.searchParams.get("sell_amount");
  if (!sellAsset || !buyAsset || !sellAmount) {
    throw new AnchorError(400, "Faltan sell_asset, buy_asset o sell_amount.");
  }
  const state = await getState();
  const issuer = Keypair.fromSecret(state.anchorSecret).publicKey();
  const direction =
    sellAsset === "iso4217:USD" && buyAsset === assetId(issuer)
      ? "deposit"
      : buyAsset === "iso4217:USD" && sellAsset === assetId(issuer)
        ? "withdraw"
        : null;
  if (!direction) {
    throw new AnchorError(400, "Ese par no está soportado.");
  }
  const quote = buildQuote(issuer, direction, parseAmount(sellAmount), DELIVERY);
  return quoteResponse(quote);
}

export async function createQuote(req: Request) {
  await bearerAccount(req);
  const body = (await req.json()) as {
    sell_asset?: string;
    buy_asset?: string;
    sell_amount?: string;
    context?: string;
    sell_delivery_method?: string;
    buy_delivery_method?: string;
  };
  if (body.context !== "sep6") {
    throw new AnchorError(400, "agenteStellar solo cotiza en contexto sep6.");
  }
  if (!body.sell_asset || !body.buy_asset || !body.sell_amount) {
    throw new AnchorError(400, "Faltan sell_asset, buy_asset o sell_amount.");
  }
  const state = await getState();
  const issuer = Keypair.fromSecret(state.anchorSecret).publicKey();
  const deposit =
    body.sell_asset === "iso4217:USD" && body.buy_asset === assetId(issuer);
  const withdraw =
    body.sell_asset === assetId(issuer) && body.buy_asset === "iso4217:USD";
  if (!deposit && !withdraw) {
    throw new AnchorError(400, "Ese par no está soportado.");
  }
  const method = deposit ? body.sell_delivery_method : body.buy_delivery_method;
  if (method && method !== DELIVERY) {
    throw new AnchorError(400, "El único método de entrega es WIRE.");
  }
  const quote = buildQuote(
    issuer,
    deposit ? "deposit" : "withdraw",
    parseAmount(body.sell_amount),
    DELIVERY,
  );
  await updateState((current) => {
    current.quotes[quote.id] = quote;
  });
  return quoteResponse(quote);
}

export async function fetchQuote(req: Request, id: string) {
  await bearerAccount(req);
  const state = await getState();
  const quote = state.quotes[id];
  if (!quote) throw new AnchorError(404, "Esa cotización no existe.");
  return quoteResponse(quote);
}

export async function openDeposit(req: Request) {
  const { state } = await bearerAccount(req);
  const url = new URL(req.url);
  const quote = requireQuote(state, url.searchParams.get("quote_id") ?? "");
  if (quote.direction !== "deposit") {
    throw new AnchorError(400, "La cotización no es de depósito.");
  }
  const destination = url.searchParams.get("destination_asset");
  const source = url.searchParams.get("source_asset");
  const amount = url.searchParams.get("amount");
  const account = url.searchParams.get("account");
  const issuer = Keypair.fromSecret(state.anchorSecret).publicKey();
  if (destination !== ASSET_CODE || source !== "iso4217:USD") {
    throw new AnchorError(400, "El par del depósito no coincide con el anchor.");
  }
  if (!amount || !sameAmount(amount, quote.sellAmount)) {
    throw new AnchorError(400, "El amount no coincide con la cotización.");
  }
  if (account !== Keypair.fromSecret(state.userSecret).publicKey()) {
    throw new AnchorError(400, "La cuenta destino no es la del agente.");
  }
  const tx: TxRecord = {
    id: randomUUID(),
    kind: "deposit-exchange",
    status: "pending_user_transfer_start",
    account: account,
    quoteId: quote.id,
    amountIn: quote.sellAmount,
    amountInAsset: "iso4217:USD",
    amountOut: quote.buyAmount,
    amountOutAsset: assetId(issuer),
    amountFee: quote.feeTotal,
    feeAsset: quote.feeAsset,
    startedAt: new Date().toISOString(),
    message: "Transfiere el USD por WIRE. En este demo el abono bancario se simula.",
  };
  await updateState((current) => {
    current.transactions[tx.id] = tx;
  });
  return {
    id: tx.id,
    how: "WIRE",
    eta: 30,
    fee_fixed: quote.feeTotal,
    instructions: {
      bank_name: "Banco agenteStellar (demo)",
      bank_account_number: "000123456789",
      message:
        "Transfiere el monto en USD. El abono fiat es simulado; el envío de USDC en testnet es real.",
    },
  };
}

export async function openWithdraw(req: Request) {
  const { state } = await bearerAccount(req);
  const url = new URL(req.url);
  const quote = requireQuote(state, url.searchParams.get("quote_id") ?? "");
  if (quote.direction !== "withdraw") {
    throw new AnchorError(400, "La cotización no es de retiro.");
  }
  const source = url.searchParams.get("source_asset");
  const destination = url.searchParams.get("destination_asset");
  const amount = url.searchParams.get("amount");
  const issuer = Keypair.fromSecret(state.anchorSecret).publicKey();
  const user = Keypair.fromSecret(state.userSecret).publicKey();
  if (source !== ASSET_CODE || destination !== "iso4217:USD") {
    throw new AnchorError(400, "El par del retiro no coincide con el anchor.");
  }
  if (!amount || !sameAmount(amount, quote.sellAmount)) {
    throw new AnchorError(400, "El amount no coincide con la cotización.");
  }
  const memo = BigInt(`0x${randomBytes(6).toString("hex")}`).toString();
  const tx: TxRecord = {
    id: randomUUID(),
    kind: "withdraw-exchange",
    status: "pending_user_transfer_start",
    account: user,
    quoteId: quote.id,
    amountIn: quote.sellAmount,
    amountInAsset: assetId(issuer),
    amountOut: quote.buyAmount,
    amountOutAsset: "iso4217:USD",
    amountFee: quote.feeTotal,
    feeAsset: quote.feeAsset,
    startedAt: new Date().toISOString(),
    memo,
    message: "Envía el USDC a la cuenta del anchor con el memo indicado.",
  };
  await updateState((current) => {
    current.transactions[tx.id] = tx;
  });
  return {
    id: tx.id,
    account_id: issuer,
    memo_type: "id",
    memo,
    fee_fixed: quote.feeTotal,
    eta: 30,
  };
}

export async function getTransaction(req: Request) {
  const { state } = await bearerAccount(req);
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !state.transactions[id]) {
    throw new AnchorError(404, "La transacción no existe.");
  }
  return { transaction: sep6Transaction(state.transactions[id]) };
}

export async function confirmFiat(req: Request) {
  const { state } = await bearerAccount(req);
  const body = (await req.json()) as { id?: string };
  const existing = body.id ? state.transactions[body.id] : undefined;
  if (!existing || existing.kind !== "deposit-exchange") {
    throw new AnchorError(404, "No hay un depósito con ese id.");
  }
  if (existing.status === "completed" && existing.stellarTransactionId) {
    return { transaction: sep6Transaction(existing) };
  }
  requireQuote(state, existing.quoteId);
  const { anchor, user } = keysFromSecrets(state.anchorSecret, state.userSecret);
  let hash: string;
  try {
    hash = await payUsdc({
      secret: state.anchorSecret,
      destination: user.publicKey(),
      issuer: anchor.publicKey(),
      amount: existing.amountOut,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "falló el pago";
    await updateState((current) => {
      const tx = current.transactions[existing.id];
      if (!tx) return;
      tx.status = "error";
      tx.message = message;
    });
    throw new AnchorError(502, message);
  }
  const saved = await updateState((current) => {
    const tx = current.transactions[existing.id];
    tx.status = "completed";
    tx.stellarTransactionId = hash;
    tx.completedAt = new Date().toISOString();
    tx.message = "USD de demostración recibido. USDC emitido en testnet.";
    return structuredClone(tx);
  });
  return { transaction: sep6Transaction(saved) };
}

export async function observeWithdraw(req: Request) {
  const { state } = await bearerAccount(req);
  const body = (await req.json()) as { id?: string; stellar_transaction_id?: string };
  const existing = body.id ? state.transactions[body.id] : undefined;
  if (!existing || existing.kind !== "withdraw-exchange") {
    throw new AnchorError(404, "No hay un retiro con ese id.");
  }
  if (existing.status === "completed") {
    return { transaction: sep6Transaction(existing) };
  }
  if (!body.stellar_transaction_id) {
    throw new AnchorError(400, "Falta stellar_transaction_id.");
  }
  requireQuote(state, existing.quoteId);
  const issuer = Keypair.fromSecret(state.anchorSecret).publicKey();
  const user = Keypair.fromSecret(state.userSecret).publicKey();
  let observed;
  try {
    observed = await readPayment(body.stellar_transaction_id);
  } catch (error) {
    throw new AnchorError(
      400,
      error instanceof Error ? error.message : "No pude leer la transacción en Horizon.",
    );
  }
  const payment = observed.payment;
  if (
    !observed.successful ||
    !payment ||
    payment.from !== user ||
    payment.to !== issuer ||
    payment.asset_code !== ASSET_CODE ||
    payment.asset_issuer !== issuer ||
    !payment.amount ||
    !sameAmount(payment.amount, existing.amountIn) ||
    observed.memoType !== "id" ||
    observed.memo !== existing.memo
  ) {
    throw new AnchorError(
      400,
      "El pago en Stellar no coincide con el retiro (cuenta, monto, activo o memo).",
    );
  }
  const saved = await updateState((current) => {
    const tx = current.transactions[existing.id];
    tx.status = "completed";
    tx.stellarTransactionId = body.stellar_transaction_id;
    tx.completedAt = new Date().toISOString();
    tx.message = "USDC recibido y quemado. USD de demostración marcado como enviado.";
    return structuredClone(tx);
  });
  return { transaction: sep6Transaction(saved) };
}

export function signChallenge(xdr: string, secret: string) {
  const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  if (!(tx instanceof Transaction)) {
    throw new AnchorError(400, "El challenge SEP-10 no es una transacción simple.");
  }
  tx.sign(Keypair.fromSecret(secret));
  return tx.toEnvelope().toXDR("base64");
}
