import { indicativePrice } from "@/lib/anchor";
import { run } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(req: Request) {
  return run(() => indicativePrice(req));
}
