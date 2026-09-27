import { createQuote } from "@/lib/anchor";
import { json, run } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    return json(await createQuote(req), 201);
  } catch (error) {
    return run(() => {
      throw error;
    });
  }
}
