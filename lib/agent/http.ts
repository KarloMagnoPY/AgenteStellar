export async function callAnchor(
  origin: string,
  path: string,
  options?: {
    method?: string;
    token?: string;
    body?: unknown;
    search?: Record<string, string | undefined>;
  },
) {
  const url = new URL(path, origin);
  for (const [key, value] of Object.entries(options?.search ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    method: options?.method ?? "GET",
    headers: {
      ...(options?.body ? { "content-type": "application/json" } : {}),
      ...(options?.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      if (!response.ok) throw new Error(text.slice(0, 240));
      throw new Error("El anchor respondió algo que no es JSON.");
    }
  }
  if (!response.ok) {
    const error = typeof data.error === "string" ? data.error : `HTTP ${response.status}`;
    throw new Error(error);
  }
  return data;
}
