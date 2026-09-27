import { observeWithdraw } from "@/lib/anchor";
import { run } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(req: Request) {
  return run(() => observeWithdraw(req));
}
