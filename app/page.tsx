import { Console } from "@/components/console";
import { lifeView } from "@/lib/life";
import { walletView } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [wallet, life] = await Promise.all([walletView(), lifeView()]);
  return <Console initialWallet={wallet} initialLife={life} />;
}
