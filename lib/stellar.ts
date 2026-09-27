import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { explainHorizon } from "./errors";
import { getState } from "./store";

export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const ASSET_CODE = "USDC";

const server = new Horizon.Server(HORIZON_URL);

export function keysFromSecrets(anchorSecret: string, userSecret: string) {
  return {
    anchor: Keypair.fromSecret(anchorSecret),
    user: Keypair.fromSecret(userSecret),
  };
}

export function assetId(issuer: string) {
  return `stellar:${ASSET_CODE}:${issuer}`;
}

function isNotFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loadAccount(publicKey: string) {
  return server.loadAccount(publicKey);
}

async function loadAccountRetry(publicKey: string) {
  let last: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await server.loadAccount(publicKey);
    } catch (error) {
      last = error;
      if (!isNotFound(error) && attempt > 2) break;
      await sleep(400 * (attempt + 1));
    }
  }
  throw new Error(explainHorizon(last));
}

async function fund(publicKey: string) {
  const response = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Friendbot respondió ${response.status}: ${body.slice(0, 180)}`);
  }
  await loadAccountRetry(publicKey);
}

function hasTrustline(
  account: Awaited<ReturnType<typeof server.loadAccount>>,
  issuer: string,
) {
  return account.balances.some(
    (balance) =>
      "asset_code" in balance &&
      balance.asset_code === ASSET_CODE &&
      balance.asset_issuer === issuer,
  );
}

async function submit(
  secret: string,
  mutate: (builder: TransactionBuilder) => void,
) {
  const keypair = Keypair.fromSecret(secret);
  const account = await loadAccountRetry(keypair.publicKey());
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  });
  mutate(builder);
  const tx = builder.setTimeout(180).build();
  tx.sign(keypair);
  try {
    const result = await server.submitTransaction(tx);
    return result.hash;
  } catch (error) {
    throw new Error(explainHorizon(error));
  }
}

export async function ensureNetworkAccounts() {
  const state = await getState();
  const { anchor, user } = keysFromSecrets(state.anchorSecret, state.userSecret);
  let fundedNow = false;

  for (const publicKey of [anchor.publicKey(), user.publicKey()]) {
    try {
      await server.loadAccount(publicKey);
    } catch (error) {
      if (!isNotFound(error)) throw new Error(explainHorizon(error));
      await fund(publicKey);
      fundedNow = true;
    }
  }

  const userAccount = await loadAccountRetry(user.publicKey());
  const trusted = hasTrustline(userAccount, anchor.publicKey());
  if (!trusted) {
    await submit(state.userSecret, (builder) => {
      builder.addOperation(
        Operation.changeTrust({
          asset: new Asset(ASSET_CODE, anchor.publicKey()),
        }),
      );
    });
  }

  return {
    userPublicKey: user.publicKey(),
    anchorPublicKey: anchor.publicKey(),
    fundedNow,
    trustlineCreated: !trusted,
  };
}

export async function readBalances(userPublicKey: string, issuer: string) {
  const account = await server.loadAccount(userPublicKey);
  const xlm =
    account.balances.find((balance) => balance.asset_type === "native")
      ?.balance ?? "0";
  const usdc =
    account.balances.find(
      (balance) =>
        "asset_code" in balance &&
        balance.asset_code === ASSET_CODE &&
        balance.asset_issuer === issuer,
    )?.balance ?? "0";
  return { xlm, usdc };
}

export async function payUsdc(options: {
  secret: string;
  destination: string;
  issuer: string;
  amount: string;
  memoId?: string;
}) {
  return submit(options.secret, (builder) => {
    builder.addOperation(
      Operation.payment({
        destination: options.destination,
        asset: new Asset(ASSET_CODE, options.issuer),
        amount: options.amount,
      }),
    );
    if (options.memoId) builder.addMemo(Memo.id(options.memoId));
  });
}

type HorizonPayment = {
  type: string;
  from: string;
  to: string;
  asset_code?: string;
  asset_issuer?: string;
  amount?: string;
};

export async function readPayment(hash: string) {
  const tx = await server.transactions().transaction(hash).call();
  const operations = await server.operations().forTransaction(hash).call();
  const payment = operations.records.find(
    (record) => record.type === "payment",
  ) as HorizonPayment | undefined;
  return {
    successful: tx.successful,
    memoType: tx.memo_type,
    memo: tx.memo == null ? "" : String(tx.memo),
    payment,
  };
}

export function explorerTx(hash: string) {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

export function explorerAccount(publicKey: string) {
  return `https://stellar.expert/explorer/testnet/account/${publicKey}`;
}
