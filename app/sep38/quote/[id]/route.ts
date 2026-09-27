import { fetchQuote } from "@/lib/anchor";
import { run } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export function GET(req: Request, context: Context) {
  return run(async () => {
    const { id } = await context.params;
    return fetchQuote(req, id);
  });
}
