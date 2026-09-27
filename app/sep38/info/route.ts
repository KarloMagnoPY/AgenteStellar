import { quoteInfo } from "@/lib/anchor";
import { run } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return run(() => quoteInfo());
}
