import { json } from "@/lib/http";
import { walletView } from "@/lib/wallet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return json(await walletView());
}
