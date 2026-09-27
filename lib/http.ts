import { AnchorError } from "./errors";

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function run(fn: () => Promise<unknown>) {
  try {
    return json(await fn());
  } catch (error) {
    if (error instanceof AnchorError) return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return json({ error: "El cuerpo no es JSON válido." }, 400);
    console.error(error);
    const message = error instanceof Error ? error.message : "error interno";
    return json({ error: message }, 500);
  }
}
