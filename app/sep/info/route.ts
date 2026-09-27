import { transferInfo } from "@/lib/anchor";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return json(transferInfo());
}
