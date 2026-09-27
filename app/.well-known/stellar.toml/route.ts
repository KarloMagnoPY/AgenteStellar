import { stellarToml } from "@/lib/anchor";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    return await stellarToml(new URL(req.url).origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "error interno";
    return json({ error: message }, 500);
  }
}
