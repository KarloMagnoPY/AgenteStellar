import { lifeView, reincarnate, runCycle } from "@/lib/life";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  return json(await lifeView());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  const origin = new URL(req.url).origin;
  if (body?.action === "reset") return json(await reincarnate());
  if (body?.action === "cycle") return json(await runCycle(origin));
  return json({ error: "La vida espera un ciclo o una reencarnación." }, 400);
}
