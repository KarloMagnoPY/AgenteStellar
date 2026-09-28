import type { LifeView } from "./life";

export type Step = {
  sep: "SEP-1" | "SEP-10" | "SEP-38" | "SEP-6" | "Red";
  title: string;
  detail: string;
};

export type PublicTransaction = {
  id: string;
  kind: "deposit-exchange" | "withdraw-exchange";
  status: string;
  amountIn: string;
  amountInAsset: string;
  amountOut: string;
  amountOutAsset: string;
  fee: string;
  stellarTransactionId?: string;
  explorerUrl?: string;
};

export type WalletView = {
  userPublicKey: string;
  anchorPublicKey: string;
  xlm: string;
  usdc: string;
  funded: boolean;
};

export type FactCard = {
  title: string;
  rows: Array<{ label: string; value: string; href?: string }>;
};

export type AgentResponse = {
  mode: "protocol" | "language";
  reply: string;
  steps: Step[];
  transaction: PublicTransaction | null;
  wallet: WalletView;
  life?: LifeView;
  card?: FactCard;
};
