import { Keypair } from "@stellar/stellar-sdk";
import { getState } from "./store";
import { readBalances } from "./stellar";
import type { WalletView } from "./types";

export async function walletView(): Promise<WalletView> {
  const state = await getState();
  const userPublicKey = Keypair.fromSecret(state.userSecret).publicKey();
  const anchorPublicKey = Keypair.fromSecret(state.anchorSecret).publicKey();
  try {
    const balances = await readBalances(userPublicKey, anchorPublicKey);
    return { userPublicKey, anchorPublicKey, ...balances, funded: true };
  } catch {
    return {
      userPublicKey,
      anchorPublicKey,
      xlm: "0",
      usdc: "0",
      funded: false,
    };
  }
}
