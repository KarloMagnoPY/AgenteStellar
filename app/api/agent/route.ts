import { answerAside } from "@/lib/agent/aside";
import { hasLanguageModel, runLanguage } from "@/lib/agent/language";
import { parseIntent } from "@/lib/agent/intent";
import { runProtocol } from "@/lib/agent/protocol";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) return json({ error: "Escribe qué debe hacer el agente." }, 400);

  const origin = new URL(req.url).origin;
  const intent = parseIntent(message);
  if (intent.type === "life" || intent.type === "cycle" || intent.type === "history") {
    return json(await answerAside(origin, intent.type));
  }
  if (intent.type === "help" && hasLanguageModel()) {
    try {
      return json(await runLanguage(origin, message));
    } catch (error) {
      const fallback = await runProtocol(origin, message);
      const reason = error instanceof Error ? error.message : "error del modelo";
      fallback.reply = `No pude usar el modelo de lenguaje (${reason}). ${fallback.reply}`;
      return json(fallback);
    }
  }

  return json(await runProtocol(origin, message));
}
