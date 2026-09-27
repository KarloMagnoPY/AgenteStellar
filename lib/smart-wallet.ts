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

function readable(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "No pude iniciar sesión.";
  if (message.includes("may not have been deployed")) {
    return "El passkey está en el dispositivo, pero la cuenta todavía no está en testnet.";
  }
  if (name === "NotAllowedError") {
    return "Cancelaste el passkey. No creé otra cuenta.";
  }
  return message;
}

function missingContract(error: unknown) {
  return error instanceof Error && error.message.includes("may not have been deployed");
}

function credentialIdFrom(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return message.match(/credential ([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

function existingReceipt(contractId: string): SmartWalletReceipt {
  return {
    contractId,
    created: false,
    funded: true,
    explorerUrl: explorer(contractId),
  };
}

async function connectQuiet(current: SmartAccountKit, credentialId?: string) {
  try {
    const session = credentialId
      ? await current.connectWallet({ credentialId })
      : await current.connectWallet();
    return session?.contractId ?? null;
  } catch (error) {
    if (missingContract(error)) return null;
    throw error;
  }
}

async function deployStored(current: SmartAccountKit, credentialId: string): Promise<SmartWalletReceipt> {
  const deployed = await current.credentials.deploy(credentialId, { autoSubmit: true });
  if (!deployed.submitResult?.success) {
    const reason = deployed.submitResult?.error.message ?? "No pude desplegar la smart wallet de este passkey.";
    throw new Error(reason);
  }
  const contractId = await connectQuiet(current, credentialId);
  if (!contractId) {
    throw new Error("La cuenta se desplegó, pero no pude abrir la sesión.");
  }
  const fund = await current.fundWallet(NATIVE_TOKEN).catch(() => null);
  return {
    contractId,
    created: true,
    funded: fund?.success === true,
    hash: deployed.submitResult.hash,
    explorerUrl: explorer(contractId, deployed.submitResult.hash),
  };
}

async function resumeStored(current: SmartAccountKit) {
  const stored = [...(await current.credentials.getAll())].sort((a, b) => b.createdAt - a.createdAt);
  if (stored.length === 0) return null;
  for (const credential of stored) {
    const contractId = await connectQuiet(current, credential.credentialId);
    if (contractId) return existingReceipt(contractId);
  }
  return deployStored(current, stored[0].credentialId);
}

export async function restoreSmartWallet() {
  try {
    const current = await kit();
    return await connectQuiet(current);
  } catch {
    return null;
  }
}

export async function connectSmartWallet(): Promise<SmartWalletReceipt> {
  const current = await kit();
  const resumed = await resumeStored(current);
  if (resumed) return resumed;
  try {
    const session = await current.connectWallet({ prompt: true });
    if (!session?.contractId) {
      throw new Error("No encontré un passkey de agenteStellar en este dispositivo.");
    }
    return existingReceipt(session.contractId);
  } catch (error) {
    if (missingContract(error)) {
      const id = credentialIdFrom(error);
      const known = id ? (await current.credentials.getAll()).some((item) => item.credentialId === id) : false;
      if (id && known) return deployStored(current, id);
      throw new Error("Ese passkey no tiene la cuenta en testnet y no creé otro.");
    }
    throw new Error(readable(error));
  }
}

export async function leaveSmartWallet() {
  const current = await kit();
  await current.disconnect();
}

export async function openSmartWallet(): Promise<SmartWalletReceipt> {
  const current = await kit();
  const silent = await connectQuiet(current);
  if (silent) return existingReceipt(silent);
  const resumed = await resumeStored(current);
  if (resumed) return resumed;

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
