import { Console } from "@/components/console";
import { walletView } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export default async function Home() {
  const wallet = await walletView();
  return <Console initialWallet={wallet} />;
}
