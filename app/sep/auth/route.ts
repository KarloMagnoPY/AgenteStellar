import { authChallenge, authToken } from "@/lib/anchor";
import { run } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(req: Request) {
  return run(() => authChallenge(req));
}

export function POST(req: Request) {
  return run(() => authToken(req));
}
