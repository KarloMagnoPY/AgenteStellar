import { randomBytes } from "crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { Keypair } from "@stellar/stellar-sdk";

export type QuoteRecord = {
  id: string;
  expiresAt: string;
  sellAsset: string;
  buyAsset: string;
  sellAmount: string;
  buyAmount: string;
  price: string;
  totalPrice: string;
  feeTotal: string;
  feeAsset: string;
  direction: "deposit" | "withdraw";
  deliveryMethod: string;
};

export type TxStatus =
  | "pending_user_transfer_start"
  | "pending_anchor"
  | "completed"
  | "error";

export type TxRecord = {
  id: string;
  kind: "deposit-exchange" | "withdraw-exchange";
  status: TxStatus;
  account: string;
  quoteId: string;
  amountIn: string;
  amountInAsset: string;
  amountOut: string;
  amountOutAsset: string;
  amountFee: string;
  feeAsset: string;
  startedAt: string;
  completedAt?: string;
  stellarTransactionId?: string;
  memo?: string;
  message?: string;
};

export type State = {
  anchorSecret: string;
  userSecret: string;
  jwtSecret: string;
  sessionToken: string | null;
  sessionExp: number;
  quotes: Record<string, QuoteRecord>;
  transactions: Record<string, TxRecord>;
};

const file = path.join(process.cwd(), ".data", "state.json");

let queue: Promise<unknown> = Promise.resolve();

function createFresh(): State {
  return {
    anchorSecret: Keypair.random().secret(),
    userSecret: Keypair.random().secret(),
    jwtSecret: randomBytes(32).toString("hex"),
    sessionToken: null,
    sessionExp: 0,
    quotes: {},
    transactions: {},
  };
}

function load(): State | null {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as State;
}

function write(state: State) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, file);
}

export function updateState<T>(fn: (state: State) => T): Promise<T> {
  const job = queue.then(() => {
    const state = load() ?? createFresh();
    const result = fn(state);
    write(state);
    return result;
  });
  queue = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

export function getState() {
  return updateState((state) => structuredClone(state));
}
