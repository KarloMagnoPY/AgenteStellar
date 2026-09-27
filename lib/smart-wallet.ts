"use client";

import type { SmartAccountKit } from "smart-account-kit";

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK = "Test SDF Network ; September 2015";
const ACCOUNT_WASM_HASH =
  "1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a";
const WEBAUTHN_VERIFIER = "CC7EKIHQP3TN4CARQDND6CEOY2UXLWWC2X5GHTD5NLAT7BG5GPZIOM3F";
const RELAYER_URL = "https://smart-account-relayer-proxy.sdf-ecosystem.workers.dev";
const NATIVE_TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

export type SmartWalletReceipt = {
  contractId: string;
  created: boolean;
  funded: boolean;
  hash?: string;
  explorerUrl: string;
};

export function wantsSmartWallet(message: string) {
  const text = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return (
    /smart\s*wallet|billetera inteligente|passkey/.test(text) ||
    /crea(r|me)? (mi |la )?(cuenta|wallet|billetera)/.test(text)
  );
}

function explorer(contractId: string, hash?: string) {
  if (hash) return `https://stellar.expert/explorer/testnet/tx/${hash}`;
  return `https://stellar.expert/explorer/testnet/contract/${contractId}`;
}

let kitPromise: Promise<SmartAccountKit> | null = null;

async function kit() {
  kitPromise ??= (async () => {
    const { SmartAccountKit, IndexedDBStorage } = await import("smart-account-kit");
    return new SmartAccountKit({
      rpcUrl: RPC_URL,
      networkPassphrase: NETWORK,
      accountWasmHash: ACCOUNT_WASM_HASH,
      webauthnVerifierAddress: WEBAUTHN_VERIFIER,
      relayerUrl: RELAYER_URL,
      storage: new IndexedDBStorage("agentestellar-smart-wallet"),
      rpName: "agenteStellar",
    });
  })();
  return kitPromise;
}

export async function restoreSmartWallet() {
  try {
    const current = await kit();
    const session = await current.connectWallet();
    return session?.contractId ?? null;
  } catch {
    return null;
  }
}

export async function openSmartWallet(): Promise<SmartWalletReceipt> {
  const current = await kit();
  const existing = await current.connectWallet();
  if (existing?.contractId) {
    return {
      contractId: existing.contractId,
      created: false,
      funded: true,
      explorerUrl: explorer(existing.contractId),
    };
  }

  const created = await current.createWallet("agenteStellar", "usuario", {
    autoSubmit: true,
    autoFund: true,
    nativeTokenContract: NATIVE_TOKEN,
  });
  if (!created.submitResult?.success) {
    const reason = created.submitResult?.error.message ?? "El relayer no confirmó el despliegue.";
    throw new Error(reason);
  }

  return {
    contractId: created.contractId,
    created: true,
    funded: created.fundResult?.success === true,
    hash: created.submitResult.hash,
    explorerUrl: explorer(created.contractId, created.submitResult.hash),
  };
}
